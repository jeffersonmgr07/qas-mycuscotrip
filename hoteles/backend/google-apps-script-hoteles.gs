/**
 * My Cusco Trip - Hotel reservations endpoint
 * Deploy as Web App: Execute as Me / Anyone with the link.
 * Paste the /exec URL in hoteles.html: window.MCT_HOTEL_APPS_SCRIPT_URL = "...";
 */
const HOTEL_SHEET_NAME = 'Hotel Orders';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');
    const guest = payload.guest || {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateHotelSheet_(ss);
    sheet.appendRow([
      new Date(),
      payload.type || 'hotel_reservation',
      payload.hotelCode || '',
      payload.hotelName || '',
      payload.destination || '',
      payload.roomType || '',
      payload.roomLabel || '',
      payload.checkin || '',
      payload.checkout || '',
      payload.nights || '',
      payload.adults || '',
      payload.children || '',
      guest.names || '',
      guest.lastnames || '',
      guest.documentType || '',
      guest.documentNumber || '',
      guest.nationality || '',
      guest.phone || '',
      guest.email || '',
      payload.currency || '',
      payload.amount || '',
      payload.paypalOrderId || '',
      payload.paypalStatus || '',
      JSON.stringify(payload)
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'My Cusco Trip Hotel Orders' });
}

function getOrCreateHotelSheet_(ss) {
  let sheet = ss.getSheetByName(HOTEL_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(HOTEL_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Created At', 'Type', 'Hotel Code', 'Hotel Name', 'Destination', 'Room Type', 'Room Label',
      'Check-in', 'Check-out', 'Nights', 'Adults', 'Children',
      'Guest Names', 'Guest Lastnames', 'Document Type', 'Document Number', 'Nationality', 'Phone', 'Email',
      'Currency', 'Amount', 'PayPal Order ID', 'PayPal Status', 'Raw JSON'
    ]);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
