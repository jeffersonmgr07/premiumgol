/* PremiumGol · medición opcional y por consentimiento.
 * No lee sesiones, emails, WhatsApp, documentos, pagos ni montos.
 * Un identificador público NO es una credencial de API.
 */
(() => {
  'use strict';
  const cfg = window.PREMIUMGOL_MEASUREMENT || {};
  const KEY = 'premiumgol_measurement_consent_v1';
  const CONSENT_AGE_MS = 180 * 24 * 60 * 60 * 1000;
  const gaId = /^G-[A-Z0-9]{5,20}$/i.test(String(cfg.ga4Id || '').trim()) ?
    String(cfg.ga4Id).trim().toUpperCase() : '';
  const clarityId = /^[a-z0-9]{6,32}$/i.test(String(cfg.clarityId || '').trim()) ?
    String(cfg.clarityId).trim() : '';
  const metaId = /^\d{8,25}$/.test(String(cfg.metaPixelId || '').trim()) ?
    String(cfg.metaPixelId).trim() : '';
  const tiktokId = /^[A-Za-z0-9]{10,40}$/.test(String(cfg.tiktokPixelId || '').trim()) ?
    String(cfg.tiktokPixelId).trim() : '';
  const adsPermitted = cfg.enableAdPixels === true;
  const hasAnalytics = Boolean(gaId || clarityId);
  const hasMarketing = Boolean(adsPermitted && (metaId || tiktokId));
  const configured = hasAnalytics || hasMarketing;
  let consent = null;
  let mounted = false;
  let started = {ga:false, clarity:false, meta:false, tiktok:false};
  let lastPage = '';
  const ROUTES = ['home','gol','match','live','account'];
  const TITLES = {home:'Inicio',gol:'PremiumGol',match:'Apuestas deportivas',
    live:'Premium Live',account:'Mi cuenta'};

  function readConsent(){
    try{
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(!value || value.version !== 1 ||
        !Number.isFinite(value.at) || Date.now()-value.at < 0 ||
        Date.now()-value.at > CONSENT_AGE_MS)return null;
      if(typeof value.analytics !== 'boolean' || typeof value.marketing !== 'boolean')return null;
      return {analytics:value.analytics, marketing:value.marketing};
    }catch{return null;}
  }
  consent = readConsent();

  function routeName(route){
    let name = String(route || location.hash.replace(/^#/,'') || 'home').toLowerCase();
    if(name === 'inicio')name = 'home';
    return ROUTES.includes(name) ? name : 'home';
  }
  function safeLocation(route){
    // Se excluyen query strings que podrían incluir códigos de referidos u otros datos.
    return location.origin + location.pathname + '#' + route;
  }
  function inject(url){
    const s = document.createElement('script');
    s.async = true;
    s.src = url;
    s.referrerPolicy = 'strict-origin';
    document.head.appendChild(s);
  }
  function startGA(){
    if(started.ga || !gaId)return;
    started.ga = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};
    window.gtag('js', new Date());
    // Sin eventos automáticos de vistas para no duplicar navegación tipo SPA.
    window.gtag('config', gaId, {
      send_page_view:false,
      allow_google_signals:false,
      allow_ad_personalization_signals:false
    });
    inject('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId));
  }
  function startClarity(){
    if(started.clarity || !clarityId)return;
    started.clarity = true;
    (function(c,l,a,r,i,t,y){
      c[a] = c[a] || function(){(c[a].q=c[a].q||[]).push(arguments);};
      t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window,document,'clarity','script',clarityId);
    window.clarity('consentv2',{ad_Storage:'denied',analytics_Storage:'granted'});
  }
  function startMeta(){
    if(started.meta || !metaId || !adsPermitted)return;
    started.meta = true;
    (function(f,b,e,v,n,t,s){
      if(f.fbq)return;
      n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments);};
      if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=true;n.version='2.0';n.queue=[];
      t=b.createElement(e);t.async=true;t.src=v;
      s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
    })(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init',metaId);
  }
  function startTikTok(){
    if(started.tiktok || !tiktokId || !adsPermitted)return;
    started.tiktok = true;
    (function(w,d,t){
      w.TiktokAnalyticsObject=t;
      const q=w[t]=w[t]||[];
      q.methods=['page','track','identify','instances','debug','on','off','once','ready',
        'alias','group','enableCookie','disableCookie'];
      q.setAndDefer=function(x,m){x[m]=function(){x.push([m].concat(Array.prototype.slice.call(arguments,0)));};};
      for(let i=0;i<q.methods.length;i++)q.setAndDefer(q,q.methods[i]);
      q.instance=function(id){
        const ins=q._i[id]||[];
        for(let i=0;i<q.methods.length;i++)q.setAndDefer(ins,q.methods[i]);
        return ins;
      };
      q.load=function(id,opts){
        const base='https://analytics.tiktok.com/i18n/pixel/events.js';
        q._i=q._i||{};q._i[id]=[];q._i[id]._u=base;
        q._t=q._t||{};q._t[id]=+new Date();
        q._o=q._o||{};q._o[id]=opts||{};
        const s=d.createElement('script');s.async=true;
        s.src=base+'?sdkid='+encodeURIComponent(id)+'&lib='+t;
        const first=d.getElementsByTagName('script')[0];first.parentNode.insertBefore(s,first);
      };
    })(window,document,'ttq');
    window.ttq.load(tiktokId);
  }
  function eligiblePublicRoute(route){return route==='home'||route==='gol'||route==='match'||route==='live';}
  function pageView(name){
    if(!consent || !configured)return;
    const route=routeName(name);
    if(lastPage===route)return;
    lastPage=route;
    if(consent.analytics && started.ga){
      window.gtag('event','page_view',{
        page_title:'PremiumGol | '+TITLES[route],
        page_location:safeLocation(route),
        page_path:'/'+route
      });
    }
    // Publicidad: nunca registra rutas de cuentas, recargas, premios ni perfil.
    if(consent.marketing && adsPermitted && eligiblePublicRoute(route)){
      if(started.meta)window.fbq('track','PageView');
      if(started.tiktok)window.ttq.page();
    }
  }
  function startEligible(){
    if(!consent || !configured)return;
    if(consent.analytics){startGA();startClarity();}
    if(consent.marketing && eligiblePublicRoute(routeName())){
      startMeta();startTikTok();
    }
    lastPage='';
    pageView();
  }
  function bannerVisible(show){
    const banner=document.getElementById('measurementBanner');
    if(banner)banner.hidden=!show;
  }
  function openPreferences(){
    const dialog=document.getElementById('measurementDialog');
    if(!dialog)return;
    const a=document.getElementById('measurementAnalytics');
    const m=document.getElementById('measurementMarketing');
    a.checked=Boolean(consent?.analytics);
    a.disabled=!hasAnalytics;
    m.checked=Boolean(consent?.marketing);
    m.disabled=!hasMarketing;
    if(!dialog.open)dialog.showModal();
  }
  function saveChoice(next){
    const previous=consent;
    consent={analytics:hasAnalytics&&Boolean(next.analytics),
      marketing:hasMarketing&&Boolean(next.marketing)};
    try{localStorage.setItem(KEY,JSON.stringify({version:1,...consent,at:Date.now()}));}
    catch{ /* Sin almacenamiento persistente se respeta la preferencia en esta visita. */ }
    bannerVisible(false);
    const dlg=document.getElementById('measurementDialog');
    if(dlg?.open)dlg.close();
    // Los píxeles ya cargados no pueden descargarse de forma fiable sin recargar.
    if(previous && ((previous.analytics&&!consent.analytics) ||
      (previous.marketing&&!consent.marketing))){
      location.reload();
      return;
    }
    startEligible();
  }
  function boot(){
    if(mounted)return;
    mounted=true;
    if(!configured)return; // Sin IDs públicos válidos, no se muestra aviso ni se cargan scripts.
    const banner=document.getElementById('measurementBanner');
    const prefs=document.getElementById('measurementDialog');
    const footer=document.getElementById('measurementPreferencesLink');
    if(!banner||!prefs||!footer)return;
    footer.hidden=false;
    document.getElementById('measurementAccept').addEventListener('click',()=>{
      saveChoice({analytics:true,marketing:true});
    });
    document.getElementById('measurementReject').addEventListener('click',()=>{
      saveChoice({analytics:false,marketing:false});
    });
    document.getElementById('measurementConfigure').addEventListener('click',openPreferences);
    footer.addEventListener('click',openPreferences);
    document.getElementById('measurementSave').addEventListener('click',()=>{
      saveChoice({
        analytics:document.getElementById('measurementAnalytics').checked,
        marketing:document.getElementById('measurementMarketing').checked
      });
    });
    document.getElementById('measurementClose').addEventListener('click',()=>prefs.close());
    if(consent)startEligible();
    else bannerVisible(true);
    // Navegación atrás/adelante y enlaces hash; showView también informa su ruta.
    window.addEventListener('popstate',()=>pageView());
    window.addEventListener('hashchange',()=>pageView());
  }
  window.PremiumGolMeasurement=Object.freeze({
    pageView,openPreferences,
    getStatus:()=>Object.freeze({
      configured,analyticsConfigured:hasAnalytics,marketingConfigured:hasMarketing,
      analyticsConsent:Boolean(consent?.analytics),
      marketingConsent:Boolean(consent?.marketing),
      loaded:{...started}
    })
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
