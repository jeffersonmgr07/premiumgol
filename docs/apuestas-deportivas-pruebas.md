# PremiumGol · Cards deportivas y control de apuestas

Actualizado: noviembre de 2026.

## Diseño
La vista de PC (desde 960 px de ancho) muestra tarjetas horizontales: fecha/hora a la izquierda, equipos apilados y liga debajo en el centro, y las cuotas 1X2 a la derecha, con acceso compacto a mercados adicionales. Se mantienen los colores navy, dorado y verde fluorescente de PremiumGol. En móvil (hasta 767 px) se mantiene la disposición existente de la card y solo se reducen altura y espacios.

Archivos web: `assets/app.js`, `assets/styles.css`, `index.html`.

## Interruptores de apuestas en Google Apps Script

**No se deben colocar los interruptores de apuestas en GitHub Pages**: el navegador no controla balances ni autoriza transacciones. Los cambios a propiedades se aplican en el servidor mediante `PropertiesService`.

En Google Apps Script → **Configuración del proyecto → Propiedades de secuencia de comandos**:

| Propiedad | Para probar ahora | Uso |
| --- | --- | --- |
| `PG_SPORTS_SANDBOX_ENABLED` | `true` | Habilita el envío al servidor de apuestas **solo de prueba con créditos virtuales** |
| `PG_SPORTS_REAL_WAGERS_ENABLED` | **`false`** | Kill switch reservado para apuestas monetarias futuras; **no activa ningún cargo real aunque se cambie a true** |

Cuando `PG_SPORTS_SANDBOX_ENABLED=true`, el usuario inicia sesión, selecciona cuotas y pulsa **Registrar prueba**. El servidor verifica contra sus copias de The Odds API, genera un ticket de prueba en la hoja existente `plays` (tipo `sports_demo`) y debita únicamente **`users.balance`**, la cartera de créditos virtuales de demostración. Registra la transacción virtual en `ledger` (acción `SPORTS_DEMO`). No escribe en `payments_ledger` ni `bonus_ledger`, no genera premios reales y no permite retiros.

El servidor vuelve a calcular cuotas, comprueba el límite de créditos virtuales, exige sesión y evita duplicaciones mediante `clientRequestId` + bloqueo de Apps Script. Si una cuota avanzada ya no está en caché o el partido no está disponible, rechaza el envío. Al no existir un motor de liquidación deportiva, los tickets de prueba no pagan premios automáticamente.

Cuando `PG_SPORTS_SANDBOX_ENABLED=false`, los usuarios pueden seguir simulando un cupón **localmente** en su propio navegador, sin escribir en Google Sheets ni afectar ningún saldo.

La función `pgRequireSportsRealWagers_()` rechaza toda solicitud de juego real de manera incondicional. `PG_SPORTS_REAL_WAGERS_ENABLED` es una **reserva para una futura integración homologada**, no un botón capaz de convertir la web actual en casa de apuestas real.


## Cómo desplegar los archivos

1. Conserva el proyecto de Apps Script conectado al sitio y verifica que tenga los archivos existentes `Config.gs`, `Auth.gs`, `Games.gs`, `TheOddsApi.gs`, `LiveOdds.gs`, `SportsArtwork.gs`, `Main.gs`, etc.
2. **Agrega el nuevo `apps-script/SportsWagers.gs`** con el mismo contenido del repositorio.
3. **Actualiza `apps-script/Main.gs`** para incluir `sportsWagerPolicy` y `submitSportsDemoBet`. Copia `apps-script/Config.gs` si quieres conservar los comentarios de ayuda actualizados; no cambia la estructura de las hojas.
4. En las propiedades privadas configura `PG_SPORTS_SANDBOX_ENABLED=true` y **`PG_SPORTS_REAL_WAGERS_ENABLED=false`**. La propiedad existente `THE_ODDS_API_KEY` debe estar configurada y debes tener saldo de créditos demo suficiente.
5. En Apps Script elige **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**. No ejecutes `setupPremiumGol()` ni crees nuevas pestañas.
6. Abre `https://premiumgol.website/#match`, inicia sesión, añade una selección y comprueba en las pestañas `plays` y `ledger` el ticket tipo `sports_demo`. Verifica que `users.balance` bajó por los créditos de prueba **y que los saldos reales/bonos siguen idénticos**.
7. Repite el envío o recarga para verificar que el ticket no se duplica. Ensaya saldo virtual insuficiente. Para detener las pruebas de servidor, cambia `PG_SPORTS_SANDBOX_ENABLED=false`.
8. Los cambios a propiedades suelen aplicarse sin un nuevo despliegue, pero **cambiar archivos de código sí requiere una nueva versión**.

**Advertencia:** si quieres pruebas completamente aisladas de las cuentas públicas actuales, usa una **copia de Google Sheets y un despliegue de Apps Script de staging**, y asigna a ese despliegue `SPREADSHEET_ID` de la hoja de pruebas. Las pruebas en el Sheet de producción modificarán los créditos virtuales de las cuentas que participen.

## Limitaciones actuales
- El listado de cuotas sigue dependiendo del plan, mercados y caché de The Odds API; no se garantiza disponibilidad ni precio en tiempo real.
- Las insignias son imágenes externas de TheSportsDB y pueden faltar según la liga/equipo.
- El switch de dinero real **no activa** cargos, premios ni retiros. Habilitarlo por sí solo no sería una implementación operativa ni una autorización legal.
- No se ha ejecutado el despliegue Apps Script de la cuenta del usuario desde GitHub.
