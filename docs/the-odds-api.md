# PremiumGol · The Odds API v4 (cuotas de fútbol)

Integración de **consultas informativas** de cuotas 1X2 de partidos de fútbol (local/empate/visita). La web usa **GitHub Pages → iframe Apps Script → The Odds API**. La clave API vive **solo** en las propiedades privadas de Google Apps Script.

## Archivos modificados en GitHub

- `apps-script/TheOddsApi.gs`: nuevo adaptador del proveedor, normalizador 1X2, snapshots en propiedades del servidor, control diario de consultas.
- `apps-script/Main.gs`: ruta pública `catalog` apuntando al nuevo adaptador y `health` actualizado.
- `apps-script/Config.gs`: documentación de las propiedades privadas.
- `assets/app.js`: muestra encuentros, liga, precios y casa de apuestas de referencia; elimina el modal de construcción de las secciones deportivas, **sin habilitar la colocación de apuestas**.
- `index.html` y `assets/styles.css`: etiquetas y fecha/hora de la fuente de cuotas, indicadores de datos informativos.

No se alteraron las recargas, cuentas, bonos, pronósticos PremiumGol ni la lógica de premios.

## Activación obligatoria

1. En **The Odds API → Dashboard**, genera una clave nueva si la anterior fue compartida en mensajes o archivos. **No copies la clave a GitHub**, `assets/config.js`, HTML ni JavaScript del navegador.
2. En tu **proyecto existente** de Google Apps Script, actualiza `Main.gs` y `Config.gs` desde el repositorio; crea un archivo Apps Script llamado `TheOddsApi.gs` con el contenido nuevo.
3. Abre **Configuración del proyecto → Propiedades de secuencia de comandos** y añade la propiedad obligatoria:

   - Nombre: `THE_ODDS_API_KEY`
   - Valor: **tu nueva clave privada de The Odds API** (no se incluye en este repositorio).

4. Las siguientes propiedades son **opcionales**:

   | Propiedad | Valor sugerido | Descripción |
   | --- | --- | --- |
   | `THE_ODDS_SPORT_KEYS` | `soccer_epl,soccer_spain_la_liga,soccer_italy_serie_a` | Ligas, separadas por coma, máximo 6 |
   | `THE_ODDS_REGION` | `eu` | Una sola región (`eu`, `uk`, `us`, `au`) |
   | `THE_ODDS_REFRESH_MINUTES` | `360` | Caché compartida 6 horas; mínimo 30 minutos |
   | `THE_ODDS_DAILY_LIMIT` | `12` | Máximo diario de llamadas API desde el servidor |

   Si no creas estas propiedades, funcionan los valores predeterminados.

5. En **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**, actualiza la **misma** Web App de Apps Script manteniendo la URL conectada a PremiumGol.
6. Desde el editor selecciona la función opcional `testTheOddsApiConnection()` y pulsa **Ejecutar** una sola vez. El resultado en el registro de ejecución incluye si la clave está configurada, ligas, partidos obtenidos y última actualización. **No muestra ni imprime la clave**. Si hay datos disponibles consumirá hasta tres consultas en el primer arranque.
7. Abre `https://premiumgol.website/#match` y `https://premiumgol.website/#live`. Deberías ver los próximos partidos y las cuotas disponibles (no todos los partidos tienen mercado); si no hay mercados en esas ligas, verás un mensaje de disponibilidad, sin ejemplos inventados.

**No es necesario ejecutar `setupPremiumGol()`, crear una hoja nueva ni modificar Google Sheets.**

## Modelo y alcance

La consulta usa `GET https://api.the-odds-api.com/v4/sports/{sport}/odds` con `regions=eu`, `markets=h2h` y `oddsFormat=decimal` (configurables en lo indicado). La clave se transmite en el header **`x-api-key`** desde Apps Script.

- Los mercados 1X2 proceden de **una sola casa de apuestas por encuentro**; nunca se combinan precios de diferentes casas.
- Solo se muestran mercados que incluyen local, empate y visitante, con precios decimales válidos.
- Los partidos iniciados se muestran en Live **solo si la consulta y la cuota del operador son recientes** (menos de 15 minutos). El endpoint de cuotas no proporciona marcador ni minuto exacto, por lo que **no se inventan**.
- Una cuota de un proveedor externo es **referencial**: no es una oferta ni garantiza que esté vigente cuando el visitante la vea.
- Los botones de cuotas y la confirmación de apuestas deportivas permanecen **inactivos**. No hay aceptación de apuestas ni abonos vinculados a The Odds API.
- La API puede no devolver partidos si una liga no está en temporada, no tiene cuotas en la región elegida o la cuota diaria está agotada.

## Protección de cuota gratuita

The Odds API publica un plan gratis de **500 créditos por mes**. Un mercado en una región cuesta normalmente **1 crédito por liga**. Los valores iniciales (3 ligas, intervalo de 6 h) pueden consumir aproximadamente **12 créditos diarios** o unos **360 en 30 días**, si hay mercados disponibles. El servidor guarda los últimos resultados y **limita a 12 las llamadas al día** para no consumir toda la cuota. Esto **no es un servicio de cuotas en vivo en tiempo real**: para frecuencias de actualización más altas se requerirá revisar plan y límites.

El servidor guarda metadatos internos en estas propiedades (no es necesario crearlas): `THE_ODDS_DAILY_USAGE`, `THE_ODDS_LAST_ATTEMPT` y `THE_ODDS_SNAPSHOT_<liga>`.

**El contrato de API puede limitar usos o requerir licencias adicionales**. Revisa las condiciones comerciales y las autorizaciones regulatorias que correspondan antes de ofrecer apuestas de dinero real.

## Verificación y solución de problemas

- Si el sitio indica que falta configurar: comprueba `THE_ODDS_API_KEY` exactamente, el proyecto Apps Script correcto y el despliegue **Nueva versión**.
- Si el servidor indica que no hay partidos: verifica que la liga esté activa y disponible en la región del mercado; prueba `THE_ODDS_REGION=uk` o una liga diferente, sin incluir regiones múltiples para ahorrar créditos.
- Si no aparecen cambios instantáneamente: los resultados están en caché hasta 6 horas de forma predeterminada. El plan gratuito no resulta adecuado para apostar con cotizaciones que exigen actualización instantánea.
- Si hay errores de conexión, revisa **Apps Script → Ejecuciones**, sin imprimir credenciales. El cliente no necesita una clave API.
- No guardar claves ni respuestas sin revisar en el repositorio.

### Fuentes de referencia oficiales

- https://the-odds-api.com/liveapi/guides/v4/
- https://the-odds-api.com/sports-odds-data/sports-apis
- https://the-odds-api.com/
- https://the-odds-api.com/terms-and-conditions.html
