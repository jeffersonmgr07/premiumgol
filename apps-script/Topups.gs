/**
 * PREMIUMGOL · Mercado Pago Checkout Pro mediante SOLO Google Apps Script.
 * El Access Token NUNCA sale del backend ni del editor privado.
 * Verificación: /v1/payments/search + GET /v1/payments/{id}.
 * Conciliación inmediata al regresar + activador periódico de 5 minutos.
 * Créditos iniciales de prueba y billetera monetaria se conservan separados.
 */
function pgMpConfig_(requireEnabled){
  const env=pgProp_('MP_ENV')==='production'?'production':'test';
  const token=env==='test'?pgProp_('MP_TEST_ACCESS_TOKEN'):pgProp_('MP_ACCESS_TOKEN');
  const collector=pgProp_('MP_COLLECTOR_ID');
  const enabled=pgProp_('MP_CHECKOUT_ENABLED')==='true';
  if(requireEnabled&&!enabled)pgErr_('El pago en línea todavía no está disponible.');
  if(!token||!/^\d+$/.test(collector))pgErr_('La conexión de pago todavía no está configurada.');
  return {env,token,collector,enabled};
}
function pgMpHttp_(endpoint,method,body,config){
  if(!/^\/[a-zA-Z0-9_./?=&%+-]+$/.test(endpoint))pgErr_('Solicitud inválida.');
  let response;
  try{
    const opts={
      method:method||'get',muteHttpExceptions:true,
      headers:{Authorization:'Bearer '+config.token,Accept:'application/json'}
    };
    if(body!==null&&body!==undefined){
      opts.contentType='application/json';
      opts.payload=JSON.stringify(body);
    }
    response=UrlFetchApp.fetch('https://api.mercadopago.com'+endpoint,opts);
  }catch(err){
    console.warn('Mercado Pago: conexión no disponible.');
    pgErr_('No se pudo conectar a Mercado Pago. Intenta nuevamente.');
  }
  const status=response.getResponseCode();
  let json={};
  try{json=JSON.parse(response.getContentText()||'{}');}catch(err){}
  if(status<200||status>=300){
    console.warn('Mercado Pago: HTTP '+status+' al consultar '+endpoint.split('?')[0]);
    pgErr_('Mercado Pago no pudo procesar la solicitud. Intenta nuevamente.');
  }
  return json;
}
function pgMpUrl_(value){
  const url=String(value||'');
  if(!/^https:\/\/([a-z0-9-]+\.)*mercadopago\.(com|com\.pe)\//i.test(url))return '';
  return url;
}
function pgTopupAmount_(value){
  const n=Number(value),c=Math.round(n*100);
  if(!Number.isFinite(n)||n<30||n>10000||
    !Number.isSafeInteger(c)||Math.abs(n*100-c)>0.00001)
    pgErr_('Ingresa un monto válido entre S/ 30 y S/ 10,000.');
  return c;
}
/** No presentar enlaces sandbox guardados cuando el servidor está en producción. */
function pgMpIsSandboxUrl_(value){
  return /^https:\/\/sandbox\./i.test(String(value||''));
}
const PG_MP_ORDER_VALID_MS=48*60*60*1000;
function pgMpPendingExpired_(o){
  const state=String(o.status||'PENDING').toUpperCase();
  if(!['PENDING','PENDIENTE','CREATING','IN_PROCESS','EXPIRED'].includes(state))return false;
  const stamp=new Date(o.createdAt).getTime();
  return Number.isFinite(stamp)&&Date.now()-stamp>=PG_MP_ORDER_VALID_MS;
}
function pgMpPublicOrder_(o){
  const created=o.createdAt instanceof Date?o.createdAt.toISOString():String(o.createdAt||'');
  const checkout=pgMpUrl_(o.checkoutUrl);
  const expired=pgMpPendingExpired_(o);
  const safeCheckout=expired||(
    pgProp_('MP_ENV')==='production'&&pgMpIsSandboxUrl_(checkout))?'':checkout;
  return {ok:true,orderId:String(o.orderId),amount:Number(o.amountPEN),
    status:expired?'EXPIRED':String(o.status||'PENDING'),
    checkoutUrl:safeCheckout,createdAt:created,
    expiresAt:Number.isFinite(new Date(created).getTime())?
      new Date(new Date(created).getTime()+PG_MP_ORDER_VALID_MS).toISOString():'',
    paidAt:String(o.paidAt||'')};
}
function pgMpPreference_(o,config){
  const origin=pgProp_('FRONTEND_ORIGIN').replace(/\/+$/,'');
  if(!/^https:\/\/[^/]+$/.test(origin))
    pgErr_('El pago en línea todavía no está disponible.');
  const back=origin+'/?mp_return=1&order='+encodeURIComponent(o.orderId)+'#account';
  const start=new Date(o.createdAt).getTime();
  if(!Number.isFinite(start)||Date.now()-start>=PG_MP_ORDER_VALID_MS)
    pgErr_('Esta orden venció. Genera una recarga nueva.');
  const body={
    expires:true,
    expiration_date_from:new Date(start).toISOString(),
    expiration_date_to:new Date(start+PG_MP_ORDER_VALID_MS).toISOString(),
    items:[{id:'pg-topup',title:'Recarga de saldo PremiumGol',
      quantity:1,currency_id:'PEN',unit_price:Number(o.amountPEN)}],
    external_reference:String(o.orderId),
    back_urls:{success:back,pending:back,failure:back},
    auto_return:'approved',
    payer:{email:String(o.email||'')}
  };
  const data=pgMpHttp_('/checkout/preferences','post',body,config);
  const url=pgMpUrl_(data.init_point);
  if(!data.id||!url||
     (config.env==='production'&&pgMpIsSandboxUrl_(url)))
    pgErr_('Mercado Pago no devolvió un enlace válido.');
  return {preferenceId:String(data.id),checkoutUrl:url};
}
/** Crea una orden idempotente y su preferencia, o devuelve la existente.
 * El LockService serializa la creación para el volumen inicial del proyecto.
 */
function pgCreateTopupRequest_(x){
  return pgLock_(()=>{
    const config=pgMpConfig_(true);
    const userRow=pgRequireSession_(x.sessionToken);
    const user=pgObject_('users',userRow.values);
    const amountCents=pgTopupAmount_(x.amount);
    const reference=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(reference))pgErr_('Solicitud inválida.');
    const existing=pgFind_('topup_requests','orderId',reference);
    let order,orderIndex;
    if(existing){
      order=pgObject_('topup_requests',existing.values);
      if(String(order.uid)!==String(user.uid)||
         pgTopupAmount_(order.amountPEN)!==amountCents)
        pgErr_('Solicitud inválida.');
      orderIndex=existing.index;
      if(pgMpPendingExpired_(order))
        pgErr_('Esta orden venció. Genera una recarga nueva.');
      if(order.checkoutUrl){
        // Nunca transformar ni reabrir una preferencia sandbox antigua.
        if(config.env==='production'&&pgMpIsSandboxUrl_(order.checkoutUrl))
          pgErr_('Esta orden fue creada en pruebas. Genera una recarga nueva.');
        return {...pgMpPublicOrder_(order),
          paidBalancePEN:pgMoneyBalance_(user.uid)};
      }
      if(order.status==='APPROVED')return {...pgMpPublicOrder_(order),
        paidBalancePEN:pgMoneyBalance_(user.uid)};
    }else{
      const at=pgNow_();
      order={orderId:reference,uid:user.uid,amountPEN:amountCents/100,
        status:'PENDING',createdAt:at,updatedAt:at};
      pgWrite_('topup_requests',order);
      orderIndex=pgFind_('topup_requests','orderId',reference).index;
    }
    // Reintento tras fallo de la preferencia: recuperar primero cualquier
    // preferencia creada por MP con esta misma referencia.
    let preference=null;
    try{
      const found=existing?pgMpHttp_('/checkout/preferences/search?external_reference='+
        encodeURIComponent(reference)+'&limit=5','get',null,config):{elements:[]};
      for(const item of (found.elements||[])){
        if(String(item.external_reference)===reference&&item.id){
          const detail=pgMpHttp_('/checkout/preferences/'+encodeURIComponent(String(item.id)),
            'get',null,config);
          const link=pgMpUrl_(detail.init_point);
          if(link&&!(config.env==='production'&&pgMpIsSandboxUrl_(link))){
            preference={preferenceId:String(item.id),checkoutUrl:link};break;
          }
        }
      }
    }catch(e){
      // Buscar una preferencia antigua es opcional; no revelar detalles del proveedor.
      console.warn('No se pudo recuperar la preferencia; se intentará crear una nueva.');
    }
    if(!preference)preference=pgMpPreference_({...order,email:user.email},config);
    pgUpdate_('topup_requests',orderIndex,{...preference,status:'PENDING',
      updatedAt:pgNow_()});
    return {...pgMpPublicOrder_({...order,...preference}),paidBalancePEN:pgMoneyBalance_(user.uid)};
  });
}
/** La búsqueda por external_reference puede devolver más de un intento.
 * Se valida cada pago individualmente en el endpoint del proveedor.
 */
