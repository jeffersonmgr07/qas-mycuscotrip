(() => {
  function getApiUrl() {
    return String(
      window.MCT_HOTEL_MARKETPLACE_APPS_SCRIPT_URL ||
      window.MCT_HOTEL_MARKETPLACE_CONFIG?.appsScriptUrl ||
      localStorage.getItem('mctHotelMarketplaceAppsScriptUrl') ||
      'https://script.google.com/macros/s/AKfycbx7zclo0SnYqT0NMP6Uph3oB9XbTGeIIoWj6hWZ7lx2s3ftWMmIpshJ-XtgjEuijsLN/exec' ||
      ''
    ).trim();
  }
  const COUNTRIES = ['Perú','Argentina','Bolivia','Brasil','Canadá','Chile','Colombia','Costa Rica','Cuba','Ecuador','El Salvador','España','Estados Unidos','Francia','Alemania','Italia','México','Países Bajos','Panamá','Paraguay','Reino Unido','Uruguay','Venezuela','Afganistán','Albania','Andorra','Angola','Antigua y Barbuda','Arabia Saudita','Argelia','Armenia','Australia','Austria','Azerbaiyán','Bahamas','Bangladés','Barbados','Bélgica','Belice','Benín','Bielorrusia','Bosnia y Herzegovina','Botsuana','Brunéi','Bulgaria','Burkina Faso','Burundi','Bután','Cabo Verde','Camboya','Camerún','Catar','Chad','China','Chipre','Ciudad del Vaticano','Comoras','Congo','Corea del Norte','Corea del Sur','Costa de Marfil','Croacia','Dinamarca','Dominica','Egipto','Emiratos Árabes Unidos','Eslovaquia','Eslovenia','Estonia','Etiopía','Filipinas','Finlandia','Fiyi','Gabón','Gambia','Georgia','Ghana','Granada','Grecia','Guatemala','Guinea','Guinea-Bisáu','Guinea Ecuatorial','Guyana','Haití','Honduras','Hungría','India','Indonesia','Irak','Irán','Irlanda','Islandia','Israel','Jamaica','Japón','Jordania','Kazajistán','Kenia','Kirguistán','Kiribati','Kuwait','Laos','Lesoto','Letonia','Líbano','Liberia','Libia','Liechtenstein','Lituania','Luxemburgo','Macedonia del Norte','Madagascar','Malasia','Malaui','Maldivas','Malí','Malta','Marruecos','Mauricio','Mauritania','Micronesia','Moldavia','Mónaco','Mongolia','Montenegro','Mozambique','Myanmar','Namibia','Nauru','Nepal','Nicaragua','Níger','Nigeria','Noruega','Nueva Zelanda','Omán','Pakistán','Palaos','Palestina','Papúa Nueva Guinea','Polonia','Portugal','República Centroafricana','República Checa','República Democrática del Congo','República Dominicana','Ruanda','Rumanía','Rusia','Samoa','San Cristóbal y Nieves','San Marino','San Vicente y las Granadinas','Santa Lucía','Santo Tomé y Príncipe','Senegal','Serbia','Seychelles','Sierra Leona','Singapur','Siria','Somalia','Sri Lanka','Sudáfrica','Sudán','Sudán del Sur','Suecia','Suiza','Surinam','Tailandia','Tanzania','Tayikistán','Timor Oriental','Togo','Tonga','Trinidad y Tobago','Túnez','Turkmenistán','Turquía','Tuvalu','Ucrania','Uganda','Uzbekistán','Vanuatu','Vietnam','Yemen','Yibuti','Zambia','Zimbabue'];
  const PHONE_CODES = [['+51','PE'], ['+1','US/CA'], ['+54','AR'], ['+591','BO'], ['+55','BR'], ['+56','CL'], ['+57','CO'], ['+506','CR'], ['+593','EC'], ['+503','SV'], ['+34','ES'], ['+52','MX'], ['+507','PA'], ['+595','PY'], ['+44','UK'], ['+598','UY'], ['+58','VE'], ['+33','FR'], ['+49','DE'], ['+39','IT'], ['+31','NL']];
  const DESTINATIONS = ['Cusco','Aguas Calientes','Machu Picchu','Valle Sagrado','Ollantaytambo','Urubamba','Pisac','Lima','Paracas / Ica','Arequipa','Puno','Uyuni'];
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const escapeHtml = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  
  const serialize = (form) => {
    const data = new FormData(form);
    const obj = {};
    for (const [key, value] of data.entries()) {
      if (obj[key] !== undefined) {
        if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
        obj[key].push(value);
      } else {
        obj[key] = value;
      }
    }
    return obj;
  };
  let ownerPropertiesCache = [];
  let activePropertyForRoom = null;

  const lettersOnlyRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'´-]+$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const sanitizeLetters = (value = '') => String(value).replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'´-]/g, '').replace(/\s{2,}/g, ' ');
  const sanitizeDigits = (value = '') => String(value).replace(/\D/g, '');
  const sanitizeDoc = (value = '', type = '') => type === 'DNI' ? sanitizeDigits(value).slice(0, 8) : String(value).replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\-_.]/g, '').slice(0, 24);
  const passwordChecks = (value = '', confirm = '') => ({
    length: String(value).length >= 8,
    upper: /[A-ZÁÉÍÓÚÜÑ]/.test(value),
    number: /\d/.test(value),
    special: /[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/.test(value),
    match: !!value && value === confirm
  });

  function jsonpRequest(action, payload = {}) {
    const API = getApiUrl();
    if (!API) return Promise.resolve({ ok: false, configMissing: true, error: 'No se encontró la URL del Apps Script. Revisa hoteles/assets/js/config.js o la variable inline del HTML.' });
    return new Promise((resolve) => {
      const callbackName = `mctHotelJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        cleanup();
        resolve({ ok: false, error: 'No se recibió respuesta del Apps Script. Revisa que el despliegue sea Web App y tenga acceso para cualquier usuario.' });
      }, 20000);
      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        script.remove();
      }
      window[callbackName] = (data) => {
        cleanup();
        resolve(data || { ok: false, error: 'Respuesta vacía del Apps Script.' });
      };
      const sep = API.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      params.set('action', action);
      params.set('payload', JSON.stringify({ action, ...payload }));
      params.set('callback', callbackName);
      params.set('_', String(Date.now()));
      script.src = `${API}${sep}${params.toString()}`;
      script.onerror = () => {
        cleanup();
        resolve({ ok: false, error: 'No se pudo cargar el Apps Script. Revisa la URL /exec, el despliegue y vuelve a probar en incógnito.' });
      };
      document.head.appendChild(script);
    });
  }

  async function post(action, payload) {
    // Usamos JSONP porque Google Apps Script puede guardar datos pero bloquear la lectura por CORS desde GitHub Pages.
    // Con JSONP recibimos una respuesta real y evitamos falsos errores de conexión.
    try {
      return await jsonpRequest(action, payload || {});
    } catch (error) {
      console.error('Hotel marketplace API error', error);
      return { ok: false, error: 'No se pudo conectar con Google Sheet. Revisa la URL del Apps Script.' };
    }
  }
  function showMsg(selector, text, ok = true) {
    // Si ya estamos mostrando un resultado al usuario, el loader debe desaparecer sí o sí.
    forceHideLoading();
    const el = $(selector);
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.style.background = ok ? '#f2faf3' : '#fff2f2';
  }

  function showRegisterSuccess(form, message) {
    forceHideLoading();
    if (!form) return;
    const section = form.closest('.hotel-marketplace-card') || form.parentElement;
    form.reset();
    fillSelects();
    updateRegistrationType();
    updatePasswordRules();
    form.hidden = true;
    let success = section.querySelector('[data-register-success-panel]');
    if (!success) {
      success = document.createElement('div');
      success.className = 'hotel-register-success-panel';
      success.setAttribute('data-register-success-panel', '');
      success.innerHTML = `
        <div class="hotel-register-success-icon"><i class="fa-solid fa-envelope-circle-check"></i></div>
        <h2>Revisa tu correo y verifica tu cuenta</h2>
        <p data-register-success-text></p>
        <div class="hotel-admin-actions hotel-register-success-actions">
          <a class="hotel-admin-btn" href="./login-admin-hotel.html">Ir al acceso</a>
          <button type="button" class="hotel-admin-btn hotel-admin-btn--ghost" data-register-again>Registrar otra cuenta</button>
        </div>
      `;
      section.appendChild(success);
    }
    const text = success.querySelector('[data-register-success-text]');
    if (text) text.textContent = message || 'Hemos enviado un correo de verificación a tu bandeja. Abre el enlace para activar tu cuenta.';
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function ensureLoadingBox() {
    let box = document.getElementById('mctHotelLoadingBox');
    if (box) return box;
    const style = document.createElement('style');
    style.textContent = `
      .mct-hotel-loading-backdrop{position:fixed;inset:0;background:rgba(6,40,3,.18);display:grid;place-items:center;z-index:99999;backdrop-filter:blur(2px)}
      .mct-hotel-loading-card{background:#fff;border:1px solid rgba(6,40,3,.18);box-shadow:0 22px 60px rgba(0,0,0,.18);border-radius:22px;padding:22px 26px;display:flex;align-items:center;gap:14px;color:#062803;font-weight:800;min-width:240px;justify-content:center}
      .mct-hotel-loading-spinner{width:24px;height:24px;border:3px solid #dfe8df;border-top-color:#062803;border-radius:999px;animation:mctHotelSpin .8s linear infinite}
      @keyframes mctHotelSpin{to{transform:rotate(360deg)}}
    `;
    document.head.appendChild(style);
    box = document.createElement('div');
    box.id = 'mctHotelLoadingBox';
    box.className = 'mct-hotel-loading-backdrop';
    box.hidden = true;
    box.innerHTML = '<div class="mct-hotel-loading-card"><span class="mct-hotel-loading-spinner" aria-hidden="true"></span><span data-loading-text>Un momento, por favor...</span></div>';
    box.style.display = 'none';
    document.body.appendChild(box);
    return box;
  }

  let hotelLoadingWatchdog = null;
  function forceHideLoading() {
    if (hotelLoadingWatchdog) { clearTimeout(hotelLoadingWatchdog); hotelLoadingWatchdog = null; }
    document.body.classList.remove('is-hotel-loading');
    document.querySelectorAll('#mctHotelLoadingBox, .mct-hotel-loading-backdrop').forEach(box => {
      box.hidden = true;
      box.style.display = 'none';
    });
  }

  function setLoading(active, text = 'Un momento, por favor...') {
    const box = ensureLoadingBox();
    const label = box.querySelector('[data-loading-text]');
    if (label) label.textContent = text;
    if (!active) {
      forceHideLoading();
      return;
    }
    if (hotelLoadingWatchdog) clearTimeout(hotelLoadingWatchdog);
    box.hidden = false;
    box.style.display = 'grid';
    document.body.classList.add('is-hotel-loading');
    // Seguro visual: aunque el Apps Script tarde o el navegador pierda el callback,
    // el bloqueo no queda pegado indefinidamente.
    hotelLoadingWatchdog = setTimeout(forceHideLoading, 30000);
  }

  async function withUserLoading(text, submitter, task) {
    const btn = submitter && submitter.matches ? submitter : null;
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.dataset.loading = '1';
    }
    setLoading(true, text);
    try {
      return await task();
    } finally {
      setLoading(false);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        delete btn.dataset.loading;
      }
    }
  }
  function dateRange(from, to) {
    const dates = [];
    if (!from || !to) return dates;
    const cursor = new Date(`${from}T12:00:00`);
    const end = new Date(`${to}T12:00:00`);
    while (cursor < end) {
      dates.push(cursor.toISOString().slice(0,10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }

  function fillSelects() {
    const countryHtml = COUNTRIES.map(c => `<option value="${escapeHtml(c)}" ${c === 'Perú' ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
    const phoneHtml = PHONE_CODES.map(([c,l]) => `<option value="${escapeHtml(c)}" ${c === '+51' ? 'selected' : ''}>${escapeHtml(c)} · ${escapeHtml(l)}</option>`).join('');
    const destinationHtml = DESTINATIONS.map((d, i) => `<option value="${escapeHtml(d)}" ${i === 0 ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('');
    $$('[data-country-select]').forEach(el => { if (!el.dataset.ready) { el.innerHTML = countryHtml; el.dataset.ready = '1'; } });
    $$('[data-phone-code-select]').forEach(el => { if (!el.dataset.ready) { el.innerHTML = phoneHtml; el.dataset.ready = '1'; } });
    $$('[data-destination-select]').forEach(el => { if (!el.dataset.ready) { el.innerHTML = destinationHtml; el.dataset.ready = '1'; } });
  }

  function updatePasswordRules() {
    const pass = $('#hotelOwnerPassword');
    const confirm = $('#hotelOwnerConfirmPassword');
    const rules = $('[data-password-rules]');
    if (!pass || !confirm || !rules) return;
    const checks = passwordChecks(pass.value, confirm.value);
    Object.entries(checks).forEach(([key, ok]) => {
      const row = rules.querySelector(`[data-rule="${key}"]`);
      if (!row) return;
      row.classList.toggle('is-ok', ok);
      const icon = row.querySelector('i');
      if (icon) icon.className = ok ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
    });
  }

  function isStrongPassword(value) {
    const checks = passwordChecks(value, value);
    return checks.length && checks.upper && checks.number && checks.special;
  }

  function togglePassword(button, event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const id = button?.dataset?.togglePassword;
    const input = id ? document.getElementById(id) : null;
    if (!input) return false;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.setAttribute('aria-pressed', show ? 'true' : 'false');
    const icon = button.querySelector('i');
    if (icon) icon.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
    input.focus({ preventScroll: true });
    return false;
  }

  function updateRegistrationType() {
    const type = $('#hotelRegistrationType')?.value || 'natural';
    const isCompany = type === 'company';
    $$('[data-company-field]').forEach(el => { el.hidden = !isCompany; $$('input,select,textarea', el).forEach(field => field.required = isCompany); });
    $$('[data-natural-field]').forEach(el => { el.hidden = isCompany; $$('input,select,textarea', el).forEach(field => field.required = !isCompany); });
  }

  function sanitizeInput(target) {
    if (!target) return;
    if (target.matches('#hotelOwnerPassword, #hotelOwnerConfirmPassword')) updatePasswordRules();
    if (target.matches('[data-letters-only]')) target.value = sanitizeLetters(target.value);
    if (target.matches('[data-phone-only]')) target.value = sanitizeDigits(target.value).slice(0, 15);
    if (target.matches('[data-ruc-only]')) target.value = sanitizeDigits(target.value).slice(0, 11);
    if (target.matches('[data-document-input]')) { const form = target.closest('form'); const docType = form?.querySelector('[name="docType"]')?.value || $('#hotelOwnerDocType')?.value || ''; target.value = sanitizeDoc(target.value, docType); }
    if (target.matches('#hotelOwnerDocType, select[name="docType"]')) {
      const docInput = $('#hotelOwnerDocNumber');
      if (docInput) {
        docInput.value = sanitizeDoc(docInput.value, target.value);
        docInput.inputMode = target.value === 'DNI' ? 'numeric' : 'text';
        docInput.maxLength = target.value === 'DNI' ? 8 : 24;
      }
    }
  }

  function validateForm(form) {
    let ok = true;
    $$('[required]', form).forEach(field => {
      const value = String(field.value || '').trim();
      const label = field.closest('label');
      label?.classList.remove('has-error');
      if (!value) { ok = false; label?.classList.add('has-error'); }
      if (field.type === 'email' && value && !emailRegex.test(value)) { ok = false; label?.classList.add('has-error'); }
      if (field.matches('[data-letters-only]') && value && !lettersOnlyRegex.test(value)) { ok = false; label?.classList.add('has-error'); }
      if (field.matches('[data-ruc-only]') && value && !/^\d{11}$/.test(value)) { ok = false; label?.classList.add('has-error'); }
      if (field.matches('[data-phone-only]') && value && !/^\d{6,15}$/.test(value)) { ok = false; label?.classList.add('has-error'); }
      if (field.matches('[data-document-input]')) {
        const docType = field.closest('form')?.querySelector('[name="docType"]')?.value || $('#hotelOwnerDocType')?.value || '';
        if (docType === 'DNI' && !/^\d{8}$/.test(value)) { ok = false; label?.classList.add('has-error'); }
      }
    });
    $$('[data-min-files]', form).forEach(field => {
      const label = field.closest('label');
      const min = Number(field.dataset.minFiles || 0);
      const isPropertyEdit = form.dataset.marketplaceForm === 'property' && form.dataset.mode === 'edit';
      label?.classList.remove('has-error');
      if (!isPropertyEdit && min && field.files && field.files.length < min) { ok = false; label?.classList.add('has-error'); }
    });
    if (form.id === 'hotelOwnerRegisterForm') {
      const pass = form.elements.password?.value || '';
      const confirm = form.elements.confirmPassword?.value || '';
      if (!isStrongPassword(pass) || pass !== confirm) {
        ok = false;
        form.elements.password?.closest('label')?.classList.add('has-error');
        form.elements.confirmPassword?.closest('label')?.classList.add('has-error');
        updatePasswordRules();
      }
    }
    if (form.dataset.marketplaceForm === 'password') {
      const pass = form.elements.newPassword?.value || '';
      const confirm = form.elements.confirmPassword?.value || '';
      if (!isStrongPassword(pass) || pass !== confirm) {
        ok = false;
        form.elements.newPassword?.closest('label')?.classList.add('has-error');
        form.elements.confirmPassword?.closest('label')?.classList.add('has-error');
      }
    }
    return ok;
  }

  
  function resetPhotoPreview(form) {
    if (!form) return;
    $$('[data-preview-target]', form).forEach(input => {
      const target = document.getElementById(input.dataset.previewTarget);
      if (target) target.innerHTML = '';
    });
  }
  function resetPropertyFormForCreate() {
    const modal = document.getElementById('propertyModal');
    const form = modal?.querySelector('[data-marketplace-form="property"]');
    if (!form) return;
    form.reset();
    form.dataset.mode = 'create';
    delete form.dataset.propertyId;
    const title = modal.querySelector('header h2');
    if (title) title.textContent = 'Crear alojamiento';
    const button = form.querySelector('[type="submit"]');
    if (button) button.textContent = 'Guardar alojamiento';
    fillSelects();
    resetPhotoPreview(form);
    updateMapPreview(form);
  }
  function fillPropertyFormForEdit(propertyId) {
    const item = ownerPropertiesCache.find(p => String(p.propertyId || p.id || '') === String(propertyId));
    const modal = document.getElementById('propertyModal');
    const form = modal?.querySelector('[data-marketplace-form="property"]');
    if (!item || !form) return;
    form.reset();
    form.dataset.mode = 'edit';
    form.dataset.propertyId = item.propertyId || item.id || '';
    ['type','name','destination','stars','address','mapUrl','description','website','confirmationMode','commissionRate'].forEach(key => {
      const field = form.elements[key];
      if (!field) return;
      if (field instanceof RadioNodeList) {
        Array.from(field).forEach(r => { r.checked = String(r.value) === String(item[key] || ''); });
      } else field.value = item[key] || '';
    });
    const title = modal.querySelector('header h2');
    if (title) title.textContent = 'Editar alojamiento';
    const button = form.querySelector('[type="submit"]');
    if (button) button.textContent = 'Guardar cambios';
    resetPhotoPreview(form);
    updateMapPreview(form);
  }
  function prepareRoomForm(propertyId) {
    const item = ownerPropertiesCache.find(p => String(p.propertyId || p.id || '') === String(propertyId));
    const modal = document.getElementById('roomModal');
    const form = modal?.querySelector('[data-marketplace-form="room"]');
    if (!form) return;
    form.reset();
    activePropertyForRoom = item || { propertyId };
    const idField = form.querySelector('[data-room-property-id]');
    if (idField) idField.value = propertyId || '';
    const title = modal.querySelector('header h2');
    if (title) title.textContent = `Crear habitación - ${item?.name || 'Alojamiento'}`;
    resetPhotoPreview(form);
  }
  function openModal(id, options = {}) {
    if (id === 'propertyModal') {
      if (options.mode === 'edit') fillPropertyFormForEdit(options.propertyId);
      else resetPropertyFormForCreate();
    }
    if (id === 'roomModal') prepareRoomForm(options.propertyId || activePropertyForRoom?.propertyId || '');
    const el = document.getElementById(id);
    if (el) { el.hidden = false; document.body.style.overflow = 'hidden'; }
  }

  function closeModal() { $$('.hotel-market-modal').forEach(el => el.hidden = true); document.body.style.overflow = ''; }
  function switchPanelTab(tab) {
    $$('[data-hotel-panel-tab]').forEach(btn => btn.classList.toggle('is-active', btn.dataset.hotelPanelTab === tab));
    $$('[data-hotel-panel-section]').forEach(sec => sec.classList.toggle('is-active', sec.dataset.hotelPanelSection === tab));
  }


  function useCurrentLocation(button) {
    if (!navigator.geolocation) {
      alert('Tu navegador no permite obtener ubicación automáticamente. Puedes abrir Google Maps y pegar el enlace.');
      return;
    }
    button.disabled = true;
    const original = button.innerHTML;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Obteniendo...';
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const form = button.closest('form');
      const input = form?.querySelector('[name="mapUrl"]');
      if (input) input.value = `https://www.google.com/maps?q=${lat},${lng}`;
      updateMapPreview(form);
      button.disabled = false;
      button.innerHTML = original;
    }, () => {
      button.disabled = false;
      button.innerHTML = original;
      alert('No se pudo obtener tu ubicación. Revisa permisos del navegador o pega el enlace de Google Maps manualmente.');
    }, { enableHighAccuracy: true, timeout: 10000 });
  }


  function googleMapsEmbedUrl(value = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const qMatch = raw.match(/[?&]q=([^&]+)/i);
    const atMatch = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const coordMatch = raw.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    let q = '';
    if (qMatch) q = decodeURIComponent(qMatch[1]);
    else if (atMatch) q = `${atMatch[1]},${atMatch[2]}`;
    else if (coordMatch) q = `${coordMatch[1]},${coordMatch[2]}`;
    else q = raw;
    return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=16&output=embed`;
  }
  function updateMapPreview(formOrInput) {
    const form = formOrInput?.tagName === 'FORM' ? formOrInput : formOrInput?.closest?.('form');
    if (!form) return;
    const input = form.querySelector('[data-map-url-input]');
    const wrap = form.querySelector('[data-map-preview]');
    const iframe = wrap?.querySelector('iframe');
    if (!input || !wrap || !iframe) return;
    const url = googleMapsEmbedUrl(input.value);
    if (!url) { wrap.hidden = true; iframe.removeAttribute('src'); return; }
    iframe.src = url;
    wrap.hidden = false;
  }
  function renderImagePreviews(input) {
    const target = input?.dataset?.previewTarget ? document.getElementById(input.dataset.previewTarget) : null;
    if (!target) return;
    target.innerHTML = '';
    const files = Array.from(input.files || []).filter(file => file.type.startsWith('image/'));
    if (!files.length) {
      target.innerHTML = '<small class="hotel-photo-preview-empty">Aún no seleccionaste imágenes.</small>';
      return;
    }
    files.forEach(file => {
      const card = document.createElement('figure');
      card.className = 'hotel-photo-preview-card';
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      const caption = document.createElement('figcaption');
      caption.textContent = file.name;
      card.appendChild(img);
      card.appendChild(caption);
      target.appendChild(card);
    });
  }


  const SESSION_KEY = 'mctHotelOwnerSession';

  function hotelPublicBaseUrl() {
    const path = window.location.pathname || '/hoteles/';
    if (window.location.origin && !window.location.origin.includes('script.google.com')) {
      const basePath = path.includes('/hoteles/') ? path.slice(0, path.indexOf('/hoteles/') + '/hoteles'.length) : '/hoteles';
      return `${window.location.origin}${basePath}`.replace(/\/$/, '');
    }
    const configBase = window.MCT_HOTEL_MARKETPLACE_CONFIG?.publicBaseUrl || 'https://www.mycuscotrip.com/hoteles';
    return String(configBase).replace(/\/$/, '');
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (_) { return null; }
  }
  function setSession(data) {
    if (!data) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    if (data.email) localStorage.setItem('mctHotelOwnerEmail', data.email);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('mctHotelOwnerEmail');
  }
  function statusIsAllowed(status = '') {
    const value = String(status).toLowerCase();
    return ['approved','aprobado','active','activo','verified','verificado','provider','proveedor','hotel_provider'].includes(value);
  }
  function setAccountValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
  }
  function ownerDisplayType(owner) {
    return owner?.registrationType === 'company' ? 'Empresa' : 'Persona natural';
  }
  function updateAccountView(owner) {
    if (!document.body.classList.contains('hotel-panel-admin-body') && !document.querySelector('[data-hotel-panel-section="account"]')) return;
    const current = owner || getSession() || {};
    setAccountValue('accountType', ownerDisplayType(current));
    setAccountValue('accountFirstName', current.firstName || current.nombres || '—');
    setAccountValue('accountLastName', current.lastName || current.apellidos || '—');
    const doc = current.registrationType === 'company'
      ? 'Empresa'
      : [current.docType || current.tipoDocumento, current.docNumber || current.numeroDocumento].filter(Boolean).join(' · ');
    setAccountValue('accountDocument', doc || '—');
    setAccountValue('accountNationality', current.nationality || current.nacionalidad || (current.registrationType === 'company' ? '—' : 'Perú'));
    setAccountValue('accountPhone', [current.phoneCode || '+51', current.phone || current.whatsapp].filter(Boolean).join(' '));
    setAccountValue('accountEmail', current.email || localStorage.getItem('mctHotelOwnerEmail') || '—');
    setAccountValue('accountWebsite', current.website || current.web || '—');
    setAccountValue('accountBusiness', current.businessName || current.razonSocial || (current.registrationType === 'company' ? 'Pendiente de completar' : 'No aplica'));
    setAccountValue('accountTaxId', current.taxId || current.ruc || (current.registrationType === 'company' ? '—' : 'No aplica'));
    document.querySelectorAll('[data-company-account]').forEach(el => {
      el.hidden = current.registrationType !== 'company' && !current.businessName && !current.taxId;
    });
    document.querySelectorAll('[data-owner-email]').forEach(el => { el.value = current.email || ''; });
    document.querySelectorAll('[data-owner-user-id]').forEach(el => { el.value = current.userId || ''; });
  }

  function propertyTypeLabel(type = '') {
    return ({ hotel: 'Hotel', apartment: 'Apartamento', room: 'Habitación', lodge: 'Lodge' }[String(type).toLowerCase()] || type || 'Alojamiento');
  }
  function renderProperties(properties = []) {
    ownerPropertiesCache = Array.isArray(properties) ? properties : [];
    const list = document.getElementById('hotelOwnerPropertiesList');
    const empty = document.getElementById('hotelOwnerPropertiesEmpty');
    if (!list) return;
    list.innerHTML = '';
    if (!ownerPropertiesCache.length) {
      if (empty) empty.hidden = false;
      renderPropertyOptions([]);
      return;
    }
    if (empty) empty.hidden = true;
    list.innerHTML = ownerPropertiesCache.map(item => {
      const id = item.propertyId || item.id || '';
      const stars = item.stars ? `${escapeHtml(item.stars)} estrellas` : 'Sin categoría';
      const mode = item.confirmationMode === 'manual' ? 'Confirmación manual' : 'Confirmación instantánea';
      return `
      <article class="hotel-owner-property-card" data-property-card="${escapeHtml(id)}">
        <div class="hotel-owner-property-main">
          <span class="hotel-owner-property-kicker">${escapeHtml(item.destination || 'Destino pendiente')}</span>
          <strong class="hotel-owner-property-title">${escapeHtml(item.name || 'Alojamiento sin nombre')}</strong>
          <small class="hotel-owner-property-meta">${escapeHtml(propertyTypeLabel(item.type))} · ${stars} · ${escapeHtml(mode)}</small>
        </div>
        <div class="hotel-owner-property-actions">
          <em>${escapeHtml(item.status || 'draft')}</em>
          <button type="button" class="hotel-admin-btn hotel-admin-btn--small hotel-admin-btn--ghost" data-edit-property="${escapeHtml(id)}"><i class="fa-solid fa-pen"></i> Editar alojamiento</button>
          <button type="button" class="hotel-admin-btn hotel-admin-btn--small" data-create-room-for="${escapeHtml(id)}"><i class="fa-solid fa-bed"></i> Crear habitación</button>
        </div>
      </article>`;
    }).join('');
    renderPropertyOptions(ownerPropertiesCache);
  }

  function renderPropertyOptions(properties = []) {
    const fallback = '<option value="">Selecciona alojamiento</option>';
    const options = properties.length
      ? properties.map(item => `<option value="${escapeHtml(item.propertyId || item.id || item.name)}">${escapeHtml(item.name || item.propertyId || 'Alojamiento')}</option>`).join('')
      : fallback;
    document.querySelectorAll('[data-property-select]').forEach(select => {
      const current = select.value;
      select.innerHTML = options;
      if (current && Array.from(select.options).some(o => o.value === current)) select.value = current;
    });
  }

  async function loadPanelData() {
    const panel = document.querySelector('.hotel-admin-dashboard');
    if (!panel) return;
    const session = getSession();
    const API = getApiUrl();
    if (!session && getApiUrl()) {
      window.location.href = './login-admin-hotel.html';
      return;
    }
    updateAccountView(session || { registrationType: 'natural', email: localStorage.getItem('mctHotelOwnerEmail') || '' });
    if (!API || !session?.email) {
      renderProperties([]);
      return;
    }
    const ownerResult = await post('get_owner', { email: session.email, sessionToken: session.sessionToken || '' });
    if (ownerResult?.ok && ownerResult.owner) {
      setSession({ ...session, ...ownerResult.owner, sessionToken: ownerResult.sessionToken || session.sessionToken });
      updateAccountView({ ...session, ...ownerResult.owner });
    }
    const propertiesResult = await post('get_properties', { ownerUserId: (ownerResult.owner || session).userId, email: session.email });
    if (propertiesResult?.ok) renderProperties(propertiesResult.properties || []);
  }

  function appendOwnerPayload(payload = {}) {
    const session = getSession() || {};
    if (!payload.ownerUserId) payload.ownerUserId = session.userId || '';
    if (!payload.ownerEmail) payload.ownerEmail = session.email || localStorage.getItem('mctHotelOwnerEmail') || '';
    return payload;
  }

  function init() {
    if (window.__MCT_HOTEL_MARKETPLACE_INIT__) return;
    window.__MCT_HOTEL_MARKETPLACE_INIT__ = true;
    fillSelects();
    updateRegistrationType();
    $('#hotelRegistrationType')?.addEventListener('change', updateRegistrationType);
    $('#hotelOwnerPassword')?.addEventListener('input', updatePasswordRules);
    $('#hotelOwnerConfirmPassword')?.addEventListener('input', updatePasswordRules);
    updatePasswordRules();
    if (document.querySelector('[data-hotel-panel-section="properties"]')) switchPanelTab('properties');
    loadPanelData();
    document.addEventListener('input', e => sanitizeInput(e.target));
    document.addEventListener('change', e => {
      sanitizeInput(e.target);
      if (e.target.matches('[data-preview-target]')) renderImagePreviews(e.target);
      if (e.target.matches('[data-map-url-input]')) updateMapPreview(e.target);
    });
    document.addEventListener('input', e => { if (e.target.matches('[data-map-url-input]')) updateMapPreview(e.target); });
    document.addEventListener('click', e => {
      const passwordToggle = e.target.closest('[data-toggle-password]');
      if (passwordToggle) return togglePassword(passwordToggle, e);
      const logout = e.target.closest('[data-hotel-logout]');
      if (logout) {
        e.preventDefault();
        clearSession();
        window.location.href = './login-admin-hotel.html';
        return;
      }
      const tab = e.target.closest('[data-hotel-panel-tab]');
      if (tab) switchPanelTab(tab.dataset.hotelPanelTab);
      const opener = e.target.closest('[data-open-market-modal]');
      if (opener) openModal(opener.dataset.openMarketModal);
      const editProperty = e.target.closest('[data-edit-property]');
      if (editProperty) {
        e.preventDefault();
        openModal('propertyModal', { mode: 'edit', propertyId: editProperty.dataset.editProperty });
        return;
      }
      const createRoomFor = e.target.closest('[data-create-room-for]');
      if (createRoomFor) {
        e.preventDefault();
        openModal('roomModal', { propertyId: createRoomFor.dataset.createRoomFor });
        return;
      }
      const currentLocation = e.target.closest('[data-use-current-location]');
      if (currentLocation) useCurrentLocation(currentLocation);
      if (e.target.closest('[data-close-market-modal]')) closeModal();
      const registerAgain = e.target.closest('[data-register-again]');
      if (registerAgain) {
        e.preventDefault();
        const success = registerAgain.closest('[data-register-success-panel]');
        const card = success?.closest('.hotel-marketplace-card');
        const form = card?.querySelector('#hotelOwnerRegisterForm');
        if (success) success.hidden = true;
        if (form) {
          form.hidden = false;
          form.reset();
          fillSelects();
          updateRegistrationType();
          updatePasswordRules();
          form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  }


  document.addEventListener('submit', async (event) => {
    const register = event.target.closest('#hotelOwnerRegisterForm');
    const login = event.target.closest('#hotelOwnerLoginForm');
    const marketForm = event.target.closest('[data-marketplace-form]');
    if (register) {
      event.preventDefault();
      if (!validateForm(register)) { showMsg('#hotelOwnerRegisterMsg', 'Revisa los campos marcados antes de enviar el registro.', false); return; }
      const payload = { ...serialize(register), publicBaseUrl: hotelPublicBaseUrl() };
      const result = await withUserLoading('Enviando registro...', event.submitter, () => post('register_owner', payload));
      if (!result.ok) { showMsg('#hotelOwnerRegisterMsg', result.error || 'No se pudo enviar el registro.', false); return; }
      if (result.emailWarning) {
        showMsg('#hotelOwnerRegisterMsg', 'Tu registro fue guardado, pero no se pudo enviar el correo de verificación. Revisa la autorización de MailApp en Apps Script y vuelve a enviar la verificación.', false);
        return;
      }
      showRegisterSuccess(register, 'Hemos enviado un correo de verificación a tu bandeja. Revisa ese correo para activar tu cuenta.');
    }
    if (login) {
      event.preventDefault();
      if (!validateForm(login)) { showMsg('#hotelOwnerLoginMsg', 'Ingresa un correo válido y tu contraseña.', false); return; }
      const payload = serialize(login);
      const result = await withUserLoading('Validando acceso...', event.submitter, () => post('login_owner', payload));
      if (!result.ok) { showMsg('#hotelOwnerLoginMsg', result.error || 'No se pudo iniciar sesión.', false); return; }
      if (result.owner && !statusIsAllowed(result.owner.status)) {
        showMsg('#hotelOwnerLoginMsg', 'Tu cuenta aún no está activa. Revisa el correo de verificación o espera la aprobación.', false);
        return;
      }
      setSession({ ...(result.owner || {}), sessionToken: result.sessionToken || '' });
      showMsg('#hotelOwnerLoginMsg', 'Acceso correcto. Redirigiendo al panel...');
      setTimeout(() => { window.location.href = './panel-admin-hotel.html'; }, 500);
    }
    if (marketForm) {
      event.preventDefault();
      if (!validateForm(marketForm)) { showMsg('#hotelPanelMsg', 'Revisa los campos obligatorios antes de guardar.', false); return; }
      const type = marketForm.dataset.marketplaceForm;
      const payload = appendOwnerPayload(serialize(marketForm));
      let action = type === 'property' ? (marketForm.dataset.mode === 'edit' ? 'update_property' : 'create_property') : type === 'room' ? 'create_room' : type === 'availability' ? 'block_dates' : type === 'account' ? 'update_owner' : type === 'password' ? 'change_password' : 'update_confirmation_mode';
      if (type === 'availability') payload.dates = dateRange(payload.from, payload.to);
      if (type === 'property') {
        const galleryCount = String(payload.galleryUrls || '').split('\n').map(v => v.trim()).filter(Boolean).length;
        const fileCount = marketForm.elements.photoFiles?.files?.length || 0;
        if ((galleryCount + fileCount) < 5) {
          showMsg('#hotelPanelMsg', 'Agrega mínimo 5 fotos del alojamiento o 5 URLs de galería antes de guardar.', false);
          return;
        }
        const urls = String(payload.galleryUrls || '').split('\n').map(v => v.trim()).filter(Boolean);
        payload.galleryJson = JSON.stringify(urls);
        payload.photoCount = fileCount;
      }
      if (type === 'room') {
        const urls = String(payload.roomGalleryUrls || '').split('\n').map(v => v.trim()).filter(Boolean);
        payload.roomGalleryJson = JSON.stringify(urls);
        payload.roomPhotoCount = marketForm.elements.roomPhotoFiles?.files?.length || 0;
      }
      const result = await withUserLoading('Guardando cambios...', event.submitter, () => post(action, payload));
      if (!result.ok) { showMsg('#hotelPanelMsg', result.error || 'No se pudo guardar.', false); return; }
      showMsg('#hotelPanelMsg', 'Cambios guardados correctamente.');
      if (type === 'property' || type === 'room') {
        marketForm.reset();
        resetPhotoPreview(marketForm);
        if (type === 'property') updateMapPreview(marketForm);
      }
      closeModal();
      if (type === 'account') {
        const current = getSession() || {};
        setSession({ ...current, ...payload });
        updateAccountView({ ...current, ...payload });
      }
      if (['property','room','confirmation'].includes(type)) loadPanelData();
    }
  });


  window.MCTHotelMarketplace = { init, togglePassword };
  document.addEventListener('DOMContentLoaded', init);
})();
