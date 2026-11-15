/** Entrada del iframe de GitHub Pages. El puente nunca contiene lógica de juegos. */
function doGet(e){
  if(!e||String((e.parameter||{}).bridge)!=='1')return HtmlService.createHtmlOutput('Premium Gol · Acceso');
  const allowed=pgProp_('FRONTEND_ORIGIN');
  if(!/^https?:\/\/[^/]+$/.test(allowed))return HtmlService.createHtmlOutput('Falta configurar FRONTEND_ORIGIN');
  const t=HtmlService.createTemplateFromFile('Bridge');
  t.allowedOrigin=allowed;
  t.nonce=pgClean_((e.parameter||{}).nonce,90);
  // ALLOWALL permite integrar un iframe en el dominio indicado; Bridge valida origin en cada mensaje.
  return t.evaluate().setTitle('Premium Gol').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/** RPC: Todas las operaciones sensibles pasan por validación de sesión. */
function rpc(requestJson){
  try{
    if(typeof requestJson!=='string'||requestJson.length>12000)pgErr_('Solicitud inválida.');
    const req=JSON.parse(requestJson),x=req.data||{};
    if(!req||typeof req.action!=='string'||typeof x!=='object')pgErr_('Solicitud inválida.');
    switch(req.action){
      case 'catalog':return pgPublicSportsCatalog_();
      case 'golProgram':return pgPublicGolProgram_();
      case 'health':return {ok:true,server:'premiumgol',version:'2026-11-15',sportsConfigured:Boolean(pgProp_('API_SPORTS_KEY')),catalogMode:pgProp_('API_SPORTS_CATALOG_MODE')==='preview'?'preview':'disabled'};
      case 'sendCode':return pgSendCode_(x);
      case 'verifyCode':return pgVerifyCode_(x);
      case 'googleLogin':return pgGoogleLogin_(x);
      case 'me':return pgMe_(x);
      case 'updateProfile':return pgUpdateProfile_(x);
      case 'savePremiumGol':return pgSavePremiumGol_(x);
      case 'createTopupRequest':return pgCreateTopupRequest_(x);
      case 'claimCoupon':return pgClaimCoupon_(x);
      case 'saveBet':return pgSaveBet_(x);
      case 'signout':return pgSignout_(x);
      default:pgErr_('Operación no disponible.');
    }
  }catch(err){
    console.warn('RPC failed:',err&&err.message);
    // Mensajes públicos: nunca exponer trazas, tokens ni IDs de hojas.
    const publicMessages=[
      'Solicitud inválida.','Operación no disponible.','La cuenta todavía no está configurada.',
      'Falta configurar la base de datos.','Hay muchas solicitudes. Vuelve a intentarlo.',
      'El código es incorrecto o ha vencido.','Solicita otro código dentro de unos minutos.',
      'No se pudo enviar el código. Intenta más tarde.','Correo electrónico no válido.',
      'Regístrate primero para crear tu cuenta.','El correo ya tiene una cuenta. Utiliza Ingresar.',
      'Completa nombres y apellidos.','Sesión vencida. Vuelve a ingresar.',
      'No se pudo validar el acceso con Google.','Elige las 12 opciones antes de continuar.',
      'La cartilla contiene selecciones no válidas.','No hay partidos seleccionados.',
      'Se debe elegir una opción por partido.','Solo puedes usar de 1 a 1,000 créditos.',
      'Créditos insuficientes.','La selección de un partido ya no está disponible.',
      'El número de documento no es válido.','El número de WhatsApp no es válido.',
      'Ingresa tu número de WhatsApp para registrarte.',
      'La cartilla está cerrada para nuevas jugadas.',
      'El tipo de documento no es válido.','La jugada ya fue registrada.','Esta jugada ya fue registrada en la jornada.',
      'Selecciona una jugada entre A y D.','Saldo virtual insuficiente.',
      'Ingresa un monto válido entre S/ 30 y S/ 10,000.',
      'Este cupón no está disponible en este momento.','Este cupón ya fue activado en tu cuenta.'
    ];
    const message=err&&publicMessages.includes(err.message)?err.message:'No se pudo completar la solicitud. Intenta nuevamente.';
    return {ok:false,message};
  }
}
