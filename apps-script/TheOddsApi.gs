/**
 * PremiumGol · The Odds API v4 · catálogo público solo de consulta.
 * Seguridad: THE_ODDS_API_KEY se guarda SOLO en Propiedades de Apps Script.
 * No enviar la clave a GitHub, HTML, logs, JSON público ni URL.
 * /v4/sports/{sport}/odds?regions=eu&markets=h2h&oddsFormat=decimal
 * El endpoint /odds devuelve prepartidos y encuentros iniciados, sin marcadores.
 * NO autoriza ni ejecuta apuestas: mode=API_PREVIEW.
 *
 * Propiedades opcionales:
 * THE_ODDS_SPORT_KEYS (3 ligas por defecto, máx. 6 soccer_* válidas)
 * THE_ODDS_REGION     (eu, uk, us o au; defecto eu)
 * THE_ODDS_REFRESH_MINUTES (por defecto 720; mínimo 30)
 * THE_ODDS_DAILY_LIMIT (por defecto 12 créditos/día; mínimo 1, máximo 200)
 */
const PG_ODDS_DEFAULT_SPORTS=[
  'soccer_epl','soccer_spain_la_liga','soccer_italy_serie_a'
];
const PG_ODDS_LEAGUE_NAMES={
  soccer_epl:'Premier League',
  soccer_spain_la_liga:'LaLiga',
  soccer_italy_serie_a:'Serie A',
  soccer_germany_bundesliga:'Bundesliga',
  soccer_france_ligue_one:'Ligue 1',
  soccer_uefa_champs_league:'Champions League',
  soccer_uefa_europa_league:'Europa League',
  soccer_brazil_campeonato:'Brasileirão',
  soccer_usa_mls:'MLS',
  soccer_argentina_primera_division:'Liga Argentina',
  soccer_mexico_ligamx:'Liga MX',
  soccer_conmebol_copa_libertadores:'Copa Libertadores'
};
function pgOddsConfig_(){
  const list=pgProp_('THE_ODDS_SPORT_KEYS').split(',')
    .map(x=>x.trim().toLowerCase())
    .filter(x=>/^soccer_[a-z0-9_]{3,60}$/.test(x));
  const selected=[...new Set(list.length?list:PG_ODDS_DEFAULT_SPORTS)].slice(0,6);
  const region=pgProp_('THE_ODDS_REGION').toLowerCase();
  const mins=Number(pgProp_('THE_ODDS_REFRESH_MINUTES'));
  const daily=Number(pgProp_('THE_ODDS_DAILY_LIMIT'));
  return {
    key:pgProp_('THE_ODDS_API_KEY'),
    leagues:selected,
    region:['eu','uk','us','au'].includes(region)?region:'eu',
    refreshMs:(Number.isFinite(mins)&&mins>=30?Math.min(mins,1440):720)*60000,
    maxDaily:Number.isInteger(daily)&&daily>=1?Math.min(daily,200):12
  };
}
/** Un solo operador por mercado; jamás mezclar las 3 cuotas entre casas distintas. */
function pgOddsBookmaker_(event){
  const home=String(event.home_team||'').trim();
  const away=String(event.away_team||'').trim();
  const candidates=[];
  (Array.isArray(event.bookmakers)?event.bookmakers:[]).forEach(book=>{
    const market=(Array.isArray(book.markets)?book.markets:[])
      .find(m=>String(m.key)==='h2h');
    if(!market||!Array.isArray(market.outcomes))return;
    const named=market.outcomes;
    function price(name,draw){
      const value=named.find(o=>draw?
        /^(draw|tie|empate)$/i.test(String(o.name||'').trim()):
        String(o.name||'').trim().toLowerCase()===name.toLowerCase());
      const n=Number(value&&value.price);
      return Number.isFinite(n)&&n>1&&n<10000?Math.round(n*100)/100:null;
    }
    const odds=[price(home,false),price('',true),price(away,false)];
    if(odds.some(v=>v===null))return;
    const last=String(market.last_update||book.last_update||'');
    const when=Number(new Date(last))||0;
    candidates.push({odds,bookmaker:String(book.title||book.key||'').slice(0,70),
      marketUpdatedAt:last,updatedMs:when});
  });
  candidates.sort((a,b)=>b.updatedMs-a.updatedMs);
  return candidates[0]||null;
}
/** Convierte datos de proveedor a la estructura actual del frontend.
 * No inventa marcadores, minutos ni partidos.
 */
