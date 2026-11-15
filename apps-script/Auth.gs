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
function pgCreateUser_(email,details,provider){
  if(pgIdentityByEmail_(email))pgErr_('El correo ya tiene una cuenta. Utiliza Ingresar.');
  const person=pgName_(details),contact=pgContact_(details),date=pgNow_(),uid=pgUuid_();
  pgWrite_('users',{uid,email,...person,...contact,docType:'',docNumber:'',provider,balance:PG.INITIAL_CREDITS,createdAt:date,updatedAt:date});
  pgWrite_('ledger',{txId:pgUuid_(),uid,playId:'',action:'BONO_INICIAL',delta:PG.INITIAL_CREDITS,balanceAfter:PG.INITIAL_CREDITS,createdAt:date});
  return pgIdentityByEmail_(email);
}
function pgSession_(userRow){
  const token=pgUuid_()+'.'+pgUuid_(),date=Date.now();
  const u=pgObject_('users',userRow.values);
  pgWrite_('sessions',{tokenHash:pgHash_(token),uid:u.uid,createdAt:date,expiresAt:date+PG.SESSION_DAYS*86400000,revokedAt:''});
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
  const email=pgEmail_(claims.email);
  return pgLock_(()=>{
    let row=pgIdentityByEmail_(email);
    if(!row){
      const display=pgClean_(claims.name,140),parts=display.split(/\s+/).filter(Boolean);
      const first=pgClean_(claims.given_name||parts[0]||'Jugador',70);
      const last=pgClean_(claims.family_name||parts.slice(1).join(' ')||'Premium Gol',70);
      row=pgCreateUser_(email,{firstName:first,lastName:last,countryCode:'+51',phone:''},'google');
    }
    return {ok:true,...pgSession_(row)};
  });
}
function pgRequireSession_(token){
  token=pgClean_(token,150);
  if(!/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(token))pgErr_('Sesión vencida. Vuelve a ingresar.');
  const session=pgFind_('sessions','tokenHash',pgHash_(token));
  if(!session)pgErr_('Sesión vencida. Vuelve a ingresar.');
  const data=pgObject_('sessions',session.values);
  if(data.revokedAt||Number(data.expiresAt)<=Date.now())pgErr_('Sesión vencida. Vuelve a ingresar.');
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
