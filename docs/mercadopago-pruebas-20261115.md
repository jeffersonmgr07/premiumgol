# PremiumGol · Mercado Pago: prueba privada y habilitación futura

Estado: **prueba técnica, sin cobrar ni acreditar saldos**. Última revisión: 15 de noviembre de 2026.

## Precio actual de PremiumGol

- La cartilla de 12 encuentros consume **5 créditos virtuales** del saldo del jugador. No equivale todavía a un cobro real de S/5.
- El servidor valida `PG.GOL_STAKE:5` en `Config.gs`; actualízalo junto con la web para evitar inconsistencias.
- Las recargas siguen siendo solicitudes **pendientes**, con mínimo configurado S/30. No se ha cambiado ese mínimo a S/5 porque ese importe se propuso para una jugada directa, no para las recargas.

## Cómo probar la conectividad a Mercado Pago sin activar cobros

1. En el panel de Mercado Pago Developers, entra a tu aplicación Checkout Pro, selecciona **entorno Test** y obtiene su `Access Token` privado de pruebas.
2. No copies la credencial en GitHub ni la compartas en un chat.
3. En **Apps Script → Configuración del proyecto → Propiedades del script**, añade `MP_TEST_MODE` = `YES_TEST_CREDENTIALS` y `MP_TEST_ACCESS_TOKEN` = el token que obtuviste del **entorno Test**.
4. Añade al proyecto de Apps Script el archivo `MercadoPagoTest.gs` desde el repositorio.
5. Ejecuta manualmente `testPremiumGolMercadoPagoPreference` desde el editor. Obtendrás una respuesta con `ok`, el estado HTTP y un identificador de preferencia si Mercado Pago autoriza la creación.
6. La prueba no devuelve URL de pago, no se expone en `rpc()`, no escribe en Google Sheets, no aumenta créditos y no registra ninguna jugada.
7. Si aparece un error, revisa el registro de ejecución; no publiques la respuesta completa de la API ni tus tokens.

Archivos: [MercadoPagoTest.gs](../apps-script/MercadoPagoTest.gs) · [Config.gs](../apps-script/Config.gs) · [Topups.gs](../apps-script/Topups.gs).

## Lo que falta para que un cliente pueda pagar

- Confirmación comercial expresa por parte de Mercado Pago de que acepta la actividad, autorización de explotación por MINCETUR y homologación de la plataforma/pasarela. El dominio de explotación deberá cumplir la extensión exigida en Perú.
- Backend HTTPS con almacenamiento privado de credenciales, autenticación de sesiones, órdenes propias e importes validados desde servidor.
- Integrar Checkout Pro (preferencias, `init_point`) o Checkout API según los medios que se autoricen; Yape depende de la modalidad y de la disponibilidad comercial.
- Endpoint de webhook firmado. Validar `x-signature`, `x-request-id` y consultar al proveedor antes de aprobar un saldo.
- Libro de saldo transaccional e idempotente, medidas antifraude, expiraciones, pagos fallidos, reembolsos, controles de edad y procedimientos legales.
- Una orden real no debe crear créditos hasta verificarse el pago. Tampoco debe registrarse una jugada solo porque el navegador regrese con estado aprobado.

## Reglas de premios todavía no aprobadas

La propuesta que se evalúa es: 12 aciertos = pozo anunciado, 11 = bono S/100 y 10 = una jugada gratis. **Son escenarios de planificación, no condiciones vigentes**. Antes de anunciar pagos hay que definir si el pozo se reparte ante múltiples ganadores, desempates, suspensión de encuentros, elegibilidad, límites y vigencia.

## Fuentes

- Mercado Pago, [crear y configurar una preferencia](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/create-payment-preference).
- Mercado Pago, [webhooks y validación de firmas](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/payment-notifications).
- Mercado Pago, [credenciales de prueba de Checkout Pro](https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/test-accounts).
- MINCETUR, [Ley 31806](https://consultasenlinea.mincetur.gob.pe/casinos/archivos/2023LEY31806.pdf).
