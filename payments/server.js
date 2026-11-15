/**
 * PremiumGol · Backend de checkout integrado a la billetera.
 * UNA SOLA web para jugadores: https://premiumgol.website.
 * Cloud Run es un componente técnico obligatorio porque GitHub Pages
 * no puede custodiar Access Tokens ni verificar webhooks.
 *
 * No habilita explotación de apuestas sin la autorización necesaria.
 * Los pagos no se acreditan como créditos de juego en esta versión.
 */
import express from 'express';
import {Firestore, FieldValue} from '@google-cloud/firestore';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {WebhookSignatureValidator} from 'mercadopago';

const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'20kb'}));

const db=new Firestore();
const DOMAIN='https://premiumgol.website';
const MODE=process.env.MP_MODE==='live'?'live':'test';
const ENABLED=process.env.PAYMENTS_CHECKOUT_ENABLED==='true';
const LIVE_AUTHORIZED=process.env.MP_COMMERCIAL_AUTHORIZATION==='APPROVED'
  && process.env.MINCETUR_AUTHORIZATION_CONFIRMED==='YES';
const TOKEN=MODE==='live'?process.env.MP_LIVE_ACCESS_TOKEN:process.env.MP_TEST_ACCESS_TOKEN;
const WEBHOOK_SECRET=MODE==='live'?process.env.MP_LIVE_WEBHOOK_SECRET:process.env.MP_TEST_WEBHOOK_SECRET;
const SIGNING_SECRET=process.env.PAYMENTS_ASSERTION_SECRET||'';
const COLLECTOR=String(process.env.MP_COLLECTOR_ID||'');
const BASE=(process.env.PAYMENTS_API_BASE||'').replace(/\/+$/,'');
function isMercadoPagoHost(host){
  return ['mercadopago.com.pe','mercadopago.com'].some(d=>host===d||host.endsWith('.'+d));
}

function configured(){
  return SIGNING_SECRET.length>=32&&!!TOKEN&&!!WEBHOOK_SECRET&&!!COLLECTOR
    &&/^https:\/\/[^/]+$/.test(BASE);
}
function ready(){
  return ENABLED&&configured()&&(MODE!=='live'||LIVE_AUTHORIZED);
}
function denied(res,status,msg){return res.status(status).json({ok:false,message:msg});}
function validIntent(token){
  if(typeof token!=='string'||token.length>3000)return null;
  const parts=token.split('.');
  if(parts.length!==2||!parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x)))return null;
  const [data,provided]=parts;
  const correct=createHmac('sha256',SIGNING_SECRET).update(data).digest('base64url');
  const a=Buffer.from(provided),b=Buffer.from(correct);
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  let p;try{p=JSON.parse(Buffer.from(data,'base64url').toString('utf8'));}catch{return null;}
  const now=Date.now();
  if(p.v!==1||!Number.isSafeInteger(p.iat)||!Number.isSafeInteger(p.exp)||
    p.iat>now+60000||p.exp<now||p.exp>p.iat+600000||
    typeof p.uid!=='string'||!/^[0-9a-f-]{36}$/i.test(p.uid)||
    typeof p.orderId!=='string'||!/^[a-z0-9-]{10,90}$/i.test(p.orderId)||
    !Number.isSafeInteger(p.amountCents)||p.amountCents<3000||p.amountCents>1000000||
    p.currency!=='PEN')return null;
  return p;
}
app.use((req,res,next)=>{
  if(req.get('origin')===DOMAIN){
    res.setHeader('Access-Control-Allow-Origin',DOMAIN);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS,GET');
  }
  if(req.method==='OPTIONS')return res.sendStatus(req.get('origin')===DOMAIN?204:403);
  next();
});
app.get('/payments/health',(_req,res)=>res.json({
  ok:true,mode:MODE,checkoutEnabled:ready(),moneyLinkedToWagers:false
}));

// Un pago se crea a partir de un documento firmado por Apps Script,
// que ya autenticó sesión y validó importe/propietario de la orden.
app.post('/payments/create',async(req,res)=>{
  if(!ready())return denied(res,503,'Mercado Pago todavía no está habilitado.');
  if(req.get('origin')!==DOMAIN)return denied(res,403,'Origen no permitido.');
  const p=validIntent(req.body?.intent);
  if(!p)return denied(res,401,'La orden ha vencido. Vuelve a generar la solicitud.');
  const doc=db.collection('premiumgolPaymentOrders').doc(p.orderId);
  try{
    const old=await doc.get();
    if(old.exists){
      const order=old.data();
      if(order.uid!==p.uid||order.amountCents!==p.amountCents)return denied(res,409,'Orden incompatible.');
      if(order.checkoutUrl&&order.mode===MODE&&order.status==='PENDING')return res.json({ok:true,
        orderId:p.orderId,amountPEN:p.amountCents/100,checkoutUrl:order.checkoutUrl});
      return denied(res,409,'Esta orden está en preparación o ya fue procesada.');
    }
    await doc.create({
      uid:p.uid,amountCents:p.amountCents,currency:'PEN',mode:MODE,
      status:'CREATING',createdAt:FieldValue.serverTimestamp(),
      creditedToWagerWallet:false,confirmedPaymentId:null
    });
    const response=await fetch('https://api.mercadopago.com/checkout/preferences',{
      method:'POST',
      headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json',
        'X-Idempotency-Key':p.orderId},
      body:JSON.stringify({
        items:[{id:'premiumgol-wallet-order',title:'Solicitud de recarga PremiumGol',
          quantity:1,currency_id:'PEN',unit_price:p.amountCents/100}],
        external_reference:p.orderId,
        notification_url:BASE+'/payments/webhook',
        back_urls:{
          success:DOMAIN+'/?mp_return=1&order='+encodeURIComponent(p.orderId)+'#account',
          pending:DOMAIN+'/?mp_return=1&order='+encodeURIComponent(p.orderId)+'#account',
          failure:DOMAIN+'/?mp_return=1&order='+encodeURIComponent(p.orderId)+'#account'
        },
        auto_return:'approved'
      })
    });
    const mp=await response.json().catch(()=>({}));
    const checkout=String(mp.init_point||'');
    let valid=false;
    try{const url=new URL(checkout);valid=url.protocol==='https:'&&isMercadoPagoHost(url.hostname);}
    catch{}
    if(!response.ok||!mp.id||!valid){
      await doc.update({status:'ERROR'});
      return denied(res,502,'Mercado Pago no pudo crear la orden.');
    }
    await doc.update({status:'PENDING',preferenceId:String(mp.id),checkoutUrl:checkout});
    return res.status(201).json({ok:true,orderId:p.orderId,amountPEN:p.amountCents/100,
      checkoutUrl:checkout,creditedToWagerWallet:false});
  }catch(e){
    console.error('pg_payment_create_failed',String(e?.message||'error').slice(0,160));
    return denied(res,503,'No se pudo completar la preparación del pago.');
  }
});

