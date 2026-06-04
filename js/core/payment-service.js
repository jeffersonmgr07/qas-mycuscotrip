"use strict";

/**
 * My Cusco Trip - Payment Service
 * Resolución de proveedor de pago, modalidad, anticipo y payload futuro.
 * Usa payment-config.json como fuente única de verdad.
 */

(function () {
  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getPaymentConfig(allData) {
    const data = getDataPayload(allData || {});
    return data?.paymentConfig || data || {};
  }

  function normalizeCurrency(currency) {
    return String(currency || "").trim().toUpperCase();
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getPassengers(input = {}) {
    const adults = safeNumber(input.adults, 1);
    const children = safeNumber(input.children, 0);

    return {
      adults: adults > 0 ? adults : 1,
      children: children > 0 ? children : 0,
      total: (adults > 0 ? adults : 1) + (children > 0 ? children : 0)
    };
  }

  function getProviders(allData) {
    const config = getPaymentConfig(allData);
    return config.providers || {};
  }

  function getProvider(providerCode, allData) {
    const providers = getProviders(allData);
    return providers[providerCode] || null;
  }

  function getEnabledProviders(allData) {
    return Object.entries(getProviders(allData))
      .filter(([, provider]) => provider?.enabled)
      .map(([code, provider]) => ({
        code,
        ...provider
      }));
  }

  function resolvePaymentProvider(currency, market = "default", allData) {
    const config = getPaymentConfig(allData);
    const targetCurrency = normalizeCurrency(currency || config.defaultCurrency || "USD");
    const targetMarket = normalizeText(market || "default");

    const rules = Array.isArray(config.providerResolution?.rules)
      ? config.providerResolution.rules
      : [];

    const orderedRules = [...rules].sort((a, b) => {
      return safeNumber(a.priority, 99) - safeNumber(b.priority, 99);
    });

    const matchedRule = orderedRules.find((rule) => {
      const currencies = Array.isArray(rule.currencies)
        ? rule.currencies.map(normalizeCurrency)
        : [];

      const markets = Array.isArray(rule.markets)
        ? rule.markets.map(normalizeText)
        : [];

      const currencyMatches = currencies.includes(targetCurrency);
      const marketMatches =
        markets.includes(targetMarket) ||
        markets.includes("default") ||
        targetMarket === "default";

      const provider = getProvider(rule.provider, allData);

      return currencyMatches && marketMatches && provider?.enabled;
    });

    if (matchedRule) {
      const provider = getProvider(matchedRule.provider, allData);

      return {
        providerCode: matchedRule.provider,
        provider,
        currency: targetCurrency,
        market: targetMarket,
        resolutionMode: config.providerResolution?.mode || "currency_first",
        fallback: false
      };
    }

    const fallbackProviderCode =
      config.providerResolution?.fallbackProvider ||
      config.defaultProvider ||
      "manual_payment";

    return {
      providerCode: fallbackProviderCode,
      provider: getProvider(fallbackProviderCode, allData),
      currency: targetCurrency,
      market: targetMarket,
      resolutionMode: "fallback",
      fallback: true
    };
  }

  function isProviderCompatibleWithCurrency(providerCode, currency, allData) {
    const provider = getProvider(providerCode, allData);
    const targetCurrency = normalizeCurrency(currency);

    if (!provider) return false;

    const supportedCurrencies = Array.isArray(provider.supportedCurrencies)
      ? provider.supportedCurrencies.map(normalizeCurrency)
      : [];

    return supportedCurrencies.includes(targetCurrency);
  }

  function getPaymentModes(allData) {
    const config = getPaymentConfig(allData);
    return config.paymentModes || {};
  }

  function getAvailablePaymentModes(productKind = "package", currency = "USD", allData) {
    const config = getPaymentConfig(allData);
    const modes = getPaymentModes(allData);
    const productRules = config.productRules?.[productKind] || {};
    const allowedModeCodes = Array.isArray(productRules.allowedPaymentModes)
      ? productRules.allowedPaymentModes
      : Object.keys(modes);

    return allowedModeCodes
      .map((modeCode) => {
        const mode = modes[modeCode];
        if (!mode || mode.enabled === false) return null;

        return {
          code: modeCode,
          ...mode,
          currency: normalizeCurrency(currency)
        };
      })
      .filter(Boolean);
  }

  function calculatePartialPayment(passengersInput = {}, currency = "USD", allData) {
    const passengers = getPassengers(passengersInput);
    const config = getPaymentConfig(allData);
    const targetCurrency = normalizeCurrency(currency || config.defaultCurrency || "USD");

    const defaultPartialByCurrency =
      config.paymentModes?.partial?.defaultPartialPaymentPerPerson || {};

    const perPerson = safeNumber(
      defaultPartialByCurrency[targetCurrency],
      targetCurrency === "PEN" ? 180 : 50
    );

    return {
      currency: targetCurrency,
      perPerson,
      passengers: passengers.total,
      total: perPerson * passengers.total
    };
  }

  function calculatePaymentSummary(quote = {}, options = {}, allData) {
    const currency = normalizeCurrency(options.currency || quote.currency || "USD");
    const paymentMode = normalizeText(options.paymentMode || "partial");
    const market = normalizeText(options.market || "default");
    const passengers = quote.passengers || getPassengers(options);

    const providerResolution = resolvePaymentProvider(currency, market, allData);

    const total = safeNumber(quote.total, 0);
    const partial = calculatePartialPayment(passengers, currency, allData);

    let amountToPay = total;
    let balance = 0;

    if (paymentMode === "partial") {
      amountToPay = Math.min(partial.total, total);
      balance = Math.max(total - amountToPay, 0);
    }

    if (paymentMode === "full") {
      amountToPay = total;
      balance = 0;
    }

    return {
      currency,
      paymentMode,
      providerCode: providerResolution.providerCode,
      provider: providerResolution.provider,
      fallback: providerResolution.fallback,
      total,
      amountToPay,
      balance,
      partialPaymentPerPerson: partial.perPerson,
      passengers: partial.passengers
    };
  }

  function buildPaymentIntentPayload(quote = {}, options = {}, allData) {
    const summary = calculatePaymentSummary(quote, options, allData);

    return {
      environment: getPaymentConfig(allData).environment?.mode || "sandbox",
      productionReady: Boolean(getPaymentConfig(allData).environment?.productionReady),
      providerCode: summary.providerCode,
      providerLabel: summary.provider?.label || summary.providerCode,
      paymentMode: summary.paymentMode,
      currency: summary.currency,
      amount: summary.amountToPay,
      totalQuoteAmount: summary.total,
      balance: summary.balance,
      productKind: quote.productKind || options.productKind || "package",
      productFamily: quote.productFamily || options.productFamily || "",
      title: quote.packageTitle || quote.title || options.title || "",
      passengers: quote.passengers || getPassengers(options),
      customer: options.customer || null,
      metadata: {
        quoteCode: options.quoteCode || "",
        source: "my-cusco-trip-frontend",
        requiresBackend: summary.provider?.type === "online_gateway",
        integrationStatus: summary.provider?.integrationStatus || "unknown"
      },
      securityNotes: summary.provider?.securityNotes || []
    };
  }

  function getCheckoutReadiness(providerCode, allData) {
    const provider = getProvider(providerCode, allData);

    if (!provider) {
      return {
        ready: false,
        reason: "Proveedor no encontrado."
      };
    }

    if (!provider.enabled) {
      return {
        ready: false,
        reason: "Proveedor deshabilitado."
      };
    }

    if (provider.type === "manual") {
      return {
        ready: true,
        reason: "Pago manual disponible."
      };
    }

    if (provider.integrationStatus !== "available" && provider.integrationStatus !== "active") {
      return {
        ready: false,
        reason: "Proveedor preparado, pero requiere backend o configuración final."
      };
    }

    return {
      ready: true,
      reason: "Proveedor disponible."
    };
  }

  function getProviderPublicConfig(providerCode, allData) {
    const provider = getProvider(providerCode, allData);

    if (!provider) return null;

    return {
      providerCode,
      label: provider.label,
      type: provider.type,
      mode: provider.mode,
      environment: provider.environment,
      publicConfig: provider.publicConfig || {},
      checkoutCapabilities: provider.checkoutCapabilities || {}
    };
  }

  function buildManualPaymentInstructions(quote = {}, options = {}, allData) {
    const summary = calculatePaymentSummary(quote, {
      ...options,
      paymentMode: options.paymentMode || "partial"
    }, allData);

    return {
      providerCode: "manual_payment",
      label: "Pago manual coordinado",
      currency: summary.currency,
      amountToPay: summary.amountToPay,
      balance: summary.balance,
      message: "Tu solicitud será revisada por el equipo de My Cusco Trip. Te contactaremos para confirmar disponibilidad, forma de pago y siguientes pasos."
    };
  }

  window.MyCuscoTripPaymentService = {
    getPaymentConfig,
    getProviders,
    getProvider,
    getEnabledProviders,
    resolvePaymentProvider,
    isProviderCompatibleWithCurrency,
    getPaymentModes,
    getAvailablePaymentModes,
    calculatePartialPayment,
    calculatePaymentSummary,
    buildPaymentIntentPayload,
    getCheckoutReadiness,
    getProviderPublicConfig,
    buildManualPaymentInstructions
  };
})();
