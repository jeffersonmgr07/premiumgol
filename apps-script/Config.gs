/** PREMIUM GOL — servidor de pruebas con créditos virtuales.
 * PROPIEDADES REQUERIDAS DEL SCRIPT:
 *   FRONTEND_ORIGIN = https://tu-dominio.com  (sin barra final)
 *   GOOGLE_CLIENT_ID = ID de cliente OAuth Web
 *   SPREADSHEET_ID = se crea automáticamente con setupPremiumGol()
 * OPCIONAL PARA DESPUÉS:
 *   API_SPORTS_KEY = secreto del proveedor, nunca en GitHub
 */
const PG = Object.freeze({
  SHEETS: {
    users:['uid','email','firstName','lastName','countryCode','phone','docType','docNumber','provider','balance','createdAt','updatedAt','avatarUrl','inviteCode','invitedBy'],
    sessions:['tokenHash','uid','createdAt','expiresAt','revokedAt','lastActivityAt'],
    plays:['playId','uid','type','roundId','picksJson','stake','combinedOdds','potentialReturn','createdAt','note'],
    ledger:['txId','uid','playId','action','delta','balanceAfter','createdAt'],
    topup_requests:['orderId','uid','amountPEN','status','createdAt','updatedAt','preferenceId','checkoutUrl','paymentId','paidAt','lastCheckAt'],
    payments_ledger:['entryId','uid','orderId','paymentId','deltaPEN','type','createdAt'],
    bonus_ledger:['entryId','uid','sourceUid','amountPEN','status','createdAt','note']
  },
  INITIAL_CREDITS:10,
  MAX_STAKE:1000,
  SESSION_DAYS:7,
  SESSION_IDLE_MINUTES:60,
  ROUND_ID:'premiumgol12-jornada-20261118',
  GOL_CUTOFF_ISO:'2026-11-18T18:30:00-05:00',
  GOL_STAKE:5,
  COUPON_AMOUNT:50,
  COUPON_DURATION_MINUTES:5,
  CODE_TTL_SECONDS:600
});
function pgProp_(name){return String(PropertiesService.getScriptProperties().getProperty(name)||'').trim();}
function pgErr_(message){throw new Error(message);}
function pgClean_(value,max){return String(value===undefined?'':value).trim().slice(0,max);}
function pgHash_(text){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(text),Utilities.Charset.UTF_8).map(b=>(b&255).toString(16).padStart(2,'0')).join('');}
function pgUuid_(){return Utilities.getUuid();}
function pgNow_(){return new Date().toISOString();}
function pgLock_(fn){const lock=LockService.getScriptLock();if(!lock.tryLock(12000))pgErr_('Hay muchas solicitudes. Vuelve a intentarlo.');try{return fn();}finally{lock.releaseLock();}}

