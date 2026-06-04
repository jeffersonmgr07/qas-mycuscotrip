"use strict";

/**
 * My Cusco Trip - All Experiences Page
 * Fase 3: vitrina general, búsqueda inteligente, filtros OTA y showcase comercial.
 *
 * Carga datos con data-loader.js, normaliza con catalog-normalizer.js,
 * filtra con search-service.js y genera cards dinámicas de paquetes Cusco
 * con package-generator.js cuando está disponible.
 */

(function () {
  const DEFAULT_IMAGE = "./assets/img/placeholder/experience.jpg";
  const QUICK_CHIPS = {
    "machu-picchu": { destination: "machu-picchu" },
    cusco: { destination: "cusco" },
    "valle-sagrado": { destination: "valle-sagrado" },
    naturaleza: { q: "naturaleza" },
    aventura: { q: "aventura" },
    cultural: { q: "cultural" },
    "full-day": { durationKey: "full-day", days: "", nights: "" },
    paquetes: { kind: "paquetes" },
    "con-hotel": { q: "hotel" },
    "con-tren": { q: "tren" }
  };

  const PUBLIC_DESTINATION_ORDER = [
    "cusco",
    "machu-picchu",
    "valle-sagrado",
    "puno",
    "arequipa",
    "ica",
    "lima",
    "paracas",
    "maras-moray",
    "tarapoto",
    "otros-destinos"
  ];

  const PUBLIC_DESTINATION_LABELS = {
    "cusco": "Cusco",
    "machu-picchu": "Machu Picchu",
    "valle-sagrado": "Valle Sagrado",
    "puno": "Puno",
    "arequipa": "Arequipa",
    "ica": "Ica",
    "lima": "Lima",
    "paracas": "Paracas",
    "maras-moray": "Maras y Moray",
    "tarapoto": "Tarapoto",
    "otros-destinos": "Otros destinos"
  };

  const PUBLIC_DESTINATION_LABELS_EN = {
    "cusco": "Cusco",
    "machu-picchu": "Machu Picchu",
    "valle-sagrado": "Sacred Valley",
    "puno": "Puno",
    "arequipa": "Arequipa",
    "ica": "Ica",
    "lima": "Lima",
    "paracas": "Paracas",
    "maras-moray": "Maras and Moray",
    "tarapoto": "Tarapoto",
    "otros-destinos": "Other destinations"
  };

  const HIDDEN_DESTINATIONS = new Set([
    "peru",
    "aguas-calientes",
    "machu-picchu-pueblo"
  ]);

  const DESTINATION_ALIASES = {
    "aguas-calientes": "machu-picchu",
    "machu-picchu-pueblo": "machu-picchu",
    "marasy-moray": "maras-moray",
    "maras-y-moray": "maras-moray"
  };

  const state = {
    allData: null,
    catalog: [],
    filteredCatalog: [],
    filters: {
      q: "",
      destination: "",
      kind: "",
      days: "",
      nights: "",
      durationKey: "",
      sort: "featured"
    }
  };

  const selectors = {
    grid: "#allExperiencesContainer, #experiencesGrid, #allExperiencesGrid, #productsGrid",
    empty: "#listingEmptyState, #emptyState, #experiencesEmptyState",
    count: "#resultsCount, #experiencesCount",
    summary: "#listing-summary",
    searchInput: "#filterSearch, #searchInput, #experienceSearch, #allExperienceSearch",
    destinationSelect: "#filterDestination, #destinationFilter",
    kindSelect: "#filterKind, #kindFilter, #typeFilter, #productKindFilter, #filterCategory",
    durationSelect: "#filterDuration, #durationFilter",
    sortSelect: "#filterSort, #sortFilter, #orderFilter",
    clearButton: "#clearFiltersBtn, #clearExperienceFilters",
    chips: "[data-filter-chip]",
    loader: "#pageLoader, #experiencesLoader"
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function getFirstElement(selectorList) {
    return qs(selectorList);
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }


  function isPublicProduct(item) {
    if (window.MyCuscoTripCatalogNormalizer?.isPublicProduct) {
      return window.MyCuscoTripCatalogNormalizer.isPublicProduct(item);
    }
    const status = String(item?.status || "draft").trim().toLowerCase();
    return Boolean(item?.slug) && status === "published";
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function unique(values) {
    return Array.from(new Set(toArray(values).filter(Boolean)));
  }

  function getLocale() {
    return String(window.MCT_LOCALE || document.documentElement.lang || "es").slice(0, 2).toLowerCase();
  }

  function isEnglishLocale() {
    return getLocale() === "en";
  }

  const INLINE_TRANSLATIONS = {
    pt: {
      "Medio día": "Meio dia",
      "Opción recomendada": "Opção recomendada",
      "Paquete": "Pacote",
      "Opción": "Opção",
      "Paquete variado": "Pacote variado",
      "Opción creada desde la configuración del paquete.": "Opção criada a partir da configuração do pacote.",
      "Cotización flexible": "Cotação flexível",
      "Desde": "A partir de",
      "Guía profesional": "Guia profissional",
      "Tour diario": "Tour diário",
      "Ver": "Ver",
      "Ver experiencia": "Ver experiência",
      "Explora experiencias disponibles según los filtros seleccionados.": "Explore experiências disponíveis conforme os filtros selecionados.",
      "No se pudieron cargar las experiencias": "Não foi possível carregar as experiências"
    },
    fr: {
      "Medio día": "Demi-journée",
      "Opción recomendada": "Option recommandée",
      "Paquete": "Forfait",
      "Opción": "Option",
      "Paquete variado": "Forfait varié",
      "Opción creada desde la configuración del paquete.": "Option créée à partir de la configuration du forfait.",
      "Cotización flexible": "Devis flexible",
      "Desde": "À partir de",
      "Guía profesional": "Guide professionnel",
      "Tour diario": "Tour quotidien",
      "Ver": "Voir",
      "Ver experiencia": "Voir l’expérience",
      "Explora experiencias disponibles según los filtros seleccionados.": "Explorez les expériences disponibles selon les filtres sélectionnés.",
      "No se pudieron cargar las experiencias": "Impossible de charger les expériences"
    },
    de: {
      "Medio día": "Halbtägig",
      "Opción recomendada": "Empfohlene Option",
      "Paquete": "Paket",
      "Opción": "Option",
      "Paquete variado": "Vielfältiges Paket",
      "Opción creada desde la configuración del paquete.": "Option aus der Paketkonfiguration erstellt.",
      "Cotización flexible": "Flexibles Angebot",
      "Desde": "Ab",
      "Guía profesional": "Professionelle Reiseleitung",
      "Tour diario": "Tagestour",
      "Ver": "Ansehen",
      "Ver experiencia": "Erlebnis ansehen",
      "Explora experiencias disponibles según los filtros seleccionados.": "Entdecken Sie verfügbare Erlebnisse entsprechend den ausgewählten Filtern.",
      "No se pudieron cargar las experiencias": "Erlebnisse konnten nicht geladen werden"
    }
  };

  function tr(esValue, enValue) {
    const locale = getLocale();
    if (locale === "en") return enValue;
    return INLINE_TRANSLATIONS[locale]?.[esValue] || esValue;
  }

  function formatLabel(value) {
    return String(value || "")
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }


  function getPublicDestinationValue(destination) {
    const clean = normalizeText(destination).replace(/\s+/g, "-");
    if (!clean) return "";
    return DESTINATION_ALIASES[clean] || clean;
  }

  function getPublicDestinationLabel(destination) {
    const publicValue = getPublicDestinationValue(destination);
    const labels = isEnglishLocale() ? PUBLIC_DESTINATION_LABELS_EN : PUBLIC_DESTINATION_LABELS;
    return labels[publicValue] || formatLabel(publicValue);
  }

  function isVisiblePublicDestination(destination) {
    const publicValue = getPublicDestinationValue(destination);
    return Boolean(publicValue) && !HIDDEN_DESTINATIONS.has(publicValue);
  }

  function getEffectiveFiltersForSearch() {
    const filters = { ...state.filters };

    if (filters.destination === "maras-moray") {
      filters.destination = "";
      filters.q = [filters.q, "maras moray"].filter(Boolean).join(" ").trim();
    }

    if (filters.destination === "otros-destinos") {
      filters.destination = "";
    }

    return filters;
  }

  function normalizeDurationOption(option) {
    const key = normalizeText(option?.key || option?.value || "");
    const label = String(option?.label || "").trim();

    if (!key) return null;

    const fullDayAliases = new Set(["full-day", "fullday", "1-dia", "1d", "1d0n", "dia-completo", "día-completo"]);
    const halfDayAliases = new Set(["medio-dia", "half-day", "halfday", "medio-dia-tour"]);

    if (fullDayAliases.has(key)) return { key: "full-day", label: "Full day", rank: 20 };
    if (halfDayAliases.has(key)) return { key: "medio-dia", label: tr("Medio día", "Half day"), rank: 10 };

    const match = key.match(/^(\d+)d(?:(\d+)n)?$/);
    if (match) {
      const days = Number(match[1]);
      const nights = Number(match[2] || Math.max(days - 1, 0));
      return {
        key: `${days}d${nights}n`,
        label: isEnglishLocale()
          ? `${days} day${days === 1 ? "" : "s"} / ${nights} night${nights === 1 ? "" : "s"}`
          : `${days} días / ${nights} noche${nights === 1 ? "" : "s"}`,
        rank: 100 + days
      };
    }

    return { key, label: label || formatLabel(key), rank: 900 };
  }

  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getProductsFromSource(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.products)) return source.products;
    if (Array.isArray(source.tours)) return source.tours;
    if (Array.isArray(source.items)) return source.items;
    return [];
  }

  function buildTourIndex(data) {
    const index = new Map();
    [
      ...getProductsFromSource(data.toursCusco),
      ...getProductsFromSource(data.toursMachuPicchu),
      ...getProductsFromSource(data.toursPeru),
      ...getProductsFromSource(data.trekkingsCusco)
    ].forEach((tour) => {
      if (tour?.internalCode) index.set(tour.internalCode, tour);
      if (tour?.id) index.set(tour.id, tour);
      if (tour?.slug) index.set(tour.slug, tour);
    });
    return index;
  }

  function getParamsFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const parsedDuration = parseDurationValue(params.get("duration") || params.get("durationKey") || "");

    return {
      q: params.get("q") || params.get("search") || "",
      destination: params.get("destino") || params.get("destination") || "",
      kind: params.get("tipo") || params.get("kind") || params.get("productKind") || "",
      days: params.get("days") || parsedDuration.days || "",
      nights: params.get("nights") || parsedDuration.nights || "",
      durationKey: parsedDuration.durationKey || "",
      sort: params.get("sort") || params.get("order") || "featured"
    };
  }

  function updateUrlFromFilters() {
    const params = new URLSearchParams();

    if (state.filters.q) params.set("q", state.filters.q);
    if (state.filters.destination) params.set("destino", state.filters.destination);
    if (state.filters.kind) params.set("tipo", state.filters.kind);
    if (state.filters.days) params.set("days", state.filters.days);
    if (state.filters.nights) params.set("nights", state.filters.nights);
    if (state.filters.durationKey && !state.filters.days) params.set("duration", state.filters.durationKey);
    if (state.filters.sort && !["featured", "recommended", "recomendados", "commercial-showcase"].includes(normalizeText(state.filters.sort))) params.set("sort", state.filters.sort);

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, "", newUrl);
  }

  function buildDurationKey(days, nights) {
    const d = Number(days);
    const n = Number(nights);
    if (!Number.isFinite(d) || d <= 0) return "";
    if (!Number.isFinite(n) || n < 0) return `${d}d`;
    return `${d}d${n}n`;
  }

  function parseDurationValue(value) {
    const clean = normalizeText(value);
    if (!clean) return { days: "", nights: "", durationKey: "" };

    const compact = clean
      .replace(/\s+/g, "")
      .replace(/dias?/g, "d")
      .replace(/noches?/g, "n")
      .replace(/\//g, "");

    const match = compact.match(/^(\d+)d(?:(\d+)n)?$/);
    if (!match) return { days: "", nights: "", durationKey: clean };

    return {
      days: match[1] || "",
      nights: match[2] || "",
      durationKey: `${match[1]}d${match[2] ? `${match[2]}n` : ""}`
    };
  }

  function setLoader(isVisible) {
    const loader = getFirstElement(selectors.loader);
    if (loader) loader.hidden = !isVisible;
  }

  function setElementValue(selectorList, value) {
    const element = getFirstElement(selectorList);
    if (element) element.value = value || "";
  }

  function hydrateFiltersFromUrl() {
    state.filters = { ...state.filters, ...getParamsFromUrl() };
    syncControlsFromState();
  }

  function syncControlsFromState() {
    setElementValue(selectors.searchInput, state.filters.q);
    setElementValue(selectors.destinationSelect, state.filters.destination);
    setElementValue(selectors.kindSelect, state.filters.kind);
    setElementValue(selectors.durationSelect, state.filters.durationKey || buildDurationKey(state.filters.days, state.filters.nights));
    setElementValue(selectors.sortSelect, state.filters.sort);
    syncActiveChips();
  }

  function getTourLabels(codes, tourIndex) {
    return unique(codes).map((code) => {
      const tour = tourIndex.get(code);
      return tour?.title || code;
    });
  }

  function getOptionHighlights(option, tourIndex) {
    const codes = unique(option?.includedTourCodes);
    const titles = getTourLabels(codes, tourIndex);
    return titles
      .filter((title) => !/^(CUZ|MAPI|PER)\d+/i.test(String(title || "")))
      .slice(0, 4);
  }

  function getCommercialPackageOrder(days, optionIndex, family = "cusco-package") {
    const d = Number(days || 0);
    const index = Number(optionIndex || 0);

    if (family === "peru-package") return 60000 + d;

    if (index === 0 && d >= 3 && d <= 10) return 20000 + d;
    if (index === 1 && d >= 3 && d <= 8) return 30000 + d;
    if (index === 2 && d >= 3 && d <= 8) return 40000 + d;
    return 50000 + (index * 100) + d;
  }

  function getCommercialTourOrder(product) {
    const familyRank = {
      "cusco-tour": 1000,
      "machu-picchu-tour": 2000,
      "peru-tour": 3000
    };
    const base = familyRank[product.productFamily] || 3500;
    const featuredPenalty = product.featured ? 0 : 200;
    const price = Number(product.price?.amount || 0);
    return base + featuredPenalty + Math.min(price, 999) / 1000;
  }

  function createDynamicPackageCard({ option, optionIndex, card, tourIndex, source = "packagesCusco" }) {
    const highlights = getOptionHighlights(option, tourIndex);
    const search = card?.search || {};
    const optionBadge = optionIndex === 0
      ? tr("Opción recomendada", "Recommended option")
      : optionIndex === 1
        ? tr("Alternativa flexible", "Flexible alternative")
        : optionIndex === 2
          ? tr("Ruta especial", "Special route")
          : card?.badge || tr("Paquete", "Package");

    const optionLabel = `${tr("Opción", "Option")} ${optionIndex + 1}`;
    const subtitle = highlights.length ? highlights.join(" + ") : card?.shortDescription || tr("Combinación flexible", "Flexible combination");

    return {
      id: `${card?.id || card?.slug || "pkg"}__option_${optionIndex}`,
      internalCode: "",
      slug: card?.slug || option?.slug || "",
      title: `${card?.title || option?.title || tr("Paquete variado", "Varied package")} · ${optionLabel}`,
      category: card?.category || "cusco",
      productKind: "package",
      productFamily: option?.productFamily || card?.productFamily || "cusco-package",
      days: Number(card?.days || option?.days || 0),
      nights: Number(card?.nights || option?.nights || 0),
      typeLabel: card?.typeLabel || option?.typeLabel || tr("Paquete", "Package"),
      duration: { label: card?.typeLabel || option?.typeLabel || tr("Paquete", "Package") },
      location: card?.location || option?.location || "Cusco / Machu Picchu",
      image: card?.image || option?.image || "",
      badge: optionBadge,
      featured: optionIndex === 0 || Boolean(card?.featured),
      status: card?.status || "published",
      priceMode: "dynamic_from_selected_itinerary",
      price: { amount: 0, currency: option?.currency || "USD", mode: "dynamic_from_selected_itinerary" },
      currency: option?.currency || "USD",
      shortDescription: subtitle,
      description: card?.shortDescription || option?.generationReason || tr("Opción creada desde la configuración del paquete.", "Option created from the package configuration."),
      search: {
        kind: "package",
        destinations: toArray(search.destinations),
        durationKeys: unique([...(toArray(search.durationKeys)), `${card?.days || option?.days}d${card?.nights || option?.nights}n`]),
        includedTourCodes: unique([...(toArray(search.includedTourCodes)), ...toArray(option?.includedTourCodes)]),
        includedTags: unique([...(toArray(search.includedTags)), "hotel", "tren", "con-hotel", "con-tren", ...toArray(option?.includedTourCodes).map(normalizeText)]),
        themes: toArray(search.themes),
        keywords: unique([...(toArray(search.keywords)), "hotel", "tren", "con hotel", "con tren", optionLabel, ...highlights])
      },
      source,
      raw: option,
      rawCard: card,
      optionIndex,
      optionParam: optionIndex,
      itineraryHints: option?.itineraryHints || {},
      includedTourCodes: unique(option?.includedTourCodes),
      commercialOrder: getCommercialPackageOrder(card?.days || option?.days, optionIndex, option?.productFamily || card?.productFamily)
    };
  }

  function createStaticPackageCard(product, orderOffset = 0) {
    return {
      ...product,
      commercialOrder: getCommercialPackageOrder(product.days, 99 + orderOffset, product.productFamily)
    };
  }

  function buildDynamicCuscoPackageCards(loaded) {
    const data = getDataPayload(loaded);
    const packagesCusco = data.packagesCusco;
    const cards = toArray(packagesCusco?.packageCards).filter(isPublicProduct);
    const tourIndex = buildTourIndex(data);

    if (!cards.length) return [];

    return cards.flatMap((card) => {
      let options = [];

      if (window.MyCuscoTripPackageGenerator?.generatePackageOptions) {
        try {
          options = window.MyCuscoTripPackageGenerator.generatePackageOptions({
            days: card.days,
            nights: card.nights,
            productFamily: "cusco-package",
            family: "cusco-package"
          }, loaded);
        } catch (error) {
          console.warn("[MyCuscoTrip AllExperiences] No se pudieron generar opciones para", card.slug, error);
        }
      }

      if (!options.length) {
        return [createStaticPackageCard(window.MyCuscoTripCatalogNormalizer.normalizePackageCard(card, packagesCusco, "packagesCusco"))];
      }

      return options.map((option, index) => createDynamicPackageCard({
        option,
        optionIndex: index,
        card,
        tourIndex,
        source: "packagesCusco"
      }));
    });
  }

  function buildShowcaseCatalog(loaded) {
    const normalized = window.MyCuscoTripCatalogNormalizer.normalizeCatalog(loaded);
    const tours = normalized
      .filter((product) => product.productKind === "tour")
      .map((product) => ({ ...product, commercialOrder: getCommercialTourOrder(product) }));

    const dynamicCuscoPackages = buildDynamicCuscoPackageCards(loaded);
    const peruPackages = normalized
      .filter((product) => product.productKind === "package" && product.productFamily === "peru-package")
      .map((product, index) => createStaticPackageCard(product, index));

    return [...tours, ...dynamicCuscoPackages, ...peruPackages]
      .filter(isPublicProduct)
      .map((product, index) => ({
        ...product,
        showcaseIndex: index,
        commercialOrder: Number.isFinite(Number(product.commercialOrder)) ? Number(product.commercialOrder) : 90000 + index
      }));
  }

  function commercialSort(products) {
    return [...products].sort((a, b) => {
      if (a.productKind !== b.productKind) return a.productKind === "tour" ? -1 : 1;
      if (Number(a.commercialOrder) !== Number(b.commercialOrder)) return Number(a.commercialOrder) - Number(b.commercialOrder);
      return normalizeText(a.title).localeCompare(normalizeText(b.title));
    });
  }

  function sortFilteredProducts(products) {
    const mode = normalizeText(state.filters.sort || "commercial-showcase");

    if (["featured", "recommended", "recomendados", "commercial-showcase", "commercial", "ota"].includes(mode)) {
      return commercialSort(products);
    }

    if (mode === "duration" || mode === "duracion") {
      return [...products].sort((a, b) => {
        if (Number(a.days || 0) !== Number(b.days || 0)) return Number(a.days || 0) - Number(b.days || 0);
        if (Number(a.nights || 0) !== Number(b.nights || 0)) return Number(a.nights || 0) - Number(b.nights || 0);
        return normalizeText(a.title).localeCompare(normalizeText(b.title));
      });
    }

    return window.MyCuscoTripSearchService.sortProducts(products, mode);
  }

  function populateDestinationFilter() {
    const select = getFirstElement(selectors.destinationSelect);
    if (!select) return;

    const currentValue = getPublicDestinationValue(state.filters.destination || select.value);
    const available = window.MyCuscoTripSearchService
      .getAvailableDestinations(state.catalog)
      .map(getPublicDestinationValue)
      .filter(isVisiblePublicDestination);

    const destinations = unique([...PUBLIC_DESTINATION_ORDER, ...available])
      .filter(isVisiblePublicDestination);

    select.innerHTML = `
      <option value="">${tr("Todos los destinos", "All destinations")}</option>
      ${destinations.map((destination) => `<option value="${escapeHtml(destination)}">${escapeHtml(getPublicDestinationLabel(destination))}</option>`).join("")}
    `;

    select.value = destinations.includes(currentValue) ? currentValue : "";
    state.filters.destination = select.value;
  }

  function populateDurationFilter() {
    const select = getFirstElement(selectors.durationSelect);
    if (!select) return;

    const currentValue = state.filters.durationKey || buildDurationKey(state.filters.days, state.filters.nights) || select.value;
    const preferred = [
      { key: "medio-dia", label: tr("Medio día", "Half day"), rank: 10 },
      { key: "full-day", label: "Full day", rank: 20 },
      { key: "2d1n", label: tr("2 días / 1 noche", "2 days / 1 night"), rank: 102 },
      { key: "3d2n", label: tr("3 días / 2 noches", "3 days / 2 nights"), rank: 103 },
      { key: "4d3n", label: tr("4 días / 3 noches", "4 days / 3 nights"), rank: 104 },
      { key: "5d4n", label: tr("5 días / 4 noches", "5 days / 4 nights"), rank: 105 },
      { key: "6d5n", label: tr("6 días / 5 noches", "6 days / 5 nights"), rank: 106 },
      { key: "7d6n", label: tr("7 días / 6 noches", "7 days / 6 nights"), rank: 107 },
      { key: "8d7n", label: tr("8 días / 7 noches", "8 days / 7 nights"), rank: 108 },
      { key: "9d8n", label: tr("9 días / 8 noches", "9 days / 8 nights"), rank: 109 },
      { key: "10d9n", label: tr("10 días / 9 noches", "10 days / 9 nights"), rank: 110 }
    ];

    const existing = new Map(preferred.map((item) => [item.key, item]));

    window.MyCuscoTripSearchService.getAvailableDurations(state.catalog).forEach((duration) => {
      const normalized = normalizeDurationOption(duration);
      if (normalized && !existing.has(normalized.key)) existing.set(normalized.key, normalized);
    });

    const durations = Array.from(existing.values()).sort((a, b) => {
      if (Number(a.rank || 900) !== Number(b.rank || 900)) return Number(a.rank || 900) - Number(b.rank || 900);
      return normalizeText(a.label).localeCompare(normalizeText(b.label));
    });

    select.innerHTML = `
      <option value="">${tr("Todas las duraciones", "All durations")}</option>
      ${durations.map((duration) => `<option value="${escapeHtml(duration.key)}">${escapeHtml(duration.label)}</option>`).join("")}
    `;
    select.value = currentValue;
  }

  function getProductUrl(product) {
    const base = `product.html?slug=${encodeURIComponent(product.slug)}`;
    if (product.productKind === "package" && Number.isInteger(product.optionParam)) {
      return `${base}&option=${encodeURIComponent(product.optionParam)}`;
    }
    return base;
  }

  function getPriceLabel(product) {
    if (product.productKind === "package" || product.priceMode === "dynamic_from_selected_itinerary") {
      return product.productFamily === "peru-package"
        ? tr("Cotización flexible", "Flexible quote")
        : tr("Precio según selección", "Price based on selection");
    }

    const amount = Number(product.price?.amount || 0);
    const currency = product.price?.currency || product.currency || "USD";
    if (!Number.isFinite(amount) || amount <= 0) return tr("Consultar", "Ask for details");
    return `${tr("Desde", "From")} ${currency} ${amount.toFixed(2)}`;
  }

  function getDetails(product) {
    const chips = [];
    const themes = toArray(product?.search?.themes).map(formatLabel);
    const tags = toArray(product?.search?.includedTags).map(normalizeText);
    const family = normalizeText(product?.productFamily);

    if (product.typeLabel) chips.push(product.typeLabel);

    if (product.productKind === "package") {
      chips.push(product.productFamily === "peru-package" ? tr("Multidestino", "Multi-destination") : "Machu Picchu");
      chips.push(tr("Hotel configurable", "Configurable hotel"));
      chips.push(tr("Tren configurable", "Configurable train"));
    } else if (family === "machu-picchu-tour") {
      chips.push(tr("Con tren", "Train included"));
      chips.push(tr("Entrada incluida", "Entrance included"));
      chips.push(tr("Guía profesional", "Professional guide"));
    } else {
      if (themes.length) chips.push(themes[0]);
      if (tags.includes("full-day")) chips.push("Full day");
      if (tags.includes("medio-dia") || tags.includes("half-day")) chips.push(tr("Medio día", "Half day"));
      chips.push(tr("Tour diario", "Daily tour"));
    }

    return unique(chips)
      .filter((chip) => !/^(CUZ|MAPI|PER)\d+/i.test(String(chip || "")))
      .slice(0, 4);
  }

  function renderProductCard(product) {
    const image = product.image || DEFAULT_IMAGE;
    const kindLabel = product.productKind === "package" ? tr("Paquete", "Package") : "Tour";
    const details = getDetails(product);

    return `
      <article class="listing-card" data-product-kind="${escapeHtml(product.productKind)}" data-product-family="${escapeHtml(product.productFamily)}">
        <a class="listing-card__link" href="${escapeHtml(getProductUrl(product))}" aria-label="${tr("Ver", "View")} ${escapeHtml(product.title)}">
          <div class="listing-card__image">
            <img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.src='${DEFAULT_IMAGE}'">
            <span class="listing-card__badge">${escapeHtml(product.badge || kindLabel)}</span>
          </div>
          <div class="listing-card__content">
            <div class="listing-card__meta">
              <span>${escapeHtml(kindLabel)}</span>
              ${product.optionIndex !== undefined ? `<span>${tr("Opción", "Option")} ${Number(product.optionIndex) + 1}</span>` : ""}
            </div>
            <h3>${escapeHtml(product.title)}</h3>
            ${product.shortDescription ? `<p class="listing-card__description">${escapeHtml(product.shortDescription)}</p>` : ""}
            <div class="listing-card__details">
              ${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}
            </div>
            <div class="listing-card__actions">
              <strong class="listing-card__price">${escapeHtml(getPriceLabel(product))}</strong>
              <span class="btn listing-card__button">${tr("Ver experiencia", "View experience")}</span>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function renderProducts() {
    const grid = getFirstElement(selectors.grid);
    const empty = getFirstElement(selectors.empty);
    const count = getFirstElement(selectors.count);
    const summary = getFirstElement(selectors.summary);

    if (!grid) {
      console.warn("[MyCuscoTrip AllExperiences] Cards container was not found.");
      return;
    }

    const total = state.filteredCatalog.length;
    if (count) {
      count.textContent = isEnglishLocale()
        ? `${total} experience${total === 1 ? "" : "s"} found`
        : `${total} experiencia${total === 1 ? "" : "s"} encontrada${total === 1 ? "" : "s"}`;
    }
    if (summary) summary.textContent = tr("Explora experiencias disponibles según los filtros seleccionados.", "Explore available experiences based on the selected filters.");

    if (!total) {
      grid.innerHTML = "";
      if (empty) empty.hidden = true;
      return;
    }

    if (empty) empty.hidden = true;
    grid.innerHTML = state.filteredCatalog.map(renderProductCard).join("");
  }

  function applyFilters({ updateUrl = true } = {}) {
    if (!window.MyCuscoTripSearchService) {
      console.error("[MyCuscoTrip AllExperiences] Falta search-service.js");
      return;
    }

    const filtered = window.MyCuscoTripSearchService.filterProducts(state.catalog, {
      ...getEffectiveFiltersForSearch(),
      sort: "featured"
    });

    state.filteredCatalog = sortFilteredProducts(filtered);
    if (updateUrl) updateUrlFromFilters();
    syncActiveChips();
    renderProducts();
  }

  function syncActiveChips() {
    qsa(selectors.chips).forEach((chip) => {
      const key = chip.getAttribute("data-filter-chip");
      const chipFilters = QUICK_CHIPS[key] || {};
      const isActive = Object.entries(chipFilters).every(([filterKey, value]) => {
        if (filterKey === "q") return normalizeText(state.filters.q).includes(normalizeText(value));
        return String(state.filters[filterKey] || "") === String(value || "");
      });
      chip.classList.toggle("is-active", isActive);
    });
  }

  function clearFilters() {
    state.filters = {
      q: "",
      destination: "",
      kind: "",
      days: "",
      nights: "",
      durationKey: "",
      sort: "featured"
    };
    syncControlsFromState();
    applyFilters();
  }

  function bindFilters() {
    const searchInput = getFirstElement(selectors.searchInput);
    const destinationSelect = getFirstElement(selectors.destinationSelect);
    const kindSelect = getFirstElement(selectors.kindSelect);
    const durationSelect = getFirstElement(selectors.durationSelect);
    const sortSelect = getFirstElement(selectors.sortSelect);
    const clearButton = getFirstElement(selectors.clearButton);

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.filters.q = searchInput.value.trim();
        applyFilters();
      });
    }

    if (destinationSelect) {
      destinationSelect.addEventListener("change", () => {
        state.filters.destination = destinationSelect.value;
        applyFilters();
      });
    }

    if (kindSelect) {
      kindSelect.addEventListener("change", () => {
        state.filters.kind = kindSelect.value;
        applyFilters();
      });
    }

    if (durationSelect) {
      durationSelect.addEventListener("change", () => {
        const parsed = parseDurationValue(durationSelect.value);
        state.filters.days = parsed.days;
        state.filters.nights = parsed.nights;
        state.filters.durationKey = parsed.durationKey;
        applyFilters();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", () => {
        state.filters.sort = sortSelect.value || "featured";
        applyFilters();
      });
    }

    if (clearButton) clearButton.addEventListener("click", clearFilters);

    qsa(selectors.chips).forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter-chip");
        const chipFilters = QUICK_CHIPS[key] || {};
        state.filters = { ...state.filters, ...chipFilters };
        syncControlsFromState();
        applyFilters();
      });
    });
  }

  async function initAllExperiencesPage() {
    setLoader(true);

    try {
      if (!window.MyCuscoTripDataLoader) throw new Error("Falta data-loader.js");
      if (!window.MyCuscoTripCatalogNormalizer) throw new Error("Falta catalog-normalizer.js");
      if (!window.MyCuscoTripSearchService) throw new Error("Falta search-service.js");

      const loaded = await window.MyCuscoTripDataLoader.loadAllData();
      state.allData = loaded;
      state.catalog = buildShowcaseCatalog(loaded);
      state.filteredCatalog = [...state.catalog];

      if (loaded.hasErrors) {
        console.warn("[MyCuscoTrip AllExperiences] Algunos JSON no cargaron:", loaded.errors);
      }

      hydrateFiltersFromUrl();
      populateDestinationFilter();
      populateDurationFilter();
      syncControlsFromState();
      bindFilters();
      applyFilters({ updateUrl: false });
    } catch (error) {
      console.error("[MyCuscoTrip AllExperiences] Error initializing page:", error);
      const grid = getFirstElement(selectors.grid);
      if (grid) {
        grid.innerHTML = `
          <div class="listing-error">
            <h3>${tr("No se pudieron cargar las experiencias", "Experiences could not be loaded")}</h3>
            <p>${tr("Revisa que existan los JSON y que estén cargados los scripts core antes de all-experiences.js.", "Check that the JSON files exist and that the core scripts are loaded before all-experiences.js.")}</p>
          </div>
        `;
      }
    } finally {
      setLoader(false);
    }
  }

  document.addEventListener("DOMContentLoaded", initAllExperiencesPage);

  window.MyCuscoTripAllExperiences = {
    state,
    applyFilters,
    renderProducts,
    initAllExperiencesPage,
    buildShowcaseCatalog
  };
})();
