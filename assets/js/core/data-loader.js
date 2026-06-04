"use strict";

/**
 * My Cusco Trip - Data Loader
 * Carga centralizada de archivos JSON del sistema con soporte multidioma.
 */

const MCT_LOCALIZABLE_DATA_KEYS = new Set([
  "toursCusco",
  "toursMachuPicchu",
  "toursPeru",
  "trekkingsCusco",
  "packagesCusco",
  "packagesPeru",
  "destinations",
  "privatePackages",
  "hotels",
  "trains"
]);

const MCT_DATA_PATHS = {
  toursCusco: "assets/data/tours-cusco.json",
  toursMachuPicchu: "assets/data/tours-machu-picchu.json",
  toursPeru: "assets/data/tours-peru.json",
  trekkingsCusco: "assets/data/trekkings-cusco.json",
  packagesCusco: "assets/data/packages-cusco.json",
  packagesPeru: "assets/data/packages-peru.json",
  trains: "assets/data/trains.json",
  hotels: "assets/data/hotels.json",
  currencyConfig: "assets/data/currency-config.json",
  paymentConfig: "assets/data/payment-config.json",
  destinations: "assets/data/destinations.json",
  privatePackages: "assets/data/private-packages.json"
};

function getCurrentLocale() {
  return window.MyCuscoTripI18n?.getLocaleFromUrl?.() || document.documentElement.lang?.slice(0, 2) || "es";
}

function getBasePath() {
  return window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
}

function resolveDataPath(path) {
  if (!path || /^https?:\/\//i.test(path) || path.startsWith("/")) return path;
  return `${getBasePath()}${String(path).replace(/^\.?\//, "")}`;
}

function localizedDataPath(key, path) {
  const locale = getCurrentLocale();
  if (locale && locale !== "es" && MCT_LOCALIZABLE_DATA_KEYS.has(key)) {
    const filename = String(path).split("/").pop();
    return `assets/data/i18n/${locale}/${filename}`;
  }
  return path;
}

async function loadJson(path) {
  if (!path || typeof path !== "string") {
    console.warn("[MyCuscoTrip DataLoader] Ruta inválida:", path);
    return null;
  }

  try {
    const response = await fetch(resolveDataPath(path), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn(`[MyCuscoTrip DataLoader] No se pudo cargar: ${path}`, error);
    return null;
  }
}

function getDataSources() {
  const locale = getCurrentLocale();
  const sources = {};
  Object.entries(MCT_DATA_PATHS).forEach(([key, path]) => {
    sources[key] = localizedDataPath(key, path);
  });
  return sources;
}

async function loadAllData() {
  const sources = getDataSources();
  const entries = Object.entries(sources);
  const results = await Promise.allSettled(entries.map(async ([key, path]) => [key, await loadJson(path)]));
  const loadedData = {};
  const errors = [];
  results.forEach((result, index) => {
    const [key, path] = entries[index];
    if (result.status === "fulfilled") {
      loadedData[key] = result.value[1];
      if (!result.value[1]) errors.push({ key, path, message: "Archivo no cargado o JSON vacío." });
    } else {
      loadedData[key] = null;
      errors.push({ key, path, message: result.reason?.message || "Error desconocido." });
    }
  });
  return { data: loadedData, sources, errors, hasErrors: errors.length > 0 };
}

window.MyCuscoTripDataLoader = { loadJson, loadAllData, getDataSources, DATA_PATHS: MCT_DATA_PATHS, resolveDataPath, localizedDataPath };
