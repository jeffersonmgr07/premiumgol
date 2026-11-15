# Pagos en PremiumGol — Checkout Pro integrado en Mi cuenta

## Estado

**Código preparado en GitHub, no desplegado ni habilitado para dinero real.**
La experiencia del usuario es **una sola web**, `premiumgol.website`: ingreso con Google o correo → Mi cuenta → Recargar saldo → Generar orden → Continuar con Mercado Pago → consultar estado de pago. No existe una segunda página QA.

**GitHub Pages no puede procesar webhooks ni proteger Access Tokens.** Por eso existe un backend privado dentro del mismo repositorio (`payments/server.js`), preparado para Cloud Run. El frontend habla con él solamente al solicitar o consultar una orden, utilizando un token temporal firmado por el Apps Script actual.

Este flujo registra pagos verificados pero **no acredita dinero en la billetera de apuestas**, no compra jugadas ni permite retirar fondos hasta contar con autorización de explotación, homologación y aceptación comercial de la pasarela. Los créditos actuales continúan siendo virtuales.

## Archivos que deben actualizarse juntos

1. `apps-script/Topups.gs` — registra solicitud y emite un comprobante criptográfico de validez de 5 minutos.
2. `apps-script/Main.gs` — añade `getTopupStatusTicket` autenticado.
3. `assets/app.js` — conecta el botón existente de recarga con Checkout Pro y consulta de estado tras regresar.
4. `index.html` — referencia `assets/app.js?v=27`.
5. `payments/` — servidor, dependencias y Dockerfile.

**Nunca** copiar Access Tokens o secretos a `assets/config.js`, HTML, un repositorio público o un chat.

## Configuración de Google Apps Script

En **Configuración del proyecto → Propiedades del script**, definir:

| Clave | Valor |
| --- | --- |
| `SPREADSHEET_ID` | Conservar la hoja existente |
| `FRONTEND_ORIGIN` | `https://premiumgol.website` |
| `PAYMENTS_API_URL` | URL HTTPS de tu servicio Cloud Run, sin barra final |
| `PAYMENTS_ASSERTION_SECRET` | Secreto aleatorio de al menos 32 caracteres, **exactamente el mismo** que el backend |
| `PAYMENTS_CHECKOUT_READY` | `false` hasta finalizar despliegue, pruebas y autorizaciones |

Actualizar `Topups.gs` y `Main.gs`, guardar y publicar **una nueva versión de la misma implementación /exec**. El identificador y ruta de Apps Script usados por la web deben seguir siendo los mismos.

## Configuración de Cloud Run

1. En el proyecto de Google Cloud, habilitar Cloud Run, Cloud Build, Artifact Registry, Firestore y Secret Manager.
2. Crear base de datos Firestore en modo Native, asignar cuenta de servicio de mínimo privilegio y conceder acceso de lectura/escritura a Firestore.
3. Desplegar **desde la carpeta `payments/`** usando el Dockerfile incluido; usar HTTPS en la URL que Cloud Run asigne.
4. Crear estas variables públicas/no secretas:
   - `MP_MODE=test` para pruebas con credenciales de test, o `live` solamente después de obtener permisos.
   - `PAYMENTS_CHECKOUT_ENABLED=false` inicialmente.
   - `MP_COLLECTOR_ID` = ID de tu cuenta cobradora del mismo entorno.
   - `PAYMENTS_API_BASE=https://TU-SERVICIO-HTTPS`.
   - `MP_COMMERCIAL_AUTHORIZATION=PENDING` y `MINCETUR_AUTHORIZATION_CONFIRMED=NO` hasta que correspondan.
5. Crear en **Secret Manager**, y montar como variables privadas del servicio:
   - `PAYMENTS_ASSERTION_SECRET` igual al de Apps Script.
   - `MP_TEST_ACCESS_TOKEN`, `MP_TEST_WEBHOOK_SECRET`.
   - Más adelante, según corresponda, `MP_LIVE_ACCESS_TOKEN`, `MP_LIVE_WEBHOOK_SECRET`.
6. Registrar la URL `https://TU-SERVICIO-HTTPS/payments/webhook` en el panel de Mercado Pago → Webhooks del entorno seleccionado, en evento **Pagos**. Usar la clave de firma de ese mismo entorno.
7. Comprobar `GET /payments/health`; informa si el Checkout está listo, pero nunca revela tokens.
8. Activar la prueba **solo de entorno Test** con `PAYMENTS_CHECKOUT_ENABLED=true` en Cloud Run y `PAYMENTS_CHECKOUT_READY=true` en Apps Script. El sistema no tiene lista blanca de correos: cualquier usuario **autenticado de PremiumGol** puede completar el flujo del entorno Test.
9. Cuando se verifiquen permisos reales, términos del proveedor y cumplimiento del sector, establecer las credenciales live correspondientes y activar la producción, en lugar de conservar el entorno Test.

No cambies ninguna propiedad para simular licencias: los parámetros son controles internos del software, no sustituyen documentación oficial.

## Seguridad y funcionamiento

- El usuario nunca decide el importe efectivo de forma unilateral. Apps Script valida el importe S/30–10 000, la sesión y la titularidad de la orden.
- El token firmado contiene `uid`, `orderId`, monto en céntimos, moneda PEN y vencimiento. **No contiene Access Tokens ni datos bancarios**.
- Cloud Run comprueba firma HMAC SHA-256 y vencimiento, genera una preferencia Checkout Pro usando el Access Token **privado** y devuelve la URL `init_point` para el botón del dashboard.
- Mercado Pago envía el Webhook; Cloud Run verifica `x-signature` y `x-request-id` usando su SDK, consulta el pago directamente en la API y comprueba importe, moneda, referencia, cuenta cobradora y modo test/live.
- Firestore guarda el pago y sus estados de manera idempotente. Ni una página de retorno ni una notificación sin validar pueden acreditar dinero.
- El usuario puede consultar el estado en la sección de recarga, pero el servidor **no asigna créditos de apuestas** en esta fase.
- Si se detienen nuevos checkouts, las consultas y notificaciones de transacciones anteriores siguen operativas.

## Paso posterior para un producto vendible con apuesta real

Se requiere un **libro de saldos monetarios separado** del saldo virtual existente, conciliación con pagos aprobados, reembolsos y contracargos, controles KYC/edad, prevención de fraude, límites y juego responsable, vinculación de la pasarela homologada y auditoría de cada jugada. Las operaciones de apuestas reales no deben depender exclusivamente de Google Sheets, porque hacen falta transacciones atómicas y control de concurrencia. Esta funcionalidad **no está activa**.

Referencias:
- [MINCETUR — juegos y apuestas a distancia](https://apuestasdeportivas.mincetur.gob.pe/)
- [Mercado Pago — webhooks](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/payment-notifications)
- [Mercado Pago — preferencias](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/create-payment-preference)
