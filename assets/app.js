/* PremiumGol · interfaz de saldos PEN.
 * Las cuotas y las jugadas SOLO son válidas tras confirmación del backend.
 * La cartilla y el cupón sin enviar se guardan en este navegador como borrador.
 */
(() => {
  'use strict';
  const CONFIG = window.PREMIUMGOL_CONFIG || {};
  // Los ID OAuth WEB de Google no comienzan por GOCSPX: ese prefijo identifica secretos.
  const validGoogleClientId = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(String(CONFIG.googleClientId||''));
  const DRAFT_KEY = 'premiumgol_draft_20261121';
  const LEGACY_DRAFT_KEY = 'premiumgol_draft_v2';
  // Sesión persistente entre actualizaciones del navegador; caduca por inactividad.
  const SESSION_KEY = 'premiumgol_session_v3';
  const LEGACY_SESSION_KEY = 'premiumgol_session_v2';
  const SESSION_IDLE_MS = 60*60*1000;
  const SESSION_ACTIVITY_THROTTLE_MS = 30*1000;
  const SESSION_HEARTBEAT_MS = 8*60*1000;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  // Registro seguro de listeners: si un elemento no existe, se avisa en consola
  // y NO se aborta el resto de la inicialización (evita que la página quede "muerta").
  const on = (target,type,handler,options) => {
    const el = typeof target==='string' ? document.querySelector(target) : target;
    if(el) el.addEventListener(type,handler,options);
    else console.warn('PremiumGol: elemento no encontrado para',type,target);
  };
  const esc = v => String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const fmt = n => new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(Number(n)||0);
  const fmt2 = n => new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
/* Verified primary SVG logo registry. No client-side GitHub code-search or approximate matches. */
const FOOTBALL_LOGOS_RAW='https://raw.githubusercontent.com/JoseArroyave/football-logos/main/';
const FOOTBALL_LOGOS_PATHS={
  "Borussia Mönchengladbach": "logos/germany/Borussia_Mönchengladbach.svg",
  "Borussia Dortmund": "logos/germany/Borussia_Dortmund.svg",
  "Sevilla": "logos/spain/Sevilla.svg",
  "Real Betis": "logos/spain/Real_Betis.svg",
  "Newcastle United": "logos/england/Newcastle_United.svg",
  "Arsenal": "logos/england/Arsenal.svg",
  "Manchester City": "logos/england/Manchester_City.svg",
  "Manchester United": "logos/england/Manchester_United.svg",
  "Fulham": "logos/england/Fulham.svg",
  "Aston Villa": "logos/england/Aston_Villa.svg",
  "Sunderland": "logos/england/Sunderland.svg",
  "Chelsea": "logos/england/Chelsea.svg",
  "Tottenham": "logos/england/Tottenham.svg",
  "Everton": "logos/england/Everton.svg",
  "Liverpool": "logos/england/Liverpool_FC.svg",
  "Bournemouth": "logos/england/Bournemouth.svg",
  "Brentford": "logos/england/Brentford.svg",
  "Brighton": "logos/england/Brighton.svg",
  "Burnley": "logos/england/Burnley.svg",
  "Crystal Palace": "logos/england/Crystal_Palace.svg",
  "Leeds United": "logos/england/Leeds_United.svg",
  "Leicester": "logos/england/Leicester.svg",
  "Nottingham Forest": "logos/england/Nottingham_Forest.svg",
  "West Ham": "logos/england/West_Ham.svg",
  "Wolverhampton Wanderers": "logos/england/Wolverhampton_Wanderers.svg",
  "Ipswich": "logos/england/Ipswich.svg",
  "Southampton": "logos/england/Southampton.svg",
  "Real Madrid": "logos/spain/Real_Madrid.svg",
  "Celta": "logos/spain/Celta.svg",
  "Alianza Lima": "logos/peru/Alianza_Lima.svg",
  "FC Cajamarca": "logos/peru/FC_Cajamarca.svg",
  "Pumas UNAM": "logos/mexico/UNAM_Pumas.svg",
  "Monterrey": "logos/mexico/Monterrey.svg",
  "Tigres UANL": "logos/mexico/Tigres_UANL.svg",
  "América": "logos/mexico/Club_America.svg",
  "Barcelona": "logos/spain/Barcelona.svg",
  "Villarreal": "logos/spain/Villarreal.svg",
  "Augsburg": "logos/germany/Augsburg.svg",
  "Mainz 05": "logos/germany/Mainz_05.svg",
  "Racing Santander": "logos/spain/Racing_Santander.svg",
  "Real Sociedad": "logos/spain/Real_Sociedad.svg",
  "Sporting Cristal": "logos/peru/Sporting_Cristal.svg",
  "Cienciano": "logos/peru/Cienciano_del_Cusco.svg",
  "Sport Huancayo": "logos/peru/Sport_Huancayo.svg",
  "Universitario": "logos/peru/Universitario_de_Deportes.svg",
};
const FOOTBALL_LOGOS_ALIASES={
  "Pumas": "Pumas UNAM",
  "UNAM Pumas": "Pumas UNAM",
  "Club América": "América",
  "America": "América",
  "Tigres": "Tigres UANL",
  "Borussia Monchengladbach": "Borussia Mönchengladbach",
  "M Gladbach": "Borussia Mönchengladbach",
  "Mainz": "Mainz 05",
  "Real Betis Balompié": "Real Betis",
  "Sport Huancayo": "Sport Huancayo",
  "Universitario de Deportes": "Universitario",
  "Racing Club": "Racing Santander",
  "Newcastle": "Newcastle United",
  "Liverpool FC": "Liverpool",
  "Tottenham Hotspur": "Tottenham",
  "Wolverhampton": "Wolverhampton Wanderers",
  "Wolves": "Wolverhampton Wanderers",
  "West Ham United": "West Ham",
  "Brighton and Hove Albion": "Brighton",
  "Brighton & Hove Albion": "Brighton",
  "AFC Bournemouth": "Bournemouth",
  "Nottingham Forest FC": "Nottingham Forest",
  "Leeds": "Leeds United",
  "Leicester City": "Leicester",
  "Ipswich Town": "Ipswich",
  "Manchester City FC": "Manchester City",
  "Manchester United FC": "Manchester United",
  "Chelsea FC": "Chelsea",
  "Everton FC": "Everton",
  "Crystal Palace FC": "Crystal Palace",
  "Burnley FC": "Burnley",
  "Newcastle Utd": "Newcastle United",
  "FC Barcelona": "Barcelona",
  "SC Cienciano": "Cienciano",
};
function footballLogoUrl(name){
  const canonical=FOOTBALL_LOGOS_ALIASES[name]||name;
  const path=FOOTBALL_LOGOS_PATHS[canonical];
  return path?FOOTBALL_LOGOS_RAW+path.split('/').map(encodeURIComponent).join('/'):'';
}
  const randomId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fixtureDays = n => {const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'}).replace('.','');};
  // El saldo y las jugadas viven SOLO en Google Sheets. Se eliminan los restos de la
  // antigua billetera simulada del navegador (S/ 1000 ficticios) y de sus recibos locales.
  try{
    localStorage.removeItem('premiumgol_local_wallet_v1');
    localStorage.removeItem('premiumgol_sports_simulations_v1');
  }catch{}
  let draft = {golPicks:{},slips:[]};
  try {draft={...draft,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')};}catch{}
  const SLOTS=['A','B','C','D'];
  draft.golCards=draft.golCards && typeof draft.golCards==='object'?draft.golCards:{A:draft.golPicks||{},B:{},C:{},D:{}};
  for(const slot of SLOTS){if(!draft.golCards[slot]||typeof draft.golCards[slot]!=='object')draft.golCards[slot]={};}
  draft.golRequestIds=draft.golRequestIds||{};
  let activeCard=SLOTS.includes(draft.activeCard)?draft.activeCard:'A';
  let golLocked={};let couponClaimed=false;
  const currentPicks=()=>draft.golCards[activeCard];
  draft.slips = Array.isArray(draft.slips) ?
    draft.slips.filter(s=>s&&typeof s.gameId==='string'&&typeof s.selectionId==='string'&&
      Number(s.odd)>1) : [];
  const saveDraft = () => {try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}catch{}};
  function readStoredSession(){
    try{
      const raw=localStorage.getItem(SESSION_KEY);
      if(raw){
        const item=JSON.parse(raw),now=Date.now();
        if(typeof item?.token==='string'&&
          /^[0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(item.token)&&
          Number.isFinite(item.lastActivityAt)&&Number.isFinite(item.createdAt)&&
          now-item.lastActivityAt>=0&&now-item.lastActivityAt<SESSION_IDLE_MS&&
          now-item.createdAt>=0&&now-item.createdAt<7*86400000){
            return item;
        }
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
        return null;
      }
      // Una única migración de la sesión de la versión previa.
      const legacy=sessionStorage.getItem(LEGACY_SESSION_KEY);
      if(legacy&&/^[0-9a-f-]{36}\.[0-9a-f-]{36}$/i.test(legacy)){
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
        return {token:legacy,lastActivityAt:Date.now(),createdAt:Date.now()};
      }
    }catch(err){console.warn('No se pudo leer la sesión guardada.');}
    return null;
  }
  const restoredSession=readStoredSession();
  let sessionToken=restoredSession?.token||'';
  let lastSessionInteraction=restoredSession?.lastActivityAt||0;
  let sessionCreatedAt=restoredSession?.createdAt||0;
  let lastSessionVerification=0;
  let accountRefreshPromise=null;
  // La sesión guardada no es un cierre de sesión: se valida antes de mostrar Ingresar.
  let sessionRestoring=Boolean(sessionToken);
  let sessionRestoreFailed=false;
  function sessionExpired(){
    const now=Date.now();
    // Otra pestaña activa mantiene vigente la misma sesión compartida.
    try{
      const shared=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      if(shared?.token===sessionToken&&Number.isFinite(shared.lastActivityAt)){
        lastSessionInteraction=Math.max(lastSessionInteraction,shared.lastActivityAt);
      }
    }catch{}
    return Boolean(sessionToken)&&(!lastSessionInteraction||
      now-lastSessionInteraction>=SESSION_IDLE_MS||
      now-sessionCreatedAt>=7*86400000);
  }
  function saveSessionActivity(force=false){
    if(!sessionToken||sessionExpired())return;
    const now=Date.now();
    if(!force&&now-lastSessionInteraction<SESSION_ACTIVITY_THROTTLE_MS)return;
    lastSessionInteraction=now;
    try{
      localStorage.setItem(SESSION_KEY,JSON.stringify({
        token:sessionToken,lastActivityAt:now,createdAt:sessionCreatedAt
      }));
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
    }catch(err){
      // El usuario puede restringir almacenamiento permanente; la pestaña actual
      // conserva la sesión aunque el navegador bloquee localStorage.
      try{sessionStorage.setItem(LEGACY_SESSION_KEY,sessionToken);}catch{}
    }
  }
  function clearSavedSession(){
    try{localStorage.removeItem(SESSION_KEY);}catch{}
    try{sessionStorage.removeItem(LEGACY_SESSION_KEY);}catch{}
    try{sessionStorage.removeItem(SESSION_KEY);}catch{}
  }
  if(sessionToken)saveSessionActivity(true);
  let account = null;
  let accountBalance = 0;
  let paidBalancePEN = 0;
  let bonusBalancePEN=0,bonusAvailablePEN=0,bonusPendingPEN=0,bonusUnlocked=false,bonusStatement=[],walletWagersEnabled=false,referralActivity=[];
  let recentTopupOrders = [];
  let playHistory = [];
  let activeView='home',accountTab='overview',pendingAfterAuth=null,authMode='login',catalogMode='API_PREVIEW';
  let accountMenuOpen=false,walletBreakdownOpen=false,authBusy=false,referralsJoined=0;
  const referralFromUrl=(()=>{
    try{
      const code=new URLSearchParams(location.search).get('ref')||'';
      return /^[A-Z0-9]{10,16}$/i.test(code)?code.toUpperCase():'';
    }catch{return '';}
  })();
  function setAuthBusy(on,message='Verificando tu cuenta…',kind='google'){
    authBusy=Boolean(on);
    const overlay=$('#authBusyOverlay');
    if(overlay){
      $('#authBusyTitle').textContent=message;
      overlay.dataset.kind=kind;
      if(authBusy&&!overlay.open)overlay.showModal();
      else if(!authBusy&&overlay.open)overlay.close();
    }
    document.body.classList.toggle('auth-request-busy',authBusy);
    if($('#authDialog'))$('#authDialog').setAttribute('aria-busy',String(authBusy));
  }
  function closeAccountMenu(){
    accountMenuOpen=false;
    $('#accountMenu').hidden=true;
    $('#loginTop').setAttribute('aria-expanded','false');
    $('[data-nav="account"]')?.setAttribute('aria-expanded','false');
  }
  function closeWalletBreakdown(){
    walletBreakdownOpen=false;
    $('#walletBreakdown').hidden=true;
    $('#walletTop').setAttribute('aria-expanded','false');
  }
  function toggleWalletBreakdown(){
    if(!hasUser())return;
    closeAccountMenu();
    walletBreakdownOpen=!walletBreakdownOpen;
    $('#walletBreakdown').hidden=!walletBreakdownOpen;
    $('#walletTop').setAttribute('aria-expanded',String(walletBreakdownOpen));
  }
  function toggleAccountMenu(source){
    if(!hasUser()){openAuth('login');return;}
    closeWalletBreakdown();
    accountMenuOpen=!accountMenuOpen;
    const menu=$('#accountMenu');
    menu.hidden=!accountMenuOpen;
    if(accountMenuOpen&&window.matchMedia('(max-width:900px)').matches){
      const anchor=source?.closest?.('button')||$('[data-nav="account"]');
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(225,window.innerWidth-24);
      const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
      menu.style.left=left+'px';
      menu.style.right='auto';
      if(anchor.id==='loginTop'){
        // El menú de la cabecera se despliega hacia abajo.
        const maxTop=Math.max(12,window.innerHeight-menu.offsetHeight-12);
        menu.style.top=Math.min(rect.bottom+8,maxTop)+'px';
        menu.style.bottom='auto';
      }else{
        // El menú de la barra inferior conserva su despliegue hacia arriba.
        menu.style.bottom=Math.max(10,window.innerHeight-rect.top+8)+'px';
        menu.style.top='auto';
      }
    }else{
      menu.style.left='';menu.style.bottom='';menu.style.right='';menu.style.top='';
    }
    $('#loginTop').setAttribute('aria-expanded',String(accountMenuOpen));
    $('[data-nav="account"]')?.setAttribute('aria-expanded',String(accountMenuOpen));
    if(accountMenuOpen)menu.querySelector('button')?.focus({preventScroll:true});
  }
  function openAccountTab(tab){
    if(!['overview','history','wallet','bonuses','profile'].includes(tab))return;
    accountTab=tab;closeAccountMenu();closeWalletBreakdown();showView('account');
    renderAccount();if(tab==='wallet')loadTopupOrders();
  }
  let catalogWarning='',catalogLoading=false,catalogRequested=false,golProgramRequested=false;
  let catalogUpdatedAt=null;
  let liveCatalogLoading=false,liveCatalogRequestedAt=0;
  const sportsArtwork=new Map(),artworkPending=new Set();
  let sportSimReceipt='';
  let sportsWalletEnabled=false,sportsPolicyRequested=false;
  let sportsWalletSource='principal';
  let mobileSlipOpen=false;

  const oddsGroups=[
    ['goles','Goles +/-'],['ambos','Ambos anotan'],['oportunidades','Doble oportunidad'],
    ['handicap','Hándicap'],['resultados','Resultados'],['corners','Córners'],
    ['goleadores','Goleadores']
  ];
  let oddsExpandedId='',oddsSelectedGroup='goles',oddsLoading=false,oddsError='';
  const oddsDetailCache=new Map();
  let leagueFilter='all',dateFilter='all',searchFilter='',sortFilter='date',stake=5;
  let topupSelection='5',topupCustom='',topupBusy=false,topupRequestId=null;
  let toastTimer;
  let promoActive=false,promoLastCheck=0;
  const couponTime=()=>promoActive;
  async function loadPromoStatus(){
    if(!CONFIG.appsScriptUrl||Date.now()-promoLastCheck<60000)return;
    promoLastCheck=Date.now();
    try{const res=await remote('promotionStatus',{});promoActive=res?.active===true;}
    catch(e){promoActive=false;}
    refreshCoupon();
  }
  function refreshCoupon(){
    const visible=couponTime();const coupon=$('#premiumCoupon');coupon.hidden=!visible;
    if($('#couponDialog')?.open&&!visible)$('#couponDialog').close();
  }
  function claimCouponPrompt(){
    if(!couponTime()){toast('El cupón no está disponible en este momento.');refreshCoupon();return;}
    if(couponClaimed){toast('Este cupón ya fue activado en tu cuenta.');return;}
    if(!hasUser()){pendingAfterAuth='coupon';openAuth('login');toast('Ingresa o regístrate para activar tu bono.');return;}
    const dialog=$('#couponDialog');if(!dialog.open)dialog.showModal();
  }
  async function claimCoupon(){
    if(!couponTime()){refreshCoupon();toast('El cupón ya no está disponible.');return;}
    if(!hasUser()){pendingAfterAuth='coupon';openAuth('login');return;}
    const btn=$('#claimCoupon');btn.disabled=true;
    try{const result=await remote('claimCoupon',{sessionToken});updateAccount(result);$('#couponDialog').close();toast('Bono promocional registrado: pendiente de activación mediante una recarga posterior.');}
    catch(e){toast(e.message||'No se pudo activar el cupón.');}
    finally{btn.disabled=false;}
  }
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
  function showInsufficientFunds(){
    const dialog=$('#insufficientFundsDialog');
    if(!dialog.open)dialog.showModal();
  }
  const outcomes=['1','X','2'];
  const outcomeName=['Local','Empate','Visita'];
  const golLabel=['L','E','V'];
  // Jornada 21–22 Nov 2026. Horas en America/Lima. El backend es la autoridad.
  let golCutoff='2026-11-21T09:15:00-05:00';
  let golJackpotPEN=0;
  let golGames=[
    ["Borussia Mönchengladbach","Borussia Dortmund","Bundesliga · Alemania","2026-11-21T09:30:00-05:00"],
    ["Sevilla","Real Betis","LaLiga · España","2026-11-21T12:30:00-05:00"],
    ["Newcastle United","Arsenal","Premier League · Inglaterra","2026-11-21T12:30:00-05:00"],
    ["Real Madrid","Celta","LaLiga · España","2026-11-21T15:00:00-05:00"],
    ["Alianza Lima","FC Cajamarca","Liga 1 · Perú","2026-11-21T15:30:00-05:00"],
    ["Pumas UNAM","Monterrey","Liga MX · México","2026-11-21T20:00:00-05:00"],
    ["Tigres UANL","América","Liga MX · México","2026-11-21T22:00:00-05:00"],
    ["Barcelona","Villarreal","LaLiga · España","2026-11-22T08:00:00-05:00"],
    ["Augsburg","Mainz 05","Bundesliga · Alemania","2026-11-22T09:30:00-05:00"],
    ["Racing Santander","Real Sociedad","LaLiga · España","2026-11-22T10:15:00-05:00"],
    ["Sporting Cristal","Cienciano","Liga 1 · Perú","2026-11-22T15:00:00-05:00"],
    ["Sport Huancayo","Universitario","Liga 1 · Perú","2026-11-22T15:00:00-05:00"],
  ].map(([home,away,league,kickoff],i)=>({id:'gol'+(i+1),home,away,league,kickoff,
    homeLogo:'',awayLogo:''}));
  // Cuotas 1X2 de The Odds API v4, consultadas exclusivamente por Apps Script.
  // Son datos informativos: ninguna apuesta queda habilitada por esta integración.
  let matches=[];
  let liveGames=[];
  const hasUser = () => Boolean(account && sessionToken && !sessionExpired());
  const allGames = () => [...matches,...liveGames];
  const visibleDate = g => g.dateLabel || `${fixtureDays(g.day||0)} · ${g.time||''}`;
  function initials(s){return String(s).split(' ').map(t=>t[0]).slice(0,2).join('').toUpperCase();}
  function badge(s,color){return `<span class="badge-crest" style="--crest:${/^#[0-9a-f]{6}$/i.test(color||'')?color:'#4c769d'}">${esc(initials(s))}</span>`;}
  function openComingSoon(section){
    const dlg=$('#comingSoonDialog');
    if(!dlg)return;
    const isLive=section==='live';
    $('#comingSoonTitle').textContent=isLive?
      'Premium Live está en preparación':'Apuestas deportivas en preparación';
    $('#comingSoonMessage').textContent=
      'Estamos preparando una nueva experiencia para ti. ¡Muy pronto estará disponible!';
    if(!dlg.open)dlg.showModal();
  }
  function backFromComingSoon(){
    const dlg=$('#comingSoonDialog');
    if(dlg?.open)dlg.close();
    showView('gol');
  }
  function showView(name,skipHash=false){
    closeAccountMenu();
    if(!['home','gol','match','live','account'].includes(name))name='home';
    if(name==='account'&&!hasUser()){
      if(sessionToken){
        // No mostrar un segundo modal ni ofrecer Google durante la restauración.
        refreshAccount().then(()=>{
          if(hasUser())showView('account');
          else if(!sessionToken)openAuth('login');
          else toast('No se pudo restaurar tu sesión. Pulsa Reconectar en la cabecera.');
        });
      }else{pendingAfterAuth='account';openAuth('login');}
      return;
    }
    if(name!=='match'&&name!=='live')mobileSlipOpen=false;
    activeView=name;
    syncMobileSportsSlip();
    $$('.view').forEach(e=>e.classList.toggle('is-active',e.id===`view-${name}`));
    $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===name));
    if(!skipHash)history.replaceState(null,'',name==='home'?'#inicio':`#${name}`);
    window.PremiumGolMeasurement?.pageView(name);
    if(name==='account')renderAccount();
    if(name==='match'||name==='live'||name==='home'){
      if((name==='match'||name==='live')&&!sportsPolicyRequested){
        sportsPolicyRequested=true;loadSportsWagerPolicy();
      }
      if(name!=='live'&&!catalogRequested){
        catalogRequested=true;catalogLoading=true;loadCatalog();
      }
      if(name==='match')renderMatch();
      else if(name==='live'){
        renderLive();
        if(!catalogLoading&&!liveCatalogLoading&&
          Date.now()-liveCatalogRequestedAt>15*60000)loadLiveCatalog();
      }
    }
    if(name==='gol'&&!golProgramRequested){golProgramRequested=true;loadGolProgram();}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderHome(){
    const withOdds=matches.filter(g=>g.odds?.some(v=>Number(v)>1));
    const featured=[...withOdds,...matches.filter(g=>!withOdds.some(x=>x.id===g.id))].slice(0,3);
    const source='Encuentros de fútbol';
    $('#homeFixtures').innerHTML=featured.length?featured.map(g=>`<article class="preview-card featured-clickable" data-featured-match="${esc(g.id)}" role="button" tabindex="0" aria-label="Ver cuotas de ${esc(g.home)} contra ${esc(g.away)}">
      <div class="preview-card-head"><span>${icon('ball')} ${esc(sportLeagueName(g))}</span><span class="game-date">${esc(visibleDate(g))}</span></div>
      <div class="preview-teams"><span class="preview-team">${badge(g.home,g.colors?.[0])}<span>${esc(g.home)}</span></span><span class="preview-versus">VS</span><span class="preview-team">${badge(g.away,g.colors?.[1])}<span>${esc(g.away)}</span></span></div>
      <div class="featured-odds" aria-label="Cuotas local empate visita">${['1','X','2'].map((name,n)=>`<span><small>${name}</small><b>${Number(g.odds?.[n])>1?fmt2(g.odds[n]):'—'}</b></span>`).join('')}</div>
      <div class="preview-bottom"><small>${source}</small><button type="button" class="text-link" data-featured-button="${esc(g.id)}">Ver cuotas →</button></div>
    </article>`).join(''):`<div class="empty-state featured-empty">${catalogLoading?'Consultando próximos partidos…':(catalogWarning||'No hay cuotas disponibles para los próximos encuentros.')}</div>`;
  }
  function openFeaturedGame(id){
    const match=matches.find(g=>String(g.id)===String(id));
    if(!match)return;
    leagueFilter='all';dateFilter='all';searchFilter=match.home;sortFilter='date';
    $('#matchSearch').value=match.home;
    $('#matchLeague').value='all';
    $('#matchDate').value='all';
    showView('match');
  }
  function completedPicks(slot=activeCard){return golGames.filter(g=>outcomes.includes(draft.golCards[slot]?.[g.id])).length;}
  // A -> B -> C -> D. A completed or paid previous card is required to unlock the next.
  function golSlotAccessible(slot){
    const index=SLOTS.indexOf(slot);
    return index>=0&&SLOTS.slice(0,index).every(previous=>Boolean(golLocked[previous])||completedPicks(previous)===12);
  }
  // One checkout includes only consecutive, fully completed, unpaid cards.
  function readyGolSlots(){
    const slots=[];
    for(const slot of SLOTS){
      if(golLocked[slot])continue;
      if(completedPicks(slot)===12){slots.push(slot);continue;}
      break;
    }
    return slots;
  }
  function unfinishedGolCards(){
    const ready=new Set(readyGolSlots());
    return SLOTS.some(slot=>!golLocked[slot]&&!ready.has(slot)&&completedPicks(slot)>0&&completedPicks(slot)<12);
  }
  const golClosed=()=>Date.now()>=new Date(golCutoff).getTime();
  function golDateLabel(iso){
    const parsed=new Date(iso);
    if(!Number.isFinite(parsed.getTime()))return 'Horario por confirmar';
    const values=Object.fromEntries(
      new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',weekday:'long',day:'numeric',month:'long',
        hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(parsed).map(({type,value})=>[type,value])
    );
    const weekday=values.weekday.slice(0,3).charAt(0).toUpperCase()+values.weekday.slice(1,3);
    const month=values.month.slice(0,3).charAt(0).toUpperCase()+values.month.slice(1,3);
    return `${weekday} ${values.day} ${month} · ${values.hour}:${values.minute}`;
  }
  function golCrest(team,url){
    const image=(/^https:\/\/(?:raw\.githubusercontent\.com\/JoseArroyave\/football-logos\/main\/logos\/|media\.api-sports\.io\/football\/teams\/)/.test(String(url||''))?
      String(url):footballLogoUrl(team));
    return `<span class="gol-team-crest" aria-hidden="true"><span class="gol-crest-initial">${esc(initials(team))}</span>`+
      (image?`<img class="gol-crest-img" src="${esc(image)}" alt="" loading="lazy" decoding="async">`:'')+'</span>';
  }
  function renderGol(){
    if(!golSlotAccessible(activeCard)){
      activeCard=SLOTS.find(slot=>golSlotAccessible(slot)&&!golLocked[slot])||'A';
      draft.activeCard=activeCard;saveDraft();
    }
    const selections=currentPicks(),locked=Boolean(golLocked[activeCard]),closed=golClosed();
    const deadline=$('#golDeadline');
    deadline.classList.toggle('expired',closed);
    const cutoffText=new Date(golCutoff).toLocaleString('es-PE',{timeZone:'America/Lima',
      weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
    const poolText=golJackpotPEN>0?'S/ '+fmt(golJackpotPEN):'Por anunciar';
    deadline.setAttribute('aria-label',(closed?'Jornada cerrada. ':'Cierre: ')+cutoffText+'. Pozo mayor '+poolText);
    deadline.title=closed?'Jornada cerrada':'Cierre de jugadas: '+cutoffText;
    const long=deadline.querySelector('.gol-info-date .badge-long');
    const short=deadline.querySelector('.gol-info-date .badge-short');
    const pool=deadline.querySelector('.gol-info-pot b');
    if(long)long.textContent='Cierre: '+cutoffText;
    if(short){
      const d=new Date(golCutoff);
      const parts=Object.fromEntries(new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'numeric',month:'short'})
        .formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
      short.textContent='Cierre: '+parts.day+'-'+(parts.month||'Nov').replace('.','').replace(/^./,c=>c.toUpperCase());
    }
    if(pool)pool.textContent=poolText;
    $('#golFixtures').innerHTML=golGames.map((g,i)=>`<article class="gol-fixture ${outcomes.includes(selections[g.id])?'filled':''}">
      <span class="fixture-number">${String(i+1).padStart(2,'0')}</span>
      <div class="fixture-main">
        <div class="gol-fixture-meta"><span class="gol-league-badge">${esc(g.league)}</span><time class="gol-fixture-date" datetime="${esc(g.kickoff)}">${esc(golDateLabel(g.kickoff))}</time></div>
        <div class="gol-teams-row">
          <span class="gol-team gol-team-home">${golCrest(g.home,g.homeLogo)}<strong>${esc(g.home)}</strong></span>
          <span class="gol-versus">VS</span>
          <span class="gol-team gol-team-away">${golCrest(g.away,g.awayLogo)}<strong>${esc(g.away)}</strong></span>
        </div>
      </div>
      <div class="result-choices" role="group" aria-label="Partido ${i+1}: ${esc(g.home)} contra ${esc(g.away)}">
        ${outcomes.map((o,k)=>`<button type="button" class="result-option ${selections[g.id]===o?'selected':''}" data-gol-id="${esc(g.id)}" data-gol-outcome="${o}" aria-pressed="${selections[g.id]===o}" title="${outcomeName[k]}" ${locked||closed?'disabled':''}><b>${golLabel[k]}</b><small>${outcomeName[k]}</small></button>`).join('')}
      </div>
    </article>`).join('');
    $('#golCount').textContent=String(completedPicks());
    $('#golCountSide').textContent=`${completedPicks()} de 12`;
    $('#golProgress').style.width=`${completedPicks()/12*100}%`;
    const completed=readyGolSlots();
    const hasUnfinished=unfinishedGolCards();
    const total=completed.length*5;
    const label=completed.length===1?'Colocar jugada':`Colocar ${['','', 'dos', 'tres', 'cuatro'][completed.length]||completed.length} jugadas`;
    $('#submitGol').disabled=closed||sendingPlay||!completed.length||hasUnfinished;
    $('#submitGol').innerHTML=closed?'Jornada cerrada':`${label} ${icon('arrow')}`;
    $('#golUnitPrice').textContent='S/ 5.00';
    $('#golPriceQuantity').textContent=`${completed.length} jugada${completed.length===1?'':'s'} × S/ 5.00`;
    $('#golPriceTotal').textContent='S/ '+fmt2(total);
    $('#resetGol').hidden=locked||closed;
    $('#golSlotHint').textContent=closed?'La jornada ha finalizado.':locked?
      `Jugada ${activeCard} registrada. Continúa con la siguiente cartilla.`:
      hasUnfinished?'Completa la cartilla que empezaste o borra sus selecciones para continuar.':
      `Jugada ${activeCard} · ${completedPicks()} de 12 selecciones`;
    $('#golTabs').innerHTML=SLOTS.map(slot=>{
      const accessible=golSlotAccessible(slot);
      return `<button type="button" data-gol-slot="${slot}" class="${activeCard===slot?'active':''} ${golLocked[slot]?'recorded':''}" aria-pressed="${activeCard===slot}" aria-label="Jugada ${slot}${!accessible?' bloqueada hasta completar la anterior':golLocked[slot]?' registrada':''}" title="Jugada ${slot}${!accessible?' · Completa la anterior para desbloquear':' '+(golLocked[slot]?'· Registrada':'')}" ${!accessible?'disabled':''}>${slot}</button>`;
    }).join('');
    const list=golGames.map((g,i)=>({g,i,pick:selections[g.id]})).filter(x=>outcomes.includes(x.pick));
    $('#golSummary').innerHTML=list.length?list.map(({g,i,pick})=>`<div class="gol-summary-row"><span class="num">${String(i+1).padStart(2,'0')}</span><span class="game" title="${esc(g.home)} – ${esc(g.away)}">${esc(g.home)} · ${esc(g.away)}</span><b class="result">${esc(golLabel[outcomes.indexOf(pick)])} · ${esc(outcomeName[outcomes.indexOf(pick)])}</b></div>`).join(''):'<div class="gol-summary-empty">Aquí aparecerán tus pronósticos a medida que selecciones los partidos.</div>';
  }

  let sendingPlay=false;
  let golBatchPending=false;
  function openWalletPayment(amount=5){
    const main=$('#walletPayPrincipal'),bonus=$('#walletPayBonuses');
    const totalCents=Math.round(amount*100);
    const enoughMain=Math.round(paidBalancePEN*100)>=totalCents;
    const enoughBonus=Math.round(bonusAvailablePEN*100)>=totalCents;
    if(!enoughMain&&!enoughBonus){showInsufficientFunds();return;}
    main.disabled=!enoughMain;
    bonus.disabled=!enoughBonus;
    main.checked=enoughMain;
    bonus.checked=!enoughMain&&enoughBonus;
    $('#walletPayPrincipalAmount').textContent='S/ '+fmt2(paidBalancePEN);
    $('#walletPayBonusesAmount').textContent='S/ '+fmt2(bonusAvailablePEN);
    $('#walletPayBonusesHint').textContent=bonusPendingPEN>0?
      'Disponibles para jugar · S/ '+fmt2(bonusPendingPEN)+' pendientes de otra recarga':
      'Bonos activados para jugar';
    $('#walletPayNotice').textContent=walletWagersEnabled?
      'Se descontará S/ '+fmt2(amount)+' únicamente de la billetera seleccionada.':
      'Las jugadas pagadas con saldo todavía están en preparación.';
    $('#walletPayConfirm').disabled=!walletWagersEnabled;
    $('#walletPayConfirm').textContent='Confirmar compra de S/ '+fmt2(amount);
    if(!$('#walletPayDialog').open)$('#walletPayDialog').showModal();
  }
  async function saveGol(walletSource=''){
    if(golClosed()){toast('La cartilla está cerrada para nuevas jugadas.');renderGol();return;}
    const slot=readyGolSlots()[0];
    if(!slot||unfinishedGolCards()){toast('Completa las cartillas en orden A, B, C y D.');return;}
    if(completedPicks(slot)!==12){toast('Completa los 12 partidos de la cartilla.');return;}
    if(!hasUser()&&sessionToken){
      setAuthBusy(true,'Restaurando tu sesión…','general');
      try{await refreshAccount();}finally{setAuthBusy(false);}
    }
    if(!hasUser()){pendingAfterAuth='gol';openAuth('login');toast('Ingresa o regístrate para colocar tu jugada.');return;}
    if(!walletSource){openWalletPayment();return;}
    if(!walletWagersEnabled){toast('Las jugadas con saldo todavía no están habilitadas.');return;}
    if(walletSource==='bonos'&&bonusAvailablePEN<5){
      toast('Saldo de bonos activados insuficiente. Los bonos nuevos requieren otra recarga.');return;
    }
    if((walletSource==='principal'?paidBalancePEN:bonusAvailablePEN)<5){
      showInsufficientFunds();return;
    }
    if(sendingPlay)return;
    sendingPlay=true;$('#submitGol').disabled=true;
    setAuthBusy(true,'Guardando tu jugada…','general');
    try{
      const picks=golGames.map(g=>({id:g.id,outcome:draft.golCards[slot][g.id]}));
      draft.golRequestIds[slot]=draft.golRequestIds[slot]||randomId();saveDraft();
      const res=await remote('savePremiumGol',{sessionToken,slot,picks,
        walletSource,clientRequestId:draft.golRequestIds[slot]});
      updateAccount(res);
      // Cada letra es reutilizable: una jugada guardada tiene su propio
      // ticket. Limpiar solo el borrador enviado, no los otros tres.
      draft.golCards[slot]={};
      delete draft.golRequestIds[slot];
      activeCard=slot;draft.activeCard=slot;
      saveDraft();
      renderGol();toast('¡Ticket PremiumGol registrado! Costo: S/ 5.00.');
    }catch(e){if(/saldo (principal|de bonos) insuficiente/i.test(String(e.message||'')))showInsufficientFunds();else toast(e.message||'No se pudo guardar la jugada.');}
    finally{sendingPlay=false;setAuthBusy(false);renderGol();}
  }
  async function saveGolBatch(walletSource=''){
    const slots=readyGolSlots();
    if(unfinishedGolCards()){toast('Completa la cartilla empezada antes de comprar.');return;}
    if(golClosed()||slots.length<2){toast('Completa dos o más cartillas antes de comprar juntas.');return;}
    if(!hasUser()){pendingAfterAuth='gol';openAuth('login');return;}
    const total=slots.length*5;
    if(!walletSource){golBatchPending=true;openWalletPayment(total);return;}
    if(!walletWagersEnabled){toast('Las compras con saldo aún no están habilitadas.');return;}
    if((walletSource==='principal'?paidBalancePEN:bonusAvailablePEN)<total){showInsufficientFunds();return;}
    if(sendingPlay)return;
    sendingPlay=true;setAuthBusy(true,'Registrando cartillas…','general');
    try{
      const cards=slots.map(slot=>({slot,picks:golGames.map(g=>({id:g.id,outcome:draft.golCards[slot][g.id]}))}));
      draft.golBatchRequestId=draft.golBatchRequestId||randomId();saveDraft();
      const res=await remote('savePremiumGolBatch',{sessionToken,clientRequestId:draft.golBatchRequestId,
        walletSource,cards});
      updateAccount(res);
      for(const slot of slots){draft.golCards[slot]={};delete draft.golRequestIds[slot];}
      delete draft.golBatchRequestId;saveDraft();
      renderGol();toast('Se registraron '+slots.length+' tickets · S/ '+fmt2(total)+'.');
    }catch(err){toast(err.message||'No se confirmó la compra de cartillas.');}
    finally{golBatchPending=false;sendingPlay=false;setAuthBusy(false);renderGol();}
  }
  function filterOptions(){
    const leagueSel=$('#matchLeague'),current=leagueFilter;
    const leagueValues=[...new Set(matches.map(g=>g.league))].sort((a,b)=>a.localeCompare(b,'es'));
    leagueSel.innerHTML='<option value="all">Todas las ligas</option>'+leagueValues.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('');
    if(!leagueValues.includes(current))leagueFilter='all';leagueSel.value=leagueFilter;
  }
  function renderMatch(){
    let games=matches.filter(g=>(leagueFilter==='all'||g.league===leagueFilter) && (dateFilter==='all'||(dateFilter==='2'?Number(g.day)>=2:String(g.day)===dateFilter)) && (`${g.home} ${g.away} ${g.league}`).toLocaleLowerCase('es').includes(searchFilter.toLocaleLowerCase('es')));
    if(sortFilter==='league')games.sort((a,b)=>a.league.localeCompare(b.league,'es'));
    else if(sortFilter==='team')games.sort((a,b)=>a.home.localeCompare(b.home,'es'));
    else games.sort((a,b)=>(Number(a.day)-Number(b.day))||String(a.time).localeCompare(String(b.time)));
    $('#matchSourceLabel').hidden=true;
    $('#matchResultCount').textContent=`${games.length} encuentro${games.length===1?'':'s'} encontrado${games.length===1?'':'s'}`;
    $('#matchFixtures').innerHTML=games.length?games.map(g=>marketCard(g,false)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando próximos encuentros…</h3><p>Estamos actualizando los partidos disponibles.</p>':
      '<h3>Por el momento no hay partidos disponibles</h3><p>Puedes explorar PremiumGol mientras se publica la próxima programación.</p><button type="button" class="btn btn-gold btn-mini" data-nav="gol">Ir a PremiumGol</button>'}</div>`;
    renderSlips();
  }
  function renderLive(){
    $('#liveBanner').hidden=!liveGames.length;
    $('#liveSourceLabel').hidden=true;
    $('#liveFixtures').innerHTML=liveGames.length?liveGames.map(g=>marketCard(g,true)).join(''):
      `<div class="empty-state premium-empty-sports">${liveCatalogLoading?
      '<span class="sports-loader" aria-hidden="true"></span><h3>Buscando partidos en vivo…</h3><p>Consultando las ligas disponibles.</p>':
      '<h3>No hay partidos en vivo disponibles</h3><p>Prueba nuevamente más tarde.</p><button type="button" class="btn btn-gold btn-mini" data-retry-live>Actualizar partidos</button>'}</div>`;
    renderSlips();
  }


  function normalizedSportsName(name){
    return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/\b(?:fc|cf|ac|sc|afc|club|football|de|futbol)\b/g,'')
      .replace(/[^a-z0-9]/g,'').trim();
  }
  function safeSportLogo(url){
    const s=String(url||'');
    return /^https:\/\/(?:www\.|r2\.|thumbs\.)?thesportsdb\.com\//i.test(s)||
      /^https:\/\/media\.api-sports\.io\/football\/(?:leagues|teams)\/[0-9]+\.png$/i.test(s)?s:'';
  }
  const SPORTS_LEAGUE_NAMES={
    soccer_epl:'Premier League',soccer_england_league1:'EFL League One',soccer_england_league2:'EFL League Two',
    soccer_england_efl_champ:'EFL Championship',soccer_spain_la_liga:'LaLiga',
    soccer_spain_segunda_division:'LaLiga Hypermotion',soccer_italy_serie_a:'Serie A',
    soccer_italy_serie_b:'Serie B',soccer_germany_bundesliga:'Bundesliga',
    soccer_germany_bundesliga2:'2. Bundesliga',soccer_france_ligue_one:'Ligue 1',
    soccer_france_ligue_two:'Ligue 2',soccer_portugal_primeira_liga:'Liga Portugal',
    soccer_netherlands_eredivisie:'Eredivisie',soccer_usa_mls:'Major League Soccer',
    soccer_brazil_campeonato:'Brasileirão Série A',soccer_argentina_primera_division:'Liga Profesional Argentina',
    soccer_uefa_champs_league:'UEFA Champions League',soccer_uefa_europa_league:'UEFA Europa League',
    soccer_uefa_europa_conference_league:'UEFA Conference League',
    soccer_mexico_ligamx:'Liga MX',soccer_australia_aleague:'A-League Men'
  };
  const SPORT_MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  function sportLeagueName(game){
    const key=String(game?.sportKey||'').toLowerCase();
    const raw=String(game?.league||'').trim();
    return SPORTS_LEAGUE_NAMES[key]||({EPL:'Premier League',LaLiga:'LaLiga',MLS:'Major League Soccer'}[raw]||raw||'Fútbol');
  }
  function sportSchedule(iso){
    const d=new Date(iso);
    if(!Number.isFinite(d.getTime()))return {date:'Por confirmar',time:'—'};
    const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',day:'2-digit',month:'numeric',hour:'2-digit',minute:'2-digit',hour12:true
    }).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    const month=SPORT_MONTHS[Number(p.month)-1]||'—';
    const period=String(p.dayPeriod||'AM').toUpperCase().includes('P')?'p.m.':'a.m.';
    return {date:`${p.day}-${month}`,time:`${p.hour}:${p.minute} ${period}`};
  }
  function sportCrest(team,sportKey,serverLogo){
    const art=sportsArtwork.get(sportKey);
    const row=art?.teams?.find(x=>x.name===normalizedSportsName(team));
    const primary=footballLogoUrl(team);
    const secondary=safeSportLogo(serverLogo)||safeSportLogo(row?.url);
    const img=primary||secondary;
    return '<span class="sport-team-crest" aria-hidden="true"><span>'+
      esc(initials(team))+'</span>'+(img?'<img src="'+esc(img)+
      '" data-fallback-url="'+esc(primary?secondary:'')+'" alt="" loading="lazy" decoding="async">':'')+'</span>';
  }
  function sportLeagueBadge(game){
    const art=sportsArtwork.get(game.sportKey);
    const img=safeSportLogo(game.leagueLogo)||safeSportLogo(art?.leagueLogo);
    return (img?'<span class="sport-league-emblem" aria-hidden="true">'+
      '<img class="sport-league-logo" src="'+esc(img)+'" alt="" loading="lazy" decoding="async"></span>':'')+
      '<span>'+esc(sportLeagueName(game))+'</span>';
  }
  document.addEventListener('error',e=>{
    const img=e.target;
    if(!(img instanceof HTMLImageElement))return;
    if(img.matches('.sport-team-crest img')){
      if(img.dataset.fallbackUrl&&!img.dataset.fallbackUsed){
        img.dataset.fallbackUsed='true';img.src=img.dataset.fallbackUrl;return;
      }
      img.remove();return;
    }
    if(img.matches('.sport-league-logo')){
      img.closest('.sport-league-emblem')?.remove();return;
    }
    if(img.matches('.gol-crest-img'))img.remove();
  },true);
  async function fetchSportsArtwork(){
    const leagues=[...new Set([...matches,...liveGames].map(x=>x.sportKey).filter(Boolean))].slice(0,6);
    for(const key of leagues){
      if(sportsArtwork.has(key)||artworkPending.has(key))continue;
      artworkPending.add(key);
      try{
        const data=await remote('artwork',{sportKey:key});
        if(data?.ok&&data?.sportKey===key&&Array.isArray(data.teams)){
          sportsArtwork.set(key,data);
          renderMatch();renderLive();
        }
      }catch(e){ /* Si la base de insignias no responde, se mantienen las iniciales. */ }
      finally{artworkPending.delete(key);}
    }
  }
  async function loadLiveCatalog(){
    if(!CONFIG.appsScriptUrl||liveCatalogLoading)return;
    liveCatalogLoading=true;liveCatalogRequestedAt=Date.now();renderLive();
    try{
      const data=await remote('liveCatalog',{});
      if(['API-Football','The Odds API','Multi-API'].includes(data?.source)&&data?.mode==='API_PREVIEW')
        liveGames=Array.isArray(data.live)?data.live:[];
    }catch(e){liveGames=[];}
    finally{
      liveCatalogLoading=false;
      renderLive();fetchSportsArtwork();
    }
  }

  async function loadSportsWagerPolicy(){
    try{
      const data=await remote('sportsWagerPolicy',sessionToken?{sessionToken}:{});
      sportsWalletEnabled=Boolean(data?.ok&&data.walletEnabled);
    }catch(e){sportsWalletEnabled=false;}
    renderSlips();
  }
  function oddsDetailMarkup(g){
    if(oddsExpandedId!==g.id)return '';
    const key=g.id+'|'+oddsSelectedGroup;
    const data=oddsDetailCache.get(key);
    let output='';
    if(oddsLoading)output='<div class="market-detail-note"><span class="sports-loader" aria-hidden="true"></span> Consultando cuotas…</div>';
    else if(oddsError)output='<div class="market-detail-note">'+esc(oddsError)+'</div>';
    else if(!data||!data.markets?.length)output='<div class="market-detail-note">'+esc(data?.message||'No hay cuotas verificadas de esta categoría para el encuentro y la casa seleccionados.')+'</div>';
    else output=data.markets.map((m,mi)=>{
      const rows=(m.outcomes||[]).map((o,oi)=>{
        const n=String(o.name||'');
        const name=/^over$/i.test(n)?'Más':/^under$/i.test(n)?'Menos':
          /^yes$/i.test(n)?'Sí':/^no$/i.test(n)?'No':/^draw$/i.test(n)?'Empate':n;
        const label=esc(name)+(o.point!==null&&o.point!==undefined?' '+esc(o.point):'');
        const canBet=o.tradable!==false && m.tradable!==false;
        const desc=o.description?'<small>'+esc(o.description)+'</small>':'';
        return '<button type="button" class="market-detail-option" data-market-pick="'+
          esc(g.id)+'" data-market-group="'+esc(oddsSelectedGroup)+
          '" data-market-index="'+mi+'" data-market-outcome="'+oi+
          '" data-market-bookmaker="'+esc(o.bookmakerKey||data.bookmakerKey||g.bookmakerKey||'')+'" '+
          (canBet?'':'disabled title="Cuota informativa: liquidación de este mercado no integrada"')+
          '><div><span>'+label+'</span>'+desc+
          '</div><strong>'+fmt2(o.price)+'</strong></button>';
      }).join('');
      return '<section class="market-detail-market"><header><strong>'+
        esc(m.label)+'</strong></header>'+
        '<div class="market-detail-options">'+rows+'</div></section>';
    }).join('');
    return '<div class="market-detail-panel" role="region" aria-label="Cuotas adicionales del partido">'+
      '<p class="sport-market-heading">Elige una opción y agrégala a tu cupón.</p>'+
      '<div class="market-detail-tabs" role="group" aria-label="Categorías de mercados">'+
      oddsGroups.map(([id,title])=>'<button type="button" data-odds-group="'+id+
        '" data-odds-event="'+esc(g.id)+'" class="'+(id===oddsSelectedGroup?'active':'')+'">'+esc(title)+'</button>').join('')+
      '</div><div class="market-detail-results" aria-live="polite">'+output+'</div></div>';
  }
  async function loadOddsGroup(game){
    const id=game.id,group=oddsSelectedGroup,key=id+'|'+group;
    oddsError='';
    const saved=oddsDetailCache.get(key);
    if(saved){oddsLoading=false;renderMatch();renderLive();return;}
    oddsLoading=true;renderMatch();renderLive();
    try{
      const data=await remote('eventMarkets',{eventId:id,sportKey:game.sportKey,group,bookmakerKey:game.bookmakerKey||''});
      if(!['API-Football','The Odds API','Multi-API'].includes(data?.source)||data?.mode!=='API_PREVIEW'||data?.eventId!==id||data?.group!==group)
        throw new Error('La respuesta del proveedor no coincide con el partido.');
      oddsDetailCache.set(key,data);
    }catch(e){
      if(oddsExpandedId===id&&oddsSelectedGroup===group)
        oddsError='No se pudieron obtener las cuotas. '+String(e.message||'Vuelve a intentarlo.');
    }finally{
      if(oddsExpandedId===id&&oddsSelectedGroup===group){oddsLoading=false;renderMatch();renderLive();}
    }
  }
  function toggleOddsDetails(id){
    const game=allGames().find(x=>x.id===id);
    if(!game)return;
    if(oddsExpandedId===id){oddsExpandedId='';oddsLoading=false;renderMatch();renderLive();return;}
    oddsExpandedId=id;oddsSelectedGroup='goles';oddsLoading=false;oddsError='';
    loadOddsGroup(game);
  }
  function chooseOddsGroup(id,group){
    if(!oddsGroups.some(x=>x[0]===group)||oddsExpandedId!==id)return;
    const game=allGames().find(x=>x.id===id);
    if(!game)return;
    oddsSelectedGroup=group;oddsLoading=false;oddsError='';
    loadOddsGroup(game);
  }

  function marketCard(g,live){
    const selected=draft.slips.find(s=>s.gameId===g.id);
    const schedule=sportSchedule(g.kickoff);
    return `<article class="market-card sport-premium-card ${live?'live-card':''}">
      <div class="market-top"><span class="market-league">${sportLeagueBadge(g)}</span>
      <time class="market-kickoff-chip" datetime="${esc(g.kickoff||'')}">
        <span class="sport-event-date">${live?'EN VIVO':esc(schedule.date)}</span>
        <span class="sport-event-time">${esc(schedule.time)}</span>
      </time></div>
      <div class="market-body sport-match-teams">
        <span class="market-team">${sportCrest(g.home,g.sportKey,g.homeLogo)}<strong>${esc(g.home)}</strong></span>
        <span class="market-middle">VS</span>
        <span class="market-team">${sportCrest(g.away,g.sportKey,g.awayLogo)}<strong>${esc(g.away)}</strong></span>
      </div>
      <div class="market-choices sport-1x2">
      ${outcomes.map((o,i)=>`<button type="button" class="choice ${selected?.outcome===o?'selected':''}"
        data-pick="${esc(g.id)}" data-outcome="${o}"
        aria-label="Elegir ${esc(outcomeName[i])} para ${esc(g.home)} contra ${esc(g.away)}">
        <small>${o}</small><b>${Number(g.odds?.[i])>1?fmt2(g.odds[i]):'—'}</b></button>`).join('')}</div>
      ${`<button type="button" class="market-detail-trigger" data-odds-details="${esc(g.id)}"
        aria-expanded="${oddsExpandedId===g.id?'true':'false'}">
        <span class="sport-more-label">${oddsExpandedId===g.id?'Ocultar':'Ver más'}</span>
        ${icon('arrow')}
      </button>${oddsDetailMarkup(g)}`}</article>`;
  }
  function addSportsSelection(g,selection){
    const isSame=draft.slips.some(s=>s.gameId===g.id&&s.selectionId===selection.selectionId);
    draft.slips=draft.slips.filter(s=>s.gameId!==g.id);
    if(!isSame){
      draft.slips.push({gameId:g.id,selectionId:selection.selectionId,
        outcome:selection.outcome,odd:selection.odd,
        marketLabel:selection.marketLabel,selectionLabel:selection.selectionLabel,
        sportKey:g.sportKey,bookmakerKey:selection.bookmakerKey||g.bookmakerKey||'',group:selection.group||'',
        home:g.home,away:g.away,isLive:liveGames.some(x=>x.id===g.id)});
    }
    sportSimReceipt='';
    delete draft.sportsDemoRequestId;delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
    saveDraft();renderMatch();renderLive();
  }
  function changeSelection(id,outcome){
    const g=allGames().find(x=>x.id===id);
    if(!g||!outcomes.includes(outcome))return;
    const price=Number(g.odds?.[outcomes.indexOf(outcome)]);
    if(!Number.isFinite(price)||price<=1)return;
    addSportsSelection(g,{selectionId:'h2h-'+outcome,outcome,odd:price,
      marketLabel:'Resultado final',selectionLabel:outcomeName[outcomes.indexOf(outcome)]});
  }
  function changeDetailSelection(gameId,group,marketIndex,outcomeIndex){
    const g=allGames().find(x=>x.id===gameId);
    const data=oddsDetailCache.get(gameId+'|'+group);
    const market=data?.markets?.[marketIndex],choice=market?.outcomes?.[outcomeIndex];
    if(!g||!market||!choice||choice.tradable===false||market.tradable===false||
       !Number.isFinite(Number(choice.price)))return;
    const label=String(choice.name||'')+
      (choice.point!==null&&choice.point!==undefined?' '+choice.point:'')+
      (choice.description?' · '+choice.description:'');
    addSportsSelection(g,{selectionId:choice.selectionId||market.key+'|'+label,
      outcome:market.key,odd:Number(choice.price),
      marketLabel:market.label,selectionLabel:label,group,
      bookmakerKey:choice.bookmakerKey||data.bookmakerKey||g.bookmakerKey||''});
  }
  const combinedOdds=()=>draft.slips.reduce((p,s)=>p*Number(s.odd||1),1);
  function syncMobileSportsSlip(){
    const count=draft.slips.length,active=['match','live'].includes(activeView);
    const bar=$('#mobileSlipBar'),backdrop=$('#mobileSlipBackdrop');
    if(!bar||!backdrop)return;
    const show=active&&count>0;
    if(!show)mobileSlipOpen=false;
    bar.hidden=!show||mobileSlipOpen;
    backdrop.hidden=!show||!mobileSlipOpen;
    document.body.classList.toggle('sports-slip-open',Boolean(show&&mobileSlipOpen));
    const title=$('#mobileSlipCount'),odd=$('#mobileSlipOdds'),detail=$('#mobileSlipDetail');
    if(title)title.textContent=count+' '+(count===1?'selección':'selecciones');
    if(odd)odd.textContent=fmt2(combinedOdds());
    if(detail)detail.textContent='Cuota combinada';
    $('#mobileSlipOpen')?.setAttribute('aria-expanded',String(Boolean(show&&mobileSlipOpen)));
  }
  function openMobileSportsSlip(){
    if(!['match','live'].includes(activeView)||!draft.slips.length)return;
    mobileSlipOpen=true;syncMobileSportsSlip();
    const panel=$('#'+(activeView==='match'?'matchBetslip':'liveBetslip'));
    panel?.querySelector('[data-sports-slip-close]')?.focus({preventScroll:true});
  }
  function closeMobileSportsSlip(){
    mobileSlipOpen=false;syncMobileSportsSlip();
    if(window.matchMedia('(max-width:959px)').matches)$('#mobileSlipOpen')?.focus({preventScroll:true});
  }
  /* Premium Live: la cotización, aceptación, débito y liquidación se calculan
   * en el backend. El navegador presenta sólo los saldos PEN confirmados.
   */
  const betMode=()=>sportsWalletEnabled?'wallet':'preview';
  const isMoneyMode=()=>true;
  const betCap=()=>500;
  const slipMoney=value=>'S/ '+fmt2(value);
  let sportsWalletMenuOpen=false;
  function renderSlips(){
    const mode=betMode(),money=isMoneyMode(mode),cap=betCap(mode);
    const count=draft.slips.length;
    const validStake=Number.isInteger(stake)&&stake>=1&&stake<=cap;
    const total=validStake?stake*combinedOdds():0;
    const items=count?draft.slips.map(s=>`<div class="betslip-item">
    <div class="slip-team">${esc(s.home)} · ${esc(s.away)}</div>
    <div class="slip-detail"><span><b class="slip-market-label">${esc(s.marketLabel||'Resultado final')}</b>
      ${esc(s.selectionLabel||s.outcome||'')}</span>
      <b>${fmt2(s.odd)}</b>
      <button type="button" data-remove="${esc(s.selectionId)}" data-remove-game="${esc(s.gameId)}"
        aria-label="Quitar selección">${icon('close')}</button></div></div>`).join(''):'';
    const walletLabel=sportsWalletSource==='bonos'?'Saldo de bonos':'Saldo principal';
    const balance=money?`<div class="sports-wallet-picker">
      <span class="sports-wallet-label">Pagar con</span>
      <div class="sports-wallet-combobox">
        <button type="button" class="sports-wallet-trigger" data-wallet-toggle
          aria-expanded="${sportsWalletMenuOpen}" aria-label="Elegir saldo para pagar">
          <span>${esc(walletLabel)}</span><span class="sports-wallet-chevron" aria-hidden="true">⌄</span>
        </button>
        <div class="sports-wallet-menu" ${sportsWalletMenuOpen?'':'hidden'}>
          <button type="button" data-wallet-choice="principal" class="${sportsWalletSource==='principal'?'selected':''}">
            Saldo principal ${sportsWalletSource==='principal'?'✓':''}</button>
          <button type="button" data-wallet-choice="bonos" class="${sportsWalletSource==='bonos'?'selected':''}"
            ${hasUser()&&bonusAvailablePEN<=0?'disabled':''}>
            Saldo de bonos ${sportsWalletSource==='bonos'?'✓':''}</button>
        </div>
      </div>
    </div>`:'';
    const currency='S/';
    const footer=count?`<div class="betslip-footer">
    ${balance}
    <label for="betStake">${money?'Importe de la apuesta (S/)':'Monto (créditos)'}</label>
    <div class="stake-entry"><input id="betStake" type="text" inputmode="numeric"
      pattern="[0-9]*" maxlength="4" autocomplete="off" value="${esc(stake)}"
      aria-label="Importe en soles" aria-describedby="betStakeHelp"><span>${currency}</span></div>
    <small id="betStakeHelp" class="stake-help">Ingresa el importe con el teclado.</small>
    <div class="slip-total"><span>Cuota combinada</span><b>${fmt2(combinedOdds())}</b></div>
    <div class="slip-total"><span>${money?'Retorno posible':'Posible ganancia'}</span>
      <b id="slipReturn">${slipMoney(total)}</b></div>
    <button id="placeBet" type="button" class="btn btn-gold btn-full"
      ${!validStake||mode==='preview'?'disabled':''}>Colocar apuesta ${icon('arrow')}</button>
    ${mode==='preview'?'<p class="slip-unavailable" role="status">La confirmación de apuestas aún no está habilitada en el servidor.</p>':''}
    <button id="refreshSportsQuote" type="button" class="sports-quote-refresh"><span aria-hidden="true">↻</span> Actualizar cuotas</button>
    <p class="slip-note">Las cuotas pueden cambiar mientras se procesa la jugada.</p>
  </div>`:`<div class="betslip-empty">${icon('ticket')}
    <strong>Tu jugada comienza aquí</strong><p>Elige una cuota para agregarla al cupón.</p></div>`;
    const receipt='';
    const content=`<div class="betslip">
    <div class="betslip-head"><h3>Mi cupón <span>${count}</span></h3>
      <div class="betslip-head-actions">${count?'<button id="clearBetslip" type="button">Vaciar cupón</button>':''}
      <button type="button" class="sports-slip-close" data-sports-slip-close aria-label="Cerrar cupón">Cerrar ×</button></div></div>
    ${items}${footer}${receipt}</div>`;
    $('#matchBetslip').innerHTML=content;
    $('#liveBetslip').innerHTML=content.replaceAll('id="betStake"','id="betStakeLive"')
      .replaceAll('for="betStake"','for="betStakeLive"')
      .replaceAll('id="slipReturn"','id="slipReturnLive"')
      .replaceAll('id="placeBet"','id="placeBetLive"')
      .replaceAll('id="refreshSportsQuote"','id="refreshSportsQuoteLive"')
      .replaceAll('id="clearBetslip"','id="clearBetslipLive"')
      .replaceAll('id="betStakeHelp"','id="betStakeHelpLive"')
      .replaceAll('aria-describedby="betStakeHelp"','aria-describedby="betStakeHelpLive"');
    syncMobileSportsSlip();
  }
  /** Punto de entrada del botón "Colocar apuesta / jugada". */
  async function placeBet(){
    if(sendingPlay)return;
    if(!draft.slips.length){toast('Selecciona una cuota.');return;}
    if(!hasUser()&&sessionToken){
      setAuthBusy(true,'Restaurando tu sesión…','general');
      try{await refreshAccount();}finally{setAuthBusy(false);}
    }
    if(!hasUser()){
      pendingAfterAuth='bet';openAuth('login');
      toast('Ingresa o regístrate para colocar tu apuesta.');return;
    }
    // El servidor decide si existe autorización para aceptar saldos monetarios.
    await loadSportsWagerPolicy();
    const mode=betMode(),cap=betCap(mode);
    if(!Number.isInteger(stake)||stake<1||stake>cap){
      toast('Ingresa un importe válido entre 1 y '+cap+'.');return;
    }
    if(mode==='preview'||(mode==='wallet'&&!sportsWalletEnabled)){
      toast('Premium Live está en vista previa; aún no se aceptan cupones con saldo.');return;
    }
    return placeMoneyBet('wallet');
  }
  async function refreshSportsQuote(){
    if(!draft.slips.length||sendingPlay)return;
    setAuthBusy(true,'Actualizando cuotas del cupón…','general');
    try{
      const result=await remote('sportsQuote',{selections:draft.slips.map(s=>({
        gameId:s.gameId,sportKey:s.sportKey,selectionId:s.selectionId,bookmakerKey:s.bookmakerKey||''}))});
      if(!result?.ok||!Array.isArray(result.picks)||result.picks.length!==draft.slips.length)
        throw new Error('No se pudo verificar todo el cupón.');
      let changed=false;
      draft.slips=draft.slips.map((item,i)=>{
        const quote=result.picks[i];
        if(quote.gameId!==item.gameId||quote.selectionId!==item.selectionId)
          throw new Error('El partido cambió. Vuelve a seleccionar tu pronóstico.');
        if(Math.abs(Number(quote.odd)-Number(item.odd))>0.001)changed=true;
        return {...item,odd:Number(quote.odd)};
      });
      delete draft.sportsWalletRequestId;saveDraft();renderMatch();renderLive();
      toast(changed?'Las cuotas se actualizaron. Revísalas antes de confirmar.':'Cuotas verificadas.');
    }catch(err){toast(err.message||'No se pudo actualizar el cupón.');}
    finally{setAuthBusy(false);}
  }
  /** Apuesta con saldo (principal / bonos): el servidor valida cuotas, descuenta en
   *  Google Sheets, impide saldo negativo y devuelve el saldo oficial. */
  async function placeMoneyBet(mode){
    if(mode==='wallet'&&!sportsWalletEnabled){
      toast('Las jugadas con saldo todavía no están habilitadas.');return;
    }
    if(draft.slips.length>4){toast('Selecciona entre uno y cuatro partidos.');return;}
    if(sportsWalletSource==='bonos'&&bonusAvailablePEN<=0){
      toast('Primero activa tus bonos con una recarga aprobada.');return;
    }
    // Comprobación rápida en pantalla; la validación definitiva es la del servidor.
    const available=sportsWalletSource==='principal'?paidBalancePEN:bonusAvailablePEN;
    if(Math.round(available*100)<Math.round(stake*100)){
      toast('Saldo insuficiente. Puedes hacer una recarga en Mi cuenta.');
      accountTab='wallet';showView('account');return;
    }
    const action='placeWalletBet';
    const requestKey='sportsWalletRequestId';
    sendingPlay=true;
    draft[requestKey]=draft[requestKey]||randomId();saveDraft();
    setAuthBusy(true,'Registrando tu apuesta…','general');
    try{
      const res=await remote(action,{
        sessionToken,stake,walletSource:sportsWalletSource,
        clientRequestId:draft[requestKey],
        selections:draft.slips.map(leg=>({
          gameId:leg.gameId,sportKey:leg.sportKey,selectionId:leg.selectionId,bookmakerKey:leg.bookmakerKey||'',
          group:leg.group,expectedOdd:Number(leg.odd)
        }))
      });
      const accepted=res?.walletBetAccepted;
      if(!res?.ok||!accepted)throw new Error('No se confirmó el cupón.');
      const ticket=String(res.walletBetId||draft[requestKey]);
      const amount=Number(res.walletBetStakePEN??stake);
      const placedLegs=draft.slips.map(leg=>({...leg}));
      const placedOdds=Number(res.walletBetCombinedOdds)||combinedOdds();
      const usedWallet=sportsWalletSource;
      draft.slips=[];delete draft[requestKey];saveDraft();
      // Saldo OFICIAL devuelto por el servidor (ya descontado en Google Sheets).
      updateAccount(res);
      renderSlips();
      showSportsPlayDialog({
        id:ticket,createdAt:new Date().toISOString(),stake:amount,
        walletSource:usedWallet,combinedOdds:placedOdds,
        possibleReturn:Number(res.walletBetPotentialReturnPEN)||Math.round(amount*placedOdds*100)/100,
        selections:Array.isArray(res.walletBetPicks)?res.walletBetPicks.map(p=>({home:p.home,away:p.away,odd:p.odd,marketLabel:p.market,selectionLabel:p.outcome})):placedLegs
      });
    }catch(err){
      const message=String(err?.message||'');
      if(/saldo (principal|de bonos) insuficiente/i.test(message)){
        showInsufficientFunds();
        // Resincroniza la pantalla con el saldo oficial del servidor.
        lastSessionVerification=0;
        refreshAccount().catch(()=>{});
      }else{toast(message||'No se pudo registrar el cupón.');
        if(/cuota cambió|desactualizada/i.test(message))refreshSportsQuote();}
    }finally{sendingPlay=false;setAuthBusy(false);}
  }
  function updateAccount(result){
    if(result.user)account=result.user;
    if(Number.isSafeInteger(Number(result.referralCount)))referralsJoined=Number(result.referralCount);
    if(Array.isArray(result.referrals))referralActivity=result.referrals;
    if(Number.isFinite(Number(result.bonusBalancePEN)))bonusBalancePEN=Number(result.bonusBalancePEN);
    if(Number.isFinite(Number(result.bonusAvailablePEN)))bonusAvailablePEN=Number(result.bonusAvailablePEN);
    if(Number.isFinite(Number(result.bonusPendingPEN)))bonusPendingPEN=Number(result.bonusPendingPEN);
    if(typeof result.bonusUnlocked==='boolean')bonusUnlocked=result.bonusUnlocked;
    if(Array.isArray(result.bonusStatement))bonusStatement=result.bonusStatement;
    if(typeof result.walletWagersEnabled==='boolean')walletWagersEnabled=result.walletWagersEnabled;
    if(Number.isFinite(Number(result.balance)))accountBalance=Number(result.balance);
    if(Number.isFinite(Number(result.paidBalancePEN)))paidBalancePEN=Number(result.paidBalancePEN);
    if(Array.isArray(result.history))playHistory=result.history;
    if(result.golSlots&&typeof result.golSlots==='object'){golLocked=result.golSlots;for(const slot of SLOTS){if(golLocked[slot]?.picks){draft.golCards[slot]=Object.fromEntries(golLocked[slot].picks.map(p=>[p.id,p.outcome]));}}saveDraft();}
    if(typeof result.couponClaimed==='boolean')couponClaimed=result.couponClaimed;
    renderAll();
  }
  function renderHeader(){
    const restoring=Boolean(sessionToken)&&sessionRestoring&&!hasUser();
    const reconnect=Boolean(sessionToken)&&sessionRestoreFailed&&!hasUser();
    const login=$('#loginTop');
    login.classList.toggle('is-restoring',restoring);
    login.classList.toggle('is-reconnect',reconnect);
    login.disabled=restoring;
    login.setAttribute('aria-busy',String(restoring));
    login.setAttribute('aria-label',restoring?'Restaurando tu sesión':
      reconnect?'Reintentar conexión a tu cuenta':
      hasUser()?'Abrir menú de Mi cuenta':'Ingresar o registrarse');
    login.title=restoring?'Restaurando tu sesión…':
      reconnect?'Reconectar con tu cuenta':'Ingresar o registrarse';
    $('[data-nav="account"]')?.classList.toggle('is-restoring',restoring);
    $('[data-nav="account"]')?.setAttribute('aria-busy',String(restoring));
    $('#walletTop').hidden=!hasUser();
    $('#topBalance').textContent='S/ '+fmt2(paidBalancePEN+bonusBalancePEN);
    $('#walletMainBalance').textContent='S/ '+fmt2(paidBalancePEN);
    $('#walletBonusBalance').textContent='S/ '+fmt2(bonusBalancePEN);
    $('#walletBonusAvailable').textContent='S/ '+fmt2(bonusAvailablePEN);
    $('#walletBonusPending').textContent='S/ '+fmt2(bonusPendingPEN);
    $('#walletBonusCondition').hidden=bonusPendingPEN<=0;
    $('#walletBonusCondition').textContent='S/ '+fmt2(bonusPendingPEN)+' en bonos pendientes: se activan con tu próxima recarga aprobada.';
    $('#walletTotalBalance').textContent='S/ '+fmt2(paidBalancePEN+bonusBalancePEN);
    $('#loginTopLabel').textContent=restoring?'Cargando…':
      reconnect?'Reconectar':hasUser()?'Mi cuenta':'Ingresar';
    $('#loginTop').setAttribute('aria-haspopup',hasUser()?'menu':'false');
    $('[data-nav="account"]')?.setAttribute('aria-haspopup',hasUser()?'menu':'false');
    $('#loginTop').setAttribute('aria-expanded',String(hasUser()&&accountMenuOpen));
    $('#registerTop').hidden=hasUser()||restoring||reconnect;
  }
  function chosenTopup(){
    const n=topupSelection==='custom'?Number(topupCustom):Number(topupSelection);
    return Number.isFinite(n)&&n>=5&&n<=10000&&Math.round(n*100)===n*100?n:null;
  }
  function renderTopup(){
    document.querySelectorAll('[data-topup-amount]').forEach(el=>{
      const active=el.dataset.topupAmount===topupSelection;
      el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));
    });
    $('#rechargeOtherWrap').hidden=topupSelection!=='custom';
    if(document.activeElement!==$('#rechargeOther'))$('#rechargeOther').value=topupCustom;
    const amount=chosenTopup();
    $('#rechargeSelected').textContent=amount===null?'Importe no válido':'S/ '+fmt2(amount);
    $('#rechargeGenerate').disabled=amount===null||topupBusy;
  }

  /** Libro principal y libro de bonos son balances monetarios separados. */
  const mpSafeUrl=value=>{
    try{
      const u=new URL(value);
      return u.protocol==='https:'&&
        ['mercadopago.com.pe','mercadopago.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))
        ?u.href:'';
    }catch{return '';}
  };
  const paymentLabels={EXPIRED:'Orden vencida',APPROVED:'Pago aprobado',PENDING:'Pendiente de pago',PENDIENTE:'Pendiente de pago',
    IN_PROCESS:'Pago en proceso',REJECTED:'Pago rechazado',CANCELLED:'Pago cancelado',
    REFUNDED:'Pago devuelto',CHARGED_BACK:'Contracargo'};
  function paymentStatusLabel(status){
    return paymentLabels[String(status)]||'Pendiente de verificación';
  }
  function renderTopupOrder(order,returning=false){
    const box=$('#rechargeOrder');
    if(!box||!order)return;
    box.hidden=false;
    const paid=order.status==='APPROVED';
    const url=!paid?mpSafeUrl(order.checkoutUrl):'';
    const detail=paid?'El pago está verificado y registrado en tu saldo monetario.':
      order.status==='EXPIRED'?'La orden venció a las 48 horas. Genera una nueva si deseas recargar.':
      returning?'El pago aún no aparece aprobado. Puedes volver a consultar más tarde.':
      'Tu orden está registrada. Continúa al checkout para escoger cómo pagar.';
    const until=new Date(order.expiresAt||'');
    const untilLabel=Number.isFinite(until.getTime())?
      new Intl.DateTimeFormat('es-PE',{
        timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',
        hour:'numeric',minute:'2-digit',hour12:true
      }).format(until):'';
    const expiresNote=untilLabel&&['PENDING','EXPIRED','IN_PROCESS'].includes(order.status)?
      '<p class="recharge-order-small">Vigencia de la orden: '+esc(untilLabel)+'</p>':'';
    box.innerHTML='<div class="recharge-order-head"><span class="recharge-order-icon">'+icon('wallet')+
      '</span><div><strong>'+esc(paymentStatusLabel(order.status))+
      '</strong><span>Orden de recarga</span></div></div><div class="recharge-order-data">'+
      '<span class="recharge-order-badge">S/ '+fmt2(order.amount)+'</span>'+
      '<span class="recharge-order-badge is-pending">'+esc(String(order.status))+
      '</span></div><p class="recharge-order-small">'+detail+'</p>'+expiresNote+
      (url?'<button type="button" class="btn btn-gold btn-full" data-mp-pay="'+esc(url)+
      '" data-mp-order="'+esc(String(order.orderId||''))+'">Pagar</button>':'');
  }
  function renderTopupHistory(){
    const holder=$('#topupHistory');
    if(!holder)return;
    // Se ocultan las pendientes a las 48 h incluso si la pestaña sigue abierta.
    // Pagos confirmados, reembolsos y errores permanecen disponibles.
    const displayOrders=recentTopupOrders.filter(o=>{
      if(!['PENDING','PENDIENTE','IN_PROCESS','CREATING','EXPIRED'].includes(String(o.status)))return true;
      if(o.status==='EXPIRED')return false;
      const date=new Date(o.createdAt).getTime();
      return Number.isFinite(date)&&Date.now()-date<48*3600000;
    });
    holder.innerHTML=displayOrders.length?displayOrders.map((o,i)=>{
      const url=o.status==='APPROVED'?'':mpSafeUrl(o.checkoutUrl);
      const id=String(o.orderId||'');
      const created=new Date(o.createdAt);
      const dateLabel=Number.isFinite(created.getTime())
        ?new Intl.DateTimeFormat('es-PE',{
          timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',
          hour:'numeric',minute:'2-digit',hour12:true
        }).format(created)
        :'Fecha no disponible';
      return '<div class="topup-history-item"><div class="topup-history-details">'+
        '<strong>S/ '+fmt2(o.amount)+'</strong>'+
        (i===0?'<small class="topup-history-latest">Más reciente</small>':'')+
        '<time class="topup-history-date"'+
        (Number.isFinite(created.getTime())?' datetime="'+esc(created.toISOString())+'"':'')+
        '>Generada: '+esc(dateLabel)+'</time>'+
        '<span class="topup-history-status">'+esc(paymentStatusLabel(o.status))+
        '</span></div><div class="topup-history-actions">'+
        '<button type="button" data-topup-check="'+esc(id)+
        '" class="btn btn-outline btn-mini">Verificar</button>'+
        (url?'<button type="button" data-mp-pay="'+esc(url)+
        '" data-mp-order="'+esc(id)+'" class="btn btn-outline btn-mini">Pagar</button>':'')+
        '</div></div>';
    }).join(''):'<p class="recharge-order-small">Aún no tienes recargas registradas.</p>';
  }
  async function loadTopupOrders(){
    if(!hasUser())return;
    try{
      const data=await remote('listTopupOrders',{sessionToken});
      if(Array.isArray(data.orders))recentTopupOrders=data.orders;
      if(Number.isFinite(Number(data.paidBalancePEN)))paidBalancePEN=Number(data.paidBalancePEN);
      if(Number.isFinite(Number(data.bonusBalancePEN)))bonusBalancePEN=Number(data.bonusBalancePEN);
      if(Number.isFinite(Number(data.bonusAvailablePEN)))bonusAvailablePEN=Number(data.bonusAvailablePEN);
      if(Number.isFinite(Number(data.bonusPendingPEN)))bonusPendingPEN=Number(data.bonusPendingPEN);
      if(typeof data.bonusUnlocked==='boolean')bonusUnlocked=data.bonusUnlocked;
      $('#paidBalancePEN').textContent='S/ '+fmt2(paidBalancePEN);
      renderHeader();
      $('#accountBalance').textContent='S/ '+fmt2(paidBalancePEN);
      renderTopupHistory();
    }catch(err){console.warn('No se pudo actualizar el historial de recargas.');}
  }
  async function checkTopupOrder(id,returning=false){
    if(!sessionToken||!/^[A-Z0-9-]{10,90}$/i.test(id))return;
    const box=$('#rechargeOrder');box.hidden=false;
    box.textContent='Verificando el pago con Mercado Pago…';
    setAuthBusy(true,'Verificando el pago…','general');
    try{
      const result=await remote('getTopupStatus',{sessionToken,orderId:id});
      paidBalancePEN=Number(result.paidBalancePEN||0);
      if(Number.isFinite(Number(result.bonusBalancePEN)))bonusBalancePEN=Number(result.bonusBalancePEN);
      if(Number.isFinite(Number(result.bonusAvailablePEN)))bonusAvailablePEN=Number(result.bonusAvailablePEN);
      if(Number.isFinite(Number(result.bonusPendingPEN)))bonusPendingPEN=Number(result.bonusPendingPEN);
      if(typeof result.bonusUnlocked==='boolean')bonusUnlocked=result.bonusUnlocked;
      $('#paidBalancePEN').textContent='S/ '+fmt2(paidBalancePEN);
      renderHeader();
      $('#accountBalance').textContent='S/ '+fmt2(paidBalancePEN);
      renderTopupOrder(result,returning);
      await loadTopupOrders();
      if(String(result.status).toUpperCase()==='APPROVED')await refreshAccount();
    }catch(err){box.textContent=err?.message||'No se pudo verificar tu recarga.';}
    finally{setAuthBusy(false);}
  }
  // Preserva el destino del usuario incluso si Mercado Pago vuelve a la raíz.
  const MP_RETURN_KEY='premiumgol_checkout_return_v1';
  function rememberMpCheckout(orderId){
    if(!/^[A-Z0-9-]{10,90}$/i.test(String(orderId||'')))return;
    try{sessionStorage.setItem(MP_RETURN_KEY,JSON.stringify({orderId,at:Date.now()}));}catch{}
  }
  function storedMpCheckout(){
    try{
      const data=JSON.parse(sessionStorage.getItem(MP_RETURN_KEY)||'null');
      if(data&&/^[A-Z0-9-]{10,90}$/i.test(String(data.orderId||''))&&
        Date.now()-Number(data.at)>=0&&Date.now()-Number(data.at)<2*60*60*1000)
        return String(data.orderId);
      sessionStorage.removeItem(MP_RETURN_KEY);
    }catch{}
    return '';
  }
  let mpReturnChecking=false;
  async function checkMpReturn(){
    if(mpReturnChecking)return;
    const query=new URLSearchParams(location.search);
    const fromMp=query.get('mp_return')==='1';
    const requestedId=fromMp?query.get('order')||'':'';
    const savedId=storedMpCheckout();
    const id=/^[A-Z0-9-]{10,90}$/i.test(requestedId)?requestedId:savedId;
    if(!fromMp&&!savedId)return;
    accountTab='wallet';
    if(!hasUser()){showView('account');return;}
    showView('account');
    mpReturnChecking=true;
    try{
      if(id)await checkTopupOrder(id,true);
      else await loadTopupOrders();
    }finally{
      mpReturnChecking=false;
      try{sessionStorage.removeItem(MP_RETURN_KEY);}catch{}
      query.delete('mp_return');query.delete('order');
      const qs=query.toString();
      history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+'#account');
    }
  }
  async function createTopupRequest(){
    if(!hasUser()){openAuth('login');return;}
    const amount=chosenTopup();
    if(amount===null){toast('Ingresa un importe válido entre S/ 5 y S/ 10,000.');return;}
    if(topupBusy)return;
    topupBusy=true;renderTopup();
    setAuthBusy(true,'Preparando tu orden…','general');
    topupRequestId=topupRequestId||randomId();
    try{
      const order=await remote('createTopupRequest',{sessionToken,
        amount,clientRequestId:topupRequestId});
      const link=mpSafeUrl(order.checkoutUrl);
      if(!link&&order.status!=='APPROVED')throw new Error('Mercado Pago todavía no devolvió un enlace válido.');
      renderTopupOrder(order);
      topupRequestId=null;
      await loadTopupOrders();
      toast('Orden de pago generada.');
    }catch(err){
      if(/orden venció|orden fue creada en pruebas/i.test(String(err?.message||'')))topupRequestId=null;
      toast(err?.message||'No se pudo generar la orden.');
    }
    finally{topupBusy=false;setAuthBusy(false);renderTopup();}
  }
  function playResultLabel(status){
    return ({ACIERTO_12:'12 aciertos · Pozo mayor',ACIERTO_11:'11 aciertos · Pozo menor',ACIERTO_10:'10 aciertos · Premio S/ 5',GANADOR:'12 aciertos',SIN_PREMIO:'Sin premio',PENDIENTE:'Pendiente'})[status]||'Pendiente';
  }
  function showPlayDetails(id){
    const ticket=playHistory.find(h=>String(h.id)===String(id)&&h.type==='gol');
    if(!ticket)return;
    const dlg=$('#playDetailsDialog');
    const created=new Date(ticket.at);
    const when=Number.isFinite(created.getTime())?
      new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',day:'2-digit',
        month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true})
        .format(created):'Fecha no disponible';
    const code=String(ticket.code||('PG-'+String(ticket.id).slice(-10).toUpperCase()));
    const byId=new Map(golGames.map((g,i)=>[g.id,{...g,idx:i+1}]));
    const rows=(Array.isArray(ticket.picks)?ticket.picks:[]).map((p,i)=>{
      const game=byId.get(p.id),resultIndex=outcomes.indexOf(p.outcome);
      if(resultIndex<0)return '';
      const number=game?.idx||i+1;
      const teams=game?game.home+' · '+game.away:'Partido '+String(p.id||number);
      return '<div class="play-prediction-row"><span class="play-prediction-number">'+
        String(number).padStart(2,'0')+'</span><span class="play-prediction-teams">'+
        esc(teams)+'</span><strong>'+
        esc(golLabel[resultIndex])+' · '+esc(outcomeName[resultIndex])+'</strong></div>';
    }).join('');
    $('#playDetailsTitle').textContent='Ticket '+code;
    $('#playDetailsBody').innerHTML='<div class="play-ticket-meta">'+
      '<div><span>Código</span><b>'+esc(code)+'</b></div>'+
      '<div><span>Costo</span><b>S/ '+fmt2(ticket.stake)+'</b></div>'+
      '<div><span>Fecha y hora</span><b>'+esc(when)+'</b></div>'+ 
      '<div><span>Resultado</span><b>'+esc(playResultLabel(ticket.resultStatus))+'</b></div>'+ 
      (Number.isInteger(ticket.hits)?'<div><span>Aciertos</span><b>'+ticket.hits+' de 12</b></div>':'')+
      (ticket.prizeCredited?'<div><span>Premio acreditado</span><b>S/ '+fmt2(ticket.prizePEN)+'</b></div>':'')+
      '</div>'+
      '<h3 class="play-ticket-subtitle">Pronósticos seleccionados</h3>'+
      (rows||'<p class="profile-info">Pronósticos no disponibles.</p>');
    if(!dlg.open)dlg.showModal();
  }
  function renderAccount(){
    const name=[account?.firstName,account?.lastName].filter(Boolean).join(' ')||'Usuario';
    $('#profileName').textContent=name;
    $('#avatarInitialText').textContent=name.slice(0,1).toUpperCase();
    const img=$('#avatarPhoto');
    const photo=String(account?.avatarUrl||'');
    const photoValid=/^https:\/\/(?:lh\d+|[a-z0-9-]+)\.googleusercontent\.com\//i.test(photo);
    img.hidden=!photoValid;
    if(photoValid&&img.src!==photo)img.src=photo;
    if(!photoValid)img.removeAttribute('src');
    $('#profileSubtitle').textContent=account?.email||'Mi cuenta';
    $('#welcomeName').textContent=account?`¡Hola, ${account.firstName||'jugador'}!`:'¡El partido te espera!';
    $('#accountBalance').textContent='S/ '+fmt2(paidBalancePEN);
    $('#paidBalancePEN').textContent='S/ '+fmt2(paidBalancePEN);
    $('#referralBonusBalance').textContent='S/ '+fmt2(bonusBalancePEN);
    $('#bonusStatementBalance').textContent='S/ '+fmt2(bonusBalancePEN);
    $('#bonusStatementEligibility').textContent='Disponibles para jugar: S/ '+fmt2(bonusAvailablePEN)+
      ' · Pendientes de próxima recarga: S/ '+fmt2(bonusPendingPEN)+'.';
    $('#totalPlays').textContent=playHistory.length;
    $('#totalGolPlays').textContent=playHistory.filter(h=>h.type==='gol').length;
    const when=value=>{
      const d=new Date(value);
      return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-PE',{
        timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',
        hour:'numeric',minute:'2-digit',hour12:true
      }).format(d):'Fecha no disponible';
    };
    const one=h=>{
      const isGol=h.type==='gol';
      const isSports=h.type==='sports';
      const code=isGol?String(h.code||('PG-'+String(h.id||'').slice(-10).toUpperCase())):String(h.id||'');
      const title=isGol?'PremiumGol · '+code:(isSports?'Apuesta deportiva · '+code:String(h.title||'Jugada'));
      const detailsBtn=isGol
        ?'<button type="button" class="btn btn-outline btn-mini" data-play-details="'+esc(h.id)+'">Ver detalles</button>'
        :(isSports?'<button type="button" class="btn btn-outline btn-mini" data-sports-play-details="'+esc(h.id)+'">Ver detalles</button>':'');
      return '<article class="history-row"><span class="history-icon">'+icon(isGol?'trophy':'ticket')+
        '</span><div class="history-row-main"><b>'+esc(title)+'</b><span>'+esc('PEN '+fmt2(Number(h.stake)||0))+
        '</span><time>'+esc(when(h.at))+'</time></div>'+
        '<span class="history-row-status">'+esc(isGol?playResultLabel(h.resultStatus):'REGISTRADA')+'</span>'+detailsBtn+
        '</article>';
    };
    const empty=`<div class="empty-state">${icon('ticket')}Aún no tienes jugadas registradas.</div>`;
    const mergedPlays=playHistory;
    $('#recentHistory').innerHTML=mergedPlays.length?mergedPlays.slice(0,4).map(one).join(''):empty;
    $('#fullHistory').innerHTML=mergedPlays.length?mergedPlays.map(one).join(''):empty;
    $('#profileFirst').value=account?.firstName||'';
    $('#profileLast').value=account?.lastName||'';
    $('#profileEmail').value=account?.email||'';
    $('#profileCountry').value=account?.countryCode||'+51';
    $('#profilePhone').value=account?.phone||'';
    $('#profileDocType').value=account?.docType||'';
    $('#profileDocNumber').value=account?.docNumber||'';
    renderTopup();
    const code=String(account?.inviteCode||'');
    const validCode=/^[A-Z0-9]{10,16}$/.test(code);
    const link=validCode?'https://premiumgol.website/?ref='+encodeURIComponent(code):'';
    $('#referralLink').value=link||'Disponible al actualizar tu cuenta';
    $('#copyReferral').disabled=!validCode;
    $('#referralCount').textContent=validCode?
      referralsJoined+' amigo(s) registrados con tu enlace':
      'Tu invitación estará disponible después de actualizar tu cuenta';
    $('#referralActivity').innerHTML=referralActivity.length?referralActivity.map(r=>{
      const d=new Date(r.joinedAt);
      const date=Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-PE',{
        timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'
      }).format(d):'Fecha no disponible';
      const verified=Boolean(r.firstTopupVerified),awarded=Boolean(r.bonusAwarded);
      const status=verified?'Recarga verificada':'Registro confirmado';
      return '<div class="referral-activity-item">'+
        '<div class="referral-activity-user"><small>Amigo invitado</small><strong>'+esc(r.label||'Invitado')+'</strong></div>'+
        '<div class="referral-activity-state"><small>Estado</small><span>'+esc(status)+'</span></div>'+
        '<div class="referral-activity-date"><small>Registro</small><time>'+esc(date)+'</time></div>'+
        '<div class="referral-activity-amount"><small>Bono recibido</small><b>'+(awarded?'+ S/ '+fmt2(Number(r.bonusAwardedPEN)||0):'S/ 0.00')+'</b></div>'+
        '</div>';
    }).join(''):'<p class="referral-detail">Aún no tienes amigos registrados con tu enlace.</p>';
    $('#bonusStatementList').innerHTML=bonusStatement.length?bonusStatement.map(event=>{
      const amount=Number(event.amountPEN)||0;
      const raw=new Date(event.createdAt);
      const date=Number.isFinite(raw.getTime())?
        new Intl.DateTimeFormat('es-PE',{timeZone:'America/Lima',
          day:'2-digit',month:'short',year:'numeric',
          hour:'2-digit',minute:'2-digit'}).format(raw):'Fecha no disponible';
      const referred=event.category==='REFERIDO';
      const title=referred?(amount<0?'Reversión de bono por referido':'Bono por referido'):
        (event.description||event.category||'Bono');
      const detail=(referred?(event.referralName?event.referralName+' · ':''):
        (event.category||'MOVIMIENTO')+' · ')+date+
        (event.status==='PENDIENTE'?' · Pendiente de recarga':
          event.status==='ACTIVADO'?' · Activado':'');
      return '<div class="bonus-statement-row"><div class="bonus-statement-info">'+
        '<strong>'+esc(title)+'</strong>'+
        '<span>'+esc(detail)+'</span></div>'+
        '<b class="'+(amount<0?'is-debit':'is-credit')+'">'+
        (amount<0?'− ':'+ ')+'S/ '+fmt2(Math.abs(amount))+'</b></div>';
    }).join(''):'<p class="profile-info">Todavía no hay movimientos de bonos.</p>';
    document.querySelectorAll('[data-account-tab]').forEach(el=>{
      const active=el.dataset.accountTab===accountTab;
      el.classList.toggle('active',active);
      el.setAttribute('aria-pressed',String(active));
    });
    $$('.account-content').forEach(el=>el.classList.remove('is-active'));
    $(`#account${accountTab.charAt(0).toUpperCase()+accountTab.slice(1)}`)?.classList.add('is-active');
  }
  function renderAll(){renderHeader();renderHome();renderGol();filterOptions();renderMatch();renderLive();renderAccount();}
  function setAuthMode(mode){
    authMode=mode==='register'?'register':'login';
    $('#tabLogin').classList.toggle('active',authMode==='login');
    $('#tabRegister').classList.toggle('active',authMode==='register');
    $('#tabLogin').setAttribute('aria-selected',String(authMode==='login'));
    $('#tabRegister').setAttribute('aria-selected',String(authMode==='register'));
    $('#authTitle').textContent=authMode==='register'?'Crear cuenta':'Ingresar';
    $('#authTitle').classList.toggle('visually-hidden',authMode!=='register');
    $('#authDescription').textContent=authMode==='register'?'Tus jugadas y pronósticos.':'Tus jugadas y pronósticos.';
    $('#signupFields').hidden=authMode!=='register';
    $('#authFirst').required=authMode==='register';
    $('#authLast').required=authMode==='register';
    $('#authCountry').required=authMode==='register';
    $('#authPhone').required=authMode==='register';
    const canUseGoogle=validGoogleClientId && Boolean(CONFIG.appsScriptUrl);
    $('#googleSigninShell').hidden=!canUseGoogle;
    $('#googleUnavailable').hidden=canUseGoogle;
    $('#emailForm').hidden=false;$('#verifyForm').hidden=true;
    $('#emailAccessPanel').hidden=canUseGoogle;
    $('#emailAccessToggle').hidden=!canUseGoogle;
    $('#emailAccessToggle').setAttribute('aria-expanded',String(!canUseGoogle));
  }
  function openAuth(mode='login'){
    if(hasUser()){showView('account');return;}
    if(sessionToken){
      if(!sessionRestoring)refreshAccount();
      return;
    }
    setAuthMode(mode);
    const el=$('#authDialog');if(!el.open)el.showModal();
    showGoogleLoginStatus('',false);
    if(validGoogleClientId && CONFIG.appsScriptUrl)setupGoogle();
  }
  function closeAuth(){
    if(authBusy)return;
    if($('#authDialog').open)$('#authDialog').close();
    showGoogleLoginStatus('',false);
  }
  function acceptSession(result){
    if(!result.sessionToken||!result.user)throw new Error('El servidor no devolvió una sesión válida.');
    sessionToken=result.sessionToken;
    sessionRestoring=false;
    sessionRestoreFailed=false;
    sessionCreatedAt=Date.now();
    lastSessionInteraction=sessionCreatedAt;
    lastSessionVerification=Date.now();
    saveSessionActivity(true);
    // El usuario ya está autenticado. Cerrar siempre los dos diálogos
    // antes de cambiar de vista, independientemente de Ingresar o Registrarse.
    try{
      updateAccount(result);
    }catch(err){
      console.error('PremiumGol: error al presentar la cuenta tras el acceso.',err);
    }finally{
      setAuthBusy(false);
      if($('#authDialog').open)$('#authDialog').close();
      showGoogleLoginStatus('',false);
    }
    sportsPolicyRequested=false;
    loadSportsWagerPolicy();
    const next=pendingAfterAuth;pendingAfterAuth=null;
    accountTab='overview';
    try{
      if(next==='gol')saveGol();
      else if(next==='bet')loadSportsWagerPolicy().then(()=>placeBet());
      else if(next==='coupon')claimCouponPrompt();
      else showView('account');
      checkMpReturn();
      toast('¡Bienvenido a PremiumGol!');
      if(!String(result.user.phone||'').trim())toast('Puedes completar tu WhatsApp en Mi perfil.');
    }catch(err){
      // La sesión se conserva: ante un fallo de interfaz, recuperar el
      // dashboard automáticamente, sin pedir al usuario cerrar la pestaña.
      console.error('PremiumGol: recuperación del panel de usuario.',err);
      history.replaceState(null,'',location.pathname+location.search+'#account');
      location.reload();
    }
  }
  async function signout(reason){
    // Google no debe reabrir automáticamente una sesión después de salir.
    // La elección de cuenta/consentimiento sigue siendo controlada por Google.
    try{window.google?.accounts?.id?.disableAutoSelect?.();window.google?.accounts?.id?.cancel?.();}catch{}
    const old=sessionToken;sessionToken='';sessionRestoring=false;sessionRestoreFailed=false;
    account=null;accountBalance=0;paidBalancePEN=0;bonusBalancePEN=0;bonusAvailablePEN=0;bonusPendingPEN=0;bonusUnlocked=false;referralActivity=[];recentTopupOrders=[];playHistory=[];golLocked={};couponClaimed=false;
    clearSavedSession();lastSessionInteraction=0;sessionCreatedAt=0;lastSessionVerification=0;
    closeAccountMenu();closeWalletBreakdown();referralsJoined=0;
    bonusStatement=[];walletWagersEnabled=false;
    sportsWalletEnabled=false;sportsPolicyRequested=false;
    renderAll();showView('home');
    toast(reason==='idle'?'Tu sesión terminó tras una hora de inactividad.':'Has cerrado sesión.');
    if(old)remote('signout',{sessionToken:old}).catch(()=>{});
  }
  // Puente Google Apps Script: el web app sirve un iframe HtmlService que llama google.script.run.
  // Lecturas y sesión: puente iframe. Movimientos de saldo: fetch() POST (ver remotePost) con este puente como respaldo.
  const bridge={ready:false,win:null,origin:null,pending:new Map(),queue:[],nonce:randomId()};
  function sendBridgeRequest(packet){
    if(!bridge.ready){bridge.queue.push(packet);return;}
    bridge.win.postMessage({scope:'premiumgol',type:'request',id:packet.id,action:packet.action,data:packet.data},bridge.origin);
  }
  // Operaciones que mueven saldo: viajan por fetch() POST directo a la Web App de Apps Script.
  // Cada una es idempotente por clientRequestId, así que un reintento nunca cobra dos veces.
  const POST_ACTIONS=new Set(['savePremiumGol','savePremiumGolBatch','placeWalletBet']);
  const POST_TIMEOUT_MS=30000;
  async function remotePost(action,data){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),POST_TIMEOUT_MS);
    const transportError=(message,timedOut)=>Object.assign(new Error(message),{transport:true,timedOut:Boolean(timedOut)});
    try{
      let response;
      try{
        response=await fetch(CONFIG.appsScriptUrl,{
          method:'POST',mode:'cors',redirect:'follow',cache:'no-store',credentials:'omit',
          // text/plain = solicitud "simple": el navegador no envía preflight CORS,
          // que Apps Script no sabe responder.
          headers:{'Content-Type':'text/plain;charset=utf-8'},
          body:JSON.stringify({action,data}),signal:controller.signal
        });
      }catch(err){
        if(err?.name==='AbortError')throw transportError('La conexión tardó demasiado. Vuelve a intentarlo.',true);
        throw transportError('No se pudo conectar con el servidor.');
      }
      if(!response.ok)throw transportError('No se pudo comunicar con el servidor.');
      let json;
      try{json=await response.json();}
      catch{throw transportError('Respuesta no válida del servidor.');}
      if(!json||json.ok!==true)throw new Error(json?.message||'No se pudo completar la solicitud.');
      return json;
    }finally{clearTimeout(timer);}
  }
  function remote(action,data={}){
    if(!CONFIG.appsScriptUrl) return Promise.reject(new Error('El inicio de sesión estará disponible al conectar el servidor de PremiumGol.'));
    if(!POST_ACTIONS.has(action))return remoteBridge(action,data);
    return remotePost(action,data).catch(err=>{
      // Solo si NO hubo respuesta utilizable (red, CORS, doPost aún sin publicar) se
      // reintenta por el puente. Con la misma clientRequestId es seguro: no duplica el cobro.
      // Una respuesta del servidor (p. ej. "Saldo principal insuficiente.") nunca se reintenta.
      if(err?.transport&&!err.timedOut)return remoteBridge(action,data);
      throw err;
    });
  }
  function remoteBridge(action,data={}){
    return new Promise((resolve,reject)=>{
      const id=randomId();
      const timeout=(action==='catalog'||action==='golProgram'||action==='googleLogin')?45000:20000;
      const timer=setTimeout(()=>{bridge.pending.delete(id);bridge.queue=bridge.queue.filter(p=>p.id!==id);reject(new Error('La conexión tardó demasiado. Vuelve a intentarlo.'));},timeout);
      bridge.pending.set(id,{resolve,reject,timer});sendBridgeRequest({id,action,data});
    });
  }
  function initBridge(){
    if(!CONFIG.appsScriptUrl)return;
    try{
      const url=new URL(CONFIG.appsScriptUrl);
      if(url.protocol!=='https:'||url.hostname!=='script.google.com')throw new Error('URL no válida');
      window.addEventListener('message',e=>{
        const x=e.data;
        if(!x||x.scope!=='premiumgol-bridge')return;
        if(!/^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/i.test(e.origin)&&e.origin!=='https://script.google.com')return;
        if(x.type==='ready'&&x.nonce===bridge.nonce){
          bridge.ready=true;bridge.win=e.source;bridge.origin=e.origin;
          bridge.queue.splice(0).forEach(sendBridgeRequest);
        }else if(x.type==='reply'&&bridge.ready&&e.source===bridge.win&&e.origin===bridge.origin){
          const request=bridge.pending.get(x.id);if(!request)return;
          clearTimeout(request.timer);bridge.pending.delete(x.id);
          x.result?.ok?request.resolve(x.result):request.reject(new Error(x.result?.message||'No se pudo completar la solicitud.'));
        }
      });
      url.searchParams.set('bridge','1');url.searchParams.set('nonce',bridge.nonce);
      const frame=document.createElement('iframe');frame.title='Conexión segura PremiumGol';frame.id='gasBridge';
      frame.style.cssText='position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0';
      frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=url.toString();document.body.appendChild(frame);
    }catch(e){console.error('No se pudo inicializar el puente:',e);}
  }
  let googleStarted=false,googleLoggingIn=false;
  function showGoogleLoginStatus(message,isError){
    const field=$('#googleLoginStatus');
    if(!field)return;
    field.hidden=!message;
    field.textContent=message||'';
    field.classList.toggle('is-error',Boolean(isError));
    $('#googleSigninShell')?.classList.toggle('is-loading',Boolean(message)&&!isError);
  }
  function setupGoogle(){
    if(googleStarted||!validGoogleClientId||!CONFIG.appsScriptUrl)return;googleStarted=true;
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>{
      if(!window.google?.accounts?.id){$('#googleUnavailable').hidden=false;$('#emailAccessPanel').hidden=false;$('#emailAccessToggle').hidden=true;return;}
      window.google.accounts.id.initialize({
        client_id:CONFIG.googleClientId,
        ux_mode:'popup',auto_select:false,
        callback:async response=>{
          if(googleLoggingIn)return;
          if(!response?.credential){
            showGoogleLoginStatus('No se recibió la autorización de Google. Intenta nuevamente.',true);
            return;
          }
          googleLoggingIn=true;
          try{
            showGoogleLoginStatus('Verificando tu cuenta de Google…',false);
            setAuthBusy(true,'Verificando tu cuenta de Google…');
            const result=await remote('googleLogin',{idToken:response.credential,referralCode:referralFromUrl});
            acceptSession(result);
            showGoogleLoginStatus('',false);
          }catch(err){
            if(hasUser()){
              console.warn('PremiumGol: acceso validado; recuperando la vista de cuenta.');
              if($('#authDialog').open)$('#authDialog').close();
              showView('account');
            }else{
              showGoogleLoginStatus(err?.message||'No se pudo iniciar sesión con Google.',true);
              console.warn('PremiumGol OAuth: no hubo sesión; comprueba la implementación de Apps Script y los registros rpc.');
            }
          }finally{
            googleLoggingIn=false;
            setAuthBusy(false);
          }
        }
      });
      $('#googleButtonMount').style.display='flex';$('#googleUnavailable').hidden=true;
      const host=$('#googleButtonMount');
      host.replaceChildren();
      const buttonWidth=Math.max(230,Math.min(360,Math.floor(host.getBoundingClientRect().width)||300));
      window.google.accounts.id.renderButton(host,{
        theme:'outline_dark',size:'large',text:'continue_with',
        shape:'pill',width:buttonWidth,locale:'es',logo_alignment:'left'
      });
    };
    script.onerror=()=>{googleStarted=false;$('#googleUnavailable').hidden=false;$('#emailAccessPanel').hidden=false;$('#emailAccessToggle').hidden=true;toast('No se pudo cargar el acceso Google.');};
    document.head.appendChild(script);
  }
  async function refreshAccount(){
    if(!sessionToken)return;
    if(sessionExpired()){await signout('idle');return;}
    // Una misma petición de recuperación, aunque varias rutas la soliciten.
    if(accountRefreshPromise)return accountRefreshPromise;
    const checkedToken=sessionToken;
    const restoring=!account;
    if(restoring){
      sessionRestoring=true;
      sessionRestoreFailed=false;
      renderHeader();
    }
    accountRefreshPromise=(async()=>{
      try{
        const response=await remote('me',{sessionToken:checkedToken});
        // Evita que una respuesta antigua reabra la cuenta tras cerrar sesión.
        if(sessionToken!==checkedToken)return;
        lastSessionVerification=Date.now();
        updateAccount(response);
        if(restoring&&(activeView==='match'||activeView==='live'))
          loadSportsWagerPolicy();
      }catch(err){
        if(sessionToken!==checkedToken)return;
        // Solo el servidor puede invalidar una sesión guardada.
        if(/Sesión vencida\. Vuelve a ingresar\./.test(String(err?.message||''))){
          sessionToken='';account=null;accountBalance=0;paidBalancePEN=0;
          bonusBalancePEN=0;bonusAvailablePEN=0;bonusPendingPEN=0;bonusUnlocked=false;bonusStatement=[];
          clearSavedSession();lastSessionInteraction=0;sessionCreatedAt=0;
          renderAll();
          toast('Tu sesión venció. Vuelve a ingresar.');
        }else{
          console.warn('La sesión se conserva tras un error temporal de conexión.');
          if(restoring)toast('No se pudo restaurar tu sesión. Pulsa Reconectar para intentarlo de nuevo.');
        }
      }finally{
        if(sessionToken===checkedToken){
          sessionRestoring=false;
          sessionRestoreFailed=!account;
        }else if(!sessionToken){
          sessionRestoring=false;
          sessionRestoreFailed=false;
        }
        renderHeader();
      }
    })();
    try{await accountRefreshPromise;}finally{accountRefreshPromise=null;}
  }
  async function loadGolProgram(){
    if(!CONFIG.appsScriptUrl)return;
    try{
      const data=await remote('golProgram',{});
      if(data?.roundId!=='premiumgol12-jornada-20261121'||!Array.isArray(data.games)||data.games.length!==12)return;
      if(!data.games.every((g,i)=>String(g.id)===`gol${i+1}`))return;
      golGames=data.games;
      if(Number.isFinite(Date.parse(data.cutoff)))golCutoff=data.cutoff;
      golJackpotPEN=Number(data.jackpotPEN)>0?Number(data.jackpotPEN):0;
      renderGol();
    }catch(e){
      // La cartilla con jornadas, ligas y horarios funciona aunque la API aún no entregue escudos.
      console.warn('El proveedor no entregó todas las insignias de la cartilla.');
    }
  }
  async function loadCatalog(){
    if(!CONFIG.appsScriptUrl){catalogLoading=false;catalogWarning='Encuentros temporalmente no disponibles.';renderAll();return;}
    try{
      const data=await remote('catalog',{});
      catalogLoading=false;
      catalogMode='API_PREVIEW';
      const verified=data.mode==='API_PREVIEW'&&['API-Football','The Odds API','Multi-API'].includes(data.source);
      catalogUpdatedAt=verified&&data.updatedAt?String(data.updatedAt):null;
      catalogWarning=verified?(data.warning||''):'Datos deportivos todavía no disponibles.';
      matches=verified&&Array.isArray(data.games?.match)?data.games.match:[];
      // La consulta Live independiente no debe sobrescribirse con el catálogo de 12 h.
      if(!liveCatalogRequestedAt)
        liveGames=verified&&Array.isArray(data.games?.live)?data.games.live:[];
      if(oddsExpandedId&&!allGames().some(g=>g.id===oddsExpandedId))oddsExpandedId='';
      // Una recarga del catálogo no equivale a invalidar un cupón: la fuente podría
      // haber cambiado de liga, agotado créditos o estar en caché. El servidor
      // revalida cada selección y bookmaker al confirmar; no borrar pronósticos aquí.
      renderAll();fetchSportsArtwork();
    }catch(e){
      catalogLoading=false;
      catalogWarning=!bridge.ready?
        'No se pudo conectar con Apps Script. Revisa el despliegue y FRONTEND_ORIGIN.':
        'No fue posible obtener los partidos. Revisa las ejecuciones de Apps Script y vuelve a intentarlo.';
      matches=[];liveGames=[];catalogUpdatedAt=null;renderAll();
      console.warn('Catálogo deportivo sin respuesta:',e.message);
    }
    // Esperar a que termine el catálogo antes de consultar Live: Apps Script usa un bloqueo compartido.
    if(activeView==='live'&&!liveCatalogLoading&&Date.now()-liveCatalogRequestedAt>60000)
      loadLiveCatalog();
  }
  on('#comingSoonBack','click',backFromComingSoon);
  on('#comingSoonDialog','cancel',e=>{e.preventDefault();backFromComingSoon();});
  on('#comingSoonDialog','click',e=>{
    if(e.target===$('#comingSoonDialog'))backFromComingSoon();
  });
  on('#loginTop','click',e=>{
    if(sessionRestoring)return;
    if(sessionToken&&!hasUser()){refreshAccount();return;}
    if(hasUser())toggleAccountMenu(e.currentTarget);
    else openAuth('login');
  });
  on('#registerTop','click',()=>{
    if(sessionToken){if(!sessionRestoring)refreshAccount();return;}
    openAuth('register');
  });
  on('#walletTop','click',toggleWalletBreakdown);
  on('#copyReferral','click',async()=>{
    const value=$('#referralLink').value;
    if(!/^https:\/\/premiumgol\.website\/\?ref=[A-Z0-9]{10,16}$/.test(value))return;
    try{await navigator.clipboard.writeText(value);toast('Enlace copiado. Compártelo con tus amigos.');}
    catch(e){
      $('#referralLink').select();
      toast('Selecciona el enlace para copiarlo y compartirlo.');
    }
  });
  // El registro se abre desde la pestaña «Registrarse» del modal de acceso.
  on('#emailAccessToggle','click',()=>{
    const panel=$('#emailAccessPanel');panel.hidden=!panel.hidden;
    $('#emailAccessToggle').setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)$('#authEmail').focus();
  });
  on('#tabLogin','click',()=>setAuthMode('login'));
  on('#tabRegister','click',()=>setAuthMode('register'));
  on('#closeAuth','click',closeAuth);
  on('#authDialog','click',e=>{if(e.target===$('#authDialog')&&!authBusy)closeAuth();});
  on('#authDialog','cancel',e=>{if(authBusy)e.preventDefault();});
  $('#googleUnavailable').hidden=validGoogleClientId && Boolean(CONFIG.appsScriptUrl);
  on('#emailForm','submit',async e=>{
    e.preventDefault();
    const email=$('#authEmail').value.trim().toLowerCase();
    const btn=$('#requestCode');btn.disabled=true;
    try{
      if(authMode==='register' && !/^\d{6,15}$/.test($('#authPhone').value.trim())){
        throw new Error('Ingresa tu número de WhatsApp para registrarte.');
      }
      setAuthBusy(true,'Enviando código de acceso…','general');
      await remote('sendCode',{email,mode:authMode});
      $('#emailForm').hidden=true;$('#verifyForm').hidden=false;$('#authCode').focus();
      toast('Revisa tu correo para encontrar el código de 6 dígitos.');
    }catch(e){toast(e.message||'No se pudo enviar el código.');}
    finally{btn.disabled=false;setAuthBusy(false);}
  });
  on('#verifyForm','submit',async e=>{
    e.preventDefault();
    const code=$('#authCode').value.trim();
    if(!/^\d{6}$/.test(code)){toast('Escribe los 6 dígitos del código.');return;}
    const btn=$('#verifyCodeBtn');btn.disabled=true;
    setAuthBusy(true,'Verificando tu código de acceso…');
    try{
      const result=await remote('verifyCode',{
        email:$('#authEmail').value.trim().toLowerCase(),code,mode:authMode,
        firstName:$('#authFirst').value.trim(),lastName:$('#authLast').value.trim(),
        countryCode:$('#authCountry').value,phone:$('#authPhone').value.trim(),
        referralCode:referralFromUrl
      });acceptSession(result);
    }catch(err){toast(err.message||'El código es incorrecto o ha vencido.');}
    finally{btn.disabled=false;setAuthBusy(false);}
  });
  on('#backToEmail','click',()=>{$('#verifyForm').hidden=true;$('#emailForm').hidden=false;});
  on('#submitGol','click',()=>{
    const count=readyGolSlots().length;
    if(count>=2){golBatchPending=true;saveGolBatch();}
    else{golBatchPending=false;saveGol();}
  });
  on('#walletPayClose','click',()=>{golBatchPending=false;$('#walletPayDialog').close();});
  on('#walletPayConfirm','click',()=>{
    const wallet=document.querySelector('input[name="walletPayment"]:checked')?.value;
    if(!wallet||!walletWagersEnabled)return;
    $('#walletPayDialog').close();if(golBatchPending)saveGolBatch(wallet);else saveGol(wallet);
  });
  on('#walletPayDialog','click',e=>{
    if(e.target===$('#walletPayDialog')){golBatchPending=false;e.target.close();}
  });
  on('#closeInsufficientFunds','click',()=>$('#insufficientFundsDialog').close());
  on('#insufficientFundsRecharge','click',()=>{$('#insufficientFundsDialog').close();openAccountTab('wallet');});
  on('#insufficientFundsDialog','click',e=>{if(e.target===$('#insufficientFundsDialog'))e.target.close();});
  on('#closePlayDetails','click',()=>$('#playDetailsDialog').close());
  on('#donePlayDetails','click',()=>$('#playDetailsDialog').close());
  on('#playDetailsDialog','click',e=>{
    if(e.target===$('#playDetailsDialog'))$('#playDetailsDialog').close();
  });
  on('#openGolRules','click',()=>$('#golRulesDialog').showModal());
  on('#closeGolRules','click',()=>$('#golRulesDialog').close());
  on('#acceptGolRules','click',()=>$('#golRulesDialog').close());
  on('#golRulesDialog','click',e=>{if(e.target===$('#golRulesDialog'))$('#golRulesDialog').close();});
  on('#authBusyOverlay','cancel',e=>e.preventDefault());
  window.addEventListener('resize',()=>{if(accountMenuOpen)closeAccountMenu();if(walletBreakdownOpen)closeWalletBreakdown();});
  on('#resetGol','click',()=>{if(golLocked[activeCard])return;draft.golCards[activeCard]={};delete draft.golRequestIds[activeCard];delete draft.golBatchRequestId;saveDraft();renderGol();toast('Se borró la selección de la jugada '+activeCard+'.');});
  on('#premiumCoupon','click',claimCouponPrompt);
  on('#closeCoupon','click',()=>$('#couponDialog').close());
  on('#couponDialog','click',e=>{if(e.target===$('#couponDialog'))$('#couponDialog').close();});
  on('#claimCoupon','click',claimCoupon);
  on('#accountSignout','click',signout);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&accountMenuOpen){closeAccountMenu();e.preventDefault();}
    if(e.key==='Escape'&&walletBreakdownOpen){closeWalletBreakdown();e.preventDefault();}
    if(e.key==='Escape'&&authBusy)e.preventDefault();
  });
  on('#rechargeOther','input',e=>{topupCustom=e.target.value;topupRequestId=null;$('#rechargeOrder').hidden=true;renderTopup();});
  on('#rechargeGenerate','click',createTopupRequest);
  document.addEventListener('click',e=>{
    const pay=e.target.closest('[data-mp-pay]');
    if(pay){
      const url=mpSafeUrl(pay.dataset.mpPay);
      if(url){
        rememberMpCheckout(pay.dataset.mpOrder);
        window.location.assign(url);
      }
      return;
    }
    const check=e.target.closest('[data-topup-check]');
    if(check){checkTopupOrder(check.dataset.topupCheck);return;}
    const details=e.target.closest('[data-play-details]');
    if(details){showPlayDetails(details.dataset.playDetails);return;}
  });
  on('#profileForm','submit',async e=>{
    e.preventDefault();if(!hasUser())return;
    const btn=$('#profileSave');btn.disabled=true;
    setAuthBusy(true,'Guardando tu perfil…','general');
    try{const res=await remote('updateProfile',{sessionToken,firstName:$('#profileFirst').value.trim(),lastName:$('#profileLast').value.trim(),countryCode:$('#profileCountry').value,phone:$('#profilePhone').value.trim(),docType:$('#profileDocType').value,docNumber:$('#profileDocNumber').value.trim()});updateAccount(res);toast('Tus datos fueron actualizados.');}
    catch(err){toast(err.message||'No se pudieron guardar tus datos.');}finally{btn.disabled=false;setAuthBusy(false);}
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('#refreshSportsQuote, #refreshSportsQuoteLive')){refreshSportsQuote();}
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-wallet-toggle]')){
      sportsWalletMenuOpen=!sportsWalletMenuOpen;renderSlips();return;
    }
    const pick=e.target.closest('[data-wallet-choice]');
    if(pick){
      if(pick.disabled)return;
      sportsWalletSource=pick.dataset.walletChoice==='bonos'?'bonos':'principal';
      sportsWalletMenuOpen=false;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
      renderSlips();return;
    }
    if(sportsWalletMenuOpen&&!e.target.closest('.sports-wallet-combobox')){
      sportsWalletMenuOpen=false;renderSlips();
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&sportsWalletMenuOpen){sportsWalletMenuOpen=false;renderSlips();}
  });
  on('#matchSearch','input',e=>{searchFilter=e.target.value.trim();renderMatch();});
  on('#matchLeague','change',e=>{leagueFilter=e.target.value;renderMatch();});
  on('#matchDate','change',e=>{dateFilter=e.target.value;renderMatch();});
  on('#matchSort','change',e=>{sortFilter=e.target.value;renderMatch();});
  document.addEventListener('input',e=>{
    if(e.target.matches('[id^="betStake"]')){
      // No spin buttons and no mouse-wheel changes: accept only typed digits.
      const clean=e.target.value.replace(/[^0-9]/g,'').slice(0,4);
      if(e.target.value!==clean)e.target.value=clean;
      const v=Number(clean);stake=clean&&Number.isFinite(v)?Math.floor(v):0;
      delete draft.betRequestId;delete draft.sportsDemoRequestId;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
      $$('input[id^="betStake"]').forEach(el=>{if(el!==e.target)el.value=e.target.value;});
      $$('[id^="slipReturn"]').forEach(el=>el.textContent=slipMoney(stake*combinedOdds()));
      $$('button[id^="placeBet"]').forEach(btn=>{btn.disabled=!Number.isInteger(stake)||stake<1||stake>betCap()||betMode()==='preview';});
    }
  });
  on('#mobileSlipOpen','click',openMobileSportsSlip);
  on('#mobileSlipBackdrop','click',closeMobileSportsSlip);
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-sports-slip-close]')){closeMobileSportsSlip();return;}
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&mobileSlipOpen){closeMobileSportsSlip();e.preventDefault();}
  });
  document.addEventListener('click',e=>{
    if(accountMenuOpen&&!e.target.closest('#accountMenu,#loginTop,[data-nav="account"]'))closeAccountMenu();
    if(walletBreakdownOpen&&!e.target.closest('#walletTop,#walletBreakdown'))closeWalletBreakdown();
    const logout=e.target.closest('[data-account-signout]');
    if(logout){e.preventDefault();closeAccountMenu();signout();return;}
    const slot=e.target.closest('[data-gol-slot]');if(slot){
      if(!golSlotAccessible(slot.dataset.golSlot)){toast('Primero completa la jugada anterior.');return;}
      activeCard=slot.dataset.golSlot;draft.activeCard=activeCard;saveDraft();renderGol();return;
    }
    const gol=e.target.closest('[data-gol-id]');if(gol){if(golLocked[activeCard])return;delete draft.golRequestIds[activeCard];delete draft.golBatchRequestId;currentPicks()[gol.dataset.golId]=gol.dataset.golOutcome;saveDraft();renderGol();return;}
    const highlighted=e.target.closest('[data-featured-match]');if(highlighted){e.preventDefault();openFeaturedGame(highlighted.dataset.featuredMatch);return;}
    if(e.target.closest('[data-retry-live]')){
      if(!liveCatalogLoading)loadLiveCatalog();
      return;
    }
    if(e.target.closest('[data-retry-sports]')){
      if(!catalogLoading){catalogLoading=true;catalogWarning='';renderAll();loadCatalog();}
      return;
    }
    const detail=e.target.closest('[data-odds-details]');
    if(detail){e.preventDefault();toggleOddsDetails(detail.dataset.oddsDetails);return;}
    const marketGroup=e.target.closest('[data-odds-group]');
    if(marketGroup){e.preventDefault();chooseOddsGroup(marketGroup.dataset.oddsEvent,marketGroup.dataset.oddsGroup);return;}
    const nav=e.target.closest('[data-nav]');
    if(nav){
      e.preventDefault();
      if(nav.dataset.nav==='account'){
        if(sessionRestoring)return;
        if(sessionToken&&!hasUser()){refreshAccount();return;}
        if(hasUser())toggleAccountMenu(nav);else openAuth('login');
      }else showView(nav.dataset.nav);
      return;
    }
    const tab=e.target.closest('[data-account-tab]');
    if(tab){e.preventDefault();openAccountTab(tab.dataset.accountTab);return;}
    const amountButton=e.target.closest('[data-topup-amount]');if(amountButton){topupSelection=amountButton.dataset.topupAmount;topupRequestId=null;$('#rechargeOrder').hidden=true;renderTopup();if(topupSelection==='custom')$('#rechargeOther').focus();return;}
    const marketChoice=e.target.closest('[data-market-pick]');
    if(marketChoice){changeDetailSelection(marketChoice.dataset.marketPick,
      marketChoice.dataset.marketGroup,Number(marketChoice.dataset.marketIndex),
      Number(marketChoice.dataset.marketOutcome));return;}
    const pick=e.target.closest('[data-pick]');if(pick){changeSelection(pick.dataset.pick,pick.dataset.outcome);return;}
    const rem=e.target.closest('[data-remove]');if(rem){draft.slips=draft.slips.filter(s=>
      s.gameId!==rem.dataset.removeGame||s.selectionId!==rem.dataset.remove);
      sportSimReceipt='';delete draft.sportsDemoRequestId;delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
      saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="clearBetslip"]')){draft.slips=[];
      delete draft.betRequestId;delete draft.sportsDemoRequestId;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId; sportSimReceipt='';saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="placeBet"]'))placeBet();
  });
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-featured-match]')){e.preventDefault();openFeaturedGame(e.target.dataset.featuredMatch);}});
  // Si una insignia remota falla, conservar las iniciales/ícono en lugar de una imagen rota.
  document.addEventListener('error',e=>{
    if(e.target.matches?.('.sport-team-crest img,.sport-league-emblem img'))
      e.target.remove();
  },true);
  // Aviso informativo de edad mínima desde el footer.
  on('#pgAgeNoticeButton','click',()=>{
    const dialog=$('#pgAgeNotice');
    if(!dialog.open)dialog.showModal();
  });
  on('#pgAgeClose','click',()=>$('#pgAgeNotice').close());
  on('#pgAgeConfirm','click',()=>$('#pgAgeNotice').close());
  on('#pgAgeNotice','click',e=>{
    if(e.target===$('#pgAgeNotice'))e.target.close();
  });
  // Footer: columnas siempre visibles en PC, desplegables en móvil.
  const footerSections=[...document.querySelectorAll('[data-pg-footer-accordion]')];
  const footerMQ=window.matchMedia('(min-width: 768px)');
  function syncFooterAccordions(){
    if(footerMQ.matches)footerSections.forEach(section=>section.open=true);
    else footerSections.forEach(section=>section.open=false);
  }
  syncFooterAccordions();
  if(typeof footerMQ.addEventListener==='function')
    footerMQ.addEventListener('change',syncFooterAccordions);
  else footerMQ.addListener(syncFooterAccordions);
  $('#footerYear').textContent=new Date().getFullYear();
  // Cada paso de arranque va aislado: un error en uno no impide que los demás se ejecuten.
  try{renderAll();}catch(err){console.error('PremiumGol: error al dibujar la interfaz.',err);}
  try{refreshCoupon();loadPromoStatus();setInterval(()=>{if(document.visibilityState==='visible')loadPromoStatus();},60000);}catch(err){console.error('PremiumGol: cupón.',err);}
  initBridge();
  // La actividad real del usuario prolonga su sesión; las consultas automáticas
  // no la prolongan. El servidor verifica la inactividad en cada operación.
  function onSessionInteraction(){
    if(!sessionToken)return;
    if(sessionExpired()){signout('idle');return;}
    const now=Date.now();
    if(now-lastSessionInteraction>=SESSION_ACTIVITY_THROTTLE_MS)saveSessionActivity(true);
    if(hasUser()&&document.visibilityState==='visible'&&
       now-lastSessionVerification>=SESSION_HEARTBEAT_MS)refreshAccount();
  }
  document.addEventListener('pointerdown',onSessionInteraction,{passive:true});
  document.addEventListener('keydown',onSessionInteraction);
  document.addEventListener('scroll',onSessionInteraction,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState!=='visible'||!sessionToken)return;
    if(sessionExpired())signout('idle');
    else if(hasUser())refreshAccount();
  });
  window.addEventListener('focus',()=>{
    if(sessionExpired())signout('idle');
  });
  window.addEventListener('storage',e=>{
    if(e.key!==SESSION_KEY||!sessionToken)return;
    let other=null;
    try{other=e.newValue?JSON.parse(e.newValue):null;}catch{}
    if(other?.token===sessionToken&&Number.isFinite(other.lastActivityAt)){
      lastSessionInteraction=Math.max(lastSessionInteraction,other.lastActivityAt);
      return;
    }
    // El cierre o cambio de cuenta en otra pestaña invalida la vista local,
    // sin revocar el token de la nueva sesión de la otra pestaña.
    sessionToken='';sessionRestoring=false;sessionRestoreFailed=false;
    account=null;accountBalance=0;paidBalancePEN=0;
    recentTopupOrders=[];playHistory=[];golLocked={};
    lastSessionInteraction=0;sessionCreatedAt=0;
    try{sessionStorage.removeItem(LEGACY_SESSION_KEY);}catch{}
    renderAll();showView('home');
    toast(other?.token?'La cuenta cambió en otra pestaña. Actualiza para continuar.':
      'Has cerrado sesión en otra pestaña.');
  });
  setInterval(()=>{
    if(!sessionToken)return;
    if(sessionExpired()){signout('idle');return;}
    if(hasUser()&&document.visibilityState==='visible'&&
       Date.now()-lastSessionInteraction<SESSION_HEARTBEAT_MS&&
       Date.now()-lastSessionVerification>=SESSION_HEARTBEAT_MS)refreshAccount();
  },60000);
  setInterval(()=>{
    if(activeView==='account'&&accountTab==='wallet')renderTopupHistory();
  },60000);
  // Consultas deportivas bajo demanda, no al iniciar sesión.
  // Esto evita bloquear el login mientras se consulta la API en el plan Free.
  document.addEventListener('error',e=>{
    const img=e.target;
    if(!img?.matches?.('img.gol-crest-img'))return;
    const fallback=img.dataset.golLogoFallback;
    if(fallback&&!img.dataset.triedFallback){
      img.dataset.triedFallback='1';
      img.removeAttribute('data-gol-logo-fallback');
      img.src=fallback;
    }else img.remove();
  },true);
  setInterval(()=>{if(activeView==='gol')renderGol();},60000);
  // Live real: consultar sólo con pestaña activa; el backend comparte caché del proveedor.
  setInterval(()=>{
    if(document.visibilityState==='visible'&&activeView==='live'&&
      !liveCatalogLoading&&Date.now()-liveCatalogRequestedAt>=60000)loadLiveCatalog();
  },60000);
  // El navegador consulta la caché de Apps Script; nunca lleva la clave de The Odds API.
  setInterval(()=>{
    if(document.visibilityState!=='visible'||authBusy)return;
    if(activeView==='match')loadCatalog();
    if(activeView==='live'&&!liveCatalogLoading&&Date.now()-liveCatalogRequestedAt>60000)
      loadLiveCatalog();
  },300000);
  const hash=location.hash.slice(1);
  const view=hash==='inicio'?'home':hash;
  const returnFromCheckout=new URLSearchParams(location.search).get('mp_return')==='1'||
    Boolean(storedMpCheckout());
  if(returnFromCheckout)accountTab='wallet';
  if(!returnFromCheckout&&['home','gol','match','live'].includes(view))
    showView(view,true);
  // Revalidar UNA sola vez sin mostrar login: la sesión guardada sigue vigente.
  if(sessionToken){
    refreshAccount().then(()=>{
      if(!hasUser())return;
      if(returnFromCheckout)checkMpReturn();
      else if(view==='account')showView('account',true);
    });
  }else if(returnFromCheckout){
    openAuth('login');
  }
