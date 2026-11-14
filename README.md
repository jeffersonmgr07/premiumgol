# PremiumGol — versión 4 (web + Google Apps Script)

PremiumGol es la marca deportiva de PremiumLott. Esta entrega conserva la portada de estadio nocturno y el diseño azul oscuro/dorado del prototipo anterior, con las siguientes secciones:

- **PremiumGol:** cartilla de 14 partidos, un pronóstico por encuentro: **1 = local, X = empate, 2 = visita**. Se habilita **Colocar jugada** después de completar los 14.
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
  stadium.svg        # estadio propio sin marcas de terceros
apps-script/
  Config.gs          # hoja base, utilidades y configuración
  Main.gs            # entrada Web App y API interna
  Auth.gs            # Google + OTP por correo, sesiones y perfiles
  Games.gs           # PremiumGol, cupones, saldo y registro en Sheets
  ApiSports.gs       # prueba de conexión al proveedor; no activado
  Bridge.html        # puente iframe + google.script.run
```

## Configuración desde cero (necesaria para que el login y la persistencia funcionen)

1. Crea un proyecto en <https://script.google.com> desde tu cuenta propietaria. Añade los **cinco archivos `.gs`** de `apps-script/`, cada uno como *Script*, y `Bridge.html` como archivo *HTML*. Los nombres deben coincidir. No uses dos archivos distintos denominados `Code.gs` con lógica superpuesta.
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
8. Prueba: **Registrarse → nombres, apellidos, correo → recibir código → verificar**, entrar a **Mi perfil**, completar WhatsApp y documento, rellenar **14 opciones 1/X/2**, pulsar **Colocar jugada** y comprobar `plays` y `users` en la hoja. Cierra sesión e ingresa con el mismo correo. Prueba también **Continuar con Google** desde el dominio autorizado.

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
- El juego PremiumGol usa exactamente 14 pronósticos **1 / X / 2**. No se solicitan marcadores numéricos.
- El backend conserva por compatibilidad el identificador interno de acción `saveReto14` (no se muestra al jugador). No cambiarlo sin ajustar frontend y `Main.gs` conjuntamente.
- Sin URLs reales ni credenciales proporcionadas, el acceso externo y la API deportiva siguen pendientes de configurar y verificar tras desplegar.

## Corrección de identidad V4

- El nombre de la marca y de la cartilla de 14 resultados es **PremiumGol**.
- Navegación: Inicio, PremiumGol, Apuestas deportivas, Premium Live.
- Las funciones internas `saveReto14` / `pgSaveReto14_` siguen intactas para no romper el backend.
