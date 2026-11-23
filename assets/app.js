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
  const SPORTS_SLIP_IDLE_MS = 60*60*1000; // Una hora sin interacción con el cupón.
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
  "Athletic Club": "logos/spain/Athletic_Club_Bilbao.svg",
  "Espanyol": "logos/spain/Espanyol.svg",
  "Atlético Madrid": "logos/spain/Atletico_Madrid.svg",
  "Getafe": "logos/spain/Getafe.svg",
  "Girona": "logos/spain/Girona.svg",
  "Elche": "logos/spain/Elche.svg",
  "Levante": "logos/spain/Levante.svg",
  "Mallorca": "logos/spain/Mallorca.svg",
  "Osasuna": "logos/spain/Osasuna.svg",
  "Real Oviedo": "logos/spain/Oviedo.svg",
  "Rayo Vallecano": "logos/spain/Rayo_Vallecano.svg",
  "Valencia": "logos/spain/Valencia.svg",
  "Bayern Múnich": "logos/germany/Bayern_Munich.svg",
  "Bayer Leverkusen": "logos/germany/Bayer_Leverkusen.svg",
  "Eintracht Frankfurt": "logos/germany/Eintracht_Frankfurt.svg",
  "RB Leipzig": "logos/germany/RB_Leipzig.svg",
  "VfB Stuttgart": "logos/germany/VfB_Stuttgart.svg",
  "Freiburg": "logos/germany/Freiburg.svg",
  "Wolfsburg": "logos/germany/Wolfsburg.svg",
  "Hoffenheim": "logos/germany/Hoffenheim.svg",
  "Union Berlin": "logos/germany/Union_Berlin.svg",
  "Werder Bremen": "logos/germany/Werder_Bremen.svg",
  "Hamburger SV": "logos/germany/Hamburger_SV.svg",
  "FC Heidenheim": "logos/germany/FC_Heidenheim.svg",
  "Schalke 04": "logos/germany/Schalke_04.svg",
  "St. Pauli": "logos/germany/St_Pauli.svg",
  "VfL Bochum": "logos/germany/VfL_Bochum.svg",
  "SC Paderborn": "logos/germany/SC_Paderborn.svg",
  "Inter": "logos/italy/Inter.svg",
  "AC Milan": "logos/italy/Milan.svg",
  "Juventus": "logos/italy/Juventus.svg",
  "Napoli": "logos/italy/Napoli.svg",
  "Roma": "logos/italy/Roma.svg",
  "Lazio": "logos/italy/Lazio.svg",
  "Atalanta": "logos/italy/Atalanta.svg",
  "Bologna": "logos/italy/Bologna.svg",
  "Cagliari": "logos/italy/Cagliari.svg",
  "Como": "logos/italy/Como_1907.svg",
  "Cremonese": "logos/italy/Cremonese.svg",
  "Fiorentina": "logos/italy/Fiorentina.svg",
  "Genoa": "logos/italy/Genoa.svg",
  "Hellas Verona": "logos/italy/Hellas_Verona.svg",
  "Lecce": "logos/italy/Lecce.svg",
  "Parma": "logos/italy/Parma.svg",
  "Pisa": "logos/italy/Pisa.svg",
  "Sassuolo": "logos/italy/Sassuolo.svg",
  "Torino": "logos/italy/Torino.svg",
  "Udinese": "logos/italy/Udinese.svg",
  "Paris Saint-Germain": "logos/france/PSG.svg",
  "Marseille": "logos/france/Marseille.svg",
  "Olympique Lyon": "logos/france/Olympique_Lyonnais.svg",
  "AS Monaco": "logos/france/AS_Monaco.svg",
  "Lille": "logos/france/Lille.svg",
  "Rennes": "logos/france/Rennes.svg",
  "Nice": "logos/france/Nice.svg",
  "Lens": "logos/france/RC_Lens.svg",
  "Nantes": "logos/france/Nantes.svg",
  "Strasbourg": "logos/france/RC_Strasbourg_Alsace.svg",
  "Toulouse": "logos/france/Toulouse.svg",
  "Brest": "logos/france/Brest.svg",
  "Metz": "logos/france/FC_Metz.svg",
  "Auxerre": "logos/france/Auxerre.svg",
  "Angers": "logos/france/Angers.svg",
  "Le Havre": "logos/france/Le_Havre_AC.svg",
  "Benfica": "logos/portugal/Benfica.svg",
  "FC Porto": "logos/portugal/FC_Porto.svg",
  "Sporting CP": "logos/portugal/Sporting_CP.svg",
  "SC Braga": "logos/portugal/SC_Braga.svg",
  "Ajax": "logos/netherlands/Ajax.svg",
  "PSV Eindhoven": "logos/netherlands/PSV_Eindhoven.svg",
  "Feyenoord": "logos/netherlands/Feyenoord.svg",
  "AZ Alkmaar": "logos/netherlands/AZ_Alkmaar.svg",
  "FC Utrecht": "logos/netherlands/FC_Utrecht.svg",
  "FC Twente": "logos/netherlands/Twente.svg",
  "FC Groningen": "logos/netherlands/FC_Groningen.svg",
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
  "Athletic Bilbao": "Athletic Club",
  "Athletic Club Bilbao": "Athletic Club",
  "Athletic de Bilbao": "Athletic Club",
  "Athletic Club de Bilbao": "Athletic Club",
  "Athletic": "Athletic Club",
  "Athletic Bilbao FC": "Athletic Club",
  "RCD Espanyol": "Espanyol",
  "Espanyol Barcelona": "Espanyol",
  "Espanyol de Barcelona": "Espanyol",
  "RCD Espanyol de Barcelona": "Espanyol",
  "Atletico Madrid": "Atlético Madrid",
  "Atletico de Madrid": "Atlético Madrid",
  "Atlético de Madrid": "Atlético Madrid",
  "CA Osasuna": "Osasuna",
  "RCD Mallorca": "Mallorca",
  "Rayo Vallecano de Madrid": "Rayo Vallecano",
  "Real Oviedo CF": "Real Oviedo",
  "Valencia CF": "Valencia",
  "Bayern Munich": "Bayern Múnich",
  "FC Bayern Munich": "Bayern Múnich",
  "Bayern München": "Bayern Múnich",
  "FC Bayern München": "Bayern Múnich",
  "FC Bayern Múnich": "Bayern Múnich",
  "Bayern": "Bayern Múnich",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "Bayer Leverkusen 04": "Bayer Leverkusen",
  "Borussia Dortmund": "Borussia Dortmund",
  "BVB Dortmund": "Borussia Dortmund",
  "RB Leipzig": "RB Leipzig",
  "RasenBallsport Leipzig": "RB Leipzig",
  "VFB Stuttgart": "VfB Stuttgart",
  "VfB Stuttgart 1893": "VfB Stuttgart",
  "SC Freiburg": "Freiburg",
  "VfL Wolfsburg": "Wolfsburg",
  "TSG Hoffenheim": "Hoffenheim",
  "TSG 1899 Hoffenheim": "Hoffenheim",
  "1. FC Union Berlin": "Union Berlin",
  "FC Union Berlin": "Union Berlin",
  "SV Werder Bremen": "Werder Bremen",
  "Werder": "Werder Bremen",
  "Hamburg SV": "Hamburger SV",
  "Hamburg": "Hamburger SV",
  "1. FC Heidenheim": "FC Heidenheim",
  "FC Heidenheim 1846": "FC Heidenheim",
  "FC Schalke 04": "Schalke 04",
  "FC St Pauli": "St. Pauli",
  "FC St. Pauli": "St. Pauli",
  "SC Paderborn 07": "SC Paderborn",
  "Internazionale": "Inter",
  "Inter Milan": "Inter",
  "Inter Milano": "Inter",
  "Internazionale Milano": "Inter",
  "FC Internazionale Milano": "Inter",
  "AC Milan": "AC Milan",
  "Milan": "AC Milan",
  "SSC Napoli": "Napoli",
  "AS Roma": "Roma",
  "SS Lazio": "Lazio",
  "Atalanta BC": "Atalanta",
  "Como 1907": "Como",
  "Hellas Verona FC": "Hellas Verona",
  "Verona": "Hellas Verona",
  "US Lecce": "Lecce",
  "Parma Calcio 1913": "Parma",
  "Pisa SC": "Pisa",
  "US Sassuolo": "Sassuolo",
  "Torino FC": "Torino",
  "Udinese Calcio": "Udinese",
  "PSG": "Paris Saint-Germain",
  "Paris SG": "Paris Saint-Germain",
  "Paris Saint Germain": "Paris Saint-Germain",
  "Paris Saint-Germain FC": "Paris Saint-Germain",
  "Olympique de Marseille": "Marseille",
  "Olympique Marseille": "Marseille",
  "Olympique Lyonnais": "Olympique Lyon",
  "Lyon": "Olympique Lyon",
  "Monaco": "AS Monaco",
  "AS Monaco FC": "AS Monaco",
  "LOSC Lille": "Lille",
  "LOSC": "Lille",
  "Stade Rennais": "Rennes",
  "OGC Nice": "Nice",
  "RC Lens": "Lens",
  "FC Nantes": "Nantes",
  "RC Strasbourg": "Strasbourg",
  "RC Strasbourg Alsace": "Strasbourg",
  "Stade Brestois": "Brest",
  "Stade Brestois 29": "Brest",
  "FC Metz": "Metz",
  "AJ Auxerre": "Auxerre",
  "Angers SCO": "Angers",
  "Le Havre AC": "Le Havre",
  "SL Benfica": "Benfica",
  "Porto": "FC Porto",
  "Sporting Lisbon": "Sporting CP",
  "Sporting Lisbon CP": "Sporting CP",
  "Sporting Braga": "SC Braga",
  "PSV": "PSV Eindhoven",
  "AZ": "AZ Alkmaar",
  "FC Twente": "FC Twente",
  "Wolverhampton Wanderers FC": "Wolverhampton Wanderers",
  "Man City": "Manchester City",
  "Tottenham Hotspur FC": "Tottenham",
};
// The Odds API and API-Football use slightly different club names.
// Match verified aliases / normalized exact names only; NEVER guess a team's crest.
function footballLogoKey_(name){
  return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
}
const FOOTBALL_LOGOS_CANONICAL_KEYS=new Map(
  Object.keys(FOOTBALL_LOGOS_PATHS).map(name=>[footballLogoKey_(name),name])
);
const FOOTBALL_LOGOS_ALIAS_KEYS=new Map(
  Object.entries(FOOTBALL_LOGOS_ALIASES).map(([alias,canonical])=>[footballLogoKey_(alias),canonical])
);
function footballLogoUrl(name){
  const raw=String(name||'').trim();
  const key=footballLogoKey_(raw);
  const canonical=FOOTBALL_LOGOS_ALIASES[raw]||
    FOOTBALL_LOGOS_ALIAS_KEYS.get(key)||
    FOOTBALL_LOGOS_CANONICAL_KEYS.get(key)||raw;
  const path=FOOTBALL_LOGOS_PATHS[canonical];
  return path?FOOTBALL_LOGOS_RAW+path.split('/').map(encodeURIComponent).join('/'):'';
}
  const randomId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Referencia visual derivada de UUID y fecha. No reemplaza al identificador interno.
  // Código público visual de 6 hex; ID real permanece intacto en Google Sheets.
  // Derivado SOLO del identificador estable: comprobante e historial coinciden aun
  // si el servidor devuelve un formato de fecha distinto. 24 bits pueden colisionar.
  function publicReceiptCode(id,at,kind='sports'){
    const source=String(id||'').trim();
    if(!source)return '—';
    const prefix=kind==='live'?'PL':kind==='gol'?'PG':'AD';
    const seed=prefix+'|'+source.toLowerCase();
    let hash=0xcbf29ce484222325n;
    for(let i=0;i<seed.length;i++)
      hash=((hash^BigInt(seed.charCodeAt(i)))*0x100000001b3n)&0xffffffffffffffffn;
    return prefix+'-'+(hash&0xffffffn).toString(16).toUpperCase().padStart(6,'0');
  }
  function isLiveSportsTicket(record){
    if(record?.isLive===true||record?.mode==='live')return true;
    const picks=Array.isArray(record?.selections)?record.selections:
      Array.isArray(record?.picks)?record.picks:[];
    return picks.some(p=>p?.live===true||/^(?:api-live-|odds-live-)/i.test(String(p.gameId||p.eventId||'')));
  }
  function receiptQrMarkup(internalId){
    const id=String(internalId||'').trim();
    if(!id||typeof window.qrcode!=='function')return '';
    try{
      const qr=window.qrcode(0,'M');qr.addData(id);qr.make();
      // QR negativo: módulos blancos y fondo transparente sobre marco oscuro.
      // Mantener quiet zone de cuatro módulos para facilitar la lectura.
      const svg=qr.createSvgTag(4,4)
        .replace(/fill="white"/g,'fill="transparent"')
        .replace(/fill="black"/g,'fill="#FFFFFF"');
      return '<div class="pg-receipt-qr" aria-label="QR del identificador interno del ticket">'+
        svg+'<small>Escanea para identificar el ticket</small></div>';
    }catch(e){console.warn('No se pudo generar el QR local.');return '';}
  }
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
  // No afectar a las cartillas Premium Gold: la caducidad se aplica SOLO a sports slips.
  // Una versión antigua sin marca temporal no puede acreditar su antigüedad: se limpia.
  function expireSportsSlipIfIdle(){
    if(!draft.slips.length)return false;
    const last=Number(draft.sportsSlipTouchedAt),now=Date.now();
    if(Number.isFinite(last)&&last>0&&last<=now&&now-last<SPORTS_SLIP_IDLE_MS)return false;
    draft.slips=[];
    delete draft.sportsSlipTouchedAt;
    delete draft.sportsWalletRequestId;
    delete draft.sportsPrivateRequestId;
    delete draft.sportsDemoRequestId;
    delete draft.betRequestId;
    saveDraft();
    return true;
  }
  function touchSportsSlip(){
    if(draft.slips.length)draft.sportsSlipTouchedAt=Date.now();
    else delete draft.sportsSlipTouchedAt;
    saveDraft();
  }
  // Limpiar el cupón caducado también después de cerrar y volver a abrir el navegador.
  expireSportsSlipIfIdle();
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
    // Brillo SOLO en los caracteres: ninguna caja, borde o fondo.
    if(walletBreakdownOpen&&bonusAvailablePEN>0){
      const row=$('#walletBonusAvailable')?.parentElement;
      [row?.querySelector('span'),$('#walletBonusAvailable')].forEach(el=>{
        if(!el)return;
        el.classList.remove('pg-bonus-text-glow');
        void el.offsetWidth; // Permite repetir el efecto al abrir el menú otra vez.
        el.classList.add('pg-bonus-text-glow');
      });
    }
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
  let leagueFilter='all',dateFilter='7',searchFilter='',sortFilter='date',stake=5;
  let matchVisibleLimit=12;
  const MATCH_PAGE_SIZE=12;
  let topupSelection='10',topupCustom='',topupBusy=false,topupRequestId=null;
  let topupMinimumPEN=5,bonusUnlockMinimumPEN=5;
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
  // Sin datos estáticos de jornadas: esperar la respuesta real del backend V5/V6.
  let golCutoff='',golRoundId=String(draft.golRoundId||'');
  let golProgramLoading=false,golProgramLastCheck=0,golProgramLoaded=false;
  let golJackpotPEN=10000,golGames=[];
  let golHistoryPage=1,golHistoryExpandedId='',golHistoryLoading=false;
  let golHistorySearchTimer=null;
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
    if(!['home','gol','gol-results','match','live','account'].includes(name))name='home';
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
    $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===(name==='gol-results'?'gol':name)));
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
    if(name==='gol-results')loadGolResults(golHistoryPage);
    if(name==='gol'&&(!golProgramRequested||Date.now()-golProgramLastCheck>120000)){
      golProgramRequested=true;loadGolProgram(true);
    }
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderHome(){
    const withOdds=matches.filter(g=>g.odds?.some(v=>Number(v)>1));
    const featured=[...withOdds,...matches.filter(g=>!withOdds.some(x=>x.id===g.id))].slice(0,3);
    const source='Encuentros de fútbol';
    $('#homeFixtures').innerHTML=featured.length?featured.map(g=>`<article class="preview-card featured-clickable" data-featured-match="${esc(g.id)}" role="button" tabindex="0" aria-label="Ver cuotas de ${esc(g.home)} contra ${esc(g.away)}">
      <div class="preview-card-head"><span class="pg-featured-league">${sportLeagueBadge(g)}</span><span class="game-date pg-featured-date">${esc(visibleDate(g))}</span></div>
      <div class="preview-teams"><span class="preview-team">${sportCrest(g.home,g.sportKey,g.homeLogo)}<span>${esc(g.home)}</span></span><span class="preview-versus">VS</span><span class="preview-team">${sportCrest(g.away,g.sportKey,g.awayLogo)}<span>${esc(g.away)}</span></span></div>
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
    dateFilter='7';$('#matchDate').value='7';
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
  const golClosed=()=>golGames.length!==12||Date.now()>=new Date(golCutoff).getTime();
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
    // La cartilla sólo se construye cuando el servidor devuelve 12 partidos válidos.
    if(golGames.length!==12){$('#golFixtures')?.replaceChildren();return;}
    if(!golSlotAccessible(activeCard)){
      activeCard=SLOTS.find(slot=>golSlotAccessible(slot)&&!golLocked[slot])||'A';
      draft.activeCard=activeCard;saveDraft();
    }
    const selections=currentPicks(),locked=Boolean(golLocked[activeCard]),closed=golClosed();
    const deadline=$('#golDeadline');
    deadline.classList.toggle('expired',closed);
    const cutoffText=golGames.length?new Date(golCutoff).toLocaleDateString('es-PE',{timeZone:'America/Lima',
      weekday:'long',day:'numeric',month:'long',year:'numeric'}):'por confirmar';
    const poolText='S/ '+fmt(golJackpotPEN);
    deadline.setAttribute('aria-label',(closed?'Jornada cerrada. ':'Cierre: ')+cutoffText+'. Pozo mayor '+poolText);
    deadline.title=closed?'Jornada cerrada':'Cierre de jugadas: '+cutoffText;
    const long=deadline.querySelector('.gol-info-date .badge-long');
    const short=deadline.querySelector('.gol-info-date .badge-short');
    const pool=deadline.querySelector('.gol-info-pot b');
    const hour=golGames.length&&Number.isFinite(Date.parse(golCutoff))
      ?new Date(golCutoff).toLocaleTimeString('es-PE',{
        timeZone:'America/Lima',hour:'numeric',minute:'2-digit',hour12:true
      }):'';
    deadline.querySelectorAll('.gol-info-time .badge-long, .gol-info-time .badge-short')
      .forEach(el=>{el.textContent=hour?'Hasta las '+hour:'Horario por confirmar';});
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
    if(!await pgRequireAgeDeclaration_())return;
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
      golLocked={};activeCard='A';draft.activeCard='A';
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
    if(!await pgRequireAgeDeclaration_())return;
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
      golLocked={};activeCard='A';draft.activeCard='A';
      delete draft.golBatchRequestId;saveDraft();
      renderGol();toast('Se registraron '+slots.length+' tickets · S/ '+fmt2(total)+'.');
    }catch(err){toast(err.message||'No se confirmó la compra de cartillas.');}
    finally{golBatchPending=false;sendingPlay=false;setAuthBusy(false);renderGol();}
  }
  // Los filtros usan botones HTML propios; los <select> originales mantienen
  // el estado y el evento change para no duplicar la lógica de filtros.
  function syncSportFilters(){
    for(const id of ['matchLeague','matchDate','matchSort']){
      const original=$('#'+id);
      if(!original)continue;
      let control=original.parentNode.querySelector('[data-sports-filter="'+id+'"]');
      if(!control){
        control=document.createElement('div');control.className='sports-filter-ui';
        control.dataset.sportsFilter=id;
        original.insertAdjacentElement('afterend',control);
        original.classList.add('sports-filter-native');
        original.tabIndex=-1;original.setAttribute('aria-hidden','true');
      }
      const open=control.classList.contains('open');
      const selected=original.selectedOptions[0]?.textContent||'Seleccionar';
      const options=[...original.options].map(opt=>
        '<button type="button" role="option" class="sports-filter-option'+(original.value===opt.value?' selected':'')+'" '+
        'data-filter-option="'+esc(id)+'" data-filter-value="'+esc(opt.value)+'" aria-selected="'+(original.value===opt.value)+'">'+
        esc(opt.textContent)+'</button>').join('');
      control.innerHTML='<button type="button" class="sports-filter-trigger" data-filter-trigger="'+esc(id)+'" '+
        'role="combobox" aria-haspopup="listbox" aria-expanded="'+open+'" aria-label="'+
        esc(original.closest('label')?.querySelector('span')?.textContent||id)+'"><span>'+esc(selected)+
        '</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>'+
        '<div class="sports-filter-menu" role="listbox" aria-label="Opciones">'+options+'</div>';
      control.classList.toggle('open',open);
    }
  }
  function filterOptions(){
    const leagueSel=$('#matchLeague'),current=leagueFilter;
    const leagueValues=[...new Set(matches.map(g=>g.league))].sort((a,b)=>a.localeCompare(b,'es'));
    leagueSel.innerHTML='<option value="all">Todas las ligas</option>'+leagueValues.map(l=>`<option value="${esc(l)}">${esc(l)}</option>`).join('');
    if(!leagueValues.includes(current))leagueFilter='all';leagueSel.value=leagueFilter;
    syncSportFilters();
  }
  function sportLocalDateNumber(iso){
    const d=new Date(iso);if(!Number.isFinite(d.getTime()))return NaN;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',day:'2-digit',month:'2-digit',year:'numeric'
    }).formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
    return Date.UTC(parts.year,parts.month-1,parts.day)/86400000;
  }
  function sportDayOffset(iso){return sportLocalDateNumber(iso)-sportLocalDateNumber(new Date());}
  function renderMatch(){
    let games=matches.filter(g=>{
      const offset=sportDayOffset(g.kickoff);
      const withinDate=dateFilter==='all'||(dateFilter==='7'&&offset>=0&&offset<7)||
        (['0','1','2'].includes(dateFilter)&&offset===Number(dateFilter));
      return (leagueFilter==='all'||g.league===leagueFilter) && withinDate &&
        (`${g.home} ${g.away} ${g.league}`).toLocaleLowerCase('es').includes(searchFilter.toLocaleLowerCase('es'));
    });
    if(sortFilter==='league')games.sort((a,b)=>a.league.localeCompare(b.league,'es'));
    else if(sortFilter==='team')games.sort((a,b)=>a.home.localeCompare(b.home,'es'));
    else games.sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    $('#matchSourceLabel').hidden=true;
    const total=games.length;
    $('#matchResultCount').textContent=total+' partido'+(total===1?'':'s')+' disponible'+(total===1?'':'s')+
      (total>matchVisibleLimit?' · Mostrando '+matchVisibleLimit:'');
    $('#matchFixtures').innerHTML=total?games.slice(0,matchVisibleLimit).map(g=>marketCard(g,false)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando próximos partidos…</h3><p>Consultando los partidos disponibles.</p>':
      '<h3>No encontramos partidos con estos filtros</h3><p>Prueba otra fecha o liga. La búsqueda solo incluye las competiciones configuradas en el proveedor.</p>'}</div>`;
    const more=$('#matchLoadMore');if(more){
      const remaining=Math.max(0,total-matchVisibleLimit);
      more.hidden=remaining===0;
      more.querySelector('button').textContent='Ver '+Math.min(MATCH_PAGE_SIZE,remaining)+' partidos más';
    }
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
          renderMatch();renderLive();renderHome();
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
    else output=(data.markets.some(m=>m.tradable===false||m.outcomes?.some(o=>o.tradable===false))?
      '<p class="sport-market-info">Algunas cuotas son informativas: no pueden añadirse al cupón hasta contar con liquidación compatible.</p>':'')+data.markets.map((m,mi)=>{
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
      '<p class="sport-market-heading">Elige una cuota disponible para añadirla a tu cupón.</p>'+
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
    const liveLabel=g.status==='HT'?'Descanso':g.status==='SUSP'?'Suspendido':
      g.minute!==null&&g.minute!==undefined&&Number.isFinite(Number(g.minute))?
        Number(g.minute)+'′':String(g.statusLabel||g.status||'En juego');
    const liveStateLabel=g.status==='HT'?'DESCANSO':g.status==='SUSP'?'SUSPENDIDO':
      g.status==='INT'?'INTERRUMPIDO':'EN VIVO';
    const marketAvailable=!live||g.bettable===true;
    return `<article class="market-card sport-premium-card ${live?'live-card':''}">
      <div class="market-top"><span class="market-league">${sportLeagueBadge(g)}</span>
      <time class="market-kickoff-chip" datetime="${esc(g.kickoff||'')}">
        <span class="sport-event-date">${live?esc(liveStateLabel):esc(schedule.date)}</span>
        <span class="sport-event-time">${live?esc(liveLabel):esc(schedule.time)}</span>
      </time></div>
      <div class="market-body sport-match-teams">
        <span class="market-team">${sportCrest(g.home,g.sportKey,g.homeLogo)}<strong>${esc(g.home)}</strong></span>
        <span class="market-middle">${live&&Array.isArray(g.score)?esc(g.score.map(x=>x===null||x===undefined?'–':String(x)).join(' : ')):'VS'}</span>
        <span class="market-team">${sportCrest(g.away,g.sportKey,g.awayLogo)}<strong>${esc(g.away)}</strong></span>
      </div>
      <div class="market-choices sport-1x2">
      ${outcomes.map((o,i)=>`<button type="button" class="choice ${selected?.outcome===o?'selected':''}" ${marketAvailable&&Number(g.odds?.[i])>1?'':'disabled title="Mercado cerrado o sin cuota verificable"'}
        data-pick="${esc(g.id)}" data-outcome="${o}"
        aria-label="Elegir ${esc(outcomeName[i])} para ${esc(g.home)} contra ${esc(g.away)}">
        <small>${o}</small><b>${Number(g.odds?.[i])>1?fmt2(g.odds[i]):'—'}</b></button>`).join('')}</div>
      ${(!live||marketAvailable)?`<button type="button" class="market-detail-trigger" data-odds-details="${esc(g.id)}"
        aria-expanded="${oddsExpandedId===g.id?'true':'false'}">
        <span class="sport-more-label">${oddsExpandedId===g.id?'Ocultar':'Ver más'}</span>
        ${icon('arrow')}
      </button>${oddsDetailMarkup(g)}`:""}
      ${live?`<footer class="pg-live-footer"><div class="pg-live-inline">
        <span>${esc(g.statusLabel||"Partido en curso")}</span>
        <button type="button" data-live-center="${esc(g.fixtureId||"")}">Match Center</button>
      </div><div class="pg-live-market-state ${marketAvailable?'is-available':'is-paused'}">
        <span class="pg-live-state-dot" aria-hidden="true"></span>
        <span>${esc(g.oddsMessage||(marketAvailable?'Cuotas verificadas (se revalidan al apostar).':'Sin cuotas Live verificadas para este partido.'))}</span>
      </div></footer>`:''}</article>`;
  }
  function addSportsSelection(g,selection){
    expireSportsSlipIfIdle();
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
    touchSportsSlip();renderMatch();renderLive();
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
    if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
    if(!['match','live'].includes(activeView)||!draft.slips.length)return;
    touchSportsSlip();
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
      ${!validStake?'disabled':''}>Colocar apuesta ${icon('arrow')}</button>
    ${mode==='preview'?'<p class="slip-unavailable" role="status">'+(!hasUser()?'Inicia sesión para continuar con el cupón.':'La aceptación monetaria está pendiente de habilitación en el servidor.')+'</p>':''}
    <button id="refreshSportsQuote" type="button" class="sports-quote-refresh"><span aria-hidden="true">↻</span> Actualizar cuotas</button>
    <p class="slip-note">Al colocar la apuesta se aplicará automáticamente la cuota vigente verificada por el servidor. El comprobante mostrará la cuota definitiva.</p>
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

  // Declaración 18+: aceptación expresa de la cuenta autenticada; NO es verificación KYC.
  let pgAgeDeclarationState='UNKNOWN',pgAgePending=null;
  function pgAgeDialog_(){
    let dialog=$('#pgAgeAttestationDialog');
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id='pgAgeAttestationDialog';dialog.className='pg-age-attestation';
    dialog.setAttribute('aria-labelledby','pgAgeAttestTitle');
    dialog.innerHTML=`<div class="pg-age-attestation-body">
      <div class="pg-age-attestation-symbol" aria-hidden="true">18+</div>
      <h2 id="pgAgeAttestTitle">Declaración de mayoría de edad</h2>
      <p>Para continuar, declara que tienes 18 años cumplidos o más y que la información de tu cuenta es verdadera.</p>
      <p class="pg-age-attestation-footnote">Tu decisión se registrará con fecha y hora en tu cuenta. Esta declaración no sustituye la verificación de identidad.</p>
      <button type="button" id="pgAgeAttestYes" class="pg-age-attestation-yes">Declaro que soy mayor de 18 años</button>
      <button type="button" id="pgAgeAttestNo" class="pg-age-attestation-no">No acepto / Soy menor de edad</button>
    </div>`;
    const css=document.createElement('style');css.textContent=`
      .pg-age-attestation{border:1px solid #a58535;border-radius:18px;background:#101923;color:#fff;
        max-width:min(92vw,450px);width:100%;padding:0;box-shadow:0 22px 65px #000b}
      .pg-age-attestation::backdrop{background:rgba(0,0,0,.75);backdrop-filter:blur(4px)}
      .pg-age-attestation-body{padding:28px 25px;text-align:center;display:flex;flex-direction:column;gap:13px}
      .pg-age-attestation-symbol{width:58px;height:58px;border:2px solid #F7C85D;border-radius:100px;
        color:#F7C85D;display:grid;place-items:center;font-weight:900;margin:auto;font-size:22px}
      .pg-age-attestation h2{font:800 23px/1.2 'Outfit',sans-serif;margin:0}
      .pg-age-attestation p{font-size:14px;line-height:1.55;margin:0;color:#e3e9ee}
      .pg-age-attestation .pg-age-attestation-footnote{font-size:12px;color:#a7b3c3}
      .pg-age-attestation button{width:100%;padding:13px 15px;border-radius:10px;font-weight:800;cursor:pointer}
      .pg-age-attestation-yes{color:#141414;background:#F7C85D;border:1px solid #F7C85D}
      .pg-age-attestation-no{color:#fff;background:transparent;border:1px solid #59687a}
      .pg-age-attestation button:focus-visible{outline:3px solid #fff;outline-offset:2px}
    `;
    document.head.appendChild(css);document.body.appendChild(dialog);
    return dialog;
  }
  function pgAskAgeDeclaration_(){
    return new Promise(resolve=>{
      const dialog=pgAgeDialog_();let choice=null;
      const yes=$('#pgAgeAttestYes'),no=$('#pgAgeAttestNo');
      const onYes=()=>{choice='ACCEPTED';dialog.close();};
      const onNo=()=>{choice='DECLINED';dialog.close();};
      const onClose=()=>{
        yes.removeEventListener('click',onYes);no.removeEventListener('click',onNo);
        resolve(choice);
      };
      yes.addEventListener('click',onYes);no.addEventListener('click',onNo);
      dialog.addEventListener('close',onClose,{once:true});
      dialog.showModal();
    });
  }
  async function pgRequireAgeDeclaration_(){
    if(!hasUser())return false;
    if(pgAgeDeclarationState==='ACCEPTED')return true;
    if(pgAgePending)return pgAgePending;
    pgAgePending=(async()=>{
      let current;
      try{current=await remote('ageDeclarationStatus',{sessionToken});}
      catch(err){toast('No se pudo consultar la declaración de edad. Revisa Apps Script.');return false;}
      pgAgeDeclarationState=String(current?.decision||'PENDING');
      if(pgAgeDeclarationState==='ACCEPTED')return true;
      const choice=await pgAskAgeDeclaration_();
      if(!choice)return false;
      try{
        const saved=await remote('saveAgeDeclaration',{sessionToken,decision:choice});
        pgAgeDeclarationState=String(saved?.decision||'PENDING');
        if(pgAgeDeclarationState!=='ACCEPTED')toast('No puedes acceder a las funciones de apuestas.');
        return pgAgeDeclarationState==='ACCEPTED';
      }catch(err){toast(err?.message||'No se pudo guardar la declaración de edad.');return false;}
    })();
    try{return await pgAgePending;}finally{pgAgePending=null;}
  }

  /** Punto de entrada del botón "Colocar apuesta / jugada". */
  async function placeBet(){
    if(sendingPlay)return;
    if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
    if(!draft.slips.length){toast('Selecciona una cuota.');return;}
    if(!hasUser()&&sessionToken){
      setAuthBusy(true,'Restaurando tu sesión…','general');
      try{await refreshAccount();}finally{setAuthBusy(false);}
    }
    if(!hasUser()){
      pendingAfterAuth='bet';openAuth('login');
      toast('Ingresa o regístrate para colocar tu apuesta.');return;
    }
    if(!await pgRequireAgeDeclaration_())return;
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
    if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
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
      delete draft.sportsWalletRequestId;touchSportsSlip();renderMatch();renderLive();
      toast(changed?'Cuotas actualizadas. Al colocar la apuesta se verifican otra vez.':'Cuotas verificadas.');
    }catch(err){toast(err.message||'No se pudo actualizar el cupón.');}
    finally{setAuthBusy(false);}
  }
  /** Apuesta con saldo (principal / bonos): el servidor valida cuotas, descuenta en
   *  Google Sheets, impide saldo negativo y devuelve el saldo oficial. */
  async function placeMoneyBet(mode){
    if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
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
      draft.slips=[];delete draft[requestKey];touchSportsSlip();
      // Saldo OFICIAL devuelto por el servidor (ya descontado en Google Sheets).
      updateAccount(res);
      renderSlips();
      const serverCreatedAt=playHistory.find(h=>String(h.id)===ticket)?.at||res.walletBetCreatedAt;
      showSportsPlayDialog({
        id:ticket,createdAt:serverCreatedAt||new Date().toISOString(),stake:amount,
        isLive:isLiveSportsTicket({selections:placedLegs}),
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
    // Valores oficiales del servidor, enviados junto a la sesión; nunca confiar en el navegador para el mínimo.
    const minTopup=Number(result.topupMinimumPEN);
    if(result.topupMinimumPEN!==undefined&&Number.isFinite(minTopup)&&minTopup>=1&&minTopup<=10000){
      topupMinimumPEN=minTopup;
      if(topupSelection!=='custom'&&Number(topupSelection)<minTopup){
        const nextPreset=[10,20,30,50,100,200,500,1000].find(value=>value>=minTopup);
        topupSelection=nextPreset===undefined?'custom':String(nextPreset);
        if(nextPreset===undefined&&!topupCustom)topupCustom=String(minTopup);
      }
    }
    const minBonus=Number(result.bonusUnlockMinimumPEN);
    if(result.bonusUnlockMinimumPEN!==undefined&&Number.isFinite(minBonus)&&minBonus>=1&&minBonus<=10000)
      bonusUnlockMinimumPEN=minBonus;
    if(Number.isFinite(Number(result.balance)))accountBalance=Number(result.balance);
    if(Number.isFinite(Number(result.paidBalancePEN)))paidBalancePEN=Number(result.paidBalancePEN);
    if(Array.isArray(result.history)){
      playHistory=result.history;
      // No restaurar una jugada ya comprada como borrador editable.
      let cleaned=false;
      for(const ticket of playHistory){
        if(ticket?.type!=='gol'||String(ticket.roundId||'')!==String(golRoundId))continue;
        const slot=String(ticket.slot||'');
        if(!SLOTS.includes(slot)||!Array.isArray(ticket.picks)||ticket.picks.length!==12)continue;
        const local=draft.golCards[slot]||{};
        if(Object.keys(local).length===12&&ticket.picks.every(p=>local[p.id]===p.outcome)){
          draft.golCards[slot]={};delete draft.golRequestIds[slot];cleaned=true;
        }
      }
      if(cleaned)saveDraft();
    }
    // En V5 A-D son borradores reutilizables; lo pagado vive en history.
    if(result.golSlots&&typeof result.golSlots==='object')golLocked={};
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
    $('#walletBonusCondition').textContent='S/ '+fmt2(bonusPendingPEN)+' en bonos pendientes: se activan con tu próxima recarga aprobada de S/ '+fmt2(bonusUnlockMinimumPEN)+' o más.';
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
    return Number.isFinite(n)&&n>=topupMinimumPEN&&n<=10000&&
      Math.abs(Math.round(n*100)-n*100)<0.00001?n:null;
  }
  function renderTopup(){
    const minLabel='S/ '+fmt2(topupMinimumPEN);
    const info=$('#topupMinDescription');
    if(info)info.textContent='Selecciona un monto predeterminado o elige «Otro monto». El mínimo es '+minLabel+'. Continúa a Mercado Pago para conocer los medios de pago disponibles. El saldo se confirma al verificar la operación.';
    const other=$('#rechargeOther');
    if(other)other.min=String(topupMinimumPEN);
    const otherLabel=$('#topupOtherMinLabel');
    if(otherLabel)otherLabel.textContent='Ingresa el importe (mínimo '+minLabel+')';
    document.querySelectorAll('[data-topup-amount]').forEach(el=>{
      const choice=el.dataset.topupAmount;
      el.hidden=choice!=='custom'&&Number(choice)<topupMinimumPEN;
      const active=choice===topupSelection;
      el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));
    });
    $('#rechargeOtherWrap').hidden=topupSelection!=='custom';
    if(document.activeElement!==other)other.value=topupCustom;
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
    if(amount===null){toast('Ingresa un importe válido entre S/ '+fmt2(topupMinimumPEN)+' y S/ 10,000.');return;}
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
    const code=publicReceiptCode(ticket.id,ticket.at,'gol');
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
      (rows||'<p class="profile-info">Pronósticos no disponibles.</p>')+
      receiptQrMarkup(ticket.id);
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
      const kind=isGol?'gol':isLiveSportsTicket(h)?'live':'sports';
      const code=publicReceiptCode(h.id,h.at,kind);
      const title=isGol?'PremiumGol · '+code:(isSports?
        (kind==='live'?'Premium Live · ':'Apuesta deportiva · ')+code:String(h.title||'Jugada'));
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
    pgAgeDeclarationState='UNKNOWN';
    try{
      // Primera sesión: declaración para cuentas nuevas y anteriores, sin aprobar KYC automáticamente.
      Promise.resolve().then(async()=>{
        const declared=await pgRequireAgeDeclaration_();
        if(next==='gol')showView('gol');
        else if(next==='bet')showView('match');
        else if(next==='coupon'&&declared)claimCouponPrompt();
        else showView('account');
        checkMpReturn();
        if(declared)toast('¡Bienvenido! Tu selección se conserva. Pulsa Colocar apuesta cuando quieras confirmar.');
        if(!String(result.user.phone||'').trim())toast('Puedes completar tu WhatsApp en Mi perfil.');
      }).catch(err=>toast(err?.message||'No se pudo comprobar la declaración de edad.'));
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
    sportsWalletEnabled=false;sportsPolicyRequested=false;pgAgeDeclarationState='UNKNOWN';
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

  function pgGolViewState_(state,message=''){
    const loader=$('#golProgramLoader'),content=$('#golProgramContent');
    const text=$('#golLoadingDescription');
    if(loader)loader.hidden=state==='ready';
    if(content)content.hidden=state!=='ready';
    if(text)text.textContent=message||(
      state==='loading'?'Consultando la jornada oficial…':
      state==='empty'?'La próxima jornada está en preparación.':
      'No pudimos consultar la jornada. Intenta nuevamente.');
    const retry=$('#golProgramRetry');if(retry)retry.hidden=state==='loading'||state==='ready';
  }
  async function loadGolProgram(showLoader=false){
    if(!CONFIG.appsScriptUrl){pgGolViewState_('error');return;}
    if(golProgramLoading)return;
    golProgramLoading=true;golProgramLastCheck=Date.now();
    if(showLoader||!golProgramLoaded)pgGolViewState_('loading');
    try{
      const data=await remote('golProgram',{});
      if(!data?.ok||!Array.isArray(data.games))throw Error('Respuesta de programa inválida');
      if(data.games.length===0){
        golGames=[];golCutoff='';golRoundId='';golProgramLoaded=false;
        pgGolViewState_('empty');return;
      }
      if(data.games.length!==12||!data.games.every((g,i)=>String(g.id)===`gol${i+1}`)||
        !Number.isFinite(Date.parse(data.cutoff))||!String(data.roundId||''))
        throw Error('El servidor devolvió una jornada incompleta');
      if(golRoundId!==String(data.roundId)){
        // Reiniciar solo las selecciones NO enviadas; identificadores históricos quedan en backend.
        draft.golCards={A:{},B:{},C:{},D:{}};
        draft.golRequestIds={};delete draft.golBatchRequestId;
        activeCard='A';draft.activeCard='A';golLocked={};
        golRoundId=String(data.roundId);draft.golRoundId=golRoundId;saveDraft();
      }
      golGames=data.games;golCutoff=data.cutoff;
      golJackpotPEN=Number.isFinite(Number(data.jackpotPEN))&&Number(data.jackpotPEN)>=0?
        Number(data.jackpotPEN):10000;
      const heading=$('#golRoundTitle');
      if(heading){
        const times=golGames.map(g=>Date.parse(g.kickoff)).filter(Number.isFinite);
        const first=new Date(Math.min(...times)),last=new Date(Math.max(...times));
        const label=x=>x.toLocaleDateString('es-PE',{timeZone:'America/Lima',day:'numeric',month:'long'});
        heading.textContent='Jornada '+label(first)+' al '+label(last)+' · 12 partidos';
      }
      golProgramLoaded=true;
      renderGol();
      pgGolViewState_('ready');
    }catch(e){
      console.warn('PremiumGol: consulta de jornada falló:',e?.message||e);
      if(showLoader||!golProgramLoaded){golProgramLoaded=false;pgGolViewState_('error');}
    }finally{golProgramLoading=false;}
  }
  function pgHistoryDate_(iso){
    const d=new Date(iso);
    return Number.isFinite(d.getTime())?d.toLocaleDateString('es-PE',{
      timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'}):'Fecha no disponible';
  }
  function pgHistoryStatus_(value){
    return ({PUBLISHED:'Publicada',IN_PROGRESS:'En desarrollo',CONCLUDED:'Concluida',
      ARCHIVED:'Archivada',REVIEW:'En revisión'})[value]||String(value||'Por confirmar');
  }
  async function loadGolResults(page=1){
    const list=$('#golResultsList'),status=$('#golResultsStatus');
    if(!list||golHistoryLoading||!CONFIG.appsScriptUrl)return;
    golHistoryLoading=true;golHistoryExpandedId='';
    list.innerHTML='<div class="pg-history-loading"><span class="sports-loader" aria-hidden="true"></span> Consultando programas…</div>';
    if(status)status.textContent='';
    try{
      const query=String($('#golResultsSearch')?.value||'').trim().slice(0,60);
      const kind=String($('#golResultsKind')?.value||'ALL');
      const state=String($('#golResultsState')?.value||'ALL');
      const from=String($('#golResultsFrom')?.value||'');
      const to=String($('#golResultsTo')?.value||'');
      const data=await remote('golResults',{page,pageSize:10,query,kind,status:state,from,to});
      if(!data?.ok||!Array.isArray(data.rounds))throw Error('No se recibieron los programas');
      const pages=Number(data.totalPages)||Math.max(1,Math.ceil(data.rounds.length/10));
      golHistoryPage=Math.max(1,Math.min(Number(data.page)||page,pages));
      const rows=data.rounds.slice(0,10);
      list.innerHTML=rows.length?rows.map(r=>`<article class="pg-history-card">
        <div class="pg-history-card-top"><div><span class="pg-history-number">Programa ${esc(r.programNumber||'—')}</span>
          <h3>${r.kind==='MID'?'Jornada entre semana':'Jornada de fin de semana'}</h3>
          <span class="pg-history-state">${esc(pgHistoryStatus_(r.status))}</span></div>
          <button type="button" class="pg-history-toggle" data-history-toggle="${esc(r.roundId)}"
            aria-expanded="false">Ver resultados <svg class="pg-history-chevron" aria-hidden="true"><use href="#i-chevron"></use></svg></button></div>
        <div class="pg-history-dates"><span><small>Inicio</small>${esc(pgHistoryDate_(r.windowStart))}</span>
          <span><small>Fin</small>${esc(pgHistoryDate_(r.windowEnd))}</span>
          <span><small>Partidos</small>${Number(r.fixtureCount)||12}</span></div>
        <div class="pg-history-details" data-history-detail="${esc(r.roundId)}" hidden></div>
      </article>`).join(''):'<div class="pg-history-empty">No hay programas para los filtros seleccionados.</div>';
      const total=Number(data.total);
      if(status)status.textContent=Number.isFinite(total)?`${total} programa(s) · Mostrando hasta 10 por página`:
        'Mostrando los programas disponibles';
      const current=$('#golHistoryCurrentPage');if(current)current.textContent=`Página ${golHistoryPage} de ${pages}`;
      const prev=$('#golHistoryPrev'),next=$('#golHistoryNext');
      if(prev)prev.disabled=golHistoryPage<=1;
      if(next)next.disabled=golHistoryPage>=pages;
    }catch(e){
      list.innerHTML='<div class="pg-history-empty">No se pudieron consultar los programas. Inténtalo de nuevo.</div>';
      console.warn('Historial PremiumGol:',e?.message||e);
    }finally{golHistoryLoading=false;}
  }
  async function toggleGolHistoryDetails(id,button){
    if(!/^[a-z0-9_-]{8,90}$/i.test(String(id||'')))return;
    const container=$$('[data-history-detail]').find(el=>el.dataset.historyDetail===id);
    if(!container)return;
    const opened=golHistoryExpandedId===id&&!container.hidden;
    $$('[data-history-detail]').forEach(el=>el.hidden=true);
    $$('[data-history-toggle]').forEach(el=>el.setAttribute('aria-expanded','false'));
    golHistoryExpandedId=opened?'':id;
    if(opened)return;
    container.hidden=false;button.setAttribute('aria-expanded','true');
    container.innerHTML='<p class="pg-history-loading">Consultando resultados de los 12 partidos…</p>';
    try{
      const data=await remote('golResults',{roundId:id});
      if(!data?.ok||data.selected?.roundId!==id)throw Error('Datos no disponibles');
      const selected=data.selected;
      const fmtScore=g=>g.provisional?'0 : 0 (provisional)':
        Array.isArray(g.score)?g.score.map(n=>n==null?'–':String(n)).join(' : '):'—';
      const labels={PENDING:'Pendiente',IN_PROGRESS:'En curso',FINISHED:'Finalizado',REVIEW:'Revisión'};
      container.innerHTML='<div class="pg-history-matches">'+(selected.fixtures||[]).map((g,i)=>
        '<div class="pg-history-match"><span class="pg-history-index">'+String(i+1).padStart(2,'0')+'</span>'+
        '<div><b>'+esc(g.home)+' – '+esc(g.away)+'</b><small>'+esc(g.league||'Fútbol')+
        ' · '+esc(pgHistoryDate_(g.kickoff))+'</small></div><strong>'+esc(fmtScore(g))+'</strong>'+
        '<span class="pg-history-result-status">'+esc(labels[g.status]||g.status)+
          (g.verified?' ✓':'')+'</span></div>').join('')+'</div>'+
        (selected.winners?.definitive?'<div class="pg-history-winners">12 aciertos: '+Number(selected.winners.twelve)+
          ' · 11: '+Number(selected.winners.eleven)+' · 10: '+Number(selected.winners.ten)+'</div>':
          '<p class="pg-history-note">Resultados y ganadores pendientes de verificación. Los 0:0 provisionales no son marcadores definitivos.</p>');
    }catch(e){
      container.textContent='No fue posible consultar los resultados. Intenta de nuevo.';
    }
  }
  async function openLiveMatchCenter(fixtureId){
    if(!/^\d{1,12}$/.test(String(fixtureId||'')))return;
    const dlg=$('#liveMatchCenterDialog'),body=$('#liveMatchCenterBody');
    if(!dlg||!body)return;
    body.textContent='Consultando cronología y estadísticas…';
    if(!dlg.open)dlg.showModal();
    try{
      const data=await remote('liveMatchCenter',{fixtureId});
      if(!data?.ok)throw Error('Sin datos disponibles');
      body.innerHTML='<p class="pg-center-score">'+esc((data.score||[]).map(v=>v??'–').join(' : '))+
        ' · '+esc(data.status?.long||'En juego')+'</p>'+
        '<h4>Cronología del partido</h4>'+
        ((data.events||[]).length?(data.events||[]).map(e=>'<p><b>'+esc(e.minute??'–')+'′</b> '+
          esc(e.team)+' · '+esc(e.type)+' · '+esc(e.detail||'')+' '+esc(e.player||'')+'</p>').join(''):
          '<p>No hay eventos disponibles.</p>')+
        '<h4>Estadísticas</h4>'+
        ((data.statistics||[]).length?(data.statistics||[]).map(team=>'<section><b>'+esc(team.team)+
          '</b>'+((team.items||[]).slice(0,12).map(x=>'<p>'+esc(x.type)+': '+esc(x.value??'–')+'</p>').join(''))+
          '</section>').join(''):'<p>Estadísticas no disponibles.</p>');
    }catch(e){body.textContent='No se pudieron obtener los eventos del partido.';}
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('#golResultsButton')){
      showView('gol-results');return;
    }
    if(event.target.closest('#golResultsBack')){
      showView('gol');return;
    }
    if(event.target.closest('#golProgramRetry')){
      loadGolProgram();return;
    }
    if(event.target.closest('#golResultsReset')){
      const q=$('#golResultsSearch'),kind=$('#golResultsKind'),state=$('#golResultsState'),
        from=$('#golResultsFrom'),to=$('#golResultsTo');
      if(q)q.value='';if(kind)kind.value='ALL';if(state)state.value='ALL';
      if(from)from.value='';if(to)to.value='';
      loadGolResults(1);return;
    }
    if(event.target.closest('#golHistoryPrev')){
      if(!golHistoryLoading&&golHistoryPage>1)loadGolResults(golHistoryPage-1);return;
    }
    if(event.target.closest('#golHistoryNext')){
      if(!golHistoryLoading)loadGolResults(golHistoryPage+1);return;
    }
    const toggler=event.target.closest('[data-history-toggle]');
    if(toggler){toggleGolHistoryDetails(toggler.dataset.historyToggle,toggler);return;}
    const live=event.target.closest('[data-live-center]');
    if(live){openLiveMatchCenter(live.dataset.liveCenter);return;}
    if(event.target.closest('#liveMatchCenterClose')){
      const dlg=$('#liveMatchCenterDialog');if(dlg?.open)dlg.close();
    }
  });
  ['#golResultsKind','#golResultsState','#golResultsFrom','#golResultsTo'].forEach(selector=>
    on(selector,'change',()=>loadGolResults(1)));
  on('#golResultsSearch','input',()=>{
    if(golHistorySearchTimer)clearTimeout(golHistorySearchTimer);
    golHistorySearchTimer=setTimeout(()=>loadGolResults(1),320);
  });
  function toggleMobileFilters(buttonId,panelId){
    const btn=$('#'+buttonId),panel=$('#'+panelId);
    if(!btn||!panel)return;
    const opened=btn.getAttribute('aria-expanded')==='true';
    btn.setAttribute('aria-expanded',String(!opened));
    btn.setAttribute('aria-label',opened?'Mostrar filtros':'Ocultar filtros');
    panel.classList.toggle('pg-filters-open',!opened);
  }
  on('#matchFilterToggle','click',()=>toggleMobileFilters('matchFilterToggle','matchFilterToolbar'));
  on('#golHistoryFilterToggle','click',()=>toggleMobileFilters('golHistoryFilterToggle','golHistoryFilters'));
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
      if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
      sportsWalletSource=pick.dataset.walletChoice==='bonos'?'bonos':'principal';
      sportsWalletMenuOpen=false;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
      touchSportsSlip();renderSlips();return;
    }
    if(sportsWalletMenuOpen&&!e.target.closest('.sports-wallet-combobox')){
      sportsWalletMenuOpen=false;renderSlips();
    }
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&sportsWalletMenuOpen){sportsWalletMenuOpen=false;renderSlips();}
  });
  on('#matchSearch','input',e=>{searchFilter=e.target.value.trim();matchVisibleLimit=MATCH_PAGE_SIZE;renderMatch();});
  on('#matchLeague','change',e=>{leagueFilter=e.target.value;matchVisibleLimit=MATCH_PAGE_SIZE;syncSportFilters();renderMatch();});
  on('#matchDate','change',e=>{dateFilter=e.target.value;matchVisibleLimit=MATCH_PAGE_SIZE;syncSportFilters();renderMatch();});
  on('#matchSort','change',e=>{sortFilter=e.target.value;matchVisibleLimit=MATCH_PAGE_SIZE;syncSportFilters();renderMatch();});
  on('#matchLoadMore','click',e=>{
    if(!e.target.closest('[data-match-more]'))return;
    matchVisibleLimit+=MATCH_PAGE_SIZE;renderMatch();
  });
  document.addEventListener('click',e=>{
    const trig=e.target.closest('[data-filter-trigger]');
    const option=e.target.closest('[data-filter-option]');
    if(trig){
      const wrapper=trig.closest('.sports-filter-ui'),wasOpen=wrapper.classList.contains('open');
      $$('.sports-filter-ui.open').forEach(el=>el.classList.remove('open'));
      if(!wasOpen){wrapper.classList.add('open');trig.setAttribute('aria-expanded','true');}
      else trig.setAttribute('aria-expanded','false');
      return;
    }
    if(option){
      const el=$('#'+option.dataset.filterOption);
      if(!el)return;
      el.value=option.dataset.filterValue;
      el.dispatchEvent(new Event('change',{bubbles:true}));
      $$('.sports-filter-ui.open').forEach(el=>el.classList.remove('open'));
      return;
    }
    if(!e.target.closest('.sports-filter-ui')){
      $$('.sports-filter-ui.open').forEach(el=>{el.classList.remove('open');el.querySelector('.sports-filter-trigger')?.setAttribute('aria-expanded','false');});
    }
  });
  document.addEventListener('keydown',e=>{
    const control=e.target.closest('.sports-filter-ui');
    if(!control)return;
    const opts=[...control.querySelectorAll('[data-filter-option]')],open=control.classList.contains('open');
    const index=opts.indexOf(document.activeElement);
    if(e.key==='Escape'){
      control.classList.remove('open');control.querySelector('.sports-filter-trigger').setAttribute('aria-expanded','false');
      control.querySelector('.sports-filter-trigger').focus();e.preventDefault();
    }else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      if(!open){control.classList.add('open');control.querySelector('.sports-filter-trigger').setAttribute('aria-expanded','true');}
      opts[(index<0?e.key==='ArrowDown'?0:opts.length-1:(index+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length)]?.focus();
      e.preventDefault();
    }else if(e.key==='Enter'&&index<0&&open){opts[0]?.focus();e.preventDefault();}
  });
  document.addEventListener('input',e=>{
    if(e.target.matches('[id^="betStake"]')){
      if(expireSportsSlipIfIdle()){renderMatch();renderLive();toast('El cupón caducó tras una hora de inactividad.');return;}
      // No spin buttons and no mouse-wheel changes: accept only typed digits.
      const clean=e.target.value.replace(/[^0-9]/g,'').slice(0,4);
      if(e.target.value!==clean)e.target.value=clean;
      const v=Number(clean);stake=clean&&Number.isFinite(v)?Math.floor(v):0;
      delete draft.betRequestId;delete draft.sportsDemoRequestId;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId;
      touchSportsSlip();
      $$('input[id^="betStake"]').forEach(el=>{if(el!==e.target)el.value=e.target.value;});
      $$('[id^="slipReturn"]').forEach(el=>el.textContent=slipMoney(stake*combinedOdds()));
      $$('button[id^="placeBet"]').forEach(btn=>{btn.disabled=!Number.isInteger(stake)||stake<1||stake>betCap();});
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
      touchSportsSlip();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="clearBetslip"]')){draft.slips=[];
      delete draft.betRequestId;delete draft.sportsDemoRequestId;
      delete draft.sportsPrivateRequestId;delete draft.sportsWalletRequestId; sportSimReceipt='';touchSportsSlip();renderMatch();renderLive();return;}
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
  // Caducidad real aunque la página permanezca abierta; al volver de otra pestaña
  // se comprueba de inmediato. La sesión y los pronósticos Premium Gold siguen intactos.
  function checkSportsSlipExpiry(){
    if(expireSportsSlipIfIdle()){
      renderMatch();renderLive();
      toast('El cupón se vació después de una hora sin actividad.');
    }
  }
  setInterval(checkSportsSlipExpiry,30000);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')checkSportsSlipExpiry();
  });
  window.addEventListener('focus',checkSportsSlipExpiry);
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
  setInterval(()=>{
    if(document.visibilityState==='visible'&&activeView==='gol'&&!golProgramLoading&&
      Date.now()-golProgramLastCheck>120000)loadGolProgram();
  },60000);
  const hash=location.hash.slice(1);
  const view=hash==='inicio'?'home':hash;
  const returnFromCheckout=new URLSearchParams(location.search).get('mp_return')==='1'||
    Boolean(storedMpCheckout());
  if(returnFromCheckout)accountTab='wallet';
  if(!returnFromCheckout&&['home','gol','gol-results','match','live'].includes(view))
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
    '<div class="sp-row"><span>Código</span><b>'+esc(publicReceiptCode(r.id,r.createdAt,isLiveSportsTicket(r)?'live':'sports'))+'</b></div>'+
    '<div class="sp-row"><span>Fecha</span><b>'+esc(whenTxt)+'</b></div>'+
    '<div class="sp-row"><span>Monto apuesta</span><b>'+amountLabel(Number(r.stake)||0)+'</b></div>'+
    '<div class="sp-row"><span>Pagado con</span><b>'+walletLabel+'</b></div>'+
    '<div class="sp-row"><span>Cuota combinada</span><b>'+fmt2(Number(r.combinedOdds)||1)+'</b></div>'+
    '<div class="sp-row sp-gain"><span>Posible ganancia</span><b>'+amountLabel(Number(r.possibleReturn)||0)+'</b></div>'+
    '<div class="sp-legs">'+(Array.isArray(r.selections)?r.selections:[]).map(s=>
      '<div class="sp-leg"><b>'+esc(s.home)+' · '+esc(s.away)+'</b>'+
      '<span>'+esc(s.marketLabel||'Resultado final')+' — '+esc(s.selectionLabel||s.outcome||'')+'</span>'+
      '<b class="sp-odd">Cuota '+fmt2(Number(s.odd)||1)+'</b></div>'
    ).join('')+'</div>'+receiptQrMarkup(r.id);
  dlg.showModal();
}
function showSportsPlayDetails(id){
  const ticket=playHistory.find(t=>String(t.id)===String(id)&&t.type==='sports');
  if(!ticket){toast('No se encontraron los detalles del cupón.');return;}
  showSportsPlayDialog({id:ticket.id,createdAt:ticket.at,stake:ticket.stake,
    walletSource:String(ticket.note||'').includes('bonos')?'bonos':'principal',
    combinedOdds:ticket.combinedOdds,possibleReturn:ticket.potentialReturn,
    isLive:isLiveSportsTicket(ticket),
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
