/** Catálogo informativo de API-FOOTBALL; no habilita la colocación de apuestas reales.
 * Activación opt-in: API_SPORTS_CATALOG_MODE = preview (Propiedades del script)
 * Presupuesto aproximado: 3 llamadas cada 3h + 2 llamadas/h para la vista Live,
 * ~72 llamadas/día si recibe visitas constantes. La caché puede expirar anticipadamente.
 */
function pgSportsDate_(offset){
  const date=new Date(Date.now()+offset*86400000);
  return Utilities.formatDate(date,'America/Lima','yyyy-MM-dd');
}
function pgSportsCached_(key,seconds,load){
  const cache=CacheService.getScriptCache();
  const pre=cache.get(key);
  if(pre){try{return JSON.parse(pre);}catch(e){}}
  return pgLock_(()=>{
    const again=cache.get(key);
    if(again){try{return JSON.parse(again);}catch(e){}}
    const list=load();
    cache.put(key,JSON.stringify(list),Math.min(seconds,21600));
    return list;
  });
}
function pgSportsValueOdds_(markets){
  for(const bet of markets||[]){
    if(!bet||!Array.isArray(bet.values))continue;
    if(!(/match winner|1x2|full.?time result|resultado final/i.test(String(bet.name||''))||Number(bet.id)===1))continue;
    const out=[null,null,null];
    for(const v of bet.values){
      const label=String(v.value||v.name||'').trim().toLowerCase();
      const n=Number(v.odd);
      if(!Number.isFinite(n)||n<=1||v.suspended===true)continue;
      if(['home','1','local'].includes(label))out[0]=n;
      else if(['draw','x','empate'].includes(label))out[1]=n;
      else if(['away','2','visita'].includes(label))out[2]=n;
    }
    if(out.every(v=>v!==null))return out;
  }
  return [null,null,null];
}
function pgSportsGetOdds_(data){
  const byId={};
  for(const row of data||[]){
    const id=String(row.fixture?.id||row.fixture_id||'');
    if(!/^\d+$/.test(id))continue;
    const sets=[];
    if(row.status?.blocked||row.status?.stopped||row.status?.finished)continue;
    if(Array.isArray(row.bets))sets.push(...row.bets); // odds/live
    if(Array.isArray(row.odds))sets.push(...row.odds);
    for(const bookmaker of row.bookmakers||[]){
      if(Array.isArray(bookmaker.bets))sets.push(...bookmaker.bets);
    }
    const values=pgSportsValueOdds_(sets);
    if(!byId[id]||(!byId[id].some(v=>v!==null)&&values.some(v=>v!==null)))byId[id]=values;
  }
  return byId;
}
function pgSportsUpcoming_(){
  return pgSportsCached_('premiumgol:api-upcoming-v1',10800,()=>{
    const list=pgSportsRequest_('fixtures',{next:30,timezone:'America/Lima'});
    // API-FOOTBALL devuelve hasta diez eventos por página; las cuotas no siempre están disponibles.
    const oddsRows=[];
    for(const offset of [0,1]){
      for(const page of [1,2]){
        try{
          const pageRows=pgSportsRequest_('odds',{date:pgSportsDate_(offset),bet:1,page,timezone:'America/Lima'});
          oddsRows.push(...pageRows);
          if(pageRows.length<10)break;
        }catch(err){console.warn('No se pudo consultar una página de cuotas.');break;}
      }
    }
    const odds=pgSportsGetOdds_(oddsRows);
    const now=new Date();
    const localToday=pgSportsDate_(0),localTomorrow=pgSportsDate_(1);
    return (list||[]).filter(f=>f.fixture?.id && f.fixture?.date && new Date(f.fixture.date)>now &&
      ['NS','TBD'].includes(String(f.fixture.status?.short||'NS'))).slice(0,30).map(f=>{
      const id=String(f.fixture.id),date=new Date(f.fixture.date);
      const localDate=Utilities.formatDate(date,'America/Lima','yyyy-MM-dd');
      const day=localDate===localToday?0:localDate===localTomorrow?1:2;
      return {id:'api-'+id,home:String(f.teams?.home?.name||''),away:String(f.teams?.away?.name||''),
        league:String(f.league?.name||'Fútbol'),day,
        time:Utilities.formatDate(date,'America/Lima','HH:mm'),
        dateLabel:Utilities.formatDate(date,'America/Lima','dd MMM · HH:mm'),
        odds:odds[id]||[null,null,null],colors:['#7d8da7','#607b96']};
    });
  });
}
function pgSportsLive_(){
  return pgSportsCached_('premiumgol:api-live-v1',3600,()=>{
    const list=pgSportsRequest_('fixtures',{live:'all'});
    const odds=pgSportsGetOdds_(pgSportsRequest_('odds/live',{}));
    return (list||[]).filter(f=>f.fixture?.id && !['FT','AET','PEN','CANC','PST'].includes(String(f.fixture.status?.short||''))).slice(0,40).map(f=>{
      const id=String(f.fixture.id);
      return {id:'api-live-'+id,home:String(f.teams?.home?.name||''),away:String(f.teams?.away?.name||''),
        league:String(f.league?.name||'Fútbol'),minute:Number(f.fixture.status?.elapsed)||0,
        score:[Number(f.goals?.home)||0,Number(f.goals?.away)||0],
        odds:odds[id]||[null,null,null],colors:['#7d8da7','#607b96']};
    });
  });
}
/** Esta vista sólo sirve para probar listados y filtros, no para confirmar jugadas. */
function pgPublicSportsCatalog_(){
  if(pgProp_('API_SPORTS_CATALOG_MODE')!=='preview'||!pgProp_('API_SPORTS_KEY')){
    return pgDemoCatalog_();
  }
  let matches=[],live=[],warning='';
  try{matches=pgSportsUpcoming_();}catch(err){console.warn('API fixtures: '+err.message);warning='No fue posible actualizar los próximos encuentros.';}
  try{live=pgSportsLive_();}catch(err){console.warn('API live: '+err.message);warning='Algunos partidos no están disponibles por ahora.';}
  return {ok:true,mode:'API_PREVIEW',warning,
    games:{gol:PG_GOL_FIXTURES,match:matches,live}};
}
function testPremiumGolSportsCatalog(){
  const data=pgPublicSportsCatalog_();
  console.log(JSON.stringify({mode:data.mode,upcoming:data.games.match.length,live:data.games.live.length,warning:data.warning||''}));
  return {mode:data.mode,upcoming:data.games.match.slice(0,3),live:data.games.live.slice(0,3),warning:data.warning||''};
}
