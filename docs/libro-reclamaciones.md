# PremiumGol — Libro de Reclamaciones Virtual (Perú)

Implementación preparada conforme a los campos mínimos del **Anexo I del Decreto Supremo N.° 011-2011-PCM**, las modificaciones aplicables y la orientación de Indecopi. La página por sí sola **no sustituye** la revisión legal, el aviso obligatorio, la respuesta efectiva ni otras obligaciones operativas.

## Archivos creados y modificados
- `libro-reclamaciones.html` — formulario completo, con sección reservada a observaciones del proveedor y constancia imprimible.
- `assets/reclamaciones.css` — diseño PC/móvil e impresión A4.
- `assets/reclamaciones.js` — conexión al mismo puente autorizado de Google Apps Script que usa el login.
- `apps-script/Reclamaciones.gs` — validación, numeración, Google Sheets, confirmación al consumidor y alerta al responsable.
- `apps-script/Config.gs` — **solo** nuevo esquema `reclamaciones`; no se altera ningún dato existente.
- `apps-script/Main.gs` — acciones RPC públicas `claimsConfig` y `submitClaim`.

## Activación en Google Apps Script
1. Haz una copia de seguridad de tu Google Sheet actual.
2. Abre el **mismo proyecto Apps Script** conectado a PremiumGol y actualiza `Config.gs` y `Main.gs` con los de GitHub. Agrega **`Reclamaciones.gs`** como archivo nuevo. No elimines ninguno de los demás archivos del proyecto.
3. En Configuración del proyecto → Propiedades de secuencia de comandos agrega:
   - `PG_CLAIMS_PROVIDER_NAME`: **razón social real** o identificación legal del proveedor. No inventar.
   - `PG_CLAIMS_PROVIDER_RUC`: **RUC real de 11 dígitos**.
   - `PG_CLAIMS_PROVIDER_ADDRESS`: **domicilio completo real** del proveedor.
   - `PG_CLAIMS_ADMIN_EMAIL`: correo donde quieres que llegue una copia interna de cada reclamación (recomendado).
   - `PG_CLAIMS_ENABLED`: `false` hasta terminar la configuración.
   - Se reutilizan `SPREADSHEET_ID` y `FRONTEND_ORIGIN` ya existentes. No pegues secretos en GitHub.
4. Desde el editor ejecuta **`setupLibroReclamaciones()` una sola vez**. Autoriza los permisos solicitados. La función crea únicamente la pestaña `reclamaciones` dentro del Spreadsheet existente.
5. **Verifica** el encabezado, el propietario del archivo, las restricciones de acceso a la hoja y el permiso de envío de MailApp en el despliegue.
6. En la gestión de implementaciones existente crea una **versión nueva** de la Web App y despliega manteniendo la URL de `appsScriptUrl`.
7. Verifica que la razón social, RUC y domicilio sean correctos y que puedes atender reclamos en un plazo de **15 días hábiles improrrogables**. Solo entonces cambia `PG_CLAIMS_ENABLED` a `true`. No hace falta publicar otro GitHub commit para esta propiedad.
8. Abre `https://premiumgol.website/libro-reclamaciones.html` y prueba el envío con datos propios de prueba, guardando el número y comprobando la hoja, la confirmación por correo y la impresión de copia. Retira el registro de prueba solo mediante procedimiento interno de ensayo con control de auditoría (no modifiques reclamos reales).

## Campos guardados en Sheets
Número correlativo; ID de solicitud; fecha y hora; código de establecimiento; razón social, RUC y domicilio; reclamo/queja; nombres, apellidos, tipo y número de documento; domicilio, distrito, región, teléfono y email; datos del padre/madre/representante si es menor; producto/servicio; descripción y monto; detalle; pedido concreto; conformidad digital; estado; observaciones y acciones del proveedor; fecha de respuesta; registro del envío del acuse.

La pestaña es **independiente** de `users`, `payments_ledger`, `bonus_ledger` y `plays`. No se requiere volver a ejecutar `setupPremiumGol()`.

## Seguridad y privacidad
- El formulario no incluye Google Analytics, Clarity ni píxeles publicitarios.
- El sitio envía los datos únicamente por el puente con validación de origen al Apps Script configurado.
- Se comprueban los datos en el servidor y se incorpora un campo trampa, un bloqueo temporal por correo y un ID idempotente para evitar duplicados en reintentos.
- La pestaña de reclamaciones **contiene datos personales**: restringe el acceso, adopta política de conservación, avisos de privacidad y procedimiento de respuesta de acuerdo con la regulación peruana.
- La copia por correo utiliza `MailApp`; está sujeta a permisos y cuotas de Google. Si falla, el reclamo ya guardado sigue registrado y la web permite imprimir el acuse.
- Para el Libro virtual, Indecopi exige una versión digital accesible en la web, aviso visible y copia imprimible o por correo. Es obligatorio tramitar cada reclamo/queja y responder en máximo 15 días hábiles.

## Lo que aún requiere implementación operativa
Este desarrollo prepara la **recepción** de reclamaciones. La gestión interna de expedientes, respuestas al consumidor, el cumplimiento del aviso oficial del Libro (Anexo II/III) y la política final de datos personales requieren revisión y puesta en marcha operativa. No representa registro o certificación de Indecopi.

## Referencias oficiales
- Indecopi: https://consumidor.indecopi.vo.pe/libro-de-reclamaciones/
- Indecopi, herramienta gratuita Tu Libro: https://www.gob.pe/institucion/indecopi/noticias/1296574-los-emprendedores-ya-pueden-generar-su-libro-de-reclamaciones-de-manera-rapida-y-sencilla-sin-costo-alguno
- Ley 31435, plazo: https://busquedas.elperuano.pe/dispositivo/NL/2050405-1
