/**
 * PremiumGol — circuito privado de demostración de apuestas con billetera monetaria.
 * Solo cuentas explícitamente autorizadas por PG_SPORTS_PRIVATE_EMAILS.
 *
 * Activación: PG_SPORTS_PRIVATE_MONEY_ENABLED = true
 *             PG_SPORTS_PRIVATE_EMAILS = correo@dominio.com,otro@dominio.com
 *             THE_ODDS_API_KEY ya configurada
 * El frontend público nunca activa apuestas para usuarios fuera de la lista.
 * Se comprueban cuotas VIGENTES en The Odds API antes de cargar dinero.
 *
 * A diferencia del sandbox virtual: el débito usa payments_ledger / bonus_ledger.
 * No hay liquidación de premios en esta primera etapa.
 */
function pgSportsPrivateUser_(row){
  const u=pgObject_('users',row.values);
  const emails=pgProp_('PG_SPORTS_PRIVATE_EMAILS').split(',')
    .map(v=>v.trim().toLowerCase()).filter(Boolean);
  return pgProp_('PG_SPORTS_PRIVATE_MONEY_ENABLED')==='true'&&
    emails.length>0&&emails.includes(String(u.email||'').trim().toLowerCase());
}
function pgSportsPrivatePolicy_(x){
  let authorized=false;
  if(x&&x.sessionToken){
    try{
      const player=pgRequireSession_(x.sessionToken);
      authorized=pgSportsPrivateUser_(player);
    }catch(e){authorized=false;}
  }
  return {ok:true,privateEnabled:authorized,availableWallets:authorized?
    ['principal','bonos']:[],currency:'PEN'};
}
function pgSportsPrivateMarketKey_(leg){
  const sid=pgClean_(leg.selectionId,210);
  const group=pgClean_(leg.group,25);
  if(/^h2h-[1X2]$/.test(sid))return {key:'h2h',sid};
  const match=/^([a-z_]+)\|(.+)$/.exec(sid);
  if(!match)return null;
  const allowed=PG_ODDS_MARKET_GROUPS[group];
  if(!allowed||!Array.isArray(allowed.keys)||!allowed.keys.includes(match[1]))
    return null;
  return {key:match[1],sid};
}
function pgSportsPrivateQuote_(leg,cfg){
  const gameId=pgClean_(leg.gameId,90),sport=pgClean_(leg.sportKey,65);
  const requested=pgSportsPrivateMarketKey_(leg);
  if(!requested||!cfg.leagues.includes(sport)||!/^[A-Za-z0-9_-]{8,90}$/.test(gameId))
    pgErr_('La selección ya no está disponible.');
  const props=PropertiesService.getScriptProperties();
  const fixture=pgOddsSnapshot_(props,sport).games.find(g=>g.id===gameId);
  if(!fixture||Date.parse(fixture.kickoff)<=Date.now()+60000)
    pgErr_('El partido ya no está disponible para nuevas apuestas.');
  // La recepción privada exige una cuota actual, no una instantánea de 12 horas.
  if(!pgOddsDailyCredit_(props,1))
    pgErr_('No se pudo verificar la cuota actual. Inténtalo más tarde.');
  const url='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(sport)+
    '/events/'+encodeURIComponent(gameId)+'/odds?regions='+encodeURIComponent(cfg.region)+
    '&markets='+encodeURIComponent(requested.key)+'&oddsFormat=decimal&dateFormat=iso';
  let data=null;
  try{
    const response=UrlFetchApp.fetch(url,{method:'get',muteHttpExceptions:true,
      followRedirects:false,headers:{'x-api-key':cfg.key,Accept:'application/json'}});
    if(response.getResponseCode()===200)data=JSON.parse(response.getContentText());
  }catch(e){ /* Nunca registrar claves o URLs autenticadas. */ }
  if(!data||String(data.id)!==gameId||
     String(data.home_team||'').trim()!==String(fixture.home||'').trim()||
     String(data.away_team||'').trim()!==String(fixture.away||'').trim()||
     Date.parse(data.commence_time)<=Date.now()+60000)
    pgErr_('No se pudo verificar la cuota actual. Inténtalo más tarde.');
  const available=pgOddsNormalizeEventMarkets_(data,[requested.key]);
  const market=available[0];
  if(!market||!market.outcomes.length)
    pgErr_('La selección ya no está disponible.');
  const marketAge=Date.now()-Date.parse(market.updatedAt);
  if(!Number.isFinite(marketAge)||marketAge< -60000||marketAge>15*60000)
    pgErr_('La cuota está desactualizada.');
  let target=null,description='';
  if(requested.key==='h2h'){
    const outcome=requested.sid.slice(4);
    const name=outcome==='1'?fixture.home:outcome==='2'?fixture.away:'Draw';
    target=market.outcomes.find(o=>outcome==='X'?
      /^(draw|tie|empate)$/i.test(o.name):
      String(o.name||'').toLowerCase()===String(name||'').toLowerCase());
    description=outcome;
  }else{
    target=market.outcomes.find(o=>{
      const text=String(o.name||'')+
        (o.point!==null&&o.point!==undefined?' '+o.point:'')+
        (o.description?' · '+o.description:'');
      return requested.sid===requested.key+'|'+text;
    });
    description=target?(String(target.name)+
      (target.point!==null?' '+target.point:'')+
      (target.description?' · '+target.description:'')):'';
  }
  if(!target)pgErr_('La selección ya no está disponible.');
  const price=Number(target.price),requestedPrice=Number(leg.expectedOdd);
  if(!Number.isFinite(price)||price<=1||price>5000||
     !Number.isFinite(requestedPrice)||Math.abs(price-requestedPrice)>0.015)
    pgErr_('La cuota cambió. Actualiza el cupón.');
  return {gameId,sportKey:sport,market:requested.key,
    selection:requested.sid,outcome:description.slice(0,150),
    odd:price,home:String(fixture.home),away:String(fixture.away),
    bookmaker:market.bookmaker,marketUpdatedAt:market.updatedAt,
    kickoff:String(fixture.kickoff)};
}
function pgSportsPrivateDebit_(uid,requestId,wallet,stake,when){
  const cents=Math.round(stake*100),entryId='SBET-'+requestId;
  if(!Number.isSafeInteger(cents)||cents<100)
    pgErr_('Ingresa un importe válido.');
  if(wallet==='principal'){
    if(pgFind_('payments_ledger','entryId',entryId)||pgFind_('bonus_ledger','entryId',entryId))
      pgErr_('La operación ya fue registrada.');
    if(Math.round(pgMoneyBalance_(uid)*100)<cents)pgErr_('Saldo principal insuficiente.');
    pgWrite_('payments_ledger',{entryId,uid,orderId:requestId,paymentId:'',
      deltaPEN:-cents/100,type:'SPORTS_PRIVATE_STAKE',createdAt:when});
  }else if(wallet==='bonos'){
    if(pgFind_('payments_ledger','entryId',entryId)||pgFind_('bonus_ledger','entryId',entryId))
      pgErr_('La operación ya fue registrada.');
    if(!pgBonusUnlocked_(uid))
      pgErr_('Primero realiza una recarga propia de al menos S/ 5 para usar tus bonos.');
    if(Math.round(pgBonusBalancePEN_(uid)*100)<cents)pgErr_('Saldo de bonos insuficiente.');
    pgWrite_('bonus_ledger',{entryId,uid,sourceUid:requestId,amountPEN:-cents/100,
      status:'AVAILABLE',createdAt:when,note:'Apuesta deportiva privada: '+requestId});
  }else pgErr_('Selecciona saldo principal o saldo de bonos.');
}
/** Escribe el ticket como PENDIENTE antes de realizar el cargo.
 * Si una escritura falla, NO se acepta un segundo cargo con ese mismo ID.
 * La operación pendiente debe reconciliarse manualmente antes de reintentar.
 */
