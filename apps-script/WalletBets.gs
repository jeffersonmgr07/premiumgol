/**
 * PremiumGol — apuestas deportivas con billeteras (principal / bonos) en Google Sheets.
 *
 * El descuento de saldo ocurre AQUÍ, en el servidor. El navegador nunca modifica
 * saldos: solo envía la solicitud y muestra el saldo que devuelve esta función.
 *
 * Interruptor (Propiedades de la secuencia de comandos):
 *   PG_WALLET_WAGERS_ENABLED = true   → habilita el cobro con saldo (apagado por defecto).
 *
 * Garantías:
 *  - Sesión válida obligatoria (pgRequireSession_).
 *  - Todo ocurre bajo LockService: el saldo se lee, se valida y se descuenta sin carreras.
 *  - El saldo NUNCA queda negativo: se rechaza si importe > saldo de la billetera elegida.
 *  - La cuota la fija el servidor (se revalida con The Odds API); el precio del cliente
 *    solo se compara, jamás se usa para calcular nada.
 *  - Idempotente por clientRequestId: reenviar la misma solicitud no vuelve a cobrar.
 *  - Billeteras separadas: principal → payments_ledger; bonos → bonus_ledger.
 *  - Solo partidos que no han empezado, máximo 4 selecciones y S/ 500 por ticket.
 *  - No hay liquidación ni abono de premios en esta etapa.
 */
const PG_WALLET_BET_TYPE='sports_wallet';
const PG_WALLET_BET_MAX_LEGS=4;
const PG_WALLET_BET_MAX_CENTS=50000;

function pgWalletBetsEnabled_(){return pgProp_('PG_WALLET_WAGERS_ENABLED')==='true';}

function pgWalletBetCharge_(requestId){
  const entryId='SWB-'+requestId;
  return pgFind_('payments_ledger','entryId',entryId)||pgFind_('bonus_ledger','entryId',entryId);
}

/** Descuenta de la billetera elegida. Debe llamarse dentro de pgLock_. */
function pgWalletBetDebit_(uid,requestId,wallet,cents,when){
  const entryId='SWB-'+requestId;
  if(!Number.isSafeInteger(cents)||cents<100)pgErr_('Ingresa un importe válido.');
  if(pgWalletBetCharge_(requestId))pgErr_('La operación ya fue registrada.');
  if(wallet==='principal'){
    // Validación de saldo no negativo: se compara en centavos enteros.
    if(Math.round(pgMoneyBalance_(uid)*100)<cents)pgErr_('Saldo principal insuficiente.');
    pgWrite_('payments_ledger',{entryId,uid,orderId:requestId,paymentId:'',
      deltaPEN:-cents/100,type:'SPORTS_WALLET_STAKE',createdAt:when});
  }else if(wallet==='bonos'){
    if(!pgBonusUnlocked_(uid))
      pgErr_('Primero realiza una recarga propia de al menos S/ 5 para usar tus bonos.');
    if(Math.round(pgBonusBalancePEN_(uid)*100)<cents)pgErr_('Saldo de bonos insuficiente.');
    pgWrite_('bonus_ledger',{entryId,uid,sourceUid:requestId,amountPEN:-cents/100,
      status:'AVAILABLE',createdAt:when,note:'Apuesta deportiva con saldo: '+requestId});
  }else pgErr_('Selecciona saldo principal o saldo de bonos.');
}

function pgWalletBetResult_(uid,requestId,wallet,stake,potentialReturn,duplicate){
  return Object.assign({},pgSnapshot_(pgFind_('users','uid',uid)),{
    walletBetId:requestId,walletBetAccepted:true,duplicate:Boolean(duplicate),
    walletBetStakePEN:stake,walletBetWallet:wallet,
    walletBetPotentialReturnPEN:potentialReturn
  });
}