function pgOddsNormalize_(items,leagueKey,fetchedAt){
  if(!Array.isArray(items))return [];
  const now=Date.now();
  return items.slice(0,100).map(event=>{
    const id=String(event.id||'');
    const home=String(event.home_team||'').trim().slice(0,100);
    const away=String(event.away_team||'').trim().slice(0,100);
    const start=Number(new Date(event.commence_time||''));
    if(!/^[a-zA-Z0-9_-]{8,90}$/.test(id)||!home||!away||
       !Number.isFinite(start)||start<now-3*3600000||
       start>now+45*24*3600000)return null;
    const book=pgOddsBookmaker_(event);
    if(!book)return null;
    const local=new Date(start);
    const dayDiff=Math.floor((
      new Date(Utilities.formatDate(local,'America/Lima','yyyy-MM-dd')+'T12:00:00Z')-
      new Date(Utilities.formatDate(new Date(now),'America/Lima','yyyy-MM-dd')+'T12:00:00Z')
    )/86400000);
    return {
      id,home,away,sportKey:leagueKey,
      league:String(PG_ODDS_LEAGUE_NAMES[leagueKey]||event.sport_title||leagueKey).slice(0,100),
      kickoff:local.toISOString(),day:Math.max(0,dayDiff),
      time:Utilities.formatDate(local,'America/Lima','HH:mm'),
      dateLabel:Utilities.formatDate(local,'America/Lima','dd MMM · HH:mm'),
      odds:book.odds,bookmaker:book.bookmaker,
      marketUpdatedAt:book.marketUpdatedAt,fetchedAt,
      colors:['#c6a450','#417aa7']
    };
  }).filter(Boolean);
}
function pgOddsSnapshot_(props,sport){
  try{
    const raw=String(props.getProperty('THE_ODDS_SNAPSHOT_'+sport)||'');
    const data=JSON.parse(raw);
    return data&&Array.isArray(data.games)?data:{updatedAt:'',games:[]};
  }catch(e){return {updatedAt:'',games:[]};}
}
function pgOddsFetchLeague_(cfg,sport){
  const url='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(sport)+
    '/odds/?regions='+encodeURIComponent(cfg.region)+
    '&markets=h2h&oddsFormat=decimal&dateFormat=iso';
  try{
    const response=UrlFetchApp.fetch(url,{
      method:'get',muteHttpExceptions:true,followRedirects:false,
      headers:{'x-api-key':cfg.key,Accept:'application/json'}
    });
    if(response.getResponseCode()!==200)return null;
    const data=JSON.parse(response.getContentText());
    if(!Array.isArray(data))return null;
    const timestamp=new Date().toISOString();
    // Google PropertiesService admite ~9 KB por valor: acotar solo campos públicos.
    const games=pgOddsNormalize_(data,sport,timestamp).slice(0,15);
    return {updatedAt:timestamp,games};
  }catch(e){
    // Nunca mostrar ni registrar key, URL autenticada ni respuestas del proveedor.
    return null;
  }
}

