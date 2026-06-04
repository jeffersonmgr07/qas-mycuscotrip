(() => {
  const SESSION = 'mct_agency_session';

  // URL actual de tu Web App de Google Apps Script
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';

  const $ = (selector) => document.querySelector(selector);

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
  };

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
      body: JSON.stringify({
        action: 'loginAgency',
        email,
        password
      })
    });

    const text = await response.text();

    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Respuesta no JSON de Apps Script:', text);
      return {
        ok: false,
        message: 'Apps Script respondió algo inesperado. Revisa la consola del navegador y las ejecuciones del script.'
      };
    }
  }

  $('#loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = $('#loginEmail')?.value.trim().toLowerCase();
    const password = $('#loginPassword')?.value;

    if (!email || !password) {
      show('Ingresa tu correo y contraseña.');
      return;
    }

    if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGA_AQUI')) {
      show('Falta configurar la URL de Google Apps Script.');
      return;
    }

    const button = event.submitter;
    const originalText = button?.textContent || 'Ingresar';

    if (button) {
      button.disabled = true;
      button.textContent = 'Ingresando...';
    }

    try {
      const result = await loginAgency(email, password);
      console.log('Respuesta login Apps Script:', result);

      if (!result.ok) {
        show(result.message || 'No encontramos un acceso activo con esos datos.');
        return;
      }

      const agency = result.agency || {};

      write(SESSION, {
        agencyId: agency.id || agency.agencyId || '',
        email: agency.correo || agency.email || email,
        companyName: agency.nombreComercial || agency.razonSocial || agency.companyName || 'Agencia registrada',
        contactName: agency.representanteNombres || agency.contactName || '',
        country: agency.pais || agency.country || '',
        representanteNombres: agency.representanteNombres || agency.contactName || '',
        status: agency.estado || agency.status || 'Aprobado',
        loggedAt: new Date().toISOString(),
        source: 'google-sheets'
      });

      window.location.href = './index.html';

    } catch (error) {
      console.error(error);
      show('No se pudo conectar con Google Apps Script. Revisa la URL publicada con acceso para cualquier persona.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  });
})();
