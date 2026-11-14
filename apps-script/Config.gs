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
    users:['uid','email','firstName','lastName','countryCode','phone','docType','docNumber','provider','balance','createdAt','updatedAt'],
    sessions:['tokenHash','uid','createdAt','expiresAt','revokedAt'],
    plays:['playId','uid','type','roundId','picksJson','stake','combinedOdds','potentialReturn','createdAt','note'],
    ledger:['txId','uid','playId','action','delta','balanceAfter','createdAt']
  },
  INITIAL_CREDITS:1000,
  MAX_STAKE:1000,
  SESSION_DAYS:7,
  ROUND_ID:'reto14-demo-01',
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
    if(sh.getLastRow()===0){sh.getRange(1,1,1,PG.SHEETS[name].length).setValues([PG.SHEETS[name]]);sh.setFrozenRows(1);}
  });
  console.log('Base creada correctamente. ID:',id);
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
function pgPublicUser_(u){return {id:String(u.uid),email:String(u.email),firstName:String(u.firstName),lastName:String(u.lastName),countryCode:String(u.countryCode||'+51'),phone:String(u.phone||''),docType:String(u.docType||''),docNumber:String(u.docNumber||'')};}
function pgSnapshot_(row){
  const user=pgObject_('users',row.values);
  const history=pgRows_('plays').rows.filter(r=>String(r[1])===String(user.uid)).slice(-200).reverse().map(r=>{
    const p=pgObject_('plays',r);
    return {id:String(p.playId),type:p.type==='gol'?'gol':'match',title:p.type==='gol'?'PremiumGol · 14 pronósticos':'Cupón de partidos',at:String(p.createdAt),note:String(p.note)};
  });
  return {ok:true,user:pgPublicUser_(user),balance:Number(user.balance)||0,history};
}
