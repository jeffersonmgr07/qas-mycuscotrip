/**
 * My Cusco Trip - Hoteles Marketplace MVP (Google Apps Script) V61
 *
 * Funciones principales:
 * - Registro de administradores hoteleros con correo de verificación.
 * - Login validado contra Google Sheet.
 * - Panel hotelero con datos reales del usuario logueado.
 * - Alojamientos, habitaciones, disponibilidad, órdenes, pagos y fotos.
 *
 * Importante:
 * - Despliega como Web App con acceso "Cualquier usuario".
 * - Ejecuta setupHotelMarketplaceSheets() una vez después de pegar este script.
 * - El Secret ID de PayPal nunca debe ir en el HTML.
 */

// URL pública donde está alojada la página verify-owner.html.
// El correo de verificación SIEMPRE debe abrir esta página, no el Apps Script.
const HOTEL_PUBLIC_HOTELES_URL = 'https://www.mycuscotrip.com/hoteles';
const HOTEL_VERIFY_OWNER_URL = HOTEL_PUBLIC_HOTELES_URL.replace(/\/$/, '') + '/verify-owner.html';

const HOTEL_SHEETS = {
  USERS: 'Hotel_Users',
  PROPERTIES: 'Properties',
  ROOMS: 'Rooms',
  AVAILABILITY: 'Availability',
  ORDERS: 'Hotel_Orders',
  PAYMENTS: 'Payments',
  PHOTOS: 'Photo_Assets'
};

const HOTEL_HEADERS = {
  Hotel_Users: ['userId','registrationType','email','passwordHash','firstName','lastName','docType','docNumber','nationality','phoneCode','phone','businessName','taxId','website','role','status','propertyLimit','verificationToken','verifiedAt','verificationEmailSentAt','verificationEmailError','sessionToken','lastLoginAt','createdAt','updatedAt'],
  Properties: ['propertyId','ownerUserId','ownerEmail','type','name','destination','address','mapUrl','stars','status','confirmationMode','commissionRate','description','website','galleryJson','photoCount','photoNamesJson','createdAt','updatedAt'],
  Rooms: ['roomId','propertyId','ownerUserId','roomName','roomType','capacity','capacityAdults','capacityChildren','basePriceUsd','stock','currency','status','description','amenitiesJson','roomGalleryJson','roomPhotoCount','roomPhotoNamesJson','createdAt','updatedAt'],
  Availability: ['availabilityId','propertyId','roomId','date','status','availableUnits','priceUsd','source','orderId','notes','updatedAt'],
  Hotel_Orders: ['orderId','source','createdAt','propertyId','roomId','assignedRoomId','checkin','checkout','nights','adults','children','guestName','guestEmail','guestPhone','amount','currency','confirmationMode','reservationStatus','paymentStatus','paypalOrderId','paypalAuthorizationId','rawJson'],
  Payments: ['paymentId','orderId','provider','intent','providerOrderId','authorizationId','captureId','status','amount','currency','createdAt','rawJson'],
  Photo_Assets: ['photoId','ownerUserId','propertyId','roomId','fileName','driveFileId','publicUrl','createdAt']
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || '').trim();
  let payload = {};
  if (params.payload) {
    try {
      // Apps Script ya entrega e.parameter.payload decodificado.
      // No usamos decodeURIComponent primero porque una contraseña con % u otro carácter especial puede romper la lectura.
      payload = JSON.parse(params.payload);
    } catch (err1) {
      try { payload = JSON.parse(decodeURIComponent(params.payload)); }
      catch (err2) { payload = { action: params.action || '', parseError: String(err2) }; }
    }
  }
  const action = String(payload.action || params.action || 'catalog');

  if (action === 'verify_owner') {
    const data = verifyHotelOwnerData_(params.token || payload.token || '');
    if (callback) return jsonpResponse_(callback, data);
    return jsonResponse(data);
  }

  if (action === 'verify_owner_redirect') {
    const data = verifyHotelOwnerData_(params.token || payload.token || '');
    if (callback) return jsonpResponse_(callback, data);
    return jsonResponse(data);
  }

  const result = dispatchHotelAction_(action, payload && Object.keys(payload).length ? payload : params);
  if (callback) return jsonpResponse_(callback, result);
  return jsonResponse(result);
}

