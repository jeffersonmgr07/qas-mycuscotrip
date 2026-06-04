"use strict";

/**
 * My Cusco Trip - Train Service
 * Servicio centralizado para trenes Machu Picchu.
 * Usa trains.json como fuente única de verdad.
 */

(function () {
  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getTrainsRoot(allData) {
    const data = getDataPayload(allData || {});
    return data?.trains || data;
  }

  function getTrainList(allData) {
    const root = getTrainsRoot(allData);
    return Array.isArray(root?.trains) ? root.trains : [];
  }

  function getTrainRules(allData) {
    const root = getTrainsRoot(allData);
    return root?.selectionRules || {};
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getTrainByCode(code, allData) {
    if (!code) return null;

    const trains = getTrainList(allData);
    const cleanCode = String(code).trim();

    return trains.find((train) => train.code === cleanCode) || null;
  }

  function getTrainPrice(train, passengerType = "adult") {
    if (!train?.price) return 0;

    const amount = Number(train.price[passengerType] || train.price.adult || 0);

    return Number.isFinite(amount) ? amount : 0;
  }

  function getTrainCurrency(train) {
    return train?.currency || "USD";
  }

  function filterTrains(filters = {}, allData) {
    const trains = getTrainList(allData);

    return trains.filter((train) => {
      if (filters.route && train.route !== filters.route) return false;

      if (filters.company && train.company !== filters.company) return false;

      if (filters.category && train.category !== filters.category) return false;

      if (filters.routes && Array.isArray(filters.routes) && !filters.routes.includes(train.route)) {
        return false;
      }

      if (filters.companies && Array.isArray(filters.companies) && !filters.companies.includes(train.company)) {
        return false;
      }

      if (filters.categories && Array.isArray(filters.categories) && !filters.categories.includes(train.category)) {
        return false;
      }

      return true;
    });
  }

  function resolveDefaultTrainSelection(machuPicchuTour, allData) {
    const trainSelection = machuPicchuTour?.trainSelection || machuPicchuTour?.raw?.trainSelection;
    const defaultCodes = trainSelection?.defaultTrainCodes || machuPicchuTour?.defaultTrainSelection || {};

    const outboundCode =
      defaultCodes.outbound ||
      defaultCodes.outboundTrainCode ||
      machuPicchuTour?.internalPricing?.defaultOutboundTrainCode ||
      machuPicchuTour?.raw?.internalPricing?.defaultOutboundTrainCode;

    const returnCode =
      defaultCodes.return ||
      defaultCodes.returnTrainCode ||
      machuPicchuTour?.internalPricing?.defaultReturnTrainCode ||
      machuPicchuTour?.raw?.internalPricing?.defaultReturnTrainCode;

    const outbound = getTrainByCode(outboundCode, allData);
    const returnTrain = getTrainByCode(returnCode, allData);

    return {
      outboundCode,
      returnCode,
      outbound,
      returnTrain,
      currency: outbound?.currency || returnTrain?.currency || "USD",
      totalAdultCost: getTrainPrice(outbound, "adult") + getTrainPrice(returnTrain, "adult"),
      totalChildCost: getTrainPrice(outbound, "child") + getTrainPrice(returnTrain, "child")
    };
  }

  function getAllowedOutboundTrains(trainSelection = {}, allData) {
    if (!trainSelection?.required) return [];

    const allowedRoutes = trainSelection.allowedRoutes?.outbound || [];
    const allowedCompanies = trainSelection.allowedCompanies || [];

    const categories = normalizeAllowedCategories(trainSelection.allowedCategories, "outbound");

    return filterTrains({
      routes: allowedRoutes,
      companies: allowedCompanies,
      categories
    }, allData);
  }

  function getAllowedReturnTrains(trainSelection = {}, outboundTrain = null, allData) {
    if (!trainSelection?.required) return [];

    const allowedRoutes = trainSelection.allowedRoutes?.return || [];
    const allowedCompanies = trainSelection.allowedCompanies || [];

    let companies = allowedCompanies;

    if (
      trainSelection.sameCompanyRoundTrip ||
      trainSelection.returnOptionsRule === "same_company_as_outbound"
    ) {
      companies = outboundTrain?.company ? [outboundTrain.company] : allowedCompanies;
    }

    const categories = normalizeAllowedCategories(trainSelection.allowedCategories, "return");

    return filterTrains({
      routes: allowedRoutes,
      companies,
      categories
    }, allData);
  }

  function normalizeAllowedCategories(allowedCategories, direction) {
    if (!allowedCategories || allowedCategories === "all_available") return null;

    if (Array.isArray(allowedCategories)) return allowedCategories;

    if (typeof allowedCategories === "object") {
      return toArray(allowedCategories[direction]);
    }

    return null;
  }

  function validateSameCompanyRoundTrip(outbound, returnTrain) {
    if (!outbound || !returnTrain) {
      return {
        valid: false,
        reason: "Falta tren de ida o retorno."
      };
    }

    if (outbound.company !== returnTrain.company) {
      return {
        valid: false,
        reason: "No se permite mezclar PeruRail e Inca Rail en el mismo paquete."
      };
    }

    return {
      valid: true,
      reason: ""
    };
  }

  function validateTrainSelection(trainSelection = {}, selected = {}, allData) {
    const outbound = selected.outbound || getTrainByCode(selected.outboundCode, allData);
    const returnTrain = selected.returnTrain || getTrainByCode(selected.returnCode, allData);

    if (!trainSelection.required) {
      return {
        valid: true,
        reason: "El producto no requiere tren."
      };
    }

    if (!outbound || !returnTrain) {
      return {
        valid: false,
        reason: "Debes seleccionar tren de ida y tren de retorno."
      };
    }

    if (
      trainSelection.sameCompanyRoundTrip ||
      trainSelection.allowMixedCompanies === false
    ) {
      const companyValidation = validateSameCompanyRoundTrip(outbound, returnTrain);
      if (!companyValidation.valid) return companyValidation;
    }

    const allowedOutboundRoutes = trainSelection.allowedRoutes?.outbound || [];
    const allowedReturnRoutes = trainSelection.allowedRoutes?.return || [];

    if (allowedOutboundRoutes.length && !allowedOutboundRoutes.includes(outbound.route)) {
      return {
        valid: false,
        reason: "La ruta del tren de ida no es válida para este producto."
      };
    }

    if (allowedReturnRoutes.length && !allowedReturnRoutes.includes(returnTrain.route)) {
      return {
        valid: false,
        reason: "La ruta del tren de retorno no es válida para este producto."
      };
    }

    return {
      valid: true,
      reason: ""
    };
  }

  function isFixedTrainSelection(trainSelection = {}) {
    return Boolean(
      trainSelection.fixedSelection ||
      trainSelection.mode === "fixed" ||
      trainSelection.customerCanChangeTrain === false
    );
  }

  function shouldShowTrainSelector(trainSelection = {}) {
    if (!trainSelection.required) return false;
    return !isFixedTrainSelection(trainSelection);
  }

  function calculateSelectedTrainTotal(selection = {}, allData) {
    const outbound = selection.outbound || getTrainByCode(selection.outboundCode, allData);
    const returnTrain = selection.returnTrain || getTrainByCode(selection.returnCode, allData);

    return {
      outbound,
      returnTrain,
      currency: outbound?.currency || returnTrain?.currency || "USD",
      adultTotal: getTrainPrice(outbound, "adult") + getTrainPrice(returnTrain, "adult"),
      childTotal: getTrainPrice(outbound, "child") + getTrainPrice(returnTrain, "child")
    };
  }

  function calculateTrainAdjustment(defaultSelection = {}, selectedSelection = {}, allData) {
    const defaultTotal = calculateSelectedTrainTotal(defaultSelection, allData);
    const selectedTotal = calculateSelectedTrainTotal(selectedSelection, allData);

    return {
      currency: selectedTotal.currency || defaultTotal.currency || "USD",
      adultAdjustment: selectedTotal.adultTotal - defaultTotal.adultTotal,
      childAdjustment: selectedTotal.childTotal - defaultTotal.childTotal,
      defaultAdultTotal: defaultTotal.adultTotal,
      selectedAdultTotal: selectedTotal.adultTotal,
      defaultChildTotal: defaultTotal.childTotal,
      selectedChildTotal: selectedTotal.childTotal
    };
  }

  function buildTrainSelectionViewModel(machuPicchuTour, allData) {
    const rawTour = machuPicchuTour?.raw || machuPicchuTour || {};
    const trainSelection = rawTour.trainSelection || {};

    const defaultSelection = resolveDefaultTrainSelection(rawTour, allData);
    const outboundOptions = getAllowedOutboundTrains(trainSelection, allData);

    const initialOutbound = defaultSelection.outbound || outboundOptions[0] || null;
    const returnOptions = getAllowedReturnTrains(trainSelection, initialOutbound, allData);

    return {
      required: Boolean(trainSelection.required),
      fixed: isFixedTrainSelection(trainSelection),
      showSelector: shouldShowTrainSelector(trainSelection),
      mode: trainSelection.mode || "none",
      sameCompanyRoundTrip: Boolean(trainSelection.sameCompanyRoundTrip),
      allowMixedCompanies: Boolean(trainSelection.allowMixedCompanies),
      defaultSelection,
      outboundOptions,
      returnOptions,
      selected: {
        outbound: initialOutbound,
        returnTrain: defaultSelection.returnTrain || returnOptions[0] || null
      }
    };
  }

  function getCompanyLabel(company, allData) {
    const root = getTrainsRoot(allData);
    return root?.companies?.[company]?.name || company || "";
  }

  function getCategoryBenefits(company, category, allData) {
    const root = getTrainsRoot(allData);
    return root?.categoryBenefits?.[company]?.[category] || [];
  }

  function formatTrainLabel(train, allData) {
    if (!train) return "";

    const companyLabel = getCompanyLabel(train.company, allData);

    return [
      companyLabel,
      train.serviceName,
      train.departureTime && train.arrivalTime
        ? `${train.departureTime} - ${train.arrivalTime}`
        : "",
      train.departureStation && train.arrivalStation
        ? `${train.departureStation} → ${train.arrivalStation}`
        : ""
    ].filter(Boolean).join(" · ");
  }

  window.MyCuscoTripTrainService = {
    getTrainByCode,
    getTrainList,
    getTrainRules,
    getTrainPrice,
    getTrainCurrency,
    filterTrains,
    resolveDefaultTrainSelection,
    getAllowedOutboundTrains,
    getAllowedReturnTrains,
    validateSameCompanyRoundTrip,
    validateTrainSelection,
    isFixedTrainSelection,
    shouldShowTrainSelector,
    calculateSelectedTrainTotal,
    calculateTrainAdjustment,
    buildTrainSelectionViewModel,
    getCompanyLabel,
    getCategoryBenefits,
    formatTrainLabel
  };
})();
