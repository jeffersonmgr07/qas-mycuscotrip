(() => {
  'use strict';
  const CONFIG = Object.assign({ appsScriptUrl: '' }, window.MCT_TRAIN_CONFIG || {});
  const $ = (selector) => document.querySelector(selector);

  async function sendToAppsScript(action, payload) {
    if (!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl.includes('PEGAR_AQUI')) {
      return { ok: false, message: 'Falta configurar APPS_SCRIPT_URL en trenes/assets/js/config.js.' };
    }
    const res = await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (err) { return { ok: false, message: 'Apps Script devolvió una respuesta no válida.' }; }
  }

  function setMessage(text, ok) {
    const el = $('#paypalReturnMessage');
    el.textContent = text;
    el.className = ok ? 'payment-message is-info' : 'payment-message is-error';
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const paypalOrderId = params.get('token') || params.get('orderID') || '';
    const code = params.get('code') || params.get('orden') || localStorage.getItem('mct_train_last_code') || '';
    if (!paypalOrderId || !code) {
      setMessage('No encontramos los datos necesarios para confirmar el pago. Si se realizó el cargo, escríbenos con el comprobante de PayPal.', false);
      return;
    }
    const result = await sendToAppsScript('capturePayPalTrainOrder', { paypalOrderId, code });
    if (result.ok) {
      setMessage(result.message || `Pago confirmado correctamente. Código de reserva: ${code}`, true);
      localStorage.removeItem('mct_train_pending_order');
      localStorage.removeItem('mct_train_last_code');
      return;
    }
    setMessage(result.message || 'No se pudo confirmar el pago. Si el cargo aparece en PayPal, contáctanos con tu código de reserva.', false);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
