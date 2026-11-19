# Correcciones 19/11/2026

1. **Clics muertos**: `assets/app.js` tenía 3 defectos que abortaban el script (SyntaxError por bloque huérfano tras `placeBet()`, `ReferenceError` por una línea `const img=…art…` suelta, y cierre prematuro de la IIFE). Además `$(...).forEach` → `$$`. Listeners ahora con `on()` seguro. CSS: capas decorativas con `pointer-events:none!important`.
2. **Footer**: `padding-bottom: calc(90px + safe-area)` en móvil, rejilla de 1 columna, sin desbordes.
3. **Saldo en Google Sheets**: nueva acción `placeWalletBet` (`apps-script/WalletBets.gs`), `doPost` en `Main.gs`, `fetch` POST en `app.js` (respaldo por puente, idempotente). Eliminada la billetera local de localStorage.

**Apps Script**: copiar `Main.gs` y `WalletBets.gs`; propiedad `PG_WALLET_WAGERS_ENABLED=true`; Implementar → Administrar implementaciones → Editar → Nueva versión.
