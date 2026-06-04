/*
Backend Google Apps Script para venta de trenes My Cusco Trip.

Pasos rápidos:
1. Crea un Google Sheet nuevo.
2. Copia el ID del Sheet y pégalo en SPREADSHEET_ID.
3. En Google Sheets: Extensiones > Apps Script.
4. Pega todo este archivo.
5. Ejecuta setupTrainSheets() una vez y autoriza permisos.
6. En Propiedades del script agrega:
   PAYPAL_MODE = sandbox o live
   PAYPAL_CLIENT_ID = tu client id
   PAYPAL_CLIENT_SECRET = tu secret
7. Ajusta PUBLIC_BASE_URL con la URL final, por ejemplo:
   https://mycuscotrip.com/trenes
8. Implementar > Nueva implementación > Aplicación web.
   Ejecutar como: tú.
   Quién tiene acceso: cualquier usuario con el enlace.
9. Copia la URL /exec en trenes/assets/js/config.js > appsScriptUrl.
*/

const SPREADSHEET_ID = 'PEGAR_AQUI_ID_DE_GOOGLE_SHEET';
const PUBLIC_BASE_URL = 'https://mycuscotrip.com/trenes';
const SUPPORT_EMAIL = 'reservas@mycuscotrip.com';
const BRAND_NAME = 'My Cusco Trip';

const SHEET_ORDERS = 'OrdenesTrenes';
const SHEET_PASSENGERS = 'PasajerosTren';
const SHEET_PAYMENTS = 'PagosTren';
const SHEET_LOGS = 'LogsTren';

const ORDER_HEADERS = [
  'fechaOrden','codigoReserva','estadoPago','tripType','fechaIda','fechaRetorno','rutaIda','rutaRetorno',
  'adultos','ninos','moneda','tipoCambio','montoTrenIda','montoTrenRetorno','montoExtras','totalUsd','totalPen',
  'empresaIda','trenIdaCodigo','trenIdaServicio','trenIdaSalida','trenIdaLlegada','empresaRetorno','trenRetornoCodigo','trenRetornoServicio','trenRetornoSalida','trenRetornoLlegada',
  'titularNombre','titularWhatsapp','titularCorreo','paypalOrderId','paypalCaptureId','paypalStatus','fechaPagoPaypal',
  'extrasJson','trenesJson','pasajerosJson','ordenJson','observaciones'
];

const PASSENGER_HEADERS = [
  'fechaRegistro','codigoReserva','indice','tipo','nombres','apellidos','nacionalidad','tipoDocumento','numeroDocumento','fechaNacimiento','edad','whatsapp','correo'
];

const PAYMENT_HEADERS = [
  'fecha','codigoReserva','proveedor','monto','moneda','paypalOrderId','paypalCaptureId','estado','payloadJson'
];

const LOG_HEADERS = ['fecha','accion','codigoReserva','estado','mensaje','payloadJson'];

function setupTrainSheets() {
  getSheet_(SHEET_ORDERS, ORDER_HEADERS);
  getSheet_(SHEET_PASSENGERS, PASSENGER_HEADERS);
  getSheet_(SHEET_PAYMENTS, PAYMENT_HEADERS);
  getSheet_(SHEET_LOGS, LOG_HEADERS);
}

function doGet(e) {
  return json_({ ok:true, service:'My Cusco Trip Trenes API', time:new Date().toISOString() });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').trim();
    const payload = body.payload || body;

    if (action === 'createTrainOrder') return createTrainOrder_(payload);
    if (action === 'createPayPalTrainOrder') return createPayPalTrainOrder_(payload);
    if (action === 'capturePayPalTrainOrder') return capturePayPalTrainOrder_(payload);

    return json_({ ok:false, message:'Acción no reconocida.' });
  } catch (err) {
    log_('doPost', '', 'ERROR', err && err.stack ? err.stack : String(err), {});
    return json_({ ok:false, message:String(err && err.message ? err.message : err) });
  }
}

