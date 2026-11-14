/** Solicitudes de recarga: solo se registran órdenes PENDIENTES.
 * No genera pagos, no llama a Mercado Pago y NO acredita saldo.
 * Un servidor autorizado deberá validar webhooks firmados y estado de cobro antes de futuros abonos reales.
 */
function pgCreateTopupRequest_(x){
  return pgLock_(()=>{
    const row=pgRequireSession_(x.sessionToken);
    const user=pgObject_('users',row.values);
    const value=Number(x.amount);
    const amountCents=Math.round(value*100);
    if(!Number.isFinite(value)||value<30||value>10000||
       !Number.isSafeInteger(amountCents)||Math.abs(value*100-amountCents)>0.00001){
      pgErr_('Ingresa un monto válido entre S/ 30 y S/ 10,000.');
    }
    const reference=pgClean_(x.clientRequestId,90);
    if(!/^[A-Z0-9-]{10,90}$/i.test(reference))pgErr_('Solicitud inválida.');
    const previous=pgFind_('topup_requests','orderId',reference);
    if(previous){
      const prior=pgObject_('topup_requests',previous.values);
      if(String(prior.uid)!==String(user.uid)||Math.round(Number(prior.amountPEN)*100)!==amountCents){
        pgErr_('Solicitud inválida.');
      }
      return {ok:true,orderId:reference,amount:amountCents/100,
        status:String(prior.status),paymentAvailable:false};
    }
    const at=pgNow_();
    pgWrite_('topup_requests',{orderId:reference,uid:user.uid,
      amountPEN:amountCents/100,status:'PENDIENTE',createdAt:at,updatedAt:at});
    return {ok:true,orderId:reference,amount:amountCents/100,
      status:'PENDIENTE',paymentAvailable:false};
  });
}
