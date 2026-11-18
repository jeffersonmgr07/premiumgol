/**
 * PremiumGol — control de apuestas deportivas y sandbox.
 *
 * Propiedades privadas en Apps Script (NO en GitHub):
 *  PG_SPORTS_SANDBOX_ENABLED=true  -> acepta tickets de prueba solo con users.balance
 *  PG_SPORTS_PRIVATE_MONEY_ENABLED=true + PG_SPORTS_PRIVATE_EMAILS=
 *    habilita demostraciones monetarias solo a cuentas explícitamente autorizadas
 *    según SportsPrivate.gs. No equivale a publicar una plataforma abierta.
 */
function pgSportsWagerPolicy_(x){
  const privatePolicy=pgSportsPrivatePolicy_(x);
  return {
    ok:true,
    sandboxEnabled:pgProp_('PG_SPORTS_SANDBOX_ENABLED')==='true',
    privateEnabled:Boolean(privatePolicy.privateEnabled),
    currency:'PEN',
    availableWallets:privatePolicy.availableWallets,
    mode:privatePolicy.privateEnabled?'PRIVATE_ACCOUNT':'SANDBOX_ONLY'
  };
}
function pgRequireSportsRealWagers_(){
  // Kill-switch técnico: sin integración homologada no existen apuestas monetarias.
  pgErr_('Las apuestas deportivas con dinero real no están habilitadas.');
}
/** Identifica la cuota contra una copia SERVIDOR del mercado, nunca contra el precio cliente. */
function pgSportsDemoQuote_(selection,props,cfg){
  const gameId=pgClean_(selection.gameId,90);
  const sport=pgClean_(selection.sportKey,65);
  const selectionId=pgClean_(selection.selectionId,210);
  const group=pgClean_(selection.group,24);
  if(!cfg.leagues.includes(sport)||!/^[a-zA-Z0-9_-]{8,90}$/.test(gameId))
    pgErr_('El partido ya no está disponible.');
  let fixture=pgOddsSnapshot_(props,sport).games.find(g=>g.id===gameId);
  if(!fixture){
    // Live independiente: únicamente se permiten citas deportivas existentes.
    try{
      const live=JSON.parse(String(props.getProperty('THE_ODDS_LIVE_SNAPSHOT')||'null'));
      fixture=Array.isArray(live.games)?live.games.find(g=>g.id===gameId&&g.sportKey===sport):null;
    }catch(e){}
  }
  if(!fixture)pgErr_('El partido ya no está disponible.');
  const kickoff=Date.parse(fixture.kickoff);
  if(!Number.isFinite(kickoff)||kickoff<Date.now()-3*3600000)
    pgErr_('El partido ya no está disponible.');
  let odd=null,market='',outcome='';
  if(/^h2h-[1X2]$/.test(selectionId)){
    const pick=selectionId.slice(4),index=['1','X','2'].indexOf(pick);
    odd=Number(fixture.odds?.[index]);market='Resultado final';outcome=pick;
  }else{
    const map={
      goles:['totals','alternate_totals'],
      ambos:['btts','team_totals'],
      oportunidades:['double_chance','draw_no_bet'],
      handicap:['spreads'],
      resultados:['correct_score','halftime_fulltime'],
      corners:['alternate_totals_corners'],
      goleadores:['player_goal_scorer_anytime']
    };
    if(!Object.prototype.hasOwnProperty.call(map,group)||!map[group].length||
       !selectionId.includes('|'))pgErr_('La selección ya no está disponible.');
    const cacheKey='PG_ODDS_EV_'+sport+'_'+gameId+'_'+group+'_'+cfg.region;
    const raw=CacheService.getScriptCache().get(cacheKey);
    let cache=null;
    try{cache=JSON.parse(raw||'null');}catch(e){}
    if(!cache||!Array.isArray(cache.markets))
      pgErr_('La selección ya no está disponible.');
    for(const m of cache.markets){
      if(!map[group].includes(String(m.key)))continue;
      for(const o of m.outcomes||[]){
        const label=String(o.name||'')+
          (o.point!==null&&o.point!==undefined?' '+o.point:'')+
          (o.description?' · '+o.description:'');
        if(selectionId===String(m.key)+'|'+label){
          odd=Number(o.price);market=String(m.label||m.key);
          outcome=label;break;
        }
      }
      if(odd!==null)break;
    }
  }
  if(!Number.isFinite(odd)||odd<=1||odd>=10000)
    pgErr_('La selección ya no está disponible.');
  return {
    gameId,sportKey:sport,market:market.slice(0,80),
    outcome:outcome.slice(0,140),odd:Math.round(odd*100)/100,
    home:String(fixture.home||'').slice(0,100),
    away:String(fixture.away||'').slice(0,100)
  };
}
/** Prueba integral en Sheets, separada de pagos y bonos.
 * Se descuenta SOLO users.balance (créditos virtuales) y queda historial.
 * No hay abonos, premios, liquidación ni retiros monetarios.
 */
function pgSportsDemoSubmit_(x){
  if(pgProp_('PG_SPORTS_SANDBOX_ENABLED')!=='true')
    pgErr_('Las pruebas deportivas todavía no están habilitadas.');
  return pgLock_(()=>{
    const player=pgRequireSession_(x.sessionToken);
    const u=pgObject_('users',player.values);
    const requestId=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(requestId))pgErr_('Solicitud inválida.');
    if(pgIdempotent_(u.uid,requestId))return pgSnapshot_(player);
    const stake=Number(x.stake);
    if(!Number.isSafeInteger(stake)||stake<1||stake>1000)
      pgErr_('Ingresa entre 1 y 1,000 créditos virtuales.');
    if(!Array.isArray(x.selections)||x.selections.length<1||x.selections.length>10)
      pgErr_('No hay partidos seleccionados.');
    if(Number(u.balance)<stake)pgErr_('Créditos virtuales insuficientes.');
    const cfg=pgOddsConfig_();
    if(!cfg.key)pgErr_('La consulta de cuotas no está disponible.');
    const used=new Set();
    let combined=1;
    const picks=x.selections.map(sel=>{
      if(!sel||typeof sel!=='object')pgErr_('La selección ya no está disponible.');
      const quote=pgSportsDemoQuote_(sel,PropertiesService.getScriptProperties(),cfg);
      if(used.has(quote.gameId))pgErr_('Una sola selección por partido.');
      used.add(quote.gameId);
      combined*=quote.odd;
      if(!Number.isFinite(combined)||combined>1000000)
        pgErr_('La cuota combinada excede el límite de prueba.');
      return quote;
    });
    const now=pgNow_(),balanceAfter=Number(u.balance)-stake;
    pgWrite_('plays',{
      playId:requestId,uid:u.uid,type:'sports_demo',roundId:'SPORTS-SANDBOX',
      picksJson:JSON.stringify(picks),stake,
      combinedOdds:Math.round(combined*10000)/10000,
      potentialReturn:Math.round(stake*combined*100)/100,
      createdAt:now,note:'SIMULACIÓN · '+stake+' créditos virtuales, sin dinero real'
    });
    pgUpdate_('users',player.index,{balance:balanceAfter,updatedAt:now});
    pgWrite_('ledger',{
      txId:pgUuid_(),uid:u.uid,playId:requestId,action:'SPORTS_DEMO',
      delta:-stake,balanceAfter,createdAt:now
    });
    const snapshot=pgSnapshot_(pgFind_('users','uid',u.uid));
    return Object.assign({},snapshot,{
      simulationId:requestId,simulatedCreditsUsed:stake,
      simulatedReturn:Math.round(stake*combined*100)/100
    });
  });
}
