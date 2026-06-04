"use strict";

/**
 * My Cusco Trip - Catalog Normalizer
 * Unifica tours, paquetes y cards dinámicas en una estructura común.
 * No genera itinerarios. No calcula precios. Solo normaliza productos.
 */

function safeString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function firstValid(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? null;
}

function normalizeStatus(value) {
  return safeString(value, "draft").toLowerCase();
}

function isPublicProduct(item) {
  return normalizeStatus(item?.status) === "published";
}

function normalizeImage(item) {
  if (!item) return "";

  if (typeof item.image === "string") return item.image;
  if (typeof item.cover === "string") return item.cover;

  if (item.images?.cover) return item.images.cover;
  if (Array.isArray(item.images?.gallery) && item.images.gallery.length) {
    return item.images.gallery[0];
  }

  return "";
}

function normalizePrice(item) {
  if (!item) {
    return {
      amount: 0,
      currency: "USD",
      mode: "unknown"
    };
  }

  const basePricingAmount = firstValid(
    item.basePricing?.adult,
    item.basePricing?.publishedAdultUSD,
    item.pricing?.publishedAdultUSD,
    item.pricing?.amount,
    item.price
  );

  return {
    amount: safeNumber(basePricingAmount, 0),
    currency: safeString(
      firstValid(
        item.basePricing?.currency,
        item.pricing?.displayCurrency,
        item.currency,
        item.defaultCurrency
      ),
      "USD"
    ),
    mode: item.priceMode || "static_or_reference"
  };
}

function normalizeDurationLabel(item) {
  return safeString(
    firstValid(
      item.typeLabel,
      item.duration?.label,
      item.durationLabel,
      item.days && item.nights !== undefined ? `${item.days} días / ${item.nights} noches` : ""
    ),
    ""
  );
}

function normalizeSearch(item, fallback = {}) {
  const search = item?.search && typeof item.search === "object" ? item.search : fallback;

  return {
    kind: search.kind || item?.productKind || "",
    destinations: Array.isArray(search.destinations) ? search.destinations : [],
    durationKeys: Array.isArray(search.durationKeys) ? search.durationKeys : [],
    includedTourCodes: Array.isArray(search.includedTourCodes) ? search.includedTourCodes : [],
    includedTags: Array.isArray(search.includedTags) ? search.includedTags : [],
    themes: Array.isArray(search.themes) ? search.themes : [],
    keywords: Array.isArray(search.keywords) ? search.keywords : []
  };
}

function normalizeTour(item, source = "unknown") {
  if (!item || typeof item !== "object") return null;

  const productKind = safeString(item.productKind, "tour");
  const productFamily = safeString(
    item.productFamily,
    source === "toursMachuPicchu"
      ? "machu-picchu-tour"
      : source === "toursPeru"
        ? "peru-tour"
        : source === "trekkingsCusco"
          ? "cusco-trekking"
          : "cusco-tour"
  );

  const price = normalizePrice(item);

  return {
    id: safeString(item.id, item.internalCode || item.slug || ""),
    internalCode: safeString(item.internalCode, ""),
    slug: safeString(item.slug, ""),
    title: safeString(item.title, "Experiencia sin título"),
    category: safeString(item.category, ""),
    productKind,
    productFamily,
    days: safeNumber(item.days, 0),
    nights: safeNumber(item.nights, 0),
    typeLabel: normalizeDurationLabel(item),
    duration: item.duration || null,
    location: safeString(item.location || item.destination, ""),
    image: normalizeImage(item),
    badge: safeString(item.badge, ""),
    featured: safeBoolean(item.featured, false),
    status: safeString(item.status, "draft"),
    priceMode: "static_from_product",
    price,
    currency: price.currency,
    shortDescription: safeString(item.shortDescription, item.description || ""),
    description: safeString(item.description, ""),
    search: normalizeSearch(item),
    source,
    raw: item
  };
}

