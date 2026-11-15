## Catálogo API-FOOTBALL con cuotas reales (vista informativa) · noviembre de 2026

**Hecho en GitHub:** los equipos ficticios dejan de aparecer en `Apuestas deportivas`, `Premium Live` y `Partidos destacados`. No se inventan cuotas. Las tarjetas 1/X/2 se muestran si API-FOOTBALL devuelve un mercado ganador 1X2 válido. Si falta cuota, se marca «—». Los partidos no permiten colocar jugadas, porque la validación actual de `saveBet` aún usa las cuotas ficticias del servidor y no es un motor de apuestas autorizado.

**Para activar los datos en el Apps Script desplegado (GitHub no despliega .gs):**

1. Abre tu proyecto real en `script.google.com`; sustituye `SportsCatalog.gs` por la versión que está en GitHub. No pegues tu clave en el archivo: debe seguir en **Propiedades del script** como `API_SPORTS_KEY`.
2. Comprueba `API_SPORTS_CATALOG_MODE=preview` y `FRONTEND_ORIGIN=https://premiumgol.website` (sin barra final); no necesitas cambiar el Client ID ni el ID de Google Sheets.
3. Ejecuta **`testApiSportsConnection`**. Debería registrar HTTP 200 si API-FOOTBALL responde; si hay errores de cuota o suscripción, inspecciónalos en los registros.
4. Ejecuta **`testPremiumGolSportsCatalog`**. Revisa `mode`, `upcoming` y `live`. Es normal que `live` sea vacío si no hay partidos con cobertura en vivo.
5. Abre **Implementar → Administrar implementaciones → Editar → Nueva versión** para que la misma URL `/exec` use este código. Comprueba que el desplegado realmente incluya `SportsCatalog.gs` y el resto de archivos `Main.gs`, `Bridge.html`, `ApiSports.gs`, `Games.gs`.
6. Abre `https://premiumgol.website` y verifica `Partidos destacados`, `Apuestas deportivas` y `Premium Live`. GitHub Pages ya apunta a tu URL pública de Apps Script desde `assets/config.js`.

**Diseño técnico actual:** el catálogo consulta cuotas previas de 1/X/2 para hoy y mañana (primera página de cada día), luego obtiene nombre y hora mediante `fixtures?ids=...`; puede complementar con `fixtures?next=20` si hay pocas cuotas. Por defecto, caché de próximos eventos de 3 horas y de Live de **60 minutos**. El navegador vuelve a consultar el catálogo servido por Apps Script cada 5 minutos mientras la página esté visible. Este refresco **no equivale a una nueva consulta al proveedor** si sigue vigente el caché del servidor.

**Si actualizas a un plan de mayor cuota**, añade `API_SPORTS_LIVE_CACHE_SECONDS=300` en las Propiedades del script para permitir caché Live de cinco minutos (hasta 2 llamadas de API por actualización, aproximadamente 576 consultas diarias si la vista se solicita continuamente durante 24h). **No lo actives con el plan Free de 100 solicitudes por día.** El modo de cinco minutos sigue siendo informativo, no apto para ejecutar apuestas en vivo ni para liquidación.

**Diferencia de mercados:** API-FOOTBALL utiliza identificadores de tipo de apuesta distintos para `/odds` (prematch) y `/odds/live`. El parser no utiliza el ID 1 de prematch como si fuera 1X2 Live. Los mercados suspendidos, bloqueados o sin tres resultados se omiten.

**Siguiente etapa para algo cercano al tiempo real:** backend con caché distribuida y un proceso de consultas independiente de los visitantes, una licencia comercial de cuotas, y publicación en tiempo casi real (WebSocket/SSE o sondeo). Si algún día se desean aceptar apuestas con dinero real, el backend debe consultar y bloquear la cuota vigente, validar mercado abierto, controlar riesgo, fondos, KYC, cuentas y liquidación con autorización de MINCETUR y aprobación de los medios de pago.

---

## Actualización de acceso y portada móvil — 14/11/2026

