(() => {
  const CONFIG = {
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbz38yAU-vEt5Joe8NQjDRFsEIOqgDIv-w99YHI5sLbO03rKCt-dwAH10j0A92pyOAEx/exec'
  };

  const TAX_LABELS = {
    PE: 'RUC', MX: 'RFC', CL: 'RUT', BR: 'CNPJ', CO: 'NIT', AR: 'CUIT',
    BO: 'NIT', EC: 'RUC', US: 'EIN / Tax ID', OTHER: 'Identificación fiscal'
  };

  const $ = (selector) => document.querySelector(selector);
  const value = (selector) => $(selector)?.value.trim() || '';

  function show(message, type = 'is-error') {
    const el = $('#registerMessage');
    if (!el) return;
    el.textContent = message;
    el.className = `form-message ${type}`;
    el.hidden = false;
  }

  function syncCountry() {
    const country = $('#companyCountry')?.value || 'PE';
    const taxLabel = $('#taxLabel');
    if (taxLabel) taxLabel.textContent = TAX_LABELS[country] || 'Identificación fiscal';

    const phoneCountry = $('#companyPhoneCountry');
    const map = { PE:'+51', MX:'+52', CL:'+56', BR:'+55', CO:'+57', AR:'+54', BO:'+591', EC:'+593', US:'+1' };
    if (phoneCountry && map[country]) phoneCountry.value = map[country];
  }

  function normalizePhone() {
    const countryCode = value('#companyPhoneCountry');
    const phone = value('#companyPhone').replace(/^\+/, '').trim();
    return `${countryCode} ${phone}`.trim();
  }

  function validatePassword(password) {
    if (password.length < 8) return 'La contraseña debe tener mínimo 8 caracteres.';
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password)) return 'La contraseña debe incluir al menos una letra.';
    if (!/\d/.test(password)) return 'La contraseña debe incluir al menos un número.';
    if (!/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(password)) return 'La contraseña debe incluir al menos un carácter especial, por ejemplo @, #, $, %, &, * o !.';
    return '';
  }

  async function sendToSheet(action, payload) {
    if (!CONFIG.googleScriptUrl || CONFIG.googleScriptUrl.includes('PEGA_AQUI')) {
      throw new Error('Falta configurar la URL de Google Apps Script.');
    }

    const response = await fetch(CONFIG.googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Google Apps Script no devolvió una respuesta JSON válida. Revisa la implementación publicada.');
    }
  }

  $('#companyCountry')?.addEventListener('change', syncCountry);
  $('#companyEmail')?.addEventListener('input', () => {
    const access = $('#accessEmail');
    if (access && !access.value.trim()) access.value = $('#companyEmail').value.trim();
  });

  $('#agencyRegisterForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = $('#agencyRegisterForm');
    if (!form.reportValidity()) return;

    const password = $('#registerPassword').value;
    const confirm = $('#registerPasswordConfirm').value;
    const passwordError = validatePassword(password);
    if (passwordError) { show(passwordError); return; }
    if (password !== confirm) { show('Las contraseñas no coinciden.'); return; }

    const button = event.submitter;
    const originalText = button?.textContent || 'Registrar mi agencia';
    if (button) { button.disabled = true; button.textContent = 'Enviando registro...'; }

    const phone = normalizePhone();
    const agency = {
      id: `AG-${Date.now()}`,
      status: 'Pendiente',
      password,
      accessEmail: value('#accessEmail').toLowerCase(),
      company: {
        country: value('#companyCountry'),
        taxLabel: $('#taxLabel')?.textContent || '',
        taxId: value('#companyTaxId'),
        legalName: value('#companyName'),
        tradeName: value('#tradeName'),
        email: value('#companyEmail').toLowerCase(),
        phone,
        phoneCountry: value('#companyPhoneCountry'),
        phoneNumber: value('#companyPhone'),
        website: value('#companyWebsite')
      },
      legalRepresentative: {
        firstName: value('#legalFirstName'),
        lastName: value('#legalLastName'),
        docType: value('#legalDocType'),
        docNumber: value('#legalDocNumber')
      }
    };

    try {
      const result = await sendToSheet('registerAgency', agency);
      if (!result.ok) {
        show(result.message || 'No se pudo registrar la agencia.');
        return;
      }
      show(result.message || 'Registro recibido correctamente. Revisa tu correo para verificar el email. Después validaremos tu acceso.', 'is-success');
      form.reset();
      syncCountry();
      setTimeout(() => { window.location.href = './login.html'; }, 2600);
    } catch (error) {
      console.error(error);
      show(error.message || 'No se pudo conectar con Google Apps Script. Revisa la URL y la implementación.');
    } finally {
      if (button) { button.disabled = false; button.textContent = originalText; }
    }
  });

  syncCountry();
})();
