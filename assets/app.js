/* PremiumGol · interfaz para créditos virtuales.
 * Los créditos, las cuotas de ejemplo y las jugadas SOLO son válidos tras confirmación del backend.
 * La cartilla y el cupón sin enviar se guardan en este navegador como borrador.
 */
(() => {
  'use strict';
  const CONFIG = window.PREMIUMGOL_CONFIG || {};
  const DRAFT_KEY = 'premiumgol_draft_v2';
  const SESSION_KEY = 'premiumgol_session_v2';
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
  draft.golPicks = draft.golPicks && typeof draft.golPicks==='object' ? draft.golPicks : {};
  draft.slips = Array.isArray(draft.slips) ? draft.slips : [];
  const saveDraft = () => {try{localStorage.setItem(DRAFT_KEY,JSON.stringify(draft));}catch{}};
  let sessionToken = sessionStorage.getItem(SESSION_KEY) || '';
  let account = null;
  let accountBalance = 0;
  let playHistory = [];
  let activeView='home',accountTab='overview',pendingAfterAuth=null,authMode='login';
  let leagueFilter='all',dateFilter='all',searchFilter='',sortFilter='date',stake=20;
  let toastTimer;
  function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4200);}
  const outcomes=['1','X','2'];
  const outcomeName=['Local','Empate','Visita'];
  const golGames = [
    ['Astros FC','Metro United','Liga Continental'],['Atlético Sur','Leones del Norte','Liga Continental'],
    ['Real Aurora','Costa Azul','Copa Estelar'],['Deportivo Capital','Fénix Club','Liga Continental'],
    ['Montaña FC','Náuticos','Copa Estelar'],['Estrella Roja','Olimpo FC','Liga Continental'],
    ['Unión Pacífico','Pumas Dorados','Liga Continental'],['Racing Andino','Imperial FC','Copa Estelar'],
    ['Toros del Este','Titanes FC','Liga Continental'],['Valle Verde','Marineros','Copa Estelar'],
    ['Cóndor Club','Atlético Central','Liga Continental'],['Royal Sporting','Deportivo Sol','Liga Continental'],
    ['Trueno FC','Academia Azul','Copa Estelar'],['Guerreros FC','Norte Unido','Liga Continental']
  ].map(([home,away,league],i)=>({id:`gol${i+1}`,home,away,league}));
  let matches = [
    {id:'m1',home:'Astros FC',away:'Metro United',league:'Liga Continental',day:0,time:'20:00',odds:[1.85,3.40,4.20],colors:['#c9a244','#4b95c8']},
    {id:'m2',home:'Atlético Sur',away:'Leones del Norte',league:'Liga Continental',day:0,time:'21:30',odds:[2.12,3.15,3.05],colors:['#bf524d','#ddbd55']},
    {id:'m3',home:'Real Aurora',away:'Costa Azul',league:'Copa Estelar',day:1,time:'18:00',odds:[1.62,3.75,5.10],colors:['#a7b8ce','#2586b6']},
    {id:'m4',home:'Montaña FC',away:'Náuticos',league:'Copa Estelar',day:1,time:'19:45',odds:[2.90,3.20,2.30],colors:['#438367','#377ab0']},
    {id:'m5',home:'Estrella Roja',away:'Olimpo FC',league:'Liga Continental',day:2,time:'17:30',odds:[2.05,3.25,3.70],colors:['#a9394b','#a7a4bd']},
    {id:'m6',home:'Racing Andino',away:'Imperial FC',league:'Copa Estelar',day:2,time:'21:00',odds:[1.95,3.50,3.85],colors:['#56aeb5','#9d69ac']}
  ];
  let liveGames = [
    {id:'l1',home:'Fénix Club',away:'Trueno FC',league:'Liga Continental',minute:67,score:[2,1],odds:[1.38,4.55,8.20],colors:['#da6652','#5975b5']},
    {id:'l2',home:'Academia Azul',away:'Valle Verde',league:'Copa Estelar',minute:31,score:[0,0],odds:[2.42,2.98,3.11],colors:['#376fb2','#4c9669']},
    {id:'l3',home:'Cóndor Club',away:'Marineros',league:'Liga Continental',minute:82,score:[1,2],odds:[7.40,4.80,1.31],colors:['#aa935e','#538bc0']}
  ];
  const hasUser = () => Boolean(account && sessionToken);
  const allGames = () => [...matches,...liveGames];
  const visibleDate = g => g.dateLabel || `${fixtureDays(g.day||0)} · ${g.time||''}`;
  function initials(s){return String(s).split(' ').map(t=>t[0]).slice(0,2).join('').toUpperCase();}
  function badge(s,color){return `<span class="badge-crest" style="--crest:${/^#[0-9a-f]{6}$/i.test(color||'')?color:'#4c769d'}">${esc(initials(s))}</span>`;}
  function showView(name,skipHash=false){
    if(!['home','gol','match','live','account'].includes(name))name='home';
    if(name==='account'&&!hasUser()){pendingAfterAuth='account';openAuth('login');return;}
    activeView=name;
    $$('.view').forEach(e=>e.classList.toggle('is-active',e.id===`view-${name}`));
    $$('[data-nav]').forEach(e=>e.classList.toggle('active',e.dataset.nav===name));
    if(!skipHash)history.replaceState(null,'',name==='home'?'#inicio':`#${name}`);
    if(name==='account')renderAccount();
    if(name==='match')renderMatch();
    if(name==='live')renderLive();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function renderHome(){
    $('#homeFixtures').innerHTML=matches.slice(0,3).map(g=>`<article class="preview-card"><div class="preview-card-head"><span>${icon('ball')} ${esc(g.league)}</span><span class="game-date">${esc(visibleDate(g))}</span></div><div class="preview-teams"><span class="preview-team">${badge(g.home,g.colors?.[0])}<span>${esc(g.home)}</span></span><span class="preview-versus">VS</span><span class="preview-team">${badge(g.away,g.colors?.[1])}<span>${esc(g.away)}</span></span></div><div class="preview-bottom"><span>Mercado 1 · X · 2</span><button data-nav="match">Ver cuotas →</button></div></article>`).join('');
  }
  function completedPicks(){return golGames.filter(g=>outcomes.includes(draft.golPicks[g.id])).length;}
  function renderGol(){
    $('#golFixtures').innerHTML=golGames.map((g,i)=>`<article class="gol-fixture ${outcomes.includes(draft.golPicks[g.id])?'filled':''}"><span class="fixture-number">${String(i+1).padStart(2,'0')}</span><div class="fixture-main"><small>${esc(g.league)}</small><strong>${esc(g.home)} <span>vs.</span> ${esc(g.away)}</strong></div><div class="result-choices" role="group" aria-label="Partido ${i+1}: ${esc(g.home)} contra ${esc(g.away)}">${outcomes.map((o,k)=>`<button type="button" class="result-option ${draft.golPicks[g.id]===o?'selected':''}" data-gol-id="${g.id}" data-gol-outcome="${o}" aria-pressed="${draft.golPicks[g.id]===o}" title="${outcomeName[k]}"><b>${o}</b><small>${outcomeName[k]}</small></button>`).join('')}</div></article>`).join('');
    $('#golCount').textContent=String(completedPicks());
    $('#golCountSide').textContent=`${completedPicks()} de 14`;
    $('#golProgress').style.width=`${completedPicks()/14*100}%`;
    $('#submitGol').disabled=completedPicks()!==14;
  }
  let sendingPlay=false;
  async function saveGol(){
    if(completedPicks()!==14){toast(`Completa los 14 partidos. Llevas ${completedPicks()} de 14.`);return;}
    if(!hasUser()){pendingAfterAuth='gol';openAuth('login');toast('Ingresa o regístrate para colocar tu jugada.');return;}
    if(sendingPlay)return;
    sendingPlay=true;$('#submitGol').disabled=true;
    try{
      const picks=golGames.map(g=>({id:g.id,outcome:draft.golPicks[g.id]}));
      draft.golRequestId=draft.golRequestId||randomId();saveDraft();
      const res=await remote('saveReto14',{sessionToken,picks,clientRequestId:draft.golRequestId});
      updateAccount(res);draft.golPicks={};delete draft.golRequestId;saveDraft();renderAll();toast('¡Jugada PremiumGol registrada en tu cuenta!');
    }catch(e){toast(e.message||'No se pudo guardar la jugada.');}
    finally{sendingPlay=false;renderGol();}
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
    $('#matchResultCount').textContent=`${games.length} encuentro${games.length===1?'':'s'} encontrado${games.length===1?'':'s'}`;
    $('#matchFixtures').innerHTML=games.length?games.map(g=>marketCard(g,false)).join(''):'<div class="empty-state">No se encontraron partidos con esos filtros.</div>';
    renderSlips();
  }
  function renderLive(){
    $('#liveFixtures').innerHTML=liveGames.length?liveGames.map(g=>marketCard(g,true)).join(''):'<div class="empty-state">No hay encuentros en vivo en este momento.</div>';
    renderSlips();
  }
  function marketCard(g,live){
    const selected=draft.slips.find(s=>s.id===g.id)?.outcome;
    return `<article class="market-card ${live?'live-card':''}"><div class="market-top"><span class="market-league"><span class="league-icon">✦</span>${esc(g.league)}</span><span class="market-schedule">${live?`<span class="tiny-live"></span> ${Number(g.minute)||0}' EN VIVO`:esc(visibleDate(g))}</span></div><div class="market-body"><div class="teams-block"><span class="market-team">${badge(g.home,g.colors?.[0])}<span>${esc(g.home)}</span></span><span class="market-middle">${live?'':'VS'}</span><span class="market-team">${badge(g.away,g.colors?.[1])}<span>${esc(g.away)}</span></span></div>${live?`<span class="market-score">${Number(g.score?.[0])||0} <small>:</small> ${Number(g.score?.[1])||0}</span>`:''}</div><div class="market-choices">${outcomes.map((o,i)=>`<button type="button" class="choice ${selected===o?'selected':''}" data-pick="${esc(g.id)}" data-outcome="${o}" ${!Number.isFinite(Number(g.odds?.[i]))?'disabled':''} aria-label="${outcomeName[i]} para ${esc(g.home)} contra ${esc(g.away)}"><small>${o}</small><b>${g.odds?.[i]?fmt2(g.odds[i]):'—'}</b></button>`).join('')}</div></article>`;
  }
  function changeSelection(id,outcome){
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
    if(Number.isFinite(Number(result.balance)))accountBalance=Number(result.balance);
    if(Array.isArray(result.history))playHistory=result.history;
    renderAll();
  }
  function renderHeader(){
    $('#walletTop').hidden=!hasUser();
    $('#topBalance').textContent=fmt(accountBalance);
    $('#loginTopLabel').textContent=hasUser()?'Mi cuenta':'Ingresar';
    $('#registerTop').hidden=hasUser();
  }
  function renderAccount(){
    const name=[account?.firstName,account?.lastName].filter(Boolean).join(' ')||'Usuario';
    $('#profileName').textContent=name;
    $('#avatarInitial').textContent=name.slice(0,1).toUpperCase();
    $('#profileSubtitle').textContent=account?.email||'Mi cuenta';
    $('#welcomeName').textContent=account?`¡Hola, ${account.firstName||'jugador'}!`:'¡El partido te espera!';
    $('#accountBalance').textContent=fmt(accountBalance);
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
    $$('[data-account-tab]').forEach(el=>el.classList.toggle('active',el.dataset.accountTab===accountTab));
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
    $('#authDescription').textContent=authMode==='register'?'Regístrate y comienza a disfrutar PremiumGol.':'Accede a tus jugadas y pronósticos.';
    $('#signupFields').hidden=authMode!=='register';
    $('#authFirst').required=authMode==='register';
    $('#authLast').required=authMode==='register';
    $('#emailForm').hidden=false;$('#verifyForm').hidden=true;
  }
  function openAuth(mode='login'){
    if(hasUser()){showView('account');return;}
    setAuthMode(mode);
    const el=$('#authDialog');if(!el.open)el.showModal();
    if(CONFIG.googleClientId)setupGoogle();
  }
  function closeAuth(){if($('#authDialog').open)$('#authDialog').close();}
  function acceptSession(result){
    if(!result.sessionToken||!result.user)throw new Error('El servidor no devolvió una sesión válida.');
    sessionToken=result.sessionToken;
    sessionStorage.setItem(SESSION_KEY,sessionToken);
    updateAccount(result);
    closeAuth();toast('¡Bienvenido a PremiumGol!');
    const next=pendingAfterAuth;pendingAfterAuth=null;
    if(next==='gol')saveGol();else if(next==='bet')placeBet();else showView('account');
  }
  async function signout(){
    const old=sessionToken;sessionToken='';account=null;accountBalance=0;playHistory=[];
    sessionStorage.removeItem(SESSION_KEY);
    renderAll();showView('home');toast('Has cerrado sesión.');
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
      const timer=setTimeout(()=>{bridge.pending.delete(id);bridge.queue=bridge.queue.filter(p=>p.id!==id);reject(new Error('La conexión tardó demasiado. Vuelve a intentarlo.'));},15000);
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
  let googleStarted=false;
  function setupGoogle(){
    if(googleStarted||!CONFIG.googleClientId)return;googleStarted=true;
    const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>{
      if(!window.google?.accounts?.id)return;
      window.google.accounts.id.initialize({client_id:CONFIG.googleClientId,callback:async({credential})=>{
        try{acceptSession(await remote('googleLogin',{idToken:credential}));}
        catch(e){toast(e.message||'No se pudo ingresar con Google.');}
      }});
      $('#googleButtonMount').style.display='flex';$('#googleLogin').style.display='none';
      window.google.accounts.id.renderButton($('#googleButtonMount'),{theme:'outline',size:'large',text:'continue_with',shape:'rectangular',width:300,locale:'es'});
    };
    script.onerror=()=>{googleStarted=false;toast('No se pudo cargar el acceso Google.');};
    document.head.appendChild(script);
  }
  async function refreshAccount(){
    if(!sessionToken)return;
    try{updateAccount(await remote('me',{sessionToken}));}
    catch{sessionToken='';account=null;sessionStorage.removeItem(SESSION_KEY);renderAll();}
  }
  async function loadCatalog(){
    if(!CONFIG.appsScriptUrl)return;
    try{
      const data=await remote('catalog',{});
      if(data.games?.match&&Array.isArray(data.games.match))matches=data.games.match;
      if(data.games?.live&&Array.isArray(data.games.live))liveGames=data.games.live;
      // Una actualización del catálogo invalida selecciones cuyo mercado ya no está disponible.
      const ids=new Set(allGames().map(g=>g.id));
      draft.slips=draft.slips.filter(s=>ids.has(s.id));saveDraft();
      renderAll();
    }catch(e){console.warn('Catálogo provisional activo:',e.message);}
  }
  $('#loginTop').addEventListener('click',()=>hasUser()?showView('account'):openAuth('login'));
  $('#registerTop').addEventListener('click',()=>openAuth('register'));
  $('#walletTop').addEventListener('click',()=>showView('account'));
  $('#registerStart').addEventListener('click',()=>openAuth('register'));
  $('#tabLogin').addEventListener('click',()=>setAuthMode('login'));
  $('#tabRegister').addEventListener('click',()=>setAuthMode('register'));
  $('#closeAuth').addEventListener('click',closeAuth);
  $('#authDialog').addEventListener('click',e=>{if(e.target===$('#authDialog'))closeAuth();});
  $('#googleLogin').addEventListener('click',()=>CONFIG.googleClientId?setupGoogle():toast('El acceso con Google se habilitará al conectar la configuración.'));
  $('#emailForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const email=$('#authEmail').value.trim().toLowerCase();
    const btn=$('#requestCode');btn.disabled=true;
    try{
      await remote('sendCode',{email,mode:authMode});
      $('#emailForm').hidden=true;$('#verifyForm').hidden=false;$('#authCode').focus();
      toast('Revisa tu correo para encontrar el código de 6 dígitos.');
    }catch(e){toast(e.message||'No se pudo enviar el código.');}
    finally{btn.disabled=false;}
  });
  $('#verifyForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const code=$('#authCode').value.trim();
    if(!/^\d{6}$/.test(code)){toast('Escribe los 6 dígitos del código.');return;}
    const btn=$('#verifyCodeBtn');btn.disabled=true;
    try{
      const result=await remote('verifyCode',{
        email:$('#authEmail').value.trim().toLowerCase(),code,mode:authMode,
        firstName:$('#authFirst').value.trim(),lastName:$('#authLast').value.trim(),
        countryCode:$('#authCountry').value,phone:$('#authPhone').value.trim()
      });acceptSession(result);
    }catch(err){toast(err.message||'El código es incorrecto o ha vencido.');}
    finally{btn.disabled=false;}
  });
  $('#backToEmail').addEventListener('click',()=>{$('#verifyForm').hidden=true;$('#emailForm').hidden=false;});
  $('#submitGol').addEventListener('click',saveGol);
  $('#resetGol').addEventListener('click',()=>{draft.golPicks={};delete draft.golRequestId;saveDraft();renderGol();toast('Se borró tu selección actual.');});
  $('#accountSignout').addEventListener('click',signout);
  $('#profileForm').addEventListener('submit',async e=>{
    e.preventDefault();if(!hasUser())return;
    const btn=$('#profileSave');btn.disabled=true;
    try{const res=await remote('updateProfile',{sessionToken,firstName:$('#profileFirst').value.trim(),lastName:$('#profileLast').value.trim(),countryCode:$('#profileCountry').value,phone:$('#profilePhone').value.trim(),docType:$('#profileDocType').value,docNumber:$('#profileDocNumber').value.trim()});updateAccount(res);toast('Tus datos fueron actualizados.');}
    catch(err){toast(err.message||'No se pudieron guardar tus datos.');}finally{btn.disabled=false;}
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
    const gol=e.target.closest('[data-gol-id]');if(gol){delete draft.golRequestId;draft.golPicks[gol.dataset.golId]=gol.dataset.golOutcome;saveDraft();renderGol();return;}
    const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();showView(nav.dataset.nav);return;}
    const tab=e.target.closest('[data-account-tab]');if(tab){accountTab=tab.dataset.accountTab;renderAccount();return;}
    const pick=e.target.closest('[data-pick]');if(pick){changeSelection(pick.dataset.pick,pick.dataset.outcome);return;}
    const rem=e.target.closest('[data-remove]');if(rem){draft.slips=draft.slips.filter(s=>s.id!==rem.dataset.remove);delete draft.betRequestId;saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="clearBetslip"]')){draft.slips=[];delete draft.betRequestId;saveDraft();renderMatch();renderLive();return;}
    if(e.target.closest('[id^="placeBet"]'))placeBet();
  });
  $('#footerYear').textContent=new Date().getFullYear();
  renderAll();
  initBridge();
  if(sessionToken)refreshAccount();
  loadCatalog();
  const hash=location.hash.slice(1);
  const view=hash==='inicio'?'home':hash;
  if(['home','gol','match','live'].includes(view))showView(view,true);
  else if(view==='account' && sessionToken)refreshAccount().then(()=>{if(hasUser())showView('account',true);});
})();
