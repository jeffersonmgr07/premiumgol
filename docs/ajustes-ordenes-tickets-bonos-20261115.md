# PremiumGol · V31: vencimiento de órdenes, tickets e invitaciones
**Fecha:** 15/11/2026 · **Rama:** main

## Cambios publicados en el repositorio

### Recargas y Checkout Pro

- **Vigencia de 48 horas desde la creación de la orden:** `Topups.gs` envía `expires:true`, `expiration_date_from` y `expiration_date_to` a Mercado Pago al generar **nuevas** preferencias.
- Una orden `PENDING`, `IN_PROCESS` o `CREATING` con más de 48 horas se considera vencida a efectos del listado. Se oculta del historial, se elimina el botón Pagar y se indica `EXPIRED` si se consulta individualmente. El navegador oculta también las órdenes vencidas si la pestaña permanece abierta.
- Las **órdenes viejas no se borran de Sheets**. Deben mantenerse para trazabilidad; las órdenes aprobadas, rechazadas, reembolsadas y con contracargo permanecen en el historial, aunque tengan más de 48 horas.
- El activador de conciliación sigue verificando pagos que se registran tarde. Un pago válido aprobado fuera de la ventana puede volver a mostrarse como confirmado.
- Las preferencias creadas **antes** del cambio no adquieren automáticamente un vencimiento de 48 horas en Mercado Pago; la web impide reutilizar sus enlaces vencidos, pero es necesario revisar su vigencia directamente con el proveedor si importa cerrar la preferencia.
- **Medios de pago diferidos:** Mercado Pago recomienda al menos tres días de margen para ciertos pagos fuera de línea. Un vencimiento de 48 horas puede hacer que esos medios no lleguen a compensarse a tiempo. El plazo se ha implementado tal como se solicitó; revisar si conviene ampliarlo antes de operar con medios que requieran pago presencial.

Referencia oficial: [Definir vigencia de una preferencia — Mercado Pago](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/additional-settings/term-of-preference) y [Pagos offline](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/additional-settings/expiration-date).

### Jugadas PremiumGol

- Las letras **A, B, C, D son cuatro borradores independientes**. Ya no restringen el número de tickets que puede registrar una persona durante la misma jornada.
- Después de registrar el ticket se vacía **solo el borrador enviado**; el jugador puede volver a marcar 12 pronósticos y pagar otra jugada con sus créditos virtuales. Los demás borradores permanecen intactos.
- Cada ticket ya se guardaba con `playId` único. El dashboard presenta un código breve legible `PG-...` derivado del identificador, costo histórico registrado en `stake`, fecha/hora (Perú) y el botón **Ver detalles**.
- El detalle muestra los 12 encuentros y las opciones Local / Empate / Visita; los pronósticos se obtienen del ticket guardado por el backend, no del borrador actual.
- Se mantiene la **idempotencia por `clientRequestId`**: reintentar una misma solicitud no descuenta de nuevo. No cambia el cierre de jornada ni las validaciones de las 12 opciones.
- Cada ticket de esta etapa usa **5 créditos virtuales de prueba**. No se descontará de la billetera monetaria.

### Bonos por recomendar

- **Billetera monetaria real:** `paidBalancePEN`, basada en pagos verificados de Mercado Pago.
- **Billetera de bonos:** `bonusBalancePEN`, independiente, preparada en `bonus_ledger` y actualmente inicializada en S/ 0.00.
- **Saldo virtual de demostración:** `users.balance`, independiente de ambas billeteras.
- En Resumen se muestra el historial de invitaciones, el nombre de pila más inicial de apellido (sin exponer correos ni documentos), fecha de registro, y si hubo una primera recarga real verificada.
- En las invitaciones que cumplan la condición se muestra **+ S/5 pendiente de activación**, sin abonarlo automáticamente; si la recarga se devuelve/contracarga, deja de contabilizarse como bonificable.
- El **programa de bonos no está activo**. No se registran asientos monetarios ni se concede dinero por el simple registro. La conversión tras «cinco veces jugadas» queda pendiente de definir: importe mínimo de apuesta, método de cómputo, si cuentan apuestas rechazadas/anuladas, plazo, reembolsos y controles de duplicidad. No se debe activar un canje automático sin un sistema transaccional para jugadas monetarias.

## Archivos que debes actualizar en Google Apps Script

1. [`Config.gs`](../apps-script/Config.gs) — hoja nueva `bonus_ledger`, datos completos del ticket y resumen de invitaciones.
2. [`Games.gs`](../apps-script/Games.gs) — elimina el límite de una cartilla por letra y conserva idempotencia.
3. [`Topups.gs`](../apps-script/Topups.gs) — expiración 48 h, filtrado de órdenes y concilia pagos pendientes.
4. [`Main.gs`](../apps-script/Main.gs) — muestra el mensaje de orden vencida como error público.
5. **No necesitas copiar a Apps Script** `index.html`, `assets/app.js` ni `assets/styles.css`. GitHub Pages los publica desde `main`.

### Publicación

1. Antes de sustituir archivos, **respalda Google Sheets** y conserva `SPREADSHEET_ID`, `MP_ENV` y las propiedades privadas existentes.
2. Copia completos los cuatro archivos `.gs` anteriores en el editor, sin duplicar sus funciones en otros archivos.
3. Guarda y ejecuta **`setupPremiumGol`** una vez. Esto crea `bonus_ledger` sin borrar usuarios, sesiones, recargas ni jugadas.
4. Comprueba que en Sheets aparezca la hoja **bonus_ledger** (inicialmente solo la fila de encabezados), y que sigan las hojas `plays`, `users`, `payments_ledger` y `topup_requests`.
5. Ejecuta **`testPremiumGolOrderExpiry`**. Los tres indicadores deben ser `true`. No requiere procesar pagos reales.
6. **Implementar → Administrar implementaciones → Editar → Nueva versión**. Conserva la URL actual `/exec`.
7. Abre [premiumgol.website](https://premiumgol.website/) en una ventana nueva y valida A→A dos veces, detalle de ambos tickets, 48 h y estado de referidos.

## Pruebas recomendadas

- Crear un ticket A y otro ticket A: deben ser diferentes, con dos códigos únicos y dos cargos de 5 créditos virtuales; las demás pestañas mantienen sus selecciones.
- Ver el detalle: exactamente 12 pronósticos y la fecha correcta.
- Generar una nueva orden de recarga: debe indicar vencimiento (fecha/hora) y no admitir un pago pasadas 48 horas.
- Consultar una orden pendiente con más de 48 horas: desaparece de Últimas recargas. Una orden aprobada de hace más de 48 horas sigue visible.
- Registra un usuario nuevo con enlace de invitación: aparece en el resumen. Tras una primera recarga **real y aprobada** figura un importe previsto de S/5 pendiente de activación, sin aumentar ni la billetera monetaria ni la de bonos.
- Comprobar un reembolso: el monto pendiente de invitación deja de contarse. No reutilizar un abono de prueba para conceder recompensas reales.

**Importante:** son pruebas de código en GitHub y datos simulados; no he ejecutado la implementación privada de Apps Script ni pagos reales del usuario.