function normalizePackageCard(card, config = {}, source = "unknown") {
  if (!card || typeof card !== "object") return null;

  const productKind = safeString(card.productKind, "package");
  const productFamily = safeString(
    card.productFamily,
    config.productFamily || (source === "packagesPeru" ? "peru-package" : "cusco-package")
  );

  const days = safeNumber(card.days, 0);
  const nights = safeNumber(card.nights, Math.max(days - 1, 0));

  const baseAmount = firstValid(
    card.basePricing?.adult,
    card.basePricing?.publishedAdultUSD,
    card.pricing?.publishedAdultUSD,
    card.pricing?.amount,
    card.price?.amount,
    card.price
  );

  const price = {
    amount: safeNumber(baseAmount, 0),
    currency: safeString(
      firstValid(
        card.basePricing?.currency,
        card.pricing?.displayCurrency,
        card.currency,
        config.defaultCurrency,
        config.baseCurrency
      ),
      "USD"
    ),
    mode: safeString(card.priceMode, baseAmount ? "static_base_plus_configurable_services" : "dynamic_from_selected_itinerary")
  };

  const durationLabel = safeString(card.typeLabel, `${days} días / ${nights} noches`);
  const guideLanguages = Array.isArray(card.duration?.guideLanguages) && card.duration.guideLanguages.length
    ? card.duration.guideLanguages
    : Array.isArray(config.defaultGuideLanguages) && config.defaultGuideLanguages.length
      ? config.defaultGuideLanguages
      : ["es", "en"];

  return {
    id: safeString(card.id, card.slug || ""),
    internalCode: safeString(card.internalCode, ""),
    slug: safeString(card.slug, ""),
    title: safeString(card.title, "Paquete sin título"),
    category: safeString(card.category, config.defaultDestination || ""),
    productKind,
    productFamily,
    days,
    nights,
    typeLabel: durationLabel,
    duration: {
      label: durationLabel,
      guideLanguages
    },
    location: safeString(card.location, ""),
    image: normalizeImage(card),
    badge: safeString(card.badge, ""),
    featured: safeBoolean(card.featured, false),
    status: safeString(card.status, config.status || "draft"),
    priceMode: price.mode,
    price,
    currency: price.currency,
    shortDescription: safeString(card.shortDescription, ""),
    description: safeString(card.description, card.shortDescription || ""),
    search: normalizeSearch(card, {
      kind: "package",
      destinations: [config.defaultDestination].filter(Boolean),
      durationKeys: [`${days}d${nights}n`],
      includedTourCodes: [],
      includedTags: [],
      themes: [],
      keywords: []
    }),
    packageConfig: config,
    source,
    raw: card
  };
}

function extractToursFromSource(sourceKey, sourceData) {
  if (!sourceData) return [];

  if (Array.isArray(sourceData)) return sourceData;

  if (Array.isArray(sourceData.products)) return sourceData.products;
  if (Array.isArray(sourceData.tours)) return sourceData.tours;
  if (Array.isArray(sourceData.items)) return sourceData.items;

  return [];
}

function extractPackageCardsFromConfig(config) {
  if (!config || typeof config !== "object") return [];

  if (Array.isArray(config.packageCards)) return config.packageCards;
  if (Array.isArray(config.products)) return config.products;
  if (Array.isArray(config.cards)) return config.cards;

  return [];
}

function normalizeCatalog(allData = {}) {
  const data = allData.data && typeof allData.data === "object" ? allData.data : allData;

  const normalized = [];

  const tourSources = [
    "toursCusco",
    "toursMachuPicchu",
    "toursPeru",
    "trekkingsCusco"
  ];

  tourSources.forEach((sourceKey) => {
    extractToursFromSource(sourceKey, data[sourceKey]).forEach((item) => {
      const normalizedTour = normalizeTour(item, sourceKey);
      if (normalizedTour?.slug) normalized.push(normalizedTour);
    });
  });

  const packageSources = [
    "packagesCusco",
    "packagesPeru"
  ];

  packageSources.forEach((sourceKey) => {
    const config = data[sourceKey];
    extractPackageCardsFromConfig(config).forEach((card) => {
      const normalizedPackage = normalizePackageCard(card, config, sourceKey);
      if (normalizedPackage?.slug) normalized.push(normalizedPackage);
    });
  });

  return normalized;
}

function getProductBySlug(slug, catalog = []) {
  const normalizedSlug = safeString(slug, "").toLowerCase();

  if (!normalizedSlug || !Array.isArray(catalog)) return null;

  return catalog.find((product) => {
    return safeString(product.slug, "").toLowerCase() === normalizedSlug;
  }) || null;
}

function groupCatalogByKind(catalog = []) {
  return catalog.reduce((groups, product) => {
    const key = product.productKind || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(product);
    return groups;
  }, {});
}

function groupCatalogByFamily(catalog = []) {
  return catalog.reduce((groups, product) => {
    const key = product.productFamily || "unknown";
    if (!groups[key]) groups[key] = [];
    groups[key].push(product);
    return groups;
  }, {});
}

window.MyCuscoTripCatalogNormalizer = {
  normalizeStatus,
  isPublicProduct,
  normalizeTour,
  normalizePackageCard,
  normalizeCatalog,
  getProductBySlug,
  groupCatalogByKind,
  groupCatalogByFamily
};