- El botón oficial de Google Identity Services usa `outline_dark`, `shape: pill`, texto blanco y el logotipo multicolor auténtico. Google administra su iframe, por lo que **no puede ser completamente transparente** mediante CSS sin abandonar el botón oficial.
- Cabecera: borde `#DBFF26` con brillo tenue en el acceso; se mantuvo el amarillo de marca `#F7C85D`.
- Hero móvil: imagen del futbolista posicionada como capa visual de fondo, texto compacto sobre ella, botón «Empezar a jugar» más pequeño. Sin alterar el hero de escritorio.
- Registro por correo: «Código de país» y «Número de WhatsApp» (obligatorio). Si Google crea una cuenta sin teléfono, la web dirige al usuario a completar el perfil.
- Se deben sincronizar también los cambios de `apps-script/Auth.gs` y `apps-script/Main.gs` en el proyecto real de Apps Script y publicar **nueva versión del despliegue**. GitHub Pages no actualiza por sí solo los archivos que viven dentro del editor de Apps Script.
- `assets/config.js` ya contiene identificadores públicos de conexión; no almacenar `API_SPORTS_KEY` en GitHub.
- No se modificó la lógica de apuestas ni los pagos. Las recargas con dinero real permanecen deshabilitadas.

---

# Actualización de interfaz y catálogo · 14 de noviembre de 2026

- Inicio: portada más breve («Haz de cada encuentro de fútbol una emoción entre patas»), botón Empezar a jugar y futbolista un poco más abajo; texto superior de plataforma deportiva oculto en móvil.
- Quitada la franja de invitación redundante, títulos abreviados, y modo móvil con un solo ícono para ingresar/registrarse.
- Logo oficial más grande, textos y navegación de blanco puro `#FFFFFF`. Se conserva el dorado `#F7C85D`; borde del modal de acceso en `#DBFF26` con resplandor animado suave.
- Partidos destacados: tres mercados 1/X/2 con cuotas mostradas solo si existen, evento pulsable que abre su filtro dentro de «Apuestas deportivas». Si procede de API-FOOTBALL, se identifica como **solo consulta** y no puede registrarse jugada.
- Sin conexión al backend la interfaz conserva ejemplos **marcados como demostración**, nunca presentados como cuotas reales.
- `apps-script/SportsCatalog.gs` ahora incluye paginación limitada de cuotas previas y compatibilidad con la respuesta `bets` para cuotas en vivo. La información de Premium Live puede tener hasta una hora de caché: **no es adecuada para aceptar apuestas en vivo**.

## Para activar acceso Google y datos API reales
1. En `assets/config.js` coloca **solo** la URL `/exec` de tu implementación Apps Script y el **Client ID OAuth web** público de Google, nunca el secreto ni la clave deportiva.
2. En Google Cloud, el cliente OAuth de tipo aplicación web debe autorizar el origen JavaScript `https://premiumgol.website` (sin barra final). En Apps Script, las propiedades `GOOGLE_CLIENT_ID` y `FRONTEND_ORIGIN=https://premiumgol.website` deben coincidir.
3. En las propiedades privadas de Apps Script establece `API_SPORTS_KEY` y `API_SPORTS_CATALOG_MODE=preview`. La clave **no** debe aparecer en GitHub.
4. Copia a tu proyecto Apps Script el nuevo contenido de `SportsCatalog.gs` y actualiza la implementación desde **Implementar → Administrar implementaciones → Editar → Nueva versión**. Verifica `testApiSportsConnection` y `testPremiumGolSportsCatalog`.
5. La web estática `premiumgol.website` no puede por sí sola consultar una propiedad privada del Apps Script: necesita que `assets/config.js` apunte al despliegue correcto.

No se habilitaron pagos con dinero real ni apuestas con cuotas de API. El modo `preview` es informativo; se necesitan controles y autorizaciones adicionales para operar apuestas reales.

---

# PremiumGol — actualización de la cartilla y vista deportiva (14 noviembre 2026)

## Cambios ya publicados en GitHub Pages
- Cartilla PremiumGol con **12 encuentros seleccionados** de la imagen aportada, sin asignar fechas no verificadas.
- En la cartilla: **L = Local, E = Empate, V = Visita**. El servidor guarda internamente los códigos compatibles `1`, `X` y `2`.
- Se descartaron provisionalmente Bielorrusia–Albania y Chipre–Montenegro. Esta selección **no es una medición objetiva de dificultad**: es necesario contrastar cuotas y fechas antes de abrir una jornada.
- Mi cuenta → **Recargar saldo**: S/ 30, 50, 100, 200, 500, 1,000 u otro importe de S/ 30 a S/ 10,000, con dos decimales. Generar una orden registra una **solicitud pendiente**, pero no genera ningún cobro ni acredita saldo.
- `assets/styles.css` conserva el dorado `#F7C85D` y el blanco `#FFFFFF`; los marcos no aumentaron de espesor.

