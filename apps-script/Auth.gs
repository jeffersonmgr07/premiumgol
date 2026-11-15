/** Acceso con código OTP por correo o Google ID Token validado en servidor. */
function pgEmail_(value){const email=pgClean_(value,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))pgErr_('Correo electrónico no válido.');return email;}
function pgEmailKey_(email){return pgHash_(email).slice(0,34);}
function pgRandomCode_(){
  // Deriva 6 cifras de un UUID v4; máximo cinco intentos y caducidad a los 10 minutos.
  const hex=pgUuid_().replace(/-/g,'').slice(-12);
  return String(parseInt(hex,16)%1000000).padStart(6,'0');
}
function pgSendCode_(x){
  const email=pgEmail_(x.email),mode=x.mode==='register'?'register':'login';
  return pgLock_(()=>{
    const cache=CacheService.getScriptCache(),key=pgEmailKey_(email),limitKey='otp-limit-'+key;
    const sent=Number(cache.get(limitKey)||0);
    if(sent>=3)pgErr_('Solicita otro código dentro de unos minutos.');
    const code=pgRandomCode_(),salt=pgUuid_();
    const obj={hash:pgHash_(salt+'|'+code),salt,mode,attempts:0};
    cache.put('otp-'+key,JSON.stringify(obj),PG.CODE_TTL_SECONDS);
    cache.put(limitKey,String(sent+1),900);
    try{
      MailApp.sendEmail({to:email,subject:'Código de acceso · Premium Gol',name:'Premium Gol',body:
        'Tu código de Premium Gol es '+code+'\n\nVálido por 10 minutos. Nunca compartas este código.\nSi no solicitaste el acceso, puedes ignorar este mensaje.\n\nPremium Gol · PremiumLott'});
    }catch(err){console.warn('MailApp delivery failure');pgErr_('No se pudo enviar el código. Intenta más tarde.');}
    return {ok:true,message:'Código enviado.'};
  });
}
function pgCheckCode_(email,code,mode){
  const cache=CacheService.getScriptCache(),key='otp-'+pgEmailKey_(email),raw=cache.get(key);
  if(!raw)pgErr_('El código es incorrecto o ha vencido.');
  const obj=JSON.parse(raw);
  if(obj.mode!==mode||!/^\d{6}$/.test(String(code))||obj.attempts>=5){cache.remove(key);pgErr_('El código es incorrecto o ha vencido.');}
  if(pgHash_(obj.salt+'|'+code)!==obj.hash){
    obj.attempts++;if(obj.attempts>=5)cache.remove(key);else cache.put(key,JSON.stringify(obj),PG.CODE_TTL_SECONDS);
    pgErr_('El código es incorrecto o ha vencido.');
  }
  cache.remove(key);
}
function pgIdentityByEmail_(email){return pgFind_('users','email',email);}
function pgName_(x){
  const first=pgClean_(x.firstName,70),last=pgClean_(x.lastName,70);
  if(!first||!last||!/^\p{L}[\p{L}\p{M} .'-]*$/u.test(first)||!/^\p{L}[\p{L}\p{M} .'-]*$/u.test(last))pgErr_('Completa nombres y apellidos.');
  return {firstName:first,lastName:last};
}
function pgContact_(x){
  const countryCode=pgClean_(x.countryCode||'+51',5),phone=pgClean_(x.phone,15);
  if(!['+51','+58','+57','+56','+54','+52','+1','+34'].includes(countryCode))pgErr_('El número de WhatsApp no es válido.');
  if(phone&&!/^\d{6,15}$/.test(phone))pgErr_('El número de WhatsApp no es válido.');
  return {countryCode,phone};
}
/** Invitaciones preparadas para futuros beneficios; ningún registro acredita dinero. */
function pgInviteCode_(){
  for(let attempt=0;attempt<7;attempt++){
    const code=pgUuid_().replace(/-/g,'').slice(0,12).toUpperCase();
    if(!pgFind_('users','inviteCode',code))return code;
  }
  pgErr_('No se pudo crear tu enlace de invitación.');
}
function pgInviter_(code){
  code=pgClean_(code,16).toUpperCase();
  if(!/^[A-Z0-9]{10,16}$/.test(code))return '';
  const row=pgFind_('users','inviteCode',code);
  return row?String(pgObject_('users',row.values).uid):'';
}
function pgGoogleAvatar_(value){
  const url=pgClean_(value,500);
  return /^https:\/\/(?:lh\d+|[a-z0-9-]+)\.googleusercontent\.com\//i.test(url)?url:'';
}
function pgCreateUser_(email,details,provider){
  if(pgIdentityByEmail_(email))pgErr_('El correo ya tiene una cuenta. Utiliza Ingresar.');
  const person=pgName_(details),contact=pgContact_(details),date=pgNow_(),uid=pgUuid_();
  const inviteCode=pgInviteCode_(),invitedBy=pgInviter_(details.referralCode||'');
  pgWrite_('users',{uid,email,...person,...contact,docType:'',docNumber:'',
    provider,balance:PG.INITIAL_CREDITS,createdAt:date,updatedAt:date,
    avatarUrl:pgGoogleAvatar_(details.avatarUrl),inviteCode,invitedBy:invitedBy===uid?'':invitedBy});
  pgWrite_('ledger',{txId:pgUuid_(),uid,playId:'',action:'BONO_INICIAL',
    delta:PG.INITIAL_CREDITS,balanceAfter:PG.INITIAL_CREDITS,createdAt:date});
  return pgIdentityByEmail_(email);
}
function pgSession_(userRow){
  let u=pgObject_('users',userRow.values);
  if(!u.inviteCode){
    pgUpdate_('users',userRow.index,{inviteCode:pgInviteCode_()});
    userRow=pgFind_('users','uid',u.uid);
    u=pgObject_('users',userRow.values);
  }
  const token=pgUuid_()+'.'+pgUuid_(),date=Date.now();
  pgWrite_('sessions',{tokenHash:pgHash_(token),uid:u.uid,createdAt:date,
    expiresAt:date+PG.SESSION_DAYS*86400000,revokedAt:'',lastActivityAt:date});
  return {sessionToken:token,...pgSnapshot_(userRow)};
}
function pgVerifyCode_(x){
  const email=pgEmail_(x.email),mode=x.mode==='register'?'register':'login';
  // La verificación del OTP y escritura se realizan en una sección bloqueada.
  return pgLock_(()=>{
    const existing=pgIdentityByEmail_(email);
    // Validar datos antes de consumir el código cuando se va a crear una cuenta.
    if(!existing&&mode==='register'){
      pgName_(x);
      const contact=pgContact_(x);
      if(!contact.phone)pgErr_('Ingresa tu número de WhatsApp para registrarte.');
    }
    pgCheckCode_(email,pgClean_(x.code,6),mode);
    if(mode==='login'&&!existing)pgErr_('Regístrate primero para crear tu cuenta.');
    if(mode==='register'&&existing)pgErr_('El correo ya tiene una cuenta. Utiliza Ingresar.');
    const row=existing||pgCreateUser_(email,x,'email');
    return {ok:true,...pgSession_(row)};
  });
}
function pgGoogleLogin_(x){
  const startedAt=Date.now();
  const idToken=pgClean_(x.idToken,5000);
  if(!idToken||!pgProp_('GOOGLE_CLIENT_ID'))pgErr_('No se pudo validar el acceso con Google.');
  let claims;
  try{
    const url='https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(idToken);
    const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
    if(response.getResponseCode()!==200)pgErr_('No se pudo validar el acceso con Google.');
    claims=JSON.parse(response.getContentText());
  }catch(err){pgErr_('No se pudo validar el acceso con Google.');}
  const allowedIss=['https://accounts.google.com','accounts.google.com'];
  if(claims.aud!==pgProp_('GOOGLE_CLIENT_ID')||!allowedIss.includes(String(claims.iss))||
    !['true', '1'].includes(String(claims.email_verified))||Number(claims.exp)*1000<=Date.now()){
      pgErr_('No se pudo validar el acceso con Google.');
  }
  console.log('PremiumGol Google: ID token validado; tiempo ms='+String(Date.now()-startedAt));
  const email=pgEmail_(claims.email);
  return pgLock_(()=>{
    let row=pgIdentityByEmail_(email);
    if(!row){
      const display=pgClean_(claims.name,140),parts=display.split(/\s+/).filter(Boolean);
      const first=pgClean_(claims.given_name||parts[0]||'Jugador',70);
      const last=pgClean_(claims.family_name||parts.slice(1).join(' ')||'Premium Gol',70);
      row=pgCreateUser_(email,{firstName:first,lastName:last,countryCode:'+51',
        phone:'',avatarUrl:claims.picture,referralCode:x.referralCode},'google');
    }else{
      const avatar=pgGoogleAvatar_(claims.picture);
      const u=pgObject_('users',row.values);
      if(avatar&&avatar!==u.avatarUrl){
        pgUpdate_('users',row.index,{avatarUrl:avatar});
        row=pgFind_('users','email',email);
      }
    }
    const output={ok:true,...pgSession_(row)};
    console.log('PremiumGol Google: sesión creada; tiempo total ms='+String(Date.now()-startedAt));
    return output;
  });
}
function pgRequireSession_(token){
  token=pgClean_(token,150);
  if(!/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(token))pgErr_('Sesión vencida. Vuelve a ingresar.');
  const session=pgFind_('sessions','tokenHash',pgHash_(token));
  if(!session)pgErr_('Sesión vencida. Vuelve a ingresar.');
  const data=pgObject_('sessions',session.values);
  const now=Date.now();
  const lastActivity=Number(data.lastActivityAt)||Number(data.createdAt)||0;
  if(data.revokedAt||Number(data.expiresAt)<=now||
     !lastActivity||now-lastActivity>=PG.SESSION_IDLE_MINUTES*60000)
    pgErr_('Sesión vencida. Vuelve a ingresar.');
  // Evita escribir en Sheets con cada clic; el cliente renueva su sesión
  // solo mientras exista interacción reciente y la pestaña esté visible.
  if(now-lastActivity>=120000){
    pgUpdate_('sessions',session.index,{lastActivityAt:now});
  }
  const player=pgFind_('users','uid',data.uid);
  if(!player)pgErr_('Sesión vencida. Vuelve a ingresar.');
  return player;
}
function pgMe_(x){return pgSnapshot_(pgRequireSession_(x.sessionToken));}
function pgSignout_(x){
  const token=pgClean_(x.sessionToken,150);
  if(!token)return {ok:true};
  return pgLock_(()=>{
    const row=pgFind_('sessions','tokenHash',pgHash_(token));
    if(row)pgUpdate_('sessions',row.index,{revokedAt:Date.now()});
    return {ok:true};
  });
}
function pgUpdateProfile_(x){
  return pgLock_(()=>{
    const row=pgRequireSession_(x.sessionToken),person=pgName_(x),contact=pgContact_(x);
    if(!contact.phone)pgErr_('Ingresa tu número de WhatsApp para registrarte.');
    const docType=pgClean_(x.docType,3).toUpperCase();
    const docNumber=pgClean_(x.docNumber,20).toUpperCase();
    if(!['','DNI','CE','PAS'].includes(docType))pgErr_('El tipo de documento no es válido.');
    if(docNumber&&!/^[A-Z0-9-]{5,20}$/.test(docNumber))pgErr_('El número de documento no es válido.');
    if(Boolean(docType)!==Boolean(docNumber))pgErr_('El número de documento no es válido.');
    pgUpdate_('users',row.index,{...person,...contact,docType,docNumber,updatedAt:pgNow_()});
    return pgSnapshot_(pgFind_('users','uid',row.values[0]));
  });
}


/** Prueba de configuración OAuth sin imprimir credenciales ni secretos. */
function testPremiumGolGoogleConfiguration(){
  const id=pgProp_('GOOGLE_CLIENT_ID');
  const origin=pgProp_('FRONTEND_ORIGIN').replace(/\/+$/,'');
  const googleIdFormat=/^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(id);
  const result={
    clientIdConfigured:Boolean(id),
    clientIdWebFormatCorrect:googleIdFormat,
    origin:origin,
    originCorrect:origin==='https://premiumgol.website',
    warning:googleIdFormat?
      'Comprueba que este mismo Client ID figure en Google Cloud y en assets/config.js.':
      'GOOGLE_CLIENT_ID debe ser el ID de cliente OAuth WEB, no el Client Secret.'
  };
  console.log('PremiumGol Google OAuth: '+JSON.stringify(result));
  return result;
}
