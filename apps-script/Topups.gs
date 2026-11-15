/**
 * Solicitudes de recarga vinculadas a Checkout Pro de PremiumGol.
 * El frontend recibe una autorización HMAC de 5 minutos SIN Access Token.
 * Solo se activa con propiedades privadas y backend habilitado.
 * No acredita saldo de apuestas desde esta función.
 */
function pgCheckoutTicket_(uid,orderId,amountCents,forStatus){
  const server=pgProp_('PAYMENTS_API_URL').replace(/\/+$/,'');
  const secret=pgProp_('PAYMENTS_ASSERTION_SECRET');
  const enabled=pgProp_('PAYMENTS_CHECKOUT_READY')==='true';
  if((!enabled&&!forStatus)||secret.length<32||!/^https:\/\/[^/]+$/.test(server)){
    return {paymentAvailable:false};
  }
  const now=Date.now(),payload={v:1,uid:String(uid),orderId:String(orderId),
    amountCents:Number(amountCents),currency:'PEN',iat:now,exp:now+300000};
  const encoded=Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/,'');
  const signed=Utilities.computeHmacSha256Signature(encoded,secret,Utilities.Charset.UTF_8);
  const signature=Utilities.base64EncodeWebSafe(signed).replace(/=+$/,'');
  return {paymentAvailable:true,paymentApiUrl:server,
    paymentIntent:encoded+'.'+signature};
}
function pgCreateTopupRequest_(x){
  return pgLock_(()=>{
    const row=pgRequireSession_(x.sessionToken);
    const user=pgObject_('users',row.values);
    const value=Number(x.amount),amountCents=Math.round(value*100);
    if(!Number.isFinite(value)||value<30||value>10000||
      !Number.isSafeInteger(amountCents)||Math.abs(value*100-amountCents)>0.00001){
      pgErr_('Ingresa un monto válido entre S/ 30 y S/ 10,000.');
    }
    const reference=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(reference))pgErr_('Solicitud inválida.');
    const previous=pgFind_('topup_requests','orderId',reference);
    if(previous){
      const prior=pgObject_('topup_requests',previous.values);
      if(String(prior.uid)!==String(user.uid)||
        Math.round(Number(prior.amountPEN)*100)!==amountCents)pgErr_('Solicitud inválida.');
      return {ok:true,orderId:reference,amount:amountCents/100,status:String(prior.status),
        ...pgCheckoutTicket_(user.uid,reference,amountCents)};
    }
    const at=pgNow_();
    pgWrite_('topup_requests',{orderId:reference,uid:user.uid,
      amountPEN:amountCents/100,status:'PENDIENTE',createdAt:at,updatedAt:at});
    return {ok:true,orderId:reference,amount:amountCents/100,status:'PENDIENTE',
      ...pgCheckoutTicket_(user.uid,reference,amountCents)};
  });
}
/** Entrega un token breve para consultar el pago después del retorno.
 * No concede créditos ni se guía por los parámetros URL de Mercado Pago.
 */
function pgTopupStatusTicket_(x){
  const row=pgRequireSession_(x.sessionToken);
  const user=pgObject_('users',row.values);
  const reference=pgClean_(x.orderId,90);
  if(!/^[A-Z0-9-]{10,90}$/i.test(reference))pgErr_('Solicitud inválida.');
  const found=pgFind_('topup_requests','orderId',reference);
  if(!found)pgErr_('Solicitud inválida.');
  const data=pgObject_('topup_requests',found.values);
  if(String(data.uid)!==String(user.uid))pgErr_('Solicitud inválida.');
  const cents=Math.round(Number(data.amountPEN)*100);
  return {ok:true,orderId:reference,amount:data.amountPEN,
    ...pgCheckoutTicket_(user.uid,reference,cents,true)};
}