/** RPC: placeWalletBet. Devuelve el snapshot oficial de la cuenta con el saldo ya descontado. */
function pgWalletBetPlace_(x){
  if(!pgWalletBetsEnabled_())
    pgErr_('Las jugadas con saldo todavía no están habilitadas.');
  return pgLock_(()=>{
    const player=pgRequireSession_(x.sessionToken);
    const u=pgObject_('users',player.values),uid=String(u.uid);
    const requestId=pgClean_(x.clientRequestId,90);
    if(!/^[a-zA-Z0-9-]{15,90}$/.test(requestId))pgErr_('Solicitud inválida.');

    // Reintento: nunca se cobra dos veces. Si un intento anterior se interrumpió
    // después de escribir el ticket pero antes del cargo, se completa el cargo
    // con los datos GUARDADOS (no con los del cliente) y se confirma el ticket.
    const existing=pgFind_('plays','playId',requestId);
    if(existing){
      const play=pgObject_('plays',existing.values);
      if(String(play.uid)!==uid||String(play.type)!==PG_WALLET_BET_TYPE)
        pgErr_('Solicitud inválida.');
      const saved=/^(?:PENDIENTE|ACEPTADA) · (principal|bonos)$/.exec(String(play.note||''));
      if(!saved)pgErr_('La operación quedó pendiente de conciliación.');
      const savedWallet=saved[1],savedCents=Math.round(Number(play.stake)*100);
      if(!pgWalletBetCharge_(requestId))
        pgWalletBetDebit_(uid,requestId,savedWallet,savedCents,pgNow_());
      if(!String(play.note).startsWith('ACEPTADA'))
        pgUpdate_('plays',existing.index,{note:'ACEPTADA · '+savedWallet});
      return pgWalletBetResult_(uid,requestId,savedWallet,savedCents/100,
        Number(play.potentialReturn)||0,true);
    }

    const wallet=pgClean_(x.walletSource,12);
    if(!['principal','bonos'].includes(wallet))
      pgErr_('Selecciona saldo principal o saldo de bonos.');
    const stake=Number(x.stake),cents=Math.round(stake*100);
    if(!Number.isFinite(stake)||!Number.isSafeInteger(cents)||
       Math.abs(stake-cents/100)>0.0000001||cents<100||cents>PG_WALLET_BET_MAX_CENTS)
      pgErr_('Ingresa un importe válido.');
    if(!Array.isArray(x.selections)||x.selections.length<1||
       x.selections.length>PG_WALLET_BET_MAX_LEGS)
      pgErr_('Selecciona entre uno y cuatro partidos.');

    // El saldo se comprueba ANTES de consumir consultas externas de cuotas.
    if(wallet==='principal'&&Math.round(pgMoneyBalance_(uid)*100)<cents)
      pgErr_('Saldo principal insuficiente.');
    if(wallet==='bonos'){
      if(!pgBonusUnlocked_(uid))
        pgErr_('Primero realiza una recarga propia de al menos S/ 5 para usar tus bonos.');
      if(Math.round(pgBonusBalancePEN_(uid)*100)<cents)
        pgErr_('Saldo de bonos insuficiente.');
    }

    const cfg=pgOddsConfig_();
    if(!cfg.key)pgErr_('Las cuotas no están disponibles.');
    const picks=[],used=new Set();let combined=1;
    for(const selection of x.selections){
      if(!selection||typeof selection!=='object')
        pgErr_('La selección ya no está disponible.');
      const gameId=pgClean_(selection.gameId,90);
      if(used.has(gameId))pgErr_('Una sola selección por partido.');
      used.add(gameId);
      // Revalida partido (no iniciado), mercado y cuota vigente contra el proveedor.
      const quote=pgSportsPrivateQuote_(selection,cfg);
      combined*=quote.odd;
      if(!Number.isFinite(combined)||combined>1000000)
        pgErr_('La cuota combinada excede el límite permitido.');
      picks.push(quote);
    }

    const when=pgNow_(),potentialReturn=Math.round(cents*combined)/100;
    // 1) Ticket PENDIENTE  2) cargo  3) ticket ACEPTADA. Si se interrumpe entre
    // pasos, el reintento con el mismo clientRequestId completa el cargo una sola vez.
    pgWrite_('plays',{playId:requestId,uid,type:PG_WALLET_BET_TYPE,
      roundId:'WALLET-PEN',picksJson:JSON.stringify(picks),stake:cents/100,
      combinedOdds:Math.round(combined*10000)/10000,potentialReturn,
      createdAt:when,note:'PENDIENTE · '+wallet});
    pgWalletBetDebit_(uid,requestId,wallet,cents,when);
    const fresh=pgFind_('plays','playId',requestId);
    if(fresh)pgUpdate_('plays',fresh.index,{note:'ACEPTADA · '+wallet});
    return pgWalletBetResult_(uid,requestId,wallet,cents/100,potentialReturn,false);
  });
}
