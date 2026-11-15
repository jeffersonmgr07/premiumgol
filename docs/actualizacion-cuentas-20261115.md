# PremiumGol: actualización del dashboard y acceso (15-11-2026)

## Cambios visibles

- Se eliminó la franja redundante «Tu espacio personal / Mi cuenta».
- En escritorio, continúa el menú izquierdo. El botón **Mi cuenta** del encabezado ahora abre Resumen / Mis jugadas / Recargar saldo / Mi perfil / Cerrar sesión.
- En móvil, se oculta el panel izquierdo y aparece una barra horizontal de cinco iconos, con las mismas funciones. El botón inferior de «Cuenta» abre el menú.
- La pestaña inicial tras ingresar es **Resumen**. El perfil puede completarse después.
- Google: aparece un bloqueo de interacción **después de seleccionar la cuenta** mientras el servidor verifica el ID token. Se libera automáticamente cuando concluye o falla. No pretende sortear bloqueos de seguridad de Google.
- La foto de perfil se muestra si el ID token validado incluye `picture`, con un dominio de imagen permitido; en ausencia de foto se mantienen las iniciales.
- Los importes de recarga tienen botones más pequeños. La introducción explica el mínimo S/30 y los futuros medios de pago, incluido Yape si el proveedor lo habilita. No se activaron cobros ni se acreditan saldos por solicitudes.
- Resumen incluye la generación del enlace `https://premiumgol.website/?ref=CODIGO`, que puede copiarse.

## Scripts que debes actualizar en Google Apps Script

Copiar el contenido COMPLETO de estos archivos del repositorio (no crear duplicados con otros nombres si ya existen):

1. [Config.gs](../apps-script/Config.gs): `INITIAL_CREDITS=10`, tres nuevas columnas al final de **users**, migración preservando filas y `testPremiumGolAccountSetup`.
2. [Auth.gs](../apps-script/Auth.gs): foto de Google, generación de código de invitación, asociación del nuevo usuario invitado y campos en la sesión.
3. [Admin.gs](../apps-script/Admin.gs): **opcional**: ajuste individual auditado de una cuenta de pruebas antigua sin transacciones.

**No es necesario tocar `Main.gs`, `Bridge.html` ni la API deportiva** para estos cambios.

### Secuencia obligatoria

1. Antes de modificar Apps Script, realizar una copia de seguridad de la hoja de cálculo y apuntar su `SPREADSHEET_ID`. **No borrar hojas, cambiar encabezados anteriores ni crear otra hoja para reemplazar la existente.**
2. Sustituir **Config.gs**, **Auth.gs** y, si quieres disponer de la función de ajuste, **Admin.gs** con el contenido de GitHub.
3. Guardar todos los archivos. Ejecutar **`setupPremiumGol`** *una vez* desde el editor con el mismo `SPREADSHEET_ID` de siempre: añade únicamente las columnas `avatarUrl`, `inviteCode`, `invitedBy` al final de la hoja **users**.
4. Ejecutar **`testPremiumGolAccountSetup`**. Esperar: `initialVirtualCredits:10`, `accountSchemaReady:true`, `hasAvatarField:true`, `hasInviteCodeField:true`, `invitationBonusActive:false`.
5. Verificar `GOOGLE_CLIENT_ID` y `FRONTEND_ORIGIN=https://premiumgol.website` en Propiedades del script. Mantener el cliente OAuth web previamente configurado y el despliegue **ejecutar como propietario** con acceso previsto para tu web.
6. En **Implementar → Administrar implementaciones**, editar la implementación actual (no crear otra URL), seleccionar **Nueva versión** y guardar. Probar login en ventana de incógnito.
7. Ante error de login, revisar **Ejecuciones → `rpc`** y copiar el mensaje del error, nunca el ID token, session token ni claves. Si Google bloquea el acceso antes de devolver un token, revisar Google Auth Platform → **Público / Audience**, tipo de usuario, estado de publicación y, si aplica, usuarios de prueba.

### Crédito inicial

Las **cuentas nuevas** obtienen 10 créditos virtuales. Las cuentas existentes **conservan el saldo auditado**: no se puede cambiar de manera silenciosa de 1,000 a 10 sin crear una anotación de ajuste en el libro de movimientos.

Si deseas cambiar UNA cuenta de demostración antigua que aún tenga 1,000 créditos y nunca haya jugado, recibido otra bonificación, recargado o realizado movimientos:
- En propiedades privadas del script: `ADMIN_EMAIL=<tu correo administrador>` y `ADJUST_EMAIL=<correo específico>`.
- Ejecutar desde el editor, con la cuenta administradora: **`adminNormalizeSingleDemoBalance10`**.
- La función hace el cambio a 10 y escribe un movimiento de -990 créditos virtuales. Rechaza cualquier cuenta que tenga otros movimientos. No está expuesta al frontend.

### Invitaciones

- Al abrir el enlace de invitación, el sitio conserva `?ref=CODIGO`. El código se envía a Apps Script cuando se crea una **cuenta nueva** mediante Google o el código de correo.
- `Auth.gs` comprueba que el código pertenece a un usuario existente y registra en la nueva cuenta `invitedBy`. Las cuentas existentes no pueden atribuirse un referido después del registro.
- La sección Resumen informa el número de amigos registrados. Se registran códigos aleatorios (12 caracteres), sin mostrar la lista de correos privados.
- El beneficio futuro de **S/ 5 por un invitado que se registre y complete su primera recarga aprobada** permanece INACTIVO. No hay sistema de captura de pago, verificación de primera recarga, conciliación antifraude ni abono de ese dinero. Para habilitarlo, primero deben validarse los webhooks firmados y el registro idempotente de pagos aprobados.

### Google Identity Services y temporizadores

Las consultas del catálogo API-FOOTBALL ya no se ejecutan automáticamente al abrir la página; se ejecutan al entrar a las pestañas Apuestas o Live. Esto reduce el uso de consultas y la contención con el proceso de login. El estado de verificación de Google se muestra con una capa que bloquea clics posteriores a la selección de cuenta; si Apps Script no responde, se cierra la capa y se presenta un error. No hay garantía de que Google autorice todos los navegadores ni de que un despliegue sin permisos responda.

## Pruebas manuales

- PC: abrir/cerrar menú desde la cabecera; navegar cuatro apartados; cerrar sesión y comprobar que desaparece la cuenta.
- Móvil: acceder; barra horizontal de cinco iconos; cambiar Resumen/Mis jugadas/Recargar/Mi perfil; cerrar sesión desde icono o menú inferior.
- Google: elegir una cuenta; mostrar indicador; abrir Resumen; foto de perfil si está disponible; abrir y completar datos sin cambiar de sesión.
- OTP: introducir el código; verificar indicador; abrir Resumen.
- Recargas: seleccionar 30, 50, 100, 200, 500, 1000 y otro monto. Las solicitudes deben seguir `PENDIENTE` y no aumentar la billetera.
- Referidos: generar link con una cuenta, abrir con otra cuenta nueva, crear registro, volver a entrar en la cuenta que invitó; debe aumentar el conteo, **no el saldo**.