function pgMpSearch_(order,config){
  const params='external_reference='+encodeURIComponent(String(order.orderId))+
    '&sort=date_created&criteria=desc&limit=10&offset=0';
  const data=pgMpHttp_('/v1/payments/search?'+params,'get',null,config);
  return Array.isArray(data.results)?data.results.slice(0,10):[];
}
function pgMpValid_(payment,order,config){
  const validStatus=['approved','pending','in_process','rejected','cancelled',
    'refunded','charged_back'].includes(String(payment.status));
  return validStatus&&String(payment.external_reference)===String(order.orderId)
    &&String(payment.collector_id)===String(config.collector)
    &&String(payment.currency_id)==='PEN'
    &&Math.round(Number(payment.transaction_amount)*100)===pgTopupAmount_(order.amountPEN)
    &&payment.live_mode===(config.env==='production');
}
function pgMpLedgerHas_(entryId){
  return Boolean(pgFind_('payments_ledger','entryId',entryId));
}
/** Escribe un único movimiento monetario por orden. Sin saldos demo mezclados. */
function pgMpRecordVerified_(orderId,payment,config){
  return pgLock_(()=>{
    const row=pgFind_('topup_requests','orderId',orderId);
    if(!row)return null;
    const order=pgObject_('topup_requests',row.values);
    if(!pgMpValid_(payment,order,config))return pgMpPublicOrder_(order);
    const status=String(payment.status).toUpperCase();
    const pid=String(payment.id);
    if(['REFUNDED','CHARGED_BACK'].includes(String(order.status))&&status==='APPROVED')
      return pgMpPublicOrder_(order);
    // Una orden ya aprobada nunca se reasigna a otro paymentId.
    if(order.status==='APPROVED'&&order.paymentId&&String(order.paymentId)!==pid)
      return pgMpPublicOrder_(order);
    const time=pgNow_();
    if(status==='APPROVED'){
      // Solo los pagos de producción pueden aportar saldo monetario.
      if(config.env==='production'){
        const entryId='MP-ORDER-'+String(order.orderId);
        if(!pgMpLedgerHas_(entryId)){
          pgWrite_('payments_ledger',{entryId,uid:order.uid,orderId:order.orderId,
            paymentId:pid,deltaPEN:Number(order.amountPEN),
            type:'TOPUP_APPROVED',createdAt:time});
        }
      }
      pgUpdate_('topup_requests',row.index,{status:'APPROVED',paymentId:pid,
        paidAt:order.paidAt||time,lastCheckAt:time,updatedAt:time});
    }else if(['REFUNDED','CHARGED_BACK'].includes(status)){
      if(config.env==='production'){
        const original='MP-ORDER-'+String(order.orderId);
        const reverse='MP-REVERSE-'+String(order.orderId);
        if(pgMpLedgerHas_(original)&&!pgMpLedgerHas_(reverse)){
          pgWrite_('payments_ledger',{entryId:reverse,uid:order.uid,orderId:order.orderId,
            paymentId:pid,deltaPEN:-Number(order.amountPEN),
            type:status,createdAt:time});
        }
      }
      pgUpdate_('topup_requests',row.index,{status,paymentId:pid,
        lastCheckAt:time,updatedAt:time});
    }else if(order.status!=='APPROVED'){
      pgUpdate_('topup_requests',row.index,{status,paymentId:pid,
        lastCheckAt:time,updatedAt:time});
    }
    const latest=pgFind_('topup_requests','orderId',orderId);
    return pgMpPublicOrder_(pgObject_('topup_requests',latest.values));
  });
}
function pgMpReconcileOne_(orderId){
  const config=pgMpConfig_(false);
  const row=pgFind_('topup_requests','orderId',orderId);
  if(!row)return null;
  const order=pgObject_('topup_requests',row.values);
  if(!order.preferenceId)return pgMpPublicOrder_(order);
  const found=pgMpSearch_(order,config);
  let best=null;
  for(const item of found){
    const paymentId=String(item.id||'');
    if(!/^\d+$/.test(paymentId))continue;
    const payment=pgMpHttp_('/v1/payments/'+encodeURIComponent(paymentId),'get',null,config);
    if(!pgMpValid_(payment,order,config))continue;
    if(!best||String(payment.status)==='approved'||
       ['refunded','charged_back'].includes(String(payment.status))){
      best=payment;
      if(payment.status==='approved')break;
    }
  }
  if(best)return pgMpRecordVerified_(orderId,best,config);
  return pgMpPublicOrder_(order);
}
/** Consulta protegida, identifica el usuario y concilia sin confiar
 * en payment_id o status que vuelvan en la URL del navegador.
 */
