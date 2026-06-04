(() => {
  const SESSION_KEY = 'mct_agency_session';
  const LOCAL_ORDERS_KEY = 'mct_reservation_orders';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbycmduYce7cpGoMSqR3iqubsC46DiIox7qaNJXFFW8abQpr0s1SYCnYfyA2w95_vGYQ/exec?authuser=0';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const I18N = window.MCTAgenciesI18n || null;
  const t = (key, fallback = key, vars = null) => { const value = I18N?.t ? I18N.t(key, vars) : ''; return value && value !== key ? value : fallback; };
  const currentLocale = () => I18N?.lang || 'es';
  const readJSON = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  let orders = [];

  function requireSession() {
    const session = readJSON(SESSION_KEY, null);
    if (!session?.email) {
      window.location.href = './login.html';
      return null;
    }
    $('#ordersAgencyName').textContent = session.companyName || session.contactName || session.email || t('agency.affiliateDefault', 'Agencia afiliada');
    return session;
  }

  function isPeruvianAgency() {
    const session = readJSON(SESSION_KEY, {});
    const country = String(session.country || session.pais || '').trim().toUpperCase();
    return country === 'PE' || country === 'PERU' || country === 'PERÚ';
  }

  function paymentMethodFor(order) {
    const currency = String(order?.moneda || order?.currency || '').toUpperCase();
    return currency === 'USD' ? 'paypal' : 'mercadopago';
  }

  function getMercadoPagoDeviceId() {
    return String(window.MP_DEVICE_SESSION_ID || window.MP_DEVICE_SESSION_ID_PUBLIC || '').trim();
  }

  function paymentButtonLabel(order) {
    return paymentMethodFor(order) === 'paypal' ? t('agency.payWithPayPal', 'Pagar con PayPal') : t('agency.payBooking', 'Pagar reserva');
  }

  function money(amount, currency = 'PEN') {
    const n = Number(amount || 0);
    return currency === 'USD' ? `USD ${n.toFixed(2)}` : `S/ ${n.toFixed(2)}`;
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleString(currentLocale() === 'en' ? 'en-US' : 'es-PE', { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return escapeHtml(value);
    return d.toLocaleDateString(currentLocale() === 'en' ? 'en-US' : 'es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function normalizeStatus(order) {
    const raw = String(order.estadoPago || order.status || t('orders.pending', 'Pendiente')).toLowerCase();
    if (raw.includes('pag')) return 'pagado';
    if (raw.includes('venc')) return 'vencido';
    const due = order.fechaVencimientoPago || order.paymentDueAt || '';
    if (due && new Date(due).getTime() < Date.now()) return 'vencido';
    return 'pendiente';
  }

  function statusLabel(status) {
    return { pendiente: t('orders.pending', t('orders.pending', 'Pendiente')), vencido: t('orders.expired', 'Vencido'), pagado: t('orders.paid', 'Pagado') }[status] || t('orders.pending', t('orders.pending', 'Pendiente'));
  }

  function statusDateText(order, status) {
    if (status === 'vencido') return (currentLocale() === 'en' ? 'Expired: ' : 'Venció: ') + formatDateTime(order.fechaVencimientoPago || order.paymentDueAt);
    if (status === 'pagado') return order.fechaPagoPaypal ? ((currentLocale() === 'en' ? 'Paid: ' : 'Pagado: ') + formatDateTime(order.fechaPagoPaypal)) : (currentLocale() === 'en' ? 'Payment confirmed' : 'Pago confirmado');
    return (currentLocale() === 'en' ? 'Due: ' : 'Vence: ') + formatDateTime(order.fechaVencimientoPago || order.paymentDueAt);
  }

  function isExpiredMoreThanTwoDays(order) {
    const status = normalizeStatus(order);
    if (status === 'pagado') return false;
    const due = order.fechaVencimientoPago || order.paymentDueAt || '';
    const dueTime = due ? new Date(due).getTime() : 0;
    return dueTime && dueTime < Date.now() - (48 * 60 * 60 * 1000);
  }

  function parseJsonSafe(value, fallback) {
    if (Array.isArray(value) || (value && typeof value === 'object')) return value;
    try { return JSON.parse(value || ''); } catch { return fallback; }
  }

  function getOrderItems(order) {
    const items = parseJsonSafe(order.serviciosJson, order.items || []);
    return Array.isArray(items) ? items : [];
  }

  function getOrderPassengers(order) {
    const passengers = parseJsonSafe(order.pasajerosJson, order.passengers || []);
    return Array.isArray(passengers) ? passengers : [];
  }

  function getOrderLead(order) {
    const lead = parseJsonSafe(order.titularJson, order.lead || {});
    return lead && typeof lead === 'object' && !Array.isArray(lead) ? lead : {};
  }

  function compactServiceName(name = '') {
    const clean = String(name || t('agency.service', 'Servicio')).replace(/\s+/g, ' ').trim();
    return clean.split(' + ')[0].split(' - ')[0] || clean;
  }

  function servicesText(order) {
    const items = getOrderItems(order);
    if (!items.length) return `<span>${t('orders.noVisibleDetail', 'Sin detalle visible')}</span>`;
    return items.map((item) => {
      const name = item.serviceShortName || compactServiceName(item.serviceName || item.title || item.name || t('agency.service', 'Servicio'));
      return `<span class="service-line">${escapeHtml(name)} <small>(${Number(item.pax || 1)} PAXS)</small></span>`;
    }).join('');
  }

  function orderExchangeRate(order) {
    const rate = Number(order.tipoCambio || order.exchangeRate || 3.38);
    return rate > 0 ? rate : 3.38;
  }

  function itemUnitPrice(item, currency, order = {}) {
    const rate = orderExchangeRate(order);
    const pen = Number(item.unitPricePEN ?? item.pricePEN ?? 0);
    const usdRaw = item.unitPriceUSD ?? item.priceUSD;
    const usd = usdRaw !== null && usdRaw !== undefined && usdRaw !== '' ? Number(usdRaw) : null;

    if (currency === 'PEN') {
      if (pen) return pen;
      if (usd !== null) return usd * rate;
    }

    if (currency === 'USD') {
      if (usd !== null && usd) return usd;
      if (pen) return pen / rate;
    }

    if (item.price && typeof item.price === 'object') return Number(item.price.amount || 0);
    return Number(item.unitPrice || item.price || 0);
  }

  function normalizeItemLead(item, order) {
    return item.lead || getOrderLead(order) || {};
  }

  function normalizeItemPassengers(item) {
    if (Array.isArray(item.passengers)) return item.passengers;
    if (Array.isArray(item.tourists)) return item.tourists;
    return [];
  }

  async function fetchOrders(session) {
    const local = readJSON(LOCAL_ORDERS_KEY, []);
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'listOrders', email: session.email, agencyId: session.agencyId })
      });
      const result = await response.json();
      if (result.ok && Array.isArray(result.orders)) return result.orders;
    } catch (error) {
      console.warn('No se pudieron cargar órdenes desde Google Sheets', error);
    }
    return local;
  }

  function renderOrders() {
    const filter = $('#statusFilter').value;
    const visibleOrders = orders.filter((order) => !isExpiredMoreThanTwoDays(order));
    const filtered = visibleOrders.filter((order) => !filter || normalizeStatus(order) === filter || normalizeStatus(order).includes(filter));
    $('#ordersCount').textContent = filtered.length;
    const total = document.querySelector('.toolbar-total');
    if (currentLocale() === 'en' && total) total.innerHTML = `<span id="ordersCount">${filtered.length}</span> ${filtered.length === 1 ? t('orders.orderSingular', 'order') : t('orders.orderPlural', 'orders')}`;
    if (!filtered.length) {
      $('#ordersMessage').hidden = false;
      $('#ordersMessage').textContent = t('orders.noOrders', 'No hay órdenes para mostrar con este filtro.');
      $('#ordersTableWrap').hidden = true;
      return;
    }
    $('#ordersMessage').hidden = true;
    $('#ordersTableWrap').hidden = false;
    $('#ordersTableBody').innerHTML = filtered.map((order) => {
      const index = orders.indexOf(order);
      const status = normalizeStatus(order);
      const total = order.montoComisionado || order.total || 0;
      const currency = order.moneda || order.currency || 'PEN';
      const code = String(order.codigoOrden || order.code || '').replace(/[^A-Za-z0-9]/g, '');
      return `
        <tr>
          <td class="order-code-cell"><strong>${escapeHtml(code)}</strong></td>
          <td class="order-date-cell">${formatDateTime(order.fechaOrden || order.createdAt)}</td>
          <td><span class="status-pill is-${status}">${statusLabel(status)}</span></td>
          <td class="order-services-cell">${servicesText(order)}</td>
          <td class="order-total-cell"><strong>${money(total, currency)}</strong></td>
          <td class="order-action-cell">
            <button type="button" class="agency-button agency-button--primary agency-button--small order-detail-button" data-order-detail="${index}">${t('orders.viewDetails', 'Ver detalles')}</button>
          </td>
        </tr>`;
    }).join('');
    $$('[data-order-detail]').forEach((button) => {
      button.addEventListener('click', () => openOrderDetail(Number(button.dataset.orderDetail)));
    });
  }

  function passengersList(passengers) {
    if (!passengers.length) return `<li>${t('agency.noAdditionalData', 'Datos adicionales pendientes.')}</li>`;
    return passengers.map((p, index) => {
      const name = [p.firstName || p.first || p.nombres, p.lastName || p.last || p.apellidos].filter(Boolean).join(' ');
      const doc = [p.docType || p.tipoDocumento, p.docNumber || p.doc || p.numeroDocumento].filter(Boolean).join(' ');
      return `<li>${t('agency.passenger', 'Pasajero')} ${index + 2}: ${escapeHtml(name || t('agency.namePending', 'Nombre pendiente'))}${doc ? ` · ${escapeHtml(doc)}` : ''}</li>`;
    }).join('');
  }

  function orderItemsRows(order) {
    const items = getOrderItems(order);
    const currency = order.moneda || order.currency || 'PEN';
    if (!items.length) {
      const lead = getOrderLead(order);
      const allPassengers = getOrderPassengers(order);
      return `<tr><td colspan="5">${t('orders.noServiceDetail', 'No se encontró detalle de servicios en esta orden.')}</td></tr>
        <tr class="order-passenger-row"><td></td><td colspan="4"><strong>${t('agency.lead', 'Titular')}:</strong> ${escapeHtml([lead.firstName || lead.first, lead.lastName || lead.last].filter(Boolean).join(' ') || t('orders.pending', 'Pendiente'))}<br><strong>${t('agency.additionalPassengers', 'Pasajeros')}:</strong><ul>${passengersList(allPassengers)}</ul></td></tr>`;
    }
    return items.map((item, index) => {
      const lead = normalizeItemLead(item, order);
      const passengers = normalizeItemPassengers(item);
      const pax = Number(item.pax || item.passengersCount || 1);
      const unit = itemUnitPrice(item, currency, order);
      const amount = Number(item.subtotal || (unit * pax) || 0);
      const pickup = item.pickupPoint || item.pickup || item.hotel || '';
      const notes = item.notes || item.observations || '';
      const leadName = [lead.firstName || lead.first || lead.nombres, lead.lastName || lead.last || lead.apellidos].filter(Boolean).join(' ');
      const leadDoc = [lead.docType || lead.tipoDocumento, lead.docNumber || lead.doc || lead.numeroDocumento].filter(Boolean).join(' ');
      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(item.serviceName || item.title || item.name || t('agency.service', 'Servicio'))}</strong><br>
            <small>${t('agency.date', 'Fecha')}: ${formatDate(item.travelDate || item.date || '')} · ${t('agency.time', 'Hora')}: ${escapeHtml(item.serviceTime || item.time || t('agency.confirm', 'Por confirmar'))}</small><br>
            <small>${t('agency.pickup', 'Recojo')}: ${escapeHtml(pickup || t('agency.confirm', 'Por confirmar'))}</small>
          </td>
          <td>${pax}</td>
          <td>${money(unit, currency)}</td>
          <td><strong>${money(amount, currency)}</strong></td>
        </tr>
        <tr class="order-passenger-row">
          <td></td>
          <td colspan="4">
            <strong>${t('agency.leadData', 'Datos del titular')}:</strong> ${escapeHtml(leadName || t('orders.pending', 'Pendiente'))} ${leadDoc ? `· ${escapeHtml(leadDoc)}` : ''} ${lead.phone ? `· ${escapeHtml(lead.phone)}` : ''}<br>
            <strong>${t('agency.pickup', 'Lugar de recojo')}:</strong> ${escapeHtml(pickup || t('agency.confirm', 'Por confirmar'))}<br>
            <strong>${t('agency.additionalPassengers', 'Pasajeros adicionales')}:</strong><ul>${passengersList(passengers)}</ul>
            ${notes ? `<strong>${t('agency.observations', 'Observaciones')}:</strong> ${escapeHtml(notes)}` : ''}
          </td>
        </tr>`;
    }).join('');
  }

  function orderDetailHTML(order) {
    const currency = order.moneda || order.currency || 'PEN';
    const code = String(order.codigoOrden || order.code || '').replace(/[^A-Za-z0-9]/g, '');
    const statusKey = normalizeStatus(order);
    const status = statusLabel(statusKey);
    const agencyName = order.agenciaNombre || order.account?.companyName || $('#ordersAgencyName')?.textContent || t('agency.affiliateDefault', 'Agencia afiliada');
    return `
      <div id="orderPrintArea" class="order-print-area">
        <div class="print-order-head">
          <div class="print-order-logo-row print-only">
            <img src="../assets/img/logos/Logo1.png" alt="My Cusco Trip" class="print-order-logo" onerror="this.style.display='none'">
          </div>
          <div class="print-order-title-row">
            <div>
              <p class="eyebrow">${t('orders.orderCode', 'Código de orden')}</p>
              <h2>${escapeHtml(code)}</h2>
              <p>${t('agency.agency', 'Agencia')}: <strong>${escapeHtml(agencyName)}</strong></p>
            </div>
            <div class="print-order-status is-${statusKey}">
              <span>${escapeHtml(status)}</span>
              <small>${escapeHtml(statusDateText(order, statusKey))}</small>
            </div>
          </div>
        </div>
        <div class="info-note"><strong>${t('orders.important', 'Importante')}:</strong> ${t('orders.importantText', 'revisa los datos de titulares, pasajeros y recojos antes de realizar el pago. Las órdenes pendientes se confirman con pago validado dentro del plazo indicado.')}</div>
        <div class="order-table-wrap">
          <table class="order-table">
            <thead><tr><th>#</th><th>${t('orders.servicePickup', 'Servicio / recojo')}</th><th>Pax</th><th>${t('agency.rate', 'Tarifa')}</th><th>Subtotal</th></tr></thead>
            <tbody>${orderItemsRows(order)}</tbody>
          </table>
        </div>
        <div class="order-totals">
          <div><span>${t('agency.subtotalLabel', 'Servicios + tickets de ingreso')}</span><strong>${money(order.subtotalNeto || order.subtotal || 0, currency)}</strong></div>
          <div><span>${t('agency.feesLabel', 'Comisiones PayPal + banco')}</span><strong>${money(order.comisionPaypalBanco || order.fee || 0, currency)}</strong></div>
          <div class="grand"><span>${t('agency.totalLabel', 'Total a pagar')}</span><strong>${money(order.montoComisionado || order.total || 0, currency)}</strong></div>
        </div>
        ${order.observaciones || order.observations ? `<p class="small-print-note"><strong>${t('orders.generalNotes', 'Observaciones generales')}:</strong> ${escapeHtml(order.observaciones || order.observations)}</p>` : ''}
      </div>
      <div class="dialog-actions order-modal-actions">
        <button type="button" class="agency-button agency-button--ghost" data-close-order-detail>${t('agency.close', 'Cerrar')}</button>
        <button type="button" class="agency-button paypal-button" id="payOrderWithPayPalButton" data-order-code="${escapeHtml(code)}">${paymentButtonLabel(order)}</button>
        <button type="button" class="agency-button agency-button--primary" id="printOrderDetailButton">${t('agency.printOrder', 'Imprimir orden')}</button>
      </div>`;
  }

  function openOrderDetail(index) {
    const order = orders[index];
    if (!order) return;
    $('#orderDetailBody').innerHTML = orderDetailHTML(order);
    $('#orderDetailModal').classList.add('show');
    $('[data-close-order-detail]')?.addEventListener('click', closeOrderDetail);
    $('#printOrderDetailButton')?.addEventListener('click', printOrderDetail);
    $('#payOrderWithPayPalButton')?.addEventListener('click', () => startPayPalPayment(order));
  }

  function closeOrderDetail() {
    $('#orderDetailModal').classList.remove('show');
  }



  async function startPayPalPayment(order) {
    const status = normalizeStatus(order);
    if (status === 'pagado') { alert(t('orders.alreadyPaid', 'Esta orden ya figura como pagada.')); return; }
    if (status === 'vencido') { alert(t('orders.expiredAlert', 'Esta orden está vencida. Genera una nueva orden o consulta disponibilidad.')); return; }

    const method = paymentMethodFor(order);
    const button = $('#payOrderWithPayPalButton');
    const loadingText = method === 'paypal' ? t('agency.connectPayPal', 'Conectando con PayPal...') : t('agency.connectMP', 'Conectando con Mercado Pago...');
    if (button) { button.disabled = true; button.textContent = loadingText; }
    try {
      const code = String(order.codigoOrden || order.code || '').replace(/[^A-Za-z0-9]/g, '');
      const action = method === 'paypal' ? 'createPayPalOrder' : 'createMercadoPagoPreference';
      const result = await sendToSheet(action, {
        code,
        currency: order.moneda || order.currency || (method === 'paypal' ? 'USD' : 'PEN'),
        total: Number(order.montoComisionado || order.total || 0),
        account: readJSON(SESSION_KEY, {}),
        deviceId: method === 'mercadopago' ? getMercadoPagoDeviceId() : ''
      });
      const redirectUrl = method === 'paypal' ? result.approvalUrl : result.initPoint;
      if (!result.ok || !redirectUrl) {
        alert(result.message || (method === 'paypal' ? t('orders.paypalCreateError', 'No se pudo crear el pago en PayPal.') : t('orders.mpCreateError', 'No se pudo crear el pago en Mercado Pago.')));
        return;
      }
      window.location.href = redirectUrl;
    } catch (error) {
      console.error(error);
      alert(method === 'paypal' ? t('orders.paypalConnectError', 'No se pudo conectar con PayPal.') : t('orders.mpConnectError', 'No se pudo conectar con Mercado Pago.'));
    } finally {
      if (button) { button.disabled = false; button.textContent = paymentButtonLabel(order); }
    }
  }

  async function sendToSheet(action, payload) {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    const text = await response.text();
    try { return JSON.parse(text); } catch { return { ok:false, message:t('orders.invalidResponse', 'Respuesta no válida de Apps Script.') }; }
  }

  function printOrderDetail() {
    document.body.classList.add('printing-order');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-order'), 600);
  }

  async function init() {
    const session = requireSession();
    if (!session) return;
    orders = await fetchOrders(session);
    renderOrders();
    I18N?.apply?.();
    $('#statusFilter').addEventListener('change', renderOrders);
    $('#refreshOrdersButton').addEventListener('click', async () => { orders = await fetchOrders(session); renderOrders(); });
    $('#orderDetailModal')?.addEventListener('click', (event) => { if (event.target.id === 'orderDetailModal') closeOrderDetail(); });
    $$('[data-close-order-detail-static]').forEach((button) => button.addEventListener('click', closeOrderDetail));
  }

  init();
})();