/** Categorías del detalle. El proveedor puede no publicar algunos mercados en fútbol. */
const PG_ODDS_MARKET_GROUPS={
  goles:{label:'Más / Menos goles',keys:['totals','alternate_totals']},
  ambos:{label:'Ambos anotan y goles por equipo',keys:['btts','team_totals']},
  oportunidades:{label:'Doble oportunidad / Empate no apuesta',keys:['double_chance','draw_no_bet']},
  handicap:{label:'Hándicap',keys:['spreads']},
  resultados:{label:'Marcador exacto / Descanso-Final',keys:['correct_score','halftime_fulltime']},
  corners:{label:'Córners',keys:['alternate_totals_corners']},
  goleadores:{label:'Goleador',keys:['player_goal_scorer_anytime']}
};
const PG_ODDS_MARKET_LABELS={
  totals:'Más / Menos goles',alternate_totals:'Líneas alternativas de goles',
  btts:'Ambos equipos anotan',team_totals:'Goles por equipo',
  double_chance:'Doble oportunidad',draw_no_bet:'Empate no apuesta',
  spreads:'Hándicap',correct_score:'Marcador exacto',
  halftime_fulltime:'Descanso / Final',
  alternate_totals_corners:'Córners: Más / Menos',
  player_goal_scorer_anytime:'Goleador en cualquier momento'
};
/** Cada mercado usa UNA casa de apuestas y conserva su línea, jugador y cuota. */
function pgOddsNormalizeEventMarkets_(raw,requested){
  const all=(raw&&Array.isArray(raw.bookmakers))?raw.bookmakers:[];
  const markets=[];
  for(const key of requested){
    const candidates=[];
    for(const bookmaker of all){
      const item=(Array.isArray(bookmaker.markets)?bookmaker.markets:[])
        .find(m=>String(m.key)===key&&Array.isArray(m.outcomes)&&m.outcomes.length);
      if(!item)continue;
      const outcomes=item.outcomes.slice(0,45).map(outcome=>{
        const price=Number(outcome.price);
        if(!Number.isFinite(price)||price<=1||price>=10000)return null;
        const point=(outcome.point===undefined||outcome.point===null)?null:Number(outcome.point);
        return {name:String(outcome.name||'').slice(0,90),
          description:String(outcome.description||'').slice(0,120),
          point:Number.isFinite(point)?point:null,price:Math.round(price*100)/100};
      }).filter(Boolean);
      if(!outcomes.length)continue;
      const updatedAt=String(item.last_update||bookmaker.last_update||'');
      candidates.push({key,label:PG_ODDS_MARKET_LABELS[key]||key,
        bookmaker:String(bookmaker.title||bookmaker.key||'').slice(0,65),
        updatedAt,outcomes,priority:Number(new Date(updatedAt))||0});
    }
    // Preferir una casa con cuotas actuales, sin mezclar cuotas de casas diferentes.
    candidates.sort((a,b)=>b.priority-a.priority);
    if(candidates.length){
      const selected=candidates[0];
      delete selected.priority;
      markets.push(selected);
    }
  }
  return markets;
}
/** Control compartido de créditos: presupuesto prudente por día. */
function pgOddsDailyCredit_(props,requested){
  const today=Utilities.formatDate(new Date(),'America/Lima','yyyy-MM-dd');
  let q={day:today,count:0};
  try{
    const old=JSON.parse(String(props.getProperty('THE_ODDS_DAILY_USAGE')||'null'));
    if(old&&old.day===today&&Number.isInteger(old.count)&&old.count>=0)q=old;
  }catch(e){}
  const limit=pgOddsConfig_().maxDaily;
  if(q.count+requested>limit)return false;
  q.count+=requested; // Se reserva antes de UrlFetchApp para evitar carreras.
  props.setProperty('THE_ODDS_DAILY_USAGE',JSON.stringify(q));
  return true;
}
/** La consulta avanzada solo se permite para partidos presentes en nuestra caché. */
function pgOddsEventMarkets_(x){
  const cfg=pgOddsConfig_();
  const groupKey=String(x&&x.group||'').trim();
  const sport=String(x&&x.sportKey||'').trim();
  const eventId=String(x&&x.eventId||'').trim();
  const group=PG_ODDS_MARKET_GROUPS[groupKey];
  const empty=(message,cache)=>({ok:true,mode:'API_PREVIEW',source:'The Odds API',
    eventId,group:groupKey,markets:[],message,fromCache:Boolean(cache)});
  if(!group||!cfg.leagues.includes(sport)||!/^[A-Za-z0-9_-]{8,90}$/.test(eventId))
    return empty('Mercado o encuentro no válido.',false);
  if(!cfg.key)return empty('Configura la clave en Apps Script.',false);
  return pgLock_(()=>{
    const props=PropertiesService.getScriptProperties();
    const fixture=pgOddsSnapshot_(props,sport).games.find(g=>g.id===eventId);
    if(!fixture||Date.parse(fixture.kickoff)<Date.now()-3*3600000)
      return empty('El partido ya no está disponible en el catálogo.',false);
    const cache=CacheService.getScriptCache();
    const cacheKey='PG_ODDS_EV_'+sport+'_'+eventId+'_'+groupKey+'_'+cfg.region;
    const old=cache.get(cacheKey);
    if(old){
      try{const data=JSON.parse(old);if(data&&Array.isArray(data.markets))
        return Object.assign({},data,{fromCache:true});}catch(e){}
    }
    if(!pgOddsDailyCredit_(props,group.keys.length))
      return empty('Se alcanzó el límite diario de consultas. Inténtalo más tarde.',false);
    // URL sin clave: secreto en encabezado, solo se envía desde Apps Script.
    const url='https://api.the-odds-api.com/v4/sports/'+encodeURIComponent(sport)+
      '/events/'+encodeURIComponent(eventId)+'/odds?regions='+encodeURIComponent(cfg.region)+
      '&markets='+encodeURIComponent(group.keys.join(','))+
      '&oddsFormat=decimal&dateFormat=iso';
    let data=null;
    try{
      const response=UrlFetchApp.fetch(url,{
        method:'get',muteHttpExceptions:true,followRedirects:false,
        headers:{'x-api-key':cfg.key,Accept:'application/json'}
      });
      if(response.getResponseCode()===200)data=JSON.parse(response.getContentText());
    }catch(e){ /* No enviar detalles del proveedor ni credenciales al navegador. */ }
    if(!data||String(data.id)!==eventId){
      const no=empty('El proveedor no entregó cuotas para esta categoría.',false);
      cache.put(cacheKey,JSON.stringify(no),600);
      return no;
    }
    const markets=pgOddsNormalizeEventMarkets_(data,group.keys);
    const result={ok:true,mode:'API_PREVIEW',source:'The Odds API',
      eventId,group:groupKey,updatedAt:new Date().toISOString(),
      markets,message:markets.length?'Cuotas referenciales, sujetas a cambios.':
        'No hay cuotas disponibles de esta categoría en las casas consultadas.',
      fromCache:false};
    // Caché para todos los visitantes: controles compartidos.
    const json=JSON.stringify(result);
    if(json.length<85000)cache.put(cacheKey,json,1800);
    return result;
  });
}

