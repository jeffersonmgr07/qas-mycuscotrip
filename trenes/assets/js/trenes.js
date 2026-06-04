(() => {
  'use strict';

  const CONFIG = Object.assign({
    appsScriptUrl: '',
    trainsJsonPath: '/assets/data/trains.json',
    exchangeRate: 3.38,
    currency: 'USD',
    bookingPrefix: 'CUZ-T'
  }, window.MCT_TRAIN_CONFIG || {});

  const ROUTES = {
    outbound: {
      cusco: 'CUSCO_MAPI',
      ollantaytambo: 'OLLA_MAPI',
      urubamba: 'URUBAMBA_MAPI',
      hidroelectrica: 'HIDRO_MAPI'
    },
    inbound: {
      cusco: 'MAPI_CUSCO',
      ollantaytambo: 'MAPI_OLLA',
      urubamba: 'MAPI_URUBAMBA',
      hidroelectrica: 'MAPI_HIDRO'
    }
  };

  const STATION_OPTIONS = ['ollantaytambo', 'cusco', 'urubamba', 'hidroelectrica'];

  const EXTRAS = {
    guideCircuit1: 15.90,
    guideCircuit3: 15.90,
    conseturRoundtrip: 24,
    breakfast: 8.90,
    lunch: 15.90
  };

  const COUNTRY_CODES = [
    'AF','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ','BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI','KH','CM','CA','CV','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ','DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET','FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY','HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT','JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG','LA','LV','LB','LS','LR','LY','LI','LT','LU','MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM','NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM','PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA','RE','RO','RU','RW','BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY','TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV','UG','UA','AE','GB','US','UM','UY','UZ','VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW'
  ];

  const PHONE_CODES = [
    ['PE', '+51'], ['US', '+1'], ['CA', '+1'], ['MX', '+52'], ['AR', '+54'], ['BO', '+591'], ['BR', '+55'], ['CL', '+56'], ['CO', '+57'], ['EC', '+593'], ['PY', '+595'], ['UY', '+598'], ['VE', '+58'], ['ES', '+34'], ['FR', '+33'], ['DE', '+49'], ['IT', '+39'], ['GB', '+44'], ['PT', '+351'], ['NL', '+31'], ['BE', '+32'], ['CH', '+41'], ['JP', '+81'], ['CN', '+86'], ['KR', '+82'], ['AU', '+61'], ['NZ', '+64']
  ];

  const DICTIONARY = {
    es: {
      hero: {
        kicker: 'PeruRail + Inca Rail',
        title: 'Compra tu tren a Machu Picchu y obtén los mejores beneficios',
        badgeGuide: 'Tour guiado gratuito dentro de Machu Picchu',
        badgeAssist: 'Asistencia 24/7',
        badgeBenefits: 'Beneficios exclusivos por tu compra',
        subtitle: 'Por la compra de tus trenes ida y vuelta, accede a beneficios exclusivos, reserva y paga online con asistencia personalizada para disfrutar mejor tu visita.'
      },
      search: {
        roundtrip: 'Ida y vuelta', bestOption: 'Mejor opción', oneway: 'Solo ida', returnOnly: 'Solo retorno', outboundDate: 'Fecha de viaje', returnDate: 'Fecha de retorno', passengers: 'Pasajeros', adults: 'Adultos', adultAge: '12 años o más', children: 'Niños', childAge: '3 a 11 años', childFareNote: 'La tarifa de niño se calcula con el precio cargado en el JSON: adulto × 0.80.', coupon: 'Cupón', couponPlaceholder: 'Opcional', button: 'Buscar'
      },
      routes: { outboundFrom: 'Salida desde', returnTo: 'Retorno hacia', seeMore: 'Ver más', seeLess: 'Ver menos' },
      stations: { cusco: 'Cusco', ollantaytambo: 'Ollantaytambo', urubamba: 'Urubamba', hidroelectrica: 'Hidroeléctrica', machuPicchu: 'Machu Picchu' },
      stationLong: { cusco: 'Cusco / Wanchaq / Poroy / Av. El Sol', ollantaytambo: 'Ollantaytambo', urubamba: 'Urubamba', hidroelectrica: 'Hidroeléctrica', machuPicchu: 'Machu Picchu' },
      results: { outboundTitle: 'Elige tu tren de ida', returnTitle: 'Elige tu tren de retorno', selectThisTrain: 'Seleccionar este tren', modifyOutbound: 'Modificar tren de ida', modifyReturn: 'Modificar tren de retorno', selectedTrain: 'Tren seleccionado', companyNote: 'El retorno se filtrará por la misma empresa del tren de ida.', noTrainsTitle: 'No encontramos horarios para esta ruta.', noTrainsText: 'Prueba otra estación o consúltanos para revisar disponibilidad manual.', selectOutboundFirst: 'Primero selecciona tu tren de ida. Luego verás los retornos disponibles con la misma empresa.', sameCompany: 'Como elegiste {company}, el retorno mostrará solo trenes de la misma empresa.', departure: 'Salida', arrival: 'Llegada', adult: 'Adulto', child: 'Niño', perPassenger: 'por pasajero', train: 'Tren turístico' },
      summary: { title: 'Tu selección', empty: 'Busca trenes y selecciona ida para empezar.', outbound: 'Tren de ida', return: 'Tren de retorno', selectOutbound: 'Selecciona un tren de ida para continuar.', selectReturn: 'Selecciona un tren de retorno de la misma empresa.', extra: 'Extra', included: 'Incluido', total: 'Total', note: 'La compra queda sujeta a disponibilidad final de la empresa ferroviaria. Te contactaremos si el horario elegido requiere ajuste.', reserveButton: 'Iniciar reserva' },
      extras: { title: 'Servicios extras', guideTitle: 'Guiado Machu Picchu', guideNone: 'No agregar guiado', circuit2: 'Circuito 2 · Gratis', circuit2Disabled: 'Circuito 2 · Gratis solo con ida y vuelta', circuit1: 'Circuito 1 · Grupo reducido 4 a 6 pax · USD 15.90 p/p', circuit3: 'Circuito 3 · Grupo reducido 4 a 6 pax · USD 15.90 p/p', busTitle: 'Bus Consetur Machu Picchu', busDesc: 'Subida y bajada · USD 24.00 p/p', breakfastTitle: 'Desayuno Power Peruano', breakfastDesc: 'Inca Kola + pan con chicharrón o pan con pollo · USD 8.90 p/p', lunchTitle: 'Almuerzo Power Peruano', lunchDesc: '¼ pollo a la brasa + arroz chaufa + papas fritas + Inca Kola 500 ml · USD 15.90 p/p', guideCircuit2Line: 'Guiado Machu Picchu Circuito 2', guideCircuit1Line: 'Guiado Machu Picchu Circuito 1', guideCircuit3Line: 'Guiado Machu Picchu Circuito 3', reducedGroup: 'Grupo reducido 4 a 6 pax', freeRoundtrip: 'Gratis por compra ida y vuelta', conseturLine: 'Bus Consetur subida y bajada', breakfastLine: 'Desayuno Power Peruano', lunchLine: 'Almuerzo Power Peruano', assistance: 'Asistencia personalizada 24/7 incluida sin costo', assistanceDetail: 'Incluida sin costo', detailsButton: 'Ver detalles', freeBadge: 'Gratis', detailClose: 'Cerrar', detailGuideTitle: 'Guiado en Machu Picchu', detailGuideText: 'Acompañamiento profesional dentro de Machu Picchu según el circuito seleccionado. Ideal para entender la historia, los templos, los miradores y aprovechar mejor tu tiempo dentro de la ciudadela. El Circuito 2 puede estar incluido sin costo en compra ida y vuelta, sujeto a disponibilidad operativa. Los Circuitos 1 y 3 se ofrecen en grupo reducido de 4 a 6 pasajeros.', detailBusTitle: 'Bus Consetur Machu Picchu', detailBusText: 'Ticket de bus turístico entre Aguas Calientes y el ingreso de Machu Picchu. Incluye subida y bajada. Es recomendable para ahorrar energía, evitar la caminata en pendiente y llegar con mayor comodidad al horario de ingreso.', detailBreakfastTitle: 'Desayuno Power Peruano', detailBreakfastText: 'Opción práctica para iniciar temprano tu visita: bebida Inca Kola y pan con chicharrón o pan con pollo. Pensado para viajeros que salen muy temprano hacia la estación o hacia Machu Picchu.', detailLunchTitle: 'Almuerzo Power Peruano', detailLunchText: 'Almuerzo contundente después de la visita: ¼ pollo a la brasa, arroz chaufa, papas fritas e Inca Kola de 500 ml. Ideal para recuperar energía antes del retorno en tren.' },
      modal: { title: 'Datos de los pasajeros', subtitle: 'El pasajero 1 será el titular de la reserva.', terms: 'Acepto que la reserva queda sujeta a disponibilidad final, validación de documentos y confirmación operativa de My Cusco Trip.', cancel: 'Cancelar', pay: 'Continuar a pagar', passenger: 'Pasajero', adult: 'Adulto', child: 'Niño', lead: 'Titular', firstName: 'Nombres', lastName: 'Apellidos', nationality: 'Nacionalidad', docType: 'Tipo de documento', docNumber: 'Número de documento', birthDate: 'Fecha de nacimiento', whatsapp: 'WhatsApp', whatsappOptional: 'WhatsApp opcional', phoneCode: 'Código', phoneNumber: 'Número', email: 'Correo', emailOptional: 'Correo opcional', dni: 'DNI', passport: 'Pasaporte', ce: 'Carné de extranjería', other: 'Otro', creating: 'Creando orden de reserva...', connecting: 'Conectando con PayPal...', missingAppsScript: 'Falta configurar APPS_SCRIPT_URL en trenes/assets/js/config.js.', invalidResponse: 'Apps Script devolvió una respuesta no válida.', orderError: 'No se pudo crear la orden.', paypalError: 'PayPal no devolvió enlace de aprobación.' },
      modalSummary: { title: 'Detalles de tu viaje', itinerary: 'Tu itinerario', outboundBadge: 'Ida', returnBadge: 'Retorno', extraServices: 'Servicios adicionales', subtotal: 'Sub total' },
      pax: { adult: 'adulto', adults: 'adultos', child: 'niño', children: 'niños', ageChild: 'Edad niño' }
    },
    en: {
      hero: { kicker: 'PeruRail + Inca Rail', title: 'Buy your train to Machu Picchu and get the best benefits', badgeGuide: 'Free guided tour inside Machu Picchu', badgeAssist: '24/7 assistance', badgeBenefits: 'Exclusive benefits with your purchase', subtitle: 'When you buy your round-trip train tickets, access exclusive benefits, book and pay online, and enjoy your visit with personalized assistance.' },
      search: { tripType: 'Trip type', roundtrip: 'Round trip', bestOption: 'Best option', oneway: 'One way', returnOnly: 'Return only', outboundDate: 'Travel date', returnDate: 'Return date', passengers: 'Passengers', adults: 'Adults', adultAge: '12 years or older', children: 'Children', childAge: '3 to 11 years old', childFareNote: 'Child fare uses the price loaded in the JSON: adult × 0.80.', coupon: 'Coupon', couponPlaceholder: 'Optional', button: 'Search' },
      routes: { outboundFrom: 'Departure from', returnTo: 'Return to', seeMore: 'See more', seeLess: 'See less' },
      stations: { cusco: 'Cusco', ollantaytambo: 'Ollantaytambo', urubamba: 'Urubamba', hidroelectrica: 'Hydroelectric', machuPicchu: 'Machu Picchu' },
      stationLong: { cusco: 'Cusco / Wanchaq / Poroy / Av. El Sol', ollantaytambo: 'Ollantaytambo', urubamba: 'Urubamba', hidroelectrica: 'Hydroelectric', machuPicchu: 'Machu Picchu' },
      results: { outboundTitle: 'Choose your outbound train', returnTitle: 'Choose your return train', selectThisTrain: 'Select this train', modifyOutbound: 'Change outbound train', modifyReturn: 'Change return train', selectedTrain: 'Selected train', companyNote: 'The return train will be filtered by the same company as your outbound train.', noTrainsTitle: 'No schedules found for this route.', noTrainsText: 'Try another station or contact us to check availability manually.', selectOutboundFirst: 'First choose your outbound train. Then you will see return options with the same company.', sameCompany: 'Since you chose {company}, return options will show only the same company.', departure: 'Departure', arrival: 'Arrival', adult: 'Adult', child: 'Child', perPassenger: 'per passenger', train: 'Tourist train' },
      summary: { title: 'Your selection', empty: 'Search trains and choose your outbound option to start.', outbound: 'Outbound train', return: 'Return train', selectOutbound: 'Choose an outbound train to continue.', selectReturn: 'Choose a return train from the same company.', extra: 'Extra', included: 'Included', total: 'Total', note: 'The purchase is subject to final availability from the railway company. We will contact you if your selected schedule needs adjustment.', reserveButton: 'Start booking' },
      extras: { title: 'Extra services', guideTitle: 'Machu Picchu guided tour', guideNone: 'Do not add guide', circuit2: 'Circuit 2 · Free', circuit2Disabled: 'Circuit 2 · Free only with round trip', circuit1: 'Circuit 1 · Small group 4 to 6 pax · USD 15.90 p/p', circuit3: 'Circuit 3 · Small group 4 to 6 pax · USD 15.90 p/p', busTitle: 'Consetur bus to Machu Picchu', busDesc: 'Up and down · USD 24.00 p/p', breakfastTitle: 'Peruvian Power Breakfast', breakfastDesc: 'Inca Kola + pork sandwich or chicken sandwich · USD 8.90 p/p', lunchTitle: 'Peruvian Power Lunch', lunchDesc: '¼ rotisserie chicken + chaufa rice + fries + 500 ml Inca Kola · USD 15.90 p/p', guideCircuit2Line: 'Machu Picchu guided tour Circuit 2', guideCircuit1Line: 'Machu Picchu guided tour Circuit 1', guideCircuit3Line: 'Machu Picchu guided tour Circuit 3', reducedGroup: 'Small group of 4 to 6 travelers', freeRoundtrip: 'Free with round-trip train purchase', conseturLine: 'Consetur bus up and down', breakfastLine: 'Peruvian Power Breakfast', lunchLine: 'Peruvian Power Lunch', assistance: '24/7 personalized assistance included at no extra cost', assistanceDetail: 'Included at no cost', detailsButton: 'View details', freeBadge: 'Free', detailClose: 'Close', detailGuideTitle: 'Guided tour in Machu Picchu', detailGuideText: 'Professional guidance inside Machu Picchu according to the selected circuit. Ideal to understand the history, temples, viewpoints and make better use of your time inside the citadel. Circuit 2 may be included at no extra cost with a round-trip purchase, subject to operational availability. Circuits 1 and 3 are offered in small groups of 4 to 6 travelers.', detailBusTitle: 'Consetur Bus to Machu Picchu', detailBusText: 'Tourist bus ticket between Aguas Calientes and the entrance to Machu Picchu. Includes uphill and downhill rides. Recommended to save energy, avoid the steep walk and arrive more comfortably for your entry time.', detailBreakfastTitle: 'Peruvian Power Breakfast', detailBreakfastText: 'A practical option for early departures: Inca Kola and a pork or chicken sandwich. Designed for travelers leaving very early for the train station or Machu Picchu.', detailLunchTitle: 'Peruvian Power Lunch', detailLunchText: 'A filling lunch after your visit: ¼ rotisserie chicken, chaufa rice, fries and a 500 ml Inca Kola. Ideal to recover energy before the return train.' },
      modal: { title: 'Passenger details', subtitle: 'Passenger 1 will be the booking holder.', terms: 'I accept that the booking is subject to final availability, document validation, and operational confirmation by My Cusco Trip.', cancel: 'Cancel', pay: 'Continue to pay', passenger: 'Passenger', adult: 'Adult', child: 'Child', lead: 'Booking holder', firstName: 'First name', lastName: 'Last name', nationality: 'Nationality', docType: 'Document type', docNumber: 'Document number', birthDate: 'Date of birth', whatsapp: 'WhatsApp', whatsappOptional: 'WhatsApp optional', phoneCode: 'Code', phoneNumber: 'Number', email: 'Email', emailOptional: 'Email optional', dni: 'National ID', passport: 'Passport', ce: 'Foreigner ID card', other: 'Other', creating: 'Creating booking order...', connecting: 'Connecting to PayPal...', missingAppsScript: 'Missing APPS_SCRIPT_URL configuration in trenes/assets/js/config.js.', invalidResponse: 'Apps Script returned an invalid response.', orderError: 'The order could not be created.', paypalError: 'PayPal did not return an approval link.' },
      modalSummary: { title: 'Trip details', itinerary: 'Your itinerary', outboundBadge: 'Outbound', returnBadge: 'Return', extraServices: 'Additional services', subtotal: 'Subtotal' },
      pax: { adult: 'adult', adults: 'adults', child: 'child', children: 'children', ageChild: 'Child age' }
    }
  };

  const state = {
    data: { trains: [] },
    locale: getLocale(),
    tripType: 'roundtrip',
    adults: 1,
    children: 0,
    childAges: [],
    outboundFrom: 'ollantaytambo',
    returnTo: 'ollantaytambo',
    outboundDate: '',
    returnDate: '',
    selected: { outbound: null, return: null },
    pending: { outbound: null, return: null },
    extras: {
      guideCircuit: 'none',
      conseturBus: false,
      breakfast: false,
      lunch: false
    },
    routeMore: { outbound: false, return: false }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clean = (value) => String(value || '').trim();
  const normalize = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
  const money = (value) => `USD ${Number(value || 0).toFixed(2)}`;

  function getLocale() {
    const fromI18n = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || window.MyCuscoTripI18n?.locale;
    if (fromI18n && DICTIONARY[fromI18n]) return fromI18n;
    const pathLocale = window.location.pathname.split('/').filter(Boolean)[0];
    if (DICTIONARY[pathLocale]) return pathLocale;
    return 'es';
  }

  function t(key, fallback = '') {
    const dict = DICTIONARY[state.locale] || DICTIONARY.es;
    const value = String(key).split('.').reduce((acc, part) => acc && acc[part], dict);
    return value || fallback || key;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }

  function applyTrainTranslations(root = document) {
    state.locale = getLocale();
    root.querySelectorAll?.('[data-train-i18n]').forEach((node) => {
      node.textContent = t(node.dataset.trainI18n, node.textContent || '');
    });
    root.querySelectorAll?.('[data-train-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', t(node.dataset.trainPlaceholder, node.getAttribute('placeholder') || ''));
    });
    document.documentElement.setAttribute('lang', state.locale);
  }

  function todayISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function formatDateLong(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    try {
      return new Intl.DateTimeFormat(state.locale === 'en' ? 'en-US' : 'es-PE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date(year, month - 1, day));
    } catch (error) {
      return isoDate;
    }
  }

  function formatDateSummary(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    try {
      const locale = state.locale === 'en' ? 'en-US' : 'es-PE';
      const d = new Date(year, month - 1, day);
      const weekdayRaw = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d).replace('.', '');
      const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1).toLowerCase();
      const rest = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(d);
      return `${weekday}, ${rest}`;
    } catch (error) {
      return isoDate;
    }
  }

  function formatDateShort(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = String(isoDate).split('-').map(Number);
    if (!year || !month || !day) return '';
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
  }

  function getTravelDate(direction) {
    return direction === 'return' ? state.returnDate : state.outboundDate;
  }

  function isMobileView() {
    return window.matchMedia?.('(max-width: 760px)').matches || window.innerWidth <= 760;
  }

  function syncDateLimits() {
    const minOutbound = todayISO(2);
    const outboundInput = $('#outboundDate');
    const returnInput = $('#returnDate');
    if (outboundInput) {
      outboundInput.min = minOutbound;
      if (outboundInput.value && outboundInput.value < minOutbound) outboundInput.value = minOutbound;
    }
    const outboundValue = outboundInput?.value || state.outboundDate || minOutbound;
    if (returnInput) {
      returnInput.min = outboundValue;
      if (returnInput.value && returnInput.value < outboundValue) returnInput.value = outboundValue;
    }
  }

  function updateSearchCollapsedSummary() {
    const form = $('#trainSearchForm');
    if (!form) return;
    const out = state.tripType === 'returnonly' ? '' : formatDateShort(state.outboundDate || $('#outboundDate')?.value);
    const ret = (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? formatDateShort(state.returnDate || $('#returnDate')?.value) : '';
    const label = state.tripType === 'oneway' ? t('search.oneway') : state.tripType === 'returnonly' ? t('search.returnOnly') : t('search.roundtrip');
    const dates = state.tripType === 'roundtrip' ? `${out} → ${ret}` : (ret || out);
    form.dataset.summary = `${label} · ${dates}`;
  }

  function collapseSearchOnMobile() {
    const form = $('#trainSearchForm');
    if (!form) return;
    updateSearchCollapsedSummary();
    form.classList.toggle('is-collapsed', isMobileView());
  }

  function expandSearch() {
    $('#trainSearchForm')?.classList.remove('is-collapsed');
  }

  function scrollAfterTrainConfirm(direction) {
    let target = $('.summary-card') || $('#inlineCheckoutButton') || $('.results-layout') || $('.route-selector');
    let block = 'center';

    if (direction === 'outbound' && state.tripType === 'roundtrip') {
      target = $('#returnBlock .section-heading') || $('#returnBlock') || $('#returnStationPills') || target;
      block = 'start';
    } else if (direction === 'return' || state.tripType === 'oneway' || state.tripType === 'returnonly') {
      target = $('#inlineCheckoutButton') || $('.summary-card') || target;
      block = 'center';
    }

    setTimeout(() => target?.scrollIntoView({ behavior: 'smooth', block }), 170);
  }

  function getPaxTotal() {
    return state.adults + state.children;
  }

  function timeToMinutes(value) {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  function durationText(start, end) {
    let diff = timeToMinutes(end) - timeToMinutes(start);
    if (diff < 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (!h) return `${m} min`;
    return `${h} h ${String(m).padStart(2, '0')} min`;
  }

  function stationLabel(key, long = false) {
    return t(`${long ? 'stationLong' : 'stations'}.${key}`, key);
  }

  function getTrainOperator(train) {
    return normalize(train?.operatorKey || train?.company || train?.companyName || '');
  }

  function getCompanyLogo(train) {
    const op = getTrainOperator(train);
    if (op.includes('inca')) return '/assets/img/trains/inca-rail.png';
    if (op.includes('peru')) return '/assets/img/trains/perurail.png';
    return '/assets/img/placeholder/experience.jpg';
  }

  function getTrainPrice(train, type = 'adult') {
    if (!train) return 0;
    const adult = Number(train.price?.adult ?? train.pricePerPerson ?? 0);
    if (type === 'child') {
      const rawChild = train.price?.child;
      const child = rawChild === undefined || rawChild === null || rawChild === '' ? adult * 0.8 : Number(rawChild);
      return round(Number.isFinite(child) ? child : adult * 0.8);
    }
    const raw = train.price?.[type];
    const amount = raw === undefined || raw === null || raw === '' ? adult : Number(raw);
    return round(Number.isFinite(amount) ? amount : adult);
  }

  function getTrainTotal(train) {
    if (!train) return 0;
    return round((getTrainPrice(train, 'adult') * state.adults) + (getTrainPrice(train, 'child') * state.children));
  }

  function getRoute(direction) {
    if (direction === 'outbound') return ROUTES.outbound[state.outboundFrom];
    return ROUTES.inbound[state.returnTo];
  }

  function getStayMinutes(returnTrain) {
    if (!state.selected.outbound || !returnTrain || state.tripType !== 'roundtrip') return null;
    if (!state.outboundDate || !state.returnDate || state.outboundDate !== state.returnDate) return null;
    const arrival = timeToMinutes(state.selected.outbound.arrivalTime);
    const departure = timeToMinutes(returnTrain.departureTime);
    return departure - arrival;
  }

  function getFilteredTrains(direction) {
    const route = getRoute(direction);
    const outboundOperator = getTrainOperator(state.selected.outbound);
    return state.data.trains
      .filter((train) => !train.isLocalTrain)
      .filter((train) => train.route === route)
      .filter((train) => {
        if (direction === 'outbound') return train.direction === 'outbound';
        return train.direction === 'inbound' || train.direction === 'return';
      })
      .filter((train) => {
        if (direction !== 'return' || state.tripType !== 'roundtrip' || !outboundOperator) return true;
        return getTrainOperator(train) === outboundOperator;
      })
      .sort((a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime) || getTrainOperator(a).localeCompare(getTrainOperator(b)));
  }

  function routePillHtml(direction, station, index) {
    const isOutbound = direction === 'outbound';
    const active = isOutbound ? station === state.outboundFrom : station === state.returnTo;
    const attr = isOutbound ? 'data-outbound-from' : 'data-return-to';
    const hiddenClass = index > 1 ? ' route-pill-extra' : '';
    const label = isOutbound
      ? `${stationLabel(station)} - ${stationLabel('machuPicchu')}`
      : `${stationLabel('machuPicchu')} - ${stationLabel(station)}`;
    return `<button type="button" class="route-pill ${active ? 'is-active' : ''}${hiddenClass}" ${attr}="${station}">${escapeHtml(label)}</button>`;
  }

  function renderStationPills() {
    const outWrap = $('#outboundStationPills');
    const retWrap = $('#returnStationPills');
    if (outWrap) {
      outWrap.classList.toggle('show-all-routes', Boolean(state.routeMore.outbound));
      outWrap.innerHTML = STATION_OPTIONS.map((station, index) => routePillHtml('outbound', station, index)).join('') +
        `<button type="button" class="route-more-toggle" data-route-more="outbound">${escapeHtml(state.routeMore.outbound ? t('routes.seeLess') : t('routes.seeMore'))}</button>`;
    }
    if (retWrap) {
      retWrap.classList.toggle('show-all-routes', Boolean(state.routeMore.return));
      retWrap.innerHTML = STATION_OPTIONS.map((station, index) => routePillHtml('return', station, index)).join('') +
        `<button type="button" class="route-more-toggle" data-route-more="return">${escapeHtml(state.routeMore.return ? t('routes.seeLess') : t('routes.seeMore'))}</button>`;
    }
  }

  function renderSearchState() {
    state.locale = getLocale();
    const paxParts = [`${state.adults} ${state.adults === 1 ? t('pax.adult') : t('pax.adults')}`];
    if (state.children) paxParts.push(`${state.children} ${state.children === 1 ? t('pax.child') : t('pax.children')}`);
    $('#paxLabel').textContent = paxParts.join(', ');
    $('#adultCount').textContent = state.adults;
    $('#childCount').textContent = state.children;
    $('#paxToggle').setAttribute('aria-expanded', String(!$('#paxPanel').hidden));

    const tripSelect = $('#tripTypeSelect');
    if (tripSelect) tripSelect.value = state.tripType;
    $$('.trip-tab').forEach((tab) => {
      const input = $('input', tab);
      tab.classList.toggle('is-active', input?.checked);
    });

    $$('.outbound-field').forEach((el) => { el.style.display = state.tripType === 'returnonly' ? 'none' : ''; });
    $$('.return-field').forEach((el) => { el.style.display = (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? '' : 'none'; });
    const shouldShowOutboundFilters = state.tripType !== 'returnonly' && !state.selected.outbound;
    const shouldShowReturnFilters = (state.tripType === 'returnonly') || (state.tripType === 'roundtrip' && Boolean(state.selected.outbound) && !state.selected.return);
    $$('.outbound-route-block').forEach((el) => { el.style.display = shouldShowOutboundFilters ? '' : 'none'; });
    $$('.return-route-block').forEach((el) => { el.style.display = shouldShowReturnFilters ? '' : 'none'; });
    $('#returnDate').required = state.tripType === 'roundtrip' || state.tripType === 'returnonly';
    $('#outboundDate').required = state.tripType !== 'returnonly';
    $('#outboundRouteLabel').textContent = `${stationLabel(state.outboundFrom, true)} → ${stationLabel('machuPicchu')}${state.outboundDate ? ` · ${formatDateShort(state.outboundDate)}` : ''}`;
    $('#returnRouteLabel').textContent = `${stationLabel('machuPicchu')} → ${stationLabel(state.returnTo, true)}${state.returnDate ? ` · ${formatDateShort(state.returnDate)}` : ''}`;

    const companyRule = $('#companyRuleNote');
    if (companyRule) companyRule.hidden = true;

    renderChildAges();
    renderStationPills();
    applyTrainTranslations();
  }

  function getTripTypeValue() {
    const select = $('#tripTypeSelect');
    if (select) return select.value || 'roundtrip';
    return document.querySelector('input[name=\"tripType\"]:checked')?.value || 'roundtrip';
  }

  function renderChildAges() {
    const wrapper = $('#childAges');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    state.childAges = state.childAges.slice(0, state.children);
    while (state.childAges.length < state.children) state.childAges.push(6);
    state.childAges.forEach((age, index) => {
      const label = document.createElement('label');
      label.innerHTML = `<span>${escapeHtml(t('pax.ageChild'))} ${index + 1}</span><select data-child-age="${index}">${Array.from({ length: 9 }, (_, i) => i + 3).map((n) => `<option value="${n}" ${n === Number(age) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
      wrapper.appendChild(label);
    });
  }

  function renderResults() {
    renderSearchState();
    const showOutbound = state.tripType !== 'returnonly';
    const showReturn = state.tripType === 'returnonly' || (state.tripType === 'roundtrip' && Boolean(state.selected.outbound));

    $$('.outbound-heading, #outboundRouteLabel').forEach((el) => { el.hidden = !showOutbound; });
    if ($('#outboundResults')) {
      $('#outboundResults').hidden = !showOutbound;
      $('#outboundResults').innerHTML = '';
    }
    if (showOutbound) renderTrainList('outbound', $('#outboundResults'));

    $('#returnBlock').hidden = !showReturn;
    if ($('#returnResults')) $('#returnResults').innerHTML = '';
    if (showReturn) renderTrainList('return', $('#returnResults'));

    renderExtrasState();
    renderSummary();
    renderInlineCheckout();
  }

  function renderTrainList(direction, container) {
    const confirmed = state.selected[direction];
    if (confirmed) {
      container.innerHTML = selectedTrainHTML(direction, confirmed);
      return;
    }

    const trains = getFilteredTrains(direction);
    const pendingCode = state.pending[direction]?.code;
    if (!trains.length) {
      container.innerHTML = `<div class="empty-state"><strong>${escapeHtml(t('results.noTrainsTitle'))}</strong><span>${escapeHtml(t('results.noTrainsText'))}</span></div>`;
      return;
    }

    container.innerHTML = trains.map((train) => {
      const pending = train.code === pendingCode;
      const adult = getTrainPrice(train, 'adult');
      const child = getTrainPrice(train, 'child');
      const logo = getCompanyLogo(train);
      const service = train.serviceName || train.category || t('results.train');
      const category = train.category ? train.category.replace(/_/g, ' ') : '';
      const stay = direction === 'return' ? getStayMinutes(train) : null;
      const isImpossibleReturn = pending && stay !== null && stay < 45;
      return `
        <article class="train-card ${pending ? 'is-pending' : ''} ${isImpossibleReturn ? 'has-time-conflict' : ''}" data-train-code="${escapeHtml(train.code)}" data-direction="${direction}" tabindex="0" role="button" aria-pressed="${pending ? 'true' : 'false'}">
          <div class="select-rail"><span class="select-dot" aria-hidden="true"></span></div>
          <div class="train-card-body">
            <div class="train-company">
              <img class="company-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(train.companyName || train.company || 'Tren')}" loading="lazy">
              <div class="train-company-text">
                <b>${escapeHtml(service)}</b>
                <small>${escapeHtml(train.companyName || train.company || category)}</small>
              </div>
            </div>
            <div class="schedule-line">
              <div class="time-box"><small>${escapeHtml(t('results.departure'))}</small><strong>${escapeHtml(train.departureTime)}</strong><span>${escapeHtml(train.departureStation)}</span></div>
              <span class="duration">${escapeHtml(durationText(train.departureTime, train.arrivalTime))}</span>
              <div class="time-box"><small>${escapeHtml(t('results.arrival'))}</small><strong>${escapeHtml(train.arrivalTime)}</strong><span>${escapeHtml(train.arrivalStation)}</span></div>
            </div>
            <div class="price-box">
              <div class="fare-line"><small>${escapeHtml(t('results.adult'))}</small><strong>${money(adult)}</strong><em>${escapeHtml(t('results.perPassenger'))}</em></div>
              ${state.children ? `<div class="fare-line child-fare"><small>${escapeHtml(t('results.child'))}</small><strong>${money(child)}</strong><em>${escapeHtml(t('results.perPassenger'))}</em></div>` : ''}
            </div>
            ${direction === 'return' ? returnAlertHtml(train, pending) : ''}
            ${pending ? trainServiceDetailsHtml(train) : ''}
            <div class="train-card-action">
              ${pending ? `<button type="button" class="select-train-button" data-confirm-train="${direction}" data-train-code="${escapeHtml(train.code)}" ${isImpossibleReturn ? 'disabled aria-disabled="true"' : ''}>${escapeHtml(t('results.selectThisTrain'))}</button>` : ''}
            </div>
          </div>
        </article>`;
    }).join('');
  }

  function selectedTrainHTML(direction, train) {
    const logo = getCompanyLogo(train);
    const title = direction === 'outbound' ? t('summary.outbound') : t('summary.return');
    const modifyText = direction === 'outbound' ? t('results.modifyOutbound') : t('results.modifyReturn');
    return `
      <article class="selected-train-box" data-selected-direction="${direction}">
        <div class="selected-train-box__main">
          <span class="selected-train-box__label">${escapeHtml(t('results.selectedTrain'))}</span>
          <div class="selected-train-box__content">
            <img class="company-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(train.companyName || train.company || 'Tren')}" loading="lazy">
            <div>
              <strong>${escapeHtml(title)}</strong>
              <small class="selected-train-service">${escapeHtml(train.companyName || train.company || '')} ${escapeHtml(train.serviceName || '')}</small>
              <small class="selected-train-date">${escapeHtml(formatDateLong(getTravelDate(direction)))}</small>
              <small class="selected-train-route">${escapeHtml(train.departureStation)} ${escapeHtml(train.departureTime)} → ${escapeHtml(train.arrivalStation)} ${escapeHtml(train.arrivalTime)}</small>
              <small class="selected-train-price">${escapeHtml(money(getTrainTotal(train)))}</small>
            </div>
          </div>
        </div>
        <button type="button" class="secondary-button modify-train-button" data-modify-train="${direction}">${escapeHtml(modifyText)}</button>
      </article>`;
  }

  function renderExtrasState() {
    const canShowExtras = canCheckout();
    $('#summaryExtras').hidden = !canShowExtras;
    const guideSelect = $('#guideCircuit');
    if (guideSelect) {
      const circuit2 = guideSelect.querySelector('option[value="circuit2"]');
      if (circuit2) {
        circuit2.disabled = state.tripType !== 'roundtrip';
        circuit2.textContent = state.tripType === 'roundtrip' ? t('extras.circuit2') : t('extras.circuit2Disabled');
        if (state.tripType !== 'roundtrip' && state.extras.guideCircuit === 'circuit2') {
          state.extras.guideCircuit = 'none';
          guideSelect.value = 'none';
        }
      }
      guideSelect.value = state.extras.guideCircuit;
    }
    const consetur = $('#conseturBusExtra');
    const breakfast = $('#breakfastExtra');
    const lunch = $('#lunchExtra');
    if (consetur) consetur.checked = state.extras.conseturBus;
    if (breakfast) breakfast.checked = state.extras.breakfast;
    if (lunch) lunch.checked = state.extras.lunch;
  }

  function calculateExtras() {
    const pax = getPaxTotal();
    const lines = [];
    let total = 0;

    if (state.extras.guideCircuit === 'circuit2') {
      lines.push({ label: t('extras.guideCircuit2Line'), detail: t('extras.freeRoundtrip'), amount: 0 });
    }
    if (state.extras.guideCircuit === 'circuit1') {
      const amount = EXTRAS.guideCircuit1 * pax;
      lines.push({ label: t('extras.guideCircuit1Line'), detail: t('extras.reducedGroup'), amount });
      total += amount;
    }
    if (state.extras.guideCircuit === 'circuit3') {
      const amount = EXTRAS.guideCircuit3 * pax;
      lines.push({ label: t('extras.guideCircuit3Line'), detail: t('extras.reducedGroup'), amount });
      total += amount;
    }
    if (state.extras.conseturBus) {
      const amount = EXTRAS.conseturRoundtrip * pax;
      lines.push({ label: t('extras.conseturLine'), detail: 'USD 24.00 p/p', amount });
      total += amount;
    }
    if (state.extras.breakfast) {
      const amount = EXTRAS.breakfast * pax;
      lines.push({ label: t('extras.breakfastLine'), detail: t('extras.breakfastDesc'), amount });
      total += amount;
    }
    if (state.extras.lunch) {
      const amount = EXTRAS.lunch * pax;
      lines.push({ label: t('extras.lunchLine'), detail: t('extras.lunchDesc'), amount });
      total += amount;
    }
    lines.push({ label: t('extras.assistance'), detail: '', amount: 0, type: 'assistance' });
    return { total: round(total), lines };
  }

  function calculateTotals() {
    const outbound = state.tripType === 'returnonly' ? 0 : getTrainTotal(state.selected.outbound);
    const returned = (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? getTrainTotal(state.selected.return) : 0;
    const extras = calculateExtras();
    const subtotal = outbound + returned + extras.total;
    return { outbound, returned, extras, total: round(subtotal) };
  }

  function renderSummary() {
    const content = $('#summaryContent');
    const totals = calculateTotals();
    const lines = [];

    if (state.selected.outbound) {
      lines.push(summaryItem(t('summary.outbound'), `${state.selected.outbound.companyName || state.selected.outbound.company} · ${state.selected.outbound.serviceName}`, `${formatDateLong(state.outboundDate)}\n${state.selected.outbound.departureStation} ${state.selected.outbound.departureTime} → ${state.selected.outbound.arrivalStation} ${state.selected.outbound.arrivalTime}`, totals.outbound));
    } else {
      lines.push(`<p>${escapeHtml(t('summary.selectOutbound'))}</p>`);
    }

    if (state.tripType === 'roundtrip') {
      if (state.selected.return) {
        lines.push(summaryItem(t('summary.return'), `${state.selected.return.companyName || state.selected.return.company} · ${state.selected.return.serviceName}`, `${formatDateLong(state.returnDate)}\n${state.selected.return.departureStation} ${state.selected.return.departureTime} → ${state.selected.return.arrivalStation} ${state.selected.return.arrivalTime}`, totals.returned));
      } else if (state.selected.outbound) {
        lines.push(`<p>${escapeHtml(t('summary.selectReturn'))}</p>`);
      }
    }

    if (canCheckout()) {
      totals.extras.lines.forEach((line) => {
        if (line.type === 'assistance') {
          lines.push(`<p class="summary-assistance-note">${escapeHtml(line.label)}</p>`);
        } else {
          lines.push(summaryItem(t('summary.extra'), line.label, line.detail, line.amount));
        }
      });
    }

    content.innerHTML = lines.join('');
    $('#summaryTotal').textContent = money(totals.total);
    $('#checkoutButton').disabled = !canCheckout();
  }

  function summaryItem(kicker, title, detail, amount) {
    const amountText = amount === 0 ? t('summary.included') : money(amount);
    const detailParts = String(detail || '').split('\n').filter(Boolean);
    const detailHtml = detailParts.length
      ? detailParts.map((part, index) => `<small class="${index === 0 ? 'summary-date-line' : 'summary-route-line'}">${escapeHtml(part)}</small>`).join('')
      : '';
    return `<div class="summary-item"><strong class="summary-kicker">${escapeHtml(kicker)}</strong><b class="summary-item-title">${escapeHtml(title)}</b>${detailHtml}<small class="summary-amount">${escapeHtml(amountText)}</small></div>`;
  }

  function canCheckout() {
    if (state.tripType === 'returnonly') return Boolean(state.selected.return);
    if (!state.selected.outbound) return false;
    if (state.tripType === 'roundtrip' && !state.selected.return) return false;
    return true;
  }


  function modalLegHtml(direction, train, date, amount) {
    if (!train) return '';
    const isOutbound = direction === 'outbound';
    const label = isOutbound ? t('modalSummary.outboundBadge') : t('modalSummary.returnBadge');
    const arrow = isOutbound ? '→' : '←';
    const route = `${train.departureStation} - ${train.arrivalStation}`;
    const service = `${train.serviceName || t('results.train')}${train.serviceClass ? ` | ${train.serviceClass}` : ''}`;
    return `
      <div class="modal-trip-leg modal-trip-leg-${direction}">
        <div class="modal-trip-leg-head">
          <span>${escapeHtml(label)} <b>${escapeHtml(arrow)}</b></span>
          <div class="modal-trip-head-text">
            <strong>${escapeHtml(formatDateSummary(date))}</strong>
            <small>${escapeHtml(route)}</small>
          </div>
        </div>
        <div class="modal-trip-timeline">
          <div class="modal-trip-timecol">
            <b>${escapeHtml(train.departureTime)}</b>
            <b>${escapeHtml(train.arrivalTime)}</b>
          </div>
          <div class="modal-trip-line" aria-hidden="true"></div>
          <div class="modal-trip-stationcol">
            <strong>${escapeHtml(train.departureStation)}</strong>
            <span class="modal-trip-service">${escapeHtml(service)}</span>
            <strong>${escapeHtml(train.arrivalStation)}</strong>
          </div>
        </div>
        <div class="modal-trip-price">${escapeHtml(money(amount))}</div>
      </div>`;
  }

  function renderModalTripSummary() {
    const target = $('#modalTripSummary');
    if (!target) return;
    const totals = calculateTotals();
    const paxText = `${getPaxTotal()} ${getPaxTotal() === 1 ? (state.locale === 'en' ? 'Passenger' : 'Pasajero') : (state.locale === 'en' ? 'Passengers' : 'Pasajeros')}`;
    const legs = [];
    if (state.selected.outbound) legs.push(modalLegHtml('outbound', state.selected.outbound, state.outboundDate, totals.outbound));
    if ((state.tripType === 'roundtrip' || state.tripType === 'returnonly') && state.selected.return) legs.push(modalLegHtml('return', state.selected.return, state.returnDate, totals.returned));
    const extras = totals.extras.lines.filter((line) => line.type !== 'assistance');
    const extrasHtml = extras.length ? `
      <div class="modal-trip-included">
        <strong>${escapeHtml(t('modalSummary.extraServices'))}</strong>
        ${extras.map((line) => `<p><span>${escapeHtml(line.label)}</span><b>${escapeHtml(line.amount === 0 ? t('summary.included') : money(line.amount))}</b></p>`).join('')}
      </div>` : '';
    target.innerHTML = `
      <h3>${escapeHtml(t('modalSummary.title'))}</h3>
      <div class="modal-trip-divider"></div>
      <p class="modal-trip-pax">${escapeHtml(t('modalSummary.itinerary'))}: <strong>${escapeHtml(paxText)}</strong></p>
      ${legs.join('')}
      ${extrasHtml}
      <div class="modal-trip-total">
        <span>${escapeHtml(t('modalSummary.subtotal'))}</span><b>${escapeHtml(money(totals.total))}</b>
      </div>
      <div class="modal-trip-grand-total">
        <span>${escapeHtml(t('summary.total'))}</span><b>${escapeHtml(money(totals.total))}</b>
      </div>`;
  }

  function openCheckoutModal() {
    if (!canCheckout()) return;
    buildPassengerForms();
    renderModalTripSummary();
    $('#paymentMessage').hidden = true;
    $('#passengerModal').hidden = false;
  }

  function renderInlineCheckout() {
    let wrap = $('#inlineCheckoutWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'inlineCheckoutWrap';
      wrap.className = 'inline-checkout-wrap';
      wrap.innerHTML = `<button id="inlineCheckoutButton" type="button" class="checkout-button inline-checkout-button">${escapeHtml(t('summary.reserveButton'))}</button>`;
    }
    const anchor = state.tripType === 'oneway' ? $('#outboundResults') : $('#returnBlock');
    anchor?.insertAdjacentElement('afterend', wrap);
    const button = $('#inlineCheckoutButton');
    if (button) button.textContent = t('summary.reserveButton');
    wrap.hidden = !canCheckout();
  }

  const EXTRA_DETAILS = {
    guide: { title: 'extras.detailGuideTitle', text: 'extras.detailGuideText', image: '/assets/img/trenes/extras/guiado-machu-picchu.jpg' },
    bus: { title: 'extras.detailBusTitle', text: 'extras.detailBusText', image: '/assets/img/trenes/extras/bus-consetur.jpg' },
    breakfast: { title: 'extras.detailBreakfastTitle', text: 'extras.detailBreakfastText', image: '/assets/img/trenes/extras/desayuno-power-peruano.jpg' },
    lunch: { title: 'extras.detailLunchTitle', text: 'extras.detailLunchText', image: '/assets/img/trenes/extras/almuerzo-power-peruano.jpg' }
  };



  const TRAIN_SERVICE_DETAILS = {
    voyager: {
      base: '/trenes/assets/img/',
      files: ['the-voyager1.jpg', 'the-voyager2.jpg', 'the-voyager3.jpg', 'the-voyager4.jpg'],
      title: 'The Voyager — Inca Rail',
      bullets: [
        'Asientos cómodos y ergonómicos para un viaje agradable.',
        'Venta de snacks y bebidas elaborados con ingredientes locales.',
        'Experiencia cultural con la puesta en escena del drama Ollantay.',
        'Servicio práctico, cómodo y turístico hacia Machu Picchu.',
        'Ideal para quienes buscan una opción funcional con valor cultural.'
      ]
    },
    prime: {
      base: '/trenes/assets/img/',
      files: ['the-prime1.jpg', 'the-prime2.jpg', 'the-prime3.jpg', 'the-prime4.jpg'],
      title: 'The Prime — Inca Rail',
      bullets: [
        'Asientos amplios y ambiente de mayor confort.',
        'Snack andino de cortesía durante el viaje.',
        'Música andina en vivo interpretada por artistas locales.',
        'Puesta en escena del drama Ollantay en la ruta de ida.',
        'Una experiencia más premium, cómoda y cultural.'
      ]
    },
    '360': {
      base: '/trenes/assets/img/',
      files: ['the-3601.jpg', 'the-3602.jpg', 'the-3603.jpg', 'the-3604.jpg'],
      title: 'The 360° — Inca Rail',
      bullets: [
        'Vagón observatorio al aire libre para disfrutar los Andes.',
        'Vistas panorámicas ideales para fotografías.',
        'Entretenimiento digital con información de la ruta.',
        'Wi-Fi disponible para mensajería, según disponibilidad.',
        'Música andina en vivo en la ruta de regreso.',
        'Ideal para viajeros que buscan paisajes y experiencia visual.'
      ]
    },
    first_class: {
      base: '/trenes/assets/img/',
      files: ['the-first-class1.jpg', 'the-first-class2.jpg', 'the-first-class3.jpg', 'the-first-class4.jpg'],
      title: 'The First Class — Inca Rail',
      bullets: [
        'Vagón lounge/bar con ambiente elegante.',
        'Balcón al aire libre para contemplar el paisaje.',
        'Menú gourmet de 3 tiempos a bordo.',
        'Vinos, cócteles y sabores locales durante el trayecto.',
        'Música andina en vivo y experiencia mística.',
        'Incluye traslado premium privado hacia la estación.'
      ]
    },
    expedition: {
      base: '/trenes/assets/img/',
      files: ['expedition1.jpg', 'expedition2.jpg', 'expedition3.jpg', 'expedition4.jpg'],
      title: 'Expedition — PeruRail',
      bullets: [
        'Asientos cómodos para un viaje seguro y agradable.',
        'Música ambiental durante el recorrido.',
        'Venta de alimentos y bebidas a bordo.',
        'Equipaje de mano permitido: 8 kg / 115 cm lineales.',
        'Acceso a sala de espera en Ollantaytambo, según disponibilidad.',
        'Opción ideal para un viaje práctico hacia Machu Picchu.'
      ]
    },
    vistadome: {
      base: '/trenes/assets/img/',
      files: ['vistadome1.jpg', 'vistadome2.jpg', 'vistadome3.jpg', 'vistadome4.jpg'],
      title: 'Vistadome — PeruRail',
      bullets: [
        'Ventanas panorámicas para disfrutar el paisaje andino.',
        'Asientos cómodos con mesas.',
        'Snack y bebida de cortesía.',
        'Representación cultural en vivo, según ruta.',
        'Desfile de prendas de baby alpaca.',
        'Audio turístico y música ambiental a bordo.'
      ]
    },
    vistadome_observatory: {
      base: '/trenes/assets/img/',
      files: ['vistadome-observatory1.jpg', 'vistadome-observatory2.jpg', 'vistadome-observatory3.jpg', 'vistadome-observatory4.jpg'],
      title: 'Vistadome Observatory — PeruRail',
      bullets: [
        'Coche observatorio con balcón abierto.',
        'Ventanas panorámicas para mejores vistas.',
        'Coche bar con bebidas y show a bordo.',
        'Snack y bebida de cortesía.',
        'Danza y música típica en vivo.',
        'Desfile de prendas de baby alpaca.',
        'Ideal para quienes desean una experiencia más escénica.'
      ]
    },
    hiram_bingham: {
      base: '/trenes/assets/img/',
      files: ['hiram-bingham1.jpg', 'hiram-bingham2.jpg', 'hiram-bingham3.jpg', 'hiram-bingham4.jpg'],
      title: 'Hiram Bingham — PeruRail',
      bullets: [
        'Tren de lujo con servicio exclusivo.',
        'Sala VIP con show en vivo antes del embarque.',
        'Coche observatorio con balcón abierto.',
        'Coche bar con bebidas y cócteles seleccionados.',
        'Servicio gourmet a bordo con almuerzo y cena.',
        'Incluye ingreso, bus y guía a Machu Picchu, según tramo contratado.'
      ]
    }
  };



  const TRAIN_SERVICE_DETAILS_EN = {
    voyager: {
      title: 'The Voyager — Inca Rail',
      bullets: [
        'Comfortable, ergonomic seats for a pleasant journey.',
        'Snacks and drinks made with local ingredients available for purchase.',
        'Cultural experience with the live staging of the Ollantay drama.',
        'A practical, comfortable and tourist-friendly service to Machu Picchu.',
        'Ideal for travelers looking for a functional option with cultural value.'
      ]
    },
    prime: {
      title: 'The Prime — Inca Rail',
      bullets: [
        'Spacious seats and a higher-comfort atmosphere.',
        'Complimentary Andean-inspired snack during the journey.',
        'Live Andean music performed by local artists.',
        'Live staging of the Ollantay drama on the outbound route.',
        'A more premium, comfortable and cultural experience.'
      ]
    },
    '360': {
      title: 'The 360° — Inca Rail',
      bullets: [
        'Open-air observatory car to enjoy the Andes.',
        'Panoramic views ideal for photography.',
        'Digital entertainment with information about the route.',
        'Wi-Fi available for messaging, subject to availability.',
        'Live Andean music on the return route.',
        'Ideal for travelers looking for scenery and a visual experience.'
      ]
    },
    first_class: {
      title: 'The First Class — Inca Rail',
      bullets: [
        'Elegant lounge/bar car atmosphere.',
        'Open-air balcony to enjoy the landscape.',
        'Three-course gourmet menu onboard.',
        'Wine, cocktails and local flavors during the journey.',
        'Live Andean music and a mystical experience.',
        'Includes premium private transfer to the station.'
      ]
    },
    expedition: {
      title: 'Expedition — PeruRail',
      bullets: [
        'Comfortable seats for a safe and pleasant journey.',
        'Ambient music during the trip.',
        'Food and drinks available for purchase onboard.',
        'Allowed hand luggage: 8 kg / 115 linear cm.',
        'Access to the waiting room in Ollantaytambo, subject to availability.',
        'An ideal option for a practical trip to Machu Picchu.'
      ]
    },
    vistadome: {
      title: 'Vistadome — PeruRail',
      bullets: [
        'Panoramic windows to enjoy the Andean landscape.',
        'Comfortable seats with tables.',
        'Complimentary snack and drink.',
        'Live cultural performance, depending on the route.',
        'Baby alpaca garment fashion show.',
        'Tourist audio and ambient music onboard.'
      ]
    },
    vistadome_observatory: {
      title: 'Vistadome Observatory — PeruRail',
      bullets: [
        'Observatory car with open balcony.',
        'Panoramic windows for better views.',
        'Bar car with drinks and onboard show.',
        'Complimentary snack and drink.',
        'Live traditional music and dance.',
        'Baby alpaca garment fashion show.',
        'Ideal for travelers who want a more scenic experience.'
      ]
    },
    hiram_bingham: {
      title: 'Hiram Bingham — PeruRail',
      bullets: [
        'Luxury train with exclusive service.',
        'VIP lounge with live show before boarding.',
        'Observatory car with open balcony.',
        'Bar car with selected drinks and cocktails.',
        'Gourmet onboard service with lunch and dinner.',
        'Includes entrance, bus and guide to Machu Picchu, depending on the booked route.'
      ]
    }
  };
  function getTrainServiceKey(train) {
    const raw = `${train.category || ''} ${train.serviceName || ''}`.toLowerCase();
    if (raw.includes('hiram')) return 'hiram_bingham';
    if (raw.includes('observatory')) return 'vistadome_observatory';
    if (raw.includes('vistadome')) return 'vistadome';
    if (raw.includes('expedition')) return 'expedition';
    if (raw.includes('first')) return 'first_class';
    if (raw.includes('360')) return '360';
    if (raw.includes('prime')) return 'prime';
    if (raw.includes('voyager')) return 'voyager';
    return '';
  }

  function trainServiceDetailsHtml(train) {
    const key = getTrainServiceKey(train);
    const detailBase = TRAIN_SERVICE_DETAILS[key];
    if (!detailBase) return '';
    const localizedDetail = state.locale === 'en' ? (TRAIN_SERVICE_DETAILS_EN[key] || {}) : {};
    const detail = Object.assign({}, detailBase, localizedDetail);
    const images = detailBase.files.map((file) => `${detailBase.base}${file}`);
    return `
      <div class="train-service-preview" data-train-service-preview>
        <div class="train-service-slider-wrap">
          <button type="button" class="train-service-nav train-service-prev" data-service-slide="prev" aria-label="Imagen anterior">‹</button>
          <div class="train-service-slider" data-service-slider>
            ${images.map((src, index) => `<img src="${escapeHtml(encodeURI(src))}" alt="${escapeHtml(detail.title)} ${index + 1}" loading="lazy" onerror="this.style.display='none'">`).join('')}
          </div>
          <button type="button" class="train-service-nav train-service-next" data-service-slide="next" aria-label="Imagen siguiente">›</button>
        </div>
        <div class="train-service-copy">
          <strong>${escapeHtml(detail.title)}</strong>
          <ul>${detail.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </div>
      </div>`;
  }

  function returnAlertHtml(train, isPending) {
    if (!isPending) return '';
    const stay = getStayMinutes(train);
    if (stay === null) return '';
    if (stay < 45) {
      return `<div class="train-time-alert train-time-alert-danger">No es posible seleccionar este tren porque se cruza con el horario de llegada del tren de ida.</div>`;
    }
    if (stay < 240) {
      return `<div class="train-time-alert train-time-alert-warning">Tiempo de estadía corto en Machu Picchu. Revisa bien tus fechas y horarios antes de reservar.</div>`;
    }
    return '';
  }

  function showExtraDetail(key) {
    const detail = EXTRA_DETAILS[key];
    if (!detail) return;
    let modal = $('#extraDetailModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'extraDetailModal';
      modal.className = 'modal extra-detail-modal';
      modal.hidden = true;
      modal.innerHTML = `
        <div class="modal-backdrop" data-close-extra-detail></div>
        <section class="modal-panel extra-detail-panel" role="dialog" aria-modal="true" aria-labelledby="extraDetailTitle">
          <button class="modal-close" type="button" data-close-extra-detail>×</button>
          <img id="extraDetailImage" class="extra-detail-image" src="" alt="" loading="lazy">
          <div class="extra-detail-content">
            <div class="modal-titlebar" id="extraDetailTitle"></div>
            <p id="extraDetailText"></p>
            <button type="button" class="secondary-button" data-close-extra-detail>${escapeHtml(t('extras.detailClose'))}</button>
          </div>
        </section>`;
      document.body.appendChild(modal);
    }
    $('#extraDetailImage', modal).src = detail.image;
    $('#extraDetailImage', modal).alt = t(detail.title);
    $('#extraDetailTitle', modal).textContent = t(detail.title);
    $('#extraDetailText', modal).textContent = t(detail.text);
    const closeBtn = modal.querySelector('.secondary-button');
    if (closeBtn) closeBtn.textContent = t('extras.detailClose');
    modal.hidden = false;
  }

  function closeExtraDetail() {
    const modal = $('#extraDetailModal');
    if (modal) modal.hidden = true;
  }

  function markTrain(direction, code) {
    if (state.selected[direction]) return;
    const train = state.data.trains.find((item) => item.code === code);
    if (!train) return;
    state.pending[direction] = train;
    renderResults();
  }

  function confirmTrain(direction, code) {
    const train = state.data.trains.find((item) => item.code === code) || state.pending[direction];
    if (!train) return;
    if (direction === 'return' && state.tripType === 'roundtrip') {
      const stay = getStayMinutes(train);
      if (stay !== null && stay < 45) {
        state.pending[direction] = train;
        renderResults();
        return;
      }
    }
    state.selected[direction] = train;
    state.pending[direction] = null;
    if (direction === 'outbound') {
      state.pending.return = null;
      if (state.selected.return) {
        const outOp = getTrainOperator(train);
        const retOp = getTrainOperator(state.selected.return);
        if (outOp !== retOp) state.selected.return = null;
      }
      if (state.tripType === 'roundtrip') {
        // En móvil volvemos al inicio del flujo para que se vea el panel de selección.
      }
    }
    renderResults();
    scrollAfterTrainConfirm(direction);
  }

  function modifyTrain(direction) {
    if (!state.selected[direction]) return;
    state.pending[direction] = state.selected[direction];
    state.selected[direction] = null;
    if (direction === 'outbound') {
      state.selected.return = null;
      state.pending.return = null;
    }
    renderResults();
  }

  function getRegionName(code) {
    try {
      const display = new Intl.DisplayNames([state.locale === 'en' ? 'en' : 'es'], { type: 'region' });
      return display.of(code) || code;
    } catch (error) {
      return code === 'PE' ? (state.locale === 'en' ? 'Peru' : 'Perú') : code;
    }
  }

  function countryOptions(selected = '') {
    const placeholder = `<option value="" ${selected ? '' : 'selected'} disabled>${escapeHtml(t('modal.nationality'))}</option>`;
    return placeholder + COUNTRY_CODES
      .map((code) => ({ code, name: getRegionName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, state.locale === 'en' ? 'en' : 'es'))
      .map(({ code, name }) => `<option value="${escapeHtml(name)}" data-country-code="${code}" ${code === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');
  }

  function phoneCodeOptions(selected = '+51') {
    return PHONE_CODES.map(([country, code]) => `<option value="${escapeHtml(code)}" ${code === selected ? 'selected' : ''}>${escapeHtml(code)} · ${escapeHtml(country)}</option>`).join('');
  }

  function buildPassengerForms() {
    const wrapper = $('#passengerForms');
    const total = getPaxTotal();
    wrapper.innerHTML = Array.from({ length: total }, (_, i) => {
      const isLead = i === 0;
      const type = i < state.adults ? t('modal.adult') : t('modal.child');
      const whatsappLabel = isLead ? `${t('modal.whatsapp')} *` : t('modal.whatsappOptional');
      const emailLabel = isLead ? `${t('modal.email')} *` : t('modal.emailOptional');
      return `
        <section class="passenger-box ${isLead ? 'is-open' : ''}" data-passenger-index="${i}">
          <button type="button" class="passenger-toggle" data-passenger-toggle="${i}" aria-expanded="${isLead ? 'true' : 'false'}">
            <span>${escapeHtml(t('modal.passenger'))} ${i + 1} · ${escapeHtml(type)}${isLead ? ` · ${escapeHtml(t('modal.lead'))}` : ''}</span>
          </button>
          <div class="passenger-grid">
            <label><span>${escapeHtml(t('modal.firstName'))} *</span><input name="firstName_${i}" required autocomplete="given-name" placeholder="${escapeHtml(t('modal.firstName'))}"></label>
            <label><span>${escapeHtml(t('modal.lastName'))} *</span><input name="lastName_${i}" required autocomplete="family-name" placeholder="${escapeHtml(t('modal.lastName'))}"></label>
            <label><span>${escapeHtml(t('modal.nationality'))} *</span><select name="nationality_${i}" required>${countryOptions('')}</select></label>
            <label><span>${escapeHtml(t('modal.docType'))} *</span><select name="docType_${i}" required><option value="" selected disabled>${escapeHtml(t('modal.docType'))}</option><option value="DNI">${escapeHtml(t('modal.dni'))}</option><option value="PASSPORT">${escapeHtml(t('modal.passport'))}</option><option value="CE">${escapeHtml(t('modal.ce'))}</option><option value="OTHER">${escapeHtml(t('modal.other'))}</option></select></label>
            <label><span>${escapeHtml(t('modal.docNumber'))} *</span><input name="docNumber_${i}" required placeholder="${escapeHtml(t('modal.docNumber'))}"></label>
            <label><span>${escapeHtml(t('modal.birthDate'))} *</span><input name="birthDate_${i}" type="date" required></label>
            <label class="phone-field"><span>${escapeHtml(whatsappLabel)}</span><div class="phone-group"><select name="whatsappCode_${i}" ${isLead ? 'required' : ''} aria-label="${escapeHtml(t('modal.phoneCode'))}">${phoneCodeOptions('+51')}</select><input name="whatsappNumber_${i}" ${isLead ? 'required' : ''} autocomplete="tel" placeholder="${escapeHtml(t('modal.phoneNumber'))}"></div></label>
            <label><span>${escapeHtml(emailLabel)}</span><input name="email_${i}" type="email" ${isLead ? 'required' : ''} autocomplete="email" placeholder="${escapeHtml(t('modal.email'))}"></label>
          </div>
        </section>`;
    }).join('');
  }

  function collectPassengers(form) {
    const total = getPaxTotal();
    return Array.from({ length: total }, (_, i) => {
      const whatsappCode = clean(form[`whatsappCode_${i}`]?.value);
      const whatsappNumber = clean(form[`whatsappNumber_${i}`]?.value);
      return {
        index: i + 1,
        type: i < state.adults ? 'adult' : 'child',
        firstName: clean(form[`firstName_${i}`]?.value),
        lastName: clean(form[`lastName_${i}`]?.value),
        nationality: clean(form[`nationality_${i}`]?.value),
        docType: clean(form[`docType_${i}`]?.value),
        docNumber: clean(form[`docNumber_${i}`]?.value),
        birthDate: clean(form[`birthDate_${i}`]?.value),
        age: i < state.adults ? null : Number(state.childAges[i - state.adults] || 0),
        whatsappCode,
        whatsappNumber,
        whatsapp: clean(`${whatsappCode} ${whatsappNumber}`),
        email: clean(form[`email_${i}`]?.value)
      };
    });
  }

  function buildOrderPayload(passengers) {
    const totals = calculateTotals();
    const code = generateCode();
    const lead = passengers[0] || {};
    return {
      code,
      createdAt: new Date().toISOString(),
      status: 'Pendiente de pago',
      source: 'trenes-web',
      currency: 'USD',
      exchangeRate: CONFIG.exchangeRate,
      tripType: state.tripType,
      dates: { outbound: state.tripType === 'returnonly' ? '' : state.outboundDate, return: (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? state.returnDate : '' },
      route: {
        outboundFrom: state.outboundFrom,
        outboundRoute: getRoute('outbound'),
        returnTo: (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? state.returnTo : '',
        returnRoute: (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? getRoute('return') : ''
      },
      passengers,
      lead,
      pax: { adults: state.adults, children: state.children, childAges: state.childAges },
      trains: {
        outbound: state.tripType === 'returnonly' ? null : serializeTrain(state.selected.outbound),
        return: (state.tripType === 'roundtrip' || state.tripType === 'returnonly') ? serializeTrain(state.selected.return) : null
      },
      extras: {
        selected: Object.assign({}, state.extras),
        lines: totals.extras.lines
      },
      amounts: {
        outbound: round(totals.outbound),
        return: round(totals.returned),
        extras: round(totals.extras.total),
        totalUsd: round(totals.total),
        totalPen: round(totals.total * CONFIG.exchangeRate)
      }
    };
  }

  function serializeTrain(train) {
    if (!train) return null;
    return {
      code: train.code,
      company: train.company,
      companyName: train.companyName,
      operatorKey: train.operatorKey,
      serviceName: train.serviceName,
      category: train.category,
      route: train.route,
      departureStation: train.departureStation,
      arrivalStation: train.arrivalStation,
      departureTime: train.departureTime,
      arrivalTime: train.arrivalTime,
      price: {
        adult: getTrainPrice(train, 'adult'),
        child: getTrainPrice(train, 'child')
      }
    };
  }

  function generateCode() {
    const hexTime = Date.now().toString(16).toUpperCase();
    const random = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, '0');
    return `${CONFIG.bookingPrefix || 'CUZ-T'}-${hexTime}-${random}`;
  }

  async function sendToAppsScript(action, payload) {
    if (!CONFIG.appsScriptUrl || CONFIG.appsScriptUrl.includes('PEGAR_AQUI')) {
      return { ok: false, message: t('modal.missingAppsScript') };
    }
    const res = await fetch(CONFIG.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload })
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch (err) { return { ok: false, message: t('modal.invalidResponse'), raw: text }; }
  }

  function showPaymentMessage(message, type = 'info') {
    const box = $('#paymentMessage');
    box.hidden = false;
    box.className = `payment-message is-${type}`;
    box.textContent = message;
  }

  async function handlePassengerSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    $$('.passenger-box', form).forEach((box) => {
      box.classList.add('is-open');
      box.querySelector('.passenger-toggle')?.setAttribute('aria-expanded', 'true');
    });
    if (!form.reportValidity()) return;
    const passengers = collectPassengers(form.elements);
    const payload = buildOrderPayload(passengers);
    showPaymentMessage(t('modal.creating'), 'info');
    localStorage.setItem('mct_train_pending_order', JSON.stringify(payload));

    const orderResult = await sendToAppsScript('createTrainOrder', payload);
    if (!orderResult.ok) {
      showPaymentMessage(orderResult.message || t('modal.orderError'), 'error');
      return;
    }

    showPaymentMessage(t('modal.connecting'), 'info');
    const paypalResult = await sendToAppsScript('createPayPalTrainOrder', { code: payload.code, total: payload.amounts.totalUsd, currency: 'USD' });
    if (paypalResult.ok && paypalResult.approvalUrl) {
      localStorage.setItem('mct_train_last_code', payload.code);
      window.location.assign(paypalResult.approvalUrl);
      return;
    }
    showPaymentMessage(paypalResult.message || t('modal.paypalError'), 'error');
  }

  function handleRouteChange() {
    state.selected.outbound = null;
    state.selected.return = null;
    state.pending.outbound = null;
    state.pending.return = null;
    renderResults();
  }

  function handleTripTypeChange() {
    state.tripType = getTripTypeValue();
    if (state.tripType === 'oneway') {
      state.selected.return = null;
      state.pending.return = null;
    }
    if (state.tripType === 'returnonly') {
      state.selected.outbound = null;
      state.pending.outbound = null;
    }
    syncDateLimits();
    updateSearchCollapsedSummary();
    renderResults();
  }

  function bindEvents() {
    $('#trainSearchForm').addEventListener('submit', (event) => {
      event.preventDefault();
      state.tripType = getTripTypeValue();
      syncDateLimits();
      state.outboundDate = $('#outboundDate').value;
      state.returnDate = $('#returnDate').value;
      if (state.tripType === 'roundtrip' && state.returnDate < state.outboundDate) {
        state.returnDate = state.outboundDate;
        $('#returnDate').value = state.returnDate;
      }
      state.selected.outbound = null;
      state.selected.return = null;
      state.pending.outbound = null;
      state.pending.return = null;
      state.routeMore.outbound = false;
      state.routeMore.return = false;
      renderResults();
      collapseSearchOnMobile();
      $('.results-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $$('input[name="tripType"]').forEach((input) => input.addEventListener('change', handleTripTypeChange));
    $('#tripTypeSelect')?.addEventListener('change', handleTripTypeChange);
    $('#outboundDate').addEventListener('change', (e) => {
      state.outboundDate = e.target.value;
      syncDateLimits();
      state.returnDate = $('#returnDate').value;
      updateSearchCollapsedSummary();
    });
    $('#returnDate').addEventListener('change', (e) => {
      syncDateLimits();
      state.returnDate = $('#returnDate').value || e.target.value;
      updateSearchCollapsedSummary();
    });

    $('#paxToggle').addEventListener('click', () => {
      $('#paxPanel').hidden = !$('#paxPanel').hidden;
      $('#paxToggle').setAttribute('aria-expanded', String(!$('#paxPanel').hidden));
    });

    document.addEventListener('click', (event) => {
      const collapsedSearch = event.target.closest('#trainSearchForm.is-collapsed');
      if (collapsedSearch) {
        expandSearch();
        return;
      }

      if (!event.target.closest('.pax-field')) {
        $('#paxPanel').hidden = true;
        $('#paxToggle')?.setAttribute('aria-expanded', 'false');
      }

      const paxDone = event.target.closest('[data-pax-done]');
      if (paxDone) {
        $('#paxPanel').hidden = true;
        $('#paxToggle')?.setAttribute('aria-expanded', 'false');
        return;
      }

      const routeMore = event.target.closest('[data-route-more]');
      if (routeMore) {
        const key = routeMore.dataset.routeMore === 'return' ? 'return' : 'outbound';
        state.routeMore[key] = !state.routeMore[key];
        renderStationPills();
        return;
      }

      const outbound = event.target.closest('[data-outbound-from]');
      if (outbound) {
        state.outboundFrom = outbound.dataset.outboundFrom;
        handleRouteChange();
        return;
      }

      const returned = event.target.closest('[data-return-to]');
      if (returned) {
        state.returnTo = returned.dataset.returnTo;
        state.selected.return = null;
        state.pending.return = null;
        renderResults();
        return;
      }

      const step = event.target.closest('[data-pax]');
      if (step) {
        const target = step.dataset.pax;
        const delta = Number(step.dataset.delta || 0);
        if (target === 'adults') state.adults = Math.max(1, Math.min(30, state.adults + delta));
        if (target === 'children') state.children = Math.max(0, Math.min(20, state.children + delta));
        renderResults();
        return;
      }

      const slideControl = event.target.closest('[data-service-slide]');
      if (slideControl) {
        const preview = slideControl.closest('.train-service-preview');
        const slider = preview?.querySelector('[data-service-slider]');
        if (slider) {
          const slides = Array.from(slider.querySelectorAll('img')).filter((img) => img.style.display !== 'none');
          const totalSlides = Math.max(1, slides.length);
          const currentIndex = Math.round(slider.scrollLeft / Math.max(1, slider.clientWidth));
          const direction = slideControl.dataset.serviceSlide === 'next' ? 1 : -1;
          const nextIndex = (currentIndex + direction + totalSlides) % totalSlides;
          slider.scrollTo({ left: nextIndex * slider.clientWidth, behavior: 'smooth' });
        }
        return;
      }

      const confirm = event.target.closest('[data-confirm-train]');
      if (confirm) {
        confirmTrain(confirm.dataset.confirmTrain, confirm.dataset.trainCode);
        return;
      }

      const modify = event.target.closest('[data-modify-train]');
      if (modify) {
        modifyTrain(modify.dataset.modifyTrain);
        return;
      }

      const card = event.target.closest('.train-card[data-train-code]');
      if (card) {
        markTrain(card.dataset.direction, card.dataset.trainCode);
        return;
      }

      const togglePassenger = event.target.closest('[data-passenger-toggle]');
      if (togglePassenger) {
        const box = togglePassenger.closest('.passenger-box');
        const open = !box.classList.contains('is-open');
        box.classList.toggle('is-open', open);
        togglePassenger.setAttribute('aria-expanded', String(open));
        return;
      }

      if (event.target.matches('[data-close-modal]')) closeModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target.closest?.('[data-confirm-train], [data-modify-train]')) return;
        const card = event.target.closest?.('.train-card[data-train-code]');
        if (card) {
          event.preventDefault();
          markTrain(card.dataset.direction, card.dataset.trainCode);
        }
      }
      if (event.key === 'Escape' && !$('#passengerModal').hidden) closeModal();
      if (event.key === 'Escape' && $('#extraDetailModal') && !$('#extraDetailModal').hidden) closeExtraDetail();
    });

    document.addEventListener('change', (event) => {
      if (event.target.matches('[data-child-age]')) {
        state.childAges[Number(event.target.dataset.childAge)] = Number(event.target.value);
        return;
      }
      if (event.target.id === 'guideCircuit') { state.extras.guideCircuit = event.target.value; renderSummary(); }
      if (event.target.id === 'conseturBusExtra') { state.extras.conseturBus = event.target.checked; renderSummary(); }
      if (event.target.id === 'breakfastExtra') { state.extras.breakfast = event.target.checked; renderSummary(); }
      if (event.target.id === 'lunchExtra') { state.extras.lunch = event.target.checked; renderSummary(); }
    });

    $('#checkoutButton').addEventListener('click', openCheckoutModal);
    document.addEventListener('click', (event) => {
      if (event.target.closest('#inlineCheckoutButton')) openCheckoutModal();
      if (event.target.closest('[data-extra-detail]')) showExtraDetail(event.target.closest('[data-extra-detail]').dataset.extraDetail);
      if (event.target.closest('[data-close-extra-detail]')) closeExtraDetail();
    });
    $('#passengerForm').addEventListener('submit', handlePassengerSubmit);

    window.addEventListener('mct:i18n-ready', () => {
      state.locale = getLocale();
      applyTrainTranslations();
      renderResults();
    });
  }

  function closeModal() {
    $('#passengerModal').hidden = true;
  }

  async function loadTrains() {
    const res = await fetch(CONFIG.trainsJsonPath, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar el JSON de trenes.');
    const data = await res.json();
    state.data.trains = Array.isArray(data.trains) ? data.trains : [];
  }

  async function init() {
    const outDate = todayISO(2);
    const retDate = outDate;
    $('#outboundDate').value = outDate;
    $('#returnDate').value = retDate;
    state.outboundDate = outDate;
    state.returnDate = retDate;
    syncDateLimits();
    updateSearchCollapsedSummary();
    applyTrainTranslations();

    try {
      await loadTrains();
    } catch (err) {
      $('#outboundResults').innerHTML = `<div class="empty-state"><strong>Error cargando trenes.</strong><span>${escapeHtml(err.message)}</span></div>`;
      return;
    }
    bindEvents();
    renderResults();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
