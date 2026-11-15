/**
 * PremiumGol · Verificación aislada de Checkout Pro.
 * Este servicio NO interactúa con saldo, apuestas, cartillas ni premios.
 * El modo real requiere autorización comercial/documentación correspondiente.
 */
import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { Firestore, FieldValue } from '@google-cloud/firestore';
import { randomUUID, createHash } from 'node:crypto';
import { WebhookSignatureValidator } from 'mercadopago';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

const store = new Firestore();
const oauth = new OAuth2Client();
const origin = 'https://premiumgol.website';
const allowed = new Set((process.env.QA_ALLOWED_EMAILS || '')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const mode = process.env.MP_MODE === 'live' ? 'live' : 'test';
const enabled = process.env.QA_CHECKOUT_ENABLED === 'true';
const realApproved = process.env.MP_LIVE_QA_APPROVED === 'YES_CONFIRMED_BY_PROVIDER';
const googleClientId = process.env.GOOGLE_CLIENT_ID || '';
const token = mode === 'live' ? process.env.MP_LIVE_ACCESS_TOKEN : process.env.MP_TEST_ACCESS_TOKEN;
const signatureSecret = mode === 'live' ? process.env.MP_LIVE_WEBHOOK_SECRET : process.env.MP_TEST_WEBHOOK_SECRET;
const collectorId = Number(process.env.MP_COLLECTOR_ID || 0);
const baseUrl = (process.env.QA_BACKEND_URL || '').replace(/\/$/, '');
const MAX_PER_USER_PER_DAY = 2;
const FIXED_AMOUNT_PEN = 5;

function errorStatus(res, status, message) { return res.status(status).json({ error: message }); }
function hash(s) { return createHash('sha256').update(s).digest('hex'); }
function validSetup() {
  return enabled && !!googleClientId && !!token && !!signatureSecret &&
    collectorId > 0 && allowed.size === 2 && /^https:\/\/[^/]+$/.test(baseUrl) &&
    (mode !== 'live' || realApproved);
}
function cors(req, res, next) {
  if (req.headers.origin === origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(req.headers.origin === origin ? 204 : 403);
  next();
}
app.use(cors);
app.get('/health', (_req, res) => res.json({
  status: 'ok', qaEnabled: validSetup(), mode, walletConnected: false, wageringEnabled: false
}));

async function requireQaUser(req, res, next) {
  if (!validSetup()) return errorStatus(res, 503, 'Checkout de validación no habilitado.');
  if (req.headers.origin !== origin) return errorStatus(res, 403, 'Origen no permitido.');
  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) return errorStatus(res, 401, 'Inicia sesión con Google.');
  try {
    const ticket = await oauth.verifyIdToken({
      idToken: authorization.slice(7), audience: googleClientId
    });
    const user = ticket.getPayload();
    const email = String(user?.email || '').toLowerCase();
    if (!user?.email_verified || !allowed.has(email)) {
      return errorStatus(res, 403, 'Esta prueba es solo para usuarios autorizados.');
    }
    req.qaEmail = email;
    req.qaUid = user.sub;
    next();
  } catch {
    return errorStatus(res, 401, 'Sesión de Google inválida o vencida.');
  }
}

async function mpGetPayment(id) {
  const response = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(id), {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!response.ok) throw new Error('No se pudo verificar el pago con Mercado Pago.');
  return response.json();
}

app.post('/api/qa/checkout', requireQaUser, async (req, res) => {
  // El importe, la moneda y el artículo los define exclusivamente el servidor.
  if (req.body && Object.keys(req.body).length !== 0) {
    return errorStatus(res, 400, 'Esta prueba utiliza un importe fijo.');
  }
  const id = randomUUID();
  const emailHash = hash(req.qaEmail);
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const limitRef = store.collection('qaDailyLimits').doc(date + '-' + emailHash);
  const ref = store.collection('qaCheckoutOrders').doc(id);
  try {
    await store.runTransaction(async tx => {
      const limit = await tx.get(limitRef);
      const current = Number(limit.exists ? limit.data().count : 0);
      if (current >= MAX_PER_USER_PER_DAY) throw new Error('Límite diario de pruebas alcanzado.');
      tx.set(limitRef, { count: current + 1 }, { merge: true });
      tx.create(ref, { status: 'CREATING', amountCents: 500, currency: 'PEN',
        mode, userSub: req.qaUid, emailHash, createdAt: FieldValue.serverTimestamp(),
        paymentId: null, preferenceId: null, walletCredited: false });
    });

    const preference = {
      items: [{ id: 'premiumgol-qa-only', title: 'Validación técnica del proceso de pago',
        description: 'Prueba controlada sin apuestas, acceso a juegos ni saldo acreditado.',
        quantity: 1, currency_id: 'PEN', unit_price: FIXED_AMOUNT_PEN }],
      external_reference: id,
      notification_url: baseUrl + '/webhooks/mercadopago',
      back_urls: {
        success: origin + '/qa-pagos.html?status=returned',
        failure: origin + '/qa-pagos.html?status=returned',
        pending: origin + '/qa-pagos.html?status=returned'
      }
    };
    const mp = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const result = await mp.json().catch(() => ({}));
    if (!mp.ok || !result.id || !result.init_point ||
        !/^https:\/\/(www\.)?mercadopago\.com\.pe\//i.test(result.init_point)) {
      await ref.update({ status: 'ERROR' });
      return errorStatus(res, 502, 'Mercado Pago no pudo generar la orden.');
    }
    await ref.update({ status: 'PENDING', preferenceId: String(result.id) });
    return res.status(201).json({ id, amountPEN: FIXED_AMOUNT_PEN,
      checkoutUrl: result.init_point, mode, walletCredited: false });
  } catch (err) {
    console.error('qa_checkout_error', String(err?.message || 'error').slice(0, 120));
    return errorStatus(res, 503, 'No se pudo iniciar el checkout de validación.');
  }
});

app.get('/api/qa/orders/:id', requireQaUser, async (req, res) => {
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) return errorStatus(res, 400, 'Orden inválida.');
  const doc = await store.collection('qaCheckoutOrders').doc(req.params.id).get();
  if (!doc.exists || doc.data().userSub !== req.qaUid) return errorStatus(res, 404, 'Orden no encontrada.');
  const o = doc.data();
  return res.json({ id: doc.id, status: o.status, amountPEN: FIXED_AMOUNT_PEN,
    mode: o.mode, walletCredited: false });
});