## Actualizar Google Apps Script (NECESARIO)
Los archivos de GitHub **no despliegan automáticamente** el Apps Script que está en tu cuenta.

1. Desde la carpeta `apps-script` del repositorio, reemplaza **`Config.gs`**, **`Games.gs`** y **`Main.gs`** en el proyecto de Apps Script correspondiente.
2. Crea allí dos archivos de tipo *Script* con los nombres exactos **`Topups.gs`** y **`SportsCatalog.gs`**, copiando su contenido. Conserva `Auth.gs`, `ApiSports.gs`, `Admin.gs` y `Bridge.html` sin sobrescribirlos si ya son los mismos.
3. Ejecuta de nuevo **`setupPremiumGol`**. La función reutiliza `SPREADSHEET_ID` y únicamente crea la pestaña nueva `topup_requests`. **No elimines ni cambies la propiedad SPREADSHEET_ID**.
4. En **Implementar → Administrar implementaciones → Editar → Nueva versión**, publica el nuevo código. Comprueba que `FRONTEND_ORIGIN` corresponda al origen exacto que usas, sin barra final: `https://premiumgol.website`.
5. Si ya funcionan las sesiones con Google, conserva tu `GOOGLE_CLIENT_ID` y la URL `/exec` de `assets/config.js`.

### Vista informativa con API-FOOTBALL
1. Guarda tu clave en las **Propiedades del script** usando la propiedad privada `API_SPORTS_KEY`. Nunca en GitHub.
2. Añade **`API_SPORTS_CATALOG_MODE` = `preview`**. Sin esa propiedad, el catálogo de Apuestas deportivas y Premium Live continúa con datos ficticios.
3. Desde el editor, ejecuta `testApiSportsConnection` y luego `testPremiumGolSportsCatalog`, para comprobar si tu suscripción permite recuperar encuentros y cuotas.
4. Vuelve a publicar **una nueva versión de Apps Script**. La web consulta el catálogo compartido: el buscador, los filtros de liga y fecha, y la selección visual no generan una solicitud nueva al proveedor por cada clic.

El modo `preview` usa `fixtures?next=50`, `odds` para el día actual y siguiente (primera página), `fixtures?live=all` y `odds/live`. Los resultados de próximos encuentros se almacenan hasta 3 horas; los de Live hasta 1 hora. El objetivo es respetar el plan gratis de API-FOOTBALL, por lo que **NO es un feed en tiempo real apto para aceptar apuestas**. Las cuotas pueden faltar y las selecciones de ese modo están deshabilitadas. El proveedor puede limitar o vaciar respuestas, y su consumo puede variar; revisa el saldo de solicitudes en su dashboard.

### Cobros y ordenes
- **`createTopupRequest`** requiere sesión y guarda solicitudes en `topup_requests`, en estado `PENDIENTE`. Es idempotente mediante `clientRequestId`. No altera `users.balance`, `ledger` ni accede a Mercado Pago.
- El cierre de un pago real requeriría **aprobación de la actividad por Mercado Pago**, autorización y homologación MINCETUR, dominio compatible, identificación del jugador, un backend transaccional, webhook autenticado, confirmación del pago consultando la API de Mercado Pago, prevención de créditos duplicados y procedimiento de reembolso/contracargo.
- La Ley peruana 31806 enumera `.bet.pe`, `.bet`, `.com`, `.pe` y `.com.pe` para plataformas autorizadas. **`premiumgol.website` no está en esa enumeración para explotación de apuestas reales**. Es válido seguir desarrollando aquí el prototipo.
- Las cuotas de proveedores de datos no constituyen automáticamente autorización para ofrecer apuestas ni sustituyen una plataforma operadora y sus controles de riesgo.

---

## Documentación histórica de la versión 5


## Cambios de la versión 5