function createTrainOrder_(order) {
  validateConfig_();
  const code = cleanCode_(order.code || '');
  if (!code) return json_({ ok:false, message:'Código de reserva requerido.' });
  if (findOrderByCode_(code)) return json_({ ok:true, message:'La orden ya existe.', code:code });

  const passengers = Array.isArray(order.passengers) ? order.passengers : [];
  if (!passengers.length) return json_({ ok:false, message:'Agrega al menos un pasajero.' });
  const lead = passengers[0] || {};
  if (!lead.email || !lead.whatsapp) return json_({ ok:false, message:'El titular debe tener correo y WhatsApp.' });

  const amounts = order.amounts || {};
  const trains = order.trains || {};
  const outbound = trains.outbound || {};
  const returned = trains.return || {};
  const route = order.route || {};
  const dates = order.dates || {};
  const pax = order.pax || {};

  const sheet = getSheet_(SHEET_ORDERS, ORDER_HEADERS);
  appendObjectRow_(sheet, {
    fechaOrden: new Date(),
    codigoReserva: code,
    estadoPago: order.status || 'Pendiente de pago',
    tripType: order.tripType || '',
    fechaIda: dates.outbound || '',
    fechaRetorno: dates.return || '',
    rutaIda: route.outboundRoute || '',
    rutaRetorno: route.returnRoute || '',
    adultos: pax.adults || 0,
    ninos: pax.children || 0,
    moneda: order.currency || 'USD',
    tipoCambio: order.exchangeRate || '',
    montoTrenIda: amounts.outbound || 0,
    montoTrenRetorno: amounts.return || 0,
    montoExtras: amounts.extras || 0,
    totalUsd: amounts.totalUsd || 0,
    totalPen: amounts.totalPen || 0,
    empresaIda: outbound.companyName || outbound.company || '',
    trenIdaCodigo: outbound.code || '',
    trenIdaServicio: outbound.serviceName || '',
    trenIdaSalida: formatTrainLeg_(outbound, 'departure'),
    trenIdaLlegada: formatTrainLeg_(outbound, 'arrival'),
    empresaRetorno: returned.companyName || returned.company || '',
    trenRetornoCodigo: returned.code || '',
    trenRetornoServicio: returned.serviceName || '',
    trenRetornoSalida: returned.code ? formatTrainLeg_(returned, 'departure') : '',
    trenRetornoLlegada: returned.code ? formatTrainLeg_(returned, 'arrival') : '',
    titularNombre: ((lead.firstName || '') + ' ' + (lead.lastName || '')).trim(),
    titularWhatsapp: lead.whatsapp || '',
    titularCorreo: lead.email || '',
    paypalOrderId: '',
    paypalCaptureId: '',
    paypalStatus: '',
    fechaPagoPaypal: '',
    extrasJson: JSON.stringify(order.extras || {}),
    trenesJson: JSON.stringify(trains),
    pasajerosJson: JSON.stringify(passengers),
    ordenJson: JSON.stringify(order),
    observaciones: ''
  });

  const passengerSheet = getSheet_(SHEET_PASSENGERS, PASSENGER_HEADERS);
  passengers.forEach(function(p, index) {
    appendObjectRow_(passengerSheet, {
      fechaRegistro: new Date(),
      codigoReserva: code,
      indice: p.index || index + 1,
      tipo: p.type || '',
      nombres: p.firstName || '',
      apellidos: p.lastName || '',
      nacionalidad: p.nationality || '',
      tipoDocumento: p.docType || '',
      numeroDocumento: p.docNumber || '',
      fechaNacimiento: p.birthDate || '',
      edad: p.age || '',
      whatsapp: p.whatsapp || '',
      correo: p.email || ''
    });
  });

  sendTrainOrderCreatedEmail_(order);
  log_('createTrainOrder', code, 'OK', 'Orden creada', order);
  return json_({ ok:true, message:'Orden creada correctamente.', code:code });
}