// Consulta: solo el titular autenticado en Apps Script puede obtener una
// nueva firma para el mismo orderId.
app.post('/payments/status',async(req,res)=>{
  // Aun si se suspenden nuevos checkouts, conservar acceso al estado del pago.
  if(!configured())return denied(res,503,'Consulta de pago no disponible.');
  if(req.get('origin')!==DOMAIN)return denied(res,403,'Origen no permitido.');
  const p=validIntent(req.body?.intent);
  if(!p)return denied(res,401,'La verificación de la orden ha vencido.');
  const found=await db.collection('premiumgolPaymentOrders').doc(p.orderId).get();
  if(!found.exists)return denied(res,404,'Orden no encontrada.');
  const order=found.data();
  if(order.uid!==p.uid||order.amountCents!==p.amountCents)return denied(res,403,'No autorizado.');
  return res.json({ok:true,status:order.status,orderId:p.orderId,amountPEN:p.amountCents/100,
    paidVerified:order.status==='APPROVED',creditedToWagerWallet:false});
});

async function verifyPayment(paymentId){
  const response=await fetch('https://api.mercadopago.com/v1/payments/'+encodeURIComponent(paymentId),{
    headers:{Authorization:'Bearer '+TOKEN}
  });
  if(!response.ok)throw new Error('No se pudo consultar el pago.');
  return response.json();
}
app.post('/payments/webhook',async(req,res)=>{
  // Notificaciones de órdenes existentes deben seguir procesándose aunque
  // el operador desactive nuevas compras por seguridad.
  if(!configured())return res.sendStatus(503);
  const id=String(req.query['data.id']||req.body?.data?.id||'');
  if(!/^\d{1,24}$/.test(id))return res.sendStatus(400);
  try{
    WebhookSignatureValidator.validate({
      xSignature:req.get('x-signature')||'',xRequestId:req.get('x-request-id')||'',
      dataId:id,secret:WEBHOOK_SECRET
    });
  }catch{return res.sendStatus(401);}
  try{
    const payment=await verifyPayment(id);
    const orderId=String(payment.external_reference||'');
    if(!/^[a-z0-9-]{10,90}$/i.test(orderId))return res.sendStatus(200);
    const ref=db.collection('premiumgolPaymentOrders').doc(orderId);
    const payRef=db.collection('premiumgolVerifiedPayments').doc(id);
    await db.runTransaction(async tx=>{
      const [oDoc,previous]=await Promise.all([tx.get(ref),tx.get(payRef)]);
      if(!oDoc.exists)return;
      const o=oDoc.data();
      if(o.mode!==MODE||String(payment.collector_id)!==COLLECTOR||
        payment.live_mode!==(MODE==='live')||payment.currency_id!=='PEN'||
        Math.round(Number(payment.transaction_amount)*100)!==o.amountCents||
        String(payment.external_reference)!==orderId)return;
      const state=String(payment.status||'').toUpperCase();
      if(!['APPROVED','PENDING','IN_PROCESS','REJECTED','CANCELLED','REFUNDED','CHARGED_BACK'].includes(state))return;
      if(!previous.exists)tx.create(payRef,{orderId,mode:MODE,status:state,seenAt:FieldValue.serverTimestamp()});
      else tx.update(payRef,{status:state,lastSeenAt:FieldValue.serverTimestamp()});
      const alreadyApproved=o.status==='APPROVED';
      const next=alreadyApproved&&state!=='REFUNDED'&&state!=='CHARGED_BACK'?'APPROVED':state;
      tx.update(ref,{status:next,confirmedPaymentId:id,
        verifiedAt:FieldValue.serverTimestamp(),creditedToWagerWallet:false});
    });
    return res.sendStatus(200);
  }catch(e){
    console.warn('pg_payment_webhook_retry',String(e?.message||'error').slice(0,100));
    return res.sendStatus(503);
  }
});

app.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('PremiumGol payments API ready'));