- Banner superior: texto animado de derecha a izquierda y firma «Una experiencia de PremiumLott» alineada al contenedor de la cabecera.
- **Cupón Premium 50 BW:** aparece exclusivamente cuando la hora de Perú coincide con el minuto (00:00, 01:01, 02:02... 23:23), durante los **primeros cinco minutos** de ese intervalo. Ejemplos: 18:18–18:22. Clic abre una ventana y, al iniciar sesión, activa **50 créditos de bono virtual**, **máximo una vez por cuenta**. El backend verifica horario y unicidad; no se puede canjear por dinero.
- **PremiumGol:** 12 partidos (1/X/2), selecciones independientes A, B, C y D. Cada una se guarda una sola vez por jornada; el servidor descuenta **3 créditos virtuales** (equivalentes a S/ 3 simulados en la pantalla) y conserva historial, resumen y saldo. No hay apuestas con soles reales.
- Eliminadas las franjas introductorias grandes de PremiumGol, Apuestas deportivas y Premium Live; quedan sus títulos de sección y textos solicitados.
- Modales: logotipo oficial completo en lugar del círculo anterior. Se dejó `assets/premiumgol-modal-logo.png` como archivo independiente para sustituirlo sin cambiar HTML cuando esté disponible la nueva imagen de modal; la versión actual usa **una copia intacta del logo oficial anterior**.
- Botón **Continuar con Google**: se renderiza únicamente con Google Identity Services al configurar `GOOGLE_CLIENT_ID`; no hay botón imitado que simule Google sin conexión.
- Cuenta: mensaje de billetera virtual y recargas próximas. No se implementa cobro con Mercado Pago ni PayPal.

### Recarga virtual manual autorizada

Esta etapa mantiene créditos **ficticios**. Si deseas asignar 50 créditos virtuales desde Apps Script a un usuario registrado:

1. En **Propiedades del script** configura `ADMIN_EMAIL` con tu correo administrador, `RECHARGE_EMAIL` con el correo del usuario y `RECHARGE_REFERENCE` con un identificador único (por ejemplo `AUTORIZADA-000001`).
2. Ejecuta **`adminRecharge50FromEditor`** en el editor autenticado con la cuenta administradora. La función verifica el correo ejecutor, bloquea referencias repetidas, acredita **50 créditos ficticios** y registra la operación en `ledger`.
3. Nunca agregues `adminApproveVirtualRecharge` ni `adminRecharge50FromEditor` como acciones públicas en `Main.gs`. No uses esta herramienta para acreditar fondos reales. Google Sheets no ofrece transacciones financieras atómicas; cuando se habiliten pagos reales, hará falta una base de datos transaccional, conciliación y controles regulatorios.

**La cartilla de 12 partidos y sus partidas son ficticias hasta configurar una jornada oficial.** Cambiar la jornada requiere ajustar `PG.ROUND_ID` en `Config.gs`, el catálogo de partidos y volver a publicar la implementación.



PremiumGol es la marca deportiva de PremiumLott. Esta entrega conserva la portada de estadio nocturno y el diseño azul oscuro/dorado del prototipo anterior, con las siguientes secciones:

- **PremiumGol:** cartilla de 12 partidos, con cuatro jugadas independientes A, B, C y D (3 créditos virtuales cada una), un pronóstico por encuentro: **1 = local, X = empate, 2 = visita**. Se habilita **Colocar jugada** después de completar los 12.
- **Apuestas deportivas:** próximos encuentros, mercado 1/X/2, filtros por equipo, liga y fecha, orden por liga/fecha/equipo y cupón con cuotas.
- **Premium Live:** partidos en vivo y su cupón de créditos virtuales.
- **Mi cuenta:** saldos, historial, datos de perfil y documentos opcionales para completar después.

**Alcance y límites**: partidos y cuotas de la entrega son **simulados**. No hay dinero real, premios monetarios, pagos ni liquidación de resultados. No se debe presentar como una casa de apuestas real ni operar con dinero real antes de verificar las licencias y obligaciones correspondientes. La aplicación web no simula un inicio de sesión como si fuera real: Google y correo requieren el backend desplegado. El navegador conserva solo borradores, no el saldo verdadero ni el registro definitivo de jugadas.

## Estructura