function createPayPalTrainOrder_(payload) {
  validateConfig_();
  const code = cleanCode_(payload.code || '');
  if (!code) return json_({ ok:false, message:'Código de reserva requerido.' });
  const found = findOrderByCode_(code);
  if (!found) return json_({ ok:false, message:'No encontramos la orden en Google Sheets.' });

  const status = String(found.data.estadoPago || '').trim().toLowerCase();
  if (status === 'pagado') return json_({ ok:false, message:'Esta orden ya figura como pagada.' });

  const amount = Number(found.data.totalUsd || payload.total || 0);
  if (!amount || amount <= 0) return json_({ ok:false, message:'El monto de la orden no es válido.' });

  const auth = paypalAccessToken_();
  const returnUrl = PUBLIC_BASE_URL.replace(/\/$/, '') + '/paypal-retorno.html?code=' + encodeURIComponent(code);
  const cancelUrl = PUBLIC_BASE_URL.replace(/\/$/, '') + '/index.html?paypal=cancelado&code=' + encodeURIComponent(code);
  const body = {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: code,
      custom_id: code,
      invoice_id: code,
      amount: { currency_code: 'USD', value: amount.toFixed(2) },
      description: 'Tickets de tren a Machu Picchu - ' + code
    }],
    application_context: {
      brand_name: BRAND_NAME,
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl
    }
  };

  const res = UrlFetchApp.fetch(auth.apiBase + '/v2/checkout/orders', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + auth.token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300 || !data.id) {
    log_('createPayPalTrainOrder', code, 'ERROR', res.getContentText(), body);
    return json_({ ok:false, message:'PayPal no creó la orden: ' + res.getContentText() });
  }

  const approval = (data.links || []).filter(function(link) { return link.rel === 'approve'; })[0];
  setCellByHeader_(found.sheet, found.row, found.headers, 'paypalOrderId', data.id);
  setCellByHeader_(found.sheet, found.row, found.headers, 'paypalStatus', data.status || 'CREATED');
  log_('createPayPalTrainOrder', code, 'OK', data.status || 'CREATED', data);
  return json_({ ok:true, paypalOrderId:data.id, approvalUrl:approval ? approval.href : '', status:data.status || '' });
}

function capturePayPalTrainOrder_(payload) {
  validateConfig_();
  const code = cleanCode_(payload.code || '');
  const paypalOrderId = String(payload.paypalOrderId || payload.orderID || '').trim();
  if (!code || !paypalOrderId) return json_({ ok:false, message:'Faltan datos para capturar el pago.' });
  const found = findOrderByCode_(code);
  if (!found) return json_({ ok:false, message:'No encontramos la orden en Google Sheets.' });

  const savedPayPalId = String(found.data.paypalOrderId || '').trim();
  if (savedPayPalId && savedPayPalId !== paypalOrderId) return json_({ ok:false, message:'La orden PayPal no coincide con el código interno.' });

  const auth = paypalAccessToken_();
  const res = UrlFetchApp.fetch(auth.apiBase + '/v2/checkout/orders/' + encodeURIComponent(paypalOrderId) + '/capture', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + auth.token },
    payload: '{}',
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300) {
    log_('capturePayPalTrainOrder', code, 'ERROR', res.getContentText(), data);
    return json_({ ok:false, message:'PayPal no pudo capturar el pago: ' + res.getContentText() });
  }

  const status = String(data.status || '').toUpperCase();
  const capture = (((data.purchase_units || [])[0] || {}).payments || {}).captures || [];
  const captureId = capture[0] ? capture[0].id : '';
  if (status === 'COMPLETED') {
    setCellByHeader_(found.sheet, found.row, found.headers, 'estadoPago', 'Pagado');
    setCellByHeader_(found.sheet, found.row, found.headers, 'paypalOrderId', paypalOrderId);
    setCellByHeader_(found.sheet, found.row, found.headers, 'paypalCaptureId', captureId);
    setCellByHeader_(found.sheet, found.row, found.headers, 'paypalStatus', status);
    setCellByHeader_(found.sheet, found.row, found.headers, 'fechaPagoPaypal', new Date());
    appendObjectRow_(getSheet_(SHEET_PAYMENTS, PAYMENT_HEADERS), {
      fecha: new Date(), codigoReserva: code, proveedor: 'PayPal', monto: found.data.totalUsd || '', moneda: 'USD', paypalOrderId: paypalOrderId, paypalCaptureId: captureId, estado: status, payloadJson: JSON.stringify(data)
    });
    sendTrainPaidEmail_(found.data, paypalOrderId, captureId);
    log_('capturePayPalTrainOrder', code, 'OK', status, data);
    return json_({ ok:true, message:'Pago confirmado correctamente. Tu reserva de tren fue registrada con el código ' + code + '.', code:code, status:status, captureId:captureId });
  }

  setCellByHeader_(found.sheet, found.row, found.headers, 'paypalStatus', status);
  log_('capturePayPalTrainOrder', code, 'PENDING', status, data);
  return json_({ ok:false, message:'El pago no quedó completado. Estado PayPal: ' + status, status:status });
}