function pgSportsPrivatePlace_(x){
  return pgLock_(()=>{
    const player=pgRequireSession_(x.sessionToken);
    if(!pgSportsPrivateUser_(player))
      pgErr_('Esta modalidad no está habilitada para tu cuenta.');
    const u=pgObject_('users',player.values),uid=String(u.uid);
    const requestId=pgClean_(x.clientRequestId,90);
    if(!/^[a-zA-Z0-9-]{15,90}$/.test(requestId))
      pgErr_('Solicitud inválida.');
    const existing=pgFind_('plays','playId',requestId);
    if(existing){
      const play=pgObject_('plays',existing.values);
      if(String(play.uid)!==uid||String(play.type)!=='sports_private')
        pgErr_('Solicitud inválida.');
      const charge=pgFind_('payments_ledger','entryId','SBET-'+requestId)||
        pgFind_('bonus_ledger','entryId','SBET-'+requestId);
      if(!charge)pgErr_('La operación quedó pendiente de conciliación.');
      if(!String(play.note||'').startsWith('ACEPTADA')){
        pgUpdate_('plays',existing.index,{note:'ACEPTADA · '+String(play.note||'').replace(/^PENDIENTE · /,'')});
      }
      return Object.assign({},pgSnapshot_(pgFind_('users','uid',uid)),{
        privateTicketId:requestId,privateAccepted:true,duplicate:true});
    }
    const wallet=pgClean_(x.walletSource,12);
    if(!['principal','bonos'].includes(wallet))
      pgErr_('Selecciona saldo principal o saldo de bonos.');
    const stake=Number(x.stake),cents=Math.round(stake*100);
    if(!Number.isFinite(stake)||!Number.isSafeInteger(cents)||
       Math.abs(stake-cents/100)>0.0000001||cents<100||cents>50000)
      pgErr_('Ingresa un importe válido.');
    if(!Array.isArray(x.selections)||x.selections.length<1||x.selections.length>4)
      pgErr_('Selecciona entre uno y cuatro partidos.');
    // Comprobar saldo ANTES de consumir consultas externas.
    if(wallet==='principal'&&Math.round(pgMoneyBalance_(uid)*100)<cents)
      pgErr_('Saldo principal insuficiente.');
    if(wallet==='bonos'&&(!pgBonusUnlocked_(uid)||
        Math.round(pgBonusBalancePEN_(uid)*100)<cents))
      pgErr_('Saldo de bonos insuficiente.');
    const cfg=pgOddsConfig_();
    if(!cfg.key)pgErr_('Las cuotas no están disponibles.');
    const picks=[],used=new Set();let combined=1;
    for(const selection of x.selections){
      if(!selection||typeof selection!=='object')
        pgErr_('La selección ya no está disponible.');
      const id=pgClean_(selection.gameId,90);
      if(used.has(id))pgErr_('Una sola selección por partido.');
      used.add(id);
      const quote=pgSportsPrivateQuote_(selection,cfg);
      combined*=quote.odd;
      if(!Number.isFinite(combined)||combined>1000000)
        pgErr_('La cuota combinada excede el límite permitido.');
      picks.push(quote);
    }
    const date=pgNow_(),note='PENDIENTE · '+wallet;
    pgWrite_('plays',{playId:requestId,uid,type:'sports_private',
      roundId:'PRIVATE-PEN',picksJson:JSON.stringify(picks),
      stake:cents/100,combinedOdds:Math.round(combined*10000)/10000,
      potentialReturn:Math.round(cents*combined)/100,
      createdAt:date,note});
    pgSportsPrivateDebit_(uid,requestId,wallet,cents/100,date);
    const fresh=pgFind_('plays','playId',requestId);
    if(fresh)pgUpdate_('plays',fresh.index,{note:'ACEPTADA · '+wallet});
    return Object.assign({},pgSnapshot_(pgFind_('users','uid',uid)),{
      privateTicketId:requestId,privateAccepted:true,duplicate:false,
      privateStakePEN:cents/100,privateWallet:wallet,
      privatePotentialReturnPEN:Math.round(cents*combined)/100
    });
  });
}
