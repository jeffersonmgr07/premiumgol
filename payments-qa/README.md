# Checkout Pro · validación privada entre dos personas

Este módulo es una **prueba de cobros independiente**. No es una función de la casa de apuestas, no recarga la billetera ni compra jugadas, no genera premios y no constituye autorización para operar apuestas deportivas.

## Estado inicial

- **Desactivado por defecto:** `QA_CHECKOUT_ENABLED=false`.
- **Modo Test por defecto:** `MP_MODE=test`.
- **Modo real condicionado:** para configurar `MP_MODE=live`, además de la credencial de producción debe existir confirmación expresa del proveedor de que acepta una **transacción real de validación técnica**; se requiere `MP_LIVE_QA_APPROVED=YES_CONFIRMED_BY_PROVIDER`. Esto no autoriza su uso para recibir dinero destinado a apuestas ni acredita créditos.
- **Importe fijo**: S/ 5, máximo dos órdenes por usuario y día de Lima, dos correos autorizados exactamente. No hay campo para modificar el monto.
- **Frontend**: `/qa-pagos.html`, protegido en backend mediante token verificado de Google y lista blanca. La página pública no contiene Access Tokens.
- **Backend**: Cloud Run Node.js, HTTPS, Firestore y Secret Manager. La ruta `/webhooks/mercadopago` admite notificaciones firmadas; `/api/qa/checkout` y `/api/qa/orders/:id` exigen ID token de Google válido.
- **Resultado**: se guarda orden y estado verificado. Ningún código modifica `users.balance`, `ledger`, `plays`, `topup_requests` ni `GOL_STAKE`.

## Cómo preparar el servicio (sin encender cobros)

1. Usar un proyecto de Google Cloud de tu propiedad con APIs de Cloud Run, Firestore, Secret Manager, Cloud Build, Artifact Registry.
2. Crear base Firestore en modo Native, establecer identidad de servicio de Cloud Run y asignarle acceso de lectura/escritura a Firestore y acceso únicamente a los secretos correspondientes.
3. Desplegar **desde la carpeta `payments-qa`**, con Dockerfile Node 20. El servicio necesita una URL HTTPS pública para el webhook, pero las rutas de creación y consulta validan el ID token del usuario y rechazan correos fuera de la lista.
4. Configurar variables (sin secretos): `MP_MODE=test`, `QA_CHECKOUT_ENABLED=false`, `QA_ALLOWED_EMAILS=<correo1>,<correo2>`, `GOOGLE_CLIENT_ID` igual al cliente OAuth Web de PremiumGol, `QA_BACKEND_URL` con la URL HTTPS de Cloud Run, `MP_COLLECTOR_ID` con el identificador de la cuenta vendedora correspondiente a ese entorno.
5. Añadir **a Secret Manager**, nunca al código, `MP_TEST_ACCESS_TOKEN` y `MP_TEST_WEBHOOK_SECRET`, montarlos en Cloud Run. Completar `MP_LIVE_ACCESS_TOKEN` y `MP_LIVE_WEBHOOK_SECRET` solamente después de la aprobación pertinente.
6. En Mercado Pago, registrar `https://TU_CLOUD_RUN_URL/webhooks/mercadopago` como Webhook del entorno que utilices. El secreto de firma que muestre el panel debe coincidir con el almacenado en Secret Manager.
7. Editar únicamente `payments-qa/public-config.js` para incluir `window.PG_QA_CHECKOUT_API_URL='https://TU_CLOUD_RUN_URL';` — esta URL es pública, **no es una clave**.
8. Revisar `https://premiumgol.website/qa-pagos.html` y comprobar los dos correos permitidos; verificar que una tercera cuenta reciba un rechazo HTTP 403.
9. Para la primera prueba de flujo completo, configurar `QA_CHECKOUT_ENABLED=true` con `MP_MODE=test`; usar solo usuarios, tarjetas e instrumentos del entorno Test. No confundir la creación de una preferencia HTTP 201 con un pago.
10. Si el proveedor **autoriza expresamente cobros reales de esta prueba técnica, independientes de apuestas**, revisar también los requisitos legales/contables aplicables y entonces decidir si procede activar el modo `live`. No habilitarlo para compras de jugadas, recargas de saldos de apuestas o fondos canjeables sin contar con la autorización sectorial aplicable.

**Ningún despliegue ha sido realizado desde el repositorio por estos cambios.** No está conectado al botón de recarga ni al dashboard de usuario. Solo se añade el módulo aislado para que pueda ser probado y auditado.

## Seguridad y flujos

```
Usuario de la lista blanca (Google) -> POST /api/qa/checkout
  -> Validar identidad y límite de 2 pruebas diarias por persona
  -> Firestore: crear orden pendiente de S/5, estado CREATING
  -> Servidor: preferencia de Checkout Pro con Access Token privado
  -> Devolver init_point a la página de validación, nunca la clave
  -> Usuario visita Mercado Pago
  -> Webhook público: verificar firma (SDK oficial), consultar GET /v1/payments/{id}
  -> Validar external_reference, monto PEN, ID del vendedor y entorno
  -> Registrar status transaccionalmente, sin modificar billetera/jugadas
  -> Usuario puede consultar estado desde su sesión
```

La URL de retorno por sí misma **no valida ni aprueba un pago**. No usar el botón de reenvío del navegador para generar movimientos duplicados. Los estados de reembolso o contracargo se deben reconciliar en el panel del proveedor. Los medios disponibles (Yape, tarjetas, etc.) dependen del entorno, del producto Checkout y de la habilitación de tu cuenta.

## Verificación adicional antes de habilitar cobros comerciales

- [Autorización de explotación – MINCETUR](https://www.gob.pe/94255).
- [Mercado Pago – crear preferencias](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/create-payment-preference).
- [Mercado Pago – cuentas de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/test-accounts).
- [Mercado Pago – Webhooks con firma](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/payment-notifications).

**Importante:** el módulo sirve para validar tecnología, no para disfrazar recargas/apuestas como otra actividad. La operación real de apuestas en Perú requiere los trámites correspondientes.
