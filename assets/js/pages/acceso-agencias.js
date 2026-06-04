(() => {
  const SESSION = 'mct_agency_session';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz38yAU-vEt5Joe8NQjDRFsEIOqgDIv-w99YHI5sLbO03rKCt-dwAH10j0A92pyOAEx/exec';
  const $ = (selector) => document.querySelector(selector);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const show = (message, type = 'is-error') => {
    const el = $('#loginMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `form-message ${type}`;
    el.hidden = false;
  };

  async function loginAgency(email, password) {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'loginAgency', email, password })
    });
    return await response.json();
  }

  $('#loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('#loginEmail')?.value.trim().toLowerCase();
    const password = $('#loginPassword')?.value;
    if (!email || !password) { show('Ingresa tu correo y contraseña.'); return; }
    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI')) { show('Falta configurar la URL de Google Apps Script.'); return; }
    const button = event.submitter;
    const originalText = button?.textContent || 'Ingresar';
    if (button) { button.disabled = true; button.textContent = 'Ingresando...'; }
    try {
      const result = await loginAgency(email, password);
      if (!result.ok) { show(result.message || 'No encontramos un acceso activo con esos datos.'); return; }
      const agency = result.agency || {};
      write(SESSION, {
        agencyId: agency.id || agency.agencyId || '',
        email: agency.correo || agency.email || email,
        companyName: agency.nombreComercial || agency.razonSocial || agency.companyName || 'Agencia registrada',
        contactName: agency.representanteNombres || agency.contactName || '',
        status: agency.estado || agency.status || 'Aprobado',
        loggedAt: new Date().toISOString(),
        source: 'google-sheets'
      });
      window.location.href = './index.html';
    } catch (error) {
      console.error(error);
      show('No se pudo conectar con Google Apps Script. Revisa la URL publicada con acceso para cualquier persona.');
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  });
})();
