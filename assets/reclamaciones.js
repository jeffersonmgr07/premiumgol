/* PremiumGol · Hoja de Reclamaciones Virtual
 * Conexión mediante el mismo puente autorizado de HtmlService usado por PremiumGol.
 * Los datos se envían únicamente a Apps Script; no se comparten con píxeles publicitarios.
 */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('claimsForm');
  const submit = $('claimsSubmit');
  const status = $('claimsStatus');
  const message = $('claimsSubmitMessage');
  const config = window.PREMIUMGOL_CONFIG || {};
  const endpoint=String(config.appsScriptUrl||'').trim();
  let enabled = false;
  let sending = false;
  let provider = null;
  let requestId = '';
  let lastPayload=null;
  const BRIDGE_READY_TIMEOUT=35000;
  const bridge={ready:false,win:null,origin:null,queue:[],pending:new Map(),
    nonce:(globalThis.crypto?.randomUUID?.()||'PG-'+Date.now()+'-'+Math.random().toString(36).slice(2))};
  const allowedReplyOrigin = origin =>
    /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com$/i.test(origin)||
    origin==='https://script.google.com';
  const send=p=>{
    if(!bridge.ready){bridge.queue.push(p);return;}
    bridge.win.postMessage({scope:'premiumgol',type:'request',id:p.id,
      action:p.action,data:p.data},bridge.origin);
  };
  function rpc(action,data={}){
    return new Promise((resolve,reject)=>{
      if(!endpoint){reject(new Error('No se ha conectado el servidor de PremiumGol.'));return;}
      const id='LR-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
      const timer=setTimeout(()=>{
        bridge.pending.delete(id);
        bridge.queue=bridge.queue.filter(p=>p.id!==id);
        reject(new Error('La conexión tardó demasiado. Inténtalo nuevamente.'));
      },action==='submitClaim'?BRIDGE_READY_TIMEOUT:25000);
      bridge.pending.set(id,{timer,resolve,reject});
      send({id,action,data});
    });
  }
  function initBridge(){
    try{
      const url=new URL(endpoint);
      if(url.protocol!=='https:'||url.hostname!=='script.google.com')
        throw new Error('La dirección del servidor no es válida.');
      window.addEventListener('message',e=>{
        const x=e.data;
        if(!x||x.scope!=='premiumgol-bridge'||!allowedReplyOrigin(e.origin))return;
        if(x.type==='ready'&&x.nonce===bridge.nonce){
          bridge.ready=true;bridge.win=e.source;bridge.origin=e.origin;
          bridge.queue.splice(0).forEach(send);
        }else if(x.type==='reply'&&bridge.ready&&e.source===bridge.win&&
          e.origin===bridge.origin){
          const p=bridge.pending.get(x.id);
          if(!p)return;
          clearTimeout(p.timer);bridge.pending.delete(x.id);
          if(x.result?.ok)p.resolve(x.result);
          else p.reject(new Error(x.result?.message||'No se pudo guardar la solicitud.'));
        }
      });
      url.searchParams.set('bridge','1');url.searchParams.set('nonce',bridge.nonce);
      const frame=document.createElement('iframe');
      frame.id='claimsBridge';frame.title='Conexión del Libro de Reclamaciones';
      frame.style.cssText='position:absolute;width:1px;height:1px;left:-9999px;top:0;border:0';
      frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=url.toString();
      document.body.appendChild(frame);
    }catch(e){
      status.textContent='No se pudo conectar el Libro de Reclamaciones.';
      status.classList.add('is-error');
    }
  }
  function whenPeru(value){
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return '';
    return new Intl.DateTimeFormat('es-PE',{
      dateStyle:'long',timeStyle:'short',timeZone:'America/Lima'
    }).format(d);
  }
  function setProvider(data){
    provider=data.provider;
    enabled=Boolean(data.enabled);
    if(enabled&&provider){
      $('claimsProviderName').textContent=provider.name;
      $('claimsProviderRUC').textContent=provider.ruc;
      $('claimsProviderAddress').textContent=provider.address;
      status.textContent='Libro de Reclamaciones disponible. Puedes completar y presentar tu hoja.';
      status.classList.remove('is-error');
      status.classList.add('is-ready');
      submit.disabled=false;
    }else{
      enabled=false;
      submit.disabled=true;
      status.textContent='La recepción de reclamaciones aún no está habilitada: falta completar la identificación oficial del proveedor y activar el servicio.';
      status.classList.add('is-error');
    }
  }
  function syncGuardian(){
    const minor=Boolean(form.querySelector('input[name="isMinor"]:checked')?.value==='true');
    $('claimsGuardian').hidden=!minor;
    ['claimGuardianName','claimGuardianDocument','claimGuardianPhone','claimGuardianEmail']
      .forEach(id=>$(id).required=minor);
  }
  form.querySelectorAll('input[name="isMinor"]').forEach(el=>
    el.addEventListener('change',syncGuardian));
  syncGuardian();
  async function refresh(){
    try{
      const response=await rpc('claimsConfig');
      setProvider(response);
    }catch(e){
      submit.disabled=true;
      status.textContent='No se pudo comprobar la disponibilidad del Libro de Reclamaciones. Actualiza la página para volver a intentar.';
      status.classList.add('is-error');
    }
  }
  function values(){
    const data=new FormData(form);
    return Object.fromEntries(data.entries());
  }
  function randomRequestId(){
    const uuid=globalThis.crypto?.randomUUID?.();
    if(uuid)return uuid.toUpperCase();
    return 'PG-'+Date.now()+'-'+Math.random().toString(36).slice(2).toUpperCase()+
      '-'+Math.random().toString(36).slice(2).toUpperCase();
  }
  function confirmSignature(data){
    return String(data.signatureName||'').trim().toLocaleLowerCase('es-PE')===
      (String(data.firstName||'').trim()+' '+String(data.lastName||'').trim())
        .toLocaleLowerCase('es-PE');
  }
  function appendRow(el,label,value){
    const row=document.createElement('div');row.className='claims-receipt-row';
    const title=document.createElement('strong');title.textContent=label;
    const text=document.createElement('span');text.textContent=String(value||'—');
    row.append(title,text);el.appendChild(row);
  }
  function success(res,values){
    $('claimsNumber').textContent='N.º '+res.claimNumber;
    $('claimsDate').textContent=whenPeru(res.registeredAt);
    $('claimsReceiptNumber').textContent=res.claimNumber;
    $('claimsReceiptDate').textContent='Registrada el '+whenPeru(res.registeredAt);
    $('claimsReceiptEmail').textContent=res.receiptEmailSent?
      'Se envió una copia al correo declarado.':
      'No se pudo confirmar el envío de correo. Imprime o guarda esta constancia.';
    const body=$('claimsReceiptDetails');body.replaceChildren();
    appendRow(body,'Proveedor',res.provider.name+' · RUC '+res.provider.ruc);
    appendRow(body,'Domicilio del proveedor',res.provider.address);
    appendRow(body,'Tipo de reclamación',values.claimKind);
    appendRow(body,'Consumidor',values.firstName+' '+values.lastName);
    appendRow(body,'Documento',values.documentType+' '+values.documentNumber);
    appendRow(body,'Domicilio',values.homeAddress+', '+values.city+', '+values.region);
    appendRow(body,'Teléfono',values.phone);
    appendRow(body,'Correo',values.email);
    if(values.isMinor==='true')appendRow(body,'Representante',values.guardianName+
      ' · '+values.guardianDocument+' · '+values.guardianPhone+' · '+values.guardianEmail);
    appendRow(body,'Bien contratado',values.itemKind+' · '+values.itemDescription);
    appendRow(body,'Monto', 'S/ '+Number(values.amountPEN||0).toFixed(2));
    appendRow(body,'Detalle',values.detail);
    appendRow(body,'Pedido concreto',values.request);
    appendRow(body,'Conformidad',values.signatureName);
    appendRow(body,'Acciones del proveedor','Pendiente de respuesta');
    $('claimsReceipt').hidden=false;
    $('claimsReceipt').scrollIntoView({behavior:'smooth',block:'start'});
    // No borrar el formulario: sirve como copia local para imprimir.
    form.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=true);
    status.textContent='Tu hoja de reclamación ha sido registrada.';
    status.classList.remove('is-error');status.classList.add('is-ready');
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!enabled||sending)return;
    message.textContent='';
    // Validación nativa preservando el formato exigido.
    if(!form.checkValidity()){
      form.reportValidity();
      message.textContent='Revisa los campos obligatorios del formulario.';
      return;
    }
    const payload=values();
    if(!confirmSignature(payload)){
      $('claimSignatureName').focus();
      message.textContent='El nombre de la firma debe coincidir con tus nombres y apellidos.';
      return;
    }
    if(!requestId)requestId=randomRequestId();
    payload.clientRequestId=requestId;
    payload.isMinor=payload.isMinor==='true';
    payload.acceptance=$('claimAcceptance').checked;
    sending=true;submit.disabled=true;submit.textContent='Registrando tu reclamación…';
    try{
      const response=await rpc('submitClaim',payload);
      lastPayload=payload;
      success(response,payload);
      message.textContent='';
    }catch(err){
      message.textContent=err?.message||'No se pudo guardar la reclamación.';
      submit.disabled=!enabled;
    }finally{
      sending=false;
      if(!$('claimsReceipt').hidden)return;
      submit.textContent='Registrar hoja de reclamación';
    }
  });
  $('claimsPrint').addEventListener('click',()=>window.print());
  initBridge();
  refresh();
})();