function pgGetTopupStatus_(x){
  const row=pgRequireSession_(x.sessionToken);
  const user=pgObject_('users',row.values);
  const reference=pgClean_(x.orderId,90);
  if(!/^[A-Z0-9-]{10,90}$/i.test(reference))pgErr_('Solicitud inválida.');
  const orderRow=pgFind_('topup_requests','orderId',reference);
  if(!orderRow||String(orderRow.values[1])!==String(user.uid))
    pgErr_('Solicitud inválida.');
  let order=pgMpReconcileOne_(reference);
  return {...order,paidBalancePEN:pgMoneyBalance_(user.uid)};
}
/** Historial de solicitudes del usuario, sin IDs de cuentas del proveedor. */
function pgListTopupOrders_(x){
  const userRow=pgRequireSession_(x.sessionToken);
  const user=pgObject_('users',userRow.values);
  const rows=pgRows_('topup_requests').rows.filter(r=>String(r[1])===String(user.uid));
  // Las pendientes vencidas se ocultan. Conservamos las aprobadas,
  // rechazadas y reembolsadas para conciliación y estado de cuenta.
  const recent=rows.map(r=>pgObject_('topup_requests',r))
    .filter(o=>!pgMpPendingExpired_(o))
    .sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime())
    .slice(0,15);
  return {ok:true,orders:recent.map(pgMpPublicOrder_),
    paidBalancePEN:pgMoneyBalance_(user.uid)};
}
/** Activador periódico, también recupera pagos completados horas después.
 * Máximo de 8 órdenes por ejecución para limitar el consumo de API.
 */
