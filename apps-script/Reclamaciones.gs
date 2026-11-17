/**
 * PREMIUMGOL · Libro de Reclamaciones Virtual (Perú).
 * Anexo I del Reglamento del Libro de Reclamaciones.
 *
 * Para habilitar:
 * 1. Actualiza Config.gs y Main.gs.
 * 2. Añade este archivo al mismo proyecto Apps Script.
 * 3. Configura estas propiedades (sin compartirlas con GitHub):
 *    PG_CLAIMS_PROVIDER_NAME = razón social exacta
 *    PG_CLAIMS_PROVIDER_RUC = RUC real de 11 cifras
 *    PG_CLAIMS_PROVIDER_ADDRESS = domicilio del proveedor
 *    PG_CLAIMS_ADMIN_EMAIL = correo responsable de atención (opcional)
 *    PG_CLAIMS_ENABLED = true
 * 4. Ejecuta setupLibroReclamaciones() UNA sola vez con el SPREADSHEET_ID ya existente.
 * 5. Actualiza la implementación existente (versión nueva).
 * El libro almacena reclamos de consumidores, nunca claves, fichas bancarias ni datos de tarjetas.
 */
const PG_CLAIMS_SHEET='reclamaciones';
function setupLibroReclamaciones(){
  const id=pgProp_('SPREADSHEET_ID');
  if(!id)pgErr_('Falta configurar la base de datos.');
  const spreadsheet=SpreadsheetApp.openById(id);
  const headers=PG.SHEETS[PG_CLAIMS_SHEET];
  let sheet=spreadsheet.getSheetByName(PG_CLAIMS_SHEET);
  if(!sheet)sheet=spreadsheet.insertSheet(PG_CLAIMS_SHEET);
  if(!sheet.getLastRow()){
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold')
      .setBackground('#102238').setFontColor('#ffffff');
  }else{
    const existing=sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);
    if(JSON.stringify(existing)!==JSON.stringify(headers))
      pgErr_('El esquema del Libro de Reclamaciones no coincide.');
  }
  return 'Hoja de reclamaciones preparada. Registros actuales: '+Math.max(0,sheet.getLastRow()-1);
}
function pgClaimsProvider_(){
  const name=pgProp_('PG_CLAIMS_PROVIDER_NAME');
  const ruc=pgProp_('PG_CLAIMS_PROVIDER_RUC');
  const address=pgProp_('PG_CLAIMS_PROVIDER_ADDRESS');
  return {name,ruc,address};
}
function pgClaimsReady_(){
  const p=pgClaimsProvider_();
  return pgProp_('PG_CLAIMS_ENABLED')==='true'&&
    p.name.length>=3&&/^\d{11}$/.test(p.ruc)&&p.address.length>=8&&
    Boolean(pgProp_('SPREADSHEET_ID'))&&
    Boolean(SpreadsheetApp.openById(pgProp_('SPREADSHEET_ID')).getSheetByName(PG_CLAIMS_SHEET));
}
function pgClaimsPublicConfig_(){
  const p=pgClaimsProvider_();
  let active=false;
  try{active=pgClaimsReady_();}catch(e){active=false;}
  return {ok:true,enabled:active,
    provider:active?p:{name:'',ruc:'',address:''},
    establishmentCode:'WEB-PREMIUMGOL',replyDaysBusiness:15};
}
function pgClaimsText_(raw,max){
  return String(raw===undefined||raw===null?'':raw)
    .replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
}
function pgClaimsValid_(condition,message){
  if(!condition)pgErr_(message||'Revisa los datos del formulario.');
}
function pgClaimsSave_(x){
  pgClaimsValid_(pgClaimsReady_(),'El Libro de Reclamaciones todavía no está configurado.');
  pgClaimsValid_(x&&typeof x==='object'&&!Array.isArray(x),'Solicitud inválida.');
  const clean=(key,max)=>pgClaimsText_(x[key],max);
  // Campo trampa contra formularios automatizados.
  pgClaimsValid_(!clean('website',120),'Revisa los datos del formulario.');
  const clientId=clean('clientRequestId',90);
  pgClaimsValid_(/^[A-Z0-9-]{15,90}$/i.test(clientId),'Solicitud inválida.');
  const kind=clean('claimKind',10);
  const itemKind=clean('itemKind',10);
  const minor=String(x.isMinor)==='true';
  const consent=x.acceptance===true;
  const name=clean('firstName',100),last=clean('lastName',100);
  const identityType=clean('documentType',12),identity=clean('documentNumber',30);
  const address=clean('homeAddress',240),city=clean('city',100),region=clean('region',100);
  const phone=clean('phone',25),email=clean('email',180).toLowerCase();
  const guardianName=clean('guardianName',160),guardianDoc=clean('guardianDocument',30),
    guardianPhone=clean('guardianPhone',25),guardianEmail=clean('guardianEmail',180);
  const description=clean('itemDescription',500);
  const detail=clean('detail',2400),request=clean('request',1800);
  const signed=clean('signatureName',210);
  const amount=Number(x.amountPEN);
  pgClaimsValid_(['RECLAMO','QUEJA'].includes(kind),'Selecciona Reclamo o Queja.');
  pgClaimsValid_(['PRODUCTO','SERVICIO'].includes(itemKind),'Selecciona Producto o Servicio.');
  pgClaimsValid_(name.length>=2&&last.length>=2,'Completa nombres y apellidos.');
  pgClaimsValid_(['DNI','CE','PASAPORTE','OTRO'].includes(identityType)&&
    /^[A-Za-z0-9-]{5,30}$/.test(identity),'Documento de identidad no válido.');
  pgClaimsValid_(address.length>=5&&city.length>=2&&region.length>=2,'Completa tu domicilio.');
  pgClaimsValid_(/^[+0-9()\s-]{6,25}$/.test(phone),'Teléfono no válido.');
  pgClaimsValid_(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email),'Correo electrónico no válido.');
  if(minor)pgClaimsValid_(guardianName.length>=5&&guardianDoc.length>=5&&
    /^[+0-9()\s-]{6,25}$/.test(guardianPhone)&&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(guardianEmail),
    'Completa la información del representante.');
  pgClaimsValid_(Number.isFinite(amount)&&amount>=0&&amount<=10000000,
    'Monto del bien o servicio no válido.');
  pgClaimsValid_(description.length>=5&&detail.length>=15&&request.length>=5,
    'Completa la descripción, el detalle y tu pedido.');
  pgClaimsValid_(consent&&signed.toLocaleLowerCase('es-PE')===
    (name+' '+last).toLocaleLowerCase('es-PE'),
    'Confirma tu solicitud y escribe tu nombre completo.');
  const property=pgClaimsProvider_();
  const result=pgLock_(()=>{
    const old=pgFind_(PG_CLAIMS_SHEET,'clientRequestId',clientId);
    if(old){
      const row=pgObject_(PG_CLAIMS_SHEET,old.values);
      return {ok:true,claimNumber:String(row.claimNumber),
        registeredAt:String(row.createdAt),provider:property,
        duplicate:true};
    }
    const cache=CacheService.getScriptCache();
    const key='claim-'+pgHash_(email).slice(0,32);
    if(cache.get(key))pgErr_('Espera un momento antes de enviar otra reclamación.');
    const now=new Date();
    const date=Utilities.formatDate(now,'America/Lima','yyyyMMdd');
    const seqKey='PG_CLAIM_SEQUENCE_'+date;
    const props=PropertiesService.getScriptProperties();
    const next=Number(props.getProperty(seqKey)||'0')+1;
    pgClaimsValid_(Number.isSafeInteger(next)&&next<1000000,'No se pudo generar el número.');
    props.setProperty(seqKey,String(next));
    const number='PG-'+date+'-'+String(next).padStart(6,'0');
    const createdAt=now.toISOString();
    pgWrite_(PG_CLAIMS_SHEET,{
      claimNumber:number,clientRequestId:clientId,createdAt,siteCode:'WEB-PREMIUMGOL',
      providerName:property.name,providerRUC:property.ruc,providerAddress:property.address,
      claimKind:kind,firstName:name,lastName:last,documentType:identityType,documentNumber:identity,
      homeAddress:address,city,region,phone,email,isMinor:minor?'SI':'NO',
      guardianName,guardianDocument:guardianDoc,guardianPhone,guardianEmail,
      itemKind,itemDescription:description,amountPEN:amount,
      detail,request,signatureName:signed,acceptanceAt:createdAt,
      status:'PENDIENTE',providerObservations:'',providerActions:'',
      responseDate:'',responseSentAt:'',receiptEmailStatus:'PENDIENTE'
    });
    cache.put(key,'1',60);
    return {ok:true,claimNumber:number,registeredAt:createdAt,
      provider:property,duplicate:false};
  });
  if(!result.duplicate){
    const subject='PremiumGol · Hoja de Reclamación '+result.claimNumber;
    const lines=[
      'CONSTANCIA DE HOJA DE RECLAMACIÓN · PREMIUMGOL',
      'Número: '+result.claimNumber,
      'Fecha y hora (Perú): '+Utilities.formatDate(new Date(result.registeredAt),
        'America/Lima','dd/MM/yyyy HH:mm:ss'),
      'Proveedor: '+property.name+' · RUC '+property.ruc,
      'Domicilio: '+property.address,'Establecimiento: WEB-PREMIUMGOL',
      'Tipo de solicitud: '+kind,
      'Consumidor: '+name+' '+last,
      'Documento: '+identityType+' '+identity,
      'Domicilio del consumidor: '+address+', '+city+', '+region,
      'Teléfono: '+phone,'Correo: '+email,
      ...(minor?['Representante: '+guardianName,'Documento representante: '+guardianDoc,
        'Teléfono: '+guardianPhone,'Correo: '+guardianEmail]:[]),
      'Bien: '+itemKind+' · '+description,
      'Monto: S/ '+amount.toFixed(2),
      'Detalle: '+detail,'Pedido: '+request,
      'Conformidad digital: '+signed,
      'Estado: pendiente de atención',
      'El proveedor debe responder en un máximo de 15 días hábiles improrrogables.',
      'La presentación no impide acudir a otras vías de solución de controversias.'
    ];
    const emailBody=lines.join('\n');
    try{
      MailApp.sendEmail({to:email,subject,body:emailBody,name:'PremiumGol · Reclamaciones'});
      const match=pgFind_(PG_CLAIMS_SHEET,'claimNumber',result.claimNumber);
      if(match)pgUpdate_(PG_CLAIMS_SHEET,match.index,{receiptEmailStatus:'ENVIADO'});
      result.receiptEmailSent=true;
    }catch(err){
      console.warn('No se pudo enviar copia al consumidor: '+String(err&&err.message||''));
      result.receiptEmailSent=false;
    }
    const owner=pgProp_('PG_CLAIMS_ADMIN_EMAIL');
    if(owner&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(owner)){
      try{MailApp.sendEmail({
        to:owner,subject:'Nueva reclamación '+result.claimNumber,body:emailBody,
        name:'PremiumGol · Reclamaciones'
      });}catch(err){console.warn('No se pudo enviar aviso de reclamo al administrador.');}
    }
  }
  return result;
}
