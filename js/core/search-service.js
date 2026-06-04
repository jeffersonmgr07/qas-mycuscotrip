"use strict";

/**
 * My Cusco Trip - Search Service
 * Filtra y ordena el catálogo normalizado.
 * No busca en includes, excludes, description larga, faq ni importantInfo.
 */

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildSearchText(product) {
  const search = product?.search || {};

  return [
    product?.title,
    product?.location,
    product?.typeLabel,
    ...toArray(search.destinations),
    ...toArray(search.durationKeys),
    ...toArray(search.includedTags),
    ...toArray(search.keywords),
    ...toArray(search.themes)
  ]
    .filter(Boolean)
    .map(normalizeText)
    .join(" ");
}

function matchesTextSearch(product, query) {
  const cleanQuery = normalizeText(query);

  if (!cleanQuery) return true;

  const searchText = buildSearchText(product);
  const words = cleanQuery.split(/\s+/).filter(Boolean);

  return words.every((word) => searchText.includes(word));
}

function matchesDestination(product, destination) {
  const cleanDestination = normalizeText(destination);

  if (!cleanDestination || cleanDestination === "todos" || cleanDestination === "all") {
    return true;
  }

  const search = product?.search || {};
  const destinations = toArray(search.destinations).map(normalizeText);
  const location = normalizeText(product?.location);
  const category = normalizeText(product?.category);
  const family = normalizeText(product?.productFamily);

  return (
    destinations.includes(cleanDestination) ||
    location.includes(cleanDestination) ||
    category.includes(cleanDestination) ||
    family.includes(cleanDestination)
  );
}

function matchesDuration(product, days, nights) {
  const requestedDays = Number(days);
  const requestedNights = Number(nights);

  if (!Number.isFinite(requestedDays) || requestedDays <= 0) {
    return true;
  }

  const productDays = Number(product?.days || 0);
  const productNights = Number(product?.nights || 0);

  if (Number.isFinite(requestedNights) && requestedNights >= 0) {
    return productDays === requestedDays && productNights === requestedNights;
  }

  return productDays === requestedDays;
}

function matchesDurationKey(product, durationKey) {
  const cleanKey = normalizeText(durationKey);

  if (!cleanKey || cleanKey === "todos" || cleanKey === "all") {
    return true;
  }

  const search = product?.search || {};
  const durationKeys = toArray(search.durationKeys).map(normalizeText);
  const typeLabel = normalizeText(product?.typeLabel);

  return durationKeys.includes(cleanKey) || typeLabel.includes(cleanKey);
}

function matchesProductKind(product, kind) {
  const cleanKind = normalizeText(kind);

  if (!cleanKind || cleanKind === "todos" || cleanKind === "all") {
    return true;
  }

  const productKind = normalizeText(product?.productKind);

  if (cleanKind === "tours") return productKind === "tour";
  if (cleanKind === "paquetes") return productKind === "package";
  if (cleanKind === "packages") return productKind === "package";

  return productKind === cleanKind;
}

function matchesProductFamily(product, family) {
  const cleanFamily = normalizeText(family);

  if (!cleanFamily || cleanFamily === "todos" || cleanFamily === "all") {
    return true;
  }

  return normalizeText(product?.productFamily) === cleanFamily;
}

function matchesStatus(product, status = "published") {
  const cleanStatus = normalizeText(status);

  if (!cleanStatus || cleanStatus === "todos" || cleanStatus === "all") {
    return true;
  }

  return normalizeText(product?.status) === cleanStatus;
}

function getProductPrice(product) {
  const amount = Number(product?.price?.amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function sortProducts(products, sortMode = "featured") {
  const items = Array.isArray(products) ? [...products] : [];
  const mode = normalizeText(sortMode);

  if (mode === "price-asc" || mode === "precio-menor" || mode === "menor-precio") {
    return items.sort((a, b) => getProductPrice(a) - getProductPrice(b));
  }

  if (mode === "price-desc" || mode === "precio-mayor" || mode === "mayor-precio") {
    return items.sort((a, b) => getProductPrice(b) - getProductPrice(a));
  }

  if (mode === "az" || mode === "name-asc" || mode === "nombre-az") {
    return items.sort((a, b) => {
      return normalizeText(a?.title).localeCompare(normalizeText(b?.title));
    });
  }

  if (mode === "za" || mode === "name-desc" || mode === "nombre-za") {
    return items.sort((a, b) => {
      return normalizeText(b?.title).localeCompare(normalizeText(a?.title));
    });
  }

  return items.sort((a, b) => {
    const featuredA = a?.featured ? 1 : 0;
    const featuredB = b?.featured ? 1 : 0;

    if (featuredA !== featuredB) return featuredB - featuredA;

    return normalizeText(a?.title).localeCompare(normalizeText(b?.title));
  });
}

function filterProducts(products = [], filters = {}) {
  const list = Array.isArray(products) ? products : [];

  const filtered = list.filter((product) => {
    return (
      matchesStatus(product, filters.status || "published") &&
      matchesTextSearch(product, filters.q || filters.query || filters.search || "") &&
      matchesDestination(product, filters.destination || filters.destino || "") &&
      matchesProductKind(product, filters.kind || filters.tipo || filters.productKind || "") &&
      matchesProductFamily(product, filters.family || filters.productFamily || "") &&
      matchesDuration(product, filters.days, filters.nights) &&
      matchesDurationKey(product, filters.durationKey || filters.duration || "")
    );
  });

  return sortProducts(filtered, filters.sort || filters.order || "featured");
}

function getAvailableDestinations(products = []) {
  const destinations = new Set();

  products.forEach((product) => {
    toArray(product?.search?.destinations).forEach((destination) => {
      if (destination) destinations.add(destination);
    });
  });

  return Array.from(destinations).sort();
}

function getAvailableDurations(products = []) {
  const durations = new Map();

  products.forEach((product) => {
    const days = Number(product?.days || 0);
    const nights = Number(product?.nights || 0);

    if (days > 0) {
      const key = `${days}d${nights}n`;
      const label = product?.typeLabel || `${days} días / ${nights} noches`;

      if (!durations.has(key)) {
        durations.set(key, {
          key,
          days,
          nights,
          label
        });
      }
    }
  });

  return Array.from(durations.values()).sort((a, b) => {
    if (a.days !== b.days) return a.days - b.days;
    return a.nights - b.nights;
  });
}

window.MyCuscoTripSearchService = {
  normalizeText,
  buildSearchText,
  filterProducts,
  sortProducts,
  matchesTextSearch,
  matchesDestination,
  matchesDuration,
  matchesDurationKey,
  matchesProductKind,
  matchesProductFamily,
  getAvailableDestinations,
  getAvailableDurations
};