function pgMpReconcilePendingOrders(){
  const cfg=pgMpConfig_(false);
  if(!pgProp_('SPREADSHEET_ID'))return {ok:false};
  const rows=pgRows_('topup_requests').rows;
  const now=Date.now(),active=rows.filter(r=>{
    const status=String(r[3]);
    const age=now-new Date(r[4]).getTime();
    const checked=r[10]?now-new Date(r[10]).getTime():Infinity;
    // Mantener la conciliación incluso después de 48 horas:
    // pagos offline tardíos no pueden perderse por ocultar la orden.
    return ['PENDING','PENDIENTE','IN_PROCESS','CREATING','EXPIRED'].includes(status)
      &&age>=0&&age<30*86400000&&checked>4*60000&&Boolean(r[6]);
  });
  const props=PropertiesService.getScriptProperties();
  const offset=Number(props.getProperty('MP_SCAN_OFFSET')||0);
  const ordered=active.length?
    active.slice(offset%active.length).concat(active.slice(0,offset%active.length)):[];
  let attempted=0;
  for(const r of ordered.slice(0,8)){
    try{pgMpReconcileOne_(String(r[0]));attempted++;}
    catch(e){console.warn('Mercado Pago: no se pudo conciliar una orden pendiente.');}
    // Evitar repetir una consulta fallida continuamente.
    try{
      const rr=pgFind_('topup_requests','orderId',String(r[0]));
      if(rr)pgUpdate_('topup_requests',rr.index,{lastCheckAt:pgNow_()});
    }catch(e){}
  }
  props.setProperty('MP_SCAN_OFFSET',String(active.length?(offset+attempted)%active.length:0));
  return {ok:true,pendientes:active.length,consultadas:attempted,modo:cfg.env};
}
/** Auditoría diaria de pagos recientes: detecta devoluciones y contracargos.
 * No se modifica el crédito virtual, solo el libro monetario.
 */
