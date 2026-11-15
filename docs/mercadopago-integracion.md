# Mercado Pago en PremiumGol — plan de integración segura

**Estado (15/11/2026): EN PREPARACIÓN. NO COBRAR EN PRODUCCIÓN.** El sitio está en GitHub Pages y el backend actual utiliza Apps Script con créditos de demostración. La vista de recargas ya permite elegir S/30, 50, 100, 200, 500, 1,000 y otro monto (mínimo S/30), y crea solicitudes `PENDIENTE` en `Topups.gs`. El botón de Mercado Pago todavía está deshabilitado deliberadamente. `savePremiumGol` descuenta 5 créditos virtuales por jugada.

## 0. Requisitos antes de habilitar dinero real

- **Licencia y homologación:** para operar apuestas deportivas a distancia en Perú, confirmar autorización MINCETUR, homologación de la plataforma/componentes y requisitos de verificación y juego responsable. Fuentes: https://apuestasdeportivas.mincetur.gob.pe/ y https://www.gob.pe/94256-autorizacion-y-registro-homologacion-y-o-renovacion-y-o-modificacion-de-las-plataformas-tecnologicas-de-los-juegos-a-distancia-y-o-de-las-apuestas-deportivas-a-distancia
- **Dominio:** la Ley 31806 enumera `.bet.pe`, `.bet`, `.com`, `.pe` y `.com.pe` como extensiones de dominio para esta actividad. `premiumgol.website` no figura en la lista para explotación real.
- **Mercado Pago:** solicitar al área comercial/compliance la aceptación **expresa** de apuestas deportivas y recargas relacionadas y confirmar que la pasarela utilizada esté habilitada y registrada conforme a los requisitos de MINCETUR. Tener credenciales no implica autorización comercial para recibir apuestas.
- Mientras no se hayan validado esas condiciones, **solo pruebas con saldos y pagos de entorno de prueba**. Nunca representar transacciones de prueba como dinero real.

## 1. Credenciales: dónde guardarlas

En el panel https://www.mercadopago.com.pe/developers/panel/app crea o utiliza tu integración de Checkout Pro. Obtén credenciales de **prueba**: `Access Token` y, si usas Brick, `Public Key`. Para Checkout Pro con redirección, la web no necesita el Access Token ni un SDK visible; el servidor genera una orden.

**No pegues nunca** `Access Token`, secreto de Webhooks ni contraseñas en GitHub, `assets/config.js`, HTML, mensajes o frontend. En un servicio backend privado (p. ej., Google Cloud Run con Secret Manager) registra `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET`. No habilites las credenciales de producción hasta tener aprobación de actividad.

## 2. Flujo correcto (dos tipos de orden)

```
Usuario autenticado en premiumgol.website
  |-- Recargar billetera: S/ 30, 50, 100, 200, 500, 1000 u otro ≥ 30
  |-- Comprar jugada PremiumGol: S/ 5 por jugada A, B, C o D
         |
         v
Backend privado: autenticar sesión y verificar la cuenta
         |
         v
Crear orden pendiente con orderId único, monto PEN validado en servidor,
tipo = WALLET_TOPUP o GOL_ENTRY; no aceptar monto final enviado por la web
         |
         v
Solicitar preferencia Checkout Pro a Mercado Pago:
POST https://api.mercadopago.com/checkout/preferences
Authorization: Bearer <MP_ACCESS_TOKEN>
items: [{id, title, quantity: 1, currency_id: "PEN", unit_price: ...}]
external_reference: orderId
back_urls: URLs HTTPS de tu dominio
notification_url: URL HTTPS de backend con capacidad de leer x-signature
         |
         v
Backend devuelve init_point / init_point de esa orden
Usuario redirigido al Checkout Pro
         |
         v
Mercado Pago notifica webhook -> verificar x-signature y x-request-id
         |
         v
Servidor consulta GET /v1/payments/{payment_id} con Access Token privado
Validar: pago approved, monto, moneda PEN, cuenta receptor/collector,
external_reference, orderId, entorno y que la orden siga pendiente
         |
         v
Transacción atómica e idempotente (paymentId único):
   - WALLET_TOPUP: crear ledger + acreditar billetera una sola vez
   - GOL_ENTRY: registrar jugada para jornada abierta una sola vez
         |
         v
Marcar orden PAGADA; mostrar saldo/jugada al actualizar "Mi cuenta".
```

**Nunca** acreditar saldo a partir de los parámetros `status=approved` de la URL de retorno: el retorno de navegador es información para el usuario, no prueba de pago. Exigir verificación del webhook y consulta privada del pago.

Mercado Pago documenta preferencia y redirección: https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/overview y https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post

Webhooks firmados: https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/payment-notifications

## 3. Modelo de datos mínimo

- `orders`: orderId, uid, tipo, reference, amountCents, currency (`PEN`), estado, createdAt, expiresAt.
- `provider_payments`: paymentId **UNIQUE**, orderId, providerStatus, amountCents, notifiedAt, verifiedAt.
- `wallet_ledger`: ledgerId, uid, orderId **UNIQUE**, paymentId **UNIQUE**, deltaCents, balanceAfterCents, createdAt.
- `plays`: uid, roundId, slot (A/B/C/D), picks, paymentOrderId, state. Índice único `(uid, roundId, slot)` donde corresponda.
- Usar transacciones de base de datos para impedir dos créditos por reenvío de webhook, pagos duplicados o doble clic.
- Distinguir saldos de prueba de saldos reales. No mezclar contadores de créditos con PEN sin contabilidad explícita.

## 4. Por qué hace falta backend adicional a Apps Script

Tu frontend es estático. El `Access Token` no debe exponerse. Además, la validación de Webhooks de Mercado Pago requiere leer encabezados `x-signature` y `x-request-id`, trabajar con claves privadas y usar transacciones atómicas. Para cobros reales no basta con el enlace `/exec` de Apps Script y Google Sheets.

Una alternativa adecuada es **Google Cloud Run** con una base de datos transaccional (p. ej., Firestore / Postgres), HTTPS, Secret Manager y endpoint `/webhooks/mercadopago`. Apps Script puede seguir administrando el login de prueba, pero se debe definir un método de autenticación del usuario que el backend de pagos pueda validar de forma segura.

## 5. Pruebas de integración antes del lanzamiento

1. Crear orden de pruebas y verificar que `external_reference` corresponde a su `orderId`.
2. Abrir `init_point`; cancelar, rechazar, dejar pendiente y aprobar utilizando únicamente herramientas/cuentas de prueba permitidas por Mercado Pago.
3. Comprobar que éxito/pendiente/fallo no acreditan sin webhook verificado.
4. Simular dos notificaciones iguales, notificaciones fuera de orden y reintentos: solo un asiento.
5. Probar recargas de S/30, S/50 y monto personalizado. Probar compra directa de S/5 si es un producto legalmente autorizado.
6. Simular sesión inválida, usuario no titular, pago de importe erróneo y pagos expirados.
7. Auditar saldos y conciliar sumatoria del ledger con pagos realmente aprobados.
8. Tras licencias/aprobaciones, ejecutar pruebas de producción de monto mínimo supervisadas antes de habilitar públicamente.

**Nota:** este documento define la arquitectura y no activa pagos ni apuestas con dinero real. No hay un Webhook de Mercado Pago, autorización de actividad ni proceso de liquidación implementado aún.