function paypalConfig_() {
  const props = PropertiesService.getScriptProperties();
  const mode = props.getProperty('PAYPAL_MODE') || 'sandbox';
  const clientId = props.getProperty('PAYPAL_CLIENT_ID') || '';
  const secret = props.getProperty('PAYPAL_CLIENT_SECRET') || '';
  const apiBase = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  if (!clientId || !secret) throw new Error('Faltan credenciales PayPal. Configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en Propiedades del script.');
  return { mode:mode, clientId:clientId, secret:secret, apiBase:apiBase };
}

function paypalAccessToken_() {
  const cfg = paypalConfig_();
  const basic = Utilities.base64Encode(cfg.clientId + ':' + cfg.secret);
  const res = UrlFetchApp.fetch(cfg.apiBase + '/v1/oauth2/token', {
    method: 'post',
    headers: { Authorization: 'Basic ' + basic, Accept: 'application/json' },
    payload: 'grant_type=client_credentials',
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText() || '{}');
  if (res.getResponseCode() >= 300 || !data.access_token) throw new Error('No se pudo obtener token PayPal: ' + res.getContentText());
  return { token:data.access_token, apiBase:cfg.apiBase };
}

function sendTrainOrderCreatedEmail_(order) {
  const lead = (order.passengers || [])[0] || {};
  const email = String(lead.email || '').trim();
  if (!email) return;
  const code = order.code || '';
  const htmlBody = buildOrderEmailHtml_(order, 'Orden creada', 'Tu orden fue creada correctamente. Continúa con el pago PayPal para confirmar la solicitud.');
  MailApp.sendEmail({ to:email, bcc:SUPPORT_EMAIL, subject:'Orden de tren creada - ' + code, htmlBody:htmlBody, name:BRAND_NAME, replyTo:SUPPORT_EMAIL });
}

function sendTrainPaidEmail_(rowData, paypalOrderId, captureId) {
  const email = String(rowData.titularCorreo || '').trim();
  if (!email) return;
  const code = rowData.codigoReserva || '';
  const order = parseJsonSafe_(rowData.ordenJson, {});
  const htmlBody = buildOrderEmailHtml_(order, 'Pago confirmado', 'Hemos confirmado tu pago. Revisaremos disponibilidad final y te contactaremos con los boletos o ajustes necesarios.') +
    '<p><strong>PayPal Order ID:</strong> ' + escapeHtml_(paypalOrderId) + '</p><p><strong>Capture ID:</strong> ' + escapeHtml_(captureId) + '</p>';
  MailApp.sendEmail({ to:email, bcc:SUPPORT_EMAIL, subject:'Pago confirmado - Reserva de tren ' + code, htmlBody:htmlBody, name:BRAND_NAME, replyTo:SUPPORT_EMAIL });
}

function buildOrderEmailHtml_(order, title, message) {
  const amounts = order.amounts || {};
  const trains = order.trains || {};
  const outbound = trains.outbound || {};
  const returned = trains.return || {};
  const extras = ((order.extras || {}).lines || []).map(function(x){ return '<li>' + escapeHtml_(x.label || '') + ' - USD ' + Number(x.amount || 0).toFixed(2) + '</li>'; }).join('');
  return '<div style="font-family:Arial,sans-serif;background:#edf3ef;color:#17221b;padding:24px">' +
    '<div style="max-width:680px;margin:auto;background:#fff;border-radius:22px;padding:24px;border:1px solid #dfe7df">' +
    '<h2 style="color:#062803;margin-top:0">' + escapeHtml_(title) + '</h2>' +
    '<p>' + escapeHtml_(message) + '</p>' +
    '<p><strong>Código:</strong> ' + escapeHtml_(order.code || '') + '</p>' +
    '<p><strong>Ida:</strong> ' + escapeHtml_(outbound.companyName || '') + ' · ' + escapeHtml_(outbound.serviceName || '') + ' · ' + escapeHtml_(outbound.departureTime || '') + ' → ' + escapeHtml_(outbound.arrivalTime || '') + '</p>' +
    (returned.code ? '<p><strong>Retorno:</strong> ' + escapeHtml_(returned.companyName || '') + ' · ' + escapeHtml_(returned.serviceName || '') + ' · ' + escapeHtml_(returned.departureTime || '') + ' → ' + escapeHtml_(returned.arrivalTime || '') + '</p>' : '') +
    (extras ? '<p><strong>Extras:</strong></p><ul>' + extras + '</ul>' : '') +
    '<p style="font-size:22px;color:#062803"><strong>Total: USD ' + Number(amounts.totalUsd || 0).toFixed(2) + '</strong></p>' +
    '<p style="font-size:13px;color:#667069">La compra queda sujeta a disponibilidad final de la empresa ferroviaria. Si el horario cambia, un asesor se comunicará contigo.</p>' +
    '</div></div>';
}

function validateConfig_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PEGAR_AQUI_ID_DE_GOOGLE_SHEET') {
    throw new Error('Configura SPREADSHEET_ID en Apps Script.');
  }
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#062803').setFontColor('#ffffff');
  }
  return sheet;
}

