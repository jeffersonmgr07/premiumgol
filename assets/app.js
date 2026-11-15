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
  function sessionExpired(){
    const now=Date.now();
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
  let recentTopupOrders = [];
  let playHistory = [];
  let activeView='home',accountTab='overview',pendingAfterAuth=null,authMode='login',catalogMode='API_PREVIEW';
  let accountMenuOpen=false,authBusy=false,referralsJoined=0;
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
  function toggleAccountMenu(source){
    if(!hasUser()){openAuth('login');return;}
    accountMenuOpen=!accountMenuOpen;
    const menu=$('#accountMenu');
    menu.hidden=!accountMenuOpen;
    if(accountMenuOpen&&window.matchMedia('(max-width:900px)').matches){
      const anchor=source?.closest?.('button')||$('[data-nav="account"]');
      const rect=anchor.getBoundingClientRect();
      const width=Math.min(225,window.innerWidth-24);
      const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.right-width));
      menu.style.left=left+'px';
      menu.style.bottom=Math.max(10,window.innerHeight-rect.top+8)+'px';
      menu.style.right='auto';menu.style.top='auto';
    }else{
      menu.style.left='';menu.style.bottom='';menu.style.right='';menu.style.top='';
    }
    $('#loginTop').setAttribute('aria-expanded',String(accountMenuOpen));
    $('[data-nav="account"]')?.setAttribute('aria-expanded',String(accountMenuOpen));
    if(accountMenuOpen)menu.querySelector('button')?.focus({preventScroll:true});
  }
  function openAccountTab(tab){
    if(!['overview','history','wallet','profile'].includes(tab))return;
    accountTab=tab;closeAccountMenu();showView('account');
    renderAccount();if(tab==='wallet')loadTopupOrders();
  }
  let catalogWarning='',catalogLoading=false,catalogRequested=false,golProgramRequested=false;
  let leagueFilter='all',dateFilter='all',searchFilter='',sortFilter='date',stake=20;
  let topupSelection='30',topupCustom='',topupBusy=false,topupRequestId=null;
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
  // Partidos y cuotas llegan únicamente desde API-FOOTBALL a través de Apps Script.
  // Nunca pintar datos ficticios como cuotas disponibles.
  let matches=[];
  let liveGames=[];
  const hasUser = () => Boolean(account && sessionToken && !sessionExpired());
  const allGames = () => [...matches,...liveGames];
  const visibleDate = g => g.dateLabel || `${fixtureDays(g.day||0)} · ${g.time||''}`;
  function initials(s){return String(s).split(' ').map(t=>t[0]).slice(0,2).join('').toUpperCase();}
  function badge(s,color){return `<span class="badge-crest" style="--crest:${/^#[0-9a-f]{6}$/i.test(color||'')?color:'#4c769d'}">${esc(initials(s))}</span>`;}
  function showView(name,skipHash=false){
    closeAccountMenu();
    if(!['home','gol','match','live','account'].includes(name))name='home';
    if(name==='account'&&!hasUser()){
      if(sessionToken){
        setAuthBusy(true,'Restaurando tu sesión…','general');
        refreshAccount().then(()=>{
          if(hasUser())showView('account');
          else if(sessionToken)toast('No se pudo recuperar la sesión. Comprueba tu conexión e inténtalo de nuevo.');
          else openAuth('login');
        }).finally(()=>setAuthBusy(false));
      }else{pendingAfterAuth='account';openAuth('login');}
      return;
    }
    activeView=name;
    $$('.view').forEach(e=>e.classList.toggle('is-active',e.id===`view-${name}`));
    $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===name));
    if(!skipHash)history.replaceState(null,'',name==='home'?'#inicio':`#${name}`);
    if(name==='account')renderAccount();
    if(name==='match'||name==='live'){
      if(!catalogRequested){catalogRequested=true;catalogLoading=true;loadCatalog();}
      if(name==='match')renderMatch();
      else renderLive();
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
      'Límite de participación: miércoles 18 de noviembre a las 6:30 p. m. · Pozo anunciado S/ 10,000');
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
  async function saveGol(){
    if(golClosed()){toast('La cartilla está cerrada para nuevas jugadas.');renderGol();return;}
    if(golLocked[activeCard]){toast('Esta jugada ya fue registrada. Elige otra letra.');return;}
    if(completedPicks()!==12){toast(`Completa los 12 partidos. Llevas ${completedPicks()} de 12.`);return;}
    if(!hasUser()&&sessionToken){
      setAuthBusy(true,'Restaurando tu sesión…','general');
      try{await refreshAccount();}finally{setAuthBusy(false);}
    }
    if(!hasUser()){pendingAfterAuth='gol';openAuth('login');toast('Ingresa o regístrate para colocar tu jugada.');return;}
    if(accountBalance<5){toast('Saldo insuficiente. Cada jugada requiere 5 créditos virtuales.');return;}
    if(sendingPlay)return;
    sendingPlay=true;$('#submitGol').disabled=true;
    setAuthBusy(true,'Guardando tu jugada…','general');
    const slot=activeCard;
    try{
      const picks=golGames.map(g=>({id:g.id,outcome:draft.golCards[slot][g.id]}));
      draft.golRequestIds[slot]=draft.golRequestIds[slot]||randomId();saveDraft();
      const res=await remote('savePremiumGol',{sessionToken,slot,picks,clientRequestId:draft.golRequestIds[slot]});
      updateAccount(res);delete draft.golRequestIds[slot];saveDraft();
      const next=SLOTS.find(s=>!golLocked[s]);if(next){activeCard=next;draft.activeCard=next;saveDraft();}
      renderGol();toast(`¡Jugada ${slot} registrada! Se descontaron 5 créditos virtuales.`);
    }catch(e){toast(e.message||'No se pudo guardar la jugada.');}
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
    $('#matchSourceLabel').textContent=catalogLoading?'Cargando encuentros…':games.length?'Encuentros disponibles':'Por el momento no hay partidos disponibles';
    $('#matchResultCount').textContent=`${games.length} encuentro${games.length===1?'':'s'} encontrado${games.length===1?'':'s'}`;
    $('#matchFixtures').innerHTML=games.length?games.map(g=>marketCard(g,false)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando próximos encuentros…</h3><p>Estamos actualizando los partidos disponibles.</p>':
      '<h3>Por el momento no hay partidos disponibles</h3><p>Puedes explorar PremiumGol mientras se publica la próxima programación.</p><button type="button" class="btn btn-gold btn-mini" data-nav="gol">Ir a PremiumGol</button>'}</div>`;
    renderSlips();
  }
  function renderLive(){
    $('#liveBanner').hidden=!liveGames.length;
    const ts=liveGames[0]?.fetchedAt?new Date(liveGames[0].fetchedAt).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit',timeZone:'America/Lima'}):'';
    $('#liveSourceLabel').textContent=catalogLoading?'Cargando encuentros…':liveGames.length?'Partidos en vivo'+(ts?' · '+ts:''):'Por el momento no hay partidos en vivo';
    $('#liveFixtures').innerHTML=liveGames.length?liveGames.map(g=>marketCard(g,true)).join(''):
      `<div class="empty-state premium-empty-sports">${catalogLoading?'<span class="sports-loader" aria-hidden="true"></span><h3>Buscando partidos en vivo…</h3><p>Estamos verificando los encuentros en curso.</p>':
      '<h3>Por el momento no hay partidos en vivo</h3><p>Visita PremiumGol o vuelve más tarde para conocer los nuevos encuentros.</p><button type="button" class="btn btn-gold btn-mini" data-nav="gol">Ir a PremiumGol</button>'}</div>`;
    renderSlips();
  }
  function marketCard(g,live){
    const selected=draft.slips.find(s=>s.id===g.id)?.outcome;
    return `<article class="market-card ${live?'live-card':''}"><div class="market-top"><span class="market-league"><span class="league-icon">✦</span>${esc(g.league)}</span><span class="market-schedule">${live?`<span class="tiny-live"></span> ${Number(g.minute)||0}' EN VIVO`:esc(visibleDate(g))}</span></div><div class="market-body"><div class="teams-block"><span class="market-team">${badge(g.home,g.colors?.[0])}<span>${esc(g.home)}</span></span><span class="market-middle">${live?'':'VS'}</span><span class="market-team">${badge(g.away,g.colors?.[1])}<span>${esc(g.away)}</span></span></div>${live?`<span class="market-score">${Number(g.score?.[0])||0} <small>:</small> ${Number(g.score?.[1])||0}</span>`:''}</div><div class="market-choices">${outcomes.map((o,i)=>`<button type="button" class="choice ${selected===o?'selected':''}" data-pick="${esc(g.id)}" data-outcome="${o}" ${catalogMode==='API_PREVIEW'||!Number.isFinite(Number(g.odds?.[i]))?'disabled':''} aria-label="${outcomeName[i]} para ${esc(g.home)} contra ${esc(g.away)}"><small>${o}</small><b>${g.odds?.[i]?fmt2(g.odds[i]):'—'}</b></button>`).join('')}</div></article>`;
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
    if(sendingPlay)return;
    sendingPlay=true;
    try{
      // El servidor vuelve a calcular las cuotas y el saldo. No acepta retornos enviados por el cliente.
      draft.betRequestId=draft.betRequestId||randomId();saveDraft();
      const res=await remote('saveBet',{sessionToken,stake,selections:draft.slips.map(s=>({id:s.id,outcome:s.outcome})),clientRequestId:draft.betRequestId});
      updateAccount(res);draft.slips=[];delete draft.betRequestId;saveDraft();renderAll();toast(`¡Jugada registrada! ${fmt(stake)} créditos utilizados.`);
    }catch(e){toast(e.message||'No se pudo registrar el cupón.');}
    finally{sendingPlay=false;}
  }
  function updateAccount(result){
    if(result.user)account=result.user;
    if(Number.isSafeInteger(Number(result.referralCount)))referralsJoined=Number(result.referralCount);
    if(Number.isFinite(Number(result.balance)))accountBalance=Number(result.balance);
    if(Number.isFinite(Number(result.paidBalancePEN)))paidBalancePEN=Number(result.paidBalancePEN);
    if(Array.isArray(result.history))playHistory=result.history;
    if(result.golSlots&&typeof result.golSlots==='object'){golLocked=result.golSlots;for(const slot of SLOTS){if(golLocked[slot]?.picks){draft.golCards[slot]=Object.fromEntries(golLocked[slot].picks.map(p=>[p.id,p.outcome]));}}saveDraft();}
    if(typeof result.couponClaimed==='boolean')couponClaimed=result.couponClaimed;
    renderAll();
  }
  function renderHeader(){
    $('#walletTop').hidden=!hasUser();
    $('#topBalance').textContent=fmt2(accountBalance);
    $('#loginTopLabel').textContent=hasUser()?'Mi cuenta':'Ingresar';
    $('#loginTop').setAttribute('aria-label',hasUser()?'Abrir menú de Mi cuenta':'Ingresar o registrarse');
    $('#loginTop').setAttribute('aria-haspopup',hasUser()?'menu':'false');
    $('[data-nav="account"]')?.setAttribute('aria-haspopup',hasUser()?'menu':'false');
    $('#loginTop').setAttribute('aria-expanded',String(hasUser()&&accountMenuOpen));
    $('#registerTop').hidden=hasUser();
  }
  function chosenTopup(){
    const n=topupSelection==='custom'?Number(topupCustom):Number(topupSelection);
    return Number.isFinite(n)&&n>=30&&n<=10000&&Math.round(n*100)===n*100?n:null;
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
  const paymentLabels={APPROVED:'Pago aprobado',PENDING:'Pendiente de pago',
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
      returning?'El pago aún no aparece aprobado. Puedes volver a consultar más tarde.':
      'Tu orden está registrada. Continúa al checkout para escoger cómo pagar.';
    box.innerHTML='<div class="recharge-order-head"><span class="recharge-order-icon">'+icon('wallet')+
      '</span><div><strong>'+esc(paymentStatusLabel(order.status))+
      '</strong><span>Orden de recarga</span></div></div><div class="recharge-order-data">'+
      '<span class="recharge-order-badge">S/ '+fmt2(order.amount)+'</span>'+
      '<span class="recharge-order-badge is-pending">'+esc(String(order.status))+
      '</span></div><p class="recharge-order-small">'+detail+'</p>'+
      (url?'<button type="button" class="btn btn-gold btn-full" data-mp-pay="'+esc(url)+
      '">Continuar con Mercado Pago</button>':'');
  }
  function renderTopupHistory(){
    const holder=$('#topupHistory');
    if(!holder)return;
    holder.innerHTML=recentTopupOrders.length?recentTopupOrders.map(o=>{
      const url=o.status==='APPROVED'?'':mpSafeUrl(o.checkoutUrl);
      const id=String(o.orderId||'');
      return '<div class="topup-history-item"><div><strong>S/ '+fmt2(o.amount)+
        '</strong><span>'+esc(paymentStatusLabel(o.status))+
        '</span></div><div class="topup-history-actions">'+
        '<button type="button" data-topup-check="'+esc(id)+
        '" class="btn btn-outline btn-mini">Verificar</button>'+
        (url?'<button type="button" data-mp-pay="'+esc(url)+
        '" class="btn btn-outline btn-mini">Pagar</button>':'')+
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
      renderTopupOrder(result,returning);
      await loadTopupOrders();
    }catch(err){box.textContent=err?.message||'No se pudo verificar tu recarga.';}
    finally{setAuthBusy(false);}
  }
  async function checkMpReturn(){
    const query=new URLSearchParams(location.search);
    const id=query.get('order')||'';
    if(query.get('mp_return')!=='1'||!sessionToken||!/^[A-Z0-9-]{10,90}$/.test(id))return;
    accountTab='wallet';showView('account');
    try{await checkTopupOrder(id,true);}
    finally{
      query.delete('mp_return');query.delete('order');
      const qs=query.toString();
      history.replaceState(null,'',location.pathname+(qs?'?'+qs:'')+'#account');
    }
  }
  async function createTopupRequest(){
    if(!hasUser()){openAuth('login');return;}
    const amount=chosenTopup();
    if(amount===null){toast('Ingresa un importe válido entre S/ 30 y S/ 10,000.');return;}
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
    }catch(err){toast(err?.message||'No se pudo generar la orden.');}
    finally{topupBusy=false;setAuthBusy(false);renderTopup();}
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
    $('#accountBalance').textContent=fmt2(accountBalance);
    $('#paidBalancePEN').textContent='S/ '+fmt2(paidBalancePEN);
    $('#totalPlays').textContent=playHistory.length;
    $('#totalGolPlays').textContent=playHistory.filter(h=>h.type==='gol').length;
    const one=h=>`<div class="history-row"><span class="history-icon">${icon(h.type==='gol'?'trophy':'ticket')}</span><div class="history-row-main"><b>${esc(h.title)}</b><span>${new Date(h.at).toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})} · ${esc(h.note||'Registrada')}</span></div><span class="history-row-status">REGISTRADA</span></div>`;
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
      referralsJoined+' amigo(s) registrados con tu enlace · Beneficio pendiente de activación':
      'Tu invitación estará disponible después de actualizar la cuenta';
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
  }
  function openAuth(mode='login'){
    if(hasUser()){showView('account');return;}
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
    sessionCreatedAt=Date.now();
    lastSessionInteraction=sessionCreatedAt;
    lastSessionVerification=Date.now();
    saveSessionActivity(true);
    updateAccount(result);
    setAuthBusy(false);
    closeAuth();toast('¡Bienvenido a PremiumGol!');
    const next=pendingAfterAuth;pendingAfterAuth=null;
    accountTab='overview';
    if(next==='gol')saveGol();
    else if(next==='bet')placeBet();
    else if(next==='coupon')claimCouponPrompt();
    else showView('account');
    checkMpReturn();
    if(!String(result.user.phone||'').trim())toast('Puedes completar tu WhatsApp en Mi perfil.');
  }
  async function signout(reason){
    // Google no debe reabrir automáticamente una sesión después de salir.
    // La elección de cuenta/consentimiento sigue siendo controlada por Google.
    try{window.google?.accounts?.id?.disableAutoSelect?.();window.google?.accounts?.id?.cancel?.();}catch{}
    const old=sessionToken;sessionToken='';account=null;accountBalance=0;paidBalancePEN=0;recentTopupOrders=[];playHistory=[];golLocked={};couponClaimed=false;
    clearSavedSession();lastSessionInteraction=0;sessionCreatedAt=0;lastSessionVerification=0;
    closeAccountMenu();referralsJoined=0;
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
      if(!window.google?.accounts?.id){$('#googleUnavailable').hidden=false;return;}
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
          showGoogleLoginStatus('Verificando tu cuenta de Google…',false);
          setAuthBusy(true,'Verificando tu cuenta de Google…');
          try{
            const result=await remote('googleLogin',{idToken:response.credential,referralCode:referralFromUrl});
            acceptSession(result);
            showGoogleLoginStatus('',false);
          }catch(err){
            showGoogleLoginStatus(err?.message||'No se pudo iniciar sesión con Google.',true);
            console.warn('PremiumGol OAuth: no hubo sesión; comprueba la implementación de Apps Script y los registros rpc.');
          }finally{googleLoggingIn=false;setAuthBusy(false);}
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
    script.onerror=()=>{googleStarted=false;$('#googleUnavailable').hidden=false;toast('No se pudo cargar el acceso Google.');};
    document.head.appendChild(script);
  }
  async function refreshAccount(){
    if(!sessionToken)return;
    if(sessionExpired()){await signout('idle');return;}
    if(accountRefreshPromise)return accountRefreshPromise;
    accountRefreshPromise=(async()=>{
      try{
        const response=await remote('me',{sessionToken});
        if(!sessionToken)return;
        lastSessionVerification=Date.now();
        updateAccount(response);
      }catch(err){
        // No cerrar sesión ante fallos temporales de red, del iframe o por timeout.
        // Solo el mensaje explícito del servidor invalida el token existente.
        if(/Sesión vencida\. Vuelve a ingresar\./.test(String(err?.message||''))){
          sessionToken='';account=null;accountBalance=0;paidBalancePEN=0;
          clearSavedSession();lastSessionInteraction=0;sessionCreatedAt=0;
          renderAll();toast('Tu sesión venció. Vuelve a ingresar.');
        }else{
          console.warn('La sesión se conserva tras un error temporal de conexión.');
          if(!account)toast('No se pudo recuperar tu sesión. Revisa la conexión y vuelve a intentarlo.');
        }
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
      const verified=data.mode==='API_PREVIEW';
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
      matches=[];liveGames=[];renderAll();
      console.warn('Catálogo deportivo sin respuesta:',e.message);
    }
  }
  $('#loginTop').addEventListener('click',e=>hasUser()?toggleAccountMenu(e.currentTarget):openAuth('login'));
  $('#registerTop').addEventListener('click',()=>openAuth('register'));
  $('#walletTop').addEventListener('click',()=>openAccountTab('wallet'));
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
  $('#submitGol').addEventListener('click',saveGol);
  $('#openGolRules').addEventListener('click',()=>$('#golRulesDialog').showModal());
  $('#closeGolRules').addEventListener('click',()=>$('#golRulesDialog').close());
  $('#acceptGolRules').addEventListener('click',()=>$('#golRulesDialog').close());
  $('#golRulesDialog').addEventListener('click',e=>{if(e.target===$('#golRulesDialog'))$('#golRulesDialog').close();});
  $('#authBusyOverlay').addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('resize',()=>{if(accountMenuOpen)closeAccountMenu();});
  $('#resetGol').addEventListener('click',()=>{if(golLocked[activeCard])return;draft.golCards[activeCard]={};delete draft.golRequestIds[activeCard];saveDraft();renderGol();toast('Se borró la selección de la jugada '+activeCard+'.');});
  $('#premiumCoupon').addEventListener('click',claimCouponPrompt);
  $('#closeCoupon').addEventListener('click',()=>$('#couponDialog').close());
  $('#couponDialog').addEventListener('click',e=>{if(e.target===$('#couponDialog'))$('#couponDialog').close();});
  $('#claimCoupon').addEventListener('click',claimCoupon);
  $('#accountSignout').addEventListener('click',signout);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&accountMenuOpen){closeAccountMenu();e.preventDefault();}
    if(e.key==='Escape'&&authBusy)e.preventDefault();
  });
  $('#rechargeOther').addEventListener('input',e=>{topupCustom=e.target.value;topupRequestId=null;$('#rechargeOrder').hidden=true;renderTopup();});
  $('#rechargeGenerate').addEventListener('click',createTopupRequest);
  document.addEventListener('click',e=>{
    const pay=e.target.closest('[data-mp-pay]');
    if(pay){
      const url=mpSafeUrl(pay.dataset.mpPay);
      if(url)window.location.assign(url);return;
    }
    const check=e.target.closest('[data-topup-check]');
    if(check){checkTopupOrder(check.dataset.topupCheck);}
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
  $('#footerYear').textContent=new Date().getFullYear();
  renderAll();
  refreshCoupon();setInterval(refreshCoupon,15000);
  initBridge();
  if(sessionToken)refreshAccount();
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
  // El navegador consulta el caché del servidor; no realiza solicitudes a API-FOOTBALL.
  setInterval(()=>{
    if(document.visibilityState==='visible'&&['match','live'].includes(activeView)&&!authBusy)loadCatalog();
  },300000);
  const hash=location.hash.slice(1);
  const view=hash==='inicio'?'home':hash;
  if(['home','gol','match','live'].includes(view))showView(view,true);
  else if(view==='account' && sessionToken)refreshAccount().then(()=>{
    if(hasUser()){showView('account',true);checkMpReturn();}
  });
})();
