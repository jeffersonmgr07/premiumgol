/** Puerta de enlace futura a API-FOOTBALL / API-SPORTS.
 * La API no se consulta en cada visita: podría agotar el plan gratuito (100 req/día).
 * En esta versión, el catálogo público y la validación siguen en modo DEMO.
 */
function testApiSportsConnection(){
  const key=pgProp_('API_SPORTS_KEY');
  if(!key)pgErr_('Configura API_SPORTS_KEY en Propiedades del script.');
  const response=UrlFetchApp.fetch('https://v3.football.api-sports.io/status',{
    method:'get',headers:{'x-apisports-key':key},muteHttpExceptions:true
  });
  const json=JSON.parse(response.getContentText());
  console.log('API-Sports HTTP:',response.getResponseCode());
  console.log('Estado de cuenta:',JSON.stringify(json.response||json.errors||{}).slice(0,1200));
  return {httpStatus:response.getResponseCode(),account:json.response||null};
}
function pgSportsRequest_(endpoint,query){
  const key=pgProp_('API_SPORTS_KEY');
  if(!key)pgErr_('Proveedor deportivo no configurado.');
  const queryString=Object.keys(query||{}).map(k=>encodeURIComponent(k)+'='+encodeURIComponent(query[k])).join('&');
  const url='https://v3.football.api-sports.io/'+endpoint+(queryString?'?'+queryString:'');
  const response=UrlFetchApp.fetch(url,{method:'get',headers:{'x-apisports-key':key},muteHttpExceptions:true});
  if(response.getResponseCode()!==200)pgErr_('No se pudo consultar el proveedor deportivo.');
  const data=JSON.parse(response.getContentText());
  if(data.errors&&Object.keys(data.errors).length)pgErr_('Error de cuota o disponibilidad deportiva.');
  return data.response||[];
}
/** Pruebas manuales sin publicar datos: ajustar ligas/filtros antes de activar para jugadores. */
function testApiSportsFixtures(){
  const result=pgSportsRequest_('fixtures',{next:5});
  return result.map(f=>({id:f.fixture?.id,league:f.league?.name,home:f.teams?.home?.name,away:f.teams?.away?.name,date:f.fixture?.date}));
}
