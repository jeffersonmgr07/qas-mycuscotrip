(() => {
  const SESSION_KEY = 'mct_agency_session';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const show = (message, type = 'is-error') => { const el = $('#paymentMessageBox'); el.textContent = message; el.className = `form-message ${type}`; el.hidden = false; };

  function requireSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session?.email) { window.location.href = './login.html'; return null; }
    $('#paymentAgencyName').textContent = session.companyName || session.contactName || session.email || 'Agencia afiliada';
    return session;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function sendPayment(payload) {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'registerPayment', payload })
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { ok:false, message:'No se pudo leer la respuesta del servidor.' }; }
  }

  async function init() {
    const session = requireSession();
    if (!session) return;
    const orderParam = new URLSearchParams(window.location.search).get('orden');
    if (orderParam) $('#orderCode').value = orderParam.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    $('#paymentForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const file = $('#paymentVoucher').files[0];
      if (!file) { show('Adjunta el voucher de pago.'); return; }
      if (file.size > 6 * 1024 * 1024) { show('El archivo no debe superar 6 MB.'); return; }
      const button = event.submitter;
      button.disabled = true;
      button.textContent = 'Enviando...';
      try {
        const base64 = await fileToBase64(file);
        const result = await sendPayment({
          account: session,
          code: $('#orderCode').value.trim().replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
          amount: Number($('#paymentAmount').value || 0),
          currency: $('#paymentCurrency').value,
          message: $('#paymentMessage').value.trim(),
          voucher: { name: file.name, mimeType: file.type, base64 }
        });
        if (!result.ok) { show(result.message || 'No se pudo registrar el pago.'); return; }
        show(result.message || 'Comprobante enviado. Validaremos el pago en máximo 60 minutos.', 'is-success');
        event.target.reset();
      } catch (error) {
        console.error(error);
        show('No se pudo enviar el comprobante. Revisa la conexión.');
      } finally {
        button.disabled = false;
        button.textContent = 'Enviar comprobante';
      }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