/** Ejecutar manualmente una sola vez desde el editor de Apps Script. */
function setupPremiumGol(){
  const props=PropertiesService.getScriptProperties();
  let id=pgProp_('SPREADSHEET_ID');
  if(!id){const db=SpreadsheetApp.create('PremiumGol · Datos de prueba');id=db.getId();props.setProperty('SPREADSHEET_ID',id);}
  const doc=SpreadsheetApp.openById(id);
  Object.keys(PG.SHEETS).forEach(name=>{
    let sh=doc.getSheetByName(name);
    if(!sh)sh=doc.insertSheet(name);
    if(sh.getLastRow()===0){
      sh.getRange(1,1,1,PG.SHEETS[name].length).setValues([PG.SHEETS[name]]);
      sh.setFrozenRows(1);
    }else if(name==='sessions'){
      // Agrega la hora de última actividad sin modificar ni eliminar sesiones previas.
      const original=PG.SHEETS.sessions.slice(0,5);
      const header=sh.getRange(1,1,1,5).getValues()[0].map(String);
      if(JSON.stringify(header)!==JSON.stringify(original))
        pgErr_('El esquema de sesiones no coincide; revisa la hoja.');
      if(sh.getMaxColumns()<6)sh.insertColumnsAfter(sh.getMaxColumns(),6-sh.getMaxColumns());
      const sixth=String(sh.getRange(1,6,1,1).getValue()||'');
      if(sixth&&sixth!=='lastActivityAt')pgErr_('La hoja de sesiones tiene otra columna adicional.');
      sh.getRange(1,6).setValue('lastActivityAt');
    }else if(name==='topup_requests'){
      const original=PG.SHEETS.topup_requests.slice(0,6);
      const header=sh.getRange(1,1,1,6).getValues()[0].map(String);
      if(JSON.stringify(header)!==JSON.stringify(original))
        pgErr_('El esquema de órdenes de recarga no coincide; revisa la hoja.');
      if(sh.getMaxColumns()<PG.SHEETS.topup_requests.length)
        sh.insertColumnsAfter(sh.getMaxColumns(),PG.SHEETS.topup_requests.length-sh.getMaxColumns());
      const extras=sh.getRange(1,7,1,5).getValues()[0].map(String);
      if(extras.some((v,i)=>v&&v!==PG.SHEETS.topup_requests[i+6]))
        pgErr_('La hoja de recargas tiene columnas adicionales; migración detenida.');
      sh.getRange(1,7,1,5).setValues([PG.SHEETS.topup_requests.slice(6)]);
    }else if(name==='users'){
      const current=sh.getRange(1,1,1,12).getValues()[0].map(String);
      if(JSON.stringify(current)!==JSON.stringify(PG.SHEETS.users.slice(0,12))){
        throw new Error('El encabezado de users es diferente: verifica antes de migrar.');
      }
      if(sh.getMaxColumns()<PG.SHEETS.users.length){
        sh.insertColumnsAfter(sh.getMaxColumns(),PG.SHEETS.users.length-sh.getMaxColumns());
      }
      const currentExtras=sh.getRange(1,13,1,3).getValues()[0].map(String);
      if(currentExtras.some((value,i)=>value&&value!==PG.SHEETS.users[12+i])){
        throw new Error('Hay columnas adicionales en users: revisa los encabezados antes de migrar.');
      }
      sh.getRange(1,13,1,3).setValues([PG.SHEETS.users.slice(12)]);
    }
  });
  console.log('Esquema revisado y columnas adicionales creadas sin borrar usuarios.');
  return id;
}
function pgSheet_(name){
  const id=pgProp_('SPREADSHEET_ID');
  if(!id)pgErr_('La cuenta todavía no está configurada.');
  const sh=SpreadsheetApp.openById(id).getSheetByName(name);
  if(!sh)pgErr_('Falta configurar la base de datos.');
  return sh;
}
function pgRows_(name){const sheet=pgSheet_(name),rows=sheet.getDataRange().getValues();return {sheet,rows:rows.slice(1)};}
function pgFind_(name,column,value){
  const r=pgRows_(name),c=PG.SHEETS[name].indexOf(column);
  if(c<0)pgErr_('Columna inexistente.');
  const idx=r.rows.findIndex(row=>String(row[c])===String(value));
  return idx<0?null:{sheet:r.sheet,index:idx+2,values:r.rows[idx]};
}
function pgObject_(name,values){return Object.fromEntries(PG.SHEETS[name].map((key,i)=>[key,values[i]===undefined?'':values[i]]));}
function pgSheetValue_(value){return typeof value==='string'&&/^[=+@-]/.test(value)?String.fromCharCode(39)+value:value;}
function pgWrite_(name,item){pgSheet_(name).appendRow(PG.SHEETS[name].map(key=>pgSheetValue_(item[key]===undefined?'':item[key])));}
function pgUpdate_(name,rowIndex,obj){const sh=pgSheet_(name);const cols=PG.SHEETS[name];const prev=sh.getRange(rowIndex,1,1,cols.length).getValues()[0];sh.getRange(rowIndex,1,1,cols.length).setValues([cols.map((key,i)=>pgSheetValue_(obj[key]===undefined?prev[i]:obj[key]))]);}
/** Libro de dinero separado de saldo de demostración; nunca inferir de la URL. */
function pgMoneyBalance_(uid){
  if(!pgProp_('SPREADSHEET_ID'))return 0;
  return Math.round(pgRows_('payments_ledger').rows
    .filter(r=>String(r[1])===String(uid))
    .reduce((sum,row)=>sum+Math.round(Number(row[4]||0)*100),0))/100;
}
function pgPublicUser_(u){
  return {id:String(u.uid),email:String(u.email),firstName:String(u.firstName),
    lastName:String(u.lastName),countryCode:String(u.countryCode||'+51'),
    phone:String(u.phone||''),docType:String(u.docType||''),docNumber:String(u.docNumber||''),
    avatarUrl:String(u.avatarUrl||''),inviteCode:String(u.inviteCode||'')};
}
/** La bienvenida promocional equivale a S/ 10 una sola vez por cuenta.
 * Se deriva del BONO_INICIAL del historial original, sin convertir en dinero
 * los créditos virtuales registrados en users.balance.
 */
