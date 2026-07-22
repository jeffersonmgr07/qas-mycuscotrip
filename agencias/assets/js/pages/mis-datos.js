(() => {
  const SESSION_KEY = 'mct_agency_session';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const show = (id, message, type = 'is-error') => { const el = $(id); if (!el) return; el.innerHTML = type === 'is-success' ? `<i class="fa-solid fa-circle-check"></i> ${message}` : message; el.className = `form-message ${type}`; el.hidden = false; };
  const I18N = window.MCTAgenciesI18n || null;
  const t = (key, fallback = key) => I18N?.t ? I18N.t(key) : fallback;

  const COUNTRIES = [
    ['PE','Perú','51'], ['MX','México','52'], ['CL','Chile','56'], ['CO','Colombia','57'], ['BR','Brasil','55'], ['AR','Argentina','54'], ['BO','Bolivia','591'], ['EC','Ecuador','593'], ['UY','Uruguay','598'], ['PY','Paraguay','595'], ['VE','Venezuela','58'], ['US','Estados Unidos','1'], ['CA','Canadá','1'], ['ES','España','34'], ['GB','Reino Unido','44'], ['FR','Francia','33'], ['DE','Alemania','49'], ['IT','Italia','39'], ['JP','Japón','81'], ['KR','Corea del Sur','82'], ['CN','China','86'], ['OTHER','Otro país','51']
  ];

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

  function fillCountrySelect(select, selected = 'PE') {
    if (!select) return;
    select.innerHTML = COUNTRIES.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
    select.value = selected || 'PE';
  }

  function fillPhoneSelect(select, selected = '51') {
    if (!select) return;
    const seen = new Set();
    select.innerHTML = COUNTRIES.filter(([, , phone]) => {
      if (seen.has(phone)) return false;
      seen.add(phone);
      return true;
    }).map(([, label, phone]) => `<option value="${phone}">${label} +${phone}</option>`).join('');
    select.value = String(selected || '51').replace(/\D/g, '') || '51';
  }

  function validPassword(password) {
    if (!password || password.length < 8) return false;
    return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password) && /\d/.test(password) && /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(password);
  }

  function splitPhone(value = '', codeFallback = '') {
    const clean = String(value || '').replace(/^'+/, '').replace(/^\+/, '').replace(/[^0-9 ]/g, '').trim();
    const compact = clean.replace(/\s+/g, '');
    const codes = COUNTRIES.map(([, , phone]) => phone).sort((a,b) => b.length - a.length);
    const code = String(codeFallback || '').replace(/\D/g, '') || codes.find((c) => compact.startsWith(c)) || '51';
    const number = compact.startsWith(code) ? compact.slice(code.length) : compact;
    return { code, number };
  }

  function fullPhone() {
    const code = ($('#profilePhoneCountry')?.value || '').replace(/\D/g, '');
    const number = ($('#profilePhone')?.value || '').replace(/\D/g, '');
    return `${code}${number}`.trim();
  }

  function passwordRules() {
    const value = $('#newPassword')?.value || '';
    const confirm = $('#confirmPassword')?.value || '';
    return {
      length: value.length >= 8,
      letter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(value),
      number: /\d/.test(value),
      special: /[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9]/.test(value),
      match: Boolean(value) && value === confirm
    };
  }

  function updatePasswordChecklist() {
    Object.entries(passwordRules()).forEach(([key, ok]) => {
      const item = $(`[data-check="${key}"]`);
      if (item) item.classList.toggle('is-ok', ok);
    });
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const shouldShow = input.type === 'password';
        input.type = shouldShow ? 'text' : 'password';
        button.textContent = shouldShow ? t('login.hide', 'Ocultar') : t('login.show', 'Ver');
      });
    });
    $('#newPassword')?.addEventListener('input', updatePasswordChecklist);
    $('#confirmPassword')?.addEventListener('input', updatePasswordChecklist);
    updatePasswordChecklist();
  }

  let currentProfile = null;
  let editing = false;

  function setValue(selector, value) { const el = $(selector); if (el) el.value = value || ''; }

  function isCompanyProfile() {
    const type = String(currentProfile?.registrationType || '').toLowerCase();
    return type === 'company' || type === 'empresa' || Boolean(currentProfile?.taxIdNumber || currentProfile?.numeroFiscal);
  }

  function applyVisibility() {
    const isCompany = isCompanyProfile();
    document.querySelectorAll('[data-company-only]').forEach((el) => { el.hidden = !isCompany; });
    $('#profileFirstNameLabel').textContent = isCompany ? 'Nombres del representante' : 'Nombres';
    $('#profileLastNameLabel').textContent = isCompany ? 'Apellidos del representante' : 'Apellidos';
    $('#profileRegistrationType').value = isCompany ? 'Empresa' : 'Persona natural';
  }

  function canEditField(el) {
    if (!el) return false;
    const mode = el.dataset.editable;
    if (mode === 'common') return true;
    if (mode === 'company') return isCompanyProfile();
    if (mode === 'representative') return isCompanyProfile();
    return false;
  }

  function setEditMode(state) {
    editing = state;
    document.querySelectorAll('#profileForm input, #profileForm select').forEach((el) => {
      el.disabled = !(state && canEditField(el));
    });
    $('.profile-edit-actions').hidden = !state;
    $('#editProfileButton').hidden = state;
  }

  function populateProfile(profile, session) {
    currentProfile = profile;
    applyVisibility();
    setValue('#profileStatus', profile.estado || session.estado || '');
    setValue('#profileCountry', profile.country || profile.pais || 'PE');
    setValue('#profileTaxIdType', profile.taxIdType || profile.tipoFiscal || '');
    setValue('#profileTaxIdNumber', profile.taxIdNumber || profile.numeroFiscal || '');
    setValue('#profileLegalName', profile.legalName || profile.razonSocial || '');
    setValue('#profileTradeName', profile.tradeName || profile.nombreComercial || '');
    setValue('#profileRepresentativeFirstName', profile.representativeFirstName || profile.representanteNombres || '');
    setValue('#profileRepresentativeLastName', profile.representativeLastName || profile.representanteApellidos || '');
    setValue('#profileRepresentativeNationality', profile.nationality || profile.pais || 'PE');
    setValue('#profileRepresentativeDocType', profile.documentType || profile.tipoDocumento || '');
    setValue('#profileRepresentativeDocNumber', profile.documentNumber || profile.numeroDocumento || '');
    setValue('#profileEmail', profile.accessEmail || profile.correo || session.email || '');
    const phone = splitPhone(profile.fullPhone || profile.celular || '', profile.phoneCode || '');
    setValue('#profilePhoneCountry', phone.code);
    setValue('#profilePhone', profile.phoneNumber || phone.number || '');
    setValue('#profileWeb', profile.website || profile.web || '');
    setEditMode(false);
  }

  function buildProfilePayload(session) {
    const isCompany = isCompanyProfile();
    return {
      account: session,
      registrationType: isCompany ? 'company' : 'natural',
      tradeName: $('#profileTradeName')?.value.trim() || '',
      representativeFirstName: $('#profileRepresentativeFirstName')?.value.trim() || '',
      representativeLastName: $('#profileRepresentativeLastName')?.value.trim() || '',
      representativeNationality: $('#profileRepresentativeNationality')?.value || '',
      documentType: $('#profileRepresentativeDocType')?.value || '',
      documentNumber: $('#profileRepresentativeDocNumber')?.value.trim() || '',
      phoneCode: $('#profilePhoneCountry')?.value || '',
      phoneNumber: $('#profilePhone')?.value.replace(/\D/g, '') || '',
      fullPhone: fullPhone(),
      website: $('#profileWeb')?.value.trim() || '',
      celular: fullPhone(),
      web: $('#profileWeb')?.value.trim() || ''
    };
  }

  async function init() {
    const session = requireSession();
    if (!session) return;
    fillCountrySelect($('#profileCountry'), 'PE');
    fillCountrySelect($('#profileRepresentativeNationality'), 'PE');
    fillPhoneSelect($('#profilePhoneCountry'), '51');
    bindPasswordToggles();

    try {
      const result = await callApps('getAgencyProfile', { account: session });
      if (result.ok && result.profile) populateProfile(result.profile, session);
      else populateProfile({ accessEmail: session.email, tradeName: session.companyName }, session);
    } catch (error) {
      console.warn(error);
      populateProfile({ accessEmail: session.email, tradeName: session.companyName }, session);
    }

    $('#editProfileButton')?.addEventListener('click', () => setEditMode(true));
    $('#cancelProfileEdit')?.addEventListener('click', () => populateProfile(currentProfile || {}, session));
    $('#profilePhone')?.addEventListener('input', (event) => { event.target.value = event.target.value.replace(/\D+/g, ''); });

    $('#profileForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!editing) return;
      const button = event.submitter;
      const originalText = button?.textContent || t('profile.saveChanges', 'Guardar cambios');
      button.disabled = true;
      button.textContent = t('profile.saving', 'Guardando...');
      try {
        const payload = buildProfilePayload(session);
        const result = await callApps('updateAgencyProfile', payload);
        if (!result.ok) { show('#profileMessage', result.message || 'No se pudo actualizar.'); return; }
        const updatedSession = { ...session, phone: payload.fullPhone, companyName: payload.tradeName || session.companyName };
        writeJSON(SESSION_KEY, updatedSession);
        show('#profileMessage', result.message || 'Datos actualizados correctamente.', 'is-success');
        currentProfile = { ...(currentProfile || {}), ...payload, fullPhone: payload.fullPhone, website: payload.website };
        setEditMode(false);
        setTimeout(() => { const msg = $('#profileMessage'); if (msg) msg.hidden = true; }, 4500);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });

    $('#togglePasswordPanel')?.addEventListener('click', () => {
      const form = $('#passwordForm');
      const isHidden = form.hidden;
      form.hidden = !isHidden;
      $('#togglePasswordPanel').innerHTML = isHidden ? '<i class="fa-solid fa-xmark"></i> Ocultar cambio' : '<i class="fa-solid fa-key"></i> Cambiar contraseña';
    });

    $('#passwordForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const currentPassword = $('#currentPassword').value;
      const newPassword = $('#newPassword').value;
      const confirmPassword = $('#confirmPassword').value;
      if (newPassword !== confirmPassword) { show('#passwordMessage', 'La confirmación no coincide.'); return; }
      if (!validPassword(newPassword)) { show('#passwordMessage', 'La nueva contraseña debe tener mínimo 8 caracteres, una letra, un número y un carácter especial.'); return; }
      const button = event.submitter;
      const originalText = button.textContent;
      button.disabled = true;
      button.textContent = t('profile.updating', 'Actualizando...');
      try {
        const result = await callApps('changePassword', { account: session, currentPassword, newPassword });
        if (!result.ok) { show('#passwordMessage', result.message || 'No se pudo cambiar la contraseña.'); return; }
        show('#passwordMessage', result.message || 'Contraseña actualizada correctamente.', 'is-success');
        event.target.reset();
        updatePasswordChecklist();
        setTimeout(() => { const msg = $('#passwordMessage'); if (msg) msg.hidden = true; }, 4500);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
