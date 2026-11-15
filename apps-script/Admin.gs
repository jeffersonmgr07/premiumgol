/** Solo se ejecuta desde el editor Apps Script por el administrador; NO se expone en rpc().
 * Agrega créditos virtuales sin pagos: no prueba que el usuario haya transferido dinero.
 * Antes de ejecutarlo, configura ADMIN_EMAIL, RECHARGE_EMAIL y RECHARGE_REFERENCE
 * en las propiedades privadas del script. Usa una referencia nueva por autorización.
 */
function adminRecharge50FromEditor(){
  const email=pgProp_('RECHARGE_EMAIL');
  const reference=pgProp_('RECHARGE_REFERENCE');
  if(!email||!reference)pgErr_('Configura RECHARGE_EMAIL y RECHARGE_REFERENCE.');
  return adminApproveVirtualRecharge(email,50,reference);
}

/** Ajusta UNA cuenta de prueba antigua de 1,000 a 10 créditos.
 * Ejecutar manualmente en Apps Script como ADMIN_EMAIL.
 * Requiere propiedad ADJUST_EMAIL con el correo exacto.
 * Solo se admite si hay una única entrada BONO_INICIAL de 1,000,
 * ninguna jugada, ningún otro movimiento de ledger ni recarga registrada.
 * Nunca se ejecuta desde el frontend ni afecta cuentas ajenas.
 */
function adminNormalizeSingleDemoBalance10(){
  const administrator=pgProp_('ADMIN_EMAIL').toLowerCase();
  const current=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  if(!administrator||current!==administrator)pgErr_('No autorizado.');
  const email=pgEmail_(pgProp_('ADJUST_EMAIL'));
  return pgLock_(()=>{
    const row=pgFind_('users','email',email);
    if(!row)pgErr_('No existe la cuenta indicada.');
    const user=pgObject_('users',row.values);
    const ledger=pgRows_('ledger').rows.filter(v=>String(v[1])===String(user.uid));
    const plays=pgRows_('plays').rows.filter(v=>String(v[1])===String(user.uid));
    const topups=pgRows_('topup_requests').rows.filter(v=>String(v[1])===String(user.uid));
    if(Number(user.balance)!==1000||ledger.length!==1||plays.length||topups.length||
      String(ledger[0][3])!=='BONO_INICIAL'||Number(ledger[0][4])!==1000){
      pgErr_('La cuenta tiene movimientos; no se realizará el ajuste automático.');
    }
    const newBalance=10,date=pgNow_();
    pgUpdate_('users',row.index,{balance:newBalance,updatedAt:date});
    pgWrite_('ledger',{txId:pgUuid_(),uid:user.uid,playId:'',
      action:'AJUSTE_DEMO_INICIAL',delta:-990,balanceAfter:newBalance,createdAt:date});
    console.log('Ajuste de créditos de prueba completado para un usuario autorizado.');
    return {ok:true,balance:newBalance};
  });
}
