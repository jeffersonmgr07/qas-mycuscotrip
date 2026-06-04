"use strict";

/**
 * My Cusco Trip - Destination Service
 * Fuente única para resolver destinos, alias, etiquetas y destinos hoteleros.
 * Usa destinations.json como verdad operativa.
 */

(function () {
  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getDestinationsRoot(allData) {
    const data = getDataPayload(allData || {});
    return data?.destinations || data;
  }

  function getDestinationsMap(allData) {
    const root = getDestinationsRoot(allData);
    return root?.destinations || {};
  }

  function getGlobalRules(allData) {
    const root = getDestinationsRoot(allData);
    return root?.globalRules || {};
  }

  function normalizeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/_/g, "-");
  }

  function resolveDestinationKey(key, allData) {
    const normalized = normalizeKey(key);
    const destinations = getDestinationsMap(allData);

    if (!normalized) return "";

    if (destinations[normalized]) return normalized;

    for (const [slug, destination] of Object.entries(destinations)) {
      const aliases = Array.isArray(destination.aliases) ? destination.aliases : [];
      const searchDestinations = Array.isArray(destination.search?.destinations)
        ? destination.search.destinations
        : [];
      const searchTags = Array.isArray(destination.search?.tags)
        ? destination.search.tags
        : [];

      const values = [
        slug,
        destination.slug,
        destination.label,
        destination.commercialLabel,
        destination.shortLabel,
        ...aliases,
        ...searchDestinations,
        ...searchTags
      ].map(normalizeKey);

      if (values.includes(normalized)) return slug;
    }

    return normalized;
  }

  function resolveHotelDestination(key, allData) {
    const rules = getGlobalRules(allData);
    const hotelMap = rules.hotelDestinationResolution || {};
    const resolvedKey = resolveDestinationKey(key, allData);

    if (hotelMap[resolvedKey]) {
      return resolveDestinationKey(hotelMap[resolvedKey], allData);
    }

    const destinations = getDestinationsMap(allData);
    const destination = destinations[resolvedKey];

    if (destination?.hotelDestinationKey) {
      return resolveDestinationKey(destination.hotelDestinationKey, allData);
    }

    if (destination?.isAccommodationDestination) {
      return resolvedKey;
    }

    return resolvedKey;
  }

  function getDestination(key, allData) {
    const destinations = getDestinationsMap(allData);
    const resolvedKey = resolveDestinationKey(key, allData);
    return destinations[resolvedKey] || null;
  }

  function getDestinationLabel(key, allData) {
    const destination = getDestination(key, allData);

    if (!destination) return String(key || "");

    const priority = getGlobalRules(allData).customerFacingNamePriority || [
      "label",
      "commercialLabel",
      "shortLabel"
    ];

    for (const field of priority) {
      if (destination[field]) return destination[field];
    }

    return destination.label || destination.slug || String(key || "");
  }

  function getPackageDestinationKeys(key, allData) {
    const rules = getGlobalRules(allData);
    const packageMap = rules.packageDestinationResolution || {};
    const resolvedKey = resolveDestinationKey(key, allData);

    if (Array.isArray(packageMap[resolvedKey])) {
      return packageMap[resolvedKey].map((item) => resolveDestinationKey(item, allData));
    }

    return [resolvedKey];
  }

  function isAccommodationDestination(key, allData) {
    const destination = getDestination(key, allData);
    return Boolean(destination?.isAccommodationDestination);
  }

  function getDestinationFilters(allData) {
    const destinations = getDestinationsMap(allData);

    return Object.values(destinations)
      .filter((destination) => destination?.ui?.showInFilters)
      .map((destination) => ({
        value: destination.slug,
        label: destination.ui?.filterLabel || destination.shortLabel || destination.label,
        group: destination.country || "peru",
        featured: Boolean(destination.featured),
        productFamilies: destination.productFamilies || []
      }))
      .sort((a, b) => {
        if (a.featured !== b.featured) return Number(b.featured) - Number(a.featured);
        return a.label.localeCompare(b.label);
      });
  }

  function getRelatedDestinations(key, allData) {
    const destination = getDestination(key, allData);
    return Array.isArray(destination?.relatedDestinations)
      ? destination.relatedDestinations.map((item) => resolveDestinationKey(item, allData))
      : [];
  }

  window.MyCuscoTripDestinationService = {
    normalizeKey,
    resolveDestinationKey,
    resolveHotelDestination,
    getDestination,
    getDestinationLabel,
    getPackageDestinationKeys,
    getDestinationFilters,
    isAccommodationDestination,
    getRelatedDestinations
  };
})();