function pgMpAuditSettledOrders(){
  if(!pgProp_('SPREADSHEET_ID'))return {ok:false};
  const now=Date.now();
  const orders=pgRows_('topup_requests').rows.filter(r=>
    ['APPROVED','REFUNDED','CHARGED_BACK'].includes(String(r[3]))&&
    now-new Date(r[4]).getTime()<45*86400000);
  const prop=PropertiesService.getScriptProperties();
  const cursor=Number(prop.getProperty('MP_AUDIT_CURSOR')||0);
  const items=orders.length?
    orders.slice(cursor%orders.length).concat(orders.slice(0,cursor%orders.length)):[];
  let done=0;
  for(const row of items.slice(0,6)){
    try{pgMpReconcileOne_(String(row[0]));done++;}
    catch(e){console.warn('Auditoría Mercado Pago: orden pendiente de revisión.');}
  }
  prop.setProperty('MP_AUDIT_CURSOR',String(orders.length?(cursor+Math.max(done,1))%orders.length:0));
  return {ok:true,revisadas:done};
}
function setupPremiumGolMercadoPagoTrigger(){
  const name='pgMpReconcilePendingOrders';
  const present=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===name);
  if(!present)ScriptApp.newTrigger(name).timeBased().everyMinutes(5).create();
  const audit='pgMpAuditSettledOrders';
  const auditExists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===audit);
  if(!auditExists)ScriptApp.newTrigger(audit).timeBased().everyDays(1).create();
  console.log('Mercado Pago: conciliación pendiente cada 5 minutos y auditoría diaria configuradas.');
  return {ok:true,triggerConfigured:true,auditConfigured:true};
}
function testPremiumGolCheckoutConfiguration(){
  const props=PropertiesService.getScriptProperties();
  const id=pgProp_('SPREADSHEET_ID');
  const results={
    tokenConfigured:Boolean(pgProp_('MP_ENV')==='production'?pgProp_('MP_ACCESS_TOKEN'):
      pgProp_('MP_TEST_ACCESS_TOKEN')),
    collectorConfigured:/^\d+$/.test(pgProp_('MP_COLLECTOR_ID')),
    mode:pgProp_('MP_ENV')==='production'?'production':'test',
    enabled:pgProp_('MP_CHECKOUT_ENABLED')==='true',
    ordersSheet:!!id&&Boolean(SpreadsheetApp.openById(id).getSheetByName('topup_requests')),
    moneyLedgerSheet:!!id&&Boolean(SpreadsheetApp.openById(id).getSheetByName('payments_ledger')),
    automaticReconciliation:ScriptApp.getProjectTriggers().some(t=>
      t.getHandlerFunction()==='pgMpReconcilePendingOrders'),
    dailyAudit:ScriptApp.getProjectTriggers().some(t=>
      t.getHandlerFunction()==='pgMpAuditSettledOrders')
  };
  console.log('PremiumGol Mercado Pago: '+JSON.stringify(results));
  return results;
}

