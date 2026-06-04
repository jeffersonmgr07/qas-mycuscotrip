"use strict";

/**
 * My Cusco Trip - Package Content Service
 * Genera contenido dinámico para paquetes:
 * - Incluye base
 * - No incluye
 * - Extras disponibles
 * - Extras seleccionados
 * - Modo todo incluido
 */

(function () {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function t(key, fallback = "") {
    return window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
  }

  function dedupeTextList(items = []) {
    const seen = new Set();

    return toArray(items)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .filter((item) => {
        const key = normalizeText(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function collectTourIncludes(option = {}) {
    const includes = [];

    toArray(option.includedTours).forEach((tour) => {
      const raw = tour.raw || tour;
      includes.push(...toArray(raw.includes));
    });

    return dedupeTextList(includes);
  }

  function collectTourExcludes(option = {}) {
    const excludes = [];

    toArray(option.includedTours).forEach((tour) => {
      const raw = tour.raw || tour;
      excludes.push(...toArray(raw.excludes));
    });

    return dedupeTextList(excludes);
  }

  function collectPackageExtras(option = {}) {
    const extras = [];

    toArray(option.includedTours).forEach((tour) => {
      const raw = tour.raw || tour;

      toArray(raw.extras).forEach((extra) => {
        extras.push({
          ...extra,
          sourceTourCode: raw.internalCode || tour.internalCode || "",
          sourceTourTitle: raw.title || tour.title || ""
        });
      });

      if (Array.isArray(raw.ticketPricingByNationality)) {
        raw.ticketPricingByNationality.forEach((extra) => {
          extras.push({
            ...extra,
            sourceTourCode: raw.internalCode || tour.internalCode || "",
            sourceTourTitle: raw.title || tour.title || ""
          });
        });
      }
    });

    return dedupeExtras(extras);
  }

  function dedupeExtras(extras = []) {
    const seen = new Set();

    return toArray(extras).filter((extra) => {
      const key = normalizeText(extra.code || extra.label || extra.sourceTourCode);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function isRecommendedExtra(extra) {
    if (!extra) return false;

    if (extra.required) return true;

    const label = normalizeText(extra.label || extra.code || "");
    const type = normalizeText(extra.type || "");

    if (type === "ticket") return true;
    if (label.includes("boleto") || label.includes("bilhete") || label.includes("billet") || label.includes("ticket")) return true;
    if (label.includes("ingreso") || label.includes("entrada") || label.includes("entrance") || label.includes("entree") || label.includes("eintritt")) return true;
    if (label.includes("almuerzo") || label.includes("almoço") || label.includes("dejeuner") || label.includes("lunch") || label.includes("mittagessen")) return true;

    return false;
  }

  function getRecommendedExtras(option = {}) {
    return collectPackageExtras(option).filter(isRecommendedExtra);
  }

  function getSelectedExtras(option = {}, selectedExtraCodes = []) {
    const selectedSet = new Set(toArray(selectedExtraCodes));
    return collectPackageExtras(option).filter((extra) => selectedSet.has(extra.code));
  }

  function getAllInclusiveExtraCodes(option = {}) {
    return getRecommendedExtras(option)
      .map((extra) => extra.code)
      .filter(Boolean);
  }

  function buildBaseIncludes(option = {}, accommodationPlan = []) {
    const base = [
      t("product.transferIn", "Arrival transfer at the beginning of the package"),
      t("product.transferOut", "Departure transfer at the end of the package"),
      t("product.travelAssistance", "Travel assistance before and during the experience"),
      t("product.indicatedTours", "Tours indicated in the itinerary"),
      t("product.touristTransportProgram", "Tourist transport according to the program"),
      t("product.professionalGuideIncluded", "Professional guide in Spanish and English")
    ];

    const hasMachuPicchu = toArray(option.includedTourCodes).some((code) => /^MAPI/i.test(code));

    if (hasMachuPicchu) {
      base.push(t("product.machuExperience", "Machu Picchu experience according to the selected option"));
      base.push(t("product.touristTrainSelected", "Tourist train according to the selected service"));
      base.push(t("product.consetturBus", "Consettur bus up and down to Machu Picchu"));
      base.push(t("product.officialMachuEntry", "Official Machu Picchu entrance ticket"));
    }

    if (toArray(accommodationPlan).length) {
      base.push(t("product.accommodationByCategory", "Accommodation according to the selected category and room"));
    }

    return dedupeTextList(base);
  }

  function buildPackageIncludes(option = {}, accommodationPlan = [], selectedExtraCodes = []) {
    const baseIncludes = buildBaseIncludes(option, accommodationPlan);
    const selectedExtras = getSelectedExtras(option, selectedExtraCodes);

    const selectedExtraIncludes = selectedExtras.map((extra) => {
      return extra.label || extra.code;
    });

    return dedupeTextList([
      ...baseIncludes,
      ...selectedExtraIncludes
    ]);
  }

  function buildPackageExcludes(option = {}, selectedExtraCodes = []) {
    const selectedSet = new Set(toArray(selectedExtraCodes));
    const tourExcludes = collectTourExcludes(option);

    const dynamicExcludes = [
      t("product.domesticInternationalFlights", "Domestic or international flights"),
      t("product.personalExpenses", "Personal expenses"),
      t("product.notMentionedServices", "Services not expressly mentioned"),
      t("product.voluntaryTips", "Voluntary tips"),
      t("product.optionalUpgradesNotSelected", "Optional upgrades not selected")
    ];

    const extras = collectPackageExtras(option);

    extras.forEach((extra) => {
      if (!selectedSet.has(extra.code)) {
        dynamicExcludes.push(extra.label || extra.code);
      }
    });

    return dedupeTextList([
      ...dynamicExcludes,
      ...tourExcludes
    ]);
  }

  function buildExtrasViewModel(option = {}, selectedExtraCodes = []) {
    const selectedSet = new Set(toArray(selectedExtraCodes));

    return collectPackageExtras(option).map((extra) => ({
      code: extra.code || "",
      label: extra.label || extra.code || t("product.additionalService", "Additional service"),
      type: extra.type || "extra",
      required: Boolean(extra.required),
      optional: Boolean(extra.optional),
      recommended: isRecommendedExtra(extra),
      selected: selectedSet.has(extra.code),
      perPerson: extra.perPerson !== false,
      sourceTourCode: extra.sourceTourCode || "",
      sourceTourTitle: extra.sourceTourTitle || "",
      raw: extra
    }));
  }

  function buildPackageContent(option = {}, context = {}) {
    const accommodationPlan = context.accommodationPlan || [];
    const selectedExtraCodes = context.selectedExtraCodes || [];

    const extras = buildExtrasViewModel(option, selectedExtraCodes);

    return {
      title: option.title || "",
      baseIncludes: buildBaseIncludes(option, accommodationPlan),
      includes: buildPackageIncludes(option, accommodationPlan, selectedExtraCodes),
      excludes: buildPackageExcludes(option, selectedExtraCodes),
      extras,
      recommendedExtraCodes: getAllInclusiveExtraCodes(option),
      allInclusiveAvailable: extras.some((extra) => extra.recommended),
      selectedExtraCodes: toArray(selectedExtraCodes)
    };
  }

  function applyAllInclusive(option = {}) {
    return getAllInclusiveExtraCodes(option);
  }

  window.MyCuscoTripPackageContentService = {
    dedupeTextList,
    collectTourIncludes,
    collectTourExcludes,
    collectPackageExtras,
    getRecommendedExtras,
    getSelectedExtras,
    getAllInclusiveExtraCodes,
    buildBaseIncludes,
    buildPackageIncludes,
    buildPackageExcludes,
    buildExtrasViewModel,
    buildPackageContent,
    applyAllInclusive
  };
})();
