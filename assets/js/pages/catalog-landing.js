"use strict";

(function () {
  const DATA_SOURCES = [
    {
      key: "tours-cusco",
      url: "./assets/data/tours-cusco.json",
      collectionKeys: ["products"],
      defaultKind: "tour",
      defaultFamily: "cusco-tour"
    },
    {
      key: "tours-machu-picchu",
      url: "./assets/data/tours-machu-picchu.json",
      collectionKeys: ["tours", "products"],
      defaultKind: "tour",
      defaultFamily: "machu-picchu-tour"
    },
    {
      key: "trekkings-cusco",
      url: "./assets/data/trekkings-cusco.json",
      collectionKeys: ["products", "trekkings"],
      defaultKind: "tour",
      defaultFamily: "cusco-trekking"
    },
    {
      key: "tours-peru",
      url: "./assets/data/tours-peru.json",
      collectionKeys: ["products", "tours"],
      defaultKind: "tour",
      defaultFamily: "peru-tour"
    },
    {
      key: "packages-cusco",
      url: "./assets/data/packages-cusco.json",
      collectionKeys: ["packageCards"],
      defaultKind: "package",
      defaultFamily: "cusco-package"
    },
    {
      key: "packages-peru",
      url: "./assets/data/packages-peru.json",
      collectionKeys: ["packageCards"],
      defaultKind: "package",
      defaultFamily: "peru-package"
    }
  ];

  const state = {
    catalog: [],
    filtered: []
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function getLocalePrefix() {
    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    const base = window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
    return locale === "es" ? base : `${base}${locale}/`;
  }

  function resolveDataUrl(url) {
    const clean = String(url || "").replace(/^\.?\//, "");
    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    const filename = clean.split("/").pop();
    const localizable = ["tours-cusco.json", "tours-machu-picchu.json", "tours-peru.json", "packages-cusco.json", "packages-peru.json", "trekkings-cusco.json"];
    const base = window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
    if (locale !== "es" && clean.startsWith("assets/data/") && localizable.includes(filename)) {
      return `${base}assets/data/i18n/${locale}/${filename}`;
    }
    return `${base}${clean}`;
  }


  function t(key, fallback = "") {
    return window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
  }



  function translateVisibleLabel(value) {
    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    if (locale === "es") return value;
    const key = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const map = {
      "nuevo": "New",
      "imperdible": "Must-see",
      "top ventas": "Best seller",
      "mas vendido": "Best seller",
      "recomendado": "Recommended",
      "aventura": "Adventure",
      "naturaleza": "Nature",
      "cultural": "Cultural",
      "con tren": "Train included",
      "ruta vip": "VIP route",
      "conexion machu picchu": "Machu Picchu connection",
      "vip + conexion": "VIP + connection",
      "completo": "Complete",
      "escapada esencial": "Essential escape",
      "gran viaje": "Grand journey",
      "experiencia amplia": "Full experience",
      "profundo": "Deep route",
      "flexible": "Flexible",
      "andes del sur": "Southern Andes",
      "peru esencial": "Essential Peru",
      "primer viaje": "First trip",
      "ruta completa": "Complete route"
    };
    return map[key] || value;
  }

  function waitForI18nReady() {
    const hasDictionary = window.MyCuscoTripI18n?.dictionary && Object.keys(window.MyCuscoTripI18n.dictionary).length;
    if (hasDictionary) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      window.addEventListener("mct:i18n-ready", finish, { once: true });
      setTimeout(finish, 900);
    });
  }

  function resolveAssetUrl(url) {
    if (!url) return "";
    const raw = String(url).trim();
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("/")) return raw;
    const clean = raw.replace(/^\.?\//, "");
    const base = window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
    return `${base}${clean}`.replace(/([^:]\/)\/{2,}/g, "$1");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }


  function isPublicProduct(item, includeDrafts = false) {
    const status = String(item?.status || "draft").trim().toLowerCase();
    return Boolean(item?.slug) && (status === "published" || (includeDrafts && status === "draft"));
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function getTrekkingCategoryConfig() {
    const params = new URLSearchParams(window.location.search);
    const category = normalizeText(params.get("categoria") || "");

    const categories = {
      "camino-inca": {
        label: "Camino Inca",
        keywords: ["camino inca", "inca trail"],
        note: "Rutas inspiradas en el Camino Inca y experiencias de trekking hacia Machu Picchu."
      },
      "rutas-machu-picchu": {
        label: "Rutas a Machu Picchu",
        keywords: ["machu picchu", "salkantay", "lares", "trekking", "trek"],
        note: "Rutas de aventura y naturaleza que conectan con Machu Picchu o su entorno andino."
      },
      "inca-jungle": {
        label: "Inca Jungle",
        keywords: ["inca jungle", "jungle", "aventura"],
        note: "Rutas de aventura tipo Inca Jungle y experiencias activas en la ruta hacia Machu Picchu."
      },
      "salkantay": {
        label: "Salkantay Trek",
        keywords: ["salkantay"],
        note: "Opciones de Salkantay Trek con paisajes altoandinos y conexión hacia Machu Picchu."
      },
      "ausangate": {
        label: "Ausangate Trek",
        keywords: ["ausangate"],
        note: "Rutas alrededor del Ausangate, lagunas altoandinas y comunidades de la cordillera Vilcanota."
      }
    };

    return categories[category] ? { key: category, ...categories[category] } : null;
  }

  function formatMoney(value, currency = "USD") {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return t("cards.checkPrice", "Consultar");

    try {
      return new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(number);
    } catch (error) {
      return `${currency} ${number.toFixed(2)}`;
    }
  }

  function formatDuration(item) {
    if (item.typeLabel) return item.typeLabel;
    if (item.duration?.label) return item.duration.label;

    const days = Number(item.days || 0);
    const nights = Number(item.nights || 0);

    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    if (locale !== "es") {
      if (days > 0 && nights > 0) return `${days} days / ${nights} nights`;
      if (days === 1) return "Full day";
      if (days > 1) return `${days} days`;
      return "Experience";
    }

    if (days > 0 && nights > 0) return `${days} días / ${nights} noches`;
    if (days === 1) return "Full day";
    if (days > 1) return `${days} días`;

    return "Experiencia";
  }

  function getPrice(item) {
    if (item.priceMode && String(item.priceMode).includes("dynamic")) return null;
    if (item.basePricing?.adult) return Number(item.basePricing.adult);
    if (item.pricing?.publishedAdultUSD) return Number(item.pricing.publishedAdultUSD);
    if (item.price?.adult) return Number(item.price.adult);
    if (item.price?.amount) return Number(item.price.amount);
    if (typeof item.price === "number") return Number(item.price);
    return null;
  }

  function getImage(item) {
    if (typeof item.image === "string" && item.image) return item.image;
    if (item.images?.cover) return item.images.cover;
    if (Array.isArray(item.images?.gallery) && item.images.gallery[0]) return item.images.gallery[0];
    return "assets/img/tours/machu-picchu-full-day-clasico/cover.jpg";
  }

  function normalizeProduct(item, source) {
    const productKind = item.productKind === "package"
      ? "package"
      : item.search?.kind === "package"
        ? "package"
        : source.defaultKind;

    const productFamily = item.productFamily || item.search?.productFamily || source.defaultFamily;
    const currency = item.currency || item.defaultCurrency || "USD";
    const price = getPrice(item);

    return {
      raw: item,
      sourceKey: source.key,
      id: item.id || item.slug || `${source.key}-${Math.random().toString(36).slice(2)}`,
      slug: item.slug || "",
      title: item.title || t("cards.experience", "Experience"),
      productKind,
      productFamily,
      typeLabel: formatDuration(item),
      badge: translateVisibleLabel(item.badge || (productKind === "package" ? t("cards.package", "Package") : "Tour")),
      location: item.location || (window.MyCuscoTripI18n?.getLocaleFromUrl?.() === "es" ? "Perú" : "Peru"),
      shortDescription: item.shortDescription || item.description || t("cards.selectedExperience", "Experience selected by My Cusco Trip."),
      image: resolveAssetUrl(getImage(item)),
      featured: Boolean(item.featured),
      status: item.status || "published",
      days: Number(item.days || 0),
      nights: Number(item.nights || 0),
      price,
      currency,
      search: item.search || {},
      url: item.slug ? `${getLocalePrefix()}product.html?slug=${encodeURIComponent(item.slug)}` : `${getLocalePrefix()}all-experiences.html`
    };
  }

  async function loadJson(source) {
    try {
      const response = await fetch(resolveDataUrl(source.url), { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.warn(`No se pudo cargar ${source.url}`, error);
      return null;
    }
  }

  function extractItems(data, source) {
    if (!data) return [];

    return source.collectionKeys.flatMap((key) => {
      const collection = data[key];
      return Array.isArray(collection) ? collection : [];
    });
  }

  async function buildCatalog() {
    const loaded = await Promise.all(DATA_SOURCES.map(async (source) => {
      const data = await loadJson(source);
      return extractItems(data, source).map((item) => normalizeProduct(item, source));
    }));

    const config = getPageConfig();
    state.catalog = loaded
      .flat()
      .filter((item) => isPublicProduct(item, config.includeDrafts));
  }

  function getPageConfig() {
    const body = document.body;

    const toList = (value) => String(value || "").split(",").map((item) => normalizeText(item)).filter(Boolean);
    const toNumberOrNull = (value) => value === undefined || value === "" ? null : Number(value);

    return {
      kind: body.dataset.catalogKind || "",
      family: body.dataset.catalogFamily || "",
      families: toList(body.dataset.catalogFamilies),
      mode: body.dataset.catalogMode || "",
      destinations: toList(body.dataset.catalogDestinations),
      themes: toList(body.dataset.catalogThemes),
      keywords: toList(body.dataset.catalogKeywords),
      excludeKeywords: toList(body.dataset.catalogExcludeKeywords),
      ids: toList(body.dataset.catalogIds),
      excludeIds: toList(body.dataset.catalogExcludeIds),
      days: toNumberOrNull(body.dataset.catalogDays),
      nights: toNumberOrNull(body.dataset.catalogNights),
      minDays: toNumberOrNull(body.dataset.catalogMinDays),
      maxDays: toNumberOrNull(body.dataset.catalogMaxDays),
      minNights: toNumberOrNull(body.dataset.catalogMinNights),
      maxNights: toNumberOrNull(body.dataset.catalogMaxNights),
      includeDrafts: body.dataset.catalogIncludeDrafts === "true",
      trekkingCategory: getTrekkingCategoryConfig(),
      limit: Number(body.dataset.catalogLimit || 0)
    };
  }

  function productMatchesDestination(item, destinations) {
    if (!destinations.length) return true;

    const haystack = [
      item.location,
      ...(item.search.destinations || []),
      ...(item.search.keywords || []),
      ...(item.search.includedTags || [])
    ].map(normalizeText);

    return destinations.some((destination) => haystack.some((entry) => entry.includes(destination)));
  }

  function productMatchesThemes(item, themes) {
    if (!themes.length) return true;

    const haystack = [
      ...(item.search.themes || []),
      ...(item.search.includedTags || []),
      ...(item.search.keywords || [])
    ].map(normalizeText);

    return themes.some((theme) => haystack.some((entry) => entry.includes(theme)));
  }

  function productMatchesKeywords(item, keywords) {
    if (!keywords.length) return true;

    const haystack = [
      item.title,
      item.location,
      item.typeLabel,
      ...(item.search.keywords || []),
      ...(item.search.themes || []),
      ...(item.search.includedTags || []),
      ...(item.search.durationKeys || []),
      ...(item.search.destinations || [])
    ].map(normalizeText);

    return keywords.some((keyword) => haystack.some((entry) => entry.includes(keyword)));
  }

  function productMatchesExcludedKeywords(item, keywords) {
    if (!keywords.length) return false;
    const haystack = [
      item.id,
      item.slug,
      item.title,
      item.location,
      item.typeLabel,
      ...(item.search.keywords || []),
      ...(item.search.themes || []),
      ...(item.search.includedTags || []),
      ...(item.search.durationKeys || []),
      ...(item.search.destinations || [])
    ].map(normalizeText);
    return keywords.some((keyword) => haystack.some((entry) => entry.includes(keyword)));
  }

  function isTrekkingCandidate(item) {
    const terms = [
      item.title,
      item.location,
      item.typeLabel,
      ...(item.search.keywords || []),
      ...(item.search.themes || []),
      ...(item.search.includedTags || [])
    ].map(normalizeText);

    const trekkingWords = [
      "trekking",
      "trek",
      "camino inca",
      "inca trail",
      "salkantay",
      "inca jungle",
      "lares",
      "choquequirao",
      "humantay",
      "vinicunca",
      "palcoyo",
      "ausangate",
      "siete lagunas"
    ];

    return trekkingWords.some((word) => terms.some((term) => term.includes(word)));
  }

  function applyCatalogFilter() {
    const config = getPageConfig();

    let filtered = state.catalog.filter((item) => {
      const normalizedId = normalizeText(item.id);
      if (config.kind && item.productKind !== config.kind) return false;
      if (config.family && item.productFamily !== config.family) return false;
      if (config.families.length && !config.families.includes(normalizeText(item.productFamily))) return false;
      if (config.ids.length && !config.ids.includes(normalizedId)) return false;
      if (config.excludeIds.length && config.excludeIds.includes(normalizedId)) return false;
      if (config.days !== null && item.days !== config.days) return false;
      if (config.nights !== null && item.nights !== config.nights) return false;
      if (config.minDays !== null && item.days < config.minDays) return false;
      if (config.maxDays !== null && item.days > config.maxDays) return false;
      if (config.minNights !== null && item.nights < config.minNights) return false;
      if (config.maxNights !== null && item.nights > config.maxNights) return false;
      if (!productMatchesDestination(item, config.destinations)) return false;
      if (!productMatchesThemes(item, config.themes)) return false;
      if (!productMatchesKeywords(item, config.keywords)) return false;
      if (productMatchesExcludedKeywords(item, config.excludeKeywords)) return false;
      if (config.mode === "trekkings" && !isTrekkingCandidate(item)) return false;
      if (config.mode === "trekkings" && config.trekkingCategory) {
        const categoryTerms = config.trekkingCategory.keywords || [];
        if (!productMatchesKeywords(item, categoryTerms)) return false;
      }
      return true;
    });

    filtered = filtered.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.productKind !== b.productKind) return a.productKind === "tour" ? -1 : 1;
      if (a.days !== b.days) return a.days - b.days;
      return a.title.localeCompare(b.title, "es");
    });

    if (config.limit > 0) filtered = filtered.slice(0, config.limit);

    state.filtered = filtered;
  }

  function renderStats() {
    const count = qs("#catalogLandingCount");
    if (!count) return;

    const total = state.filtered.length;
    const category = getTrekkingCategoryConfig();
    const suffix = category ? ` ${category.label}` : "";
    count.textContent = `${total} ${total === 1 ? t("catalog.experienceFound", "experiencia encontrada") : t("catalog.experiencesFound", "experiencias encontradas")}${suffix}`;
  }

  function renderCards() {
    const grid = qs("#catalogLandingGrid");
    const empty = qs("#catalogLandingEmpty");

    if (!grid) return;

    if (!state.filtered.length) {
      grid.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    grid.innerHTML = state.filtered.map((item) => {
      const isDraft = String(item.status || "").toLowerCase() === "draft";
      const priceLabel = isDraft
        ? t("cards.comingSoon", "Próximamente")
        : item.price
          ? `${t("cards.from", "Desde")} ${formatMoney(item.price, item.currency)}`
          : item.productKind === "package"
            ? t("cards.flexibleQuote", "Cotización flexible")
            : t("cards.checkPrice", "Consultar precio");

      const cardUrl = isDraft
        ? `https://wa.me/51900608980?text=${encodeURIComponent(`Hola My Cusco Trip, quiero información sobre ${item.title}.`)}`
        : item.url;
      const buttonLabel = isDraft ? t("cards.askAvailability", "Consultar disponibilidad") : t("cards.viewExperience", "Ver experiencia");
      const chips = buildChips(item);

      return `
        <article class="catalog-card">
          <a class="catalog-card__image" href="${escapeHtml(cardUrl)}" aria-label="${escapeHtml(buttonLabel)} ${escapeHtml(item.title)}">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <span class="catalog-card__badge">${escapeHtml(item.badge)}</span>
          </a>

          <div class="catalog-card__body">
            <p class="catalog-card__meta">${escapeHtml(translateVisibleLabel(item.typeLabel))} · ${escapeHtml(item.location)}</p>
            <h2>${escapeHtml(item.title)}</h2>
            <p class="catalog-card__description">${escapeHtml(item.shortDescription)}</p>

            <div class="catalog-card__chips">
              ${chips.map((chip) => `<span>${escapeHtml(chip)}</span>`).join("")}
            </div>

            <div class="catalog-card__footer">
              <strong>${escapeHtml(priceLabel)}</strong>
              <a class="btn catalog-card__button" href="${escapeHtml(cardUrl)}"${isDraft ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(buttonLabel)}</a>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  function buildChips(item) {
    const chips = [];

    if (item.productFamily === "machu-picchu-tour") chips.push("Machu Picchu");
    if (item.productFamily === "cusco-tour") chips.push(t("chips.cuscoTour", "Tour en Cusco"));
    if (item.productFamily === "peru-tour") chips.push(t("chips.peruExperience", "Experiencia Perú"));
    if (item.productFamily === "cusco-package") chips.push(t("chips.cuscoPackage", "Paquete Cusco"));
    if (item.productFamily === "peru-package") chips.push(t("chips.multidestination", "Multidestino"));

    const themes = Array.isArray(item.search.themes) ? item.search.themes : [];
    const normalizedThemes = themes.map((theme) => normalizeText(theme));
    if (normalizedThemes.some((theme) => ["aventura", "adventure"].includes(theme))) chips.push(t("chips.adventure", "Adventure"));
    if (normalizedThemes.some((theme) => ["naturaleza", "nature"].includes(theme))) chips.push(t("chips.nature", "Nature"));
    if (normalizedThemes.some((theme) => ["cultural", "culture"].includes(theme))) chips.push(t("chips.cultural", "Cultural"));

    const tags = Array.isArray(item.search.includedTags) ? item.search.includedTags : [];
    if (tags.some((tag) => /tren|train/i.test(String(tag)))) chips.push(t("chips.withTrain", "Train included"));
    if (item.productKind === "package") chips.push(t("chips.configurableHotel", "Hotel configurable"));

    return Array.from(new Set(chips)).slice(0, 4);
  }

  function renderIntroLinks() {
    const allExperiencesLink = qs("#catalogLandingAllExperiencesLink");
    if (!allExperiencesLink) return;

    const config = getPageConfig();
    const params = new URLSearchParams();

    if (config.kind) params.set("tipo", config.kind === "package" ? "paquetes" : "tours");
    if (config.family === "machu-picchu-tour") params.set("destino", "machu-picchu");
    if (config.family === "cusco-tour") params.set("destino", "cusco");
    if (config.family === "cusco-package") params.set("destino", "cusco");
    if (config.family === "peru-package") params.set("destino", "peru");
    if (config.mode === "trekkings") params.set("q", config.trekkingCategory?.label || "trekking");

    allExperiencesLink.href = `./all-experiences.html${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function applyTrekkingCategoryCopy() {
    const config = getPageConfig();
    if (config.mode !== "trekkings" || !config.trekkingCategory) return;

    const category = config.trekkingCategory;
    const heroTitle = document.querySelector(".catalog-hero h1");
    const heroText = document.querySelector(".catalog-hero p");
    const topTitle = document.querySelector(".catalog-landing__top h2");
    const note = document.querySelector(".catalog-landing__note");
    const eyebrow = document.querySelector(".catalog-eyebrow");

    document.title = `${category.label} | My Cusco Trip`;
    if (eyebrow) eyebrow.textContent = "Trekkings";
    if (heroTitle) heroTitle.textContent = category.label;
    if (heroText) heroText.textContent = category.note;
    if (topTitle) topTitle.textContent = `${t("catalog.experiencesOf", "Experiencias de")} ${category.label}`;
    if (note) note.remove();
  }

  async function init() {
    const grid = qs("#catalogLandingGrid");
    if (!grid) return;

    await waitForI18nReady();

    grid.innerHTML = `
      <div class="catalog-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>${escapeHtml(t("catalog.loadingExperiences", "Cargando experiencias..."))}</span>
      </div>
    `;

    applyTrekkingCategoryCopy();

    await buildCatalog();
    applyCatalogFilter();
    renderStats();
    renderCards();
    renderIntroLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
