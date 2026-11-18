/* PremiumGol · interfaz para créditos virtuales.
 * Los créditos, las cuotas de ejemplo y las jugadas SOLO son válidos tras confirmación del backend.
 * La cartilla y el cupón sin enviar se guardan en este navegador como borrador.
 */
(() => {
  'use strict';
  const CONFIG = window.PREMIUMGOL_CONFIG || {};
  // Los ID OAuth WEB de Google no comienzan por GOCSPX: ese prefijo identifica secretos.
  const validGoogleClientId = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i.test(String(CONFIG.googleClientId||''));
  const DRAFT_KEY = 'premiumgol_draft_20261118';
  const LEGACY_DRAFT_KEY = 'premiumgol_draft_v2';
  // Sesión persistente entre actualizaciones del navegador; caduca por inactividad.
  const SESSION_KEY = 'premiumgol_session_v3';
  const LEGACY_SESSION_KEY = 'premiumgol_session_v2';
  const SESSION_IDLE_MS = 60*60*1000;
  const SESSION_ACTIVITY_THROTTLE_MS = 30*1000;
  const SESSION_HEARTBEAT_MS = 8*60*1000;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];
  const esc = v => String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const fmt = n => new Intl.NumberFormat('es-PE',{maximumFractionDigits:0}).format(Number(n)||0);
  const fmt2 = n => new Intl.NumberFormat('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n)||0);
  const randomId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const fixtureDays = n => {const d=new Date();d.setDate(d.getDate()+n);return d.toLocaleDateString('es-PE',{day:'2-digit',month:'short'}).replace('.','');};
  let draft = {golPicks:{},slips:[]};
  try {draft={...draft,...JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}')};}catch{}
  const SLOTS=['A','B','C','D'];
  draft.golCards=draft.golCards && typeof draft.golCards==='object'?draft.golCards:{A:draft.golPicks||{},B:{},C:{},D:{}};
  for(const slot of SLOTS){if(!draft.golCards[slot]||typeof draft.golCards[slot]!=='object')draft.golCards[slot]={};}
  draft.golRequestIds=draft.golRequestIds||{};
  let activeCard=SLOTS.includes(draft.activeCard)?draft.activeCard:'A';
  let golLocked={};let couponClaimed=false;
  const currentPicks=()=>draft.golCards[activeCard];
  draft.slips = Array.isArray(draft.slips) ? draft.slips : [];
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
  let bonusBalancePEN=0,bonusUnlocked=false,bonusStatement=[],walletWagersEnabled=false,referralActivity=[];
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
  let leagueFilter='all',dateFilter='all',searchFilter='',sortFilter='date',stake=20;
  let topupSelection='5',topupCustom='',topupBusy=false,topupRequestId=null;
  let toastTimer;
  function couponTime(){
    const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Lima',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const hh=Number(parts.find(p=>p.type==='hour')?.value), mm=Number(parts.find(p=>p.type==='minute')?.value);
    return Number.isInteger(hh)&&Number.isInteger(mm)&&mm>=hh&&mm<hh+5;
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
    try{const result=await remote('claimCoupon',{sessionToken});updateAccount(result);$('#couponDialog').close();toast('¡50 créditos de bono añadidos a tu saldo virtual!');}
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
  // Jornada 18–20 nov 2026. Todas las horas son de Perú (UTC−05:00).
  // Se excluyen Cruzeiro–Palmeiras (inicia al cierre) y el amistoso Norrköping–KuPS.
  let golCutoff='2026-11-18T18:30:00-05:00';
  let golGames=[
    ['Grêmio','Bahia','Brasileirão · Serie A','2026-11-18T19:30:00-05:00'],
    ['Vitória','RB Bragantino','Brasileirão · Serie A','2026-11-19T17:30:00-05:00'],
    ['São Paulo','Fluminense','Brasileirão · Serie A','2026-11-19T19:30:00-05:00'],
    ['Orlando City','FC Cincinnati','MLS Cup Playoffs','2026-11-19T19:30:00-05:00'],
    ['Seattle Sounders','Real Salt Lake','MLS Cup Playoffs','2026-11-19T22:00:00-05:00'],
    ['Septemvri Sofia','Lokomotiv Plovdiv','Primera Liga · Bulgaria','2026-11-20T11:00:00-05:00'],
    ['Piast Gliwice','Korona Kielce','Ekstraklasa · Polonia','2026-11-20T12:00:00-05:00'],
    ['Farul Constanța','Universitatea Cluj','SuperLiga · Rumanía','2026-11-20T13:30:00-05:00'],
    ['FC Andorra','CD Leganés','LaLiga Hypermotion · España','2026-11-20T13:30:00-05:00'],
    ['Almere City','NAC Breda','Eerste Divisie · Países Bajos','2026-11-20T14:00:00-05:00'],
    ['Helmond Sport','FC Dordrecht','Eerste Divisie · Países Bajos','2026-11-20T14:00:00-05:00'],
    ['Cercle Brugge','KVC Westerlo','Jupiler Pro League · Bélgica','2026-11-20T14:45:00-05:00']
  ].map(([home,away,league,kickoff],i)=>({id:'gol'+(i+1),home,away,league,kickoff,homeLogo:'',awayLogo:''}));
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
    activeView=name;
    $$('.view').forEach(e=>e.classList.toggle('is-active',e.id===`view-${name}`));
    $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===name));
    if(!skipHash)history.replaceState(null,'',name==='home'?'#inicio':`#${name}`);
    window.PremiumGolMeasurement?.pageView(name);
    if(name==='account')renderAccount();
    if(name==='match'||name==='live'||name==='home'){
      if(!catalogRequested){catalogRequested=true;catalogLoading=true;loadCatalog();}
      if(name==='match')renderMatch();
      else if(name==='live')renderLive();
    }
    if(name==='gol'&&!golProgramRequested){golProgramRequested=true;loadGolProgram();}
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderHome(){
    const withOdds=matches.filter(g=>g.odds?.some(v=>Number(v)>1));
    const featured=[...withOdds,...matches.filter(g=>!withOdds.some(x=>x.id===g.id))].slice(0,3);
    const source='Encuentros de fútbol';
    $('#homeFixtures').innerHTML=featured.length?featured.map(g=>`<article class="preview-card featured-clickable" data-featured-match="${esc(g.id)}" role="button" tabindex="0" aria-label="Ver cuotas de ${esc(g.home)} contra ${esc(g.away)}">
      <div class="preview-card-head"><span>${icon('ball')} ${esc(g.league)}</span><span class="game-date">${esc(visibleDate(g))}</span></div>
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
  // Archivos de insignias contrastados con las páginas de los clubes en Wikimedia Commons.
  // Se cargan como imágenes, sin consumir el límite de API-FOOTBALL ni exponer una clave.
  const golCommonsLogos={
    'Grêmio':'Gremio logo.svg',
    'Bahia':'Esporte Clube Bahia logo.svg',
    'Vitória':'Esporte Clube Vitória (2024).svg',
    'São Paulo':'São Paulo Futebol Clube logo (2022).svg',
    'Fluminense':'Fluminense Football Club.svg',
    'Septemvri Sofia':'Septemvri Sofia (logo).svg',
    'Lokomotiv Plovdiv':'PFC Lokomotiv Plovdiv Logo.svg',
    'FC Andorra':'Logo FC Andorra - 2021.svg',
    'Almere City':'Almere City FC logo.jpg',
    'NAC Breda':'Logo NAC Breda.svg',
    'Universitatea Cluj':'Cfmuniversitateacluj.png',
    'Cercle Brugge':'Logo Cercle Brugge 2022.png'
  };
  const golVerifiedExternal={
    'Piast Gliwice':'https://piast-gliwice.eu/static/upload/store/materialy/file/PIAST_HERB.jpg'
  };
  function golCrest(team,url){
    const official=String(url||'');
    const validOfficial=/^https:\/\/media\.api-sports\.io\/football\/teams\/[1-9]\d*\.png$/.test(official);
    const commons=golCommonsLogos[team];
    const verifiedUrl=commons?'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(commons)+'?width=96':golVerifiedExternal[team];
    const src=validOfficial?official:verifiedUrl||'';
    const fallback=validOfficial&&verifiedUrl?verifiedUrl:'';
    return `<span class="gol-team-crest" aria-hidden="true"><span class="gol-crest-initial">${esc(initials(team))}</span>${src?`<img class="gol-crest-img" src="${esc(src)}" data-gol-logo-fallback="${esc(fallback)}" alt="" loading="lazy" decoding="async">`:''}</span>`;
  }
  function renderGol(){
    const selections=currentPicks(),locked=Boolean(golLocked[activeCard]),closed=golClosed();
    const deadline=$('#golDeadline');
    deadline.classList.toggle('expired',closed);
    deadline.setAttribute('aria-label',closed?'Jornada cerrada: miércoles 18 de noviembre a las 6:30 p. m. · Pozo anunciado S/ 10,000':
      'Juega hasta el miércoles 18 de noviembre, 6:30 p. m. · Pozo acumulado S/ 10,000');
    deadline.title=closed?'Jornada cerrada':'Cierre de jugadas el miércoles 18 de noviembre';
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
    $('#submitGol').disabled=closed||locked||completedPicks()!==12;
    $('#submitGol').innerHTML=closed?'Jornada cerrada':locked?'Jugada registrada ✓':`Colocar jugada ${icon('arrow')}`;
    $('#resetGol').hidden=locked||closed;
    $('#golSlotHint').textContent=closed?'La jornada ha finalizado.':locked?`Jugada ${activeCard} registrada. Elige otra letra para participar de nuevo.`:`Jugada ${activeCard} · ${completedPicks()} de 12 selecciones`;
    $('#golTabs').innerHTML=SLOTS.map(slot=>`<button type="button" data-gol-slot="${slot}" class="${activeCard===slot?'active':''} ${golLocked[slot]?'recorded':''}" aria-pressed="${activeCard===slot}" title="Jugada ${slot}${golLocked[slot]?' registrada':''}">${slot}</button>`).join('');
    const list=golGames.map((g,i)=>({g,i,pick:selections[g.id]})).filter(x=>outcomes.includes(x.pick));
    $('#golSummary').innerHTML=list.length?list.map(({g,i,pick})=>`<div class="gol-summary-row"><span class="num">${String(i+1).padStart(2,'0')}</span><span class="game" title="${esc(g.home)} – ${esc(g.away)}">${esc(g.home)} · ${esc(g.away)}</span><b class="result">${esc(golLabel[outcomes.indexOf(pick)])} · ${esc(outcomeName[outcomes.indexOf(pick)])}</b></div>`).join(''):'<div class="gol-summary-empty">Aquí aparecerán tus pronósticos a medida que selecciones los partidos.</div>';
  }

  let sendingPlay=false;
  function openWalletPayment(){
    const main=$('#walletPayPrincipal'),bonus=$('#walletPayBonuses');
    const enoughMain=Math.round(paidBalancePEN*100)>=500;
    const enoughBonus=bonusUnlocked&&Math.round(bonusBalancePEN*100)>=500;
    if(!enoughMain&&!enoughBonus){showInsufficientFunds();return;}
    main.disabled=!enoughMain;
    bonus.disabled=!enoughBonus;
    main.checked=enoughMain;
    bonus.checked=!enoughMain&&enoughBonus;
    $('#walletPayPrincipalAmount').textContent='S/ '+fmt2(paidBalancePEN);
    $('#walletPayBonusesAmount').textContent='S/ '+fmt2(bonusBalancePEN);
    $('#walletPayBonusesHint').textContent=bonusUnlocked?
      'Bienvenida, referidos y promociones':
      'Se habilita al completar tu primera recarga propia de S/ 5.';
    $('#walletPayNotice').textContent=walletWagersEnabled?
      'Se descontará S/ 5.00 únicamente de la billetera seleccionada.':
      'Las jugadas pagadas con saldo todavía están en preparación.';
    $('#walletPayConfirm').disabled=!walletWagersEnabled;
    if(!$('#walletPayDialog').open)$('#walletPayDialog').showModal();
  }
  async function saveGol(walletSource=''){
    if(golClosed()){toast('La cartilla está cerrada para nuevas jugadas.');renderGol();return;}
    if(golLocked[activeCard]){toast('Esta jugada ya fue registrada. Elige otra letra.');return;}
    if(completedPicks()!==12){toast(`Completa los 12 partidos. Llevas ${completedPicks()} de 12.`);return;}
    if(!hasUser()&&sessionToken){
      setAuthBusy(true,'Restaurando tu sesión…','general');
      try{await refreshAccount();}finally{setAuthBusy(false);}
    }
    if(!hasUser()){pendingAfterAuth='gol';openAuth('login');toast('Ingresa o regístrate para colocar tu jugada.');return;}
    if(!walletSource){openWalletPayment();return;}
    if(!walletWagersEnabled){toast('Las jugadas con saldo todavía no están habilitadas.');return;}
    if(walletSource==='bonos'&&!bonusUnlocked){
      toast('Primero realiza una recarga de al menos S/ 5 para usar tus bonos.');return;
    }
    if((walletSource==='principal'?paidBalancePEN:bonusBalancePEN)<5){
      showInsufficientFunds();return;
    }
    if(sendingPlay)return;
    sendingPlay=true;$('#submitGol').disabled=true;
    setAuthBusy(true,'Guardando tu jugada…','general');
    const slot=activeCard;
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
    const fetchedLabel=catalogUpdatedAt?new Date(catalogUpdatedAt).toLocaleString('es-PE',{
      timeZone:'America/Lima',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
    $('#matchSourceLabel').textContent=catalogLoading?'Cargando encuentros…':
      games.length?'Cuotas de referencia'+(fetchedLabel?' · '+fetchedLabel:''):
      'Por el momento no hay partidos disponibles';
    $('#matchResultCount').textContent=`${games.length} encuentro${games.length===1?'':'s'} encontrado${games.length===1?'':'s'}`;
    $('#matchFixtures').innerHTML=games.length?games.map(g=>marketCard(g,false)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando próximos encuentros…</h3><p>Estamos actualizando los partidos disponibles.</p>':
      '<h3>Por el momento no hay partidos disponibles</h3><p>Puedes explorar PremiumGol mientras se publica la próxima programación.</p><button type="button" class="btn btn-gold btn-mini" data-nav="gol">Ir a PremiumGol</button>'}</div>`;
    renderSlips();
  }
  function renderLive(){
    $('#liveBanner').hidden=!liveGames.length;
    const ts=liveGames[0]?.fetchedAt?new Date(liveGames[0].fetchedAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'';
    $('#liveSourceLabel').textContent=catalogLoading?'Cargando encuentros…':
      liveGames.length?'Cuotas consultadas de encuentros iniciados'+(ts?' · '+ts:''):
      'No hay cuotas en vivo recientes disponibles';
    $('#liveFixtures').innerHTML=liveGames.length?liveGames.map(g=>marketCard(g,true)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando partidos en vivo…</h3><p>Estamos verificando los encuentros en curso.</p>':
      '<h3>Por el momento no hay partidos en vivo</h3><p>Visita PremiumGol o vuelve más tarde para conocer los nuevos encuentros.</p><button type="button" class="btn btn-gold btn-mini" data-nav="gol">Ir a PremiumGol</button>'}</div>`;
    renderSlips();
  }
  function marketCard(g,live){
    const selected=draft.slips.find(s=>s.id===g.id)?.outcome;
    const last=g.marketUpdatedAt&&Number.isFinite(Date.parse(g.marketUpdatedAt))?
      new Date(g.marketUpdatedAt).toLocaleTimeString('es-PE',{
        hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'
      }):'';
    const bookmaker=g.bookmaker?
      '<div class="market-provider">Referencia: '+esc(g.bookmaker)+
      (last?' · cuota consultada '+esc(last):'')+'</div>':'';
    // The Odds API /odds no trae minutos ni marcador, no se inventan.
    return `<article class="market-card ${live?'live-card':''}">
      <div class="market-top"><span class="market-league"><span class="league-icon">✦</span>${esc(g.league)}</span>
      <span class="market-schedule">${live?'<span class="tiny-live"></span> PARTIDO INICIADO':esc(visibleDate(g))}</span></div>
      <div class="market-body"><div class="teams-block">
        <span class="market-team">${badge(g.home,g.colors?.[0])}<span>${esc(g.home)}</span></span>
        <span class="market-middle">VS</span>
        <span class="market-team">${badge(g.away,g.colors?.[1])}<span>${esc(g.away)}</span></span>
      </div></div>
      <div class="market-choices">${outcomes.map((o,i)=>
        `<button type="button" class="choice ${selected===o?'selected':''}" data-pick="${esc(g.id)}"
        data-outcome="${o}" disabled aria-label="Cuota informativa ${esc(outcomeName[i])} para ${esc(g.home)} contra ${esc(g.away)}">
        <small>${o}</small><b>${Number(g.odds?.[i])>1?fmt2(g.odds[i]):'—'}</b></button>`).join('')}</div>
      ${bookmaker}</article>`;
  }
  function changeSelection(id,outcome){
    if(catalogMode==='API_PREVIEW'){toast('Las cuotas consultadas no están disponibles para jugar.');return;}
    const game=allGames().find(g=>g.id===id);if(!game||!outcomes.includes(outcome))return;
    const selected=draft.slips.find(s=>s.id===id)?.outcome===outcome;
    delete draft.betRequestId;
    draft.slips=draft.slips.filter(s=>s.id!==id);
    if(!selected)draft.slips.push({id,outcome,odd:game.odds[outcomes.indexOf(outcome)],home:game.home,away:game.away,isLive:liveGames.some(g=>g.id===id)});
    saveDraft();renderMatch();renderLive();
  }
  const combinedOdds=()=>draft.slips.reduce((p,s)=>p*Number(s.odd||1),1);
  function renderSlips(){
    const count=draft.slips.length;
    const content=`<div class="betslip"><div class="betslip-head"><h3>Mi cupón <span>${count}</span></h3>${count?'<button id="clearBetslip">Vaciar cupón</button>':''}</div>${count?draft.slips.map(s=>`<div class="betslip-item"><div class="slip-team">${esc(s.home)} · ${esc(s.away)}</div><div class="slip-detail"><span>${s.isLive?'En vivo · ':''}${esc(outcomeName[outcomes.indexOf(s.outcome)])} (${esc(s.outcome)})</span><b>${fmt2(s.odd)}</b><button data-remove="${esc(s.id)}" aria-label="Quitar selección">${icon('close')}</button></div></div>`).join('')+`<div class="betslip-footer"><label for="betStake">Tu jugada</label><div class="stake-entry"><input id="betStake" type="number" min="1" max="1000" step="1" value="${stake}" inputmode="numeric"><span>CRÉDITOS</span></div><div class="slip-total"><span>Retorno posible</span><b id="slipReturn">${fmt2(stake*combinedOdds())}</b></div><button id="placeBet" class="btn btn-gold btn-full">Confirmar jugada ${icon('arrow')}</button><p class="slip-note">Créditos virtuales · Cuotas ilustrativas. Sin dinero real.</p></div>`:`<div class="betslip-empty">${icon('ticket')}<strong>Tu jugada comienza aquí</strong><p>Elige una cuota de cualquier partido para añadirla a tu cupón.</p></div>`}</div>`;
    $('#matchBetslip').innerHTML=content;
    $('#liveBetslip').innerHTML=content.replaceAll('id="betStake"','id="betStakeLive"').replaceAll('for="betStake"','for="betStakeLive"').replaceAll('id="slipReturn"','id="slipReturnLive"').replaceAll('id="placeBet"','id="placeBetLive"').replaceAll('id="clearBetslip"','id="clearBetslipLive"');
  }
  async function placeBet(){
    if(catalogMode==='API_PREVIEW'){toast('Las cuotas consultadas no están disponibles para jugar.');return;}
    if(!draft.slips.length){toast('Selecciona al menos un resultado.');return;}
    if(!hasUser()){pendingAfterAuth='bet';openAuth('login');toast('Ingresa o regístrate para guardar tu cupón.');return;}
    if(!Number.isInteger(stake)||stake<1||stake>1000){toast('Ingresa entre 1 y 1,000 créditos.');return;}
    if(accountBalance<stake){showInsufficientFunds();return;}
    if(sendingPlay)return;
    sendingPlay=true;
    try{
      // El servidor vuelve a calcular las cuotas y el saldo. No acepta retornos enviados por el cliente.
      draft.betRequestId=draft.betRequestId||randomId();saveDraft();
      const res=await remote('saveBet',{sessionToken,stake,selections:draft.slips.map(s=>({id:s.id,outcome:s.outcome})),clientRequestId:draft.betRequestId});
      updateAccount(res);draft.slips=[];delete draft.betRequestId;saveDraft();renderAll();toast(`¡Jugada registrada! ${fmt(stake)} créditos utilizados.`);
    }catch(e){if(/saldo virtual insuficiente|créditos insuficientes/i.test(String(e.message||'')))showInsufficientFunds();else toast(e.message||'No se pudo registrar el cupón.');}
    finally{sendingPlay=false;}
  }
  function updateAccount(result){
    if(result.user)account=result.user;
    if(Number.isSafeInteger(Number(result.referralCount)))referralsJoined=Number(result.referralCount);
    if(Array.isArray(result.referrals))referralActivity=result.referrals;
    if(Number.isFinite(Number(result.bonusBalancePEN)))bonusBalancePEN=Number(result.bonusBalancePEN);
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
    $('#walletBonusCondition').hidden=bonusUnlocked||bonusBalancePEN<=0;
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

  /** Dinero confirmado y créditos virtuales son balances distintos. */
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
      $('#paidBalancePEN').textContent='S/ '+fmt2(paidBalancePEN);
      renderHeader();
      $('#accountBalance').textContent='S/ '+fmt2(paidBalancePEN);
      renderTopupOrder(result,returning);
      await loadTopupOrders();
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
    return status==='GANADOR'?'Ganador':status==='SIN_PREMIO'?'Sin premio':'Pendiente';
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
      '<div><span>Resultado</span><b>'+esc(playResultLabel(ticket.resultStatus))+'</b></div></div>'+
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
    $('#bonusStatementEligibility').textContent=bonusUnlocked?
      'Bonos habilitados tras tu primera recarga aprobada.':
      'Para usar tus bonos, primero deberás realizar una recarga.';
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
      const code=isGol?String(h.code||('PG-'+String(h.id||'').slice(-10).toUpperCase())):'';
      const cost='S/ '+fmt2(h.stake);
      return '<article class="history-row"><span class="history-icon">'+icon(isGol?'trophy':'ticket')+
        '</span><div class="history-row-main"><b>'+
        esc(isGol?'PremiumGol · '+code:h.title)+'</b><span>'+esc(cost)+
        '</span><time>'+esc(when(h.at))+'</time></div>'+
        (isGol?'<span class="history-row-status">'+esc(playResultLabel(h.resultStatus))+'</span><button type="button" class="btn btn-outline btn-mini" data-play-details="'+
        esc(h.id)+'">Ver detalles</button>':'<span class="history-row-status">REGISTRADA</span>')+
        '</article>';
    };
    const empty=`<div class="empty-state">${icon('ticket')}Aún no tienes jugadas registradas.</div>`;
    $('#recentHistory').innerHTML=playHistory.length?playHistory.slice(0,4).map(one).join(''):empty;
    $('#fullHistory').innerHTML=playHistory.length?playHistory.map(one).join(''):empty;
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
      const status=awarded?'Bono acreditado':verified?'Bono en verificación':'Registro confirmado';
      return '<div class="referral-activity-item">'+
        '<div class="referral-activity-user"><small>Amigo invitado</small><strong>'+esc(r.label||'Invitado')+'</strong></div>'+
        '<div class="referral-activity-state"><small>Estado</small><span>'+esc(status)+'</span></div>'+
        '<div class="referral-activity-date"><small>Registro</small><time>'+esc(date)+'</time></div>'+
        '<div class="referral-activity-amount"><small>Bono recibido</small><b>'+(awarded?'+ S/ 5.00':'S/ 0.00')+'</b></div>'+
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
      const detail=referred?
        (event.referralName?event.referralName+' · ':'')+date:
        (event.category||'MOVIMIENTO')+' · '+date;
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
    const next=pendingAfterAuth;pendingAfterAuth=null;
    accountTab='overview';
    try{
      if(next==='gol')saveGol();
      else if(next==='bet')placeBet();
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
    account=null;accountBalance=0;paidBalancePEN=0;bonusBalancePEN=0;bonusUnlocked=false;referralActivity=[];recentTopupOrders=[];playHistory=[];golLocked={};couponClaimed=false;
    clearSavedSession();lastSessionInteraction=0;sessionCreatedAt=0;lastSessionVerification=0;
    closeAccountMenu();closeWalletBreakdown();referralsJoined=0;
    bonusStatement=[];walletWagersEnabled=false;
    renderAll();showView('home');
    toast(reason==='idle'?'Tu sesión terminó tras una hora de inactividad.':'Has cerrado sesión.');
    if(old)remote('signout',{sessionToken:old}).catch(()=>{});
  }
  // Puente Google Apps Script: el web app sirve un iframe HtmlService que llama google.script.run.
  // No se intenta fetch() directo de script.google.com, pues las redirecciones y CORS no son fiables.
  const bridge={ready:false,win:null,origin:null,pending:new Map(),queue:[],nonce:randomId()};
  function sendBridgeRequest(packet){
    if(!bridge.ready){bridge.queue.push(packet);return;}
    bridge.win.postMessage({scope:'premiumgol',type:'request',id:packet.id,action:packet.action,data:packet.data},bridge.origin);
  }
  function remote(action,data={}){
    if(!CONFIG.appsScriptUrl) return Promise.reject(new Error('El inicio de sesión estará disponible al conectar el servidor de PremiumGol.'));
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
      }catch(err){
        if(sessionToken!==checkedToken)return;
        // Solo el servidor puede invalidar una sesión guardada.
        if(/Sesión vencida\. Vuelve a ingresar\./.test(String(err?.message||''))){
          sessionToken='';account=null;accountBalance=0;paidBalancePEN=0;
          bonusBalancePEN=0;bonusUnlocked=false;bonusStatement=[];
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
      if(data?.roundId!=='premiumgol12-jornada-20261118'||!Array.isArray(data.games)||data.games.length!==12)return;
      if(!data.games.every((g,i)=>String(g.id)===`gol${i+1}`))return;
      golGames=data.games;
      if(/^2026-11-18T18:30:00-05:00$/.test(String(data.cutoff||'')))golCutoff=data.cutoff;
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
      const verified=data.mode==='API_PREVIEW'&&data.source==='The Odds API';
      catalogUpdatedAt=verified&&data.updatedAt?String(data.updatedAt):null;
      catalogWarning=verified?(data.warning||''):'Datos deportivos todavía no disponibles.';
      matches=verified&&Array.isArray(data.games?.match)?data.games.match:[];
      liveGames=verified&&Array.isArray(data.games?.live)?data.games.live:[];
      if(catalogMode==='API_PREVIEW')draft.slips=[];
      // Una actualización del catálogo invalida selecciones cuyo mercado ya no está disponible.
      const ids=new Set(allGames().map(g=>g.id));
      draft.slips=draft.slips.filter(s=>ids.has(s.id));saveDraft();
      renderAll();
    }catch(e){
      catalogLoading=false;
      catalogWarning=!bridge.ready?
        'No se pudo conectar con Apps Script. Revisa el despliegue y FRONTEND_ORIGIN.':
        'No fue posible obtener los partidos. Revisa las ejecuciones de Apps Script y vuelve a intentarlo.';
      matches=[];liveGames=[];catalogUpdatedAt=null;renderAll();
      console.warn('Catálogo deportivo sin respuesta:',e.message);
    }
  }
  $('#comingSoonBack').addEventListener('click',backFromComingSoon);
  $('#comingSoonDialog').addEventListener('cancel',e=>{e.preventDefault();backFromComingSoon();});
  $('#comingSoonDialog').addEventListener('click',e=>{
    if(e.target===$('#comingSoonDialog'))backFromComingSoon();
  });
  $('#loginTop').addEventListener('click',e=>{
    if(sessionRestoring)return;
    if(sessionToken&&!hasUser()){refreshAccount();return;}
    if(hasUser())toggleAccountMenu(e.currentTarget);
    else openAuth('login');
  });
  $('#registerTop').addEventListener('click',()=>{
    if(sessionToken){if(!sessionRestoring)refreshAccount();return;}
    openAuth('register');
  });
  $('#walletTop').addEventListener('click',toggleWalletBreakdown);
  $('#copyReferral').addEventListener('click',async()=>{
    const value=$('#referralLink').value;
    if(!/^https:\/\/premiumgol\.website\/\?ref=[A-Z0-9]{10,16}$/.test(value))return;
    try{await navigator.clipboard.writeText(value);toast('Enlace copiado. Compártelo con tus amigos.');}
    catch(e){
      $('#referralLink').select();
      toast('Selecciona el enlace para copiarlo y compartirlo.');
    }
  });
  // El registro se abre desde la pestaña «Registrarse» del modal de acceso.
  $('#emailAccessToggle').addEventListener('click',()=>{
    const panel=$('#emailAccessPanel');panel.hidden=!panel.hidden;
    $('#emailAccessToggle').setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)$('#authEmail').focus();
  });
  $('#tabLogin').addEventListener('click',()=>setAuthMode('login'));
  $('#tabRegister').addEventListener('click',()=>setAuthMode('register'));
  $('#closeAuth').addEventListener('click',closeAuth);
  $('#authDialog').addEventListener('click',e=>{if(e.target===$('#authDialog')&&!authBusy)closeAuth();});
  $('#authDialog').addEventListener('cancel',e=>{if(authBusy)e.preventDefault();});
  $('#googleUnavailable').hidden=validGoogleClientId && Boolean(CONFIG.appsScriptUrl);
  $('#emailForm').addEventListener('submit',async e=>{
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
  $('#verifyForm').addEventListener('submit',async e=>{
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
  $('#backToEmail').addEventListener('click',()=>{$('#verifyForm').hidden=true;$('#emailForm').hidden=false;});
  $('#submitGol').addEventListener('click',()=>saveGol());
  $('#walletPayClose').addEventListener('click',()=>$('#walletPayDialog').close());
  $('#walletPayConfirm').addEventListener('click',()=>{
    const wallet=document.querySelector('input[name="walletPayment"]:checked')?.value;
    if(!wallet||!walletWagersEnabled)return;
    $('#walletPayDialog').close();saveGol(wallet);
  });
  $('#walletPayDialog').addEventListener('click',e=>{
    if(e.target===$('#walletPayDialog'))e.target.close();
  });
  $('#closeInsufficientFunds').addEventListener('click',()=>$('#insufficientFundsDialog').close());
  $('#insufficientFundsRecharge').addEventListener('click',()=>{$('#insufficientFundsDialog').close();openAccountTab('wallet');});
  $('#insufficientFundsDialog').addEventListener('click',e=>{if(e.target===$('#insufficientFundsDialog'))e.target.close();});
  $('#closePlayDetails').addEventListener('click',()=>$('#playDetailsDialog').close());
  $('#donePlayDetails').addEventListener('click',()=>$('#playDetailsDialog').close());
  $('#playDetailsDialog').addEventListener('click',e=>{
    if(e.target===$('#playDetailsDialog'))$('#playDetailsDialog').close();
  });
  $('#openGolRules').addEventListener('click',()=>$('#golRulesDialog').showModal());
  $('#closeGolRules').addEventListener('click',()=>$('#golRulesDialog').close());
  $('#acceptGolRules').addEventListener('click',()=>$('#golRulesDialog').close());
  $('#golRulesDialog').addEventListener('click',e=>{if(e.target===$('#golRulesDialog'))$('#golRulesDialog').close();});
  $('#authBusyOverlay').addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('resize',()=>{if(accountMenuOpen)closeAccountMenu();if(walletBreakdownOpen)closeWalletBreakdown();});
  $('#resetGol').addEventListener('click',()=>{if(golLocked[activeCard])return;draft.golCards[activeCard]={};delete draft.golRequestIds[activeCard];saveDraft();renderGol();toast('Se borró la selección de la jugada '+activeCard+'.');});
  $('#premiumCoupon').addEventListener('click',claimCouponPrompt);
  $('#closeCoupon').addEventListener('click',()=>$('#couponDialog').close());
  $('#couponDialog').addEventListener('click',e=>{if(e.target===$('#couponDialog'))$('#couponDialog').close();});
  $('#claimCoupon').addEventListener('click',claimCoupon);
  $('#accountSignout').addEventListener('click',signout);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&accountMenuOpen){closeAccountMenu();e.preventDefault();}
    if(e.key==='Escape'&&walletBreakdownOpen){closeWalletBreakdown();e.preventDefault();}
    if(e.key==='Escape'&&authBusy)e.preventDefault();
  });
  $('#rechargeOther').addEventListener('input',e=>{topupCustom=e.target.value;topupRequestId=null;$('#rechargeOrder').hidden=true;renderTopup();});
  $('#rechargeGenerate').addEventListener('click',createTopupRequest);
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
  $('#profileForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!hasUser())return;
    const btn=$('#profileSave');btn.disabled=true;
    setAuthBusy(true,'Guardando tu perfil…','general');
    try{const res=await remote('updateProfile',{sessionToken,firstName:$('#profileFirst').value.trim(),lastName:$('#profileLast').value.trim(),countryCode:$('#profileCountry').value,phone:$('#profilePhone').value.trim(),docType:$('#profileDocType').value,docNumber:$('#profileDocNumber').value.trim()});updateAccount(res);toast('Tus datos fueron actualizados.');}
    catch(err){toast(err.message||'No se pudieron guardar tus datos.');}finally{btn.disabled=false;setAuthBusy(false);}
  });
  $('#matchSearch').addEventListener('input',e=>{searchFilter=e.target.value.trim();renderMatch();});
  $('#matchLeague').addEventListener('change',e=>{leagueFilter=e.target.value;renderMatch();});
  $('#matchDate').addEventListener('change',e=>{dateFilter=e.target.value;renderMatch();});
  $('#matchSort').addEventListener('change',e=>{sortFilter=e.target.value;renderMatch();});
  document.addEventListener('input',e=>{
    if(e.target.matches('[id^="betStake"]')){
      const v=Number(e.target.value);stake=Number.isFinite(v)?Math.floor(v):0;delete draft.betRequestId;
      $$('input[id^="betStake"]').forEach(el=>{if(el!==e.target)el.value=e.target.value;});
      $$('[id^="slipReturn"]').forEach(el=>el.textContent=fmt2(stake*combinedOdds()));
    }
  });
  document.addEventListener('click',e=>{
    if(accountMenuOpen&&!e.target.closest('#accountMenu,#loginTop,[data-nav="account"]'))closeAccountMenu();
    if(walletBreakdownOpen&&!e.target.closest('#walletTop,#walletBreakdown'))closeWalletBreakdown();
    const logout=e.target.closest('[data-account-signout]');
    if(logout){e.preventDefault();closeAccountMenu();signout();return;}
    const slot=e.target.closest('[data-gol-slot]');if(slot){activeCard=slot.dataset.golSlot;draft.activeCard=activeCard;saveDraft();renderGol();return;}
    const gol=e.target.closest('[data-gol-id]');if(gol){if(golLocked[activeCard])return;delete draft.golRequestIds[activeCard];currentPicks()[gol.dataset.golId]=gol.dataset.golOutcome;saveDraft();renderGol();return;}
    const highlighted=e.target.closest('[data-featured-match]');if(highlighted){e.preventDefault();openFeaturedGame(highlighted.dataset.featuredMatch);return;}
    if(e.target.closest('[data-retry-sports]')){
      if(!catalogLoading){catalogLoading=true;catalogWarning='';renderAll();loadCatalog();}
      return;
    }
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
    const pick=e.target.closest('[data-pick]');if(pick){changeSelection(pick.dataset.pick,pick.dataset.outcome);return;}
    const rem=e.target.closest('[data-remove]');if(rem){draft.slips=draft.slips.filter(s=>s.id!==rem.dataset.remove);delete draft.betRequestId;saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="clearBetslip"]')){draft.slips=[];delete draft.betRequestId;saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="placeBet"]'))placeBet();
  });
  document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-featured-match]')){e.preventDefault();openFeaturedGame(e.target.dataset.featuredMatch);}});
  // Aviso informativo de edad mínima desde el footer.
  $('#pgAgeNoticeButton').addEventListener('click',()=>{
    const dialog=$('#pgAgeNotice');
    if(!dialog.open)dialog.showModal();
  });
  $('#pgAgeClose').addEventListener('click',()=>$('#pgAgeNotice').close());
  $('#pgAgeConfirm').addEventListener('click',()=>$('#pgAgeNotice').close());
  $('#pgAgeNotice').addEventListener('click',e=>{
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
  renderAll();
  refreshCoupon();setInterval(refreshCoupon,15000);
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
  // El navegador consulta la caché de Apps Script; nunca lleva la clave de The Odds API.
  setInterval(()=>{
    if(document.visibilityState==='visible'&&['match','live'].includes(activeView)&&!authBusy)loadCatalog();
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
})();
