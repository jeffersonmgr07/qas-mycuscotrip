(() => {
  const DATA_URL = './assets/data/hotels.json';
  const state = {
    destinations: {},
    hotels: [],
    activeHotel: null,
    activeSearch: null,
    activeRoom: null,
    activeGuest: null,
    accommodations: [],
    galleryIndex: 0,
    calendarMonth: null,
    heroCalendarMonth: null,
    paypalRenderedFor: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const money = (amount, currency = 'USD') => `${currency === 'PEN' ? 'S/' : '$'} ${Number(amount || 0).toFixed(2)}`;
  const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const asset = (path) => String(path || './assets/img/placeholder/experience.jpg').replace(/^\.\//, './');
  const toTitleCase = (value = '') => String(value)
    .toLocaleLowerCase('es-PE')
    .replace(/(^|[\s/\-])([\p{L}])/gu, (match, sep, letter) => `${sep}${letter.toLocaleUpperCase('es-PE')}`);
  const lettersOnlyRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'´-]+$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const alphanumericDocRegex = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\-_.]+$/;
  const sanitizeLetters = (value = '') => String(value).replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'´-]/g, '').replace(/\s{2,}/g, ' ');
  const sanitizeDigits = (value = '') => String(value).replace(/\D/g, '');
  const sanitizeDoc = (value = '', type = '') => type === 'DNI'
    ? sanitizeDigits(value).slice(0, 8)
    : String(value).replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ\-_.]/g, '').slice(0, 24);


  const VISIBLE_DESTINATIONS = [
    { value: 'all', label: 'Todos los destinos', keys: null },
    { value: 'cusco', label: 'Cusco', keys: ['cusco'] },
    { value: 'aguas-calientes', label: 'Aguas Calientes', keys: ['aguas-calientes'] },
    { value: 'lima', label: 'Lima', keys: ['lima'] },
    { value: 'paracas-ica', label: 'Paracas / Ica', keys: ['paracas', 'ica'] },
    { value: 'arequipa', label: 'Arequipa', keys: ['arequipa'] },
    { value: 'puno', label: 'Puno', keys: ['puno'] },
    { value: 'uyuni', label: 'Uyuni', keys: ['uyuni'] },
  ];

  const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  const COUNTRIES = ['Perú','Argentina','Bolivia','Brasil','Canadá','Chile','Colombia','Costa Rica','Cuba','Ecuador','El Salvador','España','Estados Unidos','Francia','Alemania','Italia','México','Países Bajos','Panamá','Paraguay','Reino Unido','Uruguay','Venezuela','Afganistán','Albania','Andorra','Angola','Antigua y Barbuda','Arabia Saudita','Argelia','Armenia','Australia','Austria','Azerbaiyán','Bahamas','Bangladés','Barbados','Bélgica','Belice','Benín','Bielorrusia','Bosnia y Herzegovina','Botsuana','Brunéi','Bulgaria','Burkina Faso','Burundi','Bután','Cabo Verde','Camboya','Camerún','Catar','Chad','China','Chipre','Ciudad del Vaticano','Comoras','Congo','Corea del Norte','Corea del Sur','Costa de Marfil','Croacia','Dinamarca','Dominica','Egipto','Emiratos Árabes Unidos','Eslovaquia','Eslovenia','Estonia','Etiopía','Filipinas','Finlandia','Fiyi','Gabón','Gambia','Georgia','Ghana','Granada','Grecia','Guatemala','Guinea','Guinea-Bisáu','Guinea Ecuatorial','Guyana','Haití','Honduras','Hungría','India','Indonesia','Irak','Irán','Irlanda','Islandia','Israel','Jamaica','Japón','Jordania','Kazajistán','Kenia','Kirguistán','Kiribati','Kuwait','Laos','Lesoto','Letonia','Líbano','Liberia','Libia','Liechtenstein','Lituania','Luxemburgo','Macedonia del Norte','Madagascar','Malasia','Malaui','Maldivas','Malí','Malta','Marruecos','Mauricio','Mauritania','Micronesia','Moldavia','Mónaco','Mongolia','Montenegro','Mozambique','Myanmar','Namibia','Nauru','Nepal','Nicaragua','Níger','Nigeria','Noruega','Nueva Zelanda','Omán','Pakistán','Palaos','Palestina','Papúa Nueva Guinea','Polonia','Portugal','República Centroafricana','República Checa','República Democrática del Congo','República Dominicana','Ruanda','Rumanía','Rusia','Samoa','San Cristóbal y Nieves','San Marino','San Vicente y las Granadinas','Santa Lucía','Santo Tomé y Príncipe','Senegal','Serbia','Seychelles','Sierra Leona','Singapur','Siria','Somalia','Sri Lanka','Suazilandia','Sudáfrica','Sudán','Sudán del Sur','Suecia','Suiza','Surinam','Tailandia','Tanzania','Tayikistán','Timor Oriental','Togo','Tonga','Trinidad y Tobago','Túnez','Turkmenistán','Turquía','Tuvalu','Ucrania','Uganda','Uzbekistán','Vanuatu','Vietnam','Yemen','Yibuti','Zambia','Zimbabue'];
  const PHONE_CODES = [
    ['+51','PE'], ['+1','US/CA'], ['+54','AR'], ['+591','BO'], ['+55','BR'], ['+56','CL'], ['+57','CO'], ['+506','CR'], ['+593','EC'], ['+503','SV'], ['+34','ES'], ['+52','MX'], ['+507','PA'], ['+595','PY'], ['+44','UK'], ['+598','UY'], ['+58','VE'], ['+33','FR'], ['+49','DE'], ['+39','IT'], ['+31','NL'], ['+81','JP'], ['+86','CN'], ['+61','AU']
  ];
  const countryOptions = (selected = 'Perú') => COUNTRIES.map((country) => `<option value="${escapeHtml(country)}" ${country === selected ? 'selected' : ''}>${escapeHtml(country)}</option>`).join('');
  const phoneOptions = (selected = '+51') => PHONE_CODES.map(([code, label]) => `<option value="${escapeHtml(code)}" ${code === selected ? 'selected' : ''}>${escapeHtml(code)} · ${escapeHtml(label)}</option>`).join('');

  function localNoon(value) { return value ? new Date(`${value}T12:00:00`) : new Date(); }
  function isoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  function addDays(value, days) {
    const date = value ? localNoon(value) : new Date();
    date.setDate(date.getDate() + days);
    return isoDate(date);
  }
  function nightsBetween(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    const diff = Math.round((localNoon(checkout) - localNoon(checkin)) / 86400000);
    return Math.max(0, diff || 0);
  }
  function formatHumanDate(value) {
    if (!value) return 'Seleccionar';
    const date = localNoon(value);
    return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
  }

  function getRoomPrice(room) {
    if (!room) return { currency: 'USD', amount: 0 };
    return room.publishedPricing ||
      (room.pricePerNight ? { currency: room.currency || 'USD', amount: room.pricePerNight } : null) ||
      room.targetNet ||
      room.netCost ||
      { currency: 'USD', amount: 0 };
  }
  function getLowestRoom(hotel) {
    return [...(hotel.rooms || [])].sort((a, b) => Number(getRoomPrice(a).amount || 0) - Number(getRoomPrice(b).amount || 0))[0];
  }
  function getHotelGallery(hotel) {
    const images = [];
    if (hotel?.images?.cover) images.push(hotel.images.cover);
    if (Array.isArray(hotel?.images?.gallery)) images.push(...hotel.images.gallery);
    return [...new Set(images.filter(Boolean))];
  }

  async function init() {
    try {
      const res = await fetch(DATA_URL);
      const data = await res.json();
      state.destinations = data.destinations || {};
      state.hotels = Object.entries(state.destinations).flatMap(([key, dest]) =>
        (dest.hotels || []).map((hotel) => ({
          ...hotel,
          destinationKey: key,
          destinationLabel: hotel.destinationLabel || dest.label || key,
        }))
      );
      renderFilters();
      setHeroDateLimits();
      renderHotels();
      bindEvents();
    } catch (error) {
      const grid = $('#hotelsGrid');
      if (grid) grid.innerHTML = '<div class="hotel-card"><div class="hotel-card__body"><h3>No se pudo cargar hotels.json</h3><p>Revisa la ruta assets/data/hotels.json.</p></div></div>';
      console.error(error);
    }
  }

  function renderFilters() {
    const select = $('#hotelDestinationFilter');
    if (!select) return;
    select.innerHTML = VISIBLE_DESTINATIONS.map((item) => `<option value="${escapeHtml(item.value)}">${escapeHtml(item.label)}</option>`).join('');
  }
  function dateRangesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return false;
    return localNoon(startA) < localNoon(endB) && localNoon(endA) > localNoon(startB);
  }

  function hotelHasAvailability(hotel, checkin, checkout) {
    if (!checkin || !checkout || nightsBetween(checkin, checkout) <= 0) return true;
    if (String(hotel.status || '').toLowerCase() === 'inactive') return false;
    const availability = hotel.availability || {};
    const blockedDates = availability.blockedDates || availability.closedDates || [];
    const blockedRanges = availability.blockedRanges || availability.closedRanges || [];
    let cursor = localNoon(checkin);
    const end = localNoon(checkout);
    while (cursor < end) {
      if (blockedDates.includes(isoDate(cursor))) return false;
      cursor.setDate(cursor.getDate() + 1);
    }
    return !blockedRanges.some((range) => dateRangesOverlap(checkin, checkout, range.start || range.from, range.end || range.to));
  }

  function setHeroDateLimits() {
    const tomorrow = addDays(null, 1);
    const month = localNoon(tomorrow);
    month.setDate(1);
    state.heroCalendarMonth = month;
    renderHeroDateSummary();
    renderHeroCalendar();
  }

  function getHeroDateRange() {
    const checkin = $('#hotelFilterCheckin')?.value || '';
    const checkout = $('#hotelFilterCheckout')?.value || '';
    if (!checkin || !checkout || checkout <= checkin) return { checkin: '', checkout: '', nights: 0 };
    return { checkin, checkout, nights: nightsBetween(checkin, checkout) };
  }

  function syncHeroDatesAndRender() {
    const inEl = $('#hotelFilterCheckin');
    const outEl = $('#hotelFilterCheckout');
    const tomorrow = addDays(null, 1);
    if (inEl && inEl.value && inEl.value < tomorrow) inEl.value = tomorrow;
    if (inEl && outEl && inEl.value) {
      const minCheckout = addDays(inEl.value, 1);
      if (outEl.value && outEl.value < minCheckout) outEl.value = minCheckout;
    }
    renderHeroDateSummary();
    renderHeroCalendar();
    renderHotels();
  }

  function renderHeroDateSummary() {
    const checkin = $('#hotelFilterCheckin')?.value || '';
    const checkout = $('#hotelFilterCheckout')?.value || '';
    const inLabel = $('#heroCheckinLabel');
    const outLabel = $('#heroCheckoutLabel');
    if (inLabel) inLabel.textContent = formatHumanDate(checkin);
    if (outLabel) outLabel.textContent = formatHumanDate(checkout);
  }

  function renderHeroCalendar() {
    const mount = $('#heroRangeCalendar');
    if (!mount || !state.heroCalendarMonth) return;
    const checkin = $('#hotelFilterCheckin')?.value || '';
    const checkout = $('#hotelFilterCheckout')?.value || '';
    const todayMin = addDays('', 1);
    const month = new Date(state.heroCalendarMonth.getTime());
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const first = new Date(year, monthIndex, 1, 12);
    const last = new Date(year, monthIndex + 1, 0, 12);
    const firstWeekday = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push('<span class="hotel-calendar-empty"></span>');
    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(year, monthIndex, day, 12);
      const iso = isoDate(date);
      const disabled = iso < todayMin;
      const inRange = checkin && checkout && iso > checkin && iso < checkout;
      const isStart = iso === checkin;
      const isEnd = iso === checkout;
      const isPendingStart = isStart && !checkout;
      cells.push(`<button type="button" data-hero-date="${iso}" class="hotel-calendar-day ${inRange ? 'is-in-range' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${isPendingStart ? 'is-pending-start' : ''}" ${disabled ? 'disabled' : ''}>${day}</button>`);
    }
    mount.innerHTML = `
      <div class="hotel-calendar-head">
        <button type="button" data-hero-calendar-nav="prev" aria-label="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <strong>${MONTHS[monthIndex]} ${year}</strong>
        <button type="button" data-hero-calendar-nav="next" aria-label="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="hotel-calendar-weekdays">${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="hotel-calendar-grid">${cells.join('')}</div>
      <div class="hotel-calendar-actions">
        <button type="button" class="hotel-calendar-clear" data-hero-calendar-clear>Limpiar</button>
        <button type="button" class="hotel-calendar-apply" data-hero-calendar-apply ${checkin && checkout ? '' : 'disabled'}>OK</button>
      </div>`;
  }

  function openHeroCalendar() {
    const calendar = $('#heroRangeCalendar');
    if (!calendar) return;
    calendar.hidden = false;
    calendar.classList.add('is-open');
  }

  function closeHeroCalendar() {
    const calendar = $('#heroRangeCalendar');
    if (!calendar) return;
    calendar.hidden = true;
    calendar.classList.remove('is-open');
  }

  function moveHeroCalendar(direction) {
    if (!state.heroCalendarMonth) return;
    state.heroCalendarMonth.setMonth(state.heroCalendarMonth.getMonth() + (direction === 'next' ? 1 : -1));
    const currentMonthMin = new Date();
    currentMonthMin.setDate(1);
    currentMonthMin.setHours(12,0,0,0);
    if (state.heroCalendarMonth < currentMonthMin) state.heroCalendarMonth = currentMonthMin;
    renderHeroCalendar();
  }

  function selectHeroCalendarDate(dateIso) {
    const checkinInput = $('#hotelFilterCheckin');
    const checkoutInput = $('#hotelFilterCheckout');
    if (!checkinInput || !checkoutInput) return;
    const currentIn = checkinInput.value;
    const currentOut = checkoutInput.value;
    if (!currentIn || (currentIn && currentOut) || dateIso <= currentIn) {
      checkinInput.value = dateIso;
      checkoutInput.value = '';
    } else {
      checkoutInput.value = dateIso;
    }
    renderHeroDateSummary();
    renderHeroCalendar();
  }

  function clearHeroCalendar() {
    const checkinInput = $('#hotelFilterCheckin');
    const checkoutInput = $('#hotelFilterCheckout');
    if (checkinInput) checkinInput.value = '';
    if (checkoutInput) checkoutInput.value = '';
    renderHeroDateSummary();
    renderHeroCalendar();
    renderHotels();
  }

  function getFilteredHotels() {
    const dest = $('#hotelDestinationFilter')?.value || 'all';
    const selected = VISIBLE_DESTINATIONS.find((item) => item.value === dest);
    const allowedKeys = selected?.keys;
    const query = ($('#hotelSearchInput')?.value || '').trim().toLowerCase();
    const category = $('#hotelCategoryFilter')?.value || 'all';
    const checkin = $('#hotelFilterCheckin')?.value || '';
    const checkout = $('#hotelFilterCheckout')?.value || '';
    return state.hotels.filter((hotel) => {
      if (allowedKeys && !allowedKeys.includes(hotel.destinationKey)) return false;
      if (!allowedKeys && ['tarapoto', 'iquitos', 'tambopata'].includes(hotel.destinationKey)) return false;
      if (category !== 'all' && String(hotel.stars || hotel.category || '') !== String(category)) return false;
      if (checkin && checkout && !hotelHasAvailability(hotel, checkin, checkout)) return false;
      if (!query) return true;
      return [hotel.hotelName, hotel.destinationLabel, hotel.location, hotel.address, hotel.summary]
        .filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }
  function renderHotels() {
    const grid = $('#hotelsGrid');
    const count = $('#hotelCountLabel');
    if (!grid) return;
    const hotels = getFilteredHotels();
    if (count) count.textContent = `${hotels.length} hotel(es) encontrados`;
    grid.innerHTML = hotels.map(renderHotelCard).join('') || '<div class="hotel-card"><div class="hotel-card__body"><h3>No hay hoteles para este filtro</h3><p>Prueba con otro destino o búsqueda.</p></div></div>';
  }
  function renderHotelCard(hotel) {
    const cover = asset(hotel.images?.cover || hotel.images?.gallery?.[0]);
    const room = getLowestRoom(hotel);
    const price = getRoomPrice(room);
    const features = [hotel.amenities?.breakfast, ...(hotel.features || [])].filter(Boolean).slice(0, 4);
    return `
      <article class="hotel-card">
        <div class="hotel-card__media">
          <img src="${escapeHtml(cover)}" alt="${escapeHtml(hotel.hotelName)}" loading="lazy">
          <span class="hotel-card__badge">${escapeHtml(hotel.destinationLabel || hotel.location || 'Perú')} · ${hotel.stars ? '★'.repeat(Number(hotel.stars)) : 'Hotel'}</span>
        </div>
        <div class="hotel-card__body">
          <h3>${escapeHtml(hotel.hotelName)}</h3>
          <p>${escapeHtml(hotel.summary || hotel.address || '')}</p>
          <div class="hotel-card__features">${features.map((item) => `<span>${escapeHtml(String(item).replace(/^Desayuno:\s*/i, ''))}</span>`).join('')}</div>
          <div class="hotel-card__footer">
            <div class="hotel-card__price"><small>Desde / noche</small><strong>${money(price.amount, price.currency)}</strong></div>
            <button type="button" data-view-hotel="${escapeHtml(hotel.hotelCode)}">Ver hotel</button>
          </div>
        </div>
      </article>`;
  }

  function renderGallery() {
    const hotel = state.activeHotel;
    const mount = $('#hotelGalleryMount');
    if (!hotel || !mount) return;
    const gallery = getHotelGallery(hotel);
    const safeIndex = Math.max(0, Math.min(state.galleryIndex, gallery.length - 1));
    state.galleryIndex = safeIndex;
    const current = asset(gallery[safeIndex] || hotel.images?.cover);
    mount.innerHTML = `
      <img src="${escapeHtml(current)}" alt="${escapeHtml(hotel.hotelName)}">
      ${gallery.length > 1 ? `
        <button type="button" class="hotel-gallery-btn hotel-gallery-btn--prev" data-hotel-gallery="prev" aria-label="Imagen anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <button type="button" class="hotel-gallery-btn hotel-gallery-btn--next" data-hotel-gallery="next" aria-label="Imagen siguiente"><i class="fa-solid fa-chevron-right"></i></button>
        <span class="hotel-gallery-counter">${safeIndex + 1} / ${gallery.length}</span>` : ''}`;
  }
  function moveGallery(direction) {
    const gallery = getHotelGallery(state.activeHotel);
    if (!gallery.length) return;
    state.galleryIndex = direction === 'next' ? (state.galleryIndex + 1) % gallery.length : (state.galleryIndex - 1 + gallery.length) % gallery.length;
    renderGallery();
  }

  function openHotel(hotelCode) {
    const hotel = state.hotels.find((item) => item.hotelCode === hotelCode);
    if (!hotel) return;
    state.activeHotel = hotel;
    state.activeSearch = null;
    state.activeRoom = null;
    state.activeGuest = null;
    state.accommodations = [];
    state.galleryIndex = 0;
    state.paypalRenderedFor = null;

    const modal = $('#hotelDetailModal');
    const content = $('#hotelDetailContent');
    if (!modal || !content) return;

    const features = [hotel.amenities?.breakfast, hotel.amenities?.checkin, hotel.amenities?.checkout, ...(hotel.features || [])]
      .filter(Boolean).slice(0, 9);
    const heroRange = getHeroDateRange();
    const tomorrow = heroRange.checkin || addDays('', 1);
    const dayAfter = heroRange.checkout || addDays(tomorrow, 1);
    const month = localNoon(tomorrow);
    month.setDate(1);
    state.calendarMonth = month;

    content.innerHTML = `
      <section class="hotel-detail hotel-detail--balanced">
        <div class="hotel-detail__left">
          <div id="hotelGalleryMount" class="hotel-detail__gallery"></div>
          <div class="hotel-title-block">
            <h2 id="hotelDetailTitle">${escapeHtml(hotel.hotelName)}</h2>
            <div class="hotel-detail__meta">${hotel.stars ? '★'.repeat(Number(hotel.stars)) : 'Hotel'} · ${escapeHtml(hotel.address || hotel.location || '')}</div>
          </div>
          <p class="hotel-detail__summary">${escapeHtml(hotel.summary || '')}</p>
          <div class="hotel-detail__features">${features.map((item) => `<span>${escapeHtml(String(item).replace(/^Desayuno:\s*/i, ''))}</span>`).join('')}</div>
        </div>
        <div class="hotel-detail__right">
          <div class="hotel-reservation-box">
            <h3>Detalles de tu reserva</h3>
            <input id="hotelCheckin" type="hidden" value="${tomorrow}">
            <input id="hotelCheckout" type="hidden" value="${dayAfter}">
            <div class="hotel-date-summary" id="hotelDateSummary"></div>
            <div id="hotelRangeCalendar" class="hotel-range-calendar hotel-range-calendar--popover" hidden></div>
            <div class="hotel-reservation-grid hotel-passenger-grid">
              <label>Adultos <input id="hotelAdults" type="number" min="1" max="12" value="2"></label>
              <label>Niños <input id="hotelChildren" type="number" min="0" max="8" value="0"></label>
            </div>
            <button type="button" class="hotel-search-availability-btn" id="hotelSearchAvailabilityBtn"><i class="fa-solid fa-magnifying-glass"></i> Ver disponibilidad</button>
            <div id="hotelRoomsPanel" class="hotel-rooms-panel" hidden></div>
            <div id="hotelPaymentPanel" class="hotel-payment-panel" hidden></div>
          </div>
        </div>
      </section>`;

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    renderDateSummary();
    renderHotelCalendar();
    renderGallery();
  }

  function renderDateSummary() {
    const checkin = $('#hotelCheckin')?.value;
    const checkout = $('#hotelCheckout')?.value;
    const nights = nightsBetween(checkin, checkout);
    const mount = $('#hotelDateSummary');
    if (!mount) return;
    mount.innerHTML = `
      <button type="button" class="hotel-date-pill" data-open-hotel-calendar="checkin"><span>Entrada</span><strong>${formatHumanDate(checkin)}</strong></button>
      <button type="button" class="hotel-date-pill" data-open-hotel-calendar="checkout"><span>Salida</span><strong>${formatHumanDate(checkout)}</strong></button>
      <div class="hotel-night-count"><span>Estadía</span><strong>${nights} noche${nights === 1 ? '' : 's'} de alojamiento</strong></div>`;
  }

  function renderHotelCalendar() {
    const mount = $('#hotelRangeCalendar');
    if (!mount || !state.calendarMonth) return;
    const checkin = $('#hotelCheckin')?.value;
    const checkout = $('#hotelCheckout')?.value;
    const todayMin = addDays('', 1);
    const month = new Date(state.calendarMonth.getTime());
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const first = new Date(year, monthIndex, 1, 12);
    const last = new Date(year, monthIndex + 1, 0, 12);
    const firstWeekday = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < firstWeekday; i++) cells.push('<span class="hotel-calendar-empty"></span>');
    for (let day = 1; day <= last.getDate(); day++) {
      const date = new Date(year, monthIndex, day, 12);
      const iso = isoDate(date);
      const disabled = iso < todayMin;
      const inRange = checkin && checkout && iso > checkin && iso < checkout;
      const isStart = iso === checkin;
      const isEnd = iso === checkout;
      const isPendingStart = isStart && !checkout;
      cells.push(`<button type="button" data-hotel-date="${iso}" class="hotel-calendar-day ${inRange ? 'is-in-range' : ''} ${isStart ? 'is-start' : ''} ${isEnd ? 'is-end' : ''} ${isPendingStart ? 'is-pending-start' : ''}" ${disabled ? 'disabled' : ''}>${day}</button>`);
    }
    mount.innerHTML = `
      <div class="hotel-calendar-head">
        <button type="button" data-calendar-nav="prev" aria-label="Mes anterior"><i class="fa-solid fa-chevron-left"></i></button>
        <strong>${MONTHS[monthIndex]} ${year}</strong>
        <button type="button" data-calendar-nav="next" aria-label="Mes siguiente"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="hotel-calendar-weekdays">${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="hotel-calendar-grid">${cells.join('')}</div>
      <div class="hotel-calendar-actions">
        <button type="button" class="hotel-calendar-apply" data-calendar-apply ${checkin && checkout ? '' : 'disabled'}>OK</button>
      </div>`;
  }


  function openHotelCalendar() {
    const calendar = $('#hotelRangeCalendar');
    if (!calendar) return;
    calendar.hidden = false;
    calendar.classList.add('is-open');
    window.setTimeout(() => {
      calendar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 40);
  }

  function closeHotelCalendar() {
    const calendar = $('#hotelRangeCalendar');
    if (!calendar) return;
    calendar.hidden = true;
    calendar.classList.remove('is-open');
  }

  function moveCalendar(direction) {
    if (!state.calendarMonth) return;
    state.calendarMonth.setMonth(state.calendarMonth.getMonth() + (direction === 'next' ? 1 : -1));
    const currentMonthMin = new Date();
    currentMonthMin.setDate(1);
    currentMonthMin.setHours(12,0,0,0);
    if (state.calendarMonth < currentMonthMin) state.calendarMonth = currentMonthMin;
    renderHotelCalendar();
  }

  function selectCalendarDate(dateIso) {
    const checkinInput = $('#hotelCheckin');
    const checkoutInput = $('#hotelCheckout');
    if (!checkinInput || !checkoutInput) return;
    const currentIn = checkinInput.value;
    const currentOut = checkoutInput.value;
    // UX: el primer clic de un nuevo rango debe marcarse inmediatamente como entrada activa.
    if (!currentIn || (currentIn && currentOut) || dateIso <= currentIn) {
      checkinInput.value = dateIso;
      checkoutInput.value = '';
    } else {
      checkoutInput.value = dateIso;
    }
    resetAvailabilityPanels();
    renderDateSummary();
    renderHotelCalendar();
  }

  function resetAvailabilityPanels() {
    state.activeSearch = null;
    state.activeRoom = null;
    state.activeGuest = null;
    state.accommodations = [];
    state.paypalRenderedFor = null;
    const rooms = $('#hotelRoomsPanel');
    const pay = $('#hotelPaymentPanel');
    if (rooms) { rooms.hidden = true; rooms.innerHTML = ''; }
    if (pay) { pay.hidden = true; pay.innerHTML = ''; }
  }

  function scrollHotelPanelIntoView(selector, block = 'start') {
    const target = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block });
    }, 80);
  }

  function buildAccommodationOptions(hotel, adults, children) {
    const totalGuests = Math.max(1, Number(adults || 1) + Number(children || 0));
    const rooms = (hotel.rooms || [])
      .filter((room) => Number(room.capacity || 0) > 0 && Number(room.capacity || 0) <= totalGuests)
      .sort((a, b) => Number(a.capacity || 0) - Number(b.capacity || 0) || Number(getRoomPrice(a).amount || 0) - Number(getRoomPrice(b).amount || 0));
    const results = [];
    const seen = new Set();
    const maxRooms = Math.min(totalGuests, 5);

    function addCombo(combo) {
      const capacity = combo.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
      if (capacity !== totalGuests) return;
      const key = combo.map((room) => room.roomType || room.label).sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      const currency = getRoomPrice(combo[0]).currency || 'USD';
      const amount = combo.reduce((sum, room) => sum + Number(getRoomPrice(room).amount || 0), 0);
      const labelCounts = combo.reduce((acc, room) => {
        const label = room.label || room.roomType || 'Habitación';
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {});
      const label = Object.entries(labelCounts).map(([label, qty]) => qty > 1 ? `${qty} × ${toTitleCase(label)}` : toTitleCase(label)).join(' + ');
      const bedType = combo.map((room) => room.bedType ? toTitleCase(room.bedType) : '').filter(Boolean).join(' · ');
      results.push({ id: `acc-${results.length}`, rooms: combo, roomType: key, label, bedType, capacity, publishedPricing: { currency, amount } });
    }

    function search(startIndex, remainingCapacity, combo) {
      if (remainingCapacity === 0) { addCombo(combo); return; }
      if (combo.length >= maxRooms) return;
      for (let i = startIndex; i < rooms.length; i++) {
        const room = rooms[i];
        const cap = Number(room.capacity || 0);
        if (cap <= remainingCapacity) search(i, remainingCapacity - cap, [...combo, room]);
      }
    }

    search(0, totalGuests, []);
    return results
      .sort((a, b) => a.rooms.length - b.rooms.length || Number(getRoomPrice(a).amount || 0) - Number(getRoomPrice(b).amount || 0))
      .slice(0, 10);
  }

  function showAvailability() {
    const hotel = state.activeHotel;
    if (!hotel) return;
    const checkin = $('#hotelCheckin')?.value;
    const checkout = $('#hotelCheckout')?.value;
    const adults = Math.max(1, Number($('#hotelAdults')?.value || 1));
    const children = Math.max(0, Number($('#hotelChildren')?.value || 0));
    const panel = $('#hotelRoomsPanel');
    const payment = $('#hotelPaymentPanel');
    if (!panel) return;

    if (!checkin || !checkout || checkout <= checkin) {
      panel.hidden = false;
      panel.innerHTML = '<p class="hotel-inline-alert">Selecciona entrada y salida en el calendario. La salida debe ser posterior a la entrada.</p>';
      scrollHotelPanelIntoView(panel);
      return;
    }

    const nights = nightsBetween(checkin, checkout);
    const options = buildAccommodationOptions(hotel, adults, children);
    state.activeSearch = { checkin, checkout, adults, children, nights };
    state.activeRoom = null;
    state.activeGuest = null;
    state.accommodations = options;
    state.paypalRenderedFor = null;
    if (payment) { payment.hidden = true; payment.innerHTML = ''; }

    panel.hidden = false;
    if (!options.length) {
      panel.innerHTML = '<p class="hotel-inline-alert">No hay acomodaciones exactas para esta cantidad de pasajeros. Ajusta adultos/niños o solicita una configuración manual.</p>';
      scrollHotelPanelIntoView(panel);
      return;
    }

    panel.innerHTML = `
      <div class="hotel-rooms-panel__head">
        <strong>Elige tu acomodación</strong>
        <small>${nights} noche${nights === 1 ? '' : 's'} · ${adults} adulto${adults === 1 ? '' : 's'}${children ? ` · ${children} niño${children === 1 ? '' : 's'}` : ''}</small>
      </div>
      <div class="hotel-room-list">${options.map((option, idx) => renderRoomOption(option, idx, nights)).join('')}</div>`;
    scrollHotelPanelIntoView(panel);
  }

  function renderRoomOption(option, idx, nights) {
    const price = getRoomPrice(option);
    const total = Number(price.amount || 0) * Number(nights || 1);
    return `<label class="hotel-room-option">
      <input type="radio" name="hotelRoom" value="${escapeHtml(option.id)}">
      <span><strong>${escapeHtml(option.label)}</strong><small>${escapeHtml(option.bedType || '')} · Capacidad ${escapeHtml(option.capacity || '')}</small></span>
      <em>${money(total, price.currency)}<small>${money(price.amount, price.currency)} / noche</small></em>
    </label>`;
  }

  function getSelectedRoom() {
    const selected = document.querySelector('input[name="hotelRoom"]:checked')?.value;
    if (!selected) return null;
    return state.accommodations.find((item) => item.id === selected) || null;
  }

  function selectAccommodation() {
    const room = getSelectedRoom();
    const panel = $('#hotelPaymentPanel');
    if (!room || !panel || !state.activeSearch || !state.activeHotel) return;
    state.activeRoom = room;
    state.activeGuest = null;
    state.paypalRenderedFor = null;
    const price = getRoomPrice(room);
    const total = Number(price.amount || 0) * Number(state.activeSearch.nights || 1);
    const currency = price.currency || 'USD';

    panel.hidden = false;
    panel.innerHTML = `
      <div class="hotel-payment-summary">
        <strong>Datos del titular de la reserva</strong>
        <span>${escapeHtml(state.activeHotel.hotelName)} · ${escapeHtml(room.label)}</span>
        <b>${money(total, currency)} por ${state.activeSearch.nights} noche${state.activeSearch.nights === 1 ? '' : 's'}</b>
        ${currency !== 'USD' ? '<small>Esta habitación está publicada en otra moneda. Para PayPal en producción conviene manejar el monto final en USD.</small>' : ''}
      </div>
      <div class="hotel-booking-holder">
        <div class="hotel-holder-section-title">Datos del titular de reserva</div>
        <div class="hotel-holder-grid hotel-holder-grid--premium">
          <label>Nombres <input id="hotelGuestNames" type="text" placeholder="Nombres" autocomplete="given-name" inputmode="text" pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\\s\\'´-]+" required></label>
          <label>Apellidos <input id="hotelGuestLastnames" type="text" placeholder="Apellidos" autocomplete="family-name" inputmode="text" pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\\s\\'´-]+" required></label>
          <label class="hotel-doc-type-field">Tipo de documento
            <select id="hotelGuestDocType" required>
              <option value="">Tipo de documento</option>
              <option value="DNI">DNI</option>
              <option value="Pasaporte">Pasaporte</option>
              <option value="Carnet de extranjería">Carnet de extranjería</option>
              <option value="Otro">Otro</option>
            </select>
          </label>
          <label class="hotel-doc-number-field">Número de documento <input id="hotelGuestDocNumber" type="text" placeholder="Número de documento" autocomplete="off" required></label>
          <label class="hotel-nationality-field">Nacionalidad
            <select id="hotelGuestNationality" required>
              <option value="">Seleccionar nacionalidad</option>
              ${countryOptions('Perú')}
            </select>
          </label>
          <label class="hotel-phone-field">Celular / WhatsApp
            <span>
              <select id="hotelGuestPhoneCode" required>${phoneOptions('+51')}</select>
              <input id="hotelGuestPhone" type="tel" inputmode="numeric" pattern="[0-9]+" placeholder="Número" autocomplete="tel" required>
            </span>
          </label>
          <label class="hotel-email-field">Correo <input id="hotelGuestEmail" type="email" placeholder="Correo" autocomplete="email" required></label>
        </div>
      </div>
      <div class="hotel-paypal-lock" id="hotelPaypalLock"><i class="fa-solid fa-lock"></i> Completa los datos del titular de reserva para continuar al pago.</div>
      <div id="hotelPaypalButtons" class="hotel-paypal-buttons" hidden></div>`;
    scrollHotelPanelIntoView(panel);
    updatePaypalState();
  }

  function readGuestData() {
    const fields = {
      names: $('#hotelGuestNames')?.value.trim(),
      lastnames: $('#hotelGuestLastnames')?.value.trim(),
      documentType: $('#hotelGuestDocType')?.value,
      documentNumber: $('#hotelGuestDocNumber')?.value.trim(),
      nationality: $('#hotelGuestNationality')?.value,
      phoneCode: $('#hotelGuestPhoneCode')?.value,
      phone: $('#hotelGuestPhone')?.value.trim(),
      email: $('#hotelGuestEmail')?.value.trim(),
    };
    const missing = Object.entries(fields).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) return null;
    if (!lettersOnlyRegex.test(fields.names) || !lettersOnlyRegex.test(fields.lastnames)) return null;
    if (fields.documentType === 'DNI') {
      if (!/^\d{8}$/.test(fields.documentNumber)) return null;
    } else if (!alphanumericDocRegex.test(fields.documentNumber)) {
      return null;
    }
    if (!/^\d{6,15}$/.test(fields.phone)) return null;
    if (!emailRegex.test(fields.email)) return null;
    return fields;
  }

  function sanitizeHolderField(target) {
    if (!target) return;
    const docType = $('#hotelGuestDocType')?.value;
    if (target.matches('#hotelGuestNames, #hotelGuestLastnames')) {
      target.value = sanitizeLetters(target.value);
    }
    if (target.matches('#hotelGuestPhone')) {
      target.value = sanitizeDigits(target.value).slice(0, 15);
    }
    if (target.matches('#hotelGuestDocNumber')) {
      target.value = sanitizeDoc(target.value, docType);
    }
    if (target.matches('#hotelGuestDocType')) {
      const docInput = $('#hotelGuestDocNumber');
      if (docInput) {
        docInput.value = sanitizeDoc(docInput.value, target.value);
        docInput.setAttribute('inputmode', target.value === 'DNI' ? 'numeric' : 'text');
        docInput.setAttribute('maxlength', target.value === 'DNI' ? '8' : '24');
        docInput.placeholder = target.value === 'DNI' ? '8 dígitos' : 'Número de documento';
      }
    }
  }

  function updatePaypalState() {
    const guest = readGuestData();
    const lock = $('#hotelPaypalLock');
    const container = $('#hotelPaypalButtons');
    if (!container) return;
    if (!guest) {
      state.activeGuest = null;
      state.paypalRenderedFor = null;
      container.hidden = true;
      container.innerHTML = '';
      if (lock) lock.hidden = false;
      return;
    }
    state.activeGuest = guest;
    if (lock) lock.hidden = true;
    container.hidden = false;
    const price = getRoomPrice(state.activeRoom);
    const total = Number(price.amount || 0) * Number(state.activeSearch?.nights || 1);
    renderPayPalButtons(total, price.currency || 'USD');
  }

  function renderPayPalButtons(total, currency) {
    const container = $('#hotelPaypalButtons');
    if (!container) return;
    const orderKey = `${state.activeHotel?.hotelCode}-${state.activeRoom?.id || state.activeRoom?.roomType}-${state.activeSearch?.checkin}-${state.activeSearch?.checkout}-${state.activeGuest?.email || ''}`;
    if (state.paypalRenderedFor === orderKey) return;
    container.innerHTML = '';
    state.paypalRenderedFor = orderKey;

    if (!window.paypal || currency !== 'USD') {
      const amount = Number(total || 0).toFixed(2);
      container.innerHTML = `<button type="button" class="hotel-paypal-fallback" id="hotelManualPaymentBtn">Registrar solicitud de pago ${money(amount, currency)}</button>`;
      return;
    }

    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
      createOrder: (data, actions) => actions.order.create({
        purchase_units: [{
          description: `Hotel ${state.activeHotel.hotelName}`.slice(0, 120),
          amount: { currency_code: 'USD', value: Number(total || 0).toFixed(2) },
        }],
      }),
      onApprove: async (data, actions) => {
        const details = await actions.order.capture();
        await saveHotelOrder(details);
        container.innerHTML = '<div class="hotel-payment-success"><strong>Pago registrado.</strong><span>Hemos recibido la solicitud de reserva del hotel.</span></div>';
      },
      onError: (err) => {
        console.error(err);
        container.innerHTML = '<p class="hotel-inline-alert">No se pudo cargar PayPal. Revisa el Client ID o intenta nuevamente.</p>';
      },
    }).render('#hotelPaypalButtons');
  }

  async function saveHotelOrder(paypalDetails = null) {
    const url = window.MCT_HOTEL_APPS_SCRIPT_URL || '';
    const price = getRoomPrice(state.activeRoom);
    const payload = {
      type: 'hotel_reservation',
      createdAt: new Date().toISOString(),
      hotelCode: state.activeHotel?.hotelCode,
      hotelName: state.activeHotel?.hotelName,
      destination: state.activeHotel?.destinationLabel,
      roomType: state.activeRoom?.roomType,
      roomLabel: state.activeRoom?.label,
      accommodationRooms: state.activeRoom?.rooms || [],
      checkin: state.activeSearch?.checkin,
      checkout: state.activeSearch?.checkout,
      nights: state.activeSearch?.nights,
      adults: state.activeSearch?.adults,
      children: state.activeSearch?.children,
      guest: state.activeGuest || {},
      currency: price.currency,
      amount: Number(price.amount || 0) * Number(state.activeSearch?.nights || 1),
      paypalOrderId: paypalDetails?.id || '',
      paypalStatus: paypalDetails?.status || '',
      rawPayPal: paypalDetails || null,
    };
    if (!url) return payload;
    try {
      await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('No se pudo guardar la orden de hotel en Apps Script:', error);
    }
    return payload;
  }

  function closeHotel() {
    const modal = $('#hotelDetailModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    state.activeHotel = null;
    state.activeSearch = null;
    state.activeRoom = null;
    state.activeGuest = null;
    state.accommodations = [];
  }

  function bindEvents() {
    $('#hotelDestinationFilter')?.addEventListener('change', renderHotels);
    $('#hotelSearchInput')?.addEventListener('input', renderHotels);
    $('#hotelCategoryFilter')?.addEventListener('change', renderHotels);
    $('#hotelHeroSearchBtn')?.addEventListener('click', () => { renderHotels(); document.getElementById('hotelsGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    document.addEventListener('change', (event) => {
      if (event.target.matches('#hotelAdults, #hotelChildren')) resetAvailabilityPanels();
      if (event.target.matches('input[name="hotelRoom"]')) selectAccommodation();
      if (event.target.closest('.hotel-holder-grid')) { sanitizeHolderField(event.target); updatePaypalState(); }
    });
    document.addEventListener('input', (event) => {
      if (event.target.matches('#hotelAdults, #hotelChildren')) resetAvailabilityPanels();
      if (event.target.closest('.hotel-holder-grid')) { sanitizeHolderField(event.target); updatePaypalState(); }
    });
    document.addEventListener('click', (event) => {
      const hotelBtn = event.target.closest('[data-view-hotel]');
      if (hotelBtn) openHotel(hotelBtn.dataset.viewHotel);
      const galleryBtn = event.target.closest('[data-hotel-gallery]');
      if (galleryBtn) moveGallery(galleryBtn.dataset.hotelGallery);
      const openHeroCalBtn = event.target.closest('[data-open-hero-calendar]');
      if (openHeroCalBtn) openHeroCalendar();
      const heroNavBtn = event.target.closest('[data-hero-calendar-nav]');
      if (heroNavBtn) moveHeroCalendar(heroNavBtn.dataset.heroCalendarNav);
      const heroDayBtn = event.target.closest('[data-hero-date]');
      if (heroDayBtn) selectHeroCalendarDate(heroDayBtn.dataset.heroDate);
      if (event.target.closest('[data-hero-calendar-apply]')) { closeHeroCalendar(); syncHeroDatesAndRender(); }
      if (event.target.closest('[data-hero-calendar-clear]')) clearHeroCalendar();
      const openCalBtn = event.target.closest('[data-open-hotel-calendar]');
      if (openCalBtn) openHotelCalendar();
      const navBtn = event.target.closest('[data-calendar-nav]');
      if (navBtn) moveCalendar(navBtn.dataset.calendarNav);
      const dayBtn = event.target.closest('[data-hotel-date]');
      if (dayBtn) selectCalendarDate(dayBtn.dataset.hotelDate);
      if (event.target.closest('[data-calendar-apply]')) closeHotelCalendar();
      if (event.target.closest('[data-close-hotel-modal]')) closeHotel();
      if (event.target.closest('#hotelSearchAvailabilityBtn')) showAvailability();
      if (event.target.closest('#hotelManualPaymentBtn')) saveHotelOrder({ id: 'manual_pending', status: 'PENDING_PAYMENT' });
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeHotel(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
