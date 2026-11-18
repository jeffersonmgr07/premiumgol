/** PremiumGol · Actualización independiente de partidos iniciados.
 * Los mercados en vivo dependen de la disponibilidad de The Odds API.
 * Las cuotas pueden quedar temporalmente desactualizadas; no son ejecutables.
 */
function pgOddsLiveCatalog_(){
  const cfg=pgOddsConfig_();
  const now=Date.now(),props=PropertiesService.getScriptProperties();
  const empty=message=>({ok:true,mode:'API_PREVIEW',source:'The Odds API',
    live:[],updatedAt:null,message});
  if(!cfg.key)return empty('No hay encuentros disponibles.');
  return pgLock_(()=>{
    const today=Utilities.formatDate(new Date(now),'America/Lima','yyyy-MM-dd');
    let liveUse={day:today,count:0};
    try{
      const previous=JSON.parse(String(props.getProperty('THE_ODDS_LIVE_DAILY_USAGE')||'null'));
      if(previous?.day===today&&Number.isInteger(previous.count)&&previous.count>=0)liveUse=previous;
    }catch(e){}
    const configured=Number(pgProp_('THE_ODDS_LIVE_MAX_DAILY'));
    const dailyMax=Number.isInteger(configured)&&configured>0?Math.min(configured,30):3;
    const delay=Number(pgProp_('THE_ODDS_LIVE_REFRESH_MINUTES'));
    const refreshMs=(Number.isInteger(delay)&&delay>=15?Math.min(delay,120):20)*60000;
    const last=Number(props.getProperty('THE_ODDS_LIVE_LAST_ATTEMPT')||0);
    if(!last||now-last>=refreshMs){
      if(liveUse.count<dailyMax){
        props.setProperty('THE_ODDS_LIVE_LAST_ATTEMPT',String(now));
        const candidates=[];
        // Máximo 3 ligas por comprobación; no duplicar llamadas por cada visitante.
        for(const sport of cfg.leagues.slice(0,3)){
          if(liveUse.count>=dailyMax)break;
          if(!pgOddsDailyCredit_(props,1))break;
          liveUse.count++;
          props.setProperty('THE_ODDS_LIVE_DAILY_USAGE',JSON.stringify(liveUse));
          const snapshot=pgOddsFetchLeague_(cfg,sport,100);
          if(!snapshot)continue;
          for(const game of snapshot.games){
            const kickoff=Date.parse(game.kickoff),market=Date.parse(game.marketUpdatedAt);
            if(Number.isFinite(kickoff)&&kickoff<=Date.now()&&kickoff>Date.now()-3*3600000&&
               Number.isFinite(market)&&Date.now()-market<20*60000){
              candidates.push(game);
            }
          }
        }
        const stored={updatedAt:new Date().toISOString(),games:candidates.slice(0,12)};
        const raw=JSON.stringify(stored);
        if(raw.length<8500)props.setProperty('THE_ODDS_LIVE_SNAPSHOT',raw);
      }
    }
    let snapshot={updatedAt:null,games:[]};
    try{
      const stored=JSON.parse(String(props.getProperty('THE_ODDS_LIVE_SNAPSHOT')||'null'));
      if(stored&&Array.isArray(stored.games))snapshot=stored;
    }catch(e){}
    const recent=snapshot.games.filter(g=>{
      const kickoff=Date.parse(g.kickoff),market=Date.parse(g.marketUpdatedAt);
      return Number.isFinite(kickoff)&&Number.isFinite(market)&&kickoff<=now&&
        kickoff>now-3*3600000&&market>now-20*60000;
    });
    const warning=recent.length?'':liveUse.count>=dailyMax?
      'No hay cuotas en vivo recientes disponibles dentro de la cobertura actual.':
      'No hay encuentros con cuotas en vivo disponibles en las ligas consultadas.';
    return {ok:true,mode:'API_PREVIEW',source:'The Odds API',
      live:recent,updatedAt:snapshot.updatedAt||null,message:warning};
  });
}
