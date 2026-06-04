/*
Google Apps Script para acceso real del portal de agencias My Cusco Trip.

Pasos:
1. Crea una hoja de cálculo en Google Sheets.
2. Copia el ID de la hoja y reemplaza SPREADSHEET_ID.
3. En Google Sheets: Extensiones > Apps Script.
4. Pega este código completo y guarda.
5. Ejecuta una vez setupSheets() y autoriza permisos.
6. Implementar > Nueva implementación > Aplicación web.
   - Ejecutar como: tú.
   - Quién tiene acceso: cualquier usuario con el enlace.
7. Copia la URL del Web App y pégala en:
   - agencias/login.html -> APPS_SCRIPT_URL
   - agencias/registro.html -> APPS_SCRIPT_URL
   - agencias/assets/js/agencias-portal.js -> CONFIG.appsScriptUrl

Flujo:
- Una agencia se registra y queda con Estado = Pendiente.
- Tú revisas la fila en la hoja Agencias y cambias Estado a Aprobado.
- La agencia podrá ingresar con su correo y contraseña.
*/

const SPREADSHEET_ID = 'PEGAR_AQUI_ID_DE_GOOGLE_SHEET';
const SHEET_AGENCIES = 'Agencias';
const SHEET_ORDERS = 'Ordenes';

const AGENCY_HEADERS = [
  'Fecha','Estado','País','Tipo fiscal','Número fiscal','Razón social','Nombre comercial',
  'Representante','Documento','Celular','Correo','Web','Salt','PasswordHash','JSON'
];
const ORDER_HEADERS = [
  'Fecha','Código','Estado','Agencia','Correo','Moneda','TC','Subtotal','Comisión','Total','Servicios JSON','Orden JSON'
];

function setupSheets() {
  getSheet_(SHEET_AGENCIES, AGENCY_HEADERS);
  getSheet_(SHEET_ORDERS, ORDER_HEADERS);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'registerAgency') return json_(registerAgency_(payload));
    if (payload.action === 'loginAgency') return json_(loginAgency_(payload));
    if (payload.action === 'createReservationOrder') return json_(createReservationOrder_(payload));
    return json_({ ok:false, error:'Acción no reconocida.' });
  } catch (err) {
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function registerAgency_(p) {
  const email = String(p.email || '').toLowerCase().trim();
  const password = String(p.password || '');
  if (!email) return { ok:false, error:'Correo requerido.' };
  if (password.length < 8) return { ok:false, error:'La contraseña debe tener al menos 8 caracteres.' };

  const sh = getSheet_(SHEET_AGENCIES, AGENCY_HEADERS);
  const values = sh.getDataRange().getValues();
  const map = headerMap_(values[0]);
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][map['Correo']] || '').toLowerCase().trim() === email) {
      return { ok:false, error:'Este correo ya está registrado.' };
    }
  }

  const salt = Utilities.getUuid();
  const passHash = sha256_(password + salt);
  const representative = `${p.repNames || ''} ${p.repLastnames || ''}`.trim();
  const documentText = `${p.docType || ''} ${p.docNumber || ''}`.trim();
  const row = [
    new Date(), 'Pendiente', p.country || '', p.taxLabel || '', p.taxNumber || '', p.legalName || '', p.commercialName || '',
    representative, documentText, p.phone || '', email, p.website || '', salt, passHash, JSON.stringify(Object.assign({}, p, { password: undefined }))
  ];
  sh.appendRow(row);
  return { ok:true, message:'Registro recibido. Pendiente de aprobación.' };
}

function loginAgency_(p) {
  const email = String(p.email || '').toLowerCase().trim();
  const password = String(p.password || '');
  const sh = getSheet_(SHEET_AGENCIES, AGENCY_HEADERS);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok:false, error:'No hay agencias registradas.' };
  const map = headerMap_(values[0]);

  for (let i = 1; i < values.length; i++) {
    const rowEmail = String(values[i][map['Correo']] || '').toLowerCase().trim();
    if (rowEmail !== email) continue;

    const status = String(values[i][map['Estado']] || '').toLowerCase().trim();
    if (!status.includes('aprob')) return { ok:false, error:'La agencia existe, pero todavía no está aprobada.' };

    const salt = String(values[i][map['Salt']] || '');
    const passHash = String(values[i][map['PasswordHash']] || '');
    if (!salt || !passHash) return { ok:false, error:'La agencia no tiene contraseña configurada. Registra nuevamente el acceso o actualiza la fila.' };
    if (sha256_(password + salt) !== passHash) return { ok:false, error:'Correo o contraseña incorrectos.' };

    return {
      ok:true,
      agencyName: values[i][map['Nombre comercial']] || values[i][map['Razón social']] || email,
      commercialName: values[i][map['Nombre comercial']] || '',
      legalName: values[i][map['Razón social']] || '',
      email: values[i][map['Correo']] || email,
      country: values[i][map['País']] || ''
    };
  }
  return { ok:false, error:'Correo o contraseña incorrectos.' };
}

function createReservationOrder_(p) {
  const sh = getSheet_(SHEET_ORDERS, ORDER_HEADERS);
  const agency = p.agency || {};
  sh.appendRow([
    new Date(), p.code || '', p.status || 'Pendiente de pago',
    agency.agencyName || agency.commercialName || '', agency.email || '',
    p.currency || '', p.exchangeRate || '', p.subtotal || 0, p.fees || 0, p.total || 0,
    JSON.stringify(p.items || []), JSON.stringify(p)
  ]);
  return { ok:true, code:p.code };
}

function getSheet_(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    return sh;
  }
  const first = sh.getRange(1,1,1,Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
  if (!first[0]) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}

function headerMap_(headers) {
  const map = {};
  headers.forEach((h, i) => { map[String(h).trim()] = i; });
  return map;
}

function sha256_(value) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return raw.map(function(b) { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
