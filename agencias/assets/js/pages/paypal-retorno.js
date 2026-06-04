(() => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const SESSION_KEY = 'mct_agency_session';
  const $ = (s) => document.querySelector(s);
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  async function send(action, payload) {
    const res = await fetch(APPS_SCRIPT_URL, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify({ action, payload }) });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok:false, message:'Respuesta no válida de Apps Script.' }; }
  }
  async function init() {
    const params = new URLSearchParams(window.location.search);
    const paypalOrderId = params.get('token') || params.get('orderID') || '';
    const code = params.get('code') || params.get('orden') || '';
    const msg = $('#paypalReturnMessage');
    if (!paypalOrderId || !code) { msg.textContent = 'No encontramos los datos necesarios para confirmar el pago.'; return; }
    const result = await send('capturePayPalOrder', { paypalOrderId, code, account: readJSON(SESSION_KEY,{}) });
    if (result.ok) {
      msg.className = 'form-message is-success';
      msg.textContent = result.message || 'Pago confirmado correctamente. Tu orden fue marcada como Pagada.';
      localStorage.removeItem('mct_reservation_cart');
    } else {
      msg.className = 'form-message is-error';
      msg.textContent = result.message || 'No se pudo confirmar el pago. Si el cargo aparece en PayPal, contáctanos con el código de orden.';
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
