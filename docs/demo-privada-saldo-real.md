# PremiumGol — Demostración privada con recargas y saldo monetario

## Objetivo

Presentar al posible comprador una operación comprobable de extremo a extremo: inicio de sesión, saldo principal procedente de recargas aprobadas, selección de cuotas deportivas, validación de cuotas desde el proveedor, descuento de saldo en PEN, registro contable e historial de ticket. También existe el origen `bonos`, independiente del principal.

Esta modalidad **no se habilita a visitantes generales del sitio**. El endpoint solo permite el acceso a las cuentas que el operador añada expresamente a una lista privada; todas las demás mantienen el modo de simulación.

**Precisión:** el código queda almacenado en el repositorio GitHub; GitHub Pages es un alojamiento público. La lista blanca protege la **operación monetaria**, no oculta el HTML o JS del sitio. Para que también la demostración visual sea privada, se recomienda un despliegue separado con autenticación de acceso.

## Archivos que debes copiar al Apps Script que ya usas

1. **Nuevo**: `apps-script/SportsPrivate.gs`
2. **Actualizar**: `apps-script/SportsWagers.gs`
3. **Actualizar**: `apps-script/Main.gs`
4. **Opcional (comentarios)**: `apps-script/Config.gs`

Conserva `Auth.gs`, `Games.gs`, `Topups.gs`, `TheOddsApi.gs`, `LiveOdds.gs`, `SportsArtwork.gs` y demás archivos ya desplegados. Si alguna actualización anterior no está copiada, usa la versión actual de GitHub para evitar referencias a funciones inexistentes. Después de agregar código selecciona **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar** para mantener la misma URL de tu Web App.

No hace falta crear pestañas ni ejecutar `setupPremiumGol()`. Se reutilizan `plays`, `payments_ledger` y `bonus_ledger`.

## Propiedades de secuencia de comandos (privadas)

En **Configuración del proyecto → Propiedades de secuencia de comandos**:

| Propiedad | Ejemplo de valor | Qué hace |
| --- | --- | --- |
| `PG_SPORTS_PRIVATE_MONEY_ENABLED` | `false` inicialmente; después `true` cuando estés preparado | Interruptor general de operación monetaria privada. |
| `PG_SPORTS_PRIVATE_EMAILS` | `tu-cuenta@ejemplo.com` | Correos concretos autorizados, separados por comas. **No pongas este valor en GitHub.** |
| `THE_ODDS_API_KEY` | Tu clave privada vigente | Imprescindible para revalidar cada cuota al colocar una apuesta. |
| `THE_ODDS_DAILY_LIMIT` | `12` (predeterminado) | Límite total diario; cada apuesta puede consumir créditos adicionales por mercado/partido. |
| `PG_SPORTS_SANDBOX_ENABLED` | `false` si prefieres la demostración monetaria | Mantiene el modo alternativo de créditos virtuales, independiente del modo privado. |

No se modifica `PG_WALLET_WAGERS_ENABLED` y tampoco necesitas establecer `PG_SPORTS_REAL_WAGERS_ENABLED`: esas propiedades pertenecen a flujos anteriores y no habilitan esta demostración privada.

**Para dejarla desactivada**: `PG_SPORTS_PRIVATE_MONEY_ENABLED=false`. Para reanudar, configura `true` y conserva exclusivamente tus cuentas de prueba en `PG_SPORTS_PRIVATE_EMAILS`.

## Recorrido de prueba previsto

1. Comprueba que la cuenta indicada en `PG_SPORTS_PRIVATE_EMAILS` puede iniciar sesión. Entra a Mi cuenta y verifica **Saldo principal = S/ 0.00** o el importe anterior.
2. Realiza una recarga pequeña utilizando la integración ya existente de Mercado Pago, siempre en el entorno y condiciones habilitados por tu proveedor. El backend solamente reconoce depósitos con estado **aprobado** en `payments_ledger`.
3. Entra a Apuestas Deportivas, selecciona un mercado para un encuentro que aún **no haya empezado** y abre Mi cupón. Verás el selector **Saldo principal / Saldo de bonos** y el botón **Colocar apuesta**.
4. Ingresa, por ejemplo, **S/ 2.00** con S/ 5.00 en principal, elige Saldo principal y confirma. Apps Script consulta la cuota actual de ese mercado en The Odds API; si ha cambiado, rechaza el ticket sin cobrar. Si coincide y está vigente, crea el ticket en `plays`, descuenta `-2.00` en `payments_ledger` y devuelve el saldo principal actualizado a S/ 3.00.
5. Vuelve a Mi cuenta y revisa `plays` (`type=sports_private`, `note=ACEPTADA · principal`) y `payments_ledger` (`type=SPORTS_PRIVATE_STAKE`). El historial conserva los eventos, las selecciones y las cuotas efectivamente verificadas.
6. Si seleccionas bonos, el backend comprueba las condiciones de activación anteriores y escribe solo en `bonus_ledger`; el principal no cambia.
7. Prueba saldo insuficiente, precio modificado y reenvío del mismo `clientRequestId`; no debería haber un segundo descuento.

### Tratamiento de una escritura interrumpida

Google Sheets no ofrece una transacción ACID entre distintas pestañas. Para priorizar la integridad, el backend escribe primero un ticket `PENDIENTE`, luego el débito y finalmente lo marca `ACEPTADA`. Si se interrumpe entre pasos, el reintento **no efectúa automáticamente otro débito**; el ticket requiere conciliación manual. Antes de una demostración comercial con carga elevada, conviene migrar el libro contable a PostgreSQL.

### Alcance actual

- La recepción de apuestas monetarias está limitada a correos autorizados y **prematch** (partidos aún no iniciados), con máximo de cuatro selecciones y S/ 500 por ticket.
- La validación usa la última cuota del proveedor en el momento de enviar el cupón; no se acepta el precio arbitrario enviado desde el navegador.
- La recarga por Mercado Pago sigue siendo el componente ya implementado, sujeto a la configuración de su cuenta y aprobaciones; **esta actualización no prueba ni habilita nuevos métodos de pago**.
- **La liquidación de apuestas ganadoras y abono de premios deportivos todavía no están implementados aquí.** Se conserva el retorno potencial en el ticket. Habrá que añadir un servicio de resultados y reglas de liquidación, con controles para anulaciones, devoluciones y auditoría antes de ofrecer el circuito completo.
- La existencia de un entorno privado no constituye por sí sola una determinación de la legislación aplicable. Comprueba las condiciones del proveedor de pagos, licencias de cuotas y autorizaciones pertinentes antes de habilitar la actividad fuera del entorno de desarrollo.

## Archivos web

`assets/app.js` presenta el selector de billetera y el botón de envío únicamente si la política devuelta por Apps Script confirma que la sesión está en la lista privada. En los demás casos siguen disponibles las pruebas con créditos virtuales. Nunca se incluyen correos de la lista ni claves privadas en el frontend.