function doPost(e) {
  let payload = {};
  try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return jsonResponse({ ok: false, error: 'JSON inválido: ' + err.message }); }
  return jsonResponse(dispatchHotelAction_(payload.action || '', payload));
}

function dispatchHotelAction_(action, payload) {
  try {
    if (action === 'register_owner') return registerHotelOwner_(payload);
    if (action === 'login_owner') return loginHotelOwner_(payload);
    if (action === 'get_owner') return getHotelOwner_(payload);
    if (action === 'get_properties') return getProperties_(payload);
    if (action === 'update_owner') return updateHotelOwner_(payload);
    if (action === 'change_password') return changeHotelOwnerPassword_(payload);
    if (action === 'create_property') return createProperty_(payload);
    if (action === 'update_property') return updateProperty_(payload);
    if (action === 'create_room') return createRoom_(payload);
    if (action === 'update_confirmation_mode') return updateConfirmationMode_(payload);
    if (action === 'create_order') return createHotelOrder_(payload);
    if (action === 'block_dates') return blockDates_(payload);
    if (action === 'catalog') return getHotelCatalog_();
    if (action === 'availability') return getAvailability_(payload);
    if (action === 'resend_verification') return resendVerification_(payload);
    if (action === 'debug_owner') return debugHotelOwner_(payload);
    return { ok: false, error: 'Acción no válida: ' + action };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function jsonpResponse_(callback, data) {
  const safeCallback = String(callback || '').replace(/[^a-zA-Z0-9_.$]/g, '');
  const body = safeCallback + '(' + JSON.stringify(data || {}) + ');';
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function uuid_(prefix) { return prefix + '-' + Utilities.getUuid().slice(0, 8).toUpperCase(); }
function now_() { return new Date(); }
function scriptUrl_() { return ScriptApp.getService().getUrl(); }
function hash_(value) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || '')));
}
function headerMap_(headers) {
  const map = {};
  headers.forEach(function(h, i) { map[String(h)] = i; });
  return map;
}
function sheet_(name, headers) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers || HOTEL_HEADERS[name] || []);
    return sh;
  }
  ensureHeaders_(sh, headers || HOTEL_HEADERS[name] || []);
  return sh;
}
function ensureHeaders_(sh, expected) {
  if (!expected || !expected.length) return;
  const lastCol = Math.max(sh.getLastColumn(), 1);
  let current = sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
  if (!current.length) {
    sh.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }
  const missing = expected.filter(function(h) { return current.indexOf(h) === -1; });
  if (missing.length) {
    sh.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}
function getRows_(sheetName) {
  const sh = sheet_(sheetName, HOTEL_HEADERS[sheetName]);
  const values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  return { sh: sh, headers: headers, map: headerMap_(headers), rows: values };
}
function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}
function findRowBy_(sheetName, colName, value) {
  const data = getRows_(sheetName);
  const col = data.map[colName];
  if (col === undefined) return null;
  for (var i = 0; i < data.rows.length; i++) {
    if (String(data.rows[i][col]).toLowerCase() === String(value).toLowerCase()) {
      return { sh: data.sh, headers: data.headers, map: data.map, row: data.rows[i], rowIndex: i + 2, object: rowToObject_(data.headers, data.rows[i]) };
    }
  }
  return null;
}
function setCellByHeader_(found, header, value) {
  const col = found.map[header];
  if (col !== undefined) found.sh.getRange(found.rowIndex, col + 1).setValue(value);
}