app.post('/webhooks/mercadopago', async (req, res) => {
  if (!validSetup()) return res.sendStatus(503);
  const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
  if (!/^\d{1,24}$/.test(dataId)) return res.sendStatus(400);
  try {
    WebhookSignatureValidator.validate({
      xSignature: req.get('x-signature') || '',
      xRequestId: req.get('x-request-id') || '',
      dataId,
      secret: signatureSecret
    });
  } catch {
    return res.sendStatus(401);
  }
  try {
    const payment = await mpGetPayment(dataId);
    const orderId = String(payment.external_reference || '');
    if (!/^[a-f0-9-]{36}$/i.test(orderId)) return res.sendStatus(200);
    const ref = store.collection('qaCheckoutOrders').doc(orderId);
    const payRef = store.collection('qaProcessedPayments').doc(dataId);
    await store.runTransaction(async tx => {
      const [order, existing] = await Promise.all([tx.get(ref), tx.get(payRef)]);
      if (!order.exists || existing.exists) return;
      const o = order.data();
      const matches = o.mode === mode &&
        payment.live_mode === (mode === 'live') &&
        Number(payment.collector_id) === collectorId &&
        String(payment.currency_id) === 'PEN' &&
        Math.round(Number(payment.transaction_amount) * 100) === o.amountCents &&
        String(payment.external_reference) === orderId;
      if (!matches) return;
      const status = String(payment.status || 'unknown').toUpperCase();
      tx.create(payRef, { orderId, status, createdAt: FieldValue.serverTimestamp() });
      tx.update(ref, { status, paymentId: dataId,
        verifiedAt: FieldValue.serverTimestamp(), walletCredited: false });
    });
    return res.sendStatus(200);
  } catch {
    console.warn('qa_webhook_retry');
    return res.sendStatus(503);
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () => console.log('Checkout QA service listening'));