/** Comprobación manual desde el editor de Apps Script.
 * Utiliza la misma caché y límite diario del sitio; nunca expone la clave.
 * Si la cuota gratuita ya no permite consultar, conserva las últimas cuotas.
 */
function testTheOddsApiConnection(){
  const cfg=pgOddsConfig_();
  const data=pgOddsCatalog_();
  const props=PropertiesService.getScriptProperties();
  let todayUsed=null;
  try{
    const q=JSON.parse(String(props.getProperty('THE_ODDS_DAILY_USAGE')||'null'));
    todayUsed=q&&Number.isInteger(q.count)?q.count:0;
  }catch(e){}
  const summary={
    ok:Boolean(cfg.key)&&Boolean(data.ok),
    configured:Boolean(cfg.key),
    source:data.source,
    region:cfg.region,
    leagues:cfg.leagues,
    refreshMinutes:Math.round(cfg.refreshMs/60000),
    dailyLimit:cfg.maxDaily,
    dailyRequestsUsed:todayUsed,
    upcomingCount:(data.games.match||[]).length,
    inProgressCount:(data.games.live||[]).length,
    lastUpdate:data.updatedAt,
    message:data.warning
  };
  console.log(JSON.stringify(summary));
  return summary;
}

function pgOddsCatalog_(){
  const cfg=pgOddsConfig_();
  const empty=warning=>({ok:true,mode:'API_PREVIEW',source:'The Odds API',
    warning,updatedAt:null,games:{match:[],live:[]}});
  if(!cfg.key)return empty('Las cuotas están pendientes de configurar en el servidor.');
  return pgLock_(()=>{
    const props=PropertiesService.getScriptProperties();
    const current=Date.now();
    const today=Utilities.formatDate(new Date(current),'America/Lima','yyyy-MM-dd');
    let quota={day:today,count:0};
    try{
      const old=JSON.parse(String(props.getProperty('THE_ODDS_DAILY_USAGE')||'null'));
      if(old&&old.day===today&&Number.isInteger(old.count)&&old.count>=0)quota=old;
    }catch(e){}
    const last=Number(props.getProperty('THE_ODDS_LAST_ATTEMPT')||0);
    const refresh=!last||current-last>=cfg.refreshMs;
    const hasBudget=quota.count<cfg.maxDaily;
    let fetched=0;
    if(refresh&&hasBudget){
      // Marcar antes de las llamadas para no duplicar consumos entre usuarios.
      props.setProperty('THE_ODDS_LAST_ATTEMPT',String(current));
      for(const sport of cfg.leagues){
        if(quota.count>=cfg.maxDaily)break;
        quota.count++;
        props.setProperty('THE_ODDS_DAILY_USAGE',JSON.stringify(quota));
        const snapshot=pgOddsFetchLeague_(cfg,sport);
        if(snapshot){
          const json=JSON.stringify(snapshot);
          if(json.length<8500){
            props.setProperty('THE_ODDS_SNAPSHOT_'+sport,json);
            fetched++;
          }
        }
      }
    }
    const matches=[],live=[];
    let newest='';
    for(const sport of cfg.leagues){
      const snapshot=pgOddsSnapshot_(props,sport);
      if(snapshot.updatedAt>newest)newest=snapshot.updatedAt;
      for(const game of snapshot.games){
        const start=Date.parse(game.kickoff),marketAt=Date.parse(game.marketUpdatedAt);
        if(!Number.isFinite(start)||start<Date.now()-3*3600000)continue;
        if(start>Date.now())matches.push(game);
        else if(Date.now()-Date.parse(game.fetchedAt)<15*60000 &&
          Number.isFinite(marketAt)&&Date.now()-marketAt<15*60000){
          // Solo mostrar como en curso si se consultó hace pocos minutos.
          live.push(game);
        }
      }
    }
    matches.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    live.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    const stale=!newest||Date.now()-Date.parse(newest)>cfg.refreshMs;
    const warning=!newest?
      (quota.count>=cfg.maxDaily?'Límite diario de consultas alcanzado. Vuelve más tarde.':
        'El proveedor todavía no devolvió cuotas disponibles para estas ligas.'):
      stale?'Cuotas de referencia almacenadas; la actualización está pendiente.':
      'Cuotas de referencia de casas externas. Pueden variar; no se aceptan apuestas.';
    return {ok:true,mode:'API_PREVIEW',source:'The Odds API',
      updatedAt:newest||null,warning,
      games:{match:matches.slice(0,60),live:live.slice(0,20)}};
  });
}
