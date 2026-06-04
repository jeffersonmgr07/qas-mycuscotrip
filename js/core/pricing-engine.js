"use strict";

/**
 * My Cusco Trip - Pricing Engine
 * Motor central de cálculo para tours y paquetes dinámicos.
 * Usa precios publicados. No expone costos internos al cliente.
 */

(function () {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getPassengers(params = {}) {
    const adults = safeNumber(params.adults, 1);
    const children = safeNumber(params.children, 0);

    return {
      adults: adults > 0 ? adults : 1,
      children: children > 0 ? children : 0,
      total: (adults > 0 ? adults : 1) + (children > 0 ? children : 0)
    };
  }

  function getNationality(params = {}) {
    return params.nationality || "foreign";
  }

  function getProductCurrency(product, fallback = "USD") {
    return (
      product?.currency ||
      product?.price?.currency ||
      product?.basePricing?.currency ||
      product?.pricing?.displayCurrency ||
      product?.defaultCurrency ||
      fallback
    );
  }

  function getAdultChildPrice(product, nationality = "foreign") {
    const raw = product?.raw || product || {};

    if (raw.basePricingByNationality?.[nationality]) {
      return {
        adult: safeNumber(raw.basePricingByNationality[nationality].adult, 0),
        child: safeNumber(raw.basePricingByNationality[nationality].child, raw.basePricingByNationality[nationality].adult || 0),
        currency: raw.basePricingByNationality[nationality].currency || getProductCurrency(raw)
      };
    }

    if (raw.basePricing) {
      return {
        adult: safeNumber(raw.basePricing.adult, 0),
        child: safeNumber(raw.basePricing.child, raw.basePricing.adult || 0),
        currency: raw.basePricing.currency || getProductCurrency(raw)
      };
    }

    if (raw.pricing) {
      return {
        adult: safeNumber(raw.pricing.publishedAdultUSD, raw.pricing.amount || 0),
        child: safeNumber(raw.pricing.publishedChildUSD, raw.pricing.publishedAdultUSD || raw.pricing.amount || 0),
        currency: raw.pricing.displayCurrency || getProductCurrency(raw)
      };
    }

    if (product?.price) {
      return {
        adult: safeNumber(product.price.amount, 0),
        child: safeNumber(product.price.amount, 0),
        currency: product.price.currency || getProductCurrency(product)
      };
    }

    return {
      adult: 0,
      child: 0,
      currency: getProductCurrency(raw)
    };
  }

  function calculateTourTotal(tour, passengersInput = {}, nationality = "foreign") {
    const passengers = getPassengers(passengersInput);
    const price = getAdultChildPrice(tour, nationality);

    const adultTotal = price.adult * passengers.adults;
    const childTotal = price.child * passengers.children;
    const total = adultTotal + childTotal;

    return {
      code: tour?.internalCode || tour?.raw?.internalCode || tour?.id || "",
      title: tour?.title || tour?.raw?.title || "",
      type: "tour",
      currency: price.currency,
      adultUnit: price.adult,
      childUnit: price.child,
      adults: passengers.adults,
      children: passengers.children,
      adultTotal,
      childTotal,
      total
    };
  }

  function calculateToursTotal(tours = [], passengersInput = {}, nationality = "foreign") {
    const items = toArray(tours).map((tour) => calculateTourTotal(tour, passengersInput, nationality));

    return {
      type: "tours",
      currency: items[0]?.currency || "USD",
      items,
      total: items.reduce((sum, item) => sum + item.total, 0)
    };
  }

  function calculateMachuPicchuTotal(tour, passengersInput = {}, nationality = "foreign") {
    if (!tour) {
      return {
        type: "machu_picchu",
        currency: "USD",
        items: [],
        total: 0
      };
    }

    const item = calculateTourTotal(tour, passengersInput, nationality);

    return {
      type: "machu_picchu",
      currency: item.currency,
      items: [item],
      total: item.total
    };
  }

  function splitToursByType(tours = []) {
    const machuPicchuTours = [];
    const regularTours = [];

    toArray(tours).forEach((tour) => {
      const code = tour?.internalCode || tour?.raw?.internalCode || "";
      const family = tour?.productFamily || tour?.raw?.productFamily || "";

      if (/^MAPI/i.test(code) || family === "machu-picchu-tour") {
        machuPicchuTours.push(tour);
      } else {
        regularTours.push(tour);
      }
    });

    return {
      regularTours,
      machuPicchuTours
    };
  }

  function calculateHotelsTotal(hotelSelections = []) {
    const selections = toArray(hotelSelections);

    const items = selections.map((selection) => {
      const nights = safeNumber(selection.nights, 1);

      let total = 0;
      let perPerson = 0;

      if (window.MyCuscoTripHotelService) {
        total = window.MyCuscoTripHotelService.calculateHotelTotal(selection, nights);
        perPerson = window.MyCuscoTripHotelService.calculateHotelPerPerson(
          selection,
          selection.passengers || selection.passengerCount || 1,
          nights
        );
      } else {
        const roomAmount = safeNumber(selection.room?.publishedPricing?.amount || selection.publishedPricing?.amount, 0);
        const quantity = safeNumber(selection.quantity, 1);
        total = roomAmount * quantity * nights;
        perPerson = total;
      }

      return {
        type: "hotel",
        destination: selection.destination || "",
        hotelCode: selection.hotel?.hotelCode || selection.hotelCode || "",
        hotelName: selection.hotel?.hotelName || selection.hotelName || "",
        roomLabel: selection.room?.label || selection.label || "",
        nights,
        currency: selection.room?.publishedPricing?.currency || selection.currency || "USD",
        total,
        perPerson
      };
    });

    return {
      type: "hotels",
      currency: items[0]?.currency || "USD",
      items,
      total: items.reduce((sum, item) => sum + item.total, 0)
    };
  }

  function calculateTrainAdjustments(trainSelections = [], allData) {
    const selections = toArray(trainSelections);

    const items = selections.map((selection) => {
      if (!window.MyCuscoTripTrainService) {
        return {
          type: "train_adjustment",
          currency: selection.currency || "USD",
          adultAdjustment: 0,
          childAdjustment: 0,
          total: 0
        };
      }

      const adjustment = window.MyCuscoTripTrainService.calculateTrainAdjustment(
        selection.defaultSelection,
        selection.selectedSelection,
        allData
      );

      const passengers = getPassengers(selection.passengers || {});

      const total =
        adjustment.adultAdjustment * passengers.adults +
        adjustment.childAdjustment * passengers.children;

      return {
        type: "train_adjustment",
        label: selection.label || "Ajuste de tren",
        currency: adjustment.currency,
        adultAdjustment: adjustment.adultAdjustment,
        childAdjustment: adjustment.childAdjustment,
        adults: passengers.adults,
        children: passengers.children,
        total
      };
    });

    return {
      type: "train_adjustments",
      currency: items[0]?.currency || "USD",
      items,
      total: items.reduce((sum, item) => sum + item.total, 0)
    };
  }

  function getExtraPrice(extra, nationality = "foreign") {
    if (!extra) {
      return {
        amount: 0,
        currency: "USD"
      };
    }

    if (extra.costByNationality?.[nationality]) {
      return {
        amount: safeNumber(
          extra.costByNationality[nationality].publishedUSD ||
          extra.costByNationality[nationality].amount ||
          0,
          0
        ),
        currency: "USD"
      };
    }

    if (extra.publishedPricing) {
      return {
        amount: safeNumber(extra.publishedPricing.amount, 0),
        currency: extra.publishedPricing.currency || "USD"
      };
    }

    if (extra.publishedPriceUSD) {
      return {
        amount: safeNumber(extra.publishedPriceUSD, 0),
        currency: "USD"
      };
    }

    if (extra.price) {
      return {
        amount: safeNumber(extra.price.amount || extra.price, 0),
        currency: extra.price.currency || extra.currency || "USD"
      };
    }

    return {
      amount: 0,
      currency: extra.currency || "USD"
    };
  }

  function calculateExtrasTotal(extras = [], passengersInput = {}, nationality = "foreign") {
    const passengers = getPassengers(passengersInput);

    const items = toArray(extras).map((extra) => {
      const price = getExtraPrice(extra, nationality);
      const quantity = extra.perPerson === false ? 1 : passengers.total;
      const total = price.amount * quantity;

      return {
        type: "extra",
        code: extra.code || "",
        label: extra.label || extra.title || "Extra",
        required: Boolean(extra.required),
        optional: Boolean(extra.optional),
        perPerson: extra.perPerson !== false,
        currency: price.currency,
        unitPrice: price.amount,
        quantity,
        total
      };
    });

    return {
      type: "extras",
      currency: items[0]?.currency || "USD",
      items,
      total: items.reduce((sum, item) => sum + item.total, 0)
    };
  }

  function collectPackageExtras(packageOption = {}) {
    const tours = toArray(packageOption.includedTours);
    const extras = [];

    tours.forEach((tour) => {
      const raw = tour?.raw || tour || {};
      toArray(raw.extras).forEach((extra) => extras.push(extra));
      toArray(raw.ticketPricingByNationality).forEach((extra) => extras.push(extra));
    });

    return extras;
  }

  function calculateSubtotal(sections = []) {
    return toArray(sections).reduce((sum, section) => {
      return sum + safeNumber(section.total, 0);
    }, 0);
  }

  function calculatePartialPayment(total, passengersInput = {}, paymentConfig = null, currency = "USD") {
    const passengers = getPassengers(passengersInput);

    const partialByCurrency =
      paymentConfig?.paymentModes?.partial?.defaultPartialPaymentPerPerson ||
      {};

    const defaultPerPerson = safeNumber(partialByCurrency[currency], currency === "PEN" ? 180 : 50);
    const partialTotal = defaultPerPerson * passengers.total;

    return Math.min(partialTotal, total);
  }

  function calculatePackagePrice(packageOption = {}, selections = {}, context = {}) {
    const params = {
      adults: selections.adults ?? context.adults ?? 1,
      children: selections.children ?? context.children ?? 0,
      nationality: selections.nationality ?? context.nationality ?? "foreign"
    };

    const passengers = getPassengers(params);
    const nationality = getNationality(params);

    const toursSplit = splitToursByType(packageOption.includedTours || []);
    const toursSection = calculateToursTotal(toursSplit.regularTours, passengers, nationality);

    const machuPicchuItems = toursSplit.machuPicchuTours.map((tour) => {
      return calculateTourTotal(tour, passengers, nationality);
    });

    const machuPicchuSection = {
      type: "machu_picchu",
      currency: machuPicchuItems[0]?.currency || "USD",
      items: machuPicchuItems,
      total: machuPicchuItems.reduce((sum, item) => sum + item.total, 0)
    };

    const hotelsSection = calculateHotelsTotal(selections.hotels || []);
    const trainsSection = calculateTrainAdjustments(selections.trains || [], context.allData);
    const extrasSection = calculateExtrasTotal(
      selections.extras || collectPackageExtras(packageOption),
      passengers,
      nationality
    );

    const sections = [
      toursSection,
      machuPicchuSection,
      hotelsSection,
      trainsSection,
      extrasSection
    ];

    const subtotal = calculateSubtotal(sections);
    const currency =
      packageOption.currency ||
      toursSection.currency ||
      machuPicchuSection.currency ||
      hotelsSection.currency ||
      "USD";

    const paymentConfig = context.allData?.data?.paymentConfig || context.paymentConfig || null;
    const partialPayment = calculatePartialPayment(subtotal, passengers, paymentConfig, currency);
    const balance = Math.max(subtotal - partialPayment, 0);

    return {
      productKind: "package",
      productFamily: packageOption.productFamily || "cusco-package",
      packageTitle: packageOption.title || "",
      currency,
      passengers,
      nationality,
      sections,
      subtotal,
      discounts: {
        total: 0,
        applied: []
      },
      total: subtotal,
      partialPayment,
      balance,
      internalPreview: calculateInternalCostPreview(packageOption, selections, context),
      discountGuardrail: calculateMaxDiscountGuardrail(packageOption, selections, context)
    };
  }

  function calculateSingleProductPrice(product = {}, selections = {}, context = {}) {
    const passengers = getPassengers(selections);
    const nationality = getNationality(selections);
    const item = calculateTourTotal(product, passengers, nationality);

    return {
      productKind: product.productKind || "tour",
      title: product.title || "",
      currency: item.currency,
      passengers,
      nationality,
      sections: [{
        type: "product",
        currency: item.currency,
        items: [item],
        total: item.total
      }],
      subtotal: item.total,
      total: item.total,
      partialPayment: 0,
      balance: item.total,
      internalPreview: calculateInternalCostPreview(product, selections, context),
      discountGuardrail: calculateMaxDiscountGuardrail(product, selections, context)
    };
  }

  function calculateInternalCostPreview() {
    return {
      enabled: false,
      customerVisible: false,
      message: "Preparado para futura vista privada administrativa."
    };
  }

  function calculateMaxDiscountGuardrail() {
    return {
      enabled: false,
      customerVisible: false,
      message: "Preparado para calcular descuento máximo desde utilidad real del paquete."
    };
  }

  function calculateQuote(productOrPackage = {}, selections = {}, context = {}) {
    if (productOrPackage.productKind === "package") {
      return calculatePackagePrice(productOrPackage, selections, context);
    }

    return calculateSingleProductPrice(productOrPackage, selections, context);
  }

  window.MyCuscoTripPricingEngine = {
    calculateQuote,
    calculatePackagePrice,
    calculateSingleProductPrice,
    calculateToursTotal,
    calculateTourTotal,
    calculateMachuPicchuTotal,
    calculateHotelsTotal,
    calculateTrainAdjustments,
    calculateExtrasTotal,
    calculateInternalCostPreview,
    calculateMaxDiscountGuardrail
  };
})();
