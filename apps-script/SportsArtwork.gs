/** Escudos opcionales de TheSportsDB · licencia y marcas sujetas a verificación.
 * Nunca asociar escudos por aproximación insegura; si no coincide el equipo, mostrar iniciales.
 * API gratuita separada de The Odds API; sin claves privadas ni datos personales.
 */
const PG_SPORTS_ART_LEAGUES={
  soccer_epl:'English Premier League',
  soccer_spain_la_liga:'Spanish La Liga',
  soccer_italy_serie_a:'Italian Serie A',
  soccer_germany_bundesliga:'German Bundesliga',
  soccer_france_ligue_one:'French Ligue 1',
  soccer_uefa_champs_league:'UEFA Champions League',
  soccer_uefa_europa_league:'UEFA Europa League',
  soccer_brazil_campeonato:'Brazilian Serie A',
  soccer_usa_mls:'American Major League Soccer',
  soccer_argentina_primera_division:'Argentinian Primera Division',
  soccer_mexico_ligamx:'Mexican Primera League',
  soccer_conmebol_copa_libertadores:'Copa Libertadores'
};
function pgSportsImage_(value){
  const s=String(value||'').trim();
  return /^https:\/\/(?:www\.|r2\.|thumbs\.)?thesportsdb\.com\/(?:images\/|images\/media\/|[^?#]+\/(?:images|media)\/)/i.test(s)?
    s.slice(0,450):'';
}
function pgSportsName_(name){
  return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/\b(?:fc|cf|ac|sc|afc|club|football|de|futbol)\b/g,'')
    .replace(/[^a-z0-9]/g,'').trim();
}
function pgSportsRead_(url){
  try{
    const response=UrlFetchApp.fetch(url,{
      method:'get',muteHttpExceptions:true,followRedirects:true
    });
    if(response.getResponseCode()!==200)return null;
    const data=JSON.parse(response.getContentText());
    return data&&typeof data==='object'?data:null;
  }catch(e){return null;}
}
function pgSportsArtwork_(x){
  const sport=String(x&&x.sportKey||'');
  const config=pgOddsConfig_();
  if(!config.leagues.includes(sport)||!Object.prototype.hasOwnProperty.call(PG_SPORTS_ART_LEAGUES,sport))
    return {ok:true,sportKey:sport,leagueLogo:'',teams:[],source:'TheSportsDB'};
  const cache=CacheService.getScriptCache();
  const key='PG_ARTWORK_'+sport;
  const previous=cache.get(key);
  if(previous){try{return JSON.parse(previous);}catch(e){}}
  const league=PG_SPORTS_ART_LEAGUES[sport];
  const url='https://www.thesportsdb.com/api/v1/json/123/search_all_teams.php?l='+
    encodeURIComponent(league.replace(/ /g,'_'));
  const listing=pgSportsRead_(url);
  const games=pgOddsSnapshot_(PropertiesService.getScriptProperties(),sport).games;
  const requested=new Set();
  games.forEach(game=>{requested.add(pgSportsName_(game.home));requested.add(pgSportsName_(game.away));});
  const names=[];
  const entries=Array.isArray(listing?.teams)?listing.teams:[];
  for(const entry of entries){
    if(String(entry.strSport||'')!=='Soccer')continue;
    const accepted=[entry.strTeam,...String(entry.strTeamAlternate||'').split(',')]
      .map(pgSportsName_);
    const found=accepted.find(v=>requested.has(v));
    const img=pgSportsImage_(entry.strBadge||entry.strLogo);
    if(found&&img)names.push({name:found,url:img});
  }
  // La liga se valida con la respuesta del proveedor, sin construir URLs de imagen.
  let leagueLogo='';
  const leagueId=String(entries[0]?.idLeague||'');
  if(/^\d{3,9}$/.test(leagueId)){
    const ld=pgSportsRead_('https://www.thesportsdb.com/api/v1/json/123/lookupleague.php?id='+leagueId);
    const item=Array.isArray(ld?.leagues)?ld.leagues[0]:null;
    if(item&&String(item.idLeague)===leagueId)
      leagueLogo=pgSportsImage_(item.strBadge||item.strLogo);
  }
  const result={ok:true,sportKey:sport,leagueLogo,
    teams:names.slice(0,80),source:'TheSportsDB'};
  cache.put(key,JSON.stringify(result),21600);
  return result;
}
