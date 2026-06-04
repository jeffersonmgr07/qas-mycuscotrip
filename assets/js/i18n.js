(function () {
  const SUPPORTED_LOCALES = ["es", "en", "pt", "fr", "de", "it", "zh", "ja"];
  const DEFAULT_LOCALE = "es";
  const STORAGE_KEY = "site_lang";
  let activeDictionary = {};
  let activeStaticPhrases = {};
  let activeLocale = DEFAULT_LOCALE;
  let observerStarted = false;

  const TEXT_TRANSLATION_ATTRS = ["placeholder", "aria-label", "title", "alt"];

  const DYNAMIC_PATTERN_LABELS = {
    en: { adults: "Adults", children: "Children", day: "Day", days: "days", nights: "nights", durationDetected: "Detected duration", total: "Total", exchange: "Reference exchange rate", passenger: "traveler(s)", room: "room(s)", selected: "selected", from: "from", to: "to" },
    pt: { adults: "Adultos", children: "Crianças", day: "Dia", days: "dias", nights: "noites", durationDetected: "Duração detectada", total: "Total", exchange: "Tipo de câmbio referencial", passenger: "passageiro(s)", room: "quarto(s)", selected: "selecionado", from: "de", to: "a" },
    fr: { adults: "Adultes", children: "Enfants", day: "Jour", days: "jours", nights: "nuits", durationDetected: "Durée détectée", total: "Total", exchange: "Taux de change indicatif", passenger: "voyageur(s)", room: "chambre(s)", selected: "sélectionné", from: "de", to: "à" },
    de: { adults: "Erwachsene", children: "Kinder", day: "Tag", days: "Tage", nights: "Nächte", durationDetected: "Erkannte Dauer", total: "Gesamt", exchange: "Referenzwechselkurs", passenger: "Reisende(r)", room: "Zimmer", selected: "ausgewählt", from: "von", to: "bis" },
    it: { adults: "Adulti", children: "Bambini", day: "Giorno", days: "giorni", nights: "notti", durationDetected: "Durata rilevata", total: "Totale", exchange: "Tasso di cambio indicativo", passenger: "viaggiatore/i", room: "camera/e", selected: "selezionato", from: "da", to: "a" },
    ja: { adults: "大人", children: "子ども", day: "日目", days: "日", nights: "泊", durationDetected: "検出された期間", total: "合計", exchange: "参考為替レート", passenger: "名", room: "室", selected: "選択済み", from: "から", to: "まで" },
    zh: { adults: "成人", children: "儿童", day: "第", days: "天", nights: "晚", durationDetected: "检测到的行程时长", total: "总计", exchange: "参考汇率", passenger: "位游客", room: "间房", selected: "已选", from: "从", to: "至" }
  };

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
    const [baseTranslations, localeTranslations, staticTranslations] = await Promise.all([
      fetchJsonIfExists(getAssetPath("assets/data/ui-translations.json")),
      lang === DEFAULT_LOCALE ? Promise.resolve({}) : fetchJsonIfExists(getAssetPath(`assets/data/i18n/${lang}/ui-translations.json`)),
      fetchJsonIfExists(getAssetPath("assets/data/static-text-translations.json"))
    ]);

    const dictionary = deepMerge(
      deepMerge((baseTranslations || {})[DEFAULT_LOCALE] || {}, (baseTranslations || {})[lang] || {}),
      localeTranslations || {}
    );

    activeStaticPhrases = ((staticTranslations || {})[lang] && (staticTranslations || {})[lang].phrases) || {};
    return { locale: lang, dictionary, staticPhrases: activeStaticPhrases };
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

  function normalizePhrase(value) {
    return String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function restoreOuterWhitespace(original, translated) {
    const source = String(original ?? "");
    const leading = source.match(/^\s*/)?.[0] || "";
    const trailing = source.match(/\s*$/)?.[0] || "";
    return `${leading}${translated}${trailing}`;
  }

  function translateDynamicPattern(clean) {
    if (activeLocale === DEFAULT_LOCALE || !clean) return "";
    const labels = DYNAMIC_PATTERN_LABELS[activeLocale] || DYNAMIC_PATTERN_LABELS.en;
    let match;
    if ((match = clean.match(/^Adultos\s*x\s*(\d+)$/i))) return `${labels.adults} x${match[1]}`;
    if ((match = clean.match(/^Niños\s*x\s*(\d+)$/i))) return `${labels.children} x${match[1]}`;
    if ((match = clean.match(/^Día\s+(\d+)$/i))) {
      if (activeLocale === "ja") return `${match[1]}${labels.day}`;
      if (activeLocale === "zh") return `${labels.day}${match[1]}天`;
      return `${labels.day} ${match[1]}`;
    }
    if ((match = clean.match(/^Duración detectada:\s*(\d+)\s*días\s*\/\s*(\d+)\s*noches\.?$/i))) {
      if (activeLocale === "ja") return `${labels.durationDetected}: ${match[1]}${labels.days} / ${match[2]}${labels.nights}.`;
      if (activeLocale === "zh") return `${labels.durationDetected}：${match[1]}${labels.days} / ${match[2]}${labels.nights}。`;
      return `${labels.durationDetected}: ${match[1]} ${labels.days} / ${match[2]} ${labels.nights}.`;
    }
    if ((match = clean.match(/^Tipo de cambio referencial:\s*1 USD = S\/\s*([0-9.,]+)\.?$/i))) {
      if (activeLocale === "ja") return `${labels.exchange}: 1 USD = S/ ${match[1]}.`;
      if (activeLocale === "zh") return `${labels.exchange}：1 USD = S/ ${match[1]}。`;
      return `${labels.exchange}: 1 USD = S/ ${match[1]}.`;
    }
    if ((match = clean.match(/^Cotización referencial generada\.\s*Total:\s*(.+)\.?$/i))) {
      if (activeLocale === "ja") return `参考見積もりを作成しました。${labels.total}: ${match[1]}.`;
      if (activeLocale === "zh") return `已生成参考报价。${labels.total}：${match[1]}。`;
      return `Reference quote generated. ${labels.total}: ${match[1]}.`;
    }
    if ((match = clean.match(/^(\d+)\s*habitación\(es\)\s*\|\s*Total \+\s*(.+)$/i))) {
      return `${match[1]} ${labels.room} | ${labels.total} + ${match[2]}`;
    }
    if ((match = clean.match(/^Selecciona el hotel y luego una combinación de habitación compatible para\s*(\d+)\s*pasajero\(s\)\.$/i))) {
      const n = match[1];
      const map = {
        en: `Select the hotel and then a compatible room combination for ${n} traveler(s).`,
        pt: `Selecione o hotel e depois uma combinação de quarto compatível para ${n} passageiro(s).`,
        fr: `Sélectionnez l’hôtel puis une combinaison de chambres compatible pour ${n} voyageur(s).`,
        de: `Wählen Sie das Hotel und anschließend eine passende Zimmerkombination für ${n} Reisende(n).`,
        it: `Seleziona l’hotel e poi una combinazione di camere compatibile per ${n} viaggiatore/i.`,
        ja: `ホテルを選択し、${n}名に対応する客室組み合わせを選んでください。`,
        zh: `请选择酒店，然后为 ${n} 位游客选择合适的房型组合。`
      };
      return map[activeLocale] || map.en;
    }
    return "";
  }

  function translateTextValue(value) {
    if (activeLocale === DEFAULT_LOCALE) return value;
    const clean = normalizePhrase(value);
    if (!clean) return value;
    const direct = activeStaticPhrases[clean];
    if (direct) return restoreOuterWhitespace(value, direct);
    const patterned = translateDynamicPattern(clean);
    if (patterned) return restoreOuterWhitespace(value, patterned);
    return value;
  }

  function shouldSkipTextNode(node) {
    const parent = node?.parentElement;
    if (!parent) return true;
    if (parent.closest("script, style, noscript, code, pre, textarea, [data-no-i18n], [translate='no']")) return true;
    const clean = normalizePhrase(node.nodeValue);
    if (!clean || clean.length < 2) return true;
    return false;
  }

  function applyStaticPhraseTranslations(root = document) {
    if (activeLocale === DEFAULT_LOCALE || !root) return;
    const walkerRoot = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE ? root : document;
    const walker = document.createTreeWalker(walkerRoot, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return shouldSkipTextNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const translated = translateTextValue(node.nodeValue);
      if (translated !== node.nodeValue) node.nodeValue = translated;
    });

    walkerRoot.querySelectorAll?.("input, textarea, img, button, a, [aria-label], [title]").forEach((node) => {
      TEXT_TRANSLATION_ATTRS.forEach((attr) => {
        if (!node.hasAttribute?.(attr)) return;
        const current = node.getAttribute(attr);
        const translated = translateTextValue(current);
        if (translated !== current) node.setAttribute(attr, translated);
      });
      if (node.tagName === "INPUT" && /^(button|submit|reset)$/i.test(node.getAttribute("type") || "") && node.hasAttribute("value")) {
        const current = node.getAttribute("value");
        const translated = translateTextValue(current);
        if (translated !== current) node.setAttribute("value", translated);
      }
    });
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

    applyStaticPhraseTranslations(root);
  }

  function startObserver() {
    if (observerStarted || !document.documentElement) return;
    observerStarted = true;
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData" && mutation.target && mutation.target.nodeType === 3 && !shouldSkipTextNode(mutation.target)) {
          const translated = translateTextValue(mutation.target.nodeValue);
          if (translated !== mutation.target.nodeValue) mutation.target.nodeValue = translated;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) applyTranslations(activeDictionary, node);
          if (node.nodeType === 3 && !shouldSkipTextNode(node)) {
            const translated = translateTextValue(node.nodeValue);
            if (translated !== node.nodeValue) node.nodeValue = translated;
          }
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
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
      [80, 250, 600, 1200, 2200, 3600].forEach((delay) => {
        setTimeout(() => applyTranslations(activeDictionary), delay);
      });
      window.addEventListener("load", () => applyTranslations(activeDictionary), { once: true });
      window.dispatchEvent(new CustomEvent("mct:i18n-ready", { detail: result }));
      return result;
    } catch (error) {
      console.warn("No se pudo inicializar i18n:", error);
      return { locale: lang, dictionary: {}, staticPhrases: {} };
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
    translateText: translateTextValue,
    t,
    get dictionary() { return activeDictionary; },
    get locale() { return activeLocale; },
    get staticPhrases() { return activeStaticPhrases; },
    init: initI18n
  };

  document.addEventListener("DOMContentLoaded", () => {
    initI18n();
  });
})();
