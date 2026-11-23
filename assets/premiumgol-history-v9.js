/* PremiumGol V9: calendarios y selector de estado propios, SOLO historial público. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const labels={
    ALL:'Todos los estados',PUBLISHED:'Publicado',IN_PROGRESS:'En desarrollo',
    CONCLUDED:'Concluido',ARCHIVED:'Archivado'
  };
  const dateView={from:null,to:null};
  const inputFor=which=>$('#golResults'+(which==='from'?'From':'To'));
  const buttonFor=which=>$('#golHistory'+(which==='from'?'From':'To')+'Button');
  const panelFor=which=>$('#golHistory'+(which==='from'?'From':'To')+'Calendar');
  const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));

  function todayLima(){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
      timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return parts.year+'-'+parts.month+'-'+parts.day;
  }
  function dateLabel(value){
    if(!validDate(value))return 'Elegir fecha';
    const date=new Date(value+'T12:00:00Z');
    return Number.isFinite(date.getTime())?date.toLocaleDateString('es-PE',{
      timeZone:'America/Lima',day:'2-digit',month:'short',year:'numeric'
    }):'Elegir fecha';
  }
  function updateControls(){
    const state=$('#golResultsState')?.value||'ALL';
    const text=$('#golHistoryStateButton span');
    if(text)text.textContent=labels[state]||labels.ALL;
    $$('[data-pg-history-state]').forEach(el=>
      el.setAttribute('aria-selected',String(el.dataset.pgHistoryState===state)));
    for(const which of ['from','to']){
      const text=buttonFor(which)?.querySelector('span');
      if(text)text.textContent=dateLabel(inputFor(which)?.value);
    }
  }
  function closePanels(except=null){
    for(const [p,b] of [
      [$('#golHistoryStateMenu'),$('#golHistoryStateButton')],
      [panelFor('from'),buttonFor('from')],
      [panelFor('to'),buttonFor('to')]]){
      if(p===except)continue;
      if(p)p.hidden=true;
      if(b)b.setAttribute('aria-expanded','false');
    }
  }
  function refresh(){
    document.querySelector('#golResultsState')?.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function renderCalendar(which){
    const panel=panelFor(which);if(!panel)return;
    const selected=inputFor(which)?.value||'',today=todayLima();
    const parts=(selected||today).split('-').map(Number);
    const view=dateView[which]||{year:parts[0],month:parts[1]-1};
    const first=new Date(Date.UTC(view.year,view.month,1));
    const last=new Date(Date.UTC(view.year,view.month+1,0));
    const offset=(first.getUTCDay()+6)%7;
    const title=first.toLocaleDateString('es-PE',{month:'long',year:'numeric',timeZone:'UTC'});
    let days='';
    for(let i=0;i<offset;i++)days+='<span aria-hidden="true"></span>';
    for(let n=1;n<=last.getUTCDate();n++){
      const day=view.year+'-'+String(view.month+1).padStart(2,'0')+'-'+String(n).padStart(2,'0');
      days+='<button type="button" class="pg-v9-day'+(day===today?' today':'')+
        (day===selected?' chosen':'')+'" data-history-day="'+day+'" data-history-calendar="'+which+
        '" aria-pressed="'+String(day===selected)+'" aria-label="'+n+' de '+title+'">'+n+'</button>';
    }
    panel.innerHTML='<div class="pg-v9-month-header"><strong>'+title+'</strong><span>'+
      '<button type="button" aria-label="Mes anterior" data-history-month="-1" data-history-calendar="'+which+'">‹</button>'+
      '<button type="button" aria-label="Mes siguiente" data-history-month="1" data-history-calendar="'+which+'">›</button></span></div>'+
      '<div class="pg-v9-days">'+['Lu','Ma','Mi','Ju','Vi','Sa','Do'].map(d=>'<b>'+d+'</b>').join('')+days+'</div>'+
      '<div class="pg-v9-date-actions"><button type="button" data-history-clear="'+which+'">Limpiar</button>'+
      '<button type="button" data-history-today="'+which+'">Hoy</button></div>';
  }
  function selectDate(which,value){
    const input=inputFor(which);
    if(!input||value&&!validDate(value))return;
    input.value=value;
    dateView[which]=null;
    updateControls();closePanels();refresh();
  }

  document.addEventListener('click',event=>{
    const option=event.target.closest('[data-pg-history-state]');
    if(option){
      const value=option.dataset.pgHistoryState;
      if(!Object.hasOwn(labels,value))return;
      const input=$('#golResultsState');
      if(input)input.value=value;
      updateControls();closePanels();refresh();return;
    }
    const status=event.target.closest('#golHistoryStateButton');
    if(status){
      const panel=$('#golHistoryStateMenu');if(!panel)return;
      const willOpen=panel.hidden;closePanels();
      panel.hidden=!willOpen;status.setAttribute('aria-expanded',String(willOpen));return;
    }
    const selector=event.target.closest('#golHistoryFromButton,#golHistoryToButton');
    if(selector){
      const which=selector.id.includes('From')?'from':'to';
      const panel=panelFor(which);if(!panel)return;
      const willOpen=panel.hidden;closePanels();
      if(willOpen){dateView[which]=null;renderCalendar(which);}
      panel.hidden=!willOpen;selector.setAttribute('aria-expanded',String(willOpen));return;
    }
    const navigation=event.target.closest('[data-history-month]');
    if(navigation){
      const which=navigation.dataset.historyCalendar,delta=Number(navigation.dataset.historyMonth);
      if(!['from','to'].includes(which)||![-1,1].includes(delta))return;
      const [year,month]=(inputFor(which)?.value||todayLima()).split('-').map(Number);
      const view=dateView[which]||{year,month:month-1};
      const next=new Date(Date.UTC(view.year,view.month+delta,1));
      dateView[which]={year:next.getUTCFullYear(),month:next.getUTCMonth()};
      renderCalendar(which);return;
    }
    const day=event.target.closest('[data-history-day]');
    if(day){selectDate(day.dataset.historyCalendar,day.dataset.historyDay);return;}
    const today=event.target.closest('[data-history-today]');
    if(today){selectDate(today.dataset.historyToday,todayLima());return;}
    const clear=event.target.closest('[data-history-clear]');
    if(clear){selectDate(clear.dataset.historyClear,'');return;}
    if(!event.target.closest('.pg-history-popover-wrap'))closePanels();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closePanels();});
  document.addEventListener('pg-history-reset',()=>{updateControls();closePanels();});
  updateControls();
})();
