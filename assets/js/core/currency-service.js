"use strict";

/**
 * My Cusco Trip - Currency Service
 * Conversión, redondeo y formato monetario.
 * Usa currency-config.json como fuente única de verdad.
 */

(function () {
  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getCurrencyConfig(allData) {
    const data = getDataPayload(allData || {});
    return data?.currencyConfig || data || {};
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeCurrency(currency) {
    return String(currency || "").trim().toUpperCase();
  }

  function getDefaultCurrency(allData) {
    const config = getCurrencyConfig(allData);
    return normalizeCurrency(config.defaultCurrency || "USD");
  }

  function getEnabledCurrencies(allData) {
    const config = getCurrencyConfig(allData);
    return Array.isArray(config.enabledCurrencies)
      ? config.enabledCurrencies.map(normalizeCurrency)
      : ["USD", "PEN"];
  }

  function isCurrencyEnabled(currency, allData) {
    const enabled = getEnabledCurrencies(allData);
    return enabled.includes(normalizeCurrency(currency));
  }

  function getExchangeRates(allData) {
    const config = getCurrencyConfig(allData);
    return config.exchangeRates || {};
  }

  function getExchangeRate(fromCurrency, toCurrency, allData) {
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);
    const rates = getExchangeRates(allData);

    if (!from || !to) return null;
    if (from === to) return 1;

    const directKey = `${from}_${to}`;
    const inverseKey = `${to}_${from}`;

    if (rates[directKey]) {
      return safeNumber(rates[directKey], null);
    }

    const config = getCurrencyConfig(allData);
    const allowInverse = config.conversionRules?.allowInverseRates !== false;

    if (allowInverse && rates[inverseKey]) {
      const inverseRate = safeNumber(rates[inverseKey], 0);
      return inverseRate > 0 ? 1 / inverseRate : null;
    }

    return null;
  }

  function convertCurrency(amount, fromCurrency, toCurrency, allData, options = {}) {
    const value = safeNumber(amount, 0);
    const from = normalizeCurrency(fromCurrency);
    const to = normalizeCurrency(toCurrency);

    if (!from || !to || from === to) {
      return {
        amount: value,
        fromCurrency: from,
        toCurrency: to,
        rate: 1,
        converted: value,
        rounded: options.round === false ? value : roundCommercial(value, to, allData),
        success: true
      };
    }

    const rate = getExchangeRate(from, to, allData);

    if (!rate) {
      console.warn(`[MyCuscoTrip CurrencyService] No existe tipo de cambio ${from}_${to}`);
      return {
        amount: value,
        fromCurrency: from,
        toCurrency: to,
        rate: null,
        converted: value,
        rounded: value,
        success: false
      };
    }

    const converted = value * rate;
    const shouldRound = options.round !== false;
    const rounded = shouldRound ? roundCommercial(converted, to, allData) : converted;

    return {
      amount: value,
      fromCurrency: from,
      toCurrency: to,
      rate,
      converted,
      rounded,
      success: true
    };
  }

  function roundCommercial(amount, currency, allData) {
    const value = safeNumber(amount, 0);
    const code = normalizeCurrency(currency);
    const config = getCurrencyConfig(allData);
    const rule = config.roundingRules?.[code];

    if (!rule) return value;

    const step = safeNumber(rule.step, 1);
    const ending = safeNumber(rule.ending, 0);

    if (step <= 0) return value;

    if (rule.mode === "up") {
      if (ending > 0 && ending < 1) {
        const base = Math.floor(value / step) * step;
        let rounded = base + ending;

        while (rounded < value) {
          rounded += step;
        }

        return Number(rounded.toFixed(2));
      }

      return Math.ceil(value / step) * step;
    }

    return value;
  }

  function formatMoney(amount, currency, allData, options = {}) {
    const code = normalizeCurrency(currency || getDefaultCurrency(allData));
    const config = getCurrencyConfig(allData);
    const display = config.display?.[code] || {};

    const value = safeNumber(amount, 0);
    const decimals = options.decimals !== undefined
      ? options.decimals
      : safeNumber(display.decimals, code === "USD" || code === "EUR" ? 2 : 0);

    const symbol = display.symbol || code;
    const position = display.position || "before";

    const formattedNumber = value.toLocaleString("es-PE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    if (position === "after") {
      return `${formattedNumber} ${symbol}`;
    }

    return `${symbol} ${formattedNumber}`;
  }

  function convertAndFormat(amount, fromCurrency, toCurrency, allData, options = {}) {
    const result = convertCurrency(amount, fromCurrency, toCurrency, allData, options);

    return {
      ...result,
      formatted: formatMoney(result.rounded, result.toCurrency, allData, options)
    };
  }

  function normalizeQuoteCurrency(quote = {}, targetCurrency, allData) {
    const fromCurrency = normalizeCurrency(quote.currency || getDefaultCurrency(allData));
    const toCurrency = normalizeCurrency(targetCurrency || fromCurrency);

    if (!quote || fromCurrency === toCurrency) return quote;

    const convertAmount = (amount) => {
      return convertCurrency(amount, fromCurrency, toCurrency, allData).rounded;
    };

    const convertedSections = Array.isArray(quote.sections)
      ? quote.sections.map((section) => ({
          ...section,
          currency: toCurrency,
          total: convertAmount(section.total || 0),
          items: Array.isArray(section.items)
            ? section.items.map((item) => ({
                ...item,
                currency: toCurrency,
                adultUnit: item.adultUnit !== undefined ? convertAmount(item.adultUnit) : item.adultUnit,
                childUnit: item.childUnit !== undefined ? convertAmount(item.childUnit) : item.childUnit,
                unitPrice: item.unitPrice !== undefined ? convertAmount(item.unitPrice) : item.unitPrice,
                adultTotal: item.adultTotal !== undefined ? convertAmount(item.adultTotal) : item.adultTotal,
                childTotal: item.childTotal !== undefined ? convertAmount(item.childTotal) : item.childTotal,
                total: item.total !== undefined ? convertAmount(item.total) : item.total
              }))
            : []
        }))
      : [];

    return {
      ...quote,
      currency: toCurrency,
      sections: convertedSections,
      subtotal: convertAmount(quote.subtotal || 0),
      total: convertAmount(quote.total || 0),
      partialPayment: convertAmount(quote.partialPayment || 0),
      balance: convertAmount(quote.balance || 0)
    };
  }

  function getCurrencyOptions(allData) {
    const enabled = getEnabledCurrencies(allData);
    const config = getCurrencyConfig(allData);

    return enabled.map((currency) => ({
      code: currency,
      symbol: config.display?.[currency]?.symbol || currency,
      decimals: config.display?.[currency]?.decimals ?? 2,
      label: currency
    }));
  }

  window.MyCuscoTripCurrencyService = {
    getCurrencyConfig,
    getDefaultCurrency,
    getEnabledCurrencies,
    isCurrencyEnabled,
    getExchangeRates,
    getExchangeRate,
    convertCurrency,
    roundCommercial,
    formatMoney,
    convertAndFormat,
    normalizeQuoteCurrency,
    getCurrencyOptions
  };
})();