function appendObjectToSheet_(sheetName, rowObj) {
  // IMPORTANTE:
  // No usamos HOTEL_HEADERS[sheetName].map(...) directamente para appendRow,
  // porque una hoja creada en versiones anteriores puede tener columnas agregadas al final
  // o en un orden diferente. Si insertamos por orden fijo, el token puede caer en otra columna
  // y luego la verificación responde "Enlace no válido".
  const sh = sheet_(sheetName, HOTEL_HEADERS[sheetName]);
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h || '').trim(); });
  const row = headers.map(function(h){ return rowObj[h] !== undefined ? rowObj[h] : ''; });
  sh.appendRow(row);
  return sh;
}
function publicOwner_(obj) {
  if (!obj) return null;
  return {
    userId: obj.userId || '', registrationType: obj.registrationType || 'natural', email: obj.email || '',
    firstName: obj.firstName || '', lastName: obj.lastName || '', docType: obj.docType || '', docNumber: obj.docNumber || '',
    nationality: obj.nationality || '', phoneCode: obj.phoneCode || '', phone: obj.phone || '',
    businessName: obj.businessName || '', taxId: obj.taxId || '', website: obj.website || '',
    role: obj.role || 'hotel_provider', status: obj.status || ''
  };
}
function allowedStatus_(status) {
  const value = String(status || '').toLowerCase();
  return ['approved','aprobado','active','activo','verified','verificado','provider','proveedor','hotel_provider'].indexOf(value) >= 0;
}

function setupHotelMarketplaceSheets() {
  Object.keys(HOTEL_HEADERS).forEach(function(name) { sheet_(name, HOTEL_HEADERS[name]); });
  return { ok: true, message: 'Hojas del marketplace hotelero preparadas/actualizadas.' };
}

function getHotelCatalog_() {
  return { ok: true, message: 'Catálogo marketplace preparado. En el MVP el frontend puede seguir usando hotels.json mientras Properties/Rooms se conectan gradualmente.' };
}
function getAvailability_(params) {
  return { ok: true, available: true, params: params };
}

