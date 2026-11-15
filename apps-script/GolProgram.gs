/** Cartilla pública PremiumGol, su fecha de cierre y escudos del proveedor.
 * Los logos se recuperan ÚNICAMENTE cuando API-FOOTBALL confirma ambos equipos
 * en el mismo encuentro: nunca asignamos un escudo por parecido de nombre aislado.
 * Si la API no ofrece el dato, la interfaz muestra iniciales del club.
 */
function pgGolNormalize_(str){
  return String(str||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}
function pgGolTeamLogo_(team){
  const id=Number(team?.id);
  if(!Number.isSafeInteger(id)||id<=0)return '';
  return 'https://media.api-sports.io/football/teams/'+id+'.png';
}
function pgGolCrests_(){
  if(!pgProp_('API_SPORTS_KEY'))return {};
  return pgSportsCached_('premiumgol:gol-logos:20261118-v1',21600,()=>{
    const found={};
    const dates=['2026-11-18','2026-11-19','2026-11-20'];
    for(const date of dates){
      let response=[];
      try{response=pgSportsRequest_('fixtures',{date,timezone:'America/Lima'});}
      catch(e){console.warn('No hay escudos disponibles para '+date);continue;}
      for(const fixture of response||[]){
        const home=pgGolNormalize_(fixture.teams?.home?.name);
        const away=pgGolNormalize_(fixture.teams?.away?.name);
        if(!home||!away)continue;
        for(const game of PG_GOL_FIXTURES){
          if(found[game.id])continue;
          const names=game.aliases||[];
          if(names.length!==2)continue;
          const ha=pgGolNormalize_(names[0]),aa=pgGolNormalize_(names[1]);
          if(home.includes(ha)&&away.includes(aa)){
            found[game.id]={
              homeLogo:pgGolTeamLogo_(fixture.teams.home),
              awayLogo:pgGolTeamLogo_(fixture.teams.away),
              fixtureId:Number(fixture.fixture?.id)||null
            };
          }
        }
      }
    }
    return found;
  });
}
function pgPublicGolProgram_(){
  let crests={},logosWarning=false;
  try{crests=pgGolCrests_();}
  catch(e){logosWarning=true;console.warn('Escudos no disponibles');}
  return {ok:true,roundId:PG.ROUND_ID,cutoff:PG.GOL_CUTOFF_ISO,
    games:PG_GOL_FIXTURES.map(g=>({...g,...(crests[g.id]||{}),aliases:undefined})),
    logosPartial:logosWarning||Object.keys(crests).length<PG_GOL_FIXTURES.length};
}
function testPremiumGolProgram(){
  const response=pgPublicGolProgram_();
  console.log('Cartilla:',response.games.length,'cierre:',response.cutoff,
    'escudos disponibles:',response.games.filter(g=>g.homeLogo&&g.awayLogo).length);
  return {roundId:response.roundId,cutoff:response.cutoff,program:response.games.map(g=>({
    home:g.home,away:g.away,league:g.league,kickoff:g.kickoff,
    hasLogos:Boolean(g.homeLogo&&g.awayLogo)
  }))};
}
