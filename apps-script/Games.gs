/** Los valores de esta primera versión son de pruebas. Fuente autorizada del catálogo: servidor. */
const PG_MATCHES=[
  ['m1','Astros FC','Metro United','Liga Continental',0,'20:00',1.85,3.40,4.20],
  ['m2','Atlético Sur','Leones del Norte','Liga Continental',0,'21:30',2.12,3.15,3.05],
  ['m3','Real Aurora','Costa Azul','Copa Estelar',1,'18:00',1.62,3.75,5.10],
  ['m4','Montaña FC','Náuticos','Copa Estelar',1,'19:45',2.90,3.20,2.30],
  ['m5','Estrella Roja','Olimpo FC','Liga Continental',2,'17:30',2.05,3.25,3.70],
  ['m6','Racing Andino','Imperial FC','Copa Estelar',2,'21:00',1.95,3.50,3.85]
];
const PG_LIVE=[
  ['l1','Fénix Club','Trueno FC','Liga Continental',67,2,1,1.38,4.55,8.20],
  ['l2','Academia Azul','Valle Verde','Copa Estelar',31,0,0,2.42,2.98,3.11],
  ['l3','Cóndor Club','Marineros','Liga Continental',82,1,2,7.40,4.80,1.31]
];
const PG_RETO_IDs=Array.from({length:14},(_,i)=>'gol'+(i+1));
function pgDemoCatalog_(){
  return {ok:true,mode:'DEMO',games:{
    match:PG_MATCHES.map(r=>({id:r[0],home:r[1],away:r[2],league:r[3],day:r[4],time:r[5],odds:r.slice(6),colors:['#c6a450','#417aa7']})),
    live:PG_LIVE.map(r=>({id:r[0],home:r[1],away:r[2],league:r[3],minute:r[4],score:[r[5],r[6]],odds:r.slice(7),colors:['#c6a450','#417aa7']}))
  }};
}
function pgKnownGame_(id){
  const match=PG_MATCHES.find(r=>r[0]===id);
  if(match)return {id,type:'match',odds:match.slice(6)};
  const live=PG_LIVE.find(r=>r[0]===id);
  return live?{id,type:'live',odds:live.slice(7)}:null;
}
function pgIdempotent_(uid,playId){
  const row=pgFind_('plays','playId',playId);
  if(!row)return false;
  if(String(row.values[1])!==String(uid))pgErr_('Solicitud inválida.');
  return true; // el mismo usuario puede reintentar la operación sin repetirla
}
function pgSaveReto14_(x){
  return pgLock_(()=>{
    const user=pgRequireSession_(x.sessionToken),u=pgObject_('users',user.values);
    if(!Array.isArray(x.picks)||x.picks.length!==14)pgErr_('Elige las 14 opciones antes de continuar.');
    const picks=x.picks.map(p=>({id:String(p.id),outcome:String(p.outcome)}));
    if(picks.some((p,i)=>p.id!==PG_RETO_IDs[i]||!['1','X','2'].includes(p.outcome)))pgErr_('La cartilla contiene selecciones no válidas.');
    const requestId=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(requestId))pgErr_('Solicitud inválida.');
    if(pgIdempotent_(u.uid,requestId))return pgSnapshot_(user);
    pgWrite_('plays',{playId:requestId,uid:u.uid,type:'gol',roundId:PG.ROUND_ID,picksJson:JSON.stringify(picks),stake:0,combinedOdds:0,potentialReturn:0,createdAt:pgNow_(),note:'14 elecciones registradas · créditos virtuales'});
    return pgSnapshot_(pgFind_('users','uid',u.uid));
  });
}
function pgSaveBet_(x){
  return pgLock_(()=>{
    const player=pgRequireSession_(x.sessionToken),u=pgObject_('users',player.values);
    const stake=Number(x.stake);
    if(!Number.isInteger(stake)||stake<1||stake>PG.MAX_STAKE)pgErr_('Solo puedes usar de 1 a 1,000 créditos.');
    if(!Array.isArray(x.selections)||!x.selections.length||x.selections.length>15)pgErr_('No hay partidos seleccionados.');
    const requestId=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(requestId))pgErr_('Solicitud inválida.');
    if(pgIdempotent_(u.uid,requestId))return pgSnapshot_(player);
    if(Number(u.balance)<stake)pgErr_('Créditos insuficientes.');
    const seen={};let combinedOdds=1;
    const selected=x.selections.map(s=>{
      const id=pgClean_(s.id,40),outcome=pgClean_(s.outcome,1),game=pgKnownGame_(id);
      if(!game||seen[id]||!['1','X','2'].includes(outcome))pgErr_('La selección de un partido ya no está disponible.');
      seen[id]=true;
      const odd=Number(game.odds[['1','X','2'].indexOf(outcome)]);
      if(!Number.isFinite(odd)||odd<=1)pgErr_('La selección de un partido ya no está disponible.');
      combinedOdds*=odd;
      return {id,outcome,odd};
    });
    if(!Number.isFinite(combinedOdds)||combinedOdds>1000000)pgErr_('La selección de un partido ya no está disponible.');
    const balanceAfter=Number(u.balance)-stake,when=pgNow_();
    // No hay premios ni liquidaciones automáticas en esta etapa.
    pgWrite_('plays',{playId:requestId,uid:u.uid,type:'match',roundId:'DEMO',picksJson:JSON.stringify(selected),stake,combinedOdds:Math.round(combinedOdds*10000)/10000,potentialReturn:Math.round(stake*combinedOdds*100)/100,createdAt:when,note:stake+' créditos · Cuota '+combinedOdds.toFixed(2)+' · Retorno potencial '+(stake*combinedOdds).toFixed(2)});
    pgUpdate_('users',player.index,{balance:balanceAfter,updatedAt:when});
    pgWrite_('ledger',{txId:pgUuid_(),uid:u.uid,playId:requestId,action:'JUGADA_VIRTUAL',delta:-stake,balanceAfter,createdAt:when});
    return pgSnapshot_(pgFind_('users','uid',u.uid));
  });
}