```text
index.html
assets/
  config.js          # URL pública del Web App e ID público OAuth
  app.js             # UI, cartilla 1/X/2, perfil y puente a Apps Script
  styles.css         # estética responsive
  premiumgol-logo-oficial.png  # Logo oficial proporcionado, sin alteraciones
  premiumgol-modal-logo.png   # Logo provisional del modal, sustituible por el nuevo adjunto
  stadium.svg        # estadio propio sin marcas de terceros
apps-script/
  Config.gs          # hoja base, utilidades y configuración
  Main.gs            # entrada Web App y API interna
  Auth.gs            # Google + OTP por correo, sesiones y perfiles
  Games.gs           # PremiumGol 12 partidos, bono horario, saldos y registro en Sheets
  ApiSports.gs       # prueba de conexión al proveedor; no activado
  Admin.gs           # recargas virtuales autorizadas desde el editor
  Bridge.html        # puente iframe + google.script.run
```

## Configuración desde cero (necesaria para que el login y la persistencia funcionen)

1. Crea un proyecto en <https://script.google.com> desde tu cuenta propietaria. Añade los **seis archivos `.gs`** de `apps-script/`, cada uno como *Script*, y `Bridge.html` como archivo *HTML*. Los nombres deben coincidir. No uses dos archivos distintos denominados `Code.gs` con lógica superpuesta.
2. En **Configuración del proyecto → Propiedades del script**, añade:

   | Propiedad | Valor |
   |---|---|
   | `FRONTEND_ORIGIN` | `https://tu-dominio.com`, sin `/` al final (si usas GitHub Pages, `https://USUARIO.github.io`) |
   | `GOOGLE_CLIENT_ID` | ID OAuth tipo *Aplicación web*, terminado en `.apps.googleusercontent.com` |
   | `API_SPORTS_KEY` | Opcional, para la prueba futura del proveedor de fútbol |

   `SPREADSHEET_ID` **no es necesario antes del primer paso**: lo genera la función de instalación.
3. Ejecuta **`setupPremiumGol`** desde el editor y concede los permisos para Sheets y envío de correo. Se crea una hoja de cálculo con `users`, `sessions`, `plays` y `ledger`; el ID queda registrado automáticamente en `SPREADSHEET_ID`. Abre la hoja desde Google Drive, confirma su acceso restringido y no la publiques.
4. En Google Cloud Console, crea/configura la pantalla de consentimiento y un **ID de cliente de OAuth 2.0 tipo Aplicación web**. En **Orígenes JavaScript autorizados** añade el origen de tu web, por ejemplo `https://tu-dominio.com` o `https://USUARIO.github.io`. Google Identity Services usa el ID público en el navegador; el servidor valida el token antes de crear la sesión. Puede ser necesario configurar el estado y usuarios de prueba de OAuth en Google Cloud según la publicación del proyecto.
5. En Apps Script elige **Implementar → Nueva implementación → Aplicación web**. Ejecutar como **yo (propietario)** y acceso **Cualquier persona**. El backend implementa autorización en cada operación a partir del token de sesión; no se deja la hoja abierta. Copia la URL que termina en `/exec`.
6. En `assets/config.js`, pega solamente los dos valores públicos:

   ```js
   window.PREMIUMGOL_CONFIG = {
     appsScriptUrl: 'https://script.google.com/macros/s/ID_DE_IMPLEMENTACION/exec',
     googleClientId: 'TU_CLIENT_ID.apps.googleusercontent.com'
   };
   ```

7. Publica la carpeta web completa (sin `apps-script/` si prefieres mantenerlo fuera del repositorio) en GitHub Pages o tu hosting HTTPS. El iframe de Apps Script requiere el origen exacto indicado en `FRONTEND_ORIGIN`. La web es una aplicación de una sola página; no necesitas instalar dependencias.
8. Prueba: **Registrarse → nombres, apellidos, correo → recibir código → verificar**, entrar a **Mi perfil**, completar WhatsApp y documento, rellenar **12 opciones 1/X/2**, pulsar **Colocar jugada** y comprobar `plays` y `users` en la hoja. Cierra sesión e ingresa con el mismo correo. Prueba también **Continuar con Google** desde el dominio autorizado.

Cada cambio en los archivos `.gs` exige **actualizar la implementación** del Web App para que la URL pública utilice la versión nueva. El backend devuelve mensajes de error controlados; si no llega el OTP revisa autorización de MailApp, cuotas de correo, correo no deseado y registros de ejecución.

