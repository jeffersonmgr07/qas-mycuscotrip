(function () {
  const SUPPORTED_LOCALES = ["es", "en", "pt", "fr", "de", "it", "zh", "ja"];
  const DEFAULT_LOCALE = "es";
  const STORAGE_KEY = "site_lang";
  let activeDictionary = {};
  let activeLocale = DEFAULT_LOCALE;
  let observerStarted = false;

  function getBasePath() {
    return window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/";
  }

  function getCurrentFolderLocale() {
    const segment = window.location.pathname.split("/").filter(Boolean)[0] || "";
    return SUPPORTED_LOCALES.includes(segment) && segment !== DEFAULT_LOCALE ? segment : "";
  }

  function normalizeLocale(locale) {
    const raw = String(locale || "").toLowerCase();
    const value = raw.startsWith("zh") ? "zh" : raw.slice(0, 2);
    return SUPPORTED_LOCALES.includes(value) ? value : DEFAULT_LOCALE;
  }

  function getLocaleFromUrl() {
    if (window.MCT_LOCALE) return normalizeLocale(window.MCT_LOCALE);

    const params = new URLSearchParams(window.location.search);
    const paramLang = params.get("lang");
    if (paramLang) return normalizeLocale(paramLang);

    const folderLocale = getCurrentFolderLocale();
    if (folderLocale) return normalizeLocale(folderLocale);

    // The root site must always load in Spanish. Do not reuse a previous
    // language saved in localStorage on /, because that makes the header
    // appear in English while the Spanish home content remains in Spanish.
    return DEFAULT_LOCALE;
  }

  function getAssetPath(path) {
    const clean = String(path || "").replace(/^\.?\//, "");
    return `${getBasePath()}${clean}`;
  }

  async function fetchJsonIfExists(path) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function deepMerge(target, source) {
    const output = { ...(target || {}) };
    Object.entries(source || {}).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  async function loadTranslations(locale) {
    const lang = normalizeLocale(locale);
    const baseTranslations = await fetchJsonIfExists(getAssetPath("assets/data/ui-translations.json")) || {};
    const localeTranslations = lang === DEFAULT_LOCALE
      ? {}
      : await fetchJsonIfExists(getAssetPath(`assets/data/i18n/${lang}/ui-translations.json`)) || {};

    return {
      locale: lang,
      dictionary: deepMerge(
        deepMerge(baseTranslations[DEFAULT_LOCALE] || {}, baseTranslations[lang] || {}),
        localeTranslations
      )
    };
  }

  function getValue(dictionary, key) {
    if (!dictionary || !key) return "";
    if (Object.prototype.hasOwnProperty.call(dictionary, key)) return dictionary[key];
    return String(key).split(".").reduce((acc, part) => acc && acc[part], dictionary) || "";
  }

  function t(key, fallback = "") {
    const value = getValue(activeDictionary, key);
    return value || fallback || key;
  }

  function applyTranslations(dictionary = activeDictionary, root = document) {
    if (!dictionary || !root) return;

    root.querySelectorAll?.("[data-i18n]").forEach((node) => {
      const key = node.dataset.i18n;
      const value = getValue(dictionary, key);
      if (value) node.textContent = value;
    });

    root.querySelectorAll?.("[data-i18n-html]").forEach((node) => {
      const key = node.dataset.i18nHtml;
      const value = getValue(dictionary, key);
      if (value) node.innerHTML = value;
    });

    root.querySelectorAll?.("[data-i18n-placeholder]").forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      const value = getValue(dictionary, key);
      if (value) node.setAttribute("placeholder", value);
    });

    root.querySelectorAll?.("[data-i18n-label]").forEach((node) => {
      const key = node.dataset.i18nLabel;
      const value = getValue(dictionary, key);
      if (value) node.setAttribute("aria-label", value);
    });

    root.querySelectorAll?.("[data-i18n-title]").forEach((node) => {
      const key = node.dataset.i18nTitle;
      const value = getValue(dictionary, key);
      if (value) node.setAttribute("title", value);
    });
  }

  function startObserver() {
    if (observerStarted || !document.documentElement) return;
    observerStarted = true;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) applyTranslations(activeDictionary, node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function getLocalizedPath(locale, path) {
    const lang = normalizeLocale(locale);
    const url = new URL(path || window.location.href, window.location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    if (SUPPORTED_LOCALES.includes(parts[0])) parts.shift();
    const cleanPath = parts.join("/") || "index.html";
    const prefix = lang === DEFAULT_LOCALE ? "/" : `/${lang}/`;
    return `${prefix}${cleanPath === "index.html" ? "" : cleanPath}${url.search}${url.hash}`;
  }

  async function initI18n(locale) {
    const lang = normalizeLocale(locale || getLocaleFromUrl());
    activeLocale = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-Hans" : lang);
    document.body?.setAttribute("data-locale", lang);

    try {
      const result = await loadTranslations(lang);
      activeDictionary = result.dictionary || {};
      startObserver();
      applyTranslations(activeDictionary);
      // Components such as header, search bar and footer are injected asynchronously on several pages.
      // Re-apply translations a few times so late-loaded components never remain in Spanish on localized pages.
      [80, 250, 600, 1200, 2200].forEach((delay) => {
        setTimeout(() => applyTranslations(activeDictionary), delay);
      });
      window.addEventListener("load", () => applyTranslations(activeDictionary), { once: true });
      window.dispatchEvent(new CustomEvent("mct:i18n-ready", { detail: result }));
      return result;
    } catch (error) {
      console.warn("No se pudo inicializar i18n:", error);
      return { locale: lang, dictionary: {} };
    }
  }

  window.MyCuscoTripI18n = {
    supportedLocales: SUPPORTED_LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    getBasePath,
    getAssetPath,
    getLocalizedPath,
    getLocaleFromUrl,
    normalizeLocale,
    loadTranslations,
    applyTranslations,
    t,
    get dictionary() { return activeDictionary; },
    get locale() { return activeLocale; },
    init: initI18n
  };

  document.addEventListener("DOMContentLoaded", () => {
    initI18n();
  });
})();
