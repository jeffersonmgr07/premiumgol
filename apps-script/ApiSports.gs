/** API-FOOTBALL: cliente privado de Apps Script y diagnóstico de errores.
 * La clave API_SPORTS_KEY solo reside en las Propiedades del script.
 * Importante: el plan Free limita las temporadas consultables.
 */
function pgSportsSafeError_(value){
  const raw=typeof value==='string'?value:JSON.stringify(value||'');
  // La URL consultada nunca lleva la API key. Por precaución, evitar secretos
  // accidentales en posibles mensajes del proveedor.
  return raw.replace(/(x-apisports-key|api[_-]?key|token)\s*[:=]\s*[^,\s\"}]+/ig,'$1=[oculto]').slice(0,430);
}
function pgSportsPlanInfo_(){
  const cache=CacheService.getScriptCache();
  const key='premiumgol:sports-plan-v2';
  const stored=cache.get(key);
  if(stored){try{return JSON.parse(stored);}catch(e){}}
  const apiKey=pgProp_('API_SPORTS_KEY');
  if(!apiKey)return {plan:'unconfigured',active:false};
  try{
    const response=UrlFetchApp.fetch('https://v3.football.api-sports.io/status',{
      method:'get',headers:{'x-apisports-key':apiKey},muteHttpExceptions:true
    });
    const body=JSON.parse(response.getContentText()||'{}');
    if(response.getResponseCode()!==200||body.errors?.length||
       (body.errors&&Object.keys(body.errors).length)){
      console.warn('API-FOOTBALL /status no disponible, HTTP '+response.getResponseCode());
      return {plan:'unknown',active:null};
    }
    const value={plan:String(body.response?.subscription?.plan||'unknown'),
      active:body.response?.subscription?.active===true,
      requestsRemaining:Math.max(0,Number(body.response?.requests?.limit_day||0)-
        Number(body.response?.requests?.current||0))};
    // Status no consume cuota; revalidar cada 15 minutos para detectar cambios de plan.
    cache.put(key,JSON.stringify(value),900);
    return value;
  }catch(e){console.warn('No se pudo revisar el plan API-FOOTBALL.');return {plan:'unknown',active:null};}
}
function testApiSportsConnection(){
  const info=pgSportsPlanInfo_();
  console.log('API-FOOTBALL: plan='+info.plan+
    ' activo='+info.active+' restantes≈'+(info.requestsRemaining??'?'));
  return info;
}
function pgSportsRequest_(endpoint,query){
  const apiKey=pgProp_('API_SPORTS_KEY');
  if(!apiKey)pgErr_('Proveedor deportivo no configurado.');
  if(!/^[a-z/]+$/.test(endpoint))pgErr_('Endpoint deportivo inválido.');
  const qs=Object.keys(query||{}).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(query[k])).join('&');
  const url='https://v3.football.api-sports.io/'+endpoint+(qs?'?'+qs:'');
  let response;
  try{
    response=UrlFetchApp.fetch(url,{
      method:'get',headers:{'x-apisports-key':apiKey},muteHttpExceptions:true
    });
  }catch(err){
    console.warn('API-FOOTBALL: error de red en '+endpoint+': '+String(err?.message||err).slice(0,200));
    pgErr_('El proveedor deportivo no respondió.');
  }
  const http=response.getResponseCode();
  let data;
  try{data=JSON.parse(response.getContentText()||'{}');}
  catch(e){
    console.warn('API-FOOTBALL: respuesta no JSON en '+endpoint+', HTTP '+http);
    pgErr_('Respuesta inválida del proveedor deportivo.');
  }
  const errors=data.errors&&(Array.isArray(data.errors)?data.errors.length:Object.keys(data.errors).length)
    ?pgSportsSafeError_(data.errors):'';
  if(http!==200||errors){
    const remain=response.getHeaders()['x-ratelimit-requests-remaining']||
      response.getHeaders()['X-RateLimit-Requests-Remaining']||'desconocido';
    console.warn('API-FOOTBALL '+endpoint+' HTTP '+http+
      ', restantes='+remain+', error='+errors);
    pgErr_('API-FOOTBALL '+endpoint+' HTTP '+http+(errors?': '+errors:''));
  }
  return Array.isArray(data.response)?data.response:[];
}
/** Una sola consulta deportiva para diagnosticar acceso a fixtures actuales. */
function testApiSportsFixtures(){
  const info=pgSportsPlanInfo_();
  console.log('Plan disponible: '+info.plan);
  try{
    const result=pgSportsRequest_('fixtures',{next:5});
    console.log('Fixtures retornados: '+result.length);
    return result.slice(0,5).map(f=>({id:f.fixture?.id,
      league:f.league?.name,home:f.teams?.home?.name,
      away:f.teams?.away?.name,date:f.fixture?.date}));
  }catch(e){
    console.warn('Diagnóstico fixtures: '+e.message);
    return {ok:false,plan:info.plan,error:String(e.message).slice(0,450)};
  }
}
