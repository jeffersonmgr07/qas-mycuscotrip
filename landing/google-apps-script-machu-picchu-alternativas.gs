/**
 * Google Apps Script para la landing /landing/machu-picchu-alternativas.html
 * 1) Crea una hoja de cálculo en Google Sheets.
 * 2) Abre Extensiones > Apps Script y pega este código.
 * 3) Cambia SHEET_NAME si deseas.
 * 4) Implementa como Aplicación web: Ejecutar como "Yo" y acceso "Cualquier usuario".
 * 5) Copia la URL /exec y pégala en GOOGLE_APPS_SCRIPT_URL dentro del HTML.
 */

const SHEET_NAME = 'Leads Machu Picchu Alternativas';
const ADMIN_EMAIL = 'reservas@mycuscotrip.com';
const BRAND_NAME = 'My Cusco Trip';
const LOGO_URL = 'https://mycuscotrip.com/assets/img/logos/logo-my-cusco-trip.png';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const sheet = getOrCreateSheet_();
    sheet.appendRow([
      new Date(),
      data.fullName || '',
      data.email || '',
      data.whatsapp || '',
      data.countryCode || '',
      data.whatsappNumber || '',
      data.contactMethod || '',
      data.travelStart || '',
      data.travelEnd || '',
      data.adults || '',
      data.children || '',
      data.travelers || '',
      data.preferredPackage || '',
      data.flightStatus || '',
      data.message || '',
      data.page || '',
      JSON.stringify(data.utm || {})
    ]);

    sendAdminEmail_(data);
    if (data.email) sendClientEmail_(data);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Fecha registro', 'Nombre', 'Correo', 'WhatsApp', 'Código país', 'Número',
      'Método contacto', 'Llegada Cusco', 'Fecha límite/retorno', 'Adultos', 'Niños',
      'Total turistas', 'Paquete interés', 'Estado vuelos', 'Mensaje adicional', 'Página', 'UTM'
    ]);
  }
  return sheet;
}

function sendAdminEmail_(data) {
  const subject = `Nuevo registro Machu Picchu - ${data.fullName || 'Lead'}`;
  const htmlBody = leadEmailTemplate_(data, true);
  MailApp.sendEmail({
    to: ADMIN_EMAIL,
    subject,
    htmlBody,
    name: BRAND_NAME
  });
}

function sendClientEmail_(data) {
  const subject = 'Hemos recibido tu solicitud para Machu Picchu';
  const htmlBody = leadEmailTemplate_(data, false);
  MailApp.sendEmail({
    to: data.email,
    subject,
    htmlBody,
    name: BRAND_NAME
  });
}

function leadEmailTemplate_(data, isAdmin) {
  const title = isAdmin ? 'Nuevo formulario de registro' : 'Solicitud registrada correctamente';
  const intro = isAdmin
    ? 'Se registró una nueva solicitud desde la landing de alternativas para Machu Picchu.'
    : 'Gracias por registrarte. En breve nuestro equipo de reservas revisará tu caso y te contactará con la mejor alternativa disponible para tu fecha de viaje.';

  const rows = [
    ['Nombre', data.fullName],
    ['Correo', data.email],
    ['WhatsApp', data.whatsapp],
    ['Contacto preferido', data.contactMethod],
    ['Llegada a Cusco', data.travelStart],
    ['Fecha límite / retorno', data.travelEnd],
    ['Adultos', data.adults],
    ['Niños', data.children],
    ['Paquete de interés', data.preferredPackage],
    ['Estado de vuelos', data.flightStatus],
    ['Mensaje adicional', data.message || 'Sin mensaje adicional']
  ];

  const detailRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8eee9;color:#66756e;font-weight:700;width:38%;">${escapeHtml_(label)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8eee9;color:#17322a;">${escapeHtml_(value || '')}</td>
    </tr>`).join('');

  return `
  <div style="margin:0;padding:0;background:#f7faf8;font-family:Arial,Helvetica,sans-serif;color:#17322a;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e8eee9;box-shadow:0 18px 45px rgba(10,58,38,.10);">
        <div style="background:#0a3a26;padding:24px;text-align:center;">
          <img src="${LOGO_URL}" alt="My Cusco Trip" style="max-width:170px;height:auto;margin-bottom:12px;" />
          <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.25;">${title}</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 18px;color:#17322a;font-size:15px;line-height:1.7;">${intro}</p>
          <table style="width:100%;border-collapse:collapse;background:#fbfdfb;border-radius:16px;overflow:hidden;border:1px solid #e8eee9;">
            ${detailRows}
          </table>
          <p style="margin:20px 0 0;color:#66756e;font-size:13px;line-height:1.6;">
            Importante: el ingreso a Machu Picchu depende de la disponibilidad oficial y de los canales oficiales de venta.
          </p>
        </div>
      </div>
    </div>
  </div>`;
}

function escapeHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
