# PremiumGol · Sesión y fechas de recargas (15 de noviembre de 2026)

## Correcciones en GitHub

### Sesión persistente durante actividad

- El navegador guarda un token de sesión de corta vigencia en su almacenamiento local, para conservar el acceso al actualizar PremiumGol, abrir otra pestaña o regresar desde Checkout Pro. No contiene claves de Mercado Pago.
- **60 minutos de inactividad:** transcurrida una hora sin actividad del usuario, se cierra la sesión. El servidor Apps Script lo comprueba independientemente del navegador.
- Mientras exista interacción reciente y la página esté visible, el frontend renueva la validez con `me` aproximadamente cada ocho minutos. El servidor actualiza la fecha de última actividad, limitando escrituras a una vez cada dos minutos.
- El tiempo **máximo absoluto de una sesión sigue siendo 7 días**, incluso si hay actividad. Se debe volver a ingresar al llegar a este límite.
- Los errores temporales de red y tiempos de espera de Apps Script **ya no borran** el token: únicamente el mensaje explícito del servidor «Sesión vencida» lo invalida.
- El cierre manual de sesión revoca el token en Apps Script y se refleja en las demás pestañas. La foto, historial, premios y créditos virtuales siguen ligados al usuario real.

**Seguridad:** para una operación comercial de alto volumen conviene migrar la sesión a cookies `HttpOnly` y un backend transaccional. El almacenamiento local utilizado aquí funciona como transición para GitHub Pages + Apps Script y reduce su vigencia con inactividad.

### Historial de recargas

- En **Mi cuenta → Recargar saldo → Últimas recargas**, muestra fecha y hora de generación (`createdAt`) en la zona **America/Lima** y ordena las órdenes desde la más reciente.
- La primera solicitud muestra un indicador «Más reciente»; cada fila conserva el importe, estado y botones Verificar/Pagar.
- No expone el ID de pago completo ni modifica los importes o las condiciones del checkout.

## Archivos que debes actualizar en tu editor Apps Script

1. [Config.gs](../apps-script/Config.gs) — añade la columna `lastActivityAt` al final de la hoja `sessions` y establece `SESSION_IDLE_MINUTES:60`.
2. [Auth.gs](../apps-script/Auth.gs) — guarda y comprueba la última actividad con expiración por inactividad.
3. [Topups.gs](../apps-script/Topups.gs) — devuelve `createdAt` y ordena las últimas 15 órdenes por fecha.
4. `Main.gs` **no necesita cambios** por esta etapa.
5. [assets/app.js](../assets/app.js), [assets/styles.css](../assets/styles.css) e [index.html](../index.html) ya están actualizados directamente en GitHub.

### Publicación segura

1. Realiza una copia de seguridad del Google Sheets vinculado y conserva el `SPREADSHEET_ID` existente.
2. Sustituye íntegramente `Config.gs`, `Auth.gs` y `Topups.gs` por los archivos del repositorio.
3. Guarda los archivos y ejecuta **`setupPremiumGol`** una vez. Debe añadir únicamente `lastActivityAt` como sexta columna de `sessions`. Conserva las demás hojas y registros.
4. En **Implementar → Administrar implementaciones → Editar → Nueva versión**, publica en la implementación que ya utiliza la web.
5. Después del despliegue, vuelve a iniciar sesión **una vez**. Las sesiones existentes de más de una hora que no tenían registrada su última actividad pueden vencer durante la migración.
6. Prueba estas situaciones:
   - Iniciar sesión y actualizar inmediatamente: sigue apareciendo Mi cuenta.
   - Cambiar de pestaña y volver a PremiumGol: la cuenta permanece mientras no expire.
   - Esperar más de 60 minutos sin interactuar: el acceso vence.
   - Simular un fallo temporal de conexión de Apps Script: la sesión no se borra automáticamente.
   - Crear varias solicitudes de recarga: aparecen con fecha y hora en horario de Lima, la más reciente primero.
   - Pulsar **Cerrar sesión**: no se restaura la cuenta sin otra autenticación.

## Estado de pagos y producción

Las capturas presentadas el 15 de noviembre muestran **sandbox.mercadopago.com.pe** con una preferencia por S/30 y el comercio **My Cusco Trip**. Esto verifica que la preferencia y la redirección funcionan en el entorno de pruebas, **no que se haya realizado un cobro real ni que la conciliación haya completado todas sus etapas**.

Antes de cambiar de entorno comprueba, como mínimo, el ciclo de prueba de un pago aprobado, rechazado, pendiente y reembolsado; el retorno a PremiumGol; la verificación en Apps Script de la referencia, moneda, importe y cuenta cobradora; y el uso de la cuenta comercial que corresponda a PremiumGol. Configurar un token productivo no sustituye esas pruebas ni las condiciones de uso del proveedor.

Referencia: [Mercado Pago – pasar a producción](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/go-to-production).
