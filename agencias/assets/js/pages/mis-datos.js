(() => {
  const SESSION_KEY = 'mct_agency_session';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const show = (id, message, type = 'is-error') => { const el = $(id); el.textContent = message; el.className = `form-message ${type}`; el.hidden = false; };
  const I18N = window.MCTAgenciesI18n || null;
  const t = (key, fallback = key) => I18N?.t ? I18N.t(key) : fallback;

  function requireSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session?.email) { window.location.href = './login.html'; return null; }
    return session;
  }

  async function callApps(action, payload) {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, email: payload?.account?.email, agencyId: payload?.account?.agencyId })
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { ok:false, message:'No se pudo leer la respuesta del servidor.' }; }
  }

  function validPassword(password) {
    if (!password || password.length < 8) return false;
    return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) && /\d/.test(password) && /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(password);
  }

  function splitPhone(value = '') {
    const clean = String(value || '').replace(/^'+/, '').replace(/^\+/, '').replace(/[^0-9 ]/g, '').trim();
    const compact = clean.replace(/\s+/g, '');
    const codes = ['591','593','51','52','56','55','57','54','34','44','33','49','39','81','82','86','1'];
    const code = codes.find((c) => compact.startsWith(c)) || '51';
    const number = compact.startsWith(code) ? compact.slice(code.length) : compact;
    return { code, number };
  }

  function fullPhone() {
    const code = ($('#profilePhoneCountry')?.value || '').replace(/\D/g, '');
    const number = ($('#profilePhone')?.value || '').replace(/\D/g, '');
    return `${code}${number}`.trim();
  }

  function updatePasswordChecklist() {
    const value = $('#newPassword')?.value || '';
    const checks = {
      length: value.length >= 8,
      letter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(value)
    };
    Object.entries(checks).forEach(([key, ok]) => {
      const el = `[data-check="${key}"]`;
      const item = $(el);
      if (item) item.classList.toggle('is-ok', ok);
    });
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? t('login.hide', 'Ocultar') : t('login.show', 'Ver');
      });
    });
    $('#newPassword')?.addEventListener('input', updatePasswordChecklist);
    updatePasswordChecklist();
  }

  async function init() {
    const session = requireSession();
    if (!session) return;
    $('#profileCompany').value = session.companyName || '';
    $('#profileEmail').value = session.email || '';
    bindPasswordToggles();
    try {
      const result = await callApps('getAgencyProfile', { account: session });
      if (result.ok && result.profile) {
        $('#profileCompany').value = result.profile.nombreComercial || result.profile.razonSocial || session.companyName || '';
        const phone = splitPhone(result.profile.celular || '');
        if ($('#profilePhoneCountry')) $('#profilePhoneCountry').value = phone.code;
        $('#profilePhone').value = phone.number;
        $('#profileWeb').value = result.profile.web || '';
      }
    } catch (error) { console.warn(error); }

    $('#profileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      button.textContent = t('profile.saving', 'Guardando...');
      try {
        const result = await callApps('updateAgencyProfile', { account: session, celular: fullPhone(), web: $('#profileWeb').value.trim() });
        if (!result.ok) { show('#profileMessage', result.message || 'No se pudo actualizar.'); return; }
        const updatedSession = { ...session, phone: fullPhone() };
        writeJSON(SESSION_KEY, updatedSession);
        show('#profileMessage', result.message || 'Datos actualizados correctamente.', 'is-success');
      } finally {
        button.disabled = false;
        button.textContent = t('profile.saveChanges', 'Guardar cambios');
      }
    });

    $('#passwordForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const currentPassword = $('#currentPassword').value;
      const newPassword = $('#newPassword').value;
      const confirmPassword = $('#confirmPassword').value;
      if (newPassword !== confirmPassword) { show('#passwordMessage', 'La confirmación no coincide.'); return; }
      if (!validPassword(newPassword)) { show('#passwordMessage', 'La nueva contraseña debe tener mínimo 8 caracteres, una letra, un número y un carácter especial.'); return; }
      const button = event.submitter;
      button.disabled = true;
      button.textContent = t('profile.updating', 'Actualizando...');
      try {
        const result = await callApps('changePassword', { account: session, currentPassword, newPassword });
        if (!result.ok) { show('#passwordMessage', result.message || 'No se pudo cambiar la contraseña.'); return; }
        show('#passwordMessage', result.message || 'Contraseña actualizada correctamente.', 'is-success');
        event.target.reset();
        updatePasswordChecklist();
      } finally {
        button.disabled = false;
        button.textContent = t('profile.updatePassword', 'Actualizar contraseña');
      }
    });
  }
  document.addEventListener('DOMContentLoaded', init);
})();
