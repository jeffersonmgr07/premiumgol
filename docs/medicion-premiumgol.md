# Medición de PremiumGol · integración preparada

Este módulo se instala en **PremiumGol** solamente. No comparte propiedades, píxeles ni usuarios con otros negocios.

## Archivos
- `assets/measurement-config.js`: identificadores públicos de GA4, Clarity, Meta y TikTok.
- `assets/measurement.js`: carga condicionada al consentimiento y medición de vistas de pantalla.
- `index.html`: preferencias de medición y zonas de Clarity enmascaradas.
- `assets/styles.css`: banner y preferencias adaptables a móvil.
- `assets/app.js`: reporta las vistas al cambiar entre secciones (SPA).

## Pasos para activar cada herramienta
1. **GA4:** crea una propiedad exclusiva `PremiumGol` y un flujo web para `https://premiumgol.website/`. Copia su Measurement ID `G-...` en `ga4Id`. En GA4, evita la duplicación de vistas desactivando la medición automática de cambios del historial del navegador si estás usando vistas manuales SPA.
2. **Clarity:** crea un proyecto `PremiumGol` con este dominio, copia el Project ID en `clarityId`. El perfil, login, saldo y pagos están enmascarados con `data-clarity-mask`. En Clarity puedes conectar ese proyecto a la propiedad GA4 de PremiumGol.
3. **Meta Pixel:** crea un conjunto de datos/píxel nuevo para PremiumGol desde el administrador de eventos; coloca el número en `metaPixelId`. Se deja *inactivo* mientras `enableAdPixels: false`.
4. **TikTok Pixel:** crea un píxel de PremiumGol en Events Manager, copia su ID en `tiktokPixelId`. También se deja inactivo mientras `enableAdPixels: false`.

**Importante**: la publicidad de apuestas está sujeta a autorización comercial, sectorial y de plataforma. No actives los píxeles publicitarios ni promociones de apuestas sin las aprobaciones correspondientes.

## Cómo funciona el consentimiento
- Antes de aceptar, no se solicita ningún script externo de estos cuatro proveedores.
- Si el visitante acepta **analítica**, se cargan GA4 y Clarity configurados.
- La publicidad requiere consentimiento **y** activar expresamente `enableAdPixels` tras las autorizaciones; Meta y TikTok solo reciben vistas de las secciones públicas.
- Las opciones **Aceptar**, **Rechazar** y **Configurar** están disponibles. Se puede revisar la selección desde el enlace del pie de página, sin cerrar sesión.
- La selección se guarda en el navegador durante como máximo 180 días. Si se retira consentimiento, la página se recarga para dejar de utilizar scripts iniciados.
- No enviamos por eventos personalizados correos, identificadores de cuenta, documentación, WhatsApp, tickets, saldos ni pagos. No se generan automáticamente eventos Purchase/Deposit/Bet/Prize.

## Comprobación
En el navegador abre las herramientas para desarrolladores y ejecuta:
`window.PremiumGolMeasurement.getStatus()`.
El resultado muestra si existen IDs configurados, el consentimiento actual y qué scripts se iniciaron, sin exponer secretos.

Prueba también lo siguiente:
- Sin consentimiento o con rechazo: ninguna solicitud a Google Tag, Clarity, Meta Pixel ni TikTok Pixel.
- Con consentimiento de analítica y IDs válidos: tráfico a GA4/Clarity al entrar y navegar en Inicio y PremiumGol.
- En móvil: banner sobre el menú inferior, sin bloquear botones de acceso.
- Rechazar después de aceptar: recarga y deja de cargar herramientas.
- No duplicar etiquetas si en el futuro instalas Google Tag Manager o etiquetas en otro archivo.

## Revisión antes de producción
Revisar/actualizar política de privacidad, bases legales aplicables, transferencias a terceros y condiciones de los proveedores. La interfaz de consentimiento es una capa técnica, no reemplaza una política legal completa. Clarity no debe usarse en productos dirigidos a menores de 18 años.

Fuentes oficiales:
- GA4: https://developers.google.com/analytics/devguides/collection/ga4/views
- Cuentas GA4: https://support.google.com/analytics/answer/9305788
- Clarity: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup
- TikTok: https://ads.tiktok.com/gateway/docs/index?doc_id=1701890973258754
- Meta: https://developers.facebook.com/docs/facebook-pixel/implementation/
