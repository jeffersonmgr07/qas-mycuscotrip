(() => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const SESSION_KEY = 'mct_agency_session';
  const $ = (s) => document.querySelector(s);
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };

  async function send(action, payload) {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok:false, message:'Respuesta no válida de Apps Script.' }; }
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code') || params.get('orden') || '';
    const paymentId = params.get('payment_id') || params.get('collection_id') || params.get('paymentId') || '';
    const status = params.get('status') || params.get('collection_status') || '';
    const msg = $('#mercadoPagoReturnMessage');

    if (!code) {
      msg.className = 'form-message is-error';
      msg.textContent = 'No encontramos el código de orden para confirmar el pago.';
      return;
    }

    if (!paymentId) {
      msg.className = status === 'pending' ? 'form-message' : 'form-message is-error';
      msg.textContent = status === 'pending'
        ? 'El pago quedó pendiente de validación en Mercado Pago. Revisa tus órdenes en unos minutos.'
        : 'No encontramos el ID de pago de Mercado Pago para confirmar la orden.';
      return;
    }

    const result = await send('confirmMercadoPagoPayment', {
      code,
      paymentId,
      status,
      account: readJSON(SESSION_KEY, {})
    });

    if (result.ok) {
      msg.className = 'form-message is-success';
      msg.textContent = result.message || 'Pago confirmado correctamente. Tu orden fue marcada como Pagada.';
      localStorage.removeItem('mct_reservation_cart');
    } else {
      msg.className = 'form-message is-error';
      msg.textContent = result.message || 'No se pudo confirmar el pago. Si el cargo aparece en Mercado Pago, contáctanos con el código de orden.';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
