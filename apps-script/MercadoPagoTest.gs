/**
 * PremiumGol — prueba MANUAL y aislada de Mercado Pago Checkout Pro.
 * Ejecutar SOLO en el editor Apps Script, no registrar en Main.gs/rpc().
 *
 * Propiedades privadas:
 *   MP_TEST_ACCESS_TOKEN = token del ENTORNO DE PRUEBA de Mercado Pago
 *   MP_TEST_MODE = YES_TEST_CREDENTIALS
 *
 * No inserta pedidos, no acredita créditos, no habilita cobros del sitio.
 * Una preferencia creada NO prueba que exista un pago recibido.
 */
function testPremiumGolMercadoPagoPreference(){
  if(pgProp_('MP_TEST_MODE')!=='YES_TEST_CREDENTIALS'){
    pgErr_('Activa expresamente el entorno de pruebas de Mercado Pago.');
  }
  const token=pgProp_('MP_TEST_ACCESS_TOKEN');
  if(!token||token.length<35)pgErr_('Falta configurar MP_TEST_ACCESS_TOKEN de pruebas.');
  const reference='PREVIEW-'+pgUuid_();
  const body={
    items:[{
      id:'premiumgol-checkout-technical-test',
      title:'PremiumGol - prueba técnica sin crédito en billetera',
      description:'Solo verificación de preferencia; no se registra jugada ni recarga.',
      quantity:1,
      currency_id:'PEN',
      unit_price:5
    }],
    external_reference:reference,
    back_urls:{
      success:'https://premiumgol.website/',
      pending:'https://premiumgol.website/',
      failure:'https://premiumgol.website/'
    }
  };
  let response;
  try{
    response=UrlFetchApp.fetch('https://api.mercadopago.com/checkout/preferences',{
      method:'post',
      contentType:'application/json',
      headers:{Authorization:'Bearer '+token},
      payload:JSON.stringify(body),
      muteHttpExceptions:true
    });
  }catch(e){
    console.warn('Mercado Pago test: fallo de conexión al crear preferencia.');
    pgErr_('Mercado Pago no respondió a la prueba.');
  }
  const status=response.getResponseCode();
  let result={};
  try{result=JSON.parse(response.getContentText()||'{}');}catch(e){}
  // No imprimir cuerpo de error: podría contener información de integraciones.
  console.log('Mercado Pago: HTTP='+status+', preferencia creada='+
    Boolean(status>=200&&status<300&&result.id));
  if(status<200||status>=300||!result.id){
    return {ok:false,httpStatus:status,environment:'PRUEBA',message:'No se creó la preferencia.'};
  }
  return {
    ok:true,environment:'PRUEBA',preferenceId:String(result.id),
    amountPEN:5,
    // No se devuelve el init_point: esta prueba solo verifica conexión
    // sin facilitar el inicio accidental de un cobro.
    checkoutReady:false,
    walletCredited:false
  };
}
