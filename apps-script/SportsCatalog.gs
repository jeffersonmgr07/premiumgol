/** PremiumGol · catálogo INFORMATIVO con partidos y cuotas reales de API-FOOTBALL.
 * Cero cuotas inventadas; las selecciones de la API son de solo lectura.
 * API_SPORTS_CATALOG_MODE=preview y API_SPORTS_KEY (propiedades privadas).
 * Plan gratis: caché próximos 3h, Live 60min. No apto para aceptar apuestas live.
 * Plan de pago: API_SPORTS_LIVE_CACHE_SECONDS=300 permite refresco de caché cada 5min,
 * sujeto al consumo total; no significa feed transaccional en tiempo real.
 */
function pgSportsDate_(offset){
  const date=new Date(Date.now()+offset*86400000);
  return Utilities.formatDate(date,'America/Lima','yyyy-MM-dd');
}
function pgSportsCached_(key,seconds,load){
  const cache=CacheService.getScriptCache();
  const cached=cache.get(key);
  if(cached){try{return JSON.parse(cached);}catch(e){}}
  return pgLock_(()=>{
    const recheck=cache.get(key);
    if(recheck){try{return JSON.parse(recheck);}catch(e){}}
    const data=load();
    // CacheService admite aprox. 100KB por clave; conservar como máximo 30 encuentros.
    const serialized=JSON.stringify(data);
    if(serialized.length<90000)cache.put(key,serialized,Math.min(seconds,21600));
    return data;
  });
}
function pgSportsLiveCacheSeconds_(){
  const seconds=Number(pgProp_('API_SPORTS_LIVE_CACHE_SECONDS')||3600);
  // No permitir consultas cada pocos segundos desde un web app de Apps Script.
  return Number.isInteger(seconds)&&seconds>=300&&seconds<=3600?seconds:3600;
}
function pgSportsValueOdds_(bets,kind){
  for(const bet of bets||[]){
    if(!bet||!Array.isArray(bet.values))continue;
    const name=String(bet.name||'').trim();
    const official=/^(match winner|1x2|full[ -]?time result|resultado final|home\s*\/\s*draw\s*\/\s*away)$/i.test(name);
    // El ID 1 de cuota PREMATCH no es equivalente al ID 1 de cuota LIVE.
    if(!official&&!(kind==='prematch'&&Number(bet.id)===1))continue;
    const vals=[null,null,null];
    for(const v of bet.values){
      if(v.suspended===true)continue;
      const odd=Number(v.odd),label=String(v.value||v.name||'').trim().toLowerCase();
      if(!Number.isFinite(odd)||odd<=1)continue;
      if(['home','local','1'].includes(label))vals[0]=odd;
      else if(['draw','empate','x'].includes(label))vals[1]=odd;
      else if(['away','visita','2'].includes(label))vals[2]=odd;
    }
    if(vals.every(n=>n!==null))return vals;
  }
  return [null,null,null];
}
function pgSportsOddsByFixture_(rows,kind){
  const result={};
  for(const row of rows||[]){
    const id=String(row.fixture?.id||row.fixture_id||'');
    if(!/^\d+$/.test(id))continue;
    if(kind==='live'&&(row.status?.blocked||row.status?.stopped||row.status?.finished))continue;
    const bets=[];
    if(Array.isArray(row.bets))bets.push(...row.bets);
    if(Array.isArray(row.odds))bets.push(...row.odds);
    for(const book of row.bookmakers||[])if(Array.isArray(book.bets))bets.push(...book.bets);
    const odds=pgSportsValueOdds_(bets,kind);
    if(odds.every(v=>v!==null)&&(!result[id]||result[id].some(v=>v===null)))result[id]=odds;
  }
  return result;
}
function pgSportsFixture_(row,odds,now,kind,fetchedAt){
  const fixture=row.fixture||{};
  const id=String(fixture.id||'');
  if(!/^\d+$/.test(id))return null;
  const shared={home:String(row.teams?.home?.name||''),away:String(row.teams?.away?.name||''),
    league:String(row.league?.name||'Fútbol'),odds:odds||[null,null,null],
    colors:['#7d8da7','#607b96'],fetchedAt};
  if(!shared.home||!shared.away)return null;
  if(kind==='live'){
    if(['FT','AET','PEN','CANC','PST','ABD'].includes(String(fixture.status?.short||'')))return null;
    return {id:'api-live-'+id,...shared,minute:Number(fixture.status?.elapsed)||0,
      score:[Number(row.goals?.home)||0,Number(row.goals?.away)||0]};
  }
  const date=new Date(fixture.date);
  if(!fixture.date||!Number.isFinite(date.getTime())||date<=now)return null;
  if(!['NS','TBD'].includes(String(fixture.status?.short||'NS')))return null;
  const dateLocal=Utilities.formatDate(date,'America/Lima','yyyy-MM-dd');
  const days=[pgSportsDate_(0),pgSportsDate_(1)];
  return {id:'api-'+id,...shared,day:dateLocal===days[0]?0:dateLocal===days[1]?1:2,
    time:Utilities.formatDate(date,'America/Lima','HH:mm'),
    dateLabel:Utilities.formatDate(date,'America/Lima','dd MMM · HH:mm')};
}
function pgSportsUpcoming_(){
  return pgSportsCached_('premiumgol:upcoming:real-v2',10800,()=>{
    // Obtener primero los encuentros que efectivamente tienen cuotas.
    const pricedRows=[];
    for(const d of [pgSportsDate_(0),pgSportsDate_(1)]){
      try{pricedRows.push(...pgSportsRequest_('odds',{date:d,bet:1,page:1,timezone:'America/Lima'}));}
      catch(e){console.warn('Cuotas no disponibles en la fecha consultada.');}
    }
    const odds=pgSportsOddsByFixture_(pricedRows,'prematch');
    const ids=Object.keys(odds).slice(0,20);
    const byId={};
    if(ids.length){
      try{
        const linked=pgSportsRequest_('fixtures',{ids:ids.join('-'),timezone:'America/Lima'});
        for(const fixture of linked)byId[String(fixture.fixture?.id||'')]=fixture;
      }catch(e){console.warn('No se pudo recuperar el detalle de algunos partidos.');}
    }
    const out=[],seen={},now=new Date(),asOf=now.toISOString();
    for(const id of ids){
      if(!byId[id])continue;
      const game=pgSportsFixture_(byId[id],odds[id],now,'prematch',asOf);
      if(game&&!seen[id]){out.push(game);seen[id]=true;}
    }
    // Complementar el listado si hay pocas cuotas: no inventar valores.
    if(out.length<8){
      try{
        const next=pgSportsRequest_('fixtures',{next:20,timezone:'America/Lima'});
        for(const row of next){
          const id=String(row.fixture?.id||'');
          if(seen[id])continue;
          const game=pgSportsFixture_(row,odds[id],now,'prematch',asOf);
          if(game){out.push(game);seen[id]=true;}
          if(out.length>=20)break;
        }
      }catch(e){console.warn('No se pudo ampliar el calendario.');}
    }
    out.sort((a,b)=>Number(a.day)-Number(b.day)||a.time.localeCompare(b.time));
    return out.slice(0,20);
  });
}
function pgSportsLive_(){
  const ttl=pgSportsLiveCacheSeconds_();
  return pgSportsCached_('premiumgol:live:real-v2:'+ttl,ttl,()=>{
    const fixtures=pgSportsRequest_('fixtures',{live:'all'});
    const odds=pgSportsOddsByFixture_(pgSportsRequest_('odds/live',{}),'live');
    const now=new Date(),asOf=now.toISOString();
    return (fixtures||[]).slice(0,40).map(row=>
      pgSportsFixture_(row,odds[String(row.fixture?.id||'')],now,'live',asOf)
    ).filter(Boolean);
  });
}
function pgPublicSportsCatalog_(){
  // Nunca presentar cuotas de demostración como si fueran del proveedor.
  const enabled=pgProp_('API_SPORTS_CATALOG_MODE')==='preview'&&Boolean(pgProp_('API_SPORTS_KEY'));
  if(!enabled)return {ok:true,mode:'API_PREVIEW',warning:'No hay encuentros disponibles por ahora.',
    games:{gol:PG_GOL_FIXTURES,match:[],live:[]}};
  let match=[],live=[],warnings=[];
  try{match=pgSportsUpcoming_();}catch(e){console.warn('Catálogo próximo: '+e.message);warnings.push('No se pudieron actualizar los próximos partidos.');}
  try{live=pgSportsLive_();}catch(e){console.warn('Catálogo Live: '+e.message);warnings.push('No se pudieron actualizar los encuentros en vivo.');}
  return {ok:true,mode:'API_PREVIEW',warning:warnings.join(' '),
    liveRefreshSeconds:pgSportsLiveCacheSeconds_(),
    games:{gol:PG_GOL_FIXTURES,match,live}};
}
function testPremiumGolSportsCatalog(){
  const data=pgPublicSportsCatalog_();
  console.log(JSON.stringify({mode:data.mode,upcoming:data.games.match.length,live:data.games.live.length,
    preview:data.games.match.slice(0,2),warning:data.warning||''}).slice(0,4500));
  return {mode:data.mode,upcoming:data.games.match.slice(0,3),live:data.games.live.slice(0,3),warning:data.warning||''};
}
