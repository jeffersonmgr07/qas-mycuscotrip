(() => {
  const STORAGE = {
    SESSION: 'mct_agency_session',
    CART: 'mct_reservation_cart',
    ORDERS: 'mct_reservation_orders'
  };

  const CONFIG = {
    catalogUrl: './assets/data/agencias-tours.json',
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbz38yAU-vEt5Joe8NQjDRFsEIOqgDIv-w99YHI5sLbO03rKCt-dwAH10j0A92pyOAEx/exec', // Pega aquí la URL de despliegue de Google Apps Script.
    paypalRate: 0.054,
    bankRate: 0.015,
    defaultExchangeRate: 3.38
  };

  const state = {
    session: null,
    services: [],
    cart: readJSON(STORAGE.CART, []),
    orders: readJSON(STORAGE.ORDERS, []),
    currency: localStorage.getItem('mct_visible_currency') || 'PEN',
    exchangeRate: Number(localStorage.getItem('mct_exchange_rate') || CONFIG.defaultExchangeRate)
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  function readJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
  const writeJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

  function money(amount, currency = state.currency) {
    const n = Number(amount || 0);
    return currency === 'USD' ? `USD ${n.toFixed(2)}` : `S/ ${n.toFixed(2)}`;
  }

  function convert(amountPEN, serviceCurrency = 'PEN', serviceUSD = null) {
    if (state.currency === 'PEN') {
      if (serviceCurrency === 'USD' && serviceUSD != null) return Number(serviceUSD) * state.exchangeRate;
      return Number(amountPEN || 0);
    }
    if (serviceCurrency === 'USD' && serviceUSD != null) return Number(serviceUSD);
    return Number(amountPEN || 0) / state.exchangeRate;
  }

  function servicePrice(service) {
    return convert(service.pricePEN, service.currency, service.priceUSD);
  }

  function serviceAltPrice(service) {
    if (!service.priceAltPEN) return null;
    return state.currency === 'USD' ? Number(service.priceAltPEN) / state.exchangeRate : Number(service.priceAltPEN);
  }

  function requireSession() {
    const session = readJSON(STORAGE.SESSION, null);
    if (!session?.email) {
      window.location.href = './login.html';
      return null;
    }
    state.session = session;
    return session;
  }

  async function init() {
    const session = requireSession();
    if (!session) return;

    $('#sessionWelcome').textContent = `Bienvenido, ${session.companyName || session.contactName || 'agencia afiliada'}`;
    $('#currencySelect').value = state.currency;
    if ($('#exchangeRateInput')) $('#exchangeRateInput').value = state.exchangeRate.toFixed(2);
    $('#serviceDate').min = todayISO();
    $('#serviceDate').value = todayISO();

    bindEvents();
    await loadCatalog();
    renderExperiences();
    renderCart();
    renderOrders();
  }

  async function loadCatalog() {
    try {
      const response = await fetch(CONFIG.catalogUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('catalog');
      const data = await response.json();
      state.services = Array.isArray(data.services) ? data.services : [];
      if (data.exchangeRate && !localStorage.getItem('mct_exchange_rate')) {
        state.exchangeRate = Number(data.exchangeRate);
        if ($('#exchangeRateInput')) $('#exchangeRateInput').value = state.exchangeRate.toFixed(2);
      }
    } catch (error) {
      $('#emptyExperiences').hidden = false;
      $('#emptyExperiences').textContent = 'No se pudo cargar el catálogo de experiencias. Revisa la ruta agencias/assets/data/agencias-tours.json.';
    }
  }

  function bindEvents() {
    $('#searchInput').addEventListener('input', renderExperiences);
    $('#currencySelect').addEventListener('change', (event) => {
      state.currency = event.target.value;
      localStorage.setItem('mct_visible_currency', state.currency);
      renderExperiences(); renderCart();
    });
    $('#exchangeRateInput')?.addEventListener('input', (event) => {
      state.exchangeRate = Number(event.target.value || CONFIG.defaultExchangeRate);
      localStorage.setItem('mct_exchange_rate', state.exchangeRate);
      renderExperiences(); renderCart();
    });
    $('#printButton').addEventListener('click', () => window.print());
    $('#paxCount').addEventListener('input', renderAdditionalPassengers);
    $('#reserveForm').addEventListener('submit', addToCart);
    $('#paypalFeeToggle').addEventListener('change', renderCart);
    $('#clearCartButton').addEventListener('click', clearCart);
    $('#generateOrderButton').addEventListener('click', generateOrder);
    $$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeModals));
    $$('.modal-backdrop').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModals(); }));
  }

  function renderExperiences() {
    const q = $('#searchInput').value.trim().toLowerCase();
    const filtered = state.services.filter((service) => {
      const text = [service.name, service.shortName, service.category, service.description, service.startLabel].join(' ').toLowerCase();
      return !q || text.includes(q);
    });
    $('#emptyExperiences').hidden = filtered.length > 0;
    $('#experienceGrid').innerHTML = filtered.map(serviceCard).join('');
    $$('[data-reserve]').forEach((button) => button.addEventListener('click', () => openReserve(button.dataset.reserve)));
    $$('[data-itinerary]').forEach((button) => button.addEventListener('click', () => openItinerary(button.dataset.itinerary)));
  }

  function serviceCard(service) {
    const price = servicePrice(service);
    const alt = serviceAltPrice(service);
    const unit = service.priceUnit || 'por persona';
    const altHtml = alt ? `<small>${money(alt)} ${escapeHtml(service.priceAltLabel || '')}</small>` : '';
    return `
      <article class="experience-card">
        <img class="experience-cover" src="${escapeHtml(service.image || '../assets/img/placeholder/experience.jpg')}" alt="${escapeHtml(service.name)}" onerror="this.src='../assets/img/placeholder/experience.jpg'" />
        <div class="experience-body">
          <div class="badges"><span class="badge">${escapeHtml(service.category || 'Cusco')}</span><span class="badge">${escapeHtml(service.frequency || 'Salida diaria')}</span></div>
          <h3>${escapeHtml(service.name)}</h3>
          <p class="experience-desc">${escapeHtml(service.description || '')}</p>
          <table class="mini-table">
            <tr><td>Horario</td><td>${escapeHtml(service.startLabel || '')}</td></tr>
            <tr><td>Duración</td><td>${escapeHtml(service.durationLabel || '')}</td></tr>
            <tr><td>Precio</td><td><span class="price">${money(price)}<small>${escapeHtml(unit)}</small>${altHtml}</span></td></tr>
            <tr><td>Entradas</td><td>${escapeHtml(service.notIncluded || 'Consultar según experiencia.')}</td></tr>
          </table>
        </div>
        <div class="card-actions">
          <button type="button" class="agency-button agency-button--primary" data-reserve="${escapeHtml(service.id)}">Reservar</button>
          <button type="button" class="agency-button agency-button--ghost" data-itinerary="${escapeHtml(service.id)}">Ver itinerario</button>
        </div>
      </article>
    `;
  }

  function findService(id) { return state.services.find((service) => service.id === id); }

  function openReserve(id) {
    const service = findService(id);
    if (!service) return;
    $('#selectedServiceId').value = id;
    $('#reserveTitle').textContent = `Reservar · ${service.name}`;
    $('#reserveForm').reset();
    $('#serviceDate').min = todayISO();
    $('#serviceDate').value = todayISO();
    $('#paxCount').value = 2;
    renderAdditionalPassengers();
    $('#reserveModal').classList.add('show');
  }

  function renderAdditionalPassengers() {
    const pax = Math.max(1, Number($('#paxCount').value || 1));
    const box = $('#additionalPassengers');
    box.innerHTML = '';
    for (let i = 2; i <= pax; i++) {
      box.insertAdjacentHTML('beforeend', `
        <div class="passenger-extra" data-passenger-extra>
          <strong>Pasajero ${i}</strong>
          <div class="form-grid">
            <label class="field"><span>Nombres</span><input data-pax="firstName" /></label>
            <label class="field"><span>Apellidos</span><input data-pax="lastName" /></label>
            <label class="field"><span>Tipo de documento</span><select data-pax="docType"><option>DNI</option><option>Pasaporte</option><option>Carnet de extranjería</option><option>Otro</option></select></label>
            <label class="field"><span>Número de documento</span><input data-pax="docNumber" /></label>
          </div>
        </div>
      `);
    }
  }

  function addToCart(event) {
    event.preventDefault();
    const form = $('#reserveForm');
    if (!form.reportValidity()) return;
    const service = findService($('#selectedServiceId').value);
    if (!service) return;
    const pax = Math.max(1, Number($('#paxCount').value || 1));
    const passengers = $$('[data-passenger-extra]').map((card) => ({
      firstName: $('[data-pax="firstName"]', card).value.trim(),
      lastName: $('[data-pax="lastName"]', card).value.trim(),
      docType: $('[data-pax="docType"]', card).value,
      docNumber: $('[data-pax="docNumber"]', card).value.trim()
    })).filter((p) => p.firstName || p.lastName || p.docNumber);

    const item = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      serviceId: service.id,
      serviceName: service.name,
      travelDate: $('#serviceDate').value,
      pax,
      unitPricePEN: Number(service.pricePEN || 0),
      unitPriceUSD: service.priceUSD != null ? Number(service.priceUSD) : null,
      serviceCurrency: service.currency || 'PEN',
      priceUnit: service.priceUnit || 'por persona',
      lead: {
        firstName: $('#leadFirstName').value.trim(),
        lastName: $('#leadLastName').value.trim(),
        docType: $('#leadDocType').value,
        docNumber: $('#leadDocNumber').value.trim(),
        phone: `${$('#leadPhoneCountry')?.value || ''} ${$('#leadPhone').value.trim()}`.trim()
      },
      groupMode: $('#groupMode').value,
      pickupPoint: $('#pickupPoint').value.trim(),
      notes: $('#bookingNotes').value.trim(),
      passengers
    };
    state.cart.push(item);
    writeJSON(STORAGE.CART, state.cart);
    closeModals();
    renderCart();
    $('#checkout').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function itemSubtotal(item) {
    const service = findService(item.serviceId) || {};
    return convert(item.unitPricePEN, item.serviceCurrency, item.unitPriceUSD) * item.pax;
  }

  function feeGross(subtotal) {
    if (!$('#paypalFeeToggle').checked || subtotal <= 0) return { total: subtotal, fee: 0 };
    const total = subtotal / (1 - CONFIG.paypalRate - CONFIG.bankRate);
    return { total, fee: total - subtotal };
  }

  function renderCart() {
    const wrap = $('#cartItems');
    if (!state.cart.length) {
      wrap.innerHTML = '<p class="cart-empty">Todavía no agregaste servicios.</p>';
    } else {
      wrap.innerHTML = state.cart.map((item, index) => `
        <article class="cart-item">
          <strong>${escapeHtml(item.serviceName)}</strong>
          <div class="cart-row"><span>Fecha</span><span>${formatDate(item.travelDate)}</span></div>
          <div class="cart-row"><span>Pasajeros</span><span>${item.pax}</span></div>
          <div class="cart-row"><span>Titular</span><span>${escapeHtml(item.lead.firstName)} ${escapeHtml(item.lead.lastName)}</span></div>
          <div class="cart-row"><span>Subtotal</span><strong>${money(itemSubtotal(item))}</strong></div>
          <button type="button" class="agency-button agency-button--ghost agency-button--small" data-remove="${index}">Quitar</button>
        </article>
      `).join('');
    }
    $$('[data-remove]').forEach((button) => button.addEventListener('click', () => removeItem(Number(button.dataset.remove))));
    const subtotal = state.cart.reduce((sum, item) => sum + itemSubtotal(item), 0);
    const { total, fee } = feeGross(subtotal);
    $('#subtotalAmount').textContent = money(subtotal);
    $('#feeAmount').textContent = money(fee);
    $('#grandTotal').textContent = money(total);
    $('#toolbarCount').textContent = state.cart.length;
    $('#toolbarTotal').textContent = money(total);
  }

  function removeItem(index) {
    state.cart.splice(index, 1);
    writeJSON(STORAGE.CART, state.cart);
    renderCart();
  }

  function clearCart() {
    state.cart = [];
    writeJSON(STORAGE.CART, state.cart);
    $('#orderBox').classList.remove('show');
    $('#orderBox').innerHTML = '';
    renderCart();
  }

  async function generateOrder() {
    if (!state.cart.length) { alert('Agrega al menos un servicio a tu orden.'); return; }
    const subtotal = state.cart.reduce((sum, item) => sum + itemSubtotal(item), 0);
    const { total, fee } = feeGross(subtotal);
    const order = {
      code: makeCode(),
      createdAt: new Date().toISOString(),
      status: 'Pendiente de pago',
      currency: state.currency,
      exchangeRate: state.exchangeRate,
      subtotal: Number(subtotal.toFixed(2)),
      fee: Number(fee.toFixed(2)),
      total: Number(total.toFixed(2)),
      paypalBankFeeApplied: $('#paypalFeeToggle').checked,
      account: state.session,
      items: state.cart
    };
    state.orders.unshift(order);
    writeJSON(STORAGE.ORDERS, state.orders);
    await sendToSheet('createOrder', order);
    $('#orderBox').classList.add('show');
    $('#orderBox').innerHTML = `
      <h3>Orden generada</h3>
      <p>Código de referencia:</p>
      <div class="order-code">${escapeHtml(order.code)}</div>
      <p>Usa este código al coordinar el pago o enviar el comprobante.</p>
      <p><strong>Total:</strong> ${money(order.total)}</p>
      <button type="button" class="agency-button agency-button--primary" onclick="window.print()">Imprimir orden</button>
    `;
    state.cart = [];
    writeJSON(STORAGE.CART, state.cart);
    renderCart();
    renderOrders();
  }

  async function sendToSheet(action, payload) {
    if (!CONFIG.googleScriptUrl || CONFIG.googleScriptUrl.includes('PEGA_AQUI')) return { ok:false, message:'Falta configurar Google Apps Script.' };
    try {
      const response = await fetch(CONFIG.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, payload })
      });
      const text = await response.text();
      try { return JSON.parse(text); } catch { return { ok:true, message:'Solicitud enviada' }; }
    } catch (error) {
      console.warn('No se pudo enviar a Google Sheets', error);
      return { ok:false, message:error.message };
    }
  }

  function renderOrders() {
    const list = $('#ordersList');
    if (!state.orders.length) {
      list.innerHTML = '<p class="empty-state">Todavía no se generaron órdenes en este navegador.</p>';
      return;
    }
    list.innerHTML = state.orders.slice(0, 12).map((order) => `
      <article class="request-card">
        <strong>${escapeHtml(order.code)}</strong>
        <p>${formatDate(order.createdAt.slice(0, 10))} · ${order.items.length} servicio(s) · ${money(order.total, order.currency)}</p>
        <span class="agency-chip">${escapeHtml(order.status)}</span>
      </article>
    `).join('');
  }

  async function openItinerary(id) {
    const service = findService(id);
    if (!service) return;
    $('#itineraryTitle').textContent = service.name;
    $('#itineraryBody').innerHTML = '<p class="dialog-help">Cargando itinerario detallado...</p>';
    $('#itineraryModal').classList.add('show');

    const item = await findItineraryItem(service);
    const includes = item?.includes || service.includes || [];
    const itinerary = item?.itinerary || item?.timeline || [];
    const description = item?.description || item?.shortDescription || service.description || '';
    $('#itineraryBody').innerHTML = `
      <p class="experience-desc">${escapeHtml(description)}</p>
      ${includes.length ? `<h3>Incluye</h3><ul class="include-list">${includes.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}
      ${itinerary.length ? `<h3>Itinerario</h3><div class="itinerary-list">${itinerary.map((step, i) => itineraryStep(step, i)).join('')}</div>` : `<div class="info-note"><strong>Detalle:</strong> ${escapeHtml(service.description || '')}</div>`}
      <div class="dialog-actions"><button type="button" class="agency-button agency-button--primary" data-reserve-from-itinerary="${escapeHtml(service.id)}">Reservar esta experiencia</button></div>
    `;
    $('[data-reserve-from-itinerary]')?.addEventListener('click', () => { closeModals(); openReserve(service.id); });
  }

  function itineraryStep(step, index) {
    if (typeof step === 'string') return `<div class="itinerary-step"><strong>Paso ${index + 1}</strong><p>${escapeHtml(step)}</p></div>`;
    return `<div class="itinerary-step"><strong>${escapeHtml(step.title || `Paso ${index + 1}`)}</strong><p>${escapeHtml(step.description || step.text || '')}</p></div>`;
  }

  async function findItineraryItem(service) {
    const sources = Array.isArray(service.jsonSources) ? service.jsonSources : ['../assets/data/agencias-tours.json'];
    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: 'no-store' });
        if (!response.ok) continue;
        const data = await response.json();
        const list = normalizeList(data);
        const item = list.find((x) => [x.id, x.slug, x.internalCode].includes(service.id) || [x.id, x.slug, x.internalCode].includes(service.slug));
        if (item) return item;
      } catch (error) { /* continue */ }
    }
    return null;
  }

  function normalizeList(data) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data !== 'object') return [];
    for (const key of ['services', 'tours', 'items', 'experiences', 'packages']) {
      if (Array.isArray(data[key])) return data[key];
    }
    return Object.values(data).flatMap((value) => Array.isArray(value) ? value : []);
  }

  function closeModals() { $$('.modal-backdrop').forEach((modal) => modal.classList.remove('show')); }

  function makeCode() {
    const d = new Date();
    const date = d.toISOString().slice(2, 10).replace(/-/g, '');
    return `MCT-${date}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  init();
})();
