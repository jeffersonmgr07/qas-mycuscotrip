"use strict";

/**
 * My Cusco Trip - Cotizador dinámico de paquetes
 * Restaura el flujo inteligente de quote-packages.html:
 * fechas + horarios -> paquetes compatibles -> itinerario -> hoteles -> trenes -> extras -> resumen -> impresión/PDF.
 */
(function () {
  const DATA_PATHS = {
    packagesCusco: "./assets/data/packages-cusco.json",
    toursCusco: "./assets/data/tours-cusco.json",
    toursMachuPicchu: "./assets/data/tours-machu-picchu.json",
    trekkingsCusco: "./assets/data/trekkings-cusco.json",
    hotels: "./assets/data/hotels.json",
    trains: "./assets/data/trains.json",
    discounts: "./assets/data/discount-codes.json"
  };

  const EXCHANGE_FALLBACK = 3.75;

  function getQuoteLocale() {
    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || window.MCT_LOCALE || document.documentElement.lang || "es";
    const lang = String(locale || "es").slice(0, 2).toLowerCase();
    const map = { es: "es-PE", en: "en-US", pt: "pt-BR", fr: "fr-FR", de: "de-DE", it: "it-IT", ja: "ja-JP", zh: "zh-CN" };
    return map[lang] || "es-PE";
  }

  function getQuoteLang() {
    return String(window.MyCuscoTripI18n?.getLocaleFromUrl?.() || window.MCT_LOCALE || document.documentElement.lang || "es").slice(0, 2).toLowerCase();
  }

  function resolveDataPath(path) {
    if (!path || /^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    const base = window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
    let clean = String(path).replace(/^\.?\//, "");
    const lang = getQuoteLang();
    const localizable = new Set(["packages-cusco.json", "tours-cusco.json", "tours-machu-picchu.json", "trekkings-cusco.json", "hotels.json", "trains.json"]);
    const filename = clean.split("/").pop();
    if (lang && lang !== "es" && clean.startsWith("assets/data/") && localizable.has(filename)) {
      clean = `assets/data/i18n/${lang}/${filename}`;
    }
    return `${base}${clean}`;
  }

  function trText(value) {
    return window.MyCuscoTripI18n?.translateText?.(value) || value;
  }

  const STORAGE_KEY = "mct_quote_package_state_v18";

  const state = {
    data: {},
    exchangeRate: EXCHANGE_FALLBACK,
    dates: { start: null, end: null, days: 0, nights: 0 },
    arrivalTime: "09:00",
    departureTime: "20:00",
    adults: 2,
    children: 0,
    nationality: "national",
    currency: "PEN",
    options: [],
    selectedOptionIndex: -1,
    selectedHotels: {},
    selectedTrains: { outbound: null, return: null },
    selectedExtras: new Set(),
    manualDiscount: null,
    showAllItineraryOptions: false,
    activeHotelDestination: null,
    pendingHotelKey: null,
    activeTrainDirection: null,
    pendingTrainCode: null
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function clampNumber(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.min(max, Math.max(min, parsed));
  }

  function parseISODate(value) {
    if (!value) return null;
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDate(date) {
    if (!date) return "Por completar";
    try {
      return new Intl.DateTimeFormat(getQuoteLocale(), { day: "2-digit", month: "short", year: "numeric" }).format(date);
    } catch (_) {
      return date.toISOString().slice(0, 10);
    }
  }

  function formatDateShort(date) {
    if (!date) return "--/--/----";
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + Number(days || 0));
    return next;
  }

  function getDateDiffDays(start, end) {
    if (!start || !end) return 0;
    const oneDay = 24 * 60 * 60 * 1000;
    const startUTC = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUTC = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUTC - startUTC) / oneDay);
  }

  function getPassengerCount() {
    return state.adults + state.children;
  }

  function getSelectedOption() {
    return state.options[state.selectedOptionIndex] || null;
  }

  function getAllTours() {
    return [
      ...toArray(state.data.toursCusco?.products),
      ...toArray(state.data.toursMachuPicchu?.tours),
      ...toArray(state.data.trekkingsCusco?.products)
    ];
  }

  function findTourByCode(code) {
    return getAllTours().find((tour) => tour?.internalCode === code || tour?.id === code || tour?.slug === code) || null;
  }

  function isMachuPicchuTour(tour) {
    return normalizeText(tour?.category).includes("machu") || normalizeText(tour?.internalCode).startsWith("mapi");
  }

  function getOptionTours(option) {
    if (!option) return [];
    const directTours = toArray(option.includedTours);
    const directCodes = new Set(directTours.map((tour) => tour?.internalCode).filter(Boolean));
    const fromCodes = toArray(option.includedTourCodes)
      .filter((code) => !directCodes.has(code))
      .map(findTourByCode)
      .filter(Boolean);
    return [...directTours, ...fromCodes];
  }

  function getMachuTour(option = getSelectedOption()) {
    return getOptionTours(option).find(isMachuPicchuTour) || null;
  }

  function resolveAssetPath(path) {
    if (!path) return "./assets/img/placeholder/experience.jpg";
    const value = String(path);
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    return value.replace(/^\/?assets\//, "./assets/").replace(/^\.\.\/assets\//, "./assets/");
  }

  function getImageFromTour(tour) {
    return resolveAssetPath(tour?.images?.cover || tour?.image || "./assets/img/placeholder/experience.jpg");
  }

  function getActivityImage(activity, day) {
    if (activity?.tour) return getImageFromTour(activity.tour);

    const title = normalizeText(activity?.syntheticTitle || activity?.note || "");
    const totalDays = Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1);

    if ((title.includes("traslado") && day?.day === totalDays) || day?.day === totalDays) {
      return "./assets/img/quote/fallbacks/cusco.jpg";
    }

    if (title.includes("recojo") || title.includes("aeropuerto") || title.includes("terminal")) {
      return "./assets/img/quote/fallbacks/recojo-aeropuerto-cusco.jpg";
    }

    return "./assets/img/quote/fallbacks/cusco.jpg";
  }

  function money(amount, currency = state.currency) {
    const value = Number(amount || 0);
    const code = currency || "USD";
    try {
      return new Intl.NumberFormat(getQuoteLocale(), {
        style: "currency",
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    } catch (_) {
      const prefix = code === "PEN" ? "S/" : `${code} `;
      return `${prefix} ${value.toFixed(2)}`;
    }
  }

  function convert(amount, fromCurrency = "USD", toCurrency = state.currency) {
    const value = Number(amount || 0);
    const from = String(fromCurrency || "USD").toUpperCase();
    const to = String(toCurrency || "USD").toUpperCase();
    if (from === to) return value;
    if (from === "USD" && to === "PEN") return value * state.exchangeRate;
    if (from === "PEN" && to === "USD") return value / state.exchangeRate;
    return value;
  }

  async function fetchJSON(path, fallback) {
    try {
      const response = await fetch(resolveDataPath(path), { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.warn(`[quote-packages] No se pudo cargar ${path}:`, error);
      return fallback;
    }
  }

  async function loadData() {
    const [packagesCusco, toursCusco, toursMachuPicchu, trekkingsCusco, hotels, trains, discounts] = await Promise.all([
      fetchJSON(DATA_PATHS.packagesCusco, {}),
      fetchJSON(DATA_PATHS.toursCusco, { products: [] }),
      fetchJSON(DATA_PATHS.toursMachuPicchu, { tours: [] }),
      fetchJSON(DATA_PATHS.trekkingsCusco, { products: [] }),
      fetchJSON(DATA_PATHS.hotels, { destinations: {} }),
      fetchJSON(DATA_PATHS.trains, { trains: [] }),
      fetchJSON(DATA_PATHS.discounts, [])
    ]);

    state.data = { packagesCusco, toursCusco, toursMachuPicchu, trekkingsCusco, hotels, trains, discounts };
    state.exchangeRate = Number(packagesCusco?.exchangeRateUSDToPEN || hotels?.pricingEngine?.exchangeRateUSDToPEN || EXCHANGE_FALLBACK) || EXCHANGE_FALLBACK;
    updateExchangeRateHelp();
  }

  function updateExchangeRateHelp() {
    const help = $("#exchangeRateHelp");
    if (help) help.textContent = `Tipo de cambio referencial: 1 USD = S/ ${state.exchangeRate.toFixed(2)}.`;
  }

  function generateQuoteReference() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `COT-PE-${stamp}-${rand}`;
  }

  function ensureQuoteReference() {
    const el = $("#quoteReference");
    if (!el) return;
    if (!el.dataset.generated || el.textContent.includes("---")) {
      el.dataset.generated = generateQuoteReference();
      el.textContent = el.dataset.generated;
    }
  }

  function calculateDurationFromDates(selectedDates) {
    const start = selectedDates?.[0] ? parseISODate(selectedDates[0]) : null;
    const end = selectedDates?.[1] ? parseISODate(selectedDates[1]) : null;
    if (!start || !end) {
      state.dates = { start, end, days: 0, nights: 0 };
      return;
    }
    const diff = Math.max(0, getDateDiffDays(start, end));
    state.dates = { start, end, days: diff + 1, nights: diff };
  }

  function getTravelRangeLabel() {
    if (!state.dates.start || !state.dates.end) return "Por completar";
    return `${formatDate(state.dates.start)} al ${formatDate(state.dates.end)}`;
  }

  function updateTravelHelp() {
    const help = $("#travelRangeHelp");
    if (!help) return;
    if (!state.dates.days) {
      help.hidden = true;
      help.textContent = "";
      return;
    }
    help.hidden = false;
    help.textContent = `Duración detectada: ${state.dates.days} días / ${state.dates.nights} noches.`;
  }

  function initPickers() {
    if (typeof flatpickr !== "undefined") {
      const locale = flatpickr.l10ns?.[getQuoteLang()] || flatpickr.l10ns?.es || flatpickr.l10ns?.default;
      const travelRange = $("#travelRange");
      if (travelRange) {
        flatpickr(travelRange, {
          mode: "range",
          locale,
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "d M Y",
          minDate: "today",
          onChange(selectedDates) {
            calculateDurationFromDates(selectedDates);
            state.selectedOptionIndex = -1;
            state.selectedHotels = {};
            state.selectedTrains = { outbound: null, return: null };
            state.selectedExtras.clear();
            updateTravelHelp();
            generateAndRenderOptions();
          }
        });
      }

      const arrival = $("#arrivalTime");
      if (arrival) {
        flatpickr(arrival, {
          enableTime: true,
          noCalendar: true,
          time_24hr: true,
          dateFormat: "H:i",
          defaultDate: state.arrivalTime,
          onChange(_, value) {
            state.arrivalTime = value || "09:00";
            generateAndRenderOptions();
          }
        });
      }

      const departure = $("#departureTime");
      if (departure) {
        flatpickr(departure, {
          enableTime: true,
          noCalendar: true,
          time_24hr: true,
          dateFormat: "H:i",
          defaultDate: state.departureTime,
          onChange(_, value) {
            state.departureTime = value || "20:00";
            generateAndRenderOptions();
          }
        });
      }
    }
  }

  function applyCurrencyRulesByNationality() {
    const currency = $("#quoteCurrency");
    const help = $("#nationalityHelp");
    if (!currency) return;

    if (state.nationality === "national") {
      [...currency.options].forEach((option) => { option.disabled = false; });
      if (help) help.textContent = "Turistas peruanos pueden ver tren local sujeto a disponibilidad presencial con DNI físico vigente.";
    } else {
      state.currency = "USD";
      currency.value = "USD";
      [...currency.options].forEach((option) => { option.disabled = option.value === "PEN"; });
      if (help) help.textContent = "Para extranjeros y Comunidad Andina se cotiza en USD; el tren local no aplica.";
      if (state.selectedTrains.outbound?.isLocalTrain || state.selectedTrains.return?.isLocalTrain) {
        state.selectedTrains = { outbound: null, return: null };
      }
    }
  }

  function generateAndRenderOptions() {
    applyCurrencyRulesByNationality();
    updateTravelHelp();

    const section = $("#itinerarySection");
    const packageOptions = $("#packageOptions");
    const itineraryOptions = $("#itineraryOptions");

    if (!state.dates.days || !state.dates.nights) {
      if (section) section.hidden = true;
      if (packageOptions) packageOptions.innerHTML = "";
      if (itineraryOptions) itineraryOptions.innerHTML = "";
      clearDependentSections();
      updateSummary();
      return;
    }

    const params = {
      days: state.dates.days,
      nights: state.dates.nights,
      arrivalTime: state.arrivalTime,
      departureTime: state.departureTime,
      productFamily: "cusco-package"
    };

    if (window.MyCuscoTripPackageGenerator?.generatePackageOptions) {
      state.options = window.MyCuscoTripPackageGenerator.generatePackageOptions(params, {
        data: {
          packagesCusco: state.data.packagesCusco,
          toursCusco: state.data.toursCusco,
          toursMachuPicchu: state.data.toursMachuPicchu,
          trekkingsCusco: state.data.trekkingsCusco
        }
      });
    } else {
      state.options = getFallbackOptions(params);
    }

    state.showAllItineraryOptions = false;
    if (section) section.hidden = false;
    renderPackageOptions();

    if (state.options.length) {
      selectPackageOption(state.selectedOptionIndex >= 0 ? state.selectedOptionIndex : 0, { silentScroll: true });
    } else {
      state.selectedOptionIndex = -1;
      clearDependentSections();
      renderItineraryPreview();
      updateSummary();
    }
  }

  function getFallbackOptions(params) {
    const card = toArray(state.data.packagesCusco?.packageCards).find((item) => Number(item.days) === params.days && Number(item.nights) === params.nights);
    if (!card) return [];
    const codes = toArray(card.search?.includedTourCodes);
    return [{
      ...card,
      includedTourCodes: codes,
      includedTours: codes.map(findTourByCode).filter(Boolean),
      arrivalDepartureProfile: { label: "Horario personalizado" },
      generationReason: "fallback-card"
    }];
  }

  function getOptionBaseAdult(option) {
    return getOptionTours(option).reduce((sum, tour) => sum + getTourBasePriceUSD(tour, "adult"), 0);
  }

  function getOptionBaseChild(option) {
    return getOptionTours(option).reduce((sum, tour) => sum + getTourBasePriceUSD(tour, "child"), 0);
  }

  function getTourBasePriceUSD(tour, passengerType = "adult") {
    if (!tour) return 0;
    let price = 0;
    const nationalityPricing = tour.basePricingByNationality?.[state.nationality];
    if (nationalityPricing && Number.isFinite(Number(nationalityPricing[passengerType]))) {
      price = Number(nationalityPricing[passengerType]);
    } else if (Number.isFinite(Number(tour.basePricing?.[passengerType]))) {
      price = Number(tour.basePricing[passengerType]);
    } else if (Number.isFinite(Number(tour.priceFrom))) {
      price = Number(tour.priceFrom);
    }

    if (tour.quotePackageBaseExcludesTrain || tour.priceIncludesTrain || tour.publicPriceIncludesTrain) {
      const defaultTrain = Number(tour.internalPricing?.defaultTrainCostUSD || tour.defaultTrainSelection?.pricingSnapshot?.totalAdultTrainCost || 0);
      price = Math.max(0, price - defaultTrain);
    }

    return price;
  }

  function getTourCode(tour) {
    return tour?.internalCode || tour?.code || tour?.id || "";
  }

  function hasTourWord(tour, words = []) {
    const haystack = normalizeText(`${getTourCode(tour)} ${tour?.title || ""} ${tour?.slug || ""} ${tour?.category || ""} ${tour?.typeLabel || ""} ${tour?.variantType || ""}`);
    return words.some((word) => haystack.includes(normalizeText(word)));
  }

  function isWelcomeTour(tour) {
    return hasTourWord(tour, ["bienvenida", "ancestral", "panoramico", "panorámico"]);
  }

  function isCityTour(tour) {
    return getTourCode(tour) === "CUZ002" || hasTourWord(tour, ["city tour"]);
  }

  function isSacredValleyTour(tour) {
    return hasTourWord(tour, ["valle sagrado", "sacred valley"]);
  }

  function isSacredValleyConnectionTour(tour) {
    return isSacredValleyTour(tour) && hasTourWord(tour, ["conexion", "conexión", "connection"]);
  }

  function isFullDayLikeTour(tour) {
    return hasTourWord(tour, ["full day", "montana de colores", "montaña de colores", "humantay", "palcoyo", "7 lagunas", "valle sur"]);
  }

  function getTourEndMinutes(tour) {
    const explicit = tour?.operationalSchedule?.endTime;
    if (explicit) return timeToMinutes(explicit);
    if (isCityTour(tour)) return timeToMinutes("18:00");
    if (isWelcomeTour(tour)) return timeToMinutes("18:30");
    if (isMachuPicchuTour(tour)) return timeToMinutes("21:00");
    if (isFullDayLikeTour(tour)) return timeToMinutes("17:00");
    return timeToMinutes("18:00");
  }

  function canUseTourOnLastDay(tour) {
    const departureLimit = timeToMinutes(state.departureTime) - 90;
    return departureLimit >= getTourEndMinutes(tour);
  }

  function getFirstAvailableStartTime(tour, minTime) {
    const min = timeToMinutes(minTime);
    const starts = toArray(tour?.operationalSchedule?.startTimes);
    if (!starts.length) return null;
    return starts.find((time) => timeToMinutes(time) >= min) || null;
  }

  function addMinutesToTime(time, minutesToAdd) {
    const total = timeToMinutes(time) + Number(minutesToAdd || 0);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function getTourDurationMinutes(tour) {
    const label = normalizeText(tour?.duration?.label || tour?.operationalSchedule?.durationLabel || "");
    if (label.includes("2 h 30")) return 150;
    if (label.includes("medio dia") || label.includes("medio día")) return 300;
    if (label.includes("full day")) return 600;
    if (label.includes("2 dias") || label.includes("2 días")) return 1440;
    return 180;
  }

  function getAvailableStartTime(arrivalTime) {
    const arrival = timeToMinutes(arrivalTime || "09:00");
    // Margen operativo aproximado para recojo, equipaje y traslado al hotel.
    const available = arrival + 90;
    const h = Math.floor(available / 60) % 24;
    const m = available % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function getDayOneArrivalRule() {
    const arrival = timeToMinutes(state.arrivalTime || "09:00");
    if (arrival < timeToMinutes("09:00")) return "welcome-city";
    if (arrival < timeToMinutes("12:00")) return "city-only";
    if (arrival < timeToMinutes("15:00")) return "welcome-only";
    return "pickup-only";
  }

  function canPlaceTourOnDayOne(tour) {
    const rule = getDayOneArrivalRule();
    if (rule === "pickup-only") return false;
    if (rule === "welcome-city") return isWelcomeTour(tour) || isCityTour(tour);
    if (rule === "city-only") return isCityTour(tour);
    if (rule === "welcome-only") return isWelcomeTour(tour);
    return false;
  }

  function getOptionCommercialBadge(option, index) {
    if (index === 0) return "Recomendado";
    if (option?.connectionMode === "sacred-valley-connection" || option?.sacredValleyMode === "connection") return "Más vendido";
    if (option?.hasTrekkingAfterMachuPicchu) return "Aventura";
    if (Number(option?.freeUsefulDays || 0) === 0) return "Aprovecha mejor el tiempo";
    return option?.badge || option?.rawCard?.badge || "Ruta sugerida";
  }

  function getOptionCommercialText(option, index) {
    if (!option) return "Ruta sugerida según tus fechas y horarios.";
    const codes = toArray(option.includedTourCodes);
    if (option.sacredValleyMode === "connection") {
      return "Ruta recomendada: combina Valle Sagrado con conexión hacia Aguas Calientes y Machu Picchu al día siguiente, evitando traslados innecesarios.";
    }
    if (option.hasTrekkingAfterMachuPicchu || codes.some((code) => ["CUZ006", "CUZ007", "CUZ008", "CUZ009"].includes(code))) {
      return "Ruta para aprovechar al máximo el tiempo, agregando excursiones de naturaleza o trekking sin repetir servicios.";
    }
    if (index === 0) return "Ruta equilibrada y comercialmente recomendada para conocer Cusco, Valle Sagrado y Machu Picchu con buen ritmo.";
    if (codes.length <= 3) return "Ruta más suave y pausada, ideal si prefieres evitar demasiadas excursiones o caminatas exigentes.";
    return "Ruta clásica con actividades culturales, pensada para mantener un buen balance entre visitas, traslados y descanso.";
  }

  function renderPackageOptions() {
    const target = $("#packageOptions");
    const intro = $("#itinerarySectionIntro");
    if (!target) return;

    if (intro) {
      intro.textContent = state.options.length
        ? `Encontramos ${state.options.length} alternativa(s) compatibles con ${state.dates.days} días / ${state.dates.nights} noches y tus horarios.`
        : `No encontramos paquetes compatibles con ${state.dates.days} días / ${state.dates.nights} noches. Ajusta tus fechas o consulta por WhatsApp.`;
    }

    if (!state.options.length) {
      target.innerHTML = `
        <div class="quote-empty-state">
          <strong>No hay una ruta automática para esta duración.</strong>
          <p>Prueba con una estadía de 3 a 10 días o escríbenos para armar un paquete manual.</p>
        </div>
      `;
      return;
    }

    const maxInitialOptions = 4;
    const visibleCount = state.showAllItineraryOptions ? state.options.length : Math.min(maxInitialOptions, state.options.length);
    target.setAttribute("data-expanded", state.showAllItineraryOptions ? "true" : "false");
    const visibleOptions = state.options.slice(0, visibleCount);
    const cardsHtml = visibleOptions.map((option, index) => {
      const tours = getOptionTours(option);
      const titles = tours.slice(0, 4).map((tour) => tour.title).join(" · ");
      const baseAdult = convert(getOptionBaseAdult(option), "USD", state.currency);
      const isSelected = index === state.selectedOptionIndex;
      const badge = getOptionCommercialBadge(option, index);
      const commercialText = getOptionCommercialText(option, index);
      return `
        <button type="button" class="quote-package-option ${isSelected ? "is-selected" : ""}" data-option-index="${index}">
          <span class="quote-package-option__badge">${escapeHtml(badge)}</span>
          <strong>${escapeHtml(option.rawCard?.recommendedTitle || option.title || `Paquete ${option.days}D/${option.nights}N`)}</strong>
          <small>${escapeHtml(commercialText)}</small>
          <p>${escapeHtml(titles || option.shortDescription || "Itinerario armado desde los JSON del proyecto.")}</p>
          <em>Precio base desde ${money(baseAdult)} por adulto, sin hoteles ni trenes seleccionados</em>
        </button>
      `;
    }).join("");

    const moreHtml = !state.showAllItineraryOptions && state.options.length > visibleCount ? `
      <button type="button" class="quote-show-more-itineraries" data-show-more-itineraries>
        Ver más itinerarios (${state.options.length - visibleCount} más)
      </button>
    ` : "";

    target.innerHTML = `${cardsHtml}${moreHtml}`;
    Array.from(target.querySelectorAll(".quote-package-option")).forEach((card, idx) => {
      card.hidden = !state.showAllItineraryOptions && idx >= maxInitialOptions;
    });
  }

  function selectPackageOption(index, options = {}) {
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || !state.options[nextIndex]) return;
    state.selectedOptionIndex = nextIndex;
    state.selectedHotels = {};
    state.selectedTrains = { outbound: null, return: null };
    state.selectedExtras.clear();

    renderPackageOptions();
    renderItineraryPreview();
    renderHotelSelectors();
    renderTrainSelectors();
    renderExtras();
    updateSummary();
    updatePrintableTemplate();

    if (!options.silentScroll) {
      $("#itineraryPreview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function buildItineraryItems(option = getSelectedOption()) {
    if (!option) return [];

    const tours = getOptionTours(option).filter((tour) => !normalizeText(tour?.title).includes("transfer"));
    const remaining = [...tours];
    const startDate = state.dates.start;
    const totalDays = Math.max(Number(state.dates.days || option.days || 1), 1);
    const lastDayNumber = totalDays;
    const days = Array.from({ length: totalDays }, (_, index) => ({
      day: index + 1,
      date: startDate ? addDays(startDate, index) : null,
      activities: []
    }));

    function dayByNumber(dayNumber) {
      return days[Math.max(0, Math.min(totalDays - 1, dayNumber - 1))];
    }

    function take(predicate) {
      const idx = remaining.findIndex(predicate);
      if (idx < 0) return null;
      return remaining.splice(idx, 1)[0];
    }

    function takeBest(predicate, sorter) {
      const matches = remaining
        .map((tour, index) => ({ tour, index }))
        .filter((item) => predicate(item.tour));
      if (!matches.length) return null;
      if (typeof sorter === "function") matches.sort((a, b) => sorter(a.tour, b.tour));
      const selected = matches[0];
      remaining.splice(selected.index, 1);
      return selected.tour;
    }

    function put(dayNumber, tour, note = "") {
      if (!tour) return false;
      const day = dayByNumber(dayNumber);
      if (day.activities.some((item) => getTourCode(item.tour) === getTourCode(tour))) return false;
      day.activities.push({ tour, note });
      return true;
    }

    function putSynthetic(dayNumber, syntheticTitle, note = "", startTime = "") {
      const day = dayByNumber(dayNumber);
      if (day.activities.some((item) => !item.tour && normalizeText(item.syntheticTitle || "") === normalizeText(syntheticTitle))) return false;
      day.activities.push({ tour: null, syntheticTitle, note, startTime });
      return true;
    }

    function isMiddleDay(dayNumber) {
      return dayNumber > 1 && dayNumber < lastDayNumber;
    }

    function dayHasMajorActivity(dayNumber) {
      return dayByNumber(dayNumber).activities.some((item) => item.tour && (
        isFullDayLikeTour(item.tour) ||
        isMachuPicchuTour(item.tour) ||
        isSacredValleyTour(item.tour)
      ));
    }

    function isMarasMorayOrValleSur(tour) {
      return hasTourWord(tour, ["maras", "moray", "valle sur"]);
    }

    function isTrekkingTour(tour) {
      return hasTourWord(tour, ["humantay", "montana de colores", "montaña de colores", "vinicunca", "palcoyo", "7 lagunas", "siete lagunas"]);
    }

    function middlePriority(a, b) {
      const score = (tour) => {
        if (isTrekkingTour(tour)) return 10;
        if (isMarasMorayOrValleSur(tour)) return 20;
        if (isFullDayLikeTour(tour)) return 30;
        return 50;
      };
      return score(a) - score(b);
    }

    function canUseTourOnSpecificLastDay(tour) {
      const departure = timeToMinutes(state.departureTime || "12:00");
      if (departure < timeToMinutes("13:00")) return false;
      if (departure < timeToMinutes("15:00")) return isWelcomeTour(tour);
      if (departure < timeToMinutes("17:00")) return isCityTour(tour);
      if (departure < timeToMinutes("19:00")) return isMarasMorayOrValleSur(tour);
      if (departure < timeToMinutes("20:00")) return isTrekkingTour(tour) || isFullDayLikeTour(tour);
      return isTrekkingTour(tour) || isFullDayLikeTour(tour) || isMarasMorayOrValleSur(tour) || isWelcomeTour(tour) || isCityTour(tour);
    }

    function lastDayPriority(a, b) {
      const departure = timeToMinutes(state.departureTime || "12:00");
      const score = (tour) => {
        if (departure >= timeToMinutes("19:00") && (isTrekkingTour(tour) || isFullDayLikeTour(tour))) return 10;
        if (departure >= timeToMinutes("17:00") && isMarasMorayOrValleSur(tour)) return 20;
        if (departure >= timeToMinutes("15:00") && isCityTour(tour)) return 30;
        if (departure >= timeToMinutes("13:00") && isWelcomeTour(tour)) return 40;
        return 90;
      };
      return score(a) - score(b);
    }

    // Día 1: siempre inicia con recojo/recepción. Las actividades permitidas dependen estrictamente de la hora de llegada.
    putSynthetic(1, "Recojo aeropuerto · Recepción en Cusco", "Recepción en Cusco y traslado inicial.", state.arrivalTime || "--:--");

    const availableFrom = getAvailableStartTime(state.arrivalTime);
    const dayOneRule = getDayOneArrivalRule();
    const welcome = take(isWelcomeTour);
    const city = take(isCityTour);
    let usedWelcome = false;
    let usedCity = false;

    if (dayOneRule === "welcome-city") {
      const welcomeStart = welcome ? (getFirstAvailableStartTime(welcome, availableFrom) || "09:00") : null;
      if (welcome) usedWelcome = put(1, welcome, `Salida sugerida ${welcomeStart}.`);
      if (city) usedCity = put(1, city, "Salida sugerida 13:00.");
    } else if (dayOneRule === "city-only") {
      if (city) usedCity = put(1, city, "Salida sugerida 13:00.");
    } else if (dayOneRule === "welcome-only") {
      const welcomeStart = welcome ? (getFirstAvailableStartTime(welcome, availableFrom) || availableFrom) : null;
      if (welcome) usedWelcome = put(1, welcome, `Salida sugerida ${welcomeStart}.`);
    }
    // Si llega desde las 15:00, no se agrega ningún tour el primer día.
    // Bienvenida/City no se reubican en días intermedios; solo podrán intentarse el último día si no se usaron.

    const valleyConnection = take(isSacredValleyConnectionTour);
    const valleyFullDay = !valleyConnection ? take((tour) => isSacredValleyTour(tour)) : null;
    const machu = take(isMachuPicchuTour);
    const hints = option.itineraryHints || {};

    if (valleyConnection) {
      const valleyDay = totalDays >= 4 ? 2 : Math.min(2, totalDays);
      put(valleyDay, valleyConnection, "Conexión hacia Aguas Calientes para dormir cerca de Machu Picchu.");
      if (machu) put(Math.min(valleyDay + 1, totalDays), machu, "Machu Picchu se programa al día siguiente de la conexión del Valle Sagrado.");
    } else {
      if (machu) put(totalDays >= 3 ? 2 : Math.min(2, totalDays), machu, "Versión Full Day compatible con Valle Sagrado Full Day o ruta clásica.");
      if (valleyFullDay) put(totalDays >= 4 ? 3 : Math.min(2, totalDays), valleyFullDay, "Valle Sagrado en versión Full Day, sin noche previa en Aguas Calientes.");
    }

    // Llenar días intermedios solo con excursiones que realmente ocupan el día.
    // No se colocan Bienvenida ni City Tour en días centrales para no desaprovecharlos.
    for (let dayNumber = 2; dayNumber < lastDayNumber; dayNumber += 1) {
      if (dayByNumber(dayNumber).activities.length) continue;
      const tour = takeBest((candidate) => {
        if (isWelcomeTour(candidate) || isCityTour(candidate)) return false;
        if (isMachuPicchuTour(candidate) || isSacredValleyTour(candidate)) return false;
        return isFullDayLikeTour(candidate) || isMarasMorayOrValleSur(candidate);
      }, middlePriority);
      if (tour) put(dayNumber, tour, "Día completo disponible para aprovechar la ruta.");
    }

    // Forzados al último día solo si encajan con la regla de salida.
    const forcedLastDayCodes = toArray(hints.forceLastDayTourCodes);
    forcedLastDayCodes.forEach((code) => {
      const idx = remaining.findIndex((tour) => getTourCode(tour) === code);
      if (idx >= 0 && canUseTourOnSpecificLastDay(remaining[idx])) {
        put(lastDayNumber, remaining.splice(idx, 1)[0], "Compatible con tu horario de salida.");
      }
    });

    // Último día: elegir la mejor actividad posible según hora de salida, priorizando la de mayor aprovechamiento.
    if (!dayByNumber(lastDayNumber).activities.length) {
      const lastTour = takeBest((tour) => {
        if (isMachuPicchuTour(tour) || isSacredValleyTour(tour)) return false;
        return canUseTourOnSpecificLastDay(tour);
      }, lastDayPriority);
      if (lastTour) put(lastDayNumber, lastTour, "Compatible con tu horario de salida.");
    }

    // Si la salida es desde las 20:00 y quedaron Bienvenida + City sin usar, puede ser una combinación válida del último día.
    // Solo se usa esta combinación cuando el último día no fue ocupado por una excursión larga.
    const lastDayHasTour = () => dayByNumber(lastDayNumber).activities.some((item) => item.tour);
    if (timeToMinutes(state.departureTime || "00:00") >= timeToMinutes("20:00") && !lastDayHasTour()) {
      if (!usedWelcome && welcome && !dayByNumber(lastDayNumber).activities.some((item) => isWelcomeTour(item.tour)) && canUseTourOnSpecificLastDay(welcome)) {
        put(lastDayNumber, welcome, "Versión panorámica compatible con salida nocturna.");
        usedWelcome = true;
      }
      if (!usedCity && city && !dayByNumber(lastDayNumber).activities.some((item) => isCityTour(item.tour)) && canUseTourOnSpecificLastDay(city)) {
        put(lastDayNumber, city, "City Tour en horario de mañana compatible con salida nocturna.");
        usedCity = true;
      }
    } else {
      if (!usedWelcome && welcome && !dayByNumber(lastDayNumber).activities.length && canUseTourOnSpecificLastDay(welcome)) {
        put(lastDayNumber, welcome, "Versión panorámica compatible con tu horario de salida.");
        usedWelcome = true;
      }
      if (!usedCity && city && !dayByNumber(lastDayNumber).activities.length && canUseTourOnSpecificLastDay(city)) {
        put(lastDayNumber, city, "City Tour en horario de mañana compatible con tu horario de salida.");
        usedCity = true;
      }
    }

    // Cualquier tour restante solo se coloca en días intermedios vacíos, nunca encima de Valle/Machu/full day.
    remaining.forEach((tour) => {
      if (isWelcomeTour(tour) || isCityTour(tour)) return;
      const targetDay = days.find((day) => {
        if (!isMiddleDay(day.day)) return false;
        if (day.activities.length) return false;
        if (dayHasMajorActivity(day.day)) return false;
        return true;
      });
      if (targetDay) put(targetDay.day, tour, "Día disponible para esta excursión.");
    });

    return days.map((day) => {
      let activities = day.activities.length ? [...day.activities] : [{
        tour: null,
        note: day.day === 1 ? "Llegada, traslado al hotel y aclimatación ligera." : day.day === lastDayNumber ? "Traslado de salida y asistencia final." : "Día flexible para descanso, caminata ligera o ajuste operativo según disponibilidad.",
        syntheticTitle: day.day === 1 ? "Recojo aeropuerto · Recepción en Cusco" : day.day === lastDayNumber ? "Traslado de salida" : "Día flexible"
      }];

      if (day.day === lastDayNumber && !activities.some((item) => !item.tour && normalizeText(item.syntheticTitle || "").includes("traslado"))) {
        activities = [...activities, {
          tour: null,
          startTime: state.departureTime ? addMinutesToTime(state.departureTime, -120) : "--:--",
          note: "Traslado final según horario de salida.",
          syntheticTitle: "Traslado de salida"
        }];
      }

      return {
        day: day.day,
        displayDay: day.day,
        date: day.date,
        activities
      };
    });
  }

  function getActivityDisplayTitle(activity, day) {
    const tour = activity?.tour;
    const rawTitle = tour?.title || activity?.syntheticTitle || "Actividad";
    const totalDays = Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1);
    if (day?.day === totalDays && tour && isWelcomeTour(tour)) {
      return "Tour panorámico Cusco";
    }
    return rawTitle;
  }

  function getActivityDisplayTime(activity, day, index = 0) {
    if (!activity) return "";
    if (activity.startTime) return activity.startTime;
    const note = String(activity.note || "");
    const match = note.match(/(\d{1,2}:\d{2})/);
    if (match) return match[1].padStart(5, "0");
    if (!activity.tour) {
      if (day?.day === 1) return state.arrivalTime || "--:--";
      if (day?.day === Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1)) return state.departureTime ? addMinutesToTime(state.departureTime, -120) : "--:--";
      return "09:00";
    }
    const tour = activity.tour;
    if (day?.day === 1 && index === 0 && activity.syntheticTitle) return state.arrivalTime || "--:--";
    if (isCityTour(tour)) {
      const totalDays = Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1);
      if (day?.day === totalDays) return getFirstAvailableStartTime(tour, "09:00") || "09:00";
      if (day?.day === 1) return getFirstAvailableStartTime(tour, getAvailableStartTime(state.arrivalTime)) || "13:00";
      return getFirstAvailableStartTime(tour, "09:00") || "09:00";
    }
    if (isWelcomeTour(tour)) {
      const totalDays = Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1);
      if (day?.day === totalDays) return getFirstAvailableStartTime(tour, "09:00") || "09:00";
      if (day?.day === 1) return getFirstAvailableStartTime(tour, getAvailableStartTime(state.arrivalTime)) || "09:00";
      return getFirstAvailableStartTime(tour, "09:00") || "09:00";
    }
    if (isSacredValleyTour(tour)) return "08:00";
    if (isMachuPicchuTour(tour)) {
      const title = normalizeText(tour.title || "");
      if (title.includes("overnight")) return "08:00";
      return "04:00";
    }
    if (isFullDayLikeTour(tour)) return "04:00";
    const starts = toArray(tour?.operationalSchedule?.startTimes);
    return starts[0] || tour?.operationalSchedule?.startTime || "09:00";
  }

  function getActivityDisplayDescription(activity, day) {
    const tour = activity?.tour;
    const title = normalizeText(getActivityDisplayTitle(activity, day));
    if (!tour) {
      if (day?.day === 1) return "Recepción en aeropuerto o terminal terrestre, asistencia inicial y traslado hacia el hotel o punto coordinado en Cusco.";
      if (day?.day === Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1)) return "Recojo desde el hotel o punto coordinado y traslado al aeropuerto o terminal terrestre según el horario real de salida.";
      return activity?.note || "Día flexible para descanso, caminata ligera o ajuste operativo según disponibilidad.";
    }
    if (isCityTour(tour)) return "Visita guiada por los principales atractivos de Cusco: Qoricancha, Sacsayhuamán, Qenqo, Puca Pucara y Tambomachay, con retorno coordinado a la ciudad.";
    if (isWelcomeTour(tour) && title.includes("panoramico")) return "Recorrido panorámico por Cusco con enfoque cultural, vistas de la ciudad, ceremonia andina simbólica y paradas fotográficas antes del traslado final.";
    if (isWelcomeTour(tour)) return "Experiencia cultural de bienvenida en Cusco con ceremonia andina simbólica, vistas panorámicas y tiempo de adaptación suave antes de continuar con el itinerario.";
    if (isSacredValleyConnectionTour(tour)) return "Ruta por el Valle Sagrado visitando puntos destacados como Pisac, Urubamba y Ollantaytambo, finalizando con conexión hacia Aguas Calientes para dormir cerca de Machu Picchu.";
    if (isSacredValleyTour(tour)) return "Excursión de día completo por el Valle Sagrado de los Incas con visitas culturales, paisajes andinos y retorno coordinado a Cusco.";
    if (isMachuPicchuTour(tour)) return "Visita a Machu Picchu con coordinación de traslados, bus de subida, ingreso oficial según disponibilidad, guiado profesional y retorno según la modalidad seleccionada.";
    if (title.includes("montana de colores") || title.includes("montaña de colores")) return "Salida de madrugada hacia Vinicunca, desayuno, caminata asistida hasta la Montaña de Colores, tiempo para fotografías, almuerzo y retorno aproximado por la tarde.";
    return tour?.description || tour?.shortDescription || activity?.note || "Servicio coordinado según tus horarios y disponibilidad operativa.";
  }

  function getActivityPlacesText(activity, day) {
    const tour = activity?.tour;
    if (!tour) {
      if (day?.day === 1) return "Aeropuerto/terminal · hotel en Cusco";
      if (day?.day === Math.max(Number(state.dates.days || getSelectedOption()?.days || 1), 1)) return "Hotel en Cusco · aeropuerto/terminal";
      return "Cusco";
    }
    const places = toArray(tour?.places || tour?.highlights || tour?.mainPlaces).map((item) => typeof item === "string" ? item : item?.name).filter(Boolean);
    if (places.length) return places.slice(0, 5).join(" · ");
    if (isCityTour(tour)) return "Qoricancha · Sacsayhuamán · Qenqo · Puca Pucara · Tambomachay";
    if (isSacredValleyConnectionTour(tour)) return "Pisac · Urubamba · Ollantaytambo · conexión a Machu Picchu";
    if (isMachuPicchuTour(tour)) return "Aguas Calientes · bus turístico · ciudadela de Machu Picchu";
    return "Cusco y alrededores";
  }

  function renderItineraryPreview() {
    const target = $("#itineraryPreview");
    const optionsTarget = $("#itineraryOptions");
    const option = getSelectedOption();
    if (!target) return;

    if (optionsTarget) optionsTarget.innerHTML = "";

    if (!option) {
      target.innerHTML = `
        <div class="quote-empty-state">
          <strong>Selecciona tus fechas para generar el itinerario.</strong>
          <p>El cotizador revisará duración y horarios para proponer la ruta compatible.</p>
        </div>
      `;
      return;
    }

    const days = buildItineraryItems(option);
    target.innerHTML = days.map((day) => {
      const activityHtml = day.activities.map((activity, index) => {
        const tour = activity.tour;
        const title = getActivityDisplayTitle(activity, day);
        const time = getActivityDisplayTime(activity, day, index);
        const description = getActivityDisplayDescription(activity, day);
        const places = getActivityPlacesText(activity, day);
        const meta = activity.note || tour?.duration?.label || tour?.typeLabel || tour?.category || "Actividad turística";
        const image = getActivityImage(activity, day);
        return `
          <div class="quote-itinerary-activity quote-itinerary-activity--with-image">
            <figure class="quote-itinerary-activity-media">
              <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
            </figure>
            <div class="quote-itinerary-activity__content">
              ${time ? `<span class="quote-itinerary-start-time">${escapeHtml(time)}</span>` : ""}
              <h4>${escapeHtml(title)}</h4>
              <p>${escapeHtml(description)}</p>
              ${places ? `<p class="quote-itinerary-places"><strong>Lugares principales:</strong> ${escapeHtml(places)}</p>` : ""}
              ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="quote-itinerary-item quote-itinerary-item--activity-list">
          <div class="quote-itinerary-item__body">
            <div class="quote-itinerary-item__dayline">
              <span class="quote-day-badge">Día ${day.displayDay}</span>
              <strong class="quote-itinerary-date-label">${escapeHtml(formatDate(day.date))}</strong>
            </div>
            ${activityHtml}
          </div>
        </div>
      `;
    }).join("");
  }

  function getAccommodationPlan(option = getSelectedOption()) {
    if (!option || !state.dates.nights) return [];
    const requiresAguas = Boolean(option.requiresOvernight || option.connectionMode || getMachuTour(option)?.trainSelection?.allowedRoutes?.outbound?.includes("OLLA_MAPI"));
    const aguasNights = requiresAguas && state.dates.nights > 1 ? 1 : 0;
    const cuscoNights = Math.max(state.dates.nights - aguasNights, 0);
    const plan = [];
    if (cuscoNights > 0) plan.push({ destination: "cusco", label: "Cusco", nights: cuscoNights });
    if (aguasNights > 0) plan.push({ destination: "aguas-calientes", label: "Aguas Calientes", nights: aguasNights });
    return plan;
  }

  function getHotelsForDestination(destination) {
    return toArray(state.data.hotels?.destinations?.[destination]?.hotels).filter(Boolean);
  }

  function getRoomPriceUSD(room) {
    if (!room) return 0;
    const currency = room.publishedPricing?.currency || room.currency || "USD";
    const amount = Number(room.publishedPricing?.amount ?? room.pricePerNight ?? 0);
    return convert(amount, currency, "USD");
  }

  function getRoomCapacity(room) {
    return Number(room?.capacity || room?.maxAdults || 1) || 1;
  }

  function getRoomTypeId(room) {
    return String(room?.roomType || room?.label || "room").replace(/\s+/g, "-").toLowerCase();
  }

  function isRoomCompatible(room) {
    return getRoomCapacity(room) >= 1;
  }

  function chooseBestRoom(hotel) {
    const rooms = toArray(hotel?.rooms).filter(isRoomCompatible);
    if (!rooms.length) return null;
    const pax = getPassengerCount();
    return rooms
      .map((room) => ({ room, score: Math.abs(getRoomCapacity(room) - pax) + getRoomPriceUSD(room) / 1000 }))
      .sort((a, b) => a.score - b.score)[0]?.room || rooms[0];
  }

  function getHotelSelectionKey(destination, hotel, roomOrRooms) {
    const rooms = Array.isArray(roomOrRooms) ? roomOrRooms : [roomOrRooms].filter(Boolean);
    const roomKey = rooms.length ? rooms.map(getRoomTypeId).join("+") : "room";
    return `${destination}::${hotel?.hotelCode || "hotel"}::${roomKey}`;
  }

  function getRoomDescription(room) {
    const parts = [
      room?.label || room?.roomType || "Habitación",
      room?.bedType,
      Number(room?.capacity || 0) ? `capacidad ${room.capacity}` : ""
    ].filter(Boolean);
    return parts.join(" · ");
  }

  function getRoomsSummary(rooms = []) {
    const list = toArray(rooms).filter(Boolean);
    if (!list.length) return "Habitación por confirmar";
    const counts = new Map();
    list.forEach((room) => {
      const label = room?.label || room?.roomType || "Habitación";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => `${count > 1 ? `${count} × ` : ""}${label}`).join(" + ");
  }

  function getRoomsDetails(rooms = []) {
    return toArray(rooms).filter(Boolean).map(getRoomDescription).join(" | ");
  }

  function isRoomType(room, type) {
    return normalizeText(room?.roomType || room?.label).includes(normalizeText(type));
  }

  function findRoomByTypes(rooms, types) {
    return types.map((type) => rooms.find((room) => isRoomType(room, type))).find(Boolean) || null;
  }

  function makeCombo(rooms) {
    const cleanRooms = toArray(rooms).filter(Boolean);
    const capacity = cleanRooms.reduce((sum, room) => sum + getRoomCapacity(room), 0);
    const priceUSDPerNight = cleanRooms.reduce((sum, room) => sum + getRoomPriceUSD(room), 0);
    return {
      rooms: cleanRooms,
      capacity,
      priceUSDPerNight,
      score: cleanRooms.length * 1000 + Math.max(0, capacity - getPassengerCount()) * 100 + priceUSDPerNight
    };
  }

  function buildPreferredRoomCombinations(hotel) {
    const pax = Math.max(1, getPassengerCount());
    const rooms = toArray(hotel?.rooms).filter(isRoomCompatible);
    const single = findRoomByTypes(rooms, ["single", "simple"]);
    const twin = findRoomByTypes(rooms, ["double-twin", "doble twin", "twin"]);
    const matrimonial = findRoomByTypes(rooms, ["double-matrimonial", "matrimonial"]);
    const triple = findRoomByTypes(rooms, ["triple"]);
    const extraBed = findRoomByTypes(rooms, ["extra-bed", "cama adicional"]);
    const family4 = findRoomByTypes(rooms, ["family-4", "familiar", "cuadruple"]);
    const family5 = findRoomByTypes(rooms, ["super-family-5", "super familiar"]);

    let preferred = [];
    if (pax === 1) preferred = [[single], [matrimonial], [twin]];
    else if (pax === 2) preferred = [[matrimonial], [twin], [single, single]];
    else if (pax === 3) preferred = [[triple], [twin, single], [matrimonial, single], [single, single, single], [extraBed]];
    else if (pax === 4) preferred = [[family4], [triple, single], [twin, twin], [matrimonial, twin], [single, single, single, single]];
    else if (pax === 5) preferred = [[family5], [family4, single], [triple, twin], [triple, matrimonial], [single, single, single, single, single]];

    const unique = new Map();
    preferred.forEach((candidate) => {
      const clean = toArray(candidate).filter(Boolean);
      if (!clean.length) return;
      const combo = makeCombo(clean);
      if (combo.capacity < pax) return;
      const key = combo.rooms.map(getRoomTypeId).sort().join("+");
      if (!unique.has(key)) unique.set(key, combo);
    });
    return Array.from(unique.values()).sort((a, b) => a.score - b.score);
  }

  function getRoomComboDisplayTitle(rooms = []) {
    const list = toArray(rooms).filter(Boolean);
    const counts = new Map();
    list.forEach((room) => {
      const label = room?.label || room?.roomType || "Habitación";
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([label, count]) => `${String(count).padStart(2, "0")} ${count === 1 ? label.toLowerCase() : `${label.toLowerCase()}s`}`).join(" + ");
  }

  function getHotelGalleryImages(hotel) {
    const gallery = toArray(hotel?.images?.gallery);
    const cover = hotel?.images?.cover;
    return [cover, ...gallery].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index);
  }

  function buildRoomCombinations(hotel, maxResults = 8) {
    const pax = Math.max(1, getPassengerCount());
    const preferred = buildPreferredRoomCombinations(hotel);
    if (preferred.length) return preferred.slice(0, maxResults);

    const rooms = toArray(hotel?.rooms).filter(isRoomCompatible);
    if (!rooms.length) return [];

    const normalized = rooms
      .map((room) => ({ room, capacity: getRoomCapacity(room), price: getRoomPriceUSD(room) }))
      .filter((item) => item.capacity > 0)
      .sort((a, b) => a.price - b.price || a.capacity - b.capacity);

    const maxRooms = Math.min(5, Math.max(1, pax));
    const combos = [];

    function walk(startIndex, picked, capacity, price) {
      if (capacity >= pax) {
        const extra = capacity - pax;
        combos.push({
          rooms: picked.map((item) => item.room),
          capacity,
          priceUSDPerNight: price,
          score: picked.length * 1000 + extra * 100 + price
        });
        return;
      }
      if (picked.length >= maxRooms) return;
      for (let i = startIndex; i < normalized.length; i += 1) {
        const item = normalized[i];
        walk(i, [...picked, item], capacity + item.capacity, price + item.price);
      }
    }

    walk(0, [], 0, 0);

    const unique = new Map();
    combos
      .sort((a, b) => a.score - b.score)
      .forEach((combo) => {
        const key = combo.rooms.map(getRoomTypeId).sort().join("+");
        if (!unique.has(key)) unique.set(key, combo);
      });

    return Array.from(unique.values()).slice(0, maxResults);
  }

  function buildHotelOptions(destination) {
    const plan = getAccommodationPlan().find((item) => item.destination === destination);
    const hotels = getHotelsForDestination(destination);
    const options = [{
      key: `${destination}::none`,
      destination,
      type: "none",
      label: "Sin hotel / solo tours",
      description: "No se suma alojamiento para este destino.",
      priceUSD: 0,
      nights: plan?.nights || 0,
      rooms: []
    }];

    hotels.forEach((hotel) => {
      const combos = buildRoomCombinations(hotel);
      combos.forEach((combo) => {
        const priceUSD = combo.priceUSDPerNight * Number(plan?.nights || 1);
        options.push({
          key: getHotelSelectionKey(destination, hotel, combo.rooms),
          destination,
          type: "hotel",
          hotel,
          room: combo.rooms[0] || null,
          rooms: combo.rooms,
          label: hotel.hotelName || "Hotel seleccionado",
          description: `${hotel.stars || ""}★ · ${hotel.location || plan?.label || destination} · ${getRoomsSummary(combo.rooms)}`,
          roomsSummary: getRoomsSummary(combo.rooms),
          roomsDetails: getRoomsDetails(combo.rooms),
          capacity: combo.capacity,
          priceUSDPerNight: combo.priceUSDPerNight,
          priceUSD,
          nights: plan?.nights || 0
        });
      });
    });

    return options;
  }

  function getSelectedHotelOption(destination) {
    const selected = state.selectedHotels[destination];
    if (!selected) return null;
    return buildHotelOptions(destination).find((option) => option.key === selected.key) || selected;
  }

  function renderHotelSelectors() {
    const section = $("#hotelSection");
    const target = $("#hotelSelectorsContainer");
    if (!section || !target) return;
    const plan = getAccommodationPlan();
    if (!getSelectedOption() || !plan.length) {
      section.hidden = true;
      target.innerHTML = "";
      return;
    }

    section.hidden = false;
    target.innerHTML = plan.map((item) => {
      const selected = getSelectedHotelOption(item.destination);
      const text = selected ? selected.label : "Por elegir";
      const priceText = selected ? money(convert(selected.priceUSD, "USD", state.currency)) : "No seleccionado";
      return `
        <div class="quote-dynamic-card">
          <div>
            <span>${escapeHtml(item.label)} · ${item.nights} noche(s)</span>
            <strong>${escapeHtml(text)}</strong>
            <p>${escapeHtml(selected?.description || "Puedes elegir hotel o continuar sin alojamiento.")}</p>
            <small>${escapeHtml(priceText)}</small>
          </div>
          <button type="button" class="btn quote-secondary-btn" data-open-hotel="${escapeHtml(item.destination)}">
            <i class="fas fa-hotel"></i> ${selected ? "Cambiar hotel" : "Elegir hotel"}
          </button>
        </div>
      `;
    }).join("");
  }

  function openHotelModal(destination) {
    state.activeHotelDestination = destination;
    state.pendingHotelKey = state.selectedHotels[destination]?.key || `${destination}::none`;
    const modal = $("#hotelModal");
    const title = $("#hotelModalTitle");
    const intro = $("#hotelModalIntro");
    const list = $("#hotelModalList");
    const plan = getAccommodationPlan().find((item) => item.destination === destination);
    if (!modal || !list || !plan) return;

    if (title) title.textContent = `Elige alojamiento en ${plan.label}`;
    if (intro) intro.textContent = `Selecciona el hotel y luego una combinación de habitación compatible para ${getPassengerCount()} pasajero(s).`;

    const options = buildHotelOptions(destination);
    const noneOption = options.find((option) => option.type === "none");
    const hotelOptions = options.filter((option) => option.type === "hotel");
    const grouped = hotelOptions.reduce((acc, option) => {
      const code = option.hotel?.hotelCode || option.label;
      if (!acc.has(code)) acc.set(code, { hotel: option.hotel, options: [] });
      acc.get(code).options.push(option);
      return acc;
    }, new Map());

    const noneSelected = state.pendingHotelKey === noneOption?.key;
    const noneHtml = noneOption ? `
      <button type="button" class="quote-hotel-choice-card quote-hotel-choice-card--none ${noneSelected ? "is-selected" : ""}" data-hotel-key="${escapeHtml(noneOption.key)}">
        <span class="quote-choice-dot" aria-hidden="true"></span>
        <div>
          <strong>Sin hotel / solo tours</strong>
          <p>No se suma alojamiento para este destino. Puedes reservarlo por tu cuenta.</p>
          <em>Sin costo de hotel</em>
        </div>
      </button>
    ` : "";

    const hotelHtml = Array.from(grouped.values()).map((group) => {
      const hotel = group.hotel;
      const images = getHotelGalleryImages(hotel);
      const firstImage = images[0];
      const features = [
        hotel?.amenities?.breakfast ? `Desayuno: ${hotel.amenities.breakfast}` : "",
        ...toArray(hotel?.features),
        ...toArray(hotel?.amenities).filter((item) => typeof item === "string")
      ].filter(Boolean).slice(0, 7);
      const selectedInHotel = group.options.some((option) => option.key === state.pendingHotelKey);
      const minPrice = Math.min(...group.options.map((option) => Number(option.priceUSD || 0)).filter((n) => Number.isFinite(n)));
      const roomsHtml = group.options.map((option) => {
        const selected = option.key === state.pendingHotelKey;
        const total = convert(option.priceUSD, "USD", state.currency);
        return `
          <button type="button" class="quote-room-combo ${selected ? "is-selected" : ""}" data-hotel-key="${escapeHtml(option.key)}">
            <span class="quote-choice-dot" aria-hidden="true"></span>
            <div>
              <strong>${escapeHtml(getRoomComboDisplayTitle(option.rooms))}</strong>
              <small>${option.rooms.length} habitación(es) | Total + ${escapeHtml(money(total))}</small>
            </div>
          </button>
        `;
      }).join("");

      return `
        <article class="quote-hotel-group-card quote-hotel-group-card--wide ${selectedInHotel ? "is-selected" : ""}">
          <div class="quote-hotel-group-card__left">
            <div class="quote-hotel-group-card__head quote-hotel-group-card__head--top">
              <strong>${escapeHtml(hotel?.hotelName || "Hotel seleccionado")}</strong>
              <p>${escapeHtml(`${hotel?.stars ? "★".repeat(Number(hotel.stars)) : "Hotel"} · ${hotel?.location || plan.label}`)}</p>
              ${hotel?.address ? `<p>${escapeHtml(hotel.address)}</p>` : ""}
            </div>
            <div class="quote-hotel-gallery" data-gallery-index="0">
              ${firstImage ? `<img src="${escapeHtml(resolveAssetPath(firstImage))}" alt="${escapeHtml(hotel?.hotelName || "Hotel")}" loading="lazy">` : `<div class="quote-hotel-gallery__empty"><i class="fas fa-hotel"></i></div>`}
              ${images.length > 1 ? `
                <button type="button" class="quote-hotel-gallery__nav quote-hotel-gallery__nav--prev" data-hotel-gallery="prev" data-images="${escapeHtml(images.map(resolveAssetPath).join("|"))}" aria-label="Foto anterior">‹</button>
                <button type="button" class="quote-hotel-gallery__nav quote-hotel-gallery__nav--next" data-hotel-gallery="next" data-images="${escapeHtml(images.map(resolveAssetPath).join("|"))}" aria-label="Foto siguiente">›</button>
              ` : ""}
            </div>
            ${features.length ? `<div class="quote-hotel-feature-list quote-hotel-feature-list--pills">${features.map((item) => `<small><i class="fas fa-check"></i> ${escapeHtml(item)}</small>`).join("")}</div>` : ""}
          </div>
          <div class="quote-hotel-group-card__right">
            <div class="quote-hotel-price-pill">+ ${escapeHtml(money(convert(Number.isFinite(minPrice) ? minPrice : 0, "USD", state.currency)))} total</div>
            <h3>Selecciona tipo de acomodación</h3>
            <div class="quote-room-combo-list">
              ${roomsHtml}
            </div>
          </div>
        </article>
      `;
    }).join("");

    list.innerHTML = `
      <div class="quote-hotel-modal-list quote-hotel-modal-list--wide">
        ${noneHtml}
        ${hotelHtml || `<div class="quote-empty-state"><strong>No hay hoteles configurados para este destino.</strong><p>Puedes continuar sin hotel o consultar una opción manual.</p></div>`}
      </div>
    `;
    modal.hidden = false;
  }

  function confirmHotelSelection() {
    if (!state.activeHotelDestination) return;
    const options = buildHotelOptions(state.activeHotelDestination);
    const option = options.find((item) => item.key === state.pendingHotelKey) || options[0];
    state.selectedHotels[state.activeHotelDestination] = option;
    closeModals();
    renderHotelSelectors();
    updateSummary();
    updatePrintableTemplate();
  }

  function getTrainSelectionConfig() {
    const tour = getMachuTour();
    return tour?.trainSelection || null;
  }

  function getTrainDirection(direction) {
    return direction === "return" ? "return" : "outbound";
  }

  function isReturnTrain(train) {
    return train?.direction === "return" || train?.direction === "inbound" || String(train?.route || "").startsWith("MAPI_");
  }

  function isOutboundTrain(train) {
    return train?.direction === "outbound" || String(train?.route || "").endsWith("_MAPI");
  }

  function timeToMinutes(value) {
    const raw = String(value || "00:00").trim().toLowerCase();
    const isPm = /\bpm\b|p\.?\s*m\.?/.test(raw);
    const isAm = /\bam\b|a\.?\s*m\.?/.test(raw);
    const match = raw.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;

    let h = Number(match[1]) || 0;
    const m = Number(match[2]) || 0;

    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;

    return h * 60 + m;
  }

  function inTimeWindow(train, windowConfig) {
    if (!windowConfig) return true;
    const minutes = timeToMinutes(train.departureTime);
    const min = windowConfig.min ? timeToMinutes(windowConfig.min) : 0;
    const max = windowConfig.max ? timeToMinutes(windowConfig.max) : 24 * 60;
    return minutes >= min && minutes <= max;
  }

  function isAllowedTrainByNationality(train) {
    if (!train) return false;
    if (train.isLocalTrain) return state.nationality === "national";
    const only = toArray(train.operationalUse?.nationalitiesOnly);
    if (!only.length) return true;
    if (state.nationality === "national") return only.includes("PE") || only.includes("national");
    return only.includes(state.nationality);
  }

  function isOvernightTrainSelectionConfig(config = getTrainSelectionConfig()) {
    const option = getSelectedOption();
    const outboundRoutes = toArray(config?.allowedRoutes?.outbound);
    const outboundMin = timeToMinutes(config?.timeWindows?.outbound?.min || "00:00");
    return Boolean(
      option?.requiresOvernight ||
      option?.connectionMode ||
      option?.sacredValleyMode === "connection" ||
      (outboundRoutes.includes("OLLA_MAPI") && outboundMin >= 12 * 60)
    );
  }

  function getDynamicTrainTimeWindow(normalizedDirection, config) {
    const overnightMode = isOvernightTrainSelectionConfig(config);

    if (normalizedDirection === "return") {
      return { min: "14:00", max: "22:30" };
    }

    if (overnightMode) {
      return { min: "15:00", max: "22:00" };
    }

    return { min: "04:00", max: "12:00" };
  }

  function shouldIgnoreConfiguredTrainShortlist(normalizedDirection, config) {
    const mode = normalizeText(config?.mode || "");
    if (["fixed", "fixed_default_only"].includes(mode)) return false;
    if (normalizedDirection === "return") return true;
    return isOvernightTrainSelectionConfig(config) || mode.includes("flexible") || mode.includes("alternatives");
  }

  function getTrainOptions(direction) {
    const config = getTrainSelectionConfig();
    if (!config) return [];
    const normalizedDirection = getTrainDirection(direction);
    const trains = toArray(state.data.trains?.trains);
    const useConfiguredShortlist = !shouldIgnoreConfiguredTrainShortlist(normalizedDirection, config);
    const allowedCodes = useConfiguredShortlist ? toArray(config.allowedTrainCodes?.[normalizedDirection]) : [];
    const allowedRoutes = toArray(config.allowedRoutes?.[normalizedDirection]);
    const allowedCompanies = toArray(config.allowedCompanies).map(normalizeText);
    const defaultCode = config.defaultTrainCodes?.[normalizedDirection];
    const timeWindow = getDynamicTrainTimeWindow(normalizedDirection, config);
    const outboundTrain = state.selectedTrains.outbound;
    const outboundOperator = outboundTrain?.operatorKey || outboundTrain?.company;
    const sameCompanyRequired = normalizedDirection === "return" && outboundTrain && !outboundTrain.isLocalTrain && outboundOperator;

    let options = trains.filter((train) => {
      if (normalizedDirection === "outbound" && !isOutboundTrain(train)) return false;
      if (normalizedDirection === "return" && !isReturnTrain(train)) return false;
      if (!isAllowedTrainByNationality(train)) return false;
      if (allowedCodes.length && !allowedCodes.includes(train.code)) return false;
      if (allowedRoutes.length && !allowedRoutes.includes(train.route)) return false;
      if (allowedCompanies.length && !train.isLocalTrain && !allowedCompanies.includes(normalizeText(train.operatorKey || train.company))) return false;
      if (sameCompanyRequired) {
        if (train.isLocalTrain) return false;
        if (normalizeText(train.operatorKey || train.company) !== normalizeText(outboundOperator)) return false;
      }
      if (!inTimeWindow(train, timeWindow)) return false;
      return true;
    });

    if (!options.length && defaultCode) {
      options = trains.filter((train) => train.code === defaultCode && isAllowedTrainByNationality(train));
    }

    return options
      .sort((a, b) => {
        const localA = a.isLocalTrain ? -1000 : 0;
        const localB = b.isLocalTrain ? -1000 : 0;
        const defaultA = a.code === defaultCode ? -500 : 0;
        const defaultB = b.code === defaultCode ? -500 : 0;
        return (localA + defaultA + timeToMinutes(a.departureTime)) - (localB + defaultB + timeToMinutes(b.departureTime));
      })
      .slice(0, 30);
  }

  function getTrainPriceUSD(train, passengerType = "adult") {
    if (!train) return 0;
    const amount = Number(train.price?.[passengerType] ?? train.price?.adult ?? train.pricePerPerson ?? 0);
    return convert(amount, train.currency || "USD", "USD");
  }

  function renderTrainSelectors() {
    const section = $("#trainSection");
    const outbound = $("#outboundTrainSelected");
    const returned = $("#returnTrainSelected");
    if (!section) return;
    const config = getTrainSelectionConfig();
    if (!getSelectedOption() || !config) {
      section.hidden = true;
      state.selectedTrains = { outbound: null, return: null };
      return;
    }
    section.hidden = false;

    renderTrainSelectedCard(outbound, "outbound", state.selectedTrains.outbound);
    renderTrainSelectedCard(returned, "return", state.selectedTrains.return);
  }

  function renderTrainSelectedCard(container, direction, train) {
    if (!container) return;
    const label = direction === "outbound" ? "Tren de ida" : "Tren de retorno";
    const price = train ? getTrainTotal(train) : 0;
    const logo = train ? `<img class="quote-train-selected-logo" src="${escapeHtml(getTrainLogoPath(train))}" alt="${escapeHtml(train.companyName || train.company || "Tren")}">` : "";
    container.innerHTML = `
      <div class="quote-train-selected-content">
        ${logo}
        <div>
          <span>${label}</span>
          <strong>${escapeHtml(train ? `${train.companyName || train.company} · ${train.serviceName}` : "Sin selección")}</strong>
          <p>${escapeHtml(train ? `${train.departureStation} ${train.departureTime} → ${train.arrivalStation} ${train.arrivalTime}` : "Elige una opción de tren para completar la cotización.")}</p>
          ${train?.isLocalTrain ? `<small>Tren local referencial: requiere compra presencial con DNI.</small>` : ""}
          ${train ? `<small>${money(price)}</small>` : ""}
        </div>
      </div>
      <button type="button" class="btn quote-secondary-btn" data-train-direction="${direction}">
        <i class="fas fa-train"></i> ${train ? "Cambiar tren" : "Elegir tren"}
      </button>
    `;
  }

  function getTrainTotal(train) {
    if (!train) return 0;
    const adult = getTrainPriceUSD(train, "adult") * state.adults;
    const child = getTrainPriceUSD(train, "child") * state.children;
    return convert(adult + child, "USD", state.currency);
  }


  function getTrainLogoPath(train) {
    if (train?.isLocalTrain) return "./assets/img/trains/perurail.png";
    const key = normalizeText(train?.operatorKey || train?.company || train?.companyName || "");
    if (key.includes("inca")) return "./assets/img/trains/inca-rail.png";
    if (key.includes("peru")) return "./assets/img/trains/perurail.png";
    return "./assets/img/placeholder/experience.jpg";
  }

  function getTrainCompanyRuleNote(direction) {
    if (direction !== "return") return "El retorno se filtrará según la empresa elegida en la ida.";
    const outbound = state.selectedTrains.outbound;
    if (!outbound) return "Primero puedes elegir ida para filtrar el retorno por empresa.";
    if (outbound.isLocalTrain) return "Como elegiste tren local de ida, puedes seleccionar cualquier tren de retorno compatible.";
    return `Como elegiste ${outbound.companyName || outbound.company}, el retorno se limita a la misma empresa.`;
  }

  function openTrainModal(direction) {
    state.activeTrainDirection = getTrainDirection(direction);
    state.pendingTrainCode = state.selectedTrains[state.activeTrainDirection]?.code || null;
    const modal = $("#trainSelectionModal");
    const title = $("#trainSelectionModalTitle");
    const intro = $("#trainSelectionModalIntro");
    const list = $("#trainSelectionModalList");
    if (!modal || !list) return;

    const label = state.activeTrainDirection === "outbound" ? "ida a Machu Picchu" : "retorno desde Machu Picchu";
    if (title) title.textContent = `Elige tren de ${label}`;
    if (intro) intro.textContent = state.nationality === "national"
      ? `${getTrainCompanyRuleNote(state.activeTrainDirection)} También verás tren local referencial cuando aplique.`
      : `${getTrainCompanyRuleNote(state.activeTrainDirection)} Mostramos solo trenes turísticos compatibles.`;

    const options = getTrainOptions(state.activeTrainDirection);
    if (!options.length) {
      list.innerHTML = `
        <div class="quote-empty-state">
          <strong>No hay trenes compatibles para esta ruta.</strong>
          <p>Cambia la ruta seleccionada o consúltanos para revisar disponibilidad manualmente.</p>
        </div>
      `;
    } else {
      list.innerHTML = options.map((train) => {
        const selected = train.code === state.pendingTrainCode;
        const price = getTrainTotal(train);
        const logo = getTrainLogoPath(train);
        return `
          <button type="button" class="quote-modal-card quote-train-modal-card ${selected ? "is-selected" : ""} ${train.isLocalTrain ? "quote-train-modal-card--local" : ""}" data-train-code="${escapeHtml(train.code)}">
            <span class="quote-choice-dot" aria-hidden="true"></span>
            <div class="quote-train-modal-card__body">
              <div class="quote-train-title-row">
                <img class="quote-train-inline-logo" src="${escapeHtml(logo)}" alt="${escapeHtml(train.companyName || train.company || "Tren")}" loading="lazy">
                <div>
                  <strong>${escapeHtml(train.serviceName || train.category || train.code)}</strong>
                  ${train.isLocalTrain ? `<span>Tren local · PeruRail</span>` : ""}
                </div>
              </div>
              <div class="quote-train-schedule-row">
                <div><small>Salida</small><b>${escapeHtml(train.departureStation)} · ${escapeHtml(train.departureTime)}</b></div>
                <div><small>Llegada</small><b>${escapeHtml(train.arrivalStation)} · ${escapeHtml(train.arrivalTime)}</b></div>
              </div>
              <em>${train.isLocalTrain ? "Precio local referencial / por confirmar" : money(price)}</em>
              ${train.notes ? `<small>${escapeHtml(train.notes)}</small>` : ""}
            </div>
          </button>
        `;
      }).join("");
    }

    modal.hidden = false;
  }

  function confirmTrainSelection() {
    const direction = state.activeTrainDirection;
    if (!direction) return;
    const train = toArray(state.data.trains?.trains).find((item) => item.code === state.pendingTrainCode);
    if (!train) return;
    state.selectedTrains[direction] = train;
    if (direction === "outbound") {
      const returnTrain = state.selectedTrains.return;
      if (returnTrain && !train.isLocalTrain && normalizeText(returnTrain.operatorKey || returnTrain.company) !== normalizeText(train.operatorKey || train.company)) {
        state.selectedTrains.return = null;
      }
    }
    closeModals();
    renderTrainSelectors();
    updateSummary();
    updatePrintableTemplate();
  }

  function openTrainDetails(trainCode) {
    const train = toArray(state.data.trains?.trains).find((item) => item.code === trainCode);
    const modal = $("#trainDetailsModal");
    const content = $("#trainDetailsModalContent");
    if (!modal || !content || !train) return;
    $("#trainDetailsModalTitle").textContent = train.serviceName || train.code;
    content.innerHTML = `
      <p><strong>Empresa:</strong> ${escapeHtml(train.companyName || train.company)}</p>
      <p><strong>Ruta:</strong> ${escapeHtml(train.departureStation)} ${escapeHtml(train.departureTime)} → ${escapeHtml(train.arrivalStation)} ${escapeHtml(train.arrivalTime)}</p>
      <p><strong>Categoría:</strong> ${escapeHtml(train.category || "")}</p>
      <p>${escapeHtml(train.notes || "Tarifa referencial sujeta a disponibilidad.")}</p>
    `;
    modal.hidden = false;
  }

  function getExtraPriceUSD(extra) {
    if (!extra) return 0;
    if (Number.isFinite(Number(extra.publishedPriceUSD))) return Number(extra.publishedPriceUSD);
    if (Number.isFinite(Number(extra.costUSD))) return Number(extra.costUSD);
    const byNationality = extra.costByNationality?.[state.nationality];
    if (byNationality) {
      if (Number.isFinite(Number(byNationality.amountUSD))) return Number(byNationality.amountUSD);
      if (Number.isFinite(Number(byNationality.amountPEN))) return convert(Number(byNationality.amountPEN), "PEN", "USD");
      if (Number.isFinite(Number(byNationality.adultPEN))) return convert(Number(byNationality.adultPEN), "PEN", "USD");
    }
    return 0;
  }

  function getAvailableExtras() {
    const option = getSelectedOption();
    if (!option) return [];
    const seen = new Set();
    const extras = [];
    getOptionTours(option).forEach((tour) => {
      toArray(tour.extras).forEach((extra) => {
        const code = extra.code || `${tour.internalCode}-${extra.label}`;
        if (seen.has(code)) return;
        seen.add(code);
        extras.push({ ...extra, code, tourTitle: tour.title, tourCode: tour.internalCode });
      });
    });
    return extras;
  }

  function getExtraTotal(extra) {
    const priceUSD = getExtraPriceUSD(extra);
    const multiplier = extra.perPerson === false ? 1 : getPassengerCount();
    return convert(priceUSD * multiplier, "USD", state.currency);
  }

  function renderExtras() {
    const section = $("#extrasSection");
    const target = $("#extrasContainer");
    if (!section || !target) return;
    const extras = getAvailableExtras().filter((extra) => extra.optional !== false || extra.required !== true);
    if (!getSelectedOption() || !extras.length) {
      section.hidden = true;
      target.innerHTML = "";
      return;
    }
    section.hidden = false;
    target.innerHTML = extras.map((extra) => {
      const checked = state.selectedExtras.has(extra.code);
      return `
        <label class="quote-extra-card ${checked ? "is-selected" : ""}">
          <input type="checkbox" value="${escapeHtml(extra.code)}" ${checked ? "checked" : ""}>
          <span>
            <strong>${escapeHtml(extra.label || "Extra")}</strong>
            <small>${escapeHtml(extra.tourTitle || "Servicio adicional")}</small>
          </span>
          <em>${money(getExtraTotal(extra))}</em>
        </label>
      `;
    }).join("");
  }

  function getBaseTotals() {
    const option = getSelectedOption();
    if (!option) return { adult: 0, child: 0, total: 0 };
    const adultUSD = getOptionBaseAdult(option) * state.adults;
    const childUSD = getOptionBaseChild(option) * state.children;
    return {
      adult: convert(adultUSD, "USD", state.currency),
      child: convert(childUSD, "USD", state.currency),
      total: convert(adultUSD + childUSD, "USD", state.currency)
    };
  }

  function getHotelTotal() {
    return Object.values(state.selectedHotels).reduce((sum, option) => sum + convert(option?.priceUSD || 0, "USD", state.currency), 0);
  }

  function getTrainsTotal() {
    return getTrainTotal(state.selectedTrains.outbound) + getTrainTotal(state.selectedTrains.return);
  }

  function getExtrasTotal() {
    const extras = getAvailableExtras();
    return extras
      .filter((extra) => state.selectedExtras.has(extra.code))
      .reduce((sum, extra) => sum + getExtraTotal(extra), 0);
  }

  function getSubtotalBeforeDiscount() {
    return getBaseTotals().total + getHotelTotal() + getTrainsTotal() + getExtrasTotal();
  }

  function getManualDiscountAmount(subtotal) {
    const discount = state.manualDiscount;
    if (!discount) return 0;
    if (discount.type === "percent") return subtotal * (Number(discount.value || 0) / 100);
    if (discount.type === "fixed") return convert(Number(discount.value || 0), discount.currency || state.currency, state.currency);
    return 0;
  }

  function getPaymentMode() {
    return $("#paymentMode")?.value || "full";
  }

  function getPaymentBreakdown() {
    const subtotal = getSubtotalBeforeDiscount();
    const manualDiscount = Math.min(subtotal, getManualDiscountAmount(subtotal));
    const fullDiscount = getPaymentMode() === "full" && !state.manualDiscount ? subtotal * 0.05 : 0;
    const discount = Math.min(subtotal, manualDiscount + fullDiscount);
    const total = Math.max(0, subtotal - discount);
    const advance = getPaymentMode() === "partial" ? Math.min(total, convert(49.9 * getPassengerCount(), "USD", state.currency)) : total;
    const balance = Math.max(0, total - advance);
    return { subtotal, manualDiscount, fullDiscount, discount, total, advance, balance };
  }

  function updateSummary() {
    ensureQuoteReference();
    const bases = getBaseTotals();
    const hotelTotal = getHotelTotal();
    const trainTotal = getTrainsTotal();
    const extrasTotal = getExtrasTotal();
    const payment = getPaymentBreakdown();

    setText("#adultSummaryLabel", `Adultos x${state.adults}`);
    setText("#adultSummaryTotal", money(bases.adult));
    setText("#childrenSummaryLabel", `Niños x${state.children}`);
    setText("#childrenSummaryTotal", money(bases.child));
    toggleRow("#childrenSummaryRow", state.children > 0);

    setText("#hotelSummaryTotal", money(hotelTotal));
    toggleRow("#hotelSummaryRow", hotelTotal > 0);
    setText("#trainSummaryTotal", money(trainTotal));
    toggleRow("#trainSummaryRow", trainTotal > 0);
    setText("#extrasSummaryTotal", money(extrasTotal));
    toggleRow("#extrasSummaryRow", extrasTotal > 0);
    setText("#discountSummaryTotal", `- ${money(payment.discount)}`);
    toggleRow("#discountSummaryRow", payment.discount > 0);
    setText("#quoteGrandTotal", money(payment.total));
    setText("#advanceSummaryTotal", money(payment.advance));
    setText("#balanceSummaryTotal", money(payment.balance));
    toggleRow("#balanceSummaryRow", payment.balance > 0);

    const info = $("#paymentInfoText");
    if (info) {
      if (!getSelectedOption()) info.textContent = "Selecciona fechas e itinerario para generar la cotización.";
      else if (getTrainSelectionConfig() && (!state.selectedTrains.outbound || !state.selectedTrains.return)) info.textContent = "Elige tren de ida y retorno para completar la cotización final.";
      else info.textContent = `Cotización referencial generada. Total: ${money(payment.total)}.`;
    }
  }

  function setText(selector, text) {
    const el = $(selector);
    if (el) el.textContent = text;
  }

  function toggleRow(selector, visible) {
    const el = $(selector);
    if (el) el.hidden = !visible;
  }

  function applyManualDiscountCode() {
    const input = $("#discountCodeInput");
    const message = $("#discountCodeMessage");
    const code = String(input?.value || "").trim().toUpperCase();
    if (!code) {
      state.manualDiscount = null;
      if (message) message.textContent = "Ingresa tu código promocional si tienes uno.";
      updateSummary();
      updatePrintableTemplate();
      return;
    }
    const found = toArray(state.data.discounts).find((item) => String(item.code || "").toUpperCase() === code);
    if (!found || !found.active) {
      state.manualDiscount = null;
      if (message) message.textContent = "Código no válido o inactivo.";
      updateSummary();
      updatePrintableTemplate();
      return;
    }
    state.manualDiscount = found;
    if (message) message.textContent = `${found.label || "Descuento aplicado"}.`;
    updateSummary();
    updatePrintableTemplate();
  }

  function getCommercialOfferAmount(total) {
    const discounted = Number(total || 0) * 0.9;
    if (!Number.isFinite(discounted) || discounted <= 0) return 0;
    const rounded = Math.floor(discounted / 10) * 10 + 9.9;
    return Math.max(0, rounded);
  }

  function updatePrintableTemplate() {
    const option = getSelectedOption();
    const payment = getPaymentBreakdown();
    const ref = $("#quoteReference")?.textContent || "COT-PE---";
    const today = new Date();
    const validUntil = addDays(today, 1);

    setText("#printQuoteReference", ref);
    setText("#printIssueDate", formatDateShort(today));
    setText("#printValidUntil", formatDateShort(validUntil));
    setText("#printClientName", $("#clientName")?.value || "Por completar");
    setText("#printClientPhone", $("#clientPhone")?.value || "Por completar");
    setText("#printClientEmail", $("#clientEmail")?.value || "Por completar");
    setText("#printClientDocument", $("#clientDocument")?.value || "Por completar");
    setText("#printClientNotes", $("#clientNotes")?.value || "Sin comentarios adicionales");
    setText("#printTravelDates", getTravelRangeLabel());
    setText("#printTravelDuration", state.dates.days ? `${state.dates.days} días / ${state.dates.nights} noches` : "Por completar");
    setText("#printPassengerSummary", `${state.adults} adulto(s), ${state.children} niño(s)`);
    setText("#printNationality", getNationalityLabel());
    setText("#printArrivalTime", state.arrivalTime || "Por completar");
    setText("#printDepartureTime", state.departureTime || "Por completar");

    const couponBox = $("#printCouponBox");
    if (couponBox) couponBox.hidden = !state.manualDiscount;
    setText("#printCouponCode", state.manualDiscount?.code || "MCT-XXXX");
    setText("#printCouponDiscount", state.manualDiscount?.type === "percent" ? `${state.manualDiscount.value}%` : money(convert(state.manualDiscount?.value || 0, state.manualDiscount?.currency || state.currency, state.currency)));

    const selectedExtras = getAvailableExtras().filter((extra) => state.selectedExtras.has(extra.code));
    const trainItems = [state.selectedTrains.outbound, state.selectedTrains.return].filter(Boolean);
    const itineraryTours = buildItineraryItems(option)
      .flatMap((day) => day.activities.map((activity) => getActivityDisplayTitle(activity, day)))
      .filter(Boolean);
    const uniqueTours = [...new Set(itineraryTours)];

    const trainSummary = (train) => {
      if (!train) return "Por seleccionar";
      const company = train.isLocalTrain ? "PeruRail" : (train.companyName || train.company || "Tren");
      const service = train.serviceName || train.category || train.code;
      return `${company} · ${service} · ${train.departureTime || "--:--"} ${train.departureStation || ""} → ${train.arrivalTime || "--:--"} ${train.arrivalStation || ""}`;
    };

    const services = $("#printSelectedServices");
    if (services) {
      const rows = [
        ["Itinerario seleccionado", option?.rawCard?.recommendedTitle || option?.title || "Itinerario por confirmar"],
        ["Tren de ida", trainSummary(state.selectedTrains.outbound)],
        ["Tren de retorno", trainSummary(state.selectedTrains.return)],
        ["Tours incluidos", uniqueTours.length ? uniqueTours.join(" · ") : "Por confirmar"],
        ["Extras seleccionados", selectedExtras.length ? selectedExtras.map((extra) => extra.label || "Extra").join(" · ") : "Sin extras seleccionados"],
        ["Asistencia incluida", "Recojo del aeropuerto o terminal, coordinación local y soporte durante el viaje"]
      ];
      services.innerHTML = `
        <div class="print-services-list print-services-list--compact">
          ${rows.map(([label, value]) => `
            <div class="print-service-row">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    const hotelImages = $("#printHotelImages");
    const hotelSection = hotelImages?.closest(".print-section--hotels");
    if (hotelImages) {
      const hotelItems = Object.values(state.selectedHotels).filter((item) => item?.type === "hotel");
      if (hotelSection) hotelSection.hidden = !hotelItems.length;
      hotelImages.innerHTML = hotelItems.length ? `
        <div class="print-hotel-strip-list">
          ${hotelItems.map((item) => {
            const images = getHotelGalleryImages(item.hotel).slice(0, 4);
            const destinationLabel = getAccommodationPlan().find((plan) => plan.destination === item.destination)?.label || item.hotel?.location || "Alojamiento";
            return `
              <div class="print-hotel-row print-hotel-row--strip">
                <div class="print-hotel-info">
                  <strong>${escapeHtml(item.label || "Hotel seleccionado")}</strong>
                  <span>${escapeHtml(destinationLabel)} · ${Number(item.nights || 0)} noche(s)</span>
                  <span>${escapeHtml(item.roomsSummary || "Habitación seleccionada")}</span>
                </div>
                <div class="print-hotel-gallery">
                  ${images.map((image) => `<img src="${escapeHtml(resolveAssetPath(image))}" alt="${escapeHtml(item.label || "Hotel")}">`).join("")}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : "";
    }

    const paymentTarget = $("#printPaymentDetails");
    if (paymentTarget) {
      const bases = getBaseTotals();
      const hotelTotal = getHotelTotal();
      const trainTotal = getTrainsTotal();
      const extrasTotal = getExtrasTotal();
      const rows = [
        [`Adultos x${state.adults}`, money(bases.adult)],
        ...(state.children > 0 ? [[`Niños x${state.children}`, money(bases.child)]] : []),
        ["Alojamiento", money(hotelTotal)],
        ["Trenes", trainTotal > 0 ? money(trainTotal) : "Tren local seleccionado · sin adicional"],
        ...(extrasTotal > 0 ? [["Extras", money(extrasTotal)]] : []),
        ...(payment.manualDiscount > 0 ? [[`Cupón ${state.manualDiscount?.code || "aplicado"}`, `- ${money(payment.manualDiscount)}`]] : []),
        ...(payment.fullDiscount > 0 ? [["Descuento pago total 5%", `- ${money(payment.fullDiscount)}`]] : []),
        ["Total cotizado", money(payment.total)],
        [getPaymentMode() === "partial" ? "Pagarás ahora" : "Pago 100%", money(payment.advance)],
        ...(payment.balance > 0 ? [["Saldo pendiente", money(payment.balance)]] : [])
      ];
      paymentTarget.innerHTML = `
        <div class="print-payment-list print-payment-list--quote">
          ${rows.map(([label, value], index) => `
            <div class="print-payment-row ${index >= rows.length - (payment.balance > 0 ? 3 : 2) ? "print-payment-row--strong" : ""}">
              <strong>${escapeHtml(label)}</strong>
              <span>${escapeHtml(value)}</span>
            </div>
          `).join("")}
        </div>
      `;
    }

    const printItinerary = $("#printItinerary");
    if (printItinerary) {
      printItinerary.innerHTML = buildItineraryItems(option).map((day) => `
        <div class="print-itinerary-item print-itinerary-item--activity-images">
          <div class="print-itinerary-dayline">
            <span class="print-itinerary-day-badge">Día ${day.displayDay}</span>
            <span class="print-itinerary-date-label">${escapeHtml(formatDate(day.date))}</span>
          </div>
          ${day.activities.map((activity, index) => {
            const tour = activity.tour;
            const title = getActivityDisplayTitle(activity, day);
            const time = getActivityDisplayTime(activity, day, index);
            const description = getActivityDisplayDescription(activity, day);
            const places = getActivityPlacesText(activity, day);
            const note = activity.note || tour?.duration?.label || tour?.typeLabel || tour?.category || "";
            const image = getActivityImage(activity, day);
            return `
              <div class="print-itinerary-activity-block print-itinerary-activity-block--with-image">
                <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
                <div>
                  ${time ? `<span class="print-itinerary-start-time">${escapeHtml(time)}</span>` : ""}
                  <h4>${escapeHtml(title)}</h4>
                  <p>${escapeHtml(description)}</p>
                  ${places ? `<p class="print-itinerary-places"><strong>Lugares principales:</strong> ${escapeHtml(places)}</p>` : ""}
                  ${note ? `<span class="print-itinerary-note-badge">${escapeHtml(note)}</span>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      `).join("");
    }

    const offer = $("#printBookingOffer");
    if (offer) offer.hidden = !option;
    setText("#printBookingOfferAmount", money(getCommercialOfferAmount(payment.total)));
    setText("#printBookingOfferUntil", formatDateShort(validUntil));
  }

  function getNationalityLabel() {
    const select = $("#nationality");
    return select?.selectedOptions?.[0]?.textContent || "Por completar";
  }

  function clearDependentSections() {
    ["#hotelSection", "#trainSection", "#extrasSection"].forEach((selector) => {
      const el = $(selector);
      if (el) el.hidden = true;
    });
    ["#hotelSelectorsContainer", "#extrasContainer", "#itineraryOptions", "#itineraryPreview"].forEach((selector) => {
      const el = $(selector);
      if (el) el.innerHTML = "";
    });
  }

  function closeModals() {
    $$(".quote-modal").forEach((modal) => { modal.hidden = true; });
    state.activeHotelDestination = null;
    state.pendingHotelKey = null;
    state.activeTrainDirection = null;
    state.pendingTrainCode = null;
  }

  function buildWhatsAppText() {
    const option = getSelectedOption();
    const payment = getPaymentBreakdown();
    const lines = [
      "Hola My Cusco Trip, quiero continuar con esta cotización:",
      `Código: ${$("#quoteReference")?.textContent || "COT-PE---"}`,
      `Fechas: ${getTravelRangeLabel()}`,
      `Duración: ${state.dates.days || "--"}D/${state.dates.nights || "--"}N`,
      `Pasajeros: ${state.adults} adulto(s), ${state.children} niño(s)`,
      `Itinerario: ${option?.rawCard?.recommendedTitle || option?.title || "Por definir"}`,
      `Total referencial: ${money(payment.total)}`
    ];
    return `https://wa.me/51900608980?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  function continuePayment() {
    updatePrintableTemplate();
    window.open(buildWhatsAppText(), "_blank", "noopener");
  }

  function printQuote() {
    updatePrintableTemplate();
    window.print();
  }

  function savePdf() {
    updatePrintableTemplate();
    const element = $("#printQuotation");
    const ref = $("#quoteReference")?.textContent || "cotizacion-mycuscotrip";
    if (window.html2pdf && element) {
      const previousHidden = element.hidden;
      element.hidden = false;
      window.html2pdf().set({
        margin: [8, 8, 8, 8],
        filename: `${ref}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      }).from(element).save().finally(() => { element.hidden = previousHidden; });
    } else {
      window.print();
    }
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const showMoreBtn = event.target.closest("[data-show-more-itineraries]");
      if (showMoreBtn) {
        state.showAllItineraryOptions = true;
        renderPackageOptions();
        return;
      }

      const galleryBtn = event.target.closest("[data-hotel-gallery]");
      if (galleryBtn) {
        const gallery = galleryBtn.closest(".quote-hotel-gallery");
        const img = gallery?.querySelector("img");
        const images = String(galleryBtn.dataset.images || "").split("|").filter(Boolean);
        if (gallery && img && images.length) {
          const current = Number(gallery.dataset.galleryIndex || 0) || 0;
          const next = galleryBtn.dataset.hotelGallery === "prev"
            ? (current - 1 + images.length) % images.length
            : (current + 1) % images.length;
          gallery.dataset.galleryIndex = String(next);
          img.src = images[next];
        }
        return;
      }

      const optionBtn = event.target.closest("[data-option-index]");
      if (optionBtn) selectPackageOption(Number(optionBtn.dataset.optionIndex));

      const hotelBtn = event.target.closest("[data-open-hotel]");
      if (hotelBtn) openHotelModal(hotelBtn.dataset.openHotel);

      const hotelCard = event.target.closest("[data-hotel-key]");
      if (hotelCard) {
        state.pendingHotelKey = hotelCard.dataset.hotelKey;
        $$("#hotelModal [data-hotel-key]").forEach((card) => card.classList.toggle("is-selected", card === hotelCard));
      }

      const trainBtn = event.target.closest("[data-train-direction]");
      if (trainBtn) openTrainModal(trainBtn.dataset.trainDirection);

      const trainCard = event.target.closest("[data-train-code]");
      if (trainCard) {
        state.pendingTrainCode = trainCard.dataset.trainCode;
        $$("#trainSelectionModal [data-train-code]").forEach((card) => card.classList.toggle("is-selected", card === trainCard));
      }

      if (event.target.closest("[data-close-modal]")) closeModals();
    });

    $("#confirmHotelSelectionBtn")?.addEventListener("click", confirmHotelSelection);
    $("#confirmTrainSelectionBtn")?.addEventListener("click", confirmTrainSelection);
    $("#applyDiscountCodeBtn")?.addEventListener("click", applyManualDiscountCode);
    $("#printQuoteBtn")?.addEventListener("click", printQuote);
    $("#savePdfBtn")?.addEventListener("click", savePdf);
    $("#continuePaymentBtn")?.addEventListener("click", continuePayment);

    $("#nationality")?.addEventListener("change", (event) => {
      state.nationality = event.target.value || "national";
      applyCurrencyRulesByNationality();
      state.selectedTrains = { outbound: null, return: null };
      renderTrainSelectors();
      renderExtras();
      updateSummary();
      updatePrintableTemplate();
    });

    $("#quoteCurrency")?.addEventListener("change", (event) => {
      state.currency = event.target.value || "USD";
      renderPackageOptions();
      renderHotelSelectors();
      renderTrainSelectors();
      renderExtras();
      updateSummary();
      updatePrintableTemplate();
    });

    $("#paymentMode")?.addEventListener("change", () => {
      updateSummary();
      updatePrintableTemplate();
    });

    $$(".quote-qty-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.target;
        const delta = button.dataset.action === "plus" ? 1 : -1;
        if (target === "adults") state.adults = clampNumber(state.adults + delta, 1, 30);
        if (target === "children") state.children = clampNumber(state.children + delta, 0, 30);
        setText("#adultsCount", state.adults);
        setText("#childrenCount", state.children);
        state.selectedHotels = {};
        renderHotelSelectors();
        renderExtras();
        updateSummary();
        updatePrintableTemplate();
      });
    });

    document.addEventListener("change", (event) => {
      const extraInput = event.target.closest("#extrasContainer input[type='checkbox']");
      if (extraInput) {
        if (extraInput.checked) state.selectedExtras.add(extraInput.value);
        else state.selectedExtras.delete(extraInput.value);
        renderExtras();
        updateSummary();
        updatePrintableTemplate();
      }
    });

    ["#clientName", "#clientPhone", "#clientEmail", "#clientDocument", "#clientNotes"].forEach((selector) => {
      $(selector)?.addEventListener("input", updatePrintableTemplate);
    });
  }

  async function init() {
    ensureQuoteReference();
    setText("#adultsCount", state.adults);
    setText("#childrenCount", state.children);
    initPickers();
    bindEvents();
    await loadData();
    applyCurrencyRulesByNationality();
    updateSummary();
    updatePrintableTemplate();
    console.info("[quote-packages] Cotizador dinámico restaurado.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