function appendObjectRow_(sheet, obj) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(function(header) { return obj[header] !== undefined ? obj[header] : ''; });
  sheet.appendRow(row);
}

function findOrderByCode_(code) {
  code = cleanCode_(code);
  const sheet = getSheet_(SHEET_ORDERS, ORDER_HEADERS);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0].map(String);
  const codeIndex = headers.indexOf('codigoReserva');
  if (codeIndex < 0) return null;
  for (let i = 1; i < values.length; i++) {
    if (cleanCode_(values[i][codeIndex]) === code) {
      const data = {};
      headers.forEach(function(h, idx) { data[h] = values[i][idx]; });
      return { sheet:sheet, row:i + 1, headers:headers, data:data };
    }
  }
  return null;
}

function setCellByHeader_(sheet, row, headers, header, value) {
  const index = headers.indexOf(header);
  if (index >= 0) sheet.getRange(row, index + 1).setValue(value);
}

function cleanCode_(value) {
  return String(value || '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
}

function formatTrainLeg_(train, type) {
  if (!train) return '';
  if (type === 'departure') return (train.departureStation || '') + ' ' + (train.departureTime || '');
  return (train.arrivalStation || '') + ' ' + (train.arrivalTime || '');
}

function parseJsonSafe_(value, fallback) {
  try {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    return JSON.parse(String(value));
  } catch (err) {
    return fallback;
  }
}

function log_(action, code, status, message, payload) {
  try {
    appendObjectRow_(getSheet_(SHEET_LOGS, LOG_HEADERS), {
      fecha: new Date(), accion: action || '', codigoReserva: code || '', estado: status || '', mensaje: String(message || ''), payloadJson: JSON.stringify(payload || {})
    });
  } catch (err) {
    // evita romper el flujo por error de log
  }
}

function escapeHtml_(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>'"]/g, function(char) {
    return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