function registerHotelOwner_(payload) {
  setupHotelMarketplaceSheets();
  const email = String(payload.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Correo requerido.' };
  if (findRowBy_(HOTEL_SHEETS.USERS, 'email', email)) return { ok: false, error: 'Ya existe un registro con este correo.' };
  const docNumber = String(payload.docNumber || '').trim();
  const taxId = String(payload.taxId || '').trim();
  if (docNumber && findRowBy_(HOTEL_SHEETS.USERS, 'docNumber', docNumber)) return { ok: false, error: 'Ya existe un registro con este número de documento.' };
  if (taxId && findRowBy_(HOTEL_SHEETS.USERS, 'taxId', taxId)) return { ok: false, error: 'Ya existe un registro con este RUC.' };
  const token = Utilities.getUuid();
  const userId = uuid_('HUSR');
  const rowObj = {
    userId: userId,
    registrationType: payload.registrationType || 'natural',
    email: email,
    passwordHash: hash_(payload.password || ''),
    firstName: payload.firstName || '',
    lastName: payload.lastName || '',
    docType: payload.docType || '',
    docNumber: payload.docNumber || '',
    nationality: payload.nationality || '',
    phoneCode: payload.phoneCode || '',
    phone: payload.phone || '',
    businessName: payload.businessName || '',
    taxId: payload.taxId || '',
    website: payload.website || '',
    role: 'hotel_provider',
    status: 'pending_email_verification',
    propertyLimit: 3,
    verificationToken: token,
    verifiedAt: '',
    verificationEmailSentAt: '',
    verificationEmailError: '',
    sessionToken: '',
    lastLoginAt: '',
    createdAt: now_(),
    updatedAt: now_(),
    publicBaseUrl: payload.publicBaseUrl || HOTEL_PUBLIC_HOTELES_URL
  };
  appendObjectToSheet_(HOTEL_SHEETS.USERS, rowObj);
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  try {
    sendVerificationEmail_(rowObj, token);
    if (found) {
      setCellByHeader_(found, 'verificationEmailSentAt', now_());
      setCellByHeader_(found, 'verificationEmailError', '');
    }
    return { ok: true, userId: userId, status: 'pending_email_verification', message: 'verification_email_sent' };
  } catch (err) {
    if (found) setCellByHeader_(found, 'verificationEmailError', err && err.message ? err.message : String(err));
    return { ok: true, userId: userId, status: 'pending_email_verification', emailWarning: true, error: 'Registro guardado, pero no se pudo enviar el correo: ' + (err && err.message ? err.message : String(err)) };
  }
}

function sendVerificationEmail_(owner, token) {
  // IMPORTANTE: el enlace debe ir a la web pública de MyCuscoTrip.
  // No usamos ScriptApp.getService().getUrl() porque eso abre el Apps Script directamente.
  const verifyUrl = HOTEL_VERIFY_OWNER_URL + '?token=' + encodeURIComponent(token) + '&v=60';
  const fullName = String((owner.firstName || '') + ' ' + (owner.lastName || '')).trim() || 'Administrador de alojamientos';
  const html = `
    <div style="margin:0;padding:0;background:#f4f8f4;font-family:Arial,sans-serif;color:#17301b;">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
        <div style="background:#062803;border-radius:22px 22px 0 0;padding:22px;color:white;">
          <h1 style="margin:0;font-size:22px;">Verifica tu cuenta para administración de alojamientos</h1>
          <p style="margin:8px 0 0;color:#dceadc;">My Cusco Trip · Marketplace de alojamientos</p>
        </div>
        <div style="background:white;border-radius:0 0 22px 22px;padding:24px;border:1px solid #dfe8df;">
          <p>Hola <strong>${escapeHtml_(fullName)}</strong>,</p>
          <p>Recibimos tu registro como administrador de alojamientos. Para activar tu cuenta, confirma tu correo haciendo clic en el botón:</p>
          <p style="text-align:center;margin:28px 0;"><a href="${verifyUrl}" target="_blank" rel="noopener" style="background:#062803;color:white;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold;display:inline-block;">Verificar mi cuenta</a></p>
          <p style="font-size:13px;color:#5f6b62;">Si el botón no abre, copia y pega este enlace en tu navegador:<br>${verifyUrl}</p>
        </div>
      </div>
    </div>`;
  MailApp.sendEmail({ to: owner.email, subject: 'Verifica tu cuenta para administración de alojamientos | My Cusco Trip', htmlBody: html, name: 'My Cusco Trip' });
}
function escapeHtml_(text) {
  return String(text || '').replace(/[&<>"]/g, function(c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]); });
}

function resendVerification_(payload) {
  const email = String(payload.email || payload.ownerEmail || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Correo requerido.' };
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  if (!found) return { ok: false, error: 'Usuario no encontrado.' };
  const owner = found.object;
  let token = owner.verificationToken || Utilities.getUuid();
  if (!owner.verificationToken) setCellByHeader_(found, 'verificationToken', token);
  try {
    sendVerificationEmail_(owner, token);
    setCellByHeader_(found, 'verificationEmailSentAt', now_());
    setCellByHeader_(found, 'verificationEmailError', '');
    return { ok: true, message: 'verification_email_sent' };
  } catch (err) {
    setCellByHeader_(found, 'verificationEmailError', err && err.message ? err.message : String(err));
    return { ok: false, error: 'No se pudo enviar el correo: ' + (err && err.message ? err.message : String(err)) };
  }
}

function testHotelVerificationEmail() {
  // Ejecuta esta función una vez desde Apps Script para autorizar MailApp.
  const email = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: email,
    subject: 'Prueba de correo My Cusco Trip Hoteles',
    htmlBody: '<p>MailApp está autorizado correctamente para el marketplace hotelero.</p><p>La verificación abrirá: ' + HOTEL_VERIFY_OWNER_URL + '</p>',
    name: 'My Cusco Trip'
  });
  return { ok: true, sentTo: email };
}

function verifyHotelOwnerData_(token) {
  if (!token) return { ok: false, error: 'Token inválido.' };
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'verificationToken', token);
  if (!found) return { ok: false, error: 'Enlace no válido o ya usado. Solicita un nuevo correo de verificación o regístrate nuevamente.' };
  setCellByHeader_(found, 'status', 'approved');
  setCellByHeader_(found, 'role', 'hotel_provider');
  setCellByHeader_(found, 'verifiedAt', now_());
  setCellByHeader_(found, 'updatedAt', now_());
  return { ok: true, message: 'Cuenta verificada correctamente.' };
}


function verifyHotelOwnerRedirect_(data) {
  const ok = data && data.ok;
  const message = ok
    ? 'Tu correo fue verificado correctamente. Ya puedes ingresar al panel.'
    : (data && data.error ? data.error : 'El enlace no es válido o ya fue utilizado.');
  const status = ok ? 'success' : 'error';
  const target = HOTEL_VERIFY_OWNER_URL + '?status=' + encodeURIComponent(status) + '&message=' + encodeURIComponent(message);
  return HtmlService.createHtmlOutput(`
    <!doctype html><html><head><base target="_top"><meta charset="utf-8">
    <meta http-equiv="refresh" content="0;url=${escapeHtml_(target)}">
    <style>body{font-family:Arial,sans-serif;background:#f4f8f4;display:grid;place-items:center;min-height:100vh;margin:0;color:#17301b}.box{background:white;border:1px solid #dfe8df;border-radius:20px;padding:28px;text-align:center;max-width:520px}a{color:#062803;font-weight:bold}</style>
    </head><body>
      <div class="box">
        <h1>Redirigiendo...</h1>
        <p>Estamos regresando a My Cusco Trip.</p>
        <p><a href="${escapeHtml_(target)}">Continuar</a></p>
      </div>
      <script>window.top.location.replace(${JSON.stringify(target)});</script>
    </body></html>
  `).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function verifyHotelOwnerHtml_(data) {
  const ok = data && data.ok;
  const title = ok ? 'Cuenta verificada' : 'No se pudo verificar';
  const message = ok ? 'Tu correo fue verificado correctamente. Ya puedes ingresar al panel de administración de hoteles.' : (data && data.error ? data.error : 'El enlace no es válido o ya fue utilizado.');
  const payload = JSON.stringify({ mctHotelVerify: true, ok: !!ok, message: message });
  return HtmlService.createHtmlOutput(`
    <!doctype html><html><head><base target="_top"><meta charset="utf-8"></head>
    <body style="margin:0;">
      <div style="min-height:100vh;display:grid;place-items:center;background:#f4f8f4;font-family:Arial,sans-serif;">
        <div style="max-width:560px;background:white;border:1px solid #dfe8df;border-radius:24px;padding:32px;text-align:center;color:#17301b;">
          <h1 style="color:#062803;margin-top:0;">${escapeHtml_(title)}</h1>
          <p>${escapeHtml_(message)}</p>
          <p style="color:#67746b;font-size:14px;">Puedes volver a My Cusco Trip e iniciar sesión con tu correo y contraseña.</p>
        </div>
      </div>
      <script>
        (function(){
          var data = ${payload};
          try { parent.postMessage(data, '*'); } catch(e) {}
          try { window.top.postMessage(data, '*'); } catch(e) {}
        })();
      <\/script>
    </body></html>`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function debugHotelOwner_(payload) {
  const email = String(payload.email || payload.ownerEmail || '').trim().toLowerCase();
  const token = String(payload.token || '').trim();
  let byEmail = email ? findRowBy_(HOTEL_SHEETS.USERS, 'email', email) : null;
  let byToken = token ? findRowBy_(HOTEL_SHEETS.USERS, 'verificationToken', token) : null;
  return {
    ok: true,
    emailFound: !!byEmail,
    tokenFound: !!byToken,
    emailStatus: byEmail ? byEmail.object.status : '',
    emailTokenPresent: byEmail ? !!byEmail.object.verificationToken : false,
    tokenEmail: byToken ? byToken.object.email : '',
    note: 'Diagnóstico: si tokenFound=false pero emailFound=true, el enlace no coincide con la columna verificationToken de esa fila. Reenvía verificación o registra nuevamente con V60.'
  };
}

function loginHotelOwner_(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  if (!found) return { ok: false, error: 'No encontramos una cuenta con ese correo.' };
  const owner = found.object;
  if (String(owner.passwordHash || '') !== hash_(payload.password || '')) return { ok: false, error: 'Contraseña incorrecta.' };
  if (!allowedStatus_(owner.status)) {
    return { ok: false, error: 'Tu cuenta aún no está activa. Verifica tu correo o revisa el estado de aprobación.' };
  }
  const sessionToken = Utilities.getUuid();
  setCellByHeader_(found, 'sessionToken', sessionToken);
  setCellByHeader_(found, 'lastLoginAt', now_());
  setCellByHeader_(found, 'updatedAt', now_());
  const fresh = findRowBy_(HOTEL_SHEETS.USERS, 'email', email).object;
  return { ok: true, owner: publicOwner_(fresh), sessionToken: sessionToken };
}

function getHotelOwner_(payload) {
  const email = String(payload.email || '').trim().toLowerCase();
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  if (!found) return { ok: false, error: 'Usuario no encontrado.' };
  return { ok: true, owner: publicOwner_(found.object), sessionToken: found.object.sessionToken || '' };
}

function getProperties_(payload) {
  const ownerUserId = String(payload.ownerUserId || '').trim();
  const ownerEmail = String(payload.email || payload.ownerEmail || '').trim().toLowerCase();
  const data = getRows_(HOTEL_SHEETS.PROPERTIES);
  const properties = data.rows.map(function(row) { return rowToObject_(data.headers, row); }).filter(function(item) {
    return (ownerUserId && String(item.ownerUserId) === ownerUserId) || (ownerEmail && String(item.ownerEmail).toLowerCase() === ownerEmail);
  });
  return { ok: true, properties: properties };
}

function updateHotelOwner_(payload) {
  const email = String(payload.ownerEmail || payload.email || '').trim().toLowerCase();
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  if (!found) return { ok: false, error: 'Usuario no encontrado.' };
  ['firstName','lastName','docType','docNumber','nationality','phoneCode','phone','businessName','taxId','website'].forEach(function(key) {
    if (payload[key] !== undefined) setCellByHeader_(found, key, payload[key]);
  });
  setCellByHeader_(found, 'updatedAt', now_());
  return { ok: true, owner: publicOwner_(findRowBy_(HOTEL_SHEETS.USERS, 'email', email).object) };
}

function changeHotelOwnerPassword_(payload) {
  const email = String(payload.ownerEmail || payload.email || '').trim().toLowerCase();
  const found = findRowBy_(HOTEL_SHEETS.USERS, 'email', email);
  if (!found) return { ok: false, error: 'Usuario no encontrado.' };
  if (String(found.object.passwordHash || '') !== hash_(payload.currentPassword || '')) return { ok: false, error: 'La contraseña actual no es correcta.' };
  if (!payload.newPassword) return { ok: false, error: 'Nueva contraseña requerida.' };
  setCellByHeader_(found, 'passwordHash', hash_(payload.newPassword));
  setCellByHeader_(found, 'updatedAt', now_());
  return { ok: true, message: 'Contraseña actualizada.' };
}

function createProperty_(payload) {
  const propertyId = uuid_('HPR');
  const rowObj = {
    propertyId: propertyId,
    ownerUserId: payload.ownerUserId || '',
    ownerEmail: payload.ownerEmail || '',
    type: payload.type || 'hotel',
    name: payload.name || '',
    destination: payload.destination || '',
    address: payload.address || '',
    mapUrl: payload.mapUrl || '',
    stars: payload.stars || '',
    status: 'draft',
    confirmationMode: payload.confirmationMode || 'instant',
    commissionRate: payload.commissionRate || '15',
    description: payload.description || '',
    website: payload.website || '',
    galleryJson: payload.galleryJson || '[]',
    photoCount: payload.photoCount || '',
    photoNamesJson: payload.photoNamesJson || '[]',
    createdAt: now_(),
    updatedAt: now_()
  };
  appendObjectToSheet_(HOTEL_SHEETS.PROPERTIES, rowObj);
  return { ok: true, propertyId: propertyId, status: 'draft' };
}

function updateProperty_(payload) {
  const propertyId = String(payload.propertyId || '').trim();
  if (!propertyId) return { ok: false, error: 'Alojamiento no encontrado.' };
  const found = findRowBy_(HOTEL_SHEETS.PROPERTIES, 'propertyId', propertyId);
  if (!found) return { ok: false, error: 'Alojamiento no encontrado.' };
  ['type','name','destination','address','mapUrl','stars','confirmationMode','commissionRate','description','website','galleryJson','photoCount','photoNamesJson'].forEach(function(key) {
    if (payload[key] !== undefined && payload[key] !== '') setCellByHeader_(found, key, payload[key]);
  });
  setCellByHeader_(found, 'updatedAt', now_());
  return { ok: true, propertyId: propertyId, status: found.object.status || 'draft' };
}

function createRoom_(payload) {
  const roomId = uuid_('HRM');
  const adults = Number(payload.capacityAdults || 0);
  const children = Number(payload.capacityChildren || 0);
  const rowObj = {
    roomId: roomId,
    propertyId: payload.propertyId || '',
    ownerUserId: payload.ownerUserId || '',
    roomName: payload.roomName || '',
    roomType: payload.roomType || '',
    capacity: payload.capacity || (adults + children) || 1,
    capacityAdults: payload.capacityAdults || adults || 1,
    capacityChildren: payload.capacityChildren || children || 0,
    basePriceUsd: payload.basePriceUsd || 0,
    stock: payload.stock || 1,
    currency: payload.currency || 'USD',
    status: 'active',
    description: payload.description || '',
    amenitiesJson: payload.amenitiesJson || '[]',
    roomGalleryJson: payload.roomGalleryJson || '[]',
    roomPhotoCount: payload.roomPhotoCount || '',
    roomPhotoNamesJson: payload.roomPhotoNamesJson || '[]',
    createdAt: now_(),
    updatedAt: now_()
  };
  appendObjectToSheet_(HOTEL_SHEETS.ROOMS, rowObj);
  return { ok: true, roomId: roomId };
}

function blockDates_(payload) {
  const sh = sheet_(HOTEL_SHEETS.AVAILABILITY, HOTEL_HEADERS.Availability);
  const dates = payload.dates || [];
  dates.forEach(function(date) {
    const rowObj = { availabilityId: uuid_('AVL'), propertyId: payload.propertyId || '', roomId: payload.roomId || '', date: date, status: payload.status || 'special_block', availableUnits: payload.availableUnits || 0, priceUsd: payload.priceUsd || '', source: payload.source || 'owner', orderId: payload.orderId || '', notes: payload.notes || '', updatedAt: now_() };
    sh.appendRow(HOTEL_HEADERS.Availability.map(function(h) { return rowObj[h] !== undefined ? rowObj[h] : ''; }));
  });
  return { ok: true, blocked: dates.length };
}

function createHotelOrder_(payload) {
  const sh = sheet_(HOTEL_SHEETS.ORDERS, HOTEL_HEADERS.Hotel_Orders);
  const orderId = uuid_('HOT');
  const rowObj = { orderId: orderId, source: payload.source || 'hoteles', createdAt: now_(), propertyId: payload.propertyId || '', roomId: payload.roomId || '', assignedRoomId: payload.assignedRoomId || '', checkin: payload.checkin || '', checkout: payload.checkout || '', nights: payload.nights || '', adults: payload.adults || '', children: payload.children || '', guestName: payload.guestName || '', guestEmail: payload.guestEmail || '', guestPhone: payload.guestPhone || '', amount: payload.amount || '', currency: payload.currency || 'USD', confirmationMode: payload.confirmationMode || 'instant', reservationStatus: payload.reservationStatus || 'pending', paymentStatus: payload.paymentStatus || 'PENDING', paypalOrderId: payload.paypalOrderId || '', paypalAuthorizationId: payload.paypalAuthorizationId || '', rawJson: JSON.stringify(payload) };
  sh.appendRow(HOTEL_HEADERS.Hotel_Orders.map(function(h) { return rowObj[h] !== undefined ? rowObj[h] : ''; }));
  if (payload.autoBlockDates && payload.checkin && payload.checkout) {
    blockDates_({ propertyId: payload.propertyId, roomId: payload.assignedRoomId || payload.roomId || '', dates: makeDateRange_(payload.checkin, payload.checkout), status: 'confirmed_reservation', source: payload.source || 'hoteles', orderId: orderId });
  }
  return { ok: true, orderId: orderId };
}

function updateConfirmationMode_(payload) {
  const found = findRowBy_(HOTEL_SHEETS.PROPERTIES, 'propertyId', payload.propertyId);
  if (!found) return { ok: false, error: 'Alojamiento no encontrado' };
  setCellByHeader_(found, 'confirmationMode', payload.confirmationMode || 'manual');
  setCellByHeader_(found, 'updatedAt', now_());
  return { ok: true, propertyId: payload.propertyId, confirmationMode: payload.confirmationMode || 'manual' };
}

function makeDateRange_(from, to) {
  const dates = [];
  if (!from || !to) return dates;
  const cursor = new Date(from + 'T12:00:00');
  const end = new Date(to + 'T12:00:00');
  while (cursor < end) {
    dates.push(Utilities.formatDate(cursor, Session.getScriptTimeZone(), 'yyyy-MM-dd'));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