## API-FOOTBALL

La API evaluada para la marcha blanca es **API-FOOTBALL (API-Sports)**. En noviembre de 2026, el plan Free anuncia 100 solicitudes/día y 10/minuto; acceso por licencia y disponibilidad de datos/competición. Documentación: <https://www.api-football.com/>.

1. Solicita una clave de API-Sports y guárdala solo en la propiedad privada `API_SPORTS_KEY` de Apps Script. **No** pegues la clave en HTML, JavaScript público ni GitHub.
2. Ejecuta `testApiSportsConnection()` desde Apps Script para validar el acceso y cuota. `testApiSportsFixtures()` solicita cinco encuentros como prueba manual.
3. En una futura etapa, sustituir el catálogo de demostración por fixtures + mercados 1X2, seleccionar ligas y usar caché. **Todavía no está conectado a los partidos de la web**. El backend debe validar cuotas actuales, estado del mercado y horas de cierre antes de registrar el cupón. Para apuestas *en vivo* de baja latencia, la arquitectura debe evolucionar más allá de Apps Script y sus cuotas/caché.

## Seguridad de esta versión

- Email: código OTP de 6 dígitos enviado mediante MailApp; expira en 10 min, 5 intentos por código y máximo 3 envíos por cada correo en 15 min (caché best-effort).
- Google: el backend consulta `oauth2.googleapis.com/tokeninfo`, y verifica `aud`, emisor, vencimiento y email verificado. No se almacenan ID tokens de Google.
- Sesiones: token aleatorio por cuenta; **solo SHA-256 del token** se guarda en `sessions`, con vencimiento a los 7 días. El navegador guarda el token en `sessionStorage` y lo elimina al salir.
- Datos: `users` almacena nombre, apellido, correo, prefijo y número WhatsApp, tipo y número de documento opcionales; Google Sheets está restringido al propietario. Debes añadir políticas de privacidad, eliminación de cuentas y medidas de protección de datos antes de publicar ampliamente.
- Jugadas: el servidor valida las 14 selecciones, la pertenencia del partido al catálogo de prueba, las cuotas de ejemplo, el saldo y solicitudes repetidas. `ledger` registra el bono inicial y uso de créditos.
- Limitación: **Apps Script + Sheets es una base de pruebas**, no una infraestructura lista para dinero real, altas cargas o apuestas en vivo verificadas. No existe una transacción multitabla atómica entre hojas: se necesitaría un almacén transaccional, auditoría y un motor de liquidaciones para operar profesionalmente.
- CORS: el frontend se comunica a través de `Bridge.html` embebido como iframe, con lista de orígenes permitidos y `postMessage`. No usa `fetch()` JSON directo al Web App, que suele fallar por redirecciones/CORS. Debe probarse con el despliegue real y el dominio definitivo: no es posible validarlo por completo sin tus credenciales.

## Fase siguiente

Cuando facilites la rama de GitHub, se aplicará la nueva versión sobre la estructura existente, preservando el diseño aprobado. La pasarela de pagos se estudiará separadamente; no está incluida aquí.

## Identidad y menús de esta versión

- Cabecera y pie: `assets/premiumgol-logo-oficial.png`, el PNG transparente original suministrado por el propietario; no se redibujó.
- Menú escritorio: **Inicio · PremiumGol · Apuestas deportivas · Premium Live**. Menú móvil: Inicio · PremiumGol · Apuestas · Live · Cuenta.
- El juego PremiumGol usa exactamente 12 pronósticos **1 / X / 2**. No se solicitan marcadores numéricos.
- El backend conserva por compatibilidad el identificador interno de acción `saveReto14` (no se muestra al jugador). No cambiarlo sin ajustar frontend y `Main.gs` conjuntamente.
- Sin URLs reales ni credenciales proporcionadas, el acceso externo y la API deportiva siguen pendientes de configurar y verificar tras desplegar.

## Corrección de identidad V4

- El nombre de la marca y de la cartilla de 14 resultados es **PremiumGol**.
- Navegación: Inicio, PremiumGol, Apuestas deportivas, Premium Live.
- Las funciones internas `saveReto14` / `pgSaveReto14_` siguen intactas para no romper el backend.