/** Solo información de diagnóstico; no registra ni imprime tokens. */
function testPremiumGolMerchantId(){
  const mode=pgProp_('MP_ENV')==='production'?'production':'test';
  const token=mode==='test'?pgProp_('MP_TEST_ACCESS_TOKEN'):pgProp_('MP_ACCESS_TOKEN');
  if(!token)pgErr_('La conexión de pago todavía no está configurada.');
  const resp=UrlFetchApp.fetch('https://api.mercadolibre.com/users/me',{
    method:'get',muteHttpExceptions:true,
    headers:{Authorization:'Bearer '+token}
  });
  if(resp.getResponseCode()!==200)
    pgErr_('No fue posible consultar el identificador de Mercado Pago.');
  const data=JSON.parse(resp.getContentText()||'{}');
  const id=String(data.id||'');
  const result={collectorId:id,collectorMatches:id===pgProp_('MP_COLLECTOR_ID'),mode};
  console.log('Mercado Pago · Cuenta receptora: '+JSON.stringify(result));
  return result;
}

/** Diagnóstico de órdenes antiguas sin publicar tokens ni IDs de compradores. */
function testPremiumGolCheckoutOrigin(){
  const mode=pgProp_('MP_ENV')==='production'?'production':'test';
  const token=mode==='production'?pgProp_('MP_ACCESS_TOKEN'):pgProp_('MP_TEST_ACCESS_TOKEN');
  const data=pgRows_('topup_requests').rows;
  const oldSandbox=data.filter(r=>pgMpIsSandboxUrl_(r[7])).length;
  const result={
    configuredMode:mode,
    expectedCredentialProperty:mode==='production'?'MP_ACCESS_TOKEN':'MP_TEST_ACCESS_TOKEN',
    credentialConfigured:Boolean(token),
    collectorConfigured:/^\d+$/.test(pgProp_('MP_COLLECTOR_ID')),
    checkoutEnabled:pgProp_('MP_CHECKOUT_ENABLED')==='true',
    historicalSandboxOrders:oldSandbox,
    blockedHistoricalSandboxLinks:mode==='production',
    recommendation:'Crea una orden nueva despues de actualizar la implementacion.'
  };
  console.log('PremiumGol · Diagnóstico de checkout: '+JSON.stringify(result));
  return result;
}

/** Revisión de vencimientos sin borrar órdenes ni movimientos monetarios. */
function testPremiumGolOrderExpiry(){
  const old={status:'PENDING',createdAt:new Date(Date.now()-49*3600000)};
  const fresh={status:'PENDING',createdAt:new Date(Date.now()-3600000)};
  const paid={status:'APPROVED',createdAt:new Date(Date.now()-72*3600000)};
  const result={expiredHidden:pgMpPendingExpired_(old),
    recentVisible:!pgMpPendingExpired_(fresh),
    settledPreserved:!pgMpPendingExpired_(paid)};
  console.log('PremiumGol · Vencimiento 48h: '+JSON.stringify(result));
  return result;
}
