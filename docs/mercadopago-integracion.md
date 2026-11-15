# Mercado Pago en PremiumGol · Apps Script como único backend de pagos

**Actualización: 15 de noviembre de 2026.** La web pública sigue en **https://premiumgol.website/** (GitHub Pages), con Google Login y correo OTP. El checkout se genera y verifica exclusivamente desde el **mismo Apps Script que ya administra los usuarios**. No requiere Cloud Run, Firestore, Secret Manager, un servidor aparte ni otra página de checkout. La interfaz dirige al comprador a Checkout Pro de Mercado Pago.

> Código implementado y guardado en GitHub. **No se ha desplegado en tu Apps Script ni efectuado un cobro real desde este chat.** Los pagos aparecen cuando publiques la nueva implementación y configures las propiedades que siguen.

## 1. Archivos a actualizar — en este orden

1. [apps-script/Config.gs](../apps-script/Config.gs) — añade cinco columnas a la hoja `topup_requests`, crea `payments_ledger` y expone el saldo monetario confirmado.
2. [apps-script/Topups.gs](../apps-script/Topups.gs) — reemplaza **todo** el contenido anterior. Crea preferencias de Checkout Pro, consulta pagos, almacena estados, concilia y revierte devoluciones en el libro monetario.
3. [apps-script/Main.gs](../apps-script/Main.gs) — nuevos RPC `createTopupRequest`, `getTopupStatus`, `listTopupOrders`. Mantiene un alias temporal para el antiguo `getTopupStatusTicket`.
4. [assets/app.js](../assets/app.js), [index.html](../index.html) y [assets/styles.css](../assets/styles.css) — ya actualizados en GitHub. En tu hosting GitHub Pages se desplegarán desde `main`; no copies los JS a Apps Script.
5. **No actualizar por este cambio:** `Auth.gs`, `Games.gs`, `Bridge.html` ni código de API-FOOTBALL, siempre que ya tengas las versiones de la etapa anterior.

**Precaución:** mantén el `SPREADSHEET_ID` original. Antes de cambiar código, haz una copia de respaldo de la hoja Google Sheets; `setupPremiumGol` añade columnas y una hoja, **sin borrar filas antiguas ni cambiar saldos de demostración**.

## 2. Propiedades privadas del proyecto Apps Script

En **Configuración del proyecto → Propiedades del script**, establece:

| Nombre | Valor y explicación |
| --- | --- |
| `SPREADSHEET_ID` | Conserva exactamente el actual |
| `FRONTEND_ORIGIN` | `https://premiumgol.website` sin barra final |
| `MP_ENV` | `test` para empezar; `production` únicamente para cobrar en modo real |
| `MP_TEST_ACCESS_TOKEN` | Credencial privada del entorno de prueba; puedes reutilizar la que ya configuraste en `MercadoPagoTest.gs` |
| `MP_ACCESS_TOKEN` | Credencial privada de producción; se utiliza **solo** si `MP_ENV=production` |
| `MP_COLLECTOR_ID` | ID numérico de la cuenta cobradora asociada al Access Token del entorno seleccionado |
| `MP_CHECKOUT_ENABLED` | `false` inicialmente. Al finalizar las pruebas del entorno correspondiente y confirmar su habilitación, cambiar a `true` |

**Ya no se utilizan:** `PAYMENTS_API_URL`, `PAYMENTS_ASSERTION_SECRET`, `PAYMENTS_CHECKOUT_READY`. Puedes dejar esas propiedades sin efecto o eliminarlas manualmente en el editor, si ya no las usa ninguna otra versión de la aplicación.

Nunca guardes `MP_ACCESS_TOKEN`, `MP_TEST_ACCESS_TOKEN` ni secretos del proveedor en GitHub Pages, HTML, `assets/config.js`, `index.html` o chats.

### Descubrir el ID del vendedor

1. Guarda `Topups.gs` y configura `MP_ENV` y el Access Token correcto.
2. Ejecuta la función **`testPremiumGolMerchantId`** desde Apps Script. Devuelve `collectorId` y `collectorMatches`, sin imprimir el token.
3. Copia el valor numérico `collectorId` a la propiedad `MP_COLLECTOR_ID`.
4. Ejecuta **`testPremiumGolCheckoutConfiguration`**. Debe indicar `tokenConfigured:true`, `collectorConfigured:true`, `ordersSheet:true`, `moneyLedgerSheet:true` y, tras instalar los activadores, `automaticReconciliation:true` y `dailyAudit:true`.

## 3. Migración y activadores