/* PremiumGol · detalle de jugada con botón OK que resetea el cupón */
function showSportsPlayDialog(r){
  const dlg=$('#sportsPlayDialog');
  if(!dlg||!r)return;
  const d=new Date(r.createdAt||Date.now());
  const whenTxt=Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-PE',{
    timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric',
    hour:'numeric',minute:'2-digit',hour12:true
  }).format(d):'Fecha no disponible';
  const walletLabel=r.walletSource==='bonos'?'Saldo de bonos':'Saldo principal';
  const amountLabel=value=>'S/ '+fmt2(value);
  $('#sportsPlayBody').innerHTML=
    '<div class="sp-row"><span>Código</span><b>'+esc(r.id)+'</b></div>'+
    '<div class="sp-row"><span>Fecha</span><b>'+esc(whenTxt)+'</b></div>'+
    '<div class="sp-row"><span>Monto apuesta</span><b>'+amountLabel(Number(r.stake)||0)+'</b></div>'+
    '<div class="sp-row"><span>Pagado con</span><b>'+walletLabel+'</b></div>'+
    '<div class="sp-row"><span>Cuota combinada</span><b>'+fmt2(Number(r.combinedOdds)||1)+'</b></div>'+
    '<div class="sp-row sp-gain"><span>Posible ganancia</span><b>'+amountLabel(Number(r.possibleReturn)||0)+'</b></div>'+
    '<div class="sp-legs">'+(Array.isArray(r.selections)?r.selections:[]).map(s=>
      '<div class="sp-leg"><b>'+esc(s.home)+' · '+esc(s.away)+'</b>'+
      '<span>'+esc(s.marketLabel||'Resultado final')+' — '+esc(s.selectionLabel||s.outcome||'')+'</span>'+
      '<b class="sp-odd">Cuota '+fmt2(Number(s.odd)||1)+'</b></div>'
    ).join('')+'</div>';
  dlg.showModal();
}
function showSportsPlayDetails(id){
  const ticket=playHistory.find(t=>String(t.id)===String(id)&&t.type==='sports');
  if(!ticket){toast('No se encontraron los detalles del cupón.');return;}
  showSportsPlayDialog({id:ticket.id,createdAt:ticket.at,stake:ticket.stake,
    walletSource:ticket.note.includes('bonos')?'bonos':'principal',
    combinedOdds:ticket.combinedOdds,possibleReturn:ticket.potentialReturn,
    selections:(ticket.picks||[]).map(s=>({...s,
      marketLabel:s.marketLabel||s.market,selectionLabel:s.selectionLabel||s.outcome}))});
}
document.addEventListener('click',e=>{
  if(e.target.closest('#sportsPlayOk')||e.target.closest('#closeSportsPlay')){
    const dlg=$('#sportsPlayDialog');
    if(dlg&&dlg.open)dlg.close();
    sportSimReceipt='';
    renderSlips();
    return;
  }
  const det=e.target.closest('[data-sports-play-details]');
  if(det)showSportsPlayDetails(det.dataset.sportsPlayDetails);
});  

})();
