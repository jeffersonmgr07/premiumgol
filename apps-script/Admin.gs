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