1. Copia y guarda los tres archivos GS indicados.
2. **Ejecuta `setupPremiumGol` una sola vez** desde Apps Script. Preserva las hojas existentes y añade, al final de `topup_requests`, `preferenceId`, `checkoutUrl`, `paymentId`, `paidAt`, `lastCheckAt`. Crea además la hoja `payments_ledger` vacía.
3. Ejecuta `testPremiumGolMerchantId` para comprobar la cuenta cobradora y establece `MP_COLLECTOR_ID`.
4. Ejecuta `testPremiumGolCheckoutConfiguration`.
5. Ejecuta manualmente **`setupPremiumGolMercadoPagoTrigger`**. Crea, si aún no existen, los activadores `pgMpReconcilePendingOrders` cada cinco minutos y `pgMpAuditSettledOrders` diariamente. No elimina otros activadores.
6. En **Implementar → Administrar implementaciones**, edita el despliegue actual, selecciona **Nueva versión** y conserva la misma URL `/exec` conectada a GitHub Pages.
7. Verifica en modo `test` las órdenes, el retorno y la conciliación. Solo cambia a `production` después de tener autorización operativa y aprobación del medio de pago para el producto.

## 4. Qué verá el cliente

- **Mi cuenta → Recargar saldo** mantiene las opciones S/30, 50, 100, 200, 500, 1,000 y «Otro monto» (mínimo S/30, máximo S/10 000).
- El usuario selecciona un importe y pulsa **Generar orden de recarga**. Apps Script valida su sesión y el importe **desde el servidor**, registra una orden y obtiene la URL `init_point` de Checkout Pro.
- Aparece **Continuar con Mercado Pago**. El cliente elige los medios que estén disponibles para su cuenta y checkout (no prometemos Yape si el proveedor no lo habilita).
- Cuando Mercado Pago redirige a `premiumgol.website/?mp_return=1&order=...#account`, el frontend consulta Apps Script; **nunca** confía en `status=approved` de la URL.
- Si el cliente paga más tarde, Apps Script revisa automáticamente las órdenes pendientes cada cinco minutos. Los resultados aprobados se registran una sola vez. El historial permite «Verificar» y «Pagar» una solicitud pendiente.
- La auditoría diaria revisa reembolsos/contracargos recientes y registra el ajuste monetario inverso.

## 5. Cómo se guardan los saldos y por qué están separados

`users.balance` y `ledger` siguen siendo créditos virtuales de demostración (incluido el bono inicial de 10). **No se convierten a soles**.

El saldo **recargado de dinero real** es `paidBalancePEN`, calculado desde `payments_ledger` y mostrado en Mi cuenta. En producción, un pago aprobado que coincide exactamente con `external_reference`, importe, moneda PEN, `collector_id` y `live_mode` genera un único movimiento `TOPUP_APPROVED`. Un pago refundado o sujeto a contracargo genera una reversión única.

Esto mantiene intactas las jugadas previas. **Aún no se descuentan jugadas del saldo monetario**, porque las funciones de juego actuales trabajan con créditos de prueba. Antes de pasar a apuestas por dinero real, debe completarse y probarse un libro transaccional para débitos y liquidaciones de premios, además de las condiciones operativas aplicables.

## 6. Pruebas imprescindibles

1. Credenciales **Test**, `MP_ENV=test`, cuenta de prueba del proveedor. Generar una preferencia y verificar que el botón abre el checkout.
2. Aprobación test: aparece `APPROVED`, pero **no se contabiliza como dinero real** en `payments_ledger`.
3. Pago pendiente, rechazado y cancelado: el historial muestra el estado correspondiente; no se acredita saldo.
4. En una integración de producción autorizada, comprobar una recarga pequeña real, su retorno y el incremento único de `paidBalancePEN`.
5. Repetir la misma consulta cinco veces: no debe crear cinco movimientos monetarios.
6. Verificar importe incorrecto, identificador del vendedor equivocado, `live_mode` incorrecto y referencia ajena: **ninguno se acredita**.
7. Simular un reembolso en los registros de prueba y verificar el movimiento inverso único. En producción seguir el procedimiento del proveedor.
8. Desactivar temporalmente el checkout y verificar que las órdenes existentes continúan siendo conciliables con sus credenciales.
9. Probar dos navegadores y varios usuarios para confirmar que nadie puede consultar una orden ajena.

**Límites:** Apps Script usa bloqueos para concurrencia inicial y Google Sheets como almacenamiento. Para escalar a muchas compras simultáneas, depósitos grandes, pagos parciales, retiros o apuestas monetarias, migra a almacenamiento transaccional y validación de webhooks firmados. Las cabeceras de los webhooks no están disponibles genéricamente en `doPost` de Apps Script, razón por la que esta fase utiliza consultas directas a Mercado Pago.

Referencias técnicas: [Preferencias Checkout Pro](https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [Buscar pagos](https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-api-payments/search-payments/get), [Credenciales](https://www.mercadopago.com.pe/developers/es/docs/automatic-payments-orders/resources/credentials).