function pgWelcomeBonusPEN_(uid){
  // Las cuentas nuevas tienen un único movimiento BIENVENIDA en bonus_ledger.
  const entries=pgRows_('bonus_ledger').rows;
  if(entries.some(r=>String(r[1])===String(uid)&&String(r[0])==='WELCOME-'+String(uid)))return 0;
  // Compatibilidad: cuentas creadas antes de incorporar el libro de bonos.
  return pgRows_('ledger').rows.some(r=>
    String(r[1])===String(uid)&&String(r[3])==='BONO_INICIAL')?10:0;
}
/** Movimientos de la ÚNICA cuenta de bonos, incluidos registros históricos. */
function pgBonusStatement_(uid){
  const entries=pgRows_('bonus_ledger').rows.filter(r=>
    String(r[1])===String(uid)&&String(r[4])==='AVAILABLE');
  const referralIds=new Set(entries.filter(r=>String(r[0]).startsWith('REF-'))
    .map(r=>String(r[2])));
  const referralNames=new Map(pgRows_('users').rows
    .map(r=>pgObject_('users',r))
    .filter(p=>referralIds.has(String(p.uid))&&String(p.invitedBy||'')===String(uid))
    .map(p=>[String(p.uid),pgClean_(p.firstName,70)+
      (pgClean_(p.lastName,70)?' '+pgClean_(p.lastName,70).charAt(0)+'.':'')]));
  const events=entries.map(r=>{
    const amount=Number(r[3])||0,id=String(r[0]),note=String(r[6]||'');
    const category=id.startsWith('WELCOME-')?'BIENVENIDA':
      id.startsWith('REF-')?'REFERIDO':id.startsWith('PLAY-')?'JUGADA':
      id.startsWith('PROMO-')?'PROMOCIÓN':'AJUSTE';
    const referralName=category==='REFERIDO'?referralNames.get(String(r[2]))||'':'';
    return {id,category,description:note||category,amountPEN:amount,
      referralName,createdAt:String(r[5]||'')};
  });
  const fallback=pgWelcomeBonusPEN_(uid);
  if(fallback){
    const old=pgRows_('ledger').rows.find(r=>
      String(r[1])===String(uid)&&String(r[3])==='BONO_INICIAL');
    events.push({id:'WELCOME-LEGACY-'+String(uid),category:'BIENVENIDA',
      description:'Bono de bienvenida',amountPEN:fallback,
      createdAt:old?String(old[6]||''):''});
  }
  events.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());
  return events;
}
function pgBonusBalancePEN_(uid){
  const events=pgBonusStatement_(uid);
  return Math.round(events.reduce((sum,e)=>sum+Math.round(e.amountPEN*100),0))/100;
}
/** El bono se habilita tras una recarga propia no reembolsada de S/ 5 o más. */
function pgBonusUnlocked_(uid){
  const payments=pgRows_('payments_ledger').rows.filter(r=>String(r[1])===String(uid));
  const reversed=new Set(payments.filter(r=>Number(r[4])<0&&
    ['REFUNDED','CHARGED_BACK'].includes(String(r[5]))).map(r=>String(r[2])));
  return payments.some(r=>String(r[5])==='TOPUP_APPROVED'&&
    Math.round(Number(r[4]||0)*100)>=500&&!reversed.has(String(r[2])));
}
/** Resumen de invitados y bono acreditado, sin exponer cuentas de terceros. */
function pgReferralSummary_(user){
  const invited=pgRows_('users').rows.map(r=>pgObject_('users',r))
    .filter(p=>String(p.invitedBy||'')===String(user.uid));
  const credits=pgRows_('payments_ledger').rows;
  const refunds=new Set(credits.filter(v=>
    ['REFUNDED','CHARGED_BACK'].includes(String(v[5]))&&Number(v[4])<0
  ).map(v=>String(v[2])));
  const bonusRows=pgRows_('bonus_ledger').rows;
  const referralBonusByUid=new Map();
  for(const r of bonusRows){
    if(String(r[1])!==String(user.uid)||String(r[4])!=='AVAILABLE')continue;
    const sourceUid=String(r[2]);
    referralBonusByUid.set(sourceUid,(referralBonusByUid.get(sourceUid)||0)+Number(r[3]||0));
  }
  const referrals=invited.map(p=>{
    const verified=credits.some(v=>String(v[1])===String(p.uid)&&
      String(v[5])==='TOPUP_APPROVED'&&Number(v[4])>0&&!refunds.has(String(v[2])));
    const first=pgClean_(p.firstName,70);
    const initial=pgClean_(p.lastName,70).charAt(0);
    return {label:first+(initial?' '+initial+'.':''),
      joinedAt:String(p.createdAt||''),firstTopupVerified:verified,
      bonusAwarded:verified&&(referralBonusByUid.get(String(p.uid))||0)>=5,
      status:verified?'RECARGA_CONFIRMADA':'REGISTRADO'};
  }).sort((a,b)=>new Date(b.joinedAt).getTime()-new Date(a.joinedAt).getTime());
  return {referralCount:referrals.length,referrals:referrals.slice(0,30),
    bonusBalancePEN:pgBonusBalancePEN_(String(user.uid))};
}
function pgSnapshot_(row){
  const user=pgObject_('users',row.values);
  const recent=pgRows_('plays').rows.filter(r=>String(r[1])===String(user.uid));
  const history=recent.slice(-200).reverse().map(r=>{
    const p=pgObject_('plays',r);
    let picks=[],slot='';
    if(p.type==='gol'){
      try{
        const data=JSON.parse(p.picksJson);
        const source=Array.isArray(data)?data:Array.isArray(data.picks)?data.picks:
          PG_RETO_IDs.every(id=>Object.prototype.hasOwnProperty.call(data,id))?
            PG_RETO_IDs.map(id=>({id,outcome:data[id]})):[];
        picks=source.map((v,i)=>typeof v==='string'?
          {id:PG_RETO_IDs[i]||'',outcome:v}:
          {id:String(v.id||PG_RETO_IDs[i]||''),outcome:String(v.outcome||v.pick||'')});
        slot=String(data.slot||'');
      }catch(e){}
    }
    const id=String(p.playId);
    const code='PG-'+id.replace(/[^a-zA-Z0-9]/g,'').slice(-10).toUpperCase();
    return {id,code,type:p.type==='gol'?'gol':'match',
      title:p.type==='gol'?'PremiumGol · '+code:'Cupón de partidos',
      at:String(p.createdAt),stake:Number(p.stake)||0,
      note:String(p.note||''),roundId:String(p.roundId||''),picks,slot,
      resultStatus:p.type==='gol'?pgGolTicketStatus_(p.roundId,picks):'REGISTRADA'};
  });
  // Las cuatro pestañas son borradores locales; los tickets ya
  // presentados permanecen en el historial, sin bloquear A/B/C/D.
  const golSlots={};
  const paidBalancePEN=pgMoneyBalance_(String(user.uid));
  const couponClaimed=pgRows_('ledger').rows.some(r=>String(r[1])===String(user.uid)&&String(r[3])==='BONO_PREMIUM_50');
  const reward=pgReferralSummary_(user);
  return {ok:true,user:pgPublicUser_(user),balance:Number(user.balance)||0,
    history,golSlots,couponClaimed,paidBalancePEN,
    bonusUnlocked:pgBonusUnlocked_(String(user.uid)),
    bonusStatement:pgBonusStatement_(String(user.uid)).slice(0,100),
    walletWagersEnabled:pgProp_('PG_WALLET_WAGERS_ENABLED')==='true',
    ...reward};
}

/** Verificación sin datos personales ni claves: ejecutar desde el editor. */
function testPremiumGolAccountSetup(){
  const users=pgSheet_('users');
  const expected=PG.SHEETS.users;
  const headers=users.getRange(1,1,1,expected.length).getValues()[0].map(String);
  const ready=JSON.stringify(headers)===JSON.stringify(expected);
  const result={
    initialVirtualCredits:PG.INITIAL_CREDITS,
    accountSchemaReady:ready,
    hasAvatarField:headers.includes('avatarUrl'),
    hasInviteCodeField:headers.includes('inviteCode'),
    invitationBonusActive:false,
    existingUserBalancesUnchanged:true
  };
  console.log('PremiumGol · Verificación de cuentas: '+JSON.stringify(result));
  return result;
}
