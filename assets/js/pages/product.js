"use strict";

function mctLocaleDateTag() {
  const code = String(window.MCT_LOCALE || window.MyCuscoTripI18n?.locale || document.documentElement.lang || "es").slice(0, 2).toLowerCase();
  const map = { es: "es-PE", en: "en-US", fr: "fr-FR", de: "de-DE", pt: "pt-BR", it: "it-IT", zh: "zh-CN", ja: "ja-JP" };
  return map[code] || "es-PE";
}

class MyCuscoTripProductPage {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.slug = this.params.get("slug");
    this.requestedPackageOptionIndex = this.getRequestedPackageOptionIndex();

    this.basePath = window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");

    this.product = null;
    this.tours = [];
    this.hotelsData = { destinations: {} };

    this.allData = null;
    this.catalog = [];
    this.productType = null;

    this.packageOptions = [];
    this.packageOptionsExpanded = false;
    this.selectedPackageOption = null;
    this.selectedPackageOptionIndex = 0;
    this.selectedItinerary = [];
    this.accommodationPlan = [];
    this.selectedPackageExtraCodes = [];
    this.packageContent = null;
    this.dynamicQuote = null;

    this.adults = 2;
    this.children = 0;
    this.selectedExtras = new Set();
    this.paymentMode = "full";
    this.date = "";
    this.selectedDepartureTime = "";

    this.selectedOutboundTrainId = "";
    this.selectedReturnTrainId = "";
    this.selectedTrainAdjustmentTotal = 0;
    this.availableOutboundTrains = [];
    this.availableReturnTrains = [];

    this.serviceMode = "group";

    this.selectedHotelsByDestination = {};
    this.selectedCombinationsByDestination = {};

    this.activeHotelModalDestination = null;
    this.currentPreReservation = null;
    this.appliedCoupon = null;

    this.init();
  }

  t(key, fallback = "", replacements = {}) {
    let value = window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
    Object.entries(replacements || {}).forEach(([name, replacement]) => {
      value = String(value).replaceAll(`{${name}}`, replacement);
    });
    return value;
  }


  isPublicProduct(item) {
    if (window.MyCuscoTripCatalogNormalizer?.isPublicProduct) {
      return window.MyCuscoTripCatalogNormalizer.isPublicProduct(item);
    }
    const status = String(item?.status || "draft").trim().toLowerCase();
    return Boolean(item?.slug) && status === "published";
  }

  getLocale() {
    return String(window.MCT_LOCALE || document.documentElement.lang || "es").slice(0, 2).toLowerCase();
  }

  isEnglishLocale() {
    return this.getLocale() === "en";
  }

  label(esValue, enValue) {
    return this.isEnglishLocale() ? enValue : esValue;
  }

  getDefaultGuideLanguages() {
    return ["es", "en"];
  }

  async init() {
    if (!this.slug) {
      this.renderNotFound(this.t("product.invalidProduct", "No se recibió un producto válido."));
      return;
    }

    try {
      await this.loadProductData();

      const product = this.resolveProductFromCatalog(this.slug);

      if (!product) {
        this.renderNotFound(this.t("product.notFound", "No encontramos esta experiencia."));
        return;
      }

      if (!this.isPublicProduct(product)) {
        this.renderNotFound(this.t("product.notAvailable", "Esta experiencia no está disponible públicamente."));
        return;
      }

      if (!product.paymentOptions || typeof product.paymentOptions !== "object") {
        product.paymentOptions = {};
      }

      if (!product.paymentOptions.fullPaymentDiscountPercent) {
        product.paymentOptions.fullPaymentDiscountPercent = 10;
      }

      this.product = product;
      this.productType = product.productKind || (this.isPackage(product) ? "package" : "tour");

      try {
        this.renderProduct(product);
        this.trackProductView(product);
      } catch (renderError) {
        console.error("Error rendering product:", renderError);
        console.error(renderError?.stack || "Sin stack");
        this.renderNotFound(this.t("product.renderError", "La experiencia existe, pero ocurrió un error al mostrarla."));
        return;
      }

      if (this.productType === "package") {
        try {
          if (this.isPeruPackage(product)) {
            this.renderPeruPackageFallback(product);
          } else {
            this.initDynamicPackageEngine();
          }
        } catch (packageError) {
          console.error("Error initializing package content:", packageError);
          console.error(packageError?.stack || "Sin stack");
        }
      }

      try {
        this.initBookingLogic();
      } catch (bookingError) {
        console.error("Error initializing booking logic:", bookingError);
        console.error(bookingError?.stack || "Sin stack");
      }
    } catch (error) {
      console.error("Error loading product data:", error);
      console.error(error?.stack || "Sin stack");
      this.renderNotFound(this.t("product.loadError", "No se pudo cargar la experiencia."));
    }
  }

  trackEvent(eventName, params = {}, options = {}) {
    if (typeof window.mctTrack === "function") {
      window.mctTrack(eventName, params, options);
    } else if (window.MyCuscoTripTracking?.track) {
      window.MyCuscoTripTracking.track(eventName, params, options);
    }
  }

  trackProductView(product) {
    const productId = product?.id || product?.code || this.slug || "";
    const price = Number(product?.price || product?.basePrice || product?.adultPrice || product?.pricing?.adult || 0) || 0;

    this.trackEvent("view_item", {
      item_id: productId,
      item_name: product?.title || product?.name || "Experiencia",
      item_category: product?.category || this.productType || "tour",
      item_brand: "My Cusco Trip",
      currency: product?.currency || "USD",
      value: price,
      product_slug: this.slug,
      product_type: this.productType
    }, { metaEventName: "ViewContent" });
  }

  async loadProductData() {
    if (window.MyCuscoTripDataLoader && window.MyCuscoTripCatalogNormalizer) {
      this.allData = await window.MyCuscoTripDataLoader.loadAllData();

      this.catalog = window.MyCuscoTripCatalogNormalizer.normalizeCatalog(this.allData);

      this.tours = Array.isArray(this.catalog)
        ? this.catalog.filter((item) => this.isPublicProduct(item))
        : [];

      const loadedHotels = this.allData?.data?.hotels;

      this.hotelsData =
        loadedHotels && typeof loadedHotels === "object"
          ? loadedHotels
          : { destinations: {} };

      return;
    }

    this.tours = await this.loadTours();

    try {
      this.hotelsData = await this.loadHotels();
    } catch (hotelError) {
      console.error("Error loading hotels:", hotelError);
      console.error(hotelError?.stack || "Sin stack");
      this.hotelsData = { destinations: {} };
    }
  }

  resolveProductFromCatalog(slug) {
    if (window.MyCuscoTripCatalogNormalizer && Array.isArray(this.catalog) && this.catalog.length) {
      const product = window.MyCuscoTripCatalogNormalizer.getProductBySlug(slug, this.catalog);
      return product ? this.hydrateProductForLegacyUI(product) : null;
    }

    const product = this.tours.find((item) => item.slug === slug);
    return product ? this.hydrateProductForLegacyUI(product) : null;
  }

  hydrateProductForLegacyUI(product) {
    const raw = product?.raw && typeof product.raw === "object" ? product.raw : {};

    const merged = {
      ...raw,
      ...product
    };

    merged.raw = raw;

    merged.slug = product.slug || raw.slug || "";
    merged.title = product.title || raw.title || "Experiencia";
    merged.description =
      product.description ||
      raw.description ||
      product.shortDescription ||
      raw.shortDescription ||
      "";
    merged.shortDescription = product.shortDescription || raw.shortDescription || "";
    merged.productKind =
      product.productKind ||
      raw.productKind ||
      (this.isPackage(raw) ? "package" : "tour");
    merged.productFamily = product.productFamily || raw.productFamily || "";
    merged.category =
      product.category ||
      raw.category ||
      (merged.productKind === "package" ? "paquetes" : "");
    merged.currency =
      product.currency ||
      raw.currency ||
      product.price?.currency ||
      raw.basePricing?.currency ||
      "USD";

    merged.images = raw.images || product.images || {
      cover: product.image || raw.image || "",
      gallery: []
    };

    merged.basePricing = raw.basePricing || product.basePricing || {
      adult: Number(product.price?.amount || raw.price || 0),
      child: Number(product.price?.amount || raw.price || 0),
      currency: merged.currency
    };

    merged.duration = raw.duration || product.duration || {
      label: product.typeLabel || raw.typeLabel || ""
    };

    merged.duration.label =
      merged.duration.label ||
      product.typeLabel ||
      raw.typeLabel ||
      "";

    merged.includes = Array.isArray(raw.includes) ? raw.includes : [];
    merged.excludes = Array.isArray(raw.excludes) ? raw.excludes : [];
    merged.extras = Array.isArray(raw.extras) ? raw.extras : [];
    merged.itinerary = Array.isArray(raw.itinerary) ? raw.itinerary : [];
    merged.faq = Array.isArray(raw.faq) ? raw.faq : [];
    merged.serviceModes = raw.serviceModes || product.serviceModes || {};
    merged.paymentOptions = raw.paymentOptions || product.paymentOptions || {};
    merged.days = Number(product.days || raw.days || 0);
    merged.nights = Number(product.nights || raw.nights || 0);
    merged.typeLabel = product.typeLabel || raw.typeLabel || merged.duration.label || "";

    if (merged.productKind === "package") {
      merged.category = "paquetes";
    }

    return merged;
  }

  async loadTours() {
    const localProducts = JSON.parse(localStorage.getItem("experiences") || "[]");
  
    if (Array.isArray(localProducts) && localProducts.length > 0) {
      return localProducts.filter((item) => this.isPublicProduct(item));
    }
  
    const sources = {
      toursCusco: "assets/data/tours-cusco.json",
      toursMachuPicchu: "assets/data/tours-machu-picchu.json",
      toursPeru: "assets/data/tours-peru.json",
      trekkingsCusco: "assets/data/trekkings-cusco.json",
      packagesCusco: "assets/data/packages-cusco.json",
      packagesPeru: "assets/data/packages-peru.json"
    };
  
    const entries = await Promise.all(
      Object.entries(sources).map(async ([key, path]) => {
        try {
          const response = await fetch(this.resolvePath(path), {
            cache: "no-store"
          });
  
          if (!response.ok) {
            console.warn(`No se pudo cargar ${path}`);
            return [key, null];
          }
  
          return [key, await response.json()];
        } catch (error) {
          console.warn(`Error cargando ${path}:`, error);
          return [key, null];
        }
      })
    );
  
    const allData = {
      data: Object.fromEntries(entries)
    };
  
    if (window.MyCuscoTripCatalogNormalizer) {
      return window.MyCuscoTripCatalogNormalizer
        .normalizeCatalog(allData)
        .filter((item) => this.isPublicProduct(item));
    }
  
    return [];
  }

  async loadHotels() {
    try {
      const response = await fetch(this.resolvePath("assets/data/hotels.json"), {
        cache: "no-store"
      });

      if (!response.ok) {
        console.warn("No se pudo cargar hotels.json. Se continuará sin hoteles dinámicos.");
        return { destinations: {} };
      }

      const data = await response.json();

      if (!data || typeof data !== "object") {
        return { destinations: {} };
      }

      return {
        destinations:
          data.destinations && typeof data.destinations === "object"
            ? data.destinations
            : {}
      };
    } catch (error) {
      console.warn("Error loading hotels.json:", error);
      return { destinations: {} };
    }
  }
  formatGuideLanguages(languages) {
    const values = Array.isArray(languages) && languages.length ? languages : this.getDefaultGuideLanguages();
    const normalized = values.map((item) => String(item || "").trim()).filter(Boolean);
    const hasSpanish = normalized.some((item) => /^(es|spa)$/i.test(item) || /espa[nñ]ol|spanish/i.test(item));
    const hasEnglish = normalized.some((item) => /^(en|eng)$/i.test(item) || /ingl[eé]s|english/i.test(item));
    const hasOther = normalized.some((item) => /otro|other|request|consult/i.test(item));

    const parts = [];
    if (hasSpanish && hasEnglish) {
      parts.push(this.t("product.guideSpanishEnglish", "Spanish and English"));
    } else {
      normalized.forEach((item) => {
        let value = item
          .replace(/^(es|spa)$/i, this.t("product.languageNameSpanish", "Spanish"))
          .replace(/^(en|eng)$/i, this.t("product.languageNameEnglish", "English"))
          .replace(/espa[nñ]ol/gi, this.t("product.languageNameSpanish", "Spanish"))
          .replace(/ingl[eé]s/gi, this.t("product.languageNameEnglish", "English"))
          .replace(/otros idiomas a consultar/gi, this.t("product.otherLanguagesOnRequest", "Other languages available upon request"));
        if (!/otro|other|request|consult/i.test(value)) parts.push(value);
      });
    }
    if (hasOther) parts.push(this.t("product.otherLanguagesOnRequest", "Other languages available upon request"));
    return [...new Set(parts)].join("; ") || this.t("product.guideSpanishEnglish", "Spanish and English");
  }

  renderProduct(product) {
    const title = product?.title || this.t("cards.experience", "Experience");
    const description =
      product?.description ||
      product?.shortDescription ||
      this.t("product.moreDetailsSoon", "More details about this experience will be added soon.");

    const badge = product?.badge || this.t("cards.experience", "Experience");
    const basePrice = product?.basePricing?.adult || product?.price?.amount || 0;
    const currency = product?.currency || product?.price?.currency || "USD";
    const location = product?.location || this.t("product.defaultLocation", "Cusco, Perú");
    const duration = product?.duration?.label || product?.typeLabel || this.t("product.durationPending", "Flexible duration by selected route");
    const languages = this.formatGuideLanguages(product?.duration?.guideLanguages || this.getDefaultGuideLanguages());
    const capacity = product?.capacity || product?.duration?.maxGroupSize || this.t("product.groupSizeFlexible", "According to the selected service");

    document.title = `${title} | My Cusco Trip`;

    this.setText("productBadge", badge);
    this.setText("productTitle", title);
    this.setText("productDescription", description);
    if (this.isPeruPackage(product) && basePrice > 0) {
      this.setText("productBasePrice", `${currency} ${this.formatMoney(basePrice)}`);
    } else if (this.isPeruPackage(product)) {
      this.setText("productBasePrice", this.t("cards.flexibleQuote", "Cotización flexible"));
    } else {
      this.setText("productBasePrice", `${currency} ${this.formatMoney(basePrice)}`);
    }

    this.setText("detailCapacity", this.t("product.maxTravelers", "Máximo {count} viajeros por grupo", { count: capacity }));
    this.setText("detailDuration", duration);
    this.setText("detailLanguages", this.t("product.guideIn", "Guía profesional: {languages}", { languages }));
    this.setText("detailLocation", location);

    this.renderGallery(product?.images || {});
    this.renderIncludes(product?.includes || []);
    this.renderExcludes(product?.excludes || []);
    this.renderHighlights(product || {});
    this.renderItinerary(product?.itinerary || []);
    this.renderFaq(product?.faq || []);
    this.renderExtras(product?.extras || []);
    this.renderServiceModes(product || {});
    this.renderDepartureTimeOptions(product || {});
    this.renderTrainSelectionOptions(product || {});
    this.renderAccommodationOptions(product || {});
    this.renderSimilarExperiences();
  }

  initBookingLogic() {
    const dateInput = document.getElementById("travelDate");

    if (dateInput && typeof flatpickr !== "undefined") {
      const activeLocaleCode = window.MCT_LOCALE || window.MyCuscoTripI18n?.locale || "es";
      flatpickr(dateInput, {
        locale: flatpickr.l10ns?.[activeLocaleCode] || flatpickr.l10ns?.es,
        minDate: "today",
        dateFormat: "Y-m-d",
        altInput: true,
        altFormat: "d M Y",
        onReady: (_, __, instance) => {
          if (instance.altInput) {
            instance.altInput.setAttribute("readonly", "readonly");
            instance.altInput.style.width = "100%";
            instance.altInput.style.maxWidth = "100%";
            instance.altInput.style.boxSizing = "border-box";
          }
        },
        onChange: (_, dateStr, instance) => {
          this.date = dateStr;
          this.refreshItineraryDates();

          if (instance.altInput) {
            instance.altInput.style.width = "100%";
            instance.altInput.style.maxWidth = "100%";
            instance.altInput.style.boxSizing = "border-box";
          }
        }
      });
    }

    const departureTimeSelect = document.getElementById("departureTimeSelect");

    departureTimeSelect?.addEventListener("change", () => {
      this.selectedDepartureTime = departureTimeSelect.value || "";
    });

    document.querySelectorAll(".qty-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const target = btn.dataset.target;

        if (target === "adults") {
          if (action === "minus") this.adults = Math.max(1, this.adults - 1);
          if (action === "plus") this.adults += 1;
        }

        if (target === "children") {
          if (action === "minus") this.children = Math.max(0, this.children - 1);
          if (action === "plus") this.children += 1;
        }

        this.updatePassengersUI();

        if (this.productType === "package" && this.selectedPackageOption) {
          this.resolveDynamicAccommodationPlan();
          this.renderDynamicPackageContent();
        }

        this.refreshAccommodationSelections();
        this.updatePricing();
      });
    });

    const paymentMode = document.getElementById("paymentMode");

    paymentMode?.addEventListener("change", () => {
      this.paymentMode = paymentMode.value;
      this.updatePricing();
    });

    const serviceModeSelect = document.getElementById("serviceMode");

    serviceModeSelect?.addEventListener("change", () => {
      this.serviceMode = serviceModeSelect.value;
      this.updatePricing();
    });

    document.getElementById("applyDiscountBtn")?.addEventListener("click", () => {
      this.handleApplyDiscountCode();
    });

    document.getElementById("discountCode")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.handleApplyDiscountCode();
      }
    });

    document.getElementById("paypalButton")?.addEventListener("click", () => {
      this.handlePaypalAction();
    });

    this.bindAccommodationEvents();
    this.bindHotelModalEvents();

    this.updatePassengersUI();
    this.refreshAccommodationSelections();
    this.updatePricing();
  }

  renderGallery(images = {}) {
    const gallery = document.getElementById("productGallery");

    if (!gallery) return;

    const cover = images.cover ? [this.resolveAssetPath(images.cover)] : [];

    const galleryImages = Array.isArray(images.gallery)
      ? images.gallery.map((src) => this.resolveAssetPath(src))
      : [];

    const finalImages = [...new Set([...cover, ...galleryImages])];

    if (!finalImages.length) {
      finalImages.push(this.resolvePath("assets/img/tours/machu-picchu-full-day/cover.jpg"));
    }

    const mainImage = finalImages[0];
    const fallbackImage = finalImages[1] || this.resolvePath("assets/img/tours/machu-picchu-full-day/cover.jpg");
    const sideImages = finalImages.slice(1);
    const mobileImages = finalImages;
    const mainFallbackAttr = this.escapeHtml(fallbackImage);

    gallery.innerHTML = `
      <div class="experience-gallery__main">
        <img src="${mainImage}" alt="${this.escapeHtml(this.product?.title || "Experiencia")}" loading="eager" onerror="this.onerror=null;this.src='${mainFallbackAttr}';" />
      </div>

      ${sideImages.length ? `
        <div class="experience-gallery__side experience-gallery__slider" data-gallery-slider data-current-slide="0">
          ${sideImages.map((src, index) => `
            <img
              class="experience-gallery__slide ${index === 0 ? "is-active" : ""}"
              src="${src}"
              alt="${this.escapeHtml(this.t("product.galleryImageAlt", "Galería {n}", { n: index + 2 }))}"
              loading="lazy"
              onerror="this.remove();"
            />
          `).join("")}
        </div>
      ` : ""}

      <div class="experience-gallery__mobile-slider experience-gallery__slider" data-gallery-slider data-current-slide="0">
        ${mobileImages.map((src, index) => `
          <img
            class="experience-gallery__slide ${index === 0 ? "is-active" : ""}"
            src="${src}"
            alt="${this.escapeHtml(this.product?.title || "Experiencia")} imagen ${index + 1}"
            loading="${index === 0 ? "eager" : "lazy"}"
            onerror="${index === 0 ? `this.onerror=null;this.src='${mainFallbackAttr}';` : "this.remove();"}"
          />
        `).join("")}
      </div>
    `;

    this.initProductGallerySliders();
  }

  initProductGallerySliders() {
    document.querySelectorAll("[data-gallery-slider]").forEach((slider) => {
      const slides = Array.from(slider.querySelectorAll(".experience-gallery__slide"));
      if (slides.length <= 1) return;

      if (slider.dataset.sliderTimer) {
        window.clearInterval(Number(slider.dataset.sliderTimer));
      }

      const timer = window.setInterval(() => {
        const current = Number(slider.dataset.currentSlide || 0);
        const next = (current + 1) % slides.length;
        slides[current]?.classList.remove("is-active");
        slides[next]?.classList.add("is-active");
        slider.dataset.currentSlide = String(next);
      }, 3600);

      slider.dataset.sliderTimer = String(timer);
    });
  }

  renderIncludes(items) {
    const target = document.getElementById("productIncludes");

    if (!target) return;

    target.innerHTML = items.length
      ? items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("")
      : `<li>${this.escapeHtml(this.t("product.infoPending", "Information will be provided by your travel advisor."))}</li>`;
  }

  renderExcludes(items) {
    const target = document.getElementById("productExcludes");

    if (!target) return;

    target.innerHTML = items.length
      ? items.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("")
      : `<li>${this.escapeHtml(this.t("product.infoPending", "Information will be provided by your travel advisor."))}</li>`;
  }

  renderHighlights(product) {
    const target = document.getElementById("productHighlights");

    if (!target) return;

    const highlights = [
      product?.shortDescription,
      `${this.t("product.location", "Ubicación")}: ${product?.location || this.t("product.defaultLocation", "Cusco, Perú")}`,
      `${this.t("product.duration", "Duración")}: ${product?.duration?.label || product?.typeLabel || this.t("product.durationPending", "Flexible duration by selected route")}`,
      product?.typeLabel ? `${this.t("product.travelStyle", "Type")}: ${product.typeLabel}` : null,
      product?.duration?.guideLanguages?.length
        ? `${this.t("product.languages", "Languages")}: ${this.formatGuideLanguages(product.duration.guideLanguages)}`
        : `${this.t("product.languages", "Languages")}: ${this.formatGuideLanguages(this.getDefaultGuideLanguages())}`
    ].filter(Boolean);

    target.innerHTML = highlights.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("");
  }

  renderItinerary(items) {
    const target = document.getElementById("productItinerary");
    const packageOptions = document.getElementById("packageOptions");

    if (packageOptions && !this.isPackage(this.product)) {
      packageOptions.hidden = true;
      packageOptions.innerHTML = "";
    }

    if (!target) return;

    if (!items.length) {
      target.innerHTML = `<p>${this.escapeHtml(this.t("product.itineraryPending", "Your detailed itinerary will be coordinated for your travel dates."))}</p>`;
      return;
    }

    const isSingleDayTour =
      !this.isPackage(this.product) &&
      Number(this.product?.days || this.product?.raw?.days || 1) <= 1 &&
      !items.some((item) => Number(item?.day || 1) > 1);

    if (isSingleDayTour) {
      const dayLabel = `${this.t("product.day", "Day")} 1`;
      const dateLabel = this.getItineraryDateLabel(1);
      target.innerHTML = `
        <div class="experience-itinerary-item experience-itinerary-item--day" data-itinerary-day="1">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">${this.escapeHtml(dayLabel)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="1" ${dateLabel ? "" : "hidden"}>${this.escapeHtml(dateLabel)}</span>
            </div>
            <h3 class="experience-itinerary-day-title">${this.escapeHtml(this.t("product.fullDayItinerary", "Detailed day itinerary"))}</h3>
            ${items.map((item, index) => `
              <p>
                <strong>${this.escapeHtml(item.title || `${this.t("product.step", "Step")} ${index + 1}`)}</strong>
                ${item.description ? `<br>${this.escapeHtml(item.description)}` : ""}
              </p>
            `).join("")}
          </div>
        </div>
      `;
      return;
    }

    target.innerHTML = items.map((item, index) => {
      const dayNumber = Number(item?.day || index + 1);
      const dayLabel = `${this.t("product.day", "Day")} ${dayNumber}`;
      const dateLabel = this.getItineraryDateLabel(dayNumber);
      const title = item.title || `${this.t("product.step", "Step")} ${index + 1}`;
      const images = this.shouldShowTourItineraryImages()
        ? this.collectItineraryItemImages(item).slice(0, 1)
        : [];

      return `
        <div class="experience-itinerary-item ${images.length ? "experience-itinerary-item--visual" : ""}" data-itinerary-day="${this.escapeHtml(dayNumber)}">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">${this.escapeHtml(dayLabel)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="${this.escapeHtml(dayNumber)}" ${dateLabel ? "" : "hidden"}>${this.escapeHtml(dateLabel)}</span>
            </div>
            <h3 class="experience-itinerary-day-title">${this.escapeHtml(title)}</h3>
            <p>${this.escapeHtml(item.description || "")}</p>
          </div>
          ${this.renderItineraryMedia(images, title)}
        </div>
      `;
    }).join("");
  }

  getItineraryDateLabel(dayNumber) {
    if (!this.date) return "";

    const start = new Date(`${this.date}T00:00:00`);
    if (Number.isNaN(start.getTime())) return "";

    const date = new Date(start);
    date.setDate(start.getDate() + Math.max(Number(dayNumber || 1) - 1, 0));

    return date.toLocaleDateString(mctLocaleDateTag(), {
      day: "numeric",
      month: "long"
    });
  }

  refreshItineraryDates() {
    document.querySelectorAll("[data-itinerary-date-for]").forEach((el) => {
      const day = Number(el.dataset.itineraryDateFor || 1);
      const label = this.getItineraryDateLabel(day);
      el.textContent = label;
      el.hidden = !label;
    });
  }

  shouldShowTourItineraryImages() {
    // Oculto por ahora para tours sueltos. Para reactivarlas más adelante, cambia esta función a true
    // o agrega una bandera por producto, por ejemplo: product.showItineraryImages = true.
    return Boolean(this.product?.showItineraryImages === true || this.product?.raw?.showItineraryImages === true);
  }

  getItineraryImageSourceNotes() {
    return "Las imágenes del itinerario se toman desde cada item del JSON: itinerary[].image, itinerary[].images, itinerary[].media.image o itinerary[].media.images. En paquetes dinámicos también se usan images.cover o image del tour relacionado.";
  }

  renderFaq(items) {
    const target = document.getElementById("productFaq");

    if (!target) return;

    if (!items.length) {
      target.innerHTML = `<p>${this.escapeHtml(this.t("product.faqPending", "Frequently asked questions will be added soon."))}</p>`;
      return;
    }

    target.innerHTML = items.map((item) => `
      <details class="experience-faq-item">
        <summary>${this.escapeHtml(item.q || item.question || this.t("product.question", "Question"))}</summary>
        <p>${this.escapeHtml(item.a || item.answer || "")}</p>
      </details>
    `).join("");
  }

  renderExtras(extras) {
    const section = document.getElementById("extrasSection");
    const container = document.getElementById("extrasContainer");

    if (!section || !container) return;

    if (!extras.length) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }

    section.hidden = false;

    container.innerHTML = extras.map((extra) => {
      const extraPrice = `${this.product.currency || "USD"} ${this.formatMoney(extra.price || extra.publishedPriceUSD || extra.publishedPricing?.amount || 0)}`;

      return `
        <label class="booking-extra-item" for="extra-${this.escapeHtml(extra.code)}">
          <input type="checkbox" id="extra-${this.escapeHtml(extra.code)}" data-extra-code="${this.escapeHtml(extra.code)}" />
          <div class="booking-extra-text">
            <strong>${this.escapeHtml(extra.label)}</strong>
            <small>${extra.perPerson ? this.t("product.pricePerPerson", "Price per person") : this.t("product.pricePerBooking", "Price per booking")} · ${extraPrice}</small>
          </div>
        </label>
      `;
    }).join("");

    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const code = checkbox.dataset.extraCode;

        if (checkbox.checked) {
          this.selectedExtras.add(code);
        } else {
          this.selectedExtras.delete(code);
        }

        this.updatePricing();
      });
    });
  }

  getRequestedPackageOptionIndex() {
    const value = this.params.get("option") || this.params.get("opcion") || "";
    const index = Number(value);

    if (!Number.isInteger(index) || index < 0) return 0;
    return index;
  }

  getValidPackageOptionIndex(index) {
    const requested = Number(index || 0);

    if (!Array.isArray(this.packageOptions) || !this.packageOptions.length) return 0;
    if (!Number.isInteger(requested) || requested < 0) return 0;
    if (requested >= this.packageOptions.length) return 0;

    return requested;
  }

  getProductStartTimes(product) {
    const rawTimes = [
      ...(Array.isArray(product?.operationalSchedule?.startTimes) ? product.operationalSchedule.startTimes : []),
      ...(Array.isArray(product?.operation?.startTimes) ? product.operation.startTimes : [])
    ];

    return Array.from(new Set(rawTimes.map((time) => String(time || "").trim()).filter(Boolean)));
  }

  renderDepartureTimeOptions(product) {
    const section = document.getElementById("departureTimeSection");
    const select = document.getElementById("departureTimeSelect");
    const fixed = document.getElementById("departureTimeFixed");
    const help = document.getElementById("departureTimeHelp");

    if (!section || !select || !fixed) return;

    const times = this.getProductStartTimes(product);

    section.hidden = true;
    select.hidden = true;
    select.disabled = false;
    select.style.display = "none";
    fixed.hidden = true;
    fixed.style.display = "none";
    select.innerHTML = "";
    fixed.textContent = "";
    if (help) help.textContent = "";
    this.selectedDepartureTime = "";

    // Los paquetes no muestran horario de salida general; el horario se resuelve por itinerario.
    if (this.isPackage(product)) {
      return;
    }

    if (!times.length) {
      return;
    }

    section.hidden = false;
    select.hidden = false;
    select.style.display = "";

    if (times.length === 1) {
      this.selectedDepartureTime = times[0];
      select.disabled = true;
      select.innerHTML = `<option value="${this.escapeHtml(times[0])}" selected>${this.escapeHtml(this.t("product.departureAt", "Departure {time}", { time: times[0] }))}</option>`;
      fixed.hidden = true;
      fixed.style.display = "none";
      if (help) help.textContent = this.t("product.departureTimeFixed", "This tour has a fixed departure time.");
      return;
    }

    select.disabled = false;
    select.innerHTML = `
      <option value="">${this.escapeHtml(this.t("product.selectDepartureTime", "Select a departure time"))}</option>
      ${times.map((time) => `<option value="${this.escapeHtml(time)}">${this.escapeHtml(time)}</option>`).join("")}
    `;

    if (help) {
      help.textContent = this.t("product.departureTimeHelp", "Choose your preferred time. The reservations team will review the final availability.");
    }
  }

  getSelectedDepartureTimeLabel() {
    if (this.selectedDepartureTime) return this.selectedDepartureTime;

    const times = this.getProductStartTimes(this.product);
    if (times.length === 1) return times[0];
    if (times.length > 1) return this.t("product.pendingSelection", "Pending selection");

    return this.t("product.notApplicable", "Not applicable");
  }

  isPeruPackage(product) {
    if (!product) return false;
    return String(product.productFamily || "").toLowerCase() === "peru-package";
  }

  getTourTitleByCode(code) {
    const clean = String(code || "").trim();
    if (!clean) return "";

    const match = (this.tours || []).find((item) => {
      return item?.internalCode === clean || item?.id === clean || item?.slug === clean;
    });

    return match?.title || clean;
  }

  renderPeruPackageFallback(product) {
    const packageOptionsTarget = document.getElementById("packageOptions");
    const itineraryTarget = document.getElementById("productItinerary");
    const paypalButton = document.getElementById("paypalButton");

    if (packageOptionsTarget) packageOptionsTarget.innerHTML = "";
    if (paypalButton) paypalButton.textContent = this.t("product.requestQuote", "Request a quote");

    if (!itineraryTarget) return;

    const search = product?.search || {};
    const destinations = Array.isArray(search.destinations) ? search.destinations : [];
    const tourCodes = Array.isArray(search.includedTourCodes) ? search.includedTourCodes : [];
    const themes = Array.isArray(search.themes) ? search.themes : [];

    const destinationLabels = destinations
      .filter((destination) => destination && destination !== "peru")
      .map((destination) => this.getDestinationLabel(destination));

    const tourTitles = tourCodes.map((code) => this.getTourTitleByCode(code));

    itineraryTarget.innerHTML = `
      <div class="experience-itinerary-item">
        <h3>${this.t("product.routeSuggested", "Suggested route")}</h3>
        <p>${this.escapeHtml(product.shortDescription || product.description || this.t("product.multidestinationPackage", "Multi-destination package prepared for a personalized quote."))}</p>
      </div>

      <div class="experience-itinerary-item">
        <h3>${this.escapeHtml(this.t("product.includedDestinations", "Included destinations"))}</h3>
        <p>${this.escapeHtml(destinationLabels.length ? destinationLabels.join(" / ") : product.location || "Peru")}</p>
      </div>

      <div class="experience-itinerary-item">
        <h3>${this.escapeHtml(this.t("product.mainExperiences", "Main experiences"))}</h3>
        ${tourTitles.length
          ? `<ul>${tourTitles.map((title) => `<li>${this.escapeHtml(title)}</li>`).join("")}</ul>`
          : `<p>${this.escapeHtml(this.t("product.mainExperiencesPending", "Main experiences are adjusted according to the selected route."))}</p>`}
      </div>

      <div class="experience-itinerary-item">
        <h3>${this.escapeHtml(this.t("product.configurableHotels", "Configurable hotels"))}</h3>
        <p>${this.escapeHtml(this.t("product.configurableHotelsText", "Accommodation can be adjusted by destination, category and availability. The final proposal is reviewed through a personalized quote."))}</p>
      </div>

      <div class="experience-itinerary-item">
        <h3>${this.escapeHtml(this.t("product.requestQuote", "Request a quote"))}</h3>
        <p>${this.escapeHtml(this.t("product.customQuoteText", "Our team can prepare the final route according to your dates, hotels, internal flights and travel preferences."))}</p>
        ${themes.length ? `<p><small>${this.escapeHtml(this.t("product.travelStyle", "Travel style"))}: ${this.escapeHtml(themes.join(" · "))}</small></p>` : ""}
      </div>
    `;
  }

  renderTrainSelectionOptions(product) {
    this.resetTrainSelectionState();

    const section = this.ensureTrainSelectionSection();
    const container = document.getElementById("trainSelectionContainer");

    if (!section || !container) return;

    section.hidden = true;
    container.innerHTML = "";

    if (!this.isTrainSelectionEnabled(product)) return;

    const trainCatalog = this.getTrainCatalog();
    const defaultSelection = this.getDefaultTrainSelection(product);
    const trainConfig = this.getTrainConfig(product);
    const sameCompanyOnly = this.shouldKeepSameTrainCompany(trainConfig);

    this.availableOutboundTrains = this.getDirectionalTrains(trainCatalog, "outbound", defaultSelection.outboundTrainId);
    this.availableReturnTrains = this.getDirectionalTrains(trainCatalog, "return", defaultSelection.returnTrainId);

    const fallbackOutbound = this.createFallbackTrainOption(defaultSelection.outboundTrainId, this.t("product.trainOutboundIncluded", "Tren de ida incluido"));
    const fallbackReturn = this.createFallbackTrainOption(defaultSelection.returnTrainId, this.t("product.trainReturnIncluded", "Tren de retorno incluido"));

    if (!this.availableOutboundTrains.length && fallbackOutbound) this.availableOutboundTrains = [fallbackOutbound];
    if (!this.availableReturnTrains.length && fallbackReturn) this.availableReturnTrains = [fallbackReturn];
    if (!this.availableOutboundTrains.length && !this.availableReturnTrains.length) return;

    this.selectedOutboundTrainId = defaultSelection.outboundTrainId || this.availableOutboundTrains[0]?.id || "";
    this.selectedReturnTrainId = defaultSelection.returnTrainId || this.getCompatibleReturnTrains(sameCompanyOnly)[0]?.id || this.availableReturnTrains[0]?.id || "";

    section.hidden = false;
    container.innerHTML = `
      <div class="booking-train-selection" data-train-selection>
        <div class="booking-train-selection__intro">
          <strong>${this.escapeHtml(this.t("product.touristTrain", "Tren turístico"))}</strong>
          <small>${this.escapeHtml(this.getTrainSelectionIntro(product, trainConfig))}</small>
        </div>
        ${this.availableOutboundTrains.length ? `
          <label class="booking-train-select-field" for="outboundTrainSelect">
            <span>${this.escapeHtml(this.t("booking.train.outbound", "Tren de ida"))}</span>
            <select id="outboundTrainSelect" data-train-direction="outbound" ${this.isTrainDirectionLocked("outbound", trainConfig) ? "disabled" : ""}>
              ${this.availableOutboundTrains.map((train) => this.renderTrainOption(train, this.selectedOutboundTrainId)).join("")}
            </select>
            ${this.isTrainDirectionLocked("outbound", trainConfig) ? `<small class="booking-field-help">${this.escapeHtml(this.t("product.trainOutboundFixedNote", "Tren de ida fijo para esta versión."))}</small>` : ""}
          </label>
        ` : ""}
        ${this.availableReturnTrains.length ? `
          <label class="booking-train-select-field" for="returnTrainSelect">
            <span>${this.escapeHtml(this.t("booking.train.return", "Tren de retorno"))}</span>
            <select id="returnTrainSelect" data-train-direction="return" ${this.isTrainDirectionLocked("return", trainConfig) ? "disabled" : ""}>
              ${this.getCompatibleReturnTrains(sameCompanyOnly).map((train) => this.renderTrainOption(train, this.selectedReturnTrainId)).join("")}
            </select>
            ${this.isTrainDirectionLocked("return", trainConfig) ? `<small class="booking-field-help">${this.escapeHtml(this.t("product.trainReturnFixedNote", "Tren de retorno fijo para esta versión."))}</small>` : ""}
          </label>
        ` : ""}
        <div id="trainSelectionSummary" class="booking-train-selection__summary"></div>
      </div>
    `;

    this.bindTrainSelectionEvents(sameCompanyOnly);
    this.updateTrainSelectionState(sameCompanyOnly);
  }

  ensureTrainSelectionSection() {
    let section = document.getElementById("trainSelectionSection");
    if (section) return section;

    const reference = document.getElementById("departureTimeSection") || document.getElementById("serviceModeSection") || document.getElementById("packageAccommodationSection");
    if (!reference || !reference.parentNode) return null;

    section = document.createElement("div");
    section.id = "trainSelectionSection";
    section.className = "booking-field";
    section.hidden = true;
    section.innerHTML = `<label>${this.escapeHtml(this.t("product.touristTrain", "Tren turístico"))}</label><div id="trainSelectionContainer" class="booking-train-selection-wrap"></div>`;
    reference.parentNode.insertBefore(section, reference.nextSibling);
    return section;
  }

  resetTrainSelectionState() {
    this.selectedOutboundTrainId = "";
    this.selectedReturnTrainId = "";
    this.selectedTrainAdjustmentTotal = 0;
    this.availableOutboundTrains = [];
    this.availableReturnTrains = [];
  }

  isTrainSelectionEnabled(product) {
    if (!product || this.isPackage(product)) return false;
    const config = this.getTrainConfig(product);
    return Boolean(config.required === true && config.fixedSelection !== true || config.customerCanChangeTrain === true || config.fixedDirection || config.fixedDirections);
  }

  getTrainConfig(product) {
    return product?.trainSelection || product?.raw?.trainSelection || {};
  }

  getDefaultTrainSelection(product) {
    const source = product?.defaultTrainSelection || product?.raw?.defaultTrainSelection || this.getTrainConfig(product)?.defaultTrainSelection || this.getTrainConfig(product)?.defaultSelection || {};
    const defaultCodes = this.getTrainConfig(product)?.defaultTrainCodes || {};
    const outboundTrainId = String(source.outboundTrainId || source.outboundTrainCode || source.outbound || source.outboundCode || source.departureTrainId || source.departureTrainCode || source.goingTrainId || source.goingTrainCode || source.trainOut || defaultCodes.outbound || "").trim();
    const returnTrainId = String(source.returnTrainId || source.returnTrainCode || source.return || source.returnCode || source.inboundTrainId || source.inboundTrainCode || source.backTrainId || source.backTrainCode || source.trainReturn || defaultCodes.return || "").trim();
    return { outboundTrainId, returnTrainId };
  }

  getTrainCatalog() {
    const raw = this.allData?.data?.trains || this.allData?.trains || window.MyCuscoTripTrains || [];
    const flattened = [];

    const visit = (value, parent = {}) => {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach((item) => visit(item, parent)); return; }
      if (typeof value !== "object") return;

      const looksLikeTrain = Boolean(value.id || value.code || value.trainCode || value.serviceCode || value.name || value.label || value.serviceName) && Boolean(value.departureTime || value.arrivalTime || value.direction || value.route || value.price || value.priceUSD || value.publishedPricing);
      if (looksLikeTrain) flattened.push(this.normalizeTrainOption({ ...parent, ...value }));

      Object.entries(value).forEach(([key, child]) => {
        if (["trains", "services", "items", "options", "outbound", "return", "inbound", "companies"].includes(key)) {
          visit(child, {
            company: value.company || value.companyCode || value.operator || parent.company || value.name || parent.name,
            direction: key === "outbound" ? "outbound" : key === "return" || key === "inbound" ? "return" : parent.direction
          });
        }
      });
    };

    visit(raw);

    const deduped = [];
    const seen = new Set();
    flattened.forEach((train) => { if (train.id && !seen.has(train.id)) { seen.add(train.id); deduped.push(train); } });
    return deduped;
  }

  normalizeTrainOption(raw) {
    const id = String(raw.id || raw.code || raw.trainCode || raw.serviceCode || raw.slug || raw.name || "").trim();
    const company = String(raw.company || raw.companyCode || raw.operator || raw.operatorKey || raw.railCompany || "").trim().toLowerCase();
    const companyName = String(raw.companyName || raw.operatorName || raw.companyLabel || company || "").trim();
    const category = String(raw.category || raw.trainCategory || raw.serviceCategory || "").trim().toLowerCase();
    const label = String(raw.label || raw.name || raw.serviceName || raw.trainName || id || this.t("product.touristTrain", "Tren turístico")).trim();
    const rawDirection = String(raw.direction || raw.operationalUse?.direction || raw.routeDirection || raw.type || "").toLowerCase();
    const direction = rawDirection === "inbound" ? "return" : rawDirection;
    const route = String(raw.route || raw.segment || raw.path || "").trim();
    const departureTime = String(raw.departureTime || raw.departure || raw.startTime || raw.time || "").trim();
    const arrivalTime = String(raw.arrivalTime || raw.arrival || raw.endTime || "").trim();
    const price = Number(raw.priceUSD ?? raw.publishedPriceUSD ?? raw.price?.adult ?? raw.price?.amount ?? raw.pricing?.amount ?? raw.publishedPricing?.amount ?? raw.additionalPriceUSD ?? 0);
    const isLocalTrain = Boolean(raw.isLocalTrain || company === "local" || category === "local");
    return { id, company, companyName, category, label, direction, route, departureTime, arrivalTime, price, isLocalTrain, raw };
  }

  getDirectionalTrains(catalog, direction, defaultId = "") {
    const normalizedDirection = String(direction || "").toLowerCase();
    const trainConfig = this.getTrainConfig(this.product);
    const filtered = catalog.filter((train) => {
      const trainDirection = String(train.direction || "").toLowerCase();
      const route = String(train.route || "").toLowerCase();
      const id = String(train.id || "").toLowerCase();
      const matchesDirection = normalizedDirection === "outbound"
        ? trainDirection.includes("out") || trainDirection.includes("ida") || trainDirection.includes("going") || id.includes("out") || id.includes("ida") || route.endsWith("mapi")
        : trainDirection.includes("return") || trainDirection.includes("inbound") || trainDirection.includes("retorno") || trainDirection.includes("vuelta") || id.includes("return") || id.includes("ret") || route.startsWith("mapi");
      return matchesDirection && this.isTrainAllowedForDirection(train, normalizedDirection, trainConfig);
    });

    const defaultTrain = defaultId ? catalog.find((train) => train.id === defaultId && this.isTrainAllowedForDirection(train, normalizedDirection, trainConfig, true)) : null;
    const sorted = this.sortTrainOptions(filtered, normalizedDirection, trainConfig);
    return defaultTrain ? [defaultTrain, ...sorted.filter((train) => train.id !== defaultId)] : sorted;
  }

  isTrainAllowedForDirection(train, direction, config, allowDefault = false) {
    if (!train) return false;
    const defaultCodes = config?.defaultTrainCodes || {};
    const fixedDirection = this.isTrainDirectionLocked(direction, config);
    const defaultId = direction === "outbound" ? defaultCodes.outbound : defaultCodes.return;

    if (fixedDirection) return train.id === defaultId || allowDefault;

    const allowedTrainCodes = config?.allowedTrainCodes?.[direction] || config?.allowedTrainCodes?.[direction === "return" ? "inbound" : direction];
    if (allowedTrainCodes && !this.isAllowedByList(train.id, allowedTrainCodes)) return false;

    if (!this.isAllowedByList(train.company, config?.allowedCompanies)) return false;
    const allowedRoutes = config?.allowedRoutes?.[direction] || config?.allowedRoutes?.[direction === "return" ? "inbound" : direction];
    if (!this.isAllowedByList(train.route, allowedRoutes)) return false;

    const allowedCategories = config?.allowedCategories;
    const directionCategories = allowedCategories && typeof allowedCategories === "object" && !Array.isArray(allowedCategories)
      ? allowedCategories[direction] || allowedCategories[direction === "return" ? "inbound" : direction]
      : allowedCategories;
    if (directionCategories !== "all_available" && !this.isAllowedByList(train.category, directionCategories)) return false;

    const windowRule = config?.timeWindows?.[direction] || config?.timeWindows?.[direction === "return" ? "inbound" : direction];
    if (windowRule && !this.isTrainInsideTimeWindow(train, windowRule)) return false;

    return true;
  }

  isAllowedByList(value, allowed) {
    if (!allowed || allowed === "all_available") return true;
    const list = Array.isArray(allowed) ? allowed : [allowed];
    return list.map((item) => String(item || "").toLowerCase()).includes(String(value || "").toLowerCase());
  }

  isTrainInsideTimeWindow(train, rule) {
    const minutes = this.timeToMinutes(train?.departureTime);
    if (!Number.isFinite(minutes)) return true;
    const min = this.timeToMinutes(rule?.min || rule?.from || rule?.after || "");
    const max = this.timeToMinutes(rule?.max || rule?.to || rule?.before || "");
    if (Number.isFinite(min) && minutes < min) return false;
    if (Number.isFinite(max) && minutes > max) return false;
    return true;
  }

  timeToMinutes(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
    if (!match) return NaN;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  sortTrainOptions(list, direction, config) {
    const sorted = [...list].sort((a, b) => {
      const aMinutes = this.timeToMinutes(a.departureTime);
      const bMinutes = this.timeToMinutes(b.departureTime);
      return (Number.isFinite(aMinutes) ? aMinutes : 9999) - (Number.isFinite(bMinutes) ? bMinutes : 9999);
    });

    const max = config?.maxOptions?.[direction] || config?.maxOptions?.[direction === "return" ? "inbound" : direction];
    return max ? sorted.slice(0, Number(max)) : sorted;
  }

  shouldKeepSameTrainCompany(config) {
    if (!config) return false;
    return Boolean(config.sameCompanyRoundTrip === true || String(config.mode || "").toLowerCase().includes("same_company") || config.returnOptionsRule === "same_company_as_outbound");
  }

  isTrainDirectionLocked(direction, config) {
    const key = direction === "return" ? "return" : "outbound";
    if (config?.fixedSelection === true) return true;
    if (config?.fixedDirection === key) return true;
    if (Array.isArray(config?.fixedDirections)) return config.fixedDirections.includes(key);
    return false;
  }

  getTrainSelectionIntro(product, config) {
    if (config?.fixedSelection === true) return this.t("product.trainConfigFixedNote", "Esta versión ya tiene trenes definidos para mantener el horario operativo.");
    if (config?.fixedDirection === "outbound" || config?.fixedDirections?.includes?.("outbound")) return this.t("product.trainConfigOutboundFixedNote", "El tren de ida está definido por la categoría del producto. Puedes elegir el retorno disponible según la operación.");
    return this.t("product.trainConfigFlexibleNote", "Elige los servicios de tren disponibles para esta versión. La diferencia de precio se calculará según el tren seleccionado.");
  }

  createFallbackTrainOption(id, label) {
    if (!id) return null;
    return { id, company: "", label, direction: "", route: "", departureTime: "", arrivalTime: "", price: 0, raw: {} };
  }

  renderTrainOption(train, selectedId) {
    const selected = train.id === selectedId ? " selected" : "";
    const meta = [train.company, train.departureTime, train.arrivalTime ? `${this.t("product.arrivesShort", "llega")} ${train.arrivalTime}` : ""].filter(Boolean).join(" · ");
    const price = train.price > 0 ? ` · USD ${this.formatMoney(train.price)}` : "";
    return `<option value="${this.escapeHtml(train.id)}"${selected}>${this.escapeHtml(train.label)}${meta ? ` · ${this.escapeHtml(meta)}` : ""}${price}</option>`;
  }

  bindTrainSelectionEvents(sameCompanyOnly) {
    const outbound = document.getElementById("outboundTrainSelect");
    const returning = document.getElementById("returnTrainSelect");
    outbound?.addEventListener("change", () => { this.selectedOutboundTrainId = outbound.value || ""; this.refreshReturnTrainOptions(sameCompanyOnly); this.updateTrainSelectionState(sameCompanyOnly); this.updatePricing(); });
    returning?.addEventListener("change", () => { this.selectedReturnTrainId = returning.value || ""; this.updateTrainSelectionState(sameCompanyOnly); this.updatePricing(); });
  }

  refreshReturnTrainOptions(sameCompanyOnly) {
    const returning = document.getElementById("returnTrainSelect");
    if (!returning) return;
    const compatible = this.getCompatibleReturnTrains(sameCompanyOnly);
    if (!compatible.find((train) => train.id === this.selectedReturnTrainId)) this.selectedReturnTrainId = compatible[0]?.id || "";
    returning.innerHTML = compatible.map((train) => this.renderTrainOption(train, this.selectedReturnTrainId)).join("");
    returning.value = this.selectedReturnTrainId;
  }

  getCompatibleReturnTrains(sameCompanyOnly) {
    const outbound = this.getSelectedOutboundTrain();
    const config = this.getTrainConfig(this.product);
    let compatible = this.availableReturnTrains.filter((train) => this.isReturnTrainCompatible(outbound, train, sameCompanyOnly, config));
    if (!compatible.length) compatible = [...this.availableReturnTrains];
    return this.sortTrainOptions(compatible, "return", config);
  }

  isReturnTrainCompatible(outbound, returning, sameCompanyOnly, config = {}) {
    if (!returning) return false;
    if (this.isTrainDirectionLocked("return", config)) return true;
    if (!outbound) return true;
    if (outbound.isLocalTrain || returning.isLocalTrain) return true;
    if (sameCompanyOnly && outbound.company && returning.company && outbound.company !== returning.company) return false;

    const mode = String(this.product?.tripMode || this.product?.machuPicchuMode || "").toLowerCase();
    const outboundArrival = this.timeToMinutes(outbound.arrivalTime);
    const returnDeparture = this.timeToMinutes(returning.departureTime);
    if (mode.includes("full") && Number.isFinite(outboundArrival) && Number.isFinite(returnDeparture)) {
      return returnDeparture - outboundArrival >= 360;
    }
    if (mode.includes("overnight") && Number.isFinite(returnDeparture)) {
      return returnDeparture >= 12 * 60;
    }
    return true;
  }

  updateTrainSelectionState(sameCompanyOnly) {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    const defaultSelection = this.getDefaultTrainSelection(this.product);
    const defaultOutbound = this.findTrainById(defaultSelection.outboundTrainId, this.availableOutboundTrains);
    const defaultReturn = this.findTrainById(defaultSelection.returnTrainId, this.availableReturnTrains);
    const outboundDiff = outbound && defaultOutbound ? Number(outbound.price || 0) - Number(defaultOutbound.price || 0) : 0;
    const returnDiff = returning && defaultReturn ? Number(returning.price || 0) - Number(defaultReturn.price || 0) : 0;
    this.selectedTrainAdjustmentTotal = Math.max(0, outboundDiff + returnDiff) * this.getTotalPassengers();

    const summary = document.getElementById("trainSelectionSummary");
    if (!summary) return;
    const companyNote = sameCompanyOnly ? this.t("product.sameCompanyNote", "Los trenes de ida y retorno se mantienen con la misma compañía cuando hay disponibilidad.") : "";
    const adjustmentText = this.selectedTrainAdjustmentTotal > 0
      ? `${this.t("product.totalDifference", "Diferencia total")}: ${this.product?.currency || "USD"} ${this.formatMoney(this.selectedTrainAdjustmentTotal)}`
      : this.t("product.noAdditionalDifference", "Sin diferencia adicional frente al tren incluido.");
    summary.innerHTML = `<small>${this.escapeHtml(this.getSelectedTrainSummaryLabel())}</small><strong>${this.escapeHtml(adjustmentText)}</strong>${companyNote ? `<small>${this.escapeHtml(companyNote)}</small>` : ""}`;
  }

  findTrainById(id, list) {
    if (!id) return null;
    return (list || []).find((train) => train.id === id) || null;
  }

  getSelectedOutboundTrain() { return this.findTrainById(this.selectedOutboundTrainId, this.availableOutboundTrains); }
  getSelectedReturnTrain() { return this.findTrainById(this.selectedReturnTrainId, this.availableReturnTrains); }
  calculateSelectedTrainAdjustmentTotal() {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    const defaultSelection = this.getDefaultTrainSelection(this.product);
    const defaultOutbound = this.findTrainById(defaultSelection.outboundTrainId, this.availableOutboundTrains);
    const defaultReturn = this.findTrainById(defaultSelection.returnTrainId, this.availableReturnTrains);
    const outboundDiff = outbound && defaultOutbound ? Number(outbound.price || 0) - Number(defaultOutbound.price || 0) : 0;
    const returnDiff = returning && defaultReturn ? Number(returning.price || 0) - Number(defaultReturn.price || 0) : 0;
    const total = Math.max(0, outboundDiff + returnDiff) * this.getTotalPassengers();
    this.selectedTrainAdjustmentTotal = total;
    return total;
  }

  updateTrainAdjustmentSummaryRow(amount, currency) {
    let row = document.getElementById("trainAdjustmentTotalRow");
    const serviceTotalRow = document.getElementById("serviceTotalRow");
    const summary = serviceTotalRow?.parentNode;
    if (!summary) return;
    if (!row) {
      row = document.createElement("div");
      row.id = "trainAdjustmentTotalRow";
      row.className = "booking-summary__line";
      row.innerHTML = `<span>${this.escapeHtml(this.t("product.selectedTrainLabel", "Tren seleccionado"))}</span><strong id="trainAdjustmentTotal">${this.escapeHtml(currency)} 0.00</strong>`;
      summary.insertBefore(row, serviceTotalRow);
    }
    row.hidden = !(amount > 0);
    const value = document.getElementById("trainAdjustmentTotal");
    if (value) value.textContent = `${currency} ${this.formatMoney(amount)}`;
  }

  getSelectedTrainSummaryLabel() {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    if (!outbound && !returning) return this.t("booking.notApplicable", "No aplica");
    const parts = [];
    if (outbound) parts.push(`${this.t("product.outboundShort", "Ida")}: ${outbound.label}`);
    if (returning) parts.push(`${this.t("product.returnShort", "Retorno")}: ${returning.label}`);
    return parts.join(" | ");
  }

  collectItineraryItemImages(item) {
    const images = [];
    if (item?.image) images.push(item.image);
    if (Array.isArray(item?.images)) images.push(...item.images);
    if (item?.media?.image) images.push(item.media.image);
    if (Array.isArray(item?.media?.images)) images.push(...item.media.images);

    const transferText = `${item?.title || ""} ${item?.description || ""} ${item?.code || ""} ${item?.tourCode || ""}`.toLowerCase();
    if (!images.length && /(transfer|traslado|recojo|aeropuerto|arrival_transfer|departure_transfer)/i.test(transferText)) {
      images.push("assets/img/quote/fallbacks/recojo-aeropuerto-cusco.jpg");
    }

    return this.uniqueImageList(images);
  }

  collectDynamicDayImages(day) {
    const images = [];
    (day?.items || []).forEach((item) => {
      images.push(...this.collectItineraryItemImages(item));
      const tour = this.findTourForItineraryItem(item);
      if (tour?.images?.cover) images.push(tour.images.cover);
      if (tour?.image) images.push(tour.image);
    });
    return this.uniqueImageList(images);
  }

  findTourForItineraryItem(item) {
    const candidates = [item?.internalCode, item?.code, item?.tourCode, item?.sourceTourCode, item?.slug].map((value) => String(value || "").trim()).filter(Boolean);
    if (Array.isArray(item?.includedTourCodes)) candidates.push(...item.includedTourCodes.map((value) => String(value || "").trim()).filter(Boolean));
    const title = this.normalizeForMatching(item?.title || "");
    return (this.tours || []).find((tour) => {
      if (!tour) return false;
      if (candidates.some((value) => value && (tour.internalCode === value || tour.id === value || tour.slug === value))) return true;
      const tourTitle = this.normalizeForMatching(tour.title || "");
      return Boolean(title && tourTitle && (title.includes(tourTitle) || tourTitle.includes(title)));
    }) || null;
  }

  renderItineraryMedia(images, altPrefix = "Itinerario") {
    const finalImages = this.uniqueImageList(images).slice(0, 2);
    if (!finalImages.length) return "";
    return `<div class="experience-itinerary-media experience-itinerary-media--${finalImages.length}">${finalImages.map((src, index) => `<img src="${this.resolveAssetPath(src)}" alt="${this.escapeHtml(`${altPrefix} imagen ${index + 1}`)}" loading="lazy" />`).join("")}</div>`;
  }

  uniqueImageList(images) {
    return Array.from(new Set((images || []).map((src) => String(src || "").trim()).filter(Boolean)));
  }

  getSearchArray(product, key) {
    const direct = product?.search?.[key];
    const raw = product?.raw?.search?.[key];
    const value = Array.isArray(direct) ? direct : Array.isArray(raw) ? raw : [];
    return value.map((item) => this.normalizeForMatching(item)).filter(Boolean);
  }

  countIntersection(a, b) {
    const set = new Set(a || []);
    return (b || []).filter((item) => set.has(item)).length;
  }

  normalizeForMatching(value) {
    return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  renderServiceModes(product) {
    const section = document.getElementById("serviceModeSection");
    const select = document.getElementById("serviceMode");
    const help = document.getElementById("serviceModeHelp");

    if (!section || !select) return;

    const modes = product?.serviceModes || {};
    const groupEnabled = Boolean(modes.group?.enabled);
    const privateEnabled = Boolean(modes.private?.enabled);

    if (!groupEnabled && !privateEnabled) {
      section.hidden = true;
      return;
    }

    section.hidden = false;

    select.innerHTML = `
      ${groupEnabled ? `<option value="group">${this.escapeHtml(modes.group?.label || this.t("product.groupTour", "Tour en grupo"))}</option>` : ""}
      ${privateEnabled ? `<option value="private">${this.escapeHtml(modes.private?.label || this.t("product.privateTour", "Tour privado"))}</option>` : ""}
    `;

    this.serviceMode = groupEnabled ? "group" : "private";

    if (help) {
      help.textContent = privateEnabled
        ? this.t("product.sharedServiceHelp", "Selecciona si deseas viajar en servicio compartido o privado.")
        : this.t("product.groupOnlyHelp", "Esta experiencia se ofrece actualmente en servicio grupal.");
    }
  }
  renderAccommodationOptions(product) {
    const section = document.getElementById("packageAccommodationSection");
    const container = document.getElementById("hotelSelectorsContainer");

    if (!section || !container) return;

    section.hidden = true;
    container.innerHTML = "";

    if (!this.isPackage(product)) return;

    const summary = this.getAccommodationSummary(product);

    if (!summary.length) return;

    section.hidden = false;

    container.innerHTML = summary.map((item) => {
      const selection = this.getSelectedAccommodationForDestination(item.destination);
      const additionalPerPerson = this.calculateAccommodationAdditionalPerPerson(item.destination);
      const destinationLabel = this.getDestinationLabel(item.destination);
      const cardTitle = this.t("product.hotelInDestination", "Hotel in {destination}", { destination: destinationLabel });
      const hasHotel = Boolean(selection?.hotel);
      const isNoHotel = selection?.hotel?.hotelCode === "no-hotel";
      const image = selection?.hotel?.images?.cover || selection?.hotel?.images?.gallery?.[0] || "";

      return `
        <div class="booking-accommodation-card ${hasHotel ? "booking-accommodation-card--selected" : ""}">
          ${hasHotel && image && !isNoHotel ? `
            <div class="booking-accommodation-card__thumb">
              <img src="${this.resolveAssetPath(image)}" alt="${this.escapeHtml(selection.hotel.hotelName)}" loading="lazy" />
            </div>
          ` : ""}

          <div class="booking-accommodation-card__header">
            <strong>${this.escapeHtml(cardTitle)}</strong>
            <small>${item.nights} ${this.t(item.nights === 1 ? "product.night" : "product.nights", item.nights === 1 ? "night" : "nights")}</small>
          </div>

          <div class="booking-accommodation-card__body">
            <p class="booking-accommodation-card__selected">
              ${selection?.hotel
                ? `${this.escapeHtml(selection.hotel.hotelName)}${selection.hotel.stars > 0 ? ` · ${this.renderStars(selection.hotel.stars)}` : ""}`
                : this.t("product.noHotelSelected", "No hotel selected")}
            </p>

            <p class="booking-accommodation-card__selected">
              ${selection?.combination
                ? this.escapeHtml(selection.combination.label)
                : this.t("product.accommodationPending", "Accommodation according to the selected category")}
            </p>

            <p class="booking-accommodation-card__price">
              + ${this.product.currency || "USD"} ${this.formatMoney(additionalPerPerson)} ${this.t("product.perPerson", "per person")}
            </p>

            <button
              type="button"
              class="btn booking-secondary-btn open-hotel-modal-btn"
              data-destination="${this.escapeHtml(item.destination)}"
            >
              ${selection?.hotel ? this.t("product.changeHotel", "Change hotel") : this.t("product.chooseHotel", "Choose hotel")}
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  bindAccommodationEvents() {
    document.querySelectorAll(".open-hotel-modal-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const destination = button.dataset.destination;
        this.openHotelModal(destination);
      });
    });
  }

  bindHotelModalEvents() {
    const modal = document.getElementById("hotelSelectionModal");
    const closeBtn = document.getElementById("closeHotelModalBtn");
    const cancelBtn = document.getElementById("cancelHotelModalBtn");

    if (!modal) return;

    closeBtn?.addEventListener("click", () => this.closeHotelModal());
    cancelBtn?.addEventListener("click", () => this.confirmHotelModalSelection());

    modal.querySelectorAll("[data-close-hotel-modal]").forEach((el) => {
      el.addEventListener("click", () => this.closeHotelModal());
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        this.closeHotelModal();
      }
    });
  }

  openHotelModal(destination) {
    const modal = document.getElementById("hotelSelectionModal");
    const title = document.getElementById("hotelModalTitle");
    const subtitle = document.getElementById("hotelModalSubtitle");
    const list = document.getElementById("hotelModalList");
    const cancelBtn = document.getElementById("cancelHotelModalBtn");

    if (!modal || !title || !subtitle || !list) return;

    this.activeHotelModalDestination = destination;

    if (cancelBtn) {
      cancelBtn.textContent = this.t("product.selectHotelRoom", "Select hotel and room");
    }

    const destinationLabel = this.getDestinationLabel(destination);
    const summaryItem = this.getAccommodationSummary(this.product).find((item) => item.destination === destination);
    const nights = Number(summaryItem?.nights || 0);

    title.textContent = this.t("product.chooseHotelInDestination", "Choose your hotel in {destination}", { destination: destinationLabel });
    subtitle.textContent = this.t("product.compareHotelsForNights", "Compare hotels, photos and room options for {nights} {nightLabel}.", { nights, nightLabel: this.t(nights === 1 ? "product.night" : "product.nights", nights === 1 ? "night" : "nights") });

    const hotels = this.getHotelsByDestination(destination);
    const passengers = this.getTotalPassengers();

    const noHotelOption = {
      hotelCode: "no-hotel",
      hotelName: this.t("product.noAccommodation", "No accommodation"),
      stars: 0,
      location: destinationLabel,
      address: "",
      images: {
        cover: "",
        gallery: []
      },
      amenities: {
        checkin: "",
        checkout: "",
        breakfast: ""
      },
      rooms: [
        {
          roomType: "no-hotel",
          label: this.t("product.noHotelOption", "Choose the option without accommodation"),
          bedType: "",
          capacity: Math.max(passengers, 1),
          pricePerNight: 0,
          helperText: this.t("product.clientChoosesAccommodation", "El cliente seleccionará su propio alojamiento.")
        }
      ]
    };

    const allHotels = [noHotelOption, ...hotels];

    const pendingHotelCode = this.selectedHotelsByDestination[destination] || "";
    const pendingCombinationKey = this.selectedCombinationsByDestination[destination]?.key || "";

    list.innerHTML = allHotels.map((hotel) => {
      const combinations = this.generateAccommodationCombinations(
        hotel.rooms || [],
        passengers,
        nights
      );

      const currentHotelCode = pendingHotelCode;
      const currentCombinationKey = pendingCombinationKey;
      const isSelectedHotel = currentHotelCode === hotel.hotelCode;

      const initialCombo =
        combinations.find((combo) => isSelectedHotel && combo.key === currentCombinationKey) ||
        combinations[0] ||
        null;

      const images = [...new Set([
        ...(hotel.images?.cover ? [hotel.images.cover] : []),
        ...(Array.isArray(hotel.images?.gallery) ? hotel.images.gallery : [])
      ])];

      return `
        <article
          class="hotel-option-card ${isSelectedHotel ? "is-selected" : ""} ${hotel.hotelCode === "no-hotel" ? "hotel-option-card--no-hotel" : ""}"
          data-hotel-card="${this.escapeHtml(hotel.hotelCode)}"
          data-destination="${this.escapeHtml(destination)}"
          data-hotel-code="${this.escapeHtml(hotel.hotelCode)}"
          data-selected-combo-key="${this.escapeHtml(initialCombo?.key || "")}"
        >
          <div class="hotel-option-card__header">
            <div>
              <h3>${this.escapeHtml(hotel.hotelName)}</h3>
              ${
                hotel.hotelCode === "no-hotel"
                  ? ""
                  : `<p>${this.renderStars(hotel.stars || 0)} · ${this.escapeHtml(hotel.location || destinationLabel)}</p>`
              }
              ${hotel.address ? `<p>${this.escapeHtml(hotel.address)}</p>` : ""}
            </div>

            <div class="hotel-option-card__badge">
              ${combinations.length
                ? `+ ${this.product.currency || "USD"} ${this.formatMoney(combinations[0].additionalPerPerson)} ${this.t("product.perPerson", "per person")}`
                : this.t("product.noValidOptions", "Sin opciones válidas")}
            </div>
          </div>

          <div class="hotel-option-card__content ${hotel.hotelCode === "no-hotel" ? "hotel-option-card__content--no-hotel" : ""}">
            ${
              hotel.hotelCode === "no-hotel"
                ? ""
                : `
                  <div class="hotel-option-card__media">
                    <div class="hotel-option-card__gallery">
                      ${this.renderHotelModalGallery(images, hotel.hotelName)}
                    </div>

                    ${this.renderHotelFeatures(hotel)}
                  </div>
                `
            }

            <div class="hotel-option-card__body ${hotel.hotelCode === "no-hotel" ? "hotel-option-card__body--no-hotel" : ""}">
              ${hotel.hotelCode === "no-hotel" ? "" : `<label>${this.t("product.selectRoomType", "Select room type")}</label>`}

              <div class="hotel-option-card__options">
                ${combinations.length
                  ? combinations.map((combo) => `
                      <button
                        type="button"
                        class="hotel-combo-btn ${isSelectedHotel && currentCombinationKey === combo.key ? "is-selected" : ""}"
                        data-destination="${this.escapeHtml(destination)}"
                        data-hotel-code="${this.escapeHtml(hotel.hotelCode)}"
                        data-combo-key="${this.escapeHtml(combo.key)}"
                      >
                        <span class="hotel-combo-radio" aria-hidden="true"></span>
                        <span class="hotel-combo-btn__main">
                          ${this.escapeHtml(combo.label)}
                        </span>
                        <span class="hotel-combo-btn__sub">
                          ${
                            hotel.hotelCode === "no-hotel"
                              ? this.t("product.clientChoosesAccommodation", "El cliente seleccionará su propio alojamiento.")
                              : `${combo.totalRooms} ${this.t(combo.totalRooms === 1 ? "product.room" : "product.rooms", combo.totalRooms === 1 ? "room" : "rooms")} | ${this.t("product.total", "Total")} + ${this.product.currency || "USD"} ${this.formatMoney(combo.additionalPerPerson)} ${this.t("product.perPerson", "per person")}`
                          }
                        </span>
                      </button>
                    `).join("")
                  : `<p>${this.t("product.noValidAccommodationForPassengers", "No valid room options for {count} {travelerLabel}.", { count: passengers, travelerLabel: this.t(passengers === 1 ? "product.traveler" : "product.travelers", passengers === 1 ? "traveler" : "travelers") })}</p>`
                }
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");

    this.bindHotelModalSelectionEvents();
    this.bindHotelModalGalleryEvents();

    modal.hidden = false;
    document.body.classList.add("hotel-modal-open");
    this.trackEvent("hotel_modal_open", {
      destination,
      destination_label: destinationLabel,
      product_id: this.product?.id || this.product?.code || this.slug,
      product_name: this.product?.title || "",
      passengers,
      nights
    });
  }

  closeHotelModal() {
    const modal = document.getElementById("hotelSelectionModal");
    const cancelBtn = document.getElementById("cancelHotelModalBtn");

    if (!modal) return;

    modal.hidden = true;
    document.body.classList.remove("hotel-modal-open");
    this.activeHotelModalDestination = null;

    if (cancelBtn) {
      cancelBtn.textContent = this.t("product.close", "Cerrar");
    }
  }

  confirmHotelModalSelection() {
    const destination = this.activeHotelModalDestination;

    if (!destination) {
      this.closeHotelModal();
      return;
    }

    const selectedButton = document.querySelector(
      `.hotel-combo-btn.is-selected[data-destination="${CSS.escape(destination)}"]`
    );

    const card =
      selectedButton?.closest(".hotel-option-card") ||
      document.querySelector(
        `.hotel-option-card[data-destination="${CSS.escape(destination)}"][data-selected-combo-key]:not([data-selected-combo-key=""])`
      );

    if (!card) {
      this.closeHotelModal();
      return;
    }

    const hotelCode = card.dataset.hotelCode;
    const comboKey = card.dataset.selectedComboKey || "";

    if (!comboKey) return;

    let hotel;

    if (hotelCode === "no-hotel") {
      hotel = {
        hotelCode: "no-hotel",
        hotelName: this.t("product.noAccommodation", "No accommodation"),
        stars: 0,
        location: this.getDestinationLabel(destination),
        address: "",
        images: {
          cover: "",
          gallery: []
        },
        amenities: {
          checkin: "",
          checkout: "",
          breakfast: ""
        },
        rooms: [
          {
            roomType: "no-hotel",
            label: this.t("product.noHotelOption", "Choose the option without accommodation"),
            bedType: "",
            capacity: Math.max(this.getTotalPassengers(), 1),
            pricePerNight: 0,
            helperText: this.t("product.clientChoosesAccommodation", "El cliente seleccionará su propio alojamiento.")
          }
        ]
      };
    } else {
      hotel = this.getHotelByCode(destination, hotelCode);
    }

    const summaryItem = this.getAccommodationSummary(this.product).find((item) => item.destination === destination);

    const combinations = this.generateAccommodationCombinations(
      hotel?.rooms || [],
      this.getTotalPassengers(),
      Number(summaryItem?.nights || 0)
    );

    const combo = combinations.find((item) => item.key === comboKey);

    if (!hotel || !combo) return;

    this.selectedHotelsByDestination[destination] = hotelCode;
    this.selectedCombinationsByDestination[destination] = combo;

    this.renderAccommodationOptions(this.product);
    this.bindAccommodationEvents();
    this.updatePricing();
    this.trackEvent("hotel_selected", {
      destination,
      hotel_code: hotel.hotelCode,
      hotel_name: hotel.hotelName,
      hotel_stars: hotel.stars || 0,
      accommodation_label: combo.label,
      accommodation_key: combo.key,
      additional_per_person: Number(combo.additionalPerPerson || 0),
      currency: this.product?.currency || "USD",
      product_id: this.product?.id || this.product?.code || this.slug,
      product_name: this.product?.title || ""
    });
    this.closeHotelModal();
  }

  translateHotelFeature(feature) {
    const value = String(feature || "").trim();
    if (!value) return "";
    const normalized = value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const map = new Map([
      ["desayuno", this.t("product.breakfastIncluded", "Breakfast included")],
      ["desayuno incluido", this.t("product.breakfastIncluded", "Breakfast included")],
      ["desayuno semi buffet", this.t("product.breakfast", "Breakfast") + ": semi-buffet"],
      ["wifi", this.t("product.wifi", "Wi-Fi")],
      ["wi-fi", this.t("product.wifi", "Wi-Fi")],
      ["agua caliente", this.t("product.hotWater", "Hot water")],
      ["toallas", this.t("product.towels", "Towels")],
      ["bano privado", this.t("product.privateBathroom", "Private bathroom")],
      ["baño privado", this.t("product.privateBathroom", "Private bathroom")],
      ["areas comunes", this.t("product.commonAreas", "Common areas")],
      ["áreas comunes", this.t("product.commonAreas", "Common areas")]
    ]);
    if (map.has(normalized)) return map.get(normalized);
    return value
      .replace(/desayuno incluido o sujeto a tarifa confirmada/ig, this.t("product.breakfastIncludedSubjectToRate", "Desayuno incluido o sujeto a tarifa confirmada"))
      .replace(/desayuno incluido/ig, this.t("product.breakfastIncluded", "Breakfast included"))
      .replace(/desayuno/ig, this.t("product.breakfast", "Breakfast"))
      .replace(/agua caliente/ig, this.t("product.hotWater", "Hot water"))
      .replace(/toallas/ig, this.t("product.towels", "Towels"))
      .replace(/baño privado/ig, this.t("product.privateBathroom", "Private bathroom"))
      .replace(/bano privado/ig, this.t("product.privateBathroom", "Private bathroom"))
      .replace(/áreas comunes/ig, this.t("product.commonAreas", "Common areas"))
      .replace(/areas comunes/ig, this.t("product.commonAreas", "Common areas"));
  }

  renderHotelFeatures(hotel) {
    const rawFeatures = Array.isArray(hotel?.features) ? hotel.features : [];
    const amenityFeatures = [
      hotel?.amenities?.breakfast ? `${this.t("product.breakfast", "Breakfast")}: ${this.translateHotelFeature(hotel.amenities.breakfast)}` : "",
      hotel?.amenities?.wifi ? this.t("product.wifi", "Wi-Fi") : "",
      hotel?.amenities?.commonAreas ? this.t("product.commonAreas", "Áreas comunes") : ""
    ];

    const preferred = [
      ...amenityFeatures,
      ...rawFeatures
    ]
      .map((item) => this.translateHotelFeature(item))
      .filter(Boolean)
      .filter((item, index, arr) => arr.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index)
      .slice(0, 7);

    if (!preferred.length) return "";

    return `
      <div class="hotel-option-card__features" aria-label="${this.escapeHtml(this.t("product.hotelFeatures", "Hotel features"))}">
        ${preferred.map((feature) => `
          <span><i class="fas fa-check" aria-hidden="true"></i>${this.escapeHtml(feature)}</span>
        `).join("")}
      </div>
    `;
  }

  bindHotelModalSelectionEvents() {
    document.querySelectorAll(".hotel-combo-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const card = button.closest(".hotel-option-card");

        if (!card) return;

        const destination = button.dataset.destination;
        const hotelCode = button.dataset.hotelCode;
        const comboKey = button.dataset.comboKey;

        card.dataset.selectedComboKey = comboKey;

        document.querySelectorAll(`.hotel-combo-btn[data-destination="${CSS.escape(destination)}"]`).forEach((btn) => {
          btn.classList.toggle(
            "is-selected",
            btn.dataset.hotelCode === hotelCode && btn.dataset.comboKey === comboKey
          );
        });

        document.querySelectorAll(`.hotel-option-card[data-destination="${CSS.escape(destination)}"]`).forEach((optionCard) => {
          optionCard.classList.toggle("is-selected", optionCard.dataset.hotelCode === hotelCode);

          if (optionCard.dataset.hotelCode !== hotelCode) {
            optionCard.dataset.selectedComboKey = "";
          }
        });
      });
    });
  }

  bindHotelModalGalleryEvents() {
    document.querySelectorAll(".hotel-gallery-prev, .hotel-gallery-next").forEach((button) => {
      button.addEventListener("click", () => {
        const gallery = button.closest(".hotel-gallery-main");

        if (!gallery) return;

        const mainImg = gallery.querySelector(".hotel-gallery-main-img");

        if (!mainImg) return;

        const imagesRaw = gallery.dataset.images || "[]";
        let images = [];

        try {
          images = JSON.parse(imagesRaw);
        } catch {
          images = [];
        }

        if (!images.length) return;

        const currentIndex = Number(gallery.dataset.currentImageIndex || 0);
        const isNext = button.classList.contains("hotel-gallery-next");

        const nextIndex = isNext
          ? (currentIndex + 1) % images.length
          : (currentIndex - 1 + images.length) % images.length;

        gallery.dataset.currentImageIndex = String(nextIndex);
        mainImg.src = this.resolveAssetPath(images[nextIndex]);
      });
    });
  }

  renderHotelModalGallery(images, hotelName) {
    const finalImages = images.length
      ? images
      : ["assets/img/tours/machu-picchu-full-day/cover.jpg"];

    const mainImage = finalImages[0];
    const imagesJson = this.escapeHtml(JSON.stringify(finalImages));

    return `
      <div class="hotel-gallery-main" data-images='${imagesJson}' data-current-image-index="0">
        <img
          class="hotel-gallery-main-img"
          src="${this.resolveAssetPath(mainImage)}"
          alt="${this.escapeHtml(hotelName)}"
          loading="lazy"
        />
        ${finalImages.length > 1 ? `
          <button type="button" class="hotel-gallery-nav hotel-gallery-prev" aria-label="${this.escapeHtml(this.t("booking.galleryPrev", "Imagen anterior"))}">‹</button>
          <button type="button" class="hotel-gallery-nav hotel-gallery-next" aria-label="${this.escapeHtml(this.t("booking.galleryNext", "Imagen siguiente"))}">›</button>
        ` : ""}
      </div>
    `;
  }
  renderSimilarExperiences() {
    const desktopTarget = document.getElementById("similarExperiencesDesktop");
    const mobileTarget = document.getElementById("similarExperiencesMobile");

    if (!this.product || !Array.isArray(this.tours)) {
      if (desktopTarget) desktopTarget.innerHTML = `<p>${this.t("product.noSimilarExperiences", "No similar experiences are available right now.")}</p>`;
      if (mobileTarget) mobileTarget.innerHTML = `<p>${this.t("product.noSimilarExperiences", "No similar experiences are available right now.")}</p>`;
      return;
    }

    const current = this.product;
    const currentFamily = String(current.productFamily || "").toLowerCase();
    const currentKind = String(current.productKind || "").toLowerCase();
    const currentDays = Number(current.days || 0);

    const similar = this.tours
      .filter((item) => item && item.slug && item.slug !== current.slug && this.isPublicProduct(item))
      .map((item) => ({ item, score: this.calculateSimilarityScore(current, item, currentFamily, currentKind, currentDays) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || String(a.item.title || "").localeCompare(String(b.item.title || ""), "es"))
      .slice(0, 3)
      .map((entry) => entry.item);

    const html = !similar.length
      ? `<p>${this.t("product.noSimilarExperiences", "No similar experiences are available right now.")}</p>`
      : similar.map((item) => `
        <article class="similar-card">
          <img src="${this.resolveAssetPath(item?.images?.cover || item?.image || "assets/img/tours/machu-picchu-full-day/cover.jpg")}" alt="${this.escapeHtml(item?.title || this.t("cards.experience", "Experience"))}" loading="lazy" />
          <div class="similar-card__content">
            <h3>${this.escapeHtml(item?.title || this.t("cards.experience", "Experience"))}</h3>
            <p>${this.escapeHtml(item?.shortDescription || this.t("product.experienceAvailable", "Experience available."))}</p>
            <a class="btn" href="${this.resolvePath(`product.html?slug=${encodeURIComponent(item.slug)}`)}">${this.t("cards.viewExperience", "View experience")}</a>
          </div>
        </article>
      `).join("");

    if (desktopTarget) desktopTarget.innerHTML = html;
    if (mobileTarget) mobileTarget.innerHTML = html;
  }

  calculateSimilarityScore(current, candidate, currentFamily, currentKind, currentDays) {
    let score = 0;
    const candidateFamily = String(candidate.productFamily || "").toLowerCase();
    const candidateKind = String(candidate.productKind || "").toLowerCase();

    if (candidateFamily && candidateFamily === currentFamily) score += 50;
    if (candidateKind && candidateKind === currentKind) score += 25;

    score += this.countIntersection(this.getSearchArray(current, "destinations"), this.getSearchArray(candidate, "destinations")) * 12;
    score += this.countIntersection(this.getSearchArray(current, "themes"), this.getSearchArray(candidate, "themes")) * 10;
    score += this.countIntersection(this.getSearchArray(current, "durationKeys"), this.getSearchArray(candidate, "durationKeys")) * 8;
    score += this.countIntersection(this.getSearchArray(current, "includedTags"), this.getSearchArray(candidate, "includedTags")) * 6;

    const candidateDays = Number(candidate.days || 0);
    if (currentDays > 0 && candidateDays > 0) {
      const distance = Math.abs(currentDays - candidateDays);
      if (distance === 0) score += 18;
      else if (distance === 1) score += 10;
      else if (distance === 2) score += 5;
    }

    if (candidate.featured) score += 3;

    if (currentFamily === "machu-picchu-tour" && candidateFamily !== "machu-picchu-tour") score -= 40;
    if (currentFamily === "cusco-tour" && candidateFamily !== "cusco-tour") score -= 20;
    if (currentFamily === "cusco-package" && candidateFamily !== "cusco-package") score -= 35;
    if (currentFamily === "peru-package" && candidateFamily !== "peru-package") score -= 35;

    return score;
  }

  getAppliedCouponPercent() {
    return Number(this.appliedCoupon?.discountPercent || this.appliedCoupon?.percent || 0) || 0;
  }

  getDiscountInfo(serviceTotal, fullDiscountPercent = 0) {
    const couponPercent = this.getAppliedCouponPercent();
    const fullPercent = this.paymentMode === "full" ? Number(fullDiscountPercent || 0) : 0;
    const percent = Math.max(couponPercent, fullPercent, 0);
    const source = percent > 0 && couponPercent >= fullPercent ? "coupon" : (percent > 0 ? "full_payment" : "none");
    return {
      percent,
      source,
      discount: Number(serviceTotal || 0) * (percent / 100)
    };
  }

  getDiscountInfoText(discountInfo, fallbackText = "") {
    if (discountInfo?.source === "coupon") {
      return this.t("product.couponDiscountApplied", "Coupon {code} applied: {percent}% discount.", {
        code: this.appliedCoupon?.couponCode || "",
        percent: discountInfo.percent
      });
    }
    return fallbackText;
  }

  setDiscountMessage(message = "", isError = false) {
    const target = document.getElementById("discountMessage");
    if (!target) return;
    target.textContent = message;
    target.classList.toggle("is-error", Boolean(isError));
  }

  async handleApplyDiscountCode() {
    const input = document.getElementById("discountCode");
    const code = String(input?.value || "").trim().toUpperCase();

    if (!code) {
      this.appliedCoupon = null;
      this.setDiscountMessage(this.t("product.enterDiscountCode", "Enter a discount code."), true);
      this.updatePricing();
      return;
    }

    this.setDiscountMessage(this.t("product.validatingDiscount", "Validating discount code..."), false);

    try {
      const result = await window.MyCuscoTripApiClient?.validateCoupon?.(code);
      if (!result?.valid) {
        this.appliedCoupon = null;
        this.setDiscountMessage(result?.message || this.t("product.invalidDiscountCode", "Invalid or expired discount code."), true);
        this.updatePricing();
        return;
      }

      this.appliedCoupon = {
        couponCode: result.couponCode || code,
        discountPercent: Number(result.discountPercent || 0),
        expiresAt: result.expiresAt || ""
      };
      if (input) input.value = this.appliedCoupon.couponCode;
      this.setDiscountMessage(this.t("product.discountApplied", "Discount code applied successfully."), false);
      this.updatePricing();
    } catch (error) {
      console.error("No se pudo validar el cupón:", error);
      this.appliedCoupon = null;
      this.setDiscountMessage(error?.message || this.t("product.discountValidationError", "We could not validate this code right now."), true);
      this.updatePricing();
    }
  }

  updatePassengersUI() {
    this.setText("adultsCount", String(this.adults));
    this.setText("childrenCount", String(this.children));
  }

  updatePricing() {
    if (!this.product) return;

    if (this.productType === "package" && this.selectedPackageOption) {
      const handled = this.updateDynamicPackagePricing();

      if (handled) return;
    }

    const currency = this.product.currency || "USD";
    const adultPrice = Number(this.product.basePricing?.adult || 0);
    const childPrice = Number(this.product.basePricing?.child || adultPrice);

    const adultsTotal = this.adults * adultPrice;
    const childrenTotal = this.children * childPrice;
    const extrasTotal = this.calculateExtrasTotal();
    const trainAdjustmentTotal = this.calculateSelectedTrainAdjustmentTotal();

    const accommodationSummary = this.getAccommodationSummary(this.product);

    const activeAccommodationItems = accommodationSummary.filter((item) => {
      const hotelCode = this.selectedHotelsByDestination[item.destination];
      const combo = this.selectedCombinationsByDestination[item.destination];

      if (!hotelCode || hotelCode === "no-hotel") return false;
      if (!combo) return false;

      return Number(combo.totalForStay || 0) > 0;
    });

    const accommodationTotal = activeAccommodationItems.reduce((sum, item) => {
      const combo = this.selectedCombinationsByDestination[item.destination];
      return sum + Number(combo?.totalForStay || 0);
    }, 0);

    const totalAccommodationNights = activeAccommodationItems.reduce(
      (sum, item) => sum + Number(item.nights || 0),
      0
    );

    const serviceTotal = adultsTotal + childrenTotal + extrasTotal + accommodationTotal + trainAdjustmentTotal;

    const fullDiscountPercent = Number(this.product.paymentOptions?.fullPaymentDiscountPercent || 10);
    const partialPerPerson = Number(this.product.paymentOptions?.partialPaymentPerPerson || 49.9);

    let discount = 0;
    let payNow = serviceTotal;
    let payLater = 0;
    let infoText = "";

    const discountInfo = this.getDiscountInfo(serviceTotal, fullDiscountPercent);
    discount = discountInfo.discount;
    const discountedTotal = Math.max(serviceTotal - discount, 0);

    if (this.paymentMode === "full") {
      payNow = discountedTotal;
      payLater = 0;
      infoText = this.getDiscountInfoText(
        discountInfo,
        this.t("product.fullPaymentDiscountText", "Pay in full now and get a {percent}% discount.", { percent: fullDiscountPercent })
      );
    } else {
      const totalPassengers = this.getTotalPassengers();
      payNow = Math.min(totalPassengers * partialPerPerson, discountedTotal);
      payLater = discountedTotal - payNow;

      if (payLater < 0) payLater = 0;

      infoText = this.getDiscountInfoText(
        discountInfo,
        this.product.paymentOptions?.partialPaymentLabel ||
          this.t("product.depositPaymentText", "Reserve with {currency} {amount} per person and pay the remaining balance before the trip.", { currency, amount: this.formatMoney(partialPerPerson) })
      );
    }

    this.setText("adultsTotal", `${currency} ${this.formatMoney(adultsTotal)}`);
    this.setText("childrenTotal", `${currency} ${this.formatMoney(childrenTotal)}`);
    this.setText("extrasTotal", `${currency} ${this.formatMoney(extrasTotal)}`);
    this.setText("serviceTotal", `${currency} ${this.formatMoney(serviceTotal)}`);
    this.setText("payNowTotal", `${currency} ${this.formatMoney(payNow)}`);
    this.setText("discountTotal", `- ${currency} ${this.formatMoney(discount)}`);
    this.setText("payLaterTotal", `${currency} ${this.formatMoney(payLater)}`);
    this.setText("accommodationTotal", `${currency} ${this.formatMoney(accommodationTotal)}`);

    const paymentModeSelect = document.getElementById("paymentMode");

    if (paymentModeSelect) {
      const partialOption = paymentModeSelect.querySelector('option[value="partial"]');

      if (partialOption) {
        partialOption.textContent = this.t("product.depositOnly", "Reserve with a deposit");
      }
    }

    const payNowLabel = document.getElementById("payNowLabel");

    if (payNowLabel) {
      payNowLabel.textContent = this.t("product.payNow", "Pay now");
    }

    const adultsRow = document.getElementById("adultsTotal")?.closest(".booking-summary__line");

    if (adultsRow) {
      const adultsLabel = adultsRow.querySelector("span");

      if (adultsLabel) {
        adultsLabel.textContent = `${this.t("product.adults", "Adults")} x${String(this.adults).padStart(2, "0")}`;
      }

      adultsRow.hidden = false;
    }

    const childrenRow = document.getElementById("childrenTotal")?.closest(".booking-summary__line");

    if (childrenRow) {
      const hasChildren = this.children > 0;
      childrenRow.hidden = !hasChildren;

      const childrenLabel = childrenRow.querySelector("span");

      if (childrenLabel) {
        childrenLabel.textContent = `${this.t("product.children", "Niños")} x${String(this.children).padStart(2, "0")}`;
      }
    }

    const accommodationRow = document.getElementById("accommodationTotalRow");

    if (accommodationRow) {
      const showAccommodation = accommodationTotal > 0 && totalAccommodationNights > 0;
      accommodationRow.hidden = !showAccommodation;

      const accommodationLabel = accommodationRow.querySelector("span");

      if (accommodationLabel) {
        accommodationLabel.textContent = this.t("product.accommodationNights", "Accommodation x{count} nights", { count: String(totalAccommodationNights).padStart(2, "0") });
      }
    }

    const extrasRow = document.getElementById("extrasTotal")?.closest(".booking-summary__line");

    if (extrasRow) {
      const showExtras = extrasTotal > 0;
      extrasRow.hidden = !showExtras;

      const extrasLabel = extrasRow.querySelector("span");

      if (extrasLabel) {
        extrasLabel.textContent = this.t("product.extras", "Extras");
      }
    }

    this.updateTrainAdjustmentSummaryRow(trainAdjustmentTotal, currency);

    const serviceTotalRow = document.getElementById("serviceTotal")?.closest(".booking-summary__line");

    if (serviceTotalRow) {
      const serviceLabel = serviceTotalRow.querySelector("span");

      if (serviceLabel) {
        serviceLabel.textContent = this.t("product.serviceTotal", "Service total");
      }

      serviceTotalRow.hidden = false;
    }

    const discountRow = document.getElementById("discountRow");

    if (discountRow) {
      const showDiscount = discount > 0;
      discountRow.hidden = !showDiscount;

      const discountLabel = discountRow.querySelector("span");

      if (discountLabel) {
        discountLabel.textContent = this.t("product.discount", "Discount");
      }
    }

    const payLaterRow = document.getElementById("payLaterRow");

    if (payLaterRow) {
      const payLaterLabel = payLaterRow.querySelector("span");

      if (payLaterLabel) {
        payLaterLabel.textContent = this.t("product.payLater", "Pagarás luego");
      }

      payLaterRow.hidden = this.paymentMode === "full" || payLater <= 0;
    }

    const paymentInfo = document.getElementById("paymentInfo");

    if (paymentInfo) {
      paymentInfo.textContent = infoText;
    }
  }

  updateDynamicPackagePricing() {
    if (!this.selectedPackageOption || !window.MyCuscoTripPricingEngine) {
      return false;
    }

    const selectedExtras = this.getSelectedDynamicPackageExtras();

    const quote = window.MyCuscoTripPricingEngine.calculatePackagePrice(
      this.selectedPackageOption,
      {
        adults: this.adults,
        children: this.children,
        nationality: "foreign",
        hotels: [],
        trains: [],
        extras: selectedExtras
      },
      {
        allData: this.allData
      }
    );

    const accommodationSummary = this.getAccommodationSummary(this.product);

    const activeAccommodationItems = accommodationSummary.filter((item) => {
      const hotelCode = this.selectedHotelsByDestination[item.destination];
      const combo = this.selectedCombinationsByDestination[item.destination];

      if (!hotelCode || hotelCode === "no-hotel") return false;
      if (!combo) return false;

      return Number(combo.totalForStay || 0) > 0;
    });

    const accommodationTotal = activeAccommodationItems.reduce((sum, item) => {
      const combo = this.selectedCombinationsByDestination[item.destination];
      return sum + Number(combo?.totalForStay || 0);
    }, 0);

    const totalAccommodationNights = activeAccommodationItems.reduce(
      (sum, item) => sum + Number(item.nights || 0),
      0
    );

    const currency = quote.currency || this.product.currency || "USD";
    const toursTotal = Number(quote.sections?.find((section) => section.type === "tours")?.total || 0);
    const machuPicchuTotal = Number(quote.sections?.find((section) => section.type === "machu_picchu")?.total || 0);
    const trainTotal = Number(quote.sections?.find((section) => section.type === "train_adjustments")?.total || 0);
    const extrasTotal = Number(quote.sections?.find((section) => section.type === "extras")?.total || 0);

    const baseServiceTotal = Number(quote.total || 0);
    const serviceTotal = baseServiceTotal + accommodationTotal;

    const fullDiscountPercent = Number(this.product.paymentOptions?.fullPaymentDiscountPercent || 10);
    const partialPerPerson = Number(this.product.paymentOptions?.partialPaymentPerPerson || 49.9);

    let discount = 0;
    let payNow = serviceTotal;
    let payLater = 0;
    let infoText = "";

    const discountInfo = this.getDiscountInfo(serviceTotal, fullDiscountPercent);
    discount = discountInfo.discount;
    const discountedTotal = Math.max(serviceTotal - discount, 0);

    if (this.paymentMode === "full") {
      payNow = discountedTotal;
      payLater = 0;
      infoText = this.getDiscountInfoText(
        discountInfo,
        this.t("product.fullPaymentDiscountText", "Pay in full now and get a {percent}% discount.", { percent: fullDiscountPercent })
      );
    } else {
      const totalPassengers = this.getTotalPassengers();
      payNow = Math.min(totalPassengers * partialPerPerson, discountedTotal);
      payLater = discountedTotal - payNow;

      if (payLater < 0) payLater = 0;

      infoText = this.getDiscountInfoText(
        discountInfo,
        this.product.paymentOptions?.partialPaymentLabel ||
          this.t("product.depositPaymentText", "Reserve with {currency} {amount} per person and pay the remaining balance before the trip.", { currency, amount: this.formatMoney(partialPerPerson) })
      );
    }

    this.dynamicQuote = {
      ...quote,
      accommodationTotal,
      serviceTotal,
      discount,
      payNow,
      payLater
    };

    this.setText("adultsTotal", `${currency} ${this.formatMoney(toursTotal + machuPicchuTotal + trainTotal)}`);
    this.setText("childrenTotal", `${currency} ${this.formatMoney(0)}`);
    this.setText("extrasTotal", `${currency} ${this.formatMoney(extrasTotal)}`);
    this.setText("serviceTotal", `${currency} ${this.formatMoney(serviceTotal)}`);
    this.setText("payNowTotal", `${currency} ${this.formatMoney(payNow)}`);
    this.setText("discountTotal", `- ${currency} ${this.formatMoney(discount)}`);
    this.setText("payLaterTotal", `${currency} ${this.formatMoney(payLater)}`);
    this.setText("accommodationTotal", `${currency} ${this.formatMoney(accommodationTotal)}`);

    const paymentModeSelect = document.getElementById("paymentMode");

    if (paymentModeSelect) {
      const partialOption = paymentModeSelect.querySelector('option[value="partial"]');

      if (partialOption) {
        partialOption.textContent = this.t("product.depositOnly", "Reserve with a deposit");
      }
    }

    const payNowLabel = document.getElementById("payNowLabel");

    if (payNowLabel) {
      payNowLabel.textContent = this.t("product.payNow", "Pay now");
    }

    const adultsRow = document.getElementById("adultsTotal")?.closest(".booking-summary__line");

    if (adultsRow) {
      const adultsLabel = adultsRow.querySelector("span");

      if (adultsLabel) {
        adultsLabel.textContent = this.t("product.toursAndMachuPicchu", "Tours and Machu Picchu");
      }

      adultsRow.hidden = false;
    }

    const childrenRow = document.getElementById("childrenTotal")?.closest(".booking-summary__line");

    if (childrenRow) {
      childrenRow.hidden = true;
    }

    const accommodationRow = document.getElementById("accommodationTotalRow");

    if (accommodationRow) {
      accommodationRow.hidden = !(accommodationTotal > 0 && totalAccommodationNights > 0);

      const accommodationLabel = accommodationRow.querySelector("span");

      if (accommodationLabel) {
        accommodationLabel.textContent = this.t("product.accommodationNights", "Accommodation x{count} nights", { count: String(totalAccommodationNights).padStart(2, "0") });
      }
    }

    const extrasRow = document.getElementById("extrasTotal")?.closest(".booking-summary__line");

    if (extrasRow) {
      extrasRow.hidden = !(extrasTotal > 0);

      const extrasLabel = extrasRow.querySelector("span");

      if (extrasLabel) {
        extrasLabel.textContent = this.t("product.extras", "Extras");
      }
    }

    const serviceTotalRow = document.getElementById("serviceTotal")?.closest(".booking-summary__line");

    if (serviceTotalRow) {
      const serviceLabel = serviceTotalRow.querySelector("span");

      if (serviceLabel) {
        serviceLabel.textContent = this.t("product.serviceTotal", "Service total");
      }

      serviceTotalRow.hidden = false;
    }

    const discountRow = document.getElementById("discountRow");

    if (discountRow) {
      discountRow.hidden = !(discount > 0);

      const discountLabel = discountRow.querySelector("span");

      if (discountLabel) {
        discountLabel.textContent = this.t("product.discount", "Discount");
      }
    }

    const payLaterRow = document.getElementById("payLaterRow");

    if (payLaterRow) {
      const payLaterLabel = payLaterRow.querySelector("span");

      if (payLaterLabel) {
        payLaterLabel.textContent = this.t("product.payLater", "Pagarás luego");
      }

      payLaterRow.hidden = this.paymentMode === "full" || payLater <= 0;
    }

    const paymentInfo = document.getElementById("paymentInfo");

    if (paymentInfo) {
      paymentInfo.textContent = infoText;
    }

    return true;
  }

  calculateExtrasTotal() {
    if (!this.product?.extras?.length) return 0;

    const passengers = this.getTotalPassengers();

    return this.product.extras.reduce((total, extra) => {
      if (!this.selectedExtras.has(extra.code)) return total;

      const price = Number(
        extra.price ||
        extra.publishedPriceUSD ||
        extra.publishedPricing?.amount ||
        0
      );

      if (extra.perPerson) return total + (price * passengers);

      return total + price;
    }, 0);
  }

  calculateAccommodationTotal() {
    if (!this.product || !this.isPackage(this.product)) return 0;

    const summary = this.getAccommodationSummary(this.product);

    return summary.reduce((total, item) => {
      const hotelCode = this.selectedHotelsByDestination[item.destination];
      const selectedCombo = this.selectedCombinationsByDestination[item.destination];

      if (!hotelCode || hotelCode === "no-hotel") return total;
      if (!selectedCombo) return total;

      return total + Number(selectedCombo.totalForStay || 0);
    }, 0);
  }

  calculateAccommodationAdditionalPerPerson(destination) {
    const hotelCode = this.selectedHotelsByDestination[destination];

    if (!hotelCode || hotelCode === "no-hotel") return 0;

    const combo = this.selectedCombinationsByDestination[destination];

    return Number(combo?.additionalPerPerson || 0);
  }

  getBookingSummary() {
    if (this.productType === "package" && this.dynamicQuote) {
      const currency = this.dynamicQuote.currency || this.product.currency || "USD";

      const selectedExtras = this.packageContent?.extras
        ? this.packageContent.extras
            .filter((extra) => this.selectedPackageExtraCodes.includes(extra.code))
            .map((extra) => extra.label)
        : [];

      const accommodation = this.getAccommodationSummary(this.product)
        .map((item) => {
          const hotelCode = this.selectedHotelsByDestination[item.destination];

          if (!hotelCode || hotelCode === "no-hotel") return null;

          const selection = this.getSelectedAccommodationForDestination(item.destination);

          if (!selection?.hotel || !selection?.combination) return null;

          return `${item.label || this.getDestinationLabel(item.destination)} - ${selection.hotel.hotelName} - ${selection.combination.label}`;
        })
        .filter(Boolean);

      return {
        title: this.product.title,
        date: this.date || this.t("product.toConfirm", "To be confirmed"),
        adults: this.adults,
        children: this.children,
        departureTime: this.getSelectedDepartureTimeLabel(),
        trainSelection: this.getSelectedTrainSummaryLabel(),
        serviceMode: this.serviceMode === "private" ? this.t("product.privateTour", "Private tour") : this.t("product.groupTour", "Group tour"),
        accommodation,
        extras: selectedExtras,
        serviceTotal: `${currency} ${this.formatMoney(this.dynamicQuote.serviceTotal || this.dynamicQuote.total || 0)}`,
        payNow: `${currency} ${this.formatMoney(this.dynamicQuote.payNow || 0)}`,
        payLater: `${currency} ${this.formatMoney(this.dynamicQuote.payLater || 0)}`,
        rawServiceTotal: Number(this.dynamicQuote.serviceTotal || this.dynamicQuote.total || 0),
        rawPayNow: Number(this.dynamicQuote.payNow || 0),
        rawPayLater: Number(this.dynamicQuote.payLater || 0),
        paymentMode: this.paymentMode === "full" ? this.t("product.fullPayment", "Full payment") : this.t("product.depositOnly", "Reserve with a deposit"),
        couponCode: this.appliedCoupon?.couponCode || "",
        couponDiscountPercent: this.getAppliedCouponPercent()
      };
    }

    const currency = this.product.currency || "USD";
    const adultPrice = Number(this.product.basePricing?.adult || 0);
    const childPrice = Number(this.product.basePricing?.child || adultPrice);

    const adultsTotal = this.adults * adultPrice;
    const childrenTotal = this.children * childPrice;
    const extrasTotal = this.calculateExtrasTotal();
    const trainAdjustmentTotal = this.calculateSelectedTrainAdjustmentTotal();
    const accommodationTotal = this.calculateAccommodationTotal();
    const serviceTotal = adultsTotal + childrenTotal + extrasTotal + accommodationTotal + trainAdjustmentTotal;

    const fullDiscountPercent = Number(this.product.paymentOptions?.fullPaymentDiscountPercent || 10);
    const partialPerPerson = Number(this.product.paymentOptions?.partialPaymentPerPerson || 49.9);

    let payNow = serviceTotal;
    let payLater = 0;

    const discountInfo = this.getDiscountInfo(serviceTotal, fullDiscountPercent);
    const discountedTotal = Math.max(serviceTotal - discountInfo.discount, 0);

    if (this.paymentMode === "full") {
      payNow = discountedTotal;
      payLater = 0;
    } else {
      const totalPassengers = this.getTotalPassengers();
      payNow = Math.min(totalPassengers * partialPerPerson, discountedTotal);
      payLater = discountedTotal - payNow;

      if (payLater < 0) payLater = 0;
    }

    const selectedExtras = (this.product.extras || [])
      .filter((extra) => this.selectedExtras.has(extra.code))
      .map((extra) => extra.label);

    const accommodation = this.getAccommodationSummary(this.product)
      .map((item) => {
        const hotelCode = this.selectedHotelsByDestination[item.destination];

        if (!hotelCode || hotelCode === "no-hotel") return null;

        const selection = this.getSelectedAccommodationForDestination(item.destination);

        if (!selection?.hotel || !selection?.combination) return null;

        return `${item.label || this.getDestinationLabel(item.destination)} - ${selection.hotel.hotelName} - ${selection.combination.label}`;
      })
      .filter(Boolean);

    return {
      title: this.product.title,
      date: this.date || this.t("product.toConfirm", "To be confirmed"),
      adults: this.adults,
      children: this.children,
      departureTime: this.getSelectedDepartureTimeLabel(),
      trainSelection: this.getSelectedTrainSummaryLabel(),
      serviceMode: this.serviceMode === "private" ? this.t("product.privateTour", "Private tour") : this.t("product.groupTour", "Group tour"),
      accommodation,
      extras: selectedExtras,
      serviceTotal: `${currency} ${this.formatMoney(serviceTotal)}`,
      payNow: `${currency} ${this.formatMoney(payNow)}`,
      payLater: `${currency} ${this.formatMoney(payLater)}`,
      rawServiceTotal: Number(serviceTotal || 0),
      rawPayNow: Number(payNow || 0),
      rawPayLater: Number(payLater || 0),
      paymentMode: this.paymentMode === "full" ? this.t("product.fullPayment", "Full payment") : this.t("product.depositOnly", "Reserve with a deposit"),
      couponCode: this.appliedCoupon?.couponCode || "",
      couponDiscountPercent: this.getAppliedCouponPercent()
    };
  }

  handlePaypalAction() {
    this.openPassengerReservationModal();
  }

  openPassengerReservationModal() {
    const modal = document.getElementById("passengerReservationModal");
    if (!modal) return;

    const preReservation = this.generatePreReservation();
    if (this.restoredPaymentPayload?.code && (!this.restoredPaymentPayload.productSlug || this.restoredPaymentPayload.productSlug === this.slug)) {
      preReservation.code = this.restoredPaymentPayload.code;
      preReservation.createdAt = this.restoredPaymentPayload.createdAt || preReservation.createdAt;
      preReservation.createdAtLabel = this.restoredPaymentPayload.createdAtLabel || preReservation.createdAtLabel;
      preReservation.createdAtDisplayLabel = this.restoredPaymentPayload.createdAtDisplayLabel || preReservation.createdAtDisplayLabel;
    }
    this.currentPreReservation = preReservation;
    this.persistLocalReservation?.(preReservation.code, preReservation);

    const form = document.getElementById("passengerReservationForm");
    if (form) delete form.dataset.paymentReviewConfirmed;
    const review = document.getElementById("passengerCheckoutReview");
    if (review) { review.hidden = true; review.innerHTML = ""; }

    this.setText("passengerReservationCode", preReservation.code);
    this.setText("passengerReservationTimestamp", this.t("product.bookingGenerated", "Reservation generated: {date}", { date: preReservation.createdAtDisplayLabel }));
    this.renderPassengerPaymentSnapshot(preReservation);
    this.bindPassengerReservationModalEvents();
    this.syncPassengerHolderState();
    this.renderAdditionalPassengerFields();
    this.populateCountrySelects();
    this.populatePhoneCodeSelects?.();
    this.syncHolderLanguageWarning();

    modal.hidden = false;
    document.body.classList.add("passenger-modal-open");
    this.trackEvent("passenger_modal_open", {
      reservation_code: preReservation.code,
      product_id: preReservation.productId,
      product_name: preReservation.productTitle,
      travel_date: preReservation.date,
      currency: preReservation.currency,
      value: Number(preReservation.payNowValue || 0),
      total_value: Number(preReservation.serviceTotalValue || 0),
      passengers: preReservation.totalPassengers
    }, { metaEventName: "InitiateCheckout" });
    this.trackEvent("begin_checkout", {
      reservation_code: preReservation.code,
      currency: preReservation.currency,
      value: Number(preReservation.payNowValue || 0),
      items: [{
        item_id: preReservation.productId,
        item_name: preReservation.productTitle,
        item_category: this.productType || "tour",
        quantity: 1,
        price: Number(preReservation.serviceTotalValue || 0)
      }]
    }, { metaEventName: "InitiateCheckout" });
  }

  closePassengerReservationModal() {
    const modal = document.getElementById("passengerReservationModal");
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("passenger-modal-open");
  }


  syncPassengerHolderState() {
    const holderTravels = document.getElementById("holderTravelsCheckbox")?.checked !== false;
    const title = document.getElementById("holderSectionTitle");

    if (title) {
      title.textContent = holderTravels ? this.t("product.holderPassenger", "Reservation holder / Traveler 1") : this.t("product.holder", "Reservation holder");
    }
  }

  syncHolderLanguageWarning() {
    const select = document.getElementById("holderLanguageSelect");
    const warning = document.getElementById("holderLanguageWarning");
    if (!select || !warning) return;
    const value = String(select.value || "").toLowerCase();
    const requiresNotice = value && !["es", "en", "spanish", "english", "español", "ingles", "inglés"].includes(value);
    warning.hidden = !requiresNotice;
  }

  bindPassengerReservationModalEvents() {
    if (this.passengerModalEventsBound) return;
    this.passengerModalEventsBound = true;

    document.querySelectorAll("[data-close-passenger-modal]").forEach((button) => {
      button.addEventListener("click", () => this.closePassengerReservationModal());
    });

    document.getElementById("closePassengerModalBtn")?.addEventListener("click", () => {
      this.closePassengerReservationModal();
    });

    document.getElementById("holderTravelsCheckbox")?.addEventListener("change", () => {
      this.syncPassengerHolderState();
      this.renderAdditionalPassengerFields();
    });

    document.getElementById("holderLanguageSelect")?.addEventListener("change", () => {
      this.syncHolderLanguageWarning();
    });

    document.getElementById("passengerDetailsToggle")?.addEventListener("click", (event) => {
      const button = event.currentTarget;
      const snapshot = document.getElementById("passengerPaymentSnapshot");
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      button.textContent = expanded ? this.t("product.showBookingDetails", "View booking details") : this.t("product.hideBookingDetails", "Hide details");
      snapshot?.classList.toggle("is-open", !expanded);
    });

    const passengerForm = document.getElementById("passengerReservationForm");
    passengerForm?.addEventListener("submit", (event) => {
      this.handlePassengerReservationSubmit(event);
    });
    passengerForm?.addEventListener("input", () => {
      if (passengerForm.dataset.paymentReviewConfirmed === "true") {
        delete passengerForm.dataset.paymentReviewConfirmed;
        const review = document.getElementById("passengerCheckoutReview");
        if (review) { review.hidden = true; review.innerHTML = ""; }
        const submit = passengerForm.querySelector('button[type="submit"]');
        if (submit) submit.textContent = this.t("booking.continue", "Continuar");
      }
    });
  }

  generateReservationHex(seed = "") {
    try {
      const buffer = new Uint32Array(1);
      window.crypto?.getRandomValues?.(buffer);
      if (buffer[0]) return buffer[0].toString(16).toUpperCase().padStart(6, "0").slice(-6);
    } catch (error) {
      // Fallback below.
    }
    const randomPart = Math.floor(Math.random() * 0xffffff);
    const seedPart = Number(String(seed).replace(/\D/g, "").slice(-8)) || Date.now();
    return ((randomPart + seedPart) % 0xffffff).toString(16).toUpperCase().padStart(6, "0").slice(-6);
  }

  generatePreReservation() {
    const now = new Date();
    const timestampSeed = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    const hex = this.generateReservationHex(timestampSeed);
    const summary = this.getBookingSummary();

    return {
      code: `CUZ${hex}`,
      createdAt: now.toISOString(),
      createdAtLabel: now.toLocaleString(this.isEnglishLocale() ? "en-US" : "es-PE", {
        dateStyle: "medium",
        timeStyle: "medium"
      }),
      createdAtDisplayLabel: now.toLocaleString(this.isEnglishLocale() ? "en-US" : "es-PE", {
        dateStyle: "medium",
        timeStyle: "short"
      }),
      productSlug: this.slug,
      productId: this.product?.id || this.product?.code || this.slug,
      productTitle: summary.title,
      date: summary.date,
      adults: summary.adults,
      children: summary.children,
      totalPassengers: this.getTotalPassengers(),
      currency: this.product?.currency || "USD",
      paymentMode: summary.paymentMode,
      selectedTrainIds: {
        outbound: this.selectedOutboundTrainId || "",
        return: this.selectedReturnTrainId || ""
      },
      selectedExtraCodes: Array.from(this.selectedExtras || []),
      serviceTotal: summary.serviceTotal,
      payNow: summary.payNow,
      payLater: summary.payLater,
      serviceTotalValue: Number(summary.rawServiceTotal || 0),
      payNowValue: Number(summary.rawPayNow || 0),
      payLaterValue: Number(summary.rawPayLater || 0),
      couponCode: this.appliedCoupon?.couponCode || summary.couponCode || "",
      appliedCoupon: this.appliedCoupon || null,
      status: "pre_reservation",
      paymentStatus: "pending",
      summary
    };
  }

  renderPassengerPaymentSnapshot(preReservation) {
    const amountTarget = document.getElementById("passengerPayNowAmount");
    if (amountTarget) amountTarget.textContent = preReservation.payNow || "";

    const target = document.getElementById("passengerPaymentSnapshot");
    if (target) {
      target.innerHTML = "";
      target.hidden = true;
    }

    const toggle = document.getElementById("passengerDetailsToggle");
    if (toggle) toggle.hidden = true;
  }


  getCountryOptionsHtml() {
    const countries = [
      "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita", "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyán",
      "Bahamas", "Bangladés", "Barbados", "Baréin", "Bélgica", "Belice", "Benín", "Bielorrusia", "Bolivia", "Bosnia y Herzegovina", "Botsuana", "Brasil", "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Bután",
      "Cabo Verde", "Camboya", "Camerún", "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Colombia", "Comoras", "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba",
      "Dinamarca", "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia", "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía",
      "Filipinas", "Finlandia", "Fiyi", "Francia", "Gabón", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guinea", "Guinea-Bisáu", "Guinea Ecuatorial", "Guyana",
      "Haití", "Honduras", "Hungría", "India", "Indonesia", "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Israel", "Italia",
      "Jamaica", "Japón", "Jordania", "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos", "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo",
      "Madagascar", "Malasia", "Malaui", "Maldivas", "Malí", "Malta", "Marruecos", "Mauricio", "Mauritania", "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique", "Myanmar",
      "Namibia", "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos", "Pakistán", "Palaos", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Polonia", "Portugal", "Reino Unido", "República Centroafricana", "República Checa", "República del Congo", "República Democrática del Congo", "República Dominicana", "Ruanda", "Rumanía", "Rusia",
      "Samoa", "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucía", "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria", "Somalia", "Sri Lanka", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza", "Surinam",
      "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago", "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu", "Vaticano", "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue"
    ];

    return `<option value="">${this.t("product.selectCountry", "Selecciona país")}</option>${countries.map((country) => `<option value="${this.escapeHtml(country)}">${this.escapeHtml(country)}</option>`).join("")}`;
  }

  populateCountrySelects(scope = document) {
    const options = this.getCountryOptionsHtml();
    scope.querySelectorAll?.("select[data-country-select]").forEach((select) => {
      const current = select.value;
      if (select.dataset.countriesLoaded === "true") return;
      select.innerHTML = options;
      if (current) select.value = current;
      select.dataset.countriesLoaded = "true";
    });
  }

  renderAdditionalPassengerFields() {
    const container = document.getElementById("additionalPassengersContainer");
    if (!container) return;

    const holderTravels = document.getElementById("holderTravelsCheckbox")?.checked !== false;
    const totalPassengers = this.getTotalPassengers();
    const additionalCount = holderTravels ? Math.max(totalPassengers - 1, 0) : Math.max(totalPassengers, 0);
    const startNumber = holderTravels ? 2 : 1;

    if (!additionalCount) {
      container.innerHTML = `<p class="passenger-modal__note">${this.t("product.noAdditionalPassengers", "No hay pasajeros adicionales según la cantidad seleccionada.")}</p>`;
      return;
    }

    container.innerHTML = Array.from({ length: additionalCount }, (_, index) => {
      const passengerNumber = startNumber + index;
      return `
        <details class="passenger-modal__optional-passenger" open>
          <summary>Pasajero ${passengerNumber} <span>Datos del turista</span></summary>
          <label class="passenger-modal__check passenger-modal__check--later">
            <input type="checkbox" name="passenger_${passengerNumber}_complete_later" data-passenger-later="${passengerNumber}" />
            <span>${this.t("product.passengerLater", "Ingresaré los datos de este pasajero más adelante.")}</span>
          </label>
          <div class="passenger-modal__grid" data-passenger-fields="${passengerNumber}">
            <label>
              <span>Nombres</span>
              <input type="text" name="passenger_${passengerNumber}_firstName" autocomplete="given-name" />
            </label>
            <label>
              <span>Apellidos</span>
              <input type="text" name="passenger_${passengerNumber}_lastName" autocomplete="family-name" />
            </label>
            <label>
              <span>Tipo de documento</span>
              <select name="passenger_${passengerNumber}_documentType">
                <option value="">Selecciona</option>
                <option value="passport">Pasaporte</option>
                <option value="dni">DNI</option>
                <option value="id_card">${this.t("product.docTypeIdCard", "Documento de identidad")}</option>
                <option value="other">Otro</option>
              </select>
            </label>
            <label>
              <span>Número de documento</span>
              <input type="text" name="passenger_${passengerNumber}_documentNumber" autocomplete="off" />
            </label>
            <label>
              <span>Nacionalidad</span>
              <select name="passenger_${passengerNumber}_nationality" autocomplete="country-name" data-country-select></select>
            </label>
            <label>
              <span>Fecha de nacimiento</span>
              <input type="date" name="passenger_${passengerNumber}_birthdate" />
            </label>
          </div>
        </details>
      `;
    }).join("");

    this.populateCountrySelects(container);

    container.querySelectorAll("[data-passenger-later]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const number = checkbox.dataset.passengerLater;
        const fields = container.querySelector(`[data-passenger-fields="${CSS.escape(number)}"]`);
        fields?.classList.toggle("is-disabled", checkbox.checked);
        fields?.querySelectorAll("input, select").forEach((field) => {
          field.disabled = checkbox.checked;
        });
      });
    });
  }

  async handlePassengerReservationSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const message = document.querySelector("[data-passenger-message]");

    if (!form.checkValidity()) {
      form.reportValidity();
      if (message) {
        message.textContent = "Completa los datos obligatorios del titular de reserva.";
        message.classList.add("is-error");
      }
      return;
    }

    const data = new FormData(form);
    const holderTravels = data.get("holderTravels") === "on";
    const totalPassengers = this.getTotalPassengers();
    const startNumber = holderTravels ? 2 : 1;
    const passengerSlots = holderTravels ? Math.max(totalPassengers - 1, 0) : Math.max(totalPassengers, 0);

    const holder = {
      firstName: String(data.get("holderFirstName") || "").trim(),
      lastName: String(data.get("holderLastName") || "").trim(),
      documentType: String(data.get("holderDocumentType") || "").trim(),
      documentNumber: String(data.get("holderDocumentNumber") || "").trim(),
      nationality: String(data.get("holderNationality") || "").trim(),
      birthdate: String(data.get("holderBirthdate") || "").trim(),
      whatsappCountryCode: String(data.get("holderWhatsappCountryCode") || "").trim(),
      whatsapp: String(data.get("holderWhatsapp") || "").trim(),
      email: String(data.get("holderEmail") || "").trim(),
      language: String(data.get("holderLanguage") || "").trim() || (this.isEnglishLocale() ? "English" : "Español"),
      travels: holderTravels
    };

    const passengers = [];

    if (holderTravels) {
      passengers.push({
        passengerNumber: 1,
        role: "holder_passenger",
        completionStatus: "complete",
        firstName: holder.firstName,
        lastName: holder.lastName,
        documentType: holder.documentType,
        documentNumber: holder.documentNumber,
        nationality: holder.nationality,
        birthdate: holder.birthdate,
        whatsappCountryCode: holder.whatsappCountryCode,
        whatsapp: `${holder.whatsappCountryCode ? `${holder.whatsappCountryCode} ` : ""}${holder.whatsapp}`.trim(),
        email: holder.email,
        language: holder.language
      });
    }

    for (let i = 0; i < passengerSlots; i += 1) {
      const number = startNumber + i;
      const completeLater = data.get(`passenger_${number}_complete_later`) === "on";

      passengers.push({
        passengerNumber: number,
        role: "traveler",
        completionStatus: completeLater ? "pending" : "provided",
        completeLater,
        firstName: completeLater ? "" : String(data.get(`passenger_${number}_firstName`) || "").trim(),
        lastName: completeLater ? "" : String(data.get(`passenger_${number}_lastName`) || "").trim(),
        documentType: completeLater ? "" : String(data.get(`passenger_${number}_documentType`) || "").trim(),
        documentNumber: completeLater ? "" : String(data.get(`passenger_${number}_documentNumber`) || "").trim(),
        nationality: completeLater ? "" : String(data.get(`passenger_${number}_nationality`) || "").trim(),
        birthdate: completeLater ? "" : String(data.get(`passenger_${number}_birthdate`) || "").trim()
      });
    }

    const payload = {
      ...this.currentPreReservation,
      holderIsPassenger: holderTravels,
      holder,
      passengers,
      passengerDataPolicy: "additional_passengers_can_be_completed_15_to_30_days_before_travel",
      couponCode: this.appliedCoupon?.couponCode || this.currentPreReservation?.summary?.couponCode || "",
      appliedCoupon: this.appliedCoupon || null,
      paymentGatewayReady: false,
      paymentGatewayProvider: "paypal_prepared",
      checkoutPayload: {
        reservationCode: this.currentPreReservation?.code,
        currency: this.currentPreReservation?.currency || this.product?.currency || "USD",
        amountToPayNow: this.currentPreReservation?.payNow,
        amountToPayNowValue: Number(this.currentPreReservation?.payNowValue || 0),
        pendingBalance: this.currentPreReservation?.payLater,
        pendingBalanceValue: Number(this.currentPreReservation?.payLaterValue || 0),
        productId: this.currentPreReservation?.productId,
        productTitle: this.currentPreReservation?.productTitle,
        couponCode: this.appliedCoupon?.couponCode || "",
        provider: "paypal",
        backendRequired: true
      }
    };

    this.persistLocalReservation?.(payload.code, payload);

    if (form.dataset.paymentReviewConfirmed !== "true") {
      this.renderPaymentReviewStep?.(payload);
      form.dataset.paymentReviewConfirmed = "true";
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error");
      }
      const reviewSubmitButton = form.querySelector('button[type="submit"]');
      if (reviewSubmitButton) {
        reviewSubmitButton.textContent = "Pagar";
      }
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent || "";
      submitButton.textContent = this.t("product.savingReservation", "Guardando reserva...");
    }

    try {
      const apiResult = window.MyCuscoTripApiClient?.createPreReservation
        ? await window.MyCuscoTripApiClient.createPreReservation(payload)
        : null;

      const finalReservationCode = apiResult?.reservationCode || apiResult?.code || payload.code;
      this.persistLocalReservation?.(finalReservationCode, { ...payload, code: finalReservationCode, paymentStatus: "pending" });

      this.trackEvent("pre_reservation_created", {
        reservation_code: finalReservationCode,
        product_id: payload.productId,
        product_name: payload.productTitle,
        travel_date: payload.date,
        currency: payload.currency || "USD",
        value: Number(payload.payNowValue || 0),
        total_value: Number(payload.serviceTotalValue || 0),
        pending_balance: Number(payload.payLaterValue || 0),
        passenger_count: payload.passengers?.length || payload.totalPassengers || 0,
        holder_is_passenger: Boolean(payload.holderIsPassenger),
        persistence_mode: apiResult?.mock ? "mock" : "backend"
      }, { metaEventName: "CompleteRegistration" });

      if (message) {
        message.textContent = apiResult?.mock
          ? `Reserva ${payload.code} creada como borrador local. Configura el backend para redirigir a PayPal.`
          : this.t("product.connectingToPaypal", "Connecting to PayPal...");
        message.classList.remove("is-error");
      }

      if (apiResult?.mock) return;

      const paypalResult = await window.MyCuscoTripApiClient.createPayPalOrder({
        reservationCode: finalReservationCode,
        currency: payload.currency || "USD",
        amountToPayNowValue: Number(payload.payNowValue || 0),
        productId: payload.productId,
        productTitle: payload.productTitle
      });

      this.trackEvent("begin_payment", {
        reservation_code: finalReservationCode,
        product_id: payload.productId,
        product_name: payload.productTitle,
        currency: payload.currency || "USD",
        value: Number(payload.payNowValue || 0),
        payment_status: "pending",
        payment_provider: "paypal"
      }, { metaEventName: "InitiateCheckout" });

      const pendingRecord = {
        reservationCode: finalReservationCode,
        lastName: holder.lastName,
        holderEmail: holder.email,
        createdAt: new Date().toISOString(),
        payload
      };
      try {
        sessionStorage.setItem(`mct_pending_payment_${finalReservationCode}`, JSON.stringify(pendingRecord));
        localStorage.setItem(`mct_pending_payment_${finalReservationCode}`, JSON.stringify(pendingRecord));
      } catch (storageError) {}

      if (paypalResult?.approvalUrl) {
        window.location.assign(paypalResult.approvalUrl);
        return;
      }

      throw new Error(paypalResult?.message || paypalResult?.error || this.t("product.paypalNoPaymentLink", "PayPal no devolvió enlace de pago."));
    } catch (error) {
      console.error("No se pudo guardar la pre-reserva:", error);
      if (message) {
        const backendMessage = error?.body?.error || error?.body?.message || error?.message || this.t("product.reservationRegisterError", "No se pudo registrar la reserva. Revisa la conexión o la configuración del backend.");
        message.textContent = backendMessage;
        message.classList.add("is-error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || this.t("product.continueToPayment", "Continuar al pago");
      }
    }
  }

  initDynamicPackageEngine() {
    if (!this.product || !this.isPackage(this.product)) return;

    if (!window.MyCuscoTripPackageGenerator) {
      console.warn("Falta package-generator.js. Se mostrará el paquete sin motor dinámico.");
      return;
    }

    const options = window.MyCuscoTripPackageGenerator.generatePackageOptions(
      {
        productFamily: this.product.productFamily,
        days: this.product.days,
        nights: this.product.nights,
        arrivalTime: "09:00",
        departureTime: "20:00",
        adults: this.adults,
        children: this.children,
        nationality: "foreign"
      },
      this.allData
    );

    this.packageOptions = Array.isArray(options) ? options : [];

    if (!this.packageOptions.length) {
      console.warn("No se generaron opciones dinámicas para este paquete.");
      return;
    }

    this.renderDynamicPackageOptions();
    const initialOptionIndex = this.getValidPackageOptionIndex(this.requestedPackageOptionIndex);
    this.selectDynamicPackageOption(initialOptionIndex);
  }

  renderDynamicPackageOptions() {
    const target =
      document.getElementById("packageOptions") ||
      this.createDynamicSection("packageOptions", "productItinerary");

    if (!target || !Array.isArray(this.packageOptions)) return;

    target.hidden = false;

    const visibleLimit = 4;
    const visibleOptions = this.packageOptionsExpanded
      ? this.packageOptions
      : this.packageOptions.slice(0, visibleLimit);
    const hasMoreOptions = this.packageOptions.length > visibleLimit && !this.packageOptionsExpanded;

    target.innerHTML = `
      <div class="package-options-section__header package-options-section__header--simple">
        <p>${this.escapeHtml(this.t("product.packageOptionsIntro", "Choose the route that best matches your travel pace, interests and preferred places to visit. You can switch options without losing your reservation."))}</p>
      </div>

      <div class="package-options-list package-options-list--cards">
        ${visibleOptions.map((option, index) => this.renderDynamicPackageOptionCard(option, index)).join("")}
      </div>

      ${hasMoreOptions ? `
        <div class="package-options-section__more">
          <button type="button" class="btn booking-secondary-btn" data-show-all-package-options>
            ${this.escapeHtml(this.t("product.showMoreOptions", "Show more options"))}
          </button>
        </div>
      ` : ""}
    `;

    target.querySelectorAll("[data-package-option-index]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectDynamicPackageOption(Number(button.dataset.packageOptionIndex || 0));
      });
    });

    target.querySelector("[data-show-all-package-options]")?.addEventListener("click", () => {
      this.packageOptionsExpanded = true;
      this.renderDynamicPackageOptions();
    });
  }

  renderDynamicPackageOptionCard(option, index) {
    const presentation = this.getPackageOptionPresentation(option, index);
    const selected = index === this.selectedPackageOptionIndex;

    return `
      <article class="package-option-card ${selected ? "is-selected" : ""}">
        <button
          type="button"
          class="package-option-btn package-option-btn--card ${selected ? "is-selected" : ""}"
          data-package-option-index="${index}"
          aria-pressed="${selected ? "true" : "false"}"
        >
          <span class="package-option-card__eyebrow">${this.escapeHtml(presentation.eyebrow)}</span>
          <strong>${this.escapeHtml(presentation.title)}</strong>
          <span class="package-option-card__summary">${this.escapeHtml(presentation.summary)}</span>
          <small>${this.escapeHtml(presentation.description)}</small>
          <span class="package-option-card__difficulty">${this.escapeHtml(presentation.difficulty)}</span>
          <span class="package-option-card__cta">${selected ? this.t("product.selectedRoute", "Selected route") : this.t("product.selectRoute", "Select this route")}</span>
        </button>
      </article>
    `;
  }

  getPackageOptionPresentation(option, index) {
    const titles = this.getPackageOptionTourTitles(option).slice(0, 6);
    const title = this.getPackageOptionCommercialTitle(option, index, titles);
    const summary = this.getPackageOptionCommercialSummary(option, titles);

    return {
      eyebrow: `${this.t("product.itineraryOption", "Itinerary")} ${this.getAlphabeticIndex(index)}`,
      title,
      summary,
      description: this.getPackageOptionCommercialDescription(option, titles),
      difficulty: this.getPackageOptionDifficultyLabel(option, titles)
    };
  }

  getPackageOptionTourTitles(option) {
    const codes = this.getPackageOptionCodes(option);
    const fallbackLabels = {
      CUZ001: this.t("product.ancestralWelcome", "Ancestral Welcome"),
      CUZ002: this.t("product.cityTour", "Cusco City Tour"),
      CUZ003: this.t("product.sacredValley", "Sacred Valley"),
      CUZ003FD: this.t("product.sacredValley", "Sacred Valley"),
      CUZ003CON: this.t("product.sacredValleyConnection", "Sacred Valley with connection"),
      CUZ003VIP: this.t("product.sacredValleyVip", "Sacred Valley VIP"),
      CUZ003VIPCON: this.t("product.sacredValleyVipConnection", "Sacred Valley VIP with connection"),
      CUZ004: "Maras y Moray",
      CUZ005: this.t("product.southValley", "South Valley"),
      CUZ006: this.t("product.humantayLake", "Humantay Lake"),
      CUZ007: this.t("product.rainbowMountain", "Rainbow Mountain"),
      CUZ008: this.t("product.palcoyoMountain", "Palcoyo Mountain"),
      CUZ009: this.t("product.sevenLakes", "Seven Lakes of Ausangate"),
      MAPI001: this.t("product.machuPicchuClassic", "Machu Picchu Classic"),
      MAPI002: this.t("product.machuPicchuExpress", "Machu Picchu Express"),
      MAPI003: "Machu Picchu overnight",
      MAPI004: "Machu Picchu overnight express"
    };

    return codes
      .map((code) => {
        const title = this.getTourTitleByCode(code);
        return title && title !== code ? this.getCleanCommercialTourTitle(title) : fallbackLabels[code] || "Experiencia seleccionada";
      })
      .filter(Boolean)
      .filter((title, position, list) => list.indexOf(title) === position);
  }

  getPackageOptionCodes(option) {
    const codes = [];
    const addCode = (value) => {
      const clean = String(value || "").trim();
      if (clean && /^(CUZ|MAPI|PER|TRK|TREK)/i.test(clean) && !codes.includes(clean)) codes.push(clean);
    };

    if (Array.isArray(option?.includedTourCodes)) option.includedTourCodes.forEach(addCode);
    if (Array.isArray(option?.tourCodes)) option.tourCodes.forEach(addCode);
    if (Array.isArray(option?.itineraryDays)) {
      option.itineraryDays.forEach((day) => {
        if (Array.isArray(day?.items)) {
          day.items.forEach((item) => {
            addCode(item?.internalCode || item?.code || item?.tourCode || item?.sourceTourCode);
          });
        }
      });
    }
    if (Array.isArray(option?.days)) {
      option.days.forEach((day) => {
        if (Array.isArray(day?.items)) {
          day.items.forEach((item) => addCode(item?.internalCode || item?.code || item?.tourCode || item?.sourceTourCode));
        }
      });
    }

    return codes;
  }

  getCleanCommercialTourTitle(title) {
    return String(title || "")
      .replace(/^tour\s+/i, "")
      .replace(/\s+full\s*day$/i, "")
      .replace(/\s+cl[aá]sico$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  getPackageOptionCommercialTitle(option, index, titles = []) {
    const text = this.normalizePlainText([
      option?.commercialLabel,
      option?.recommendedTitle,
      option?.generationReason,
      option?.machuPicchuMode,
      option?.connectionMode,
      option?.sacredValleyMode,
      ...this.getPackageOptionCodes(option),
      ...titles
    ].join(" "));

    if (index === 0 || text.includes("recommended") || text.includes("recomendada")) return this.t("product.routeRecommended", "Recommended route");
    if (text.includes("humantay") && (text.includes("colores") || text.includes("vinicunca") || text.includes("palcoyo"))) return this.t("product.routeIntenseNature", "Nature-intensive route");
    if (text.includes("humantay") || text.includes("colores") || text.includes("vinicunca") || text.includes("palcoyo") || text.includes("trek")) return this.t("product.routeAdventure", "Adventure route");
    if (text.includes("maras") || text.includes("moray") || text.includes("laguna") || text.includes("montana")) return this.t("product.routeNature", "Nature route");
    if (text.includes("vip") || text.includes("completa")) return this.t("product.routeComplete", "Most complete route");
    if (text.includes("classic") || text.includes("clasica") || text.includes("city") || text.includes("valle")) return this.t("product.routeClassic", "Classic route");

    return `${this.t("product.itineraryOption", "Itinerary")} ${this.getAlphabeticIndex(index)}`;
  }

  getPackageOptionCommercialSummary(option, titles = []) {
    const cleanTitles = titles.filter(Boolean);
    if (!cleanTitles.length) return this.t("product.routeSuggested", "Suggested route adjusted to your selected duration.");
    if (cleanTitles.length <= 4) return cleanTitles.join(" · ");
    return `${cleanTitles.slice(0, 4).join(" · ")} · +${cleanTitles.length - 4} ${this.t("product.more", "more")}`;
  }

  getPackageOptionDifficultyLabel(option, titles = []) {
    const text = this.normalizePlainText([...titles, ...this.getPackageOptionCodes(option), option?.generationReason].join(" "));
    const hasHumantay = text.includes("humantay");
    const hasMountain = text.includes("colores") || text.includes("vinicunca") || text.includes("palcoyo") || text.includes("cuz006") || text.includes("cuz007");
    const hasVip = text.includes("vip") || text.includes("completa");

    if (hasHumantay && hasMountain) return this.t("product.paceHighNature", "High pace · more nature and hiking");
    if (hasHumantay || hasMountain) return this.t("product.paceMediumHigh", "Medium/high pace · includes a scenic hike");
    if (hasVip) return this.t("product.paceComplete", "Complete pace · more Sacred Valley visits");
    if (text.includes("conexion")) return this.t("product.paceEfficient", "Efficient pace · fewer repeated transfers");
    return this.t("product.paceComfortable", "Comfortable pace · ideal for a first visit");
  }

  getPackageOptionCommercialDescription(option, titles = []) {
    const text = this.normalizePlainText([...titles, ...this.getPackageOptionCodes(option), option?.generationReason, option?.connectionMode, option?.sacredValleyMode].join(" "));
    const hasMachu = text.includes("machu") || text.includes("mapi");
    const hasValley = text.includes("valle") || text.includes("cuz002") || text.includes("cuz003");
    const hasHumantay = text.includes("humantay") || text.includes("cuz005");
    const hasMountain = text.includes("colores") || text.includes("vinicunca") || text.includes("palcoyo") || text.includes("cuz006") || text.includes("cuz007");

    if (hasHumantay && hasMountain) {
      return this.t("product.routeDescriptionIntenseNature", "Designed for travelers who want Cusco's strongest natural landscapes, with hiking days and balanced rest.");
    }

    if (hasHumantay || hasMountain) {
      return this.t("product.routeDescriptionAdventure", "Combines cultural essentials with a nature outing to add variety without making the trip too heavy.");
    }

    if (option?.connectionMode === "sacred-valley-connection" || option?.sacredValleyMode === "connection" || text.includes("conexion")) {
      return this.t("product.routeDescriptionConnection", "Efficient route connecting the Sacred Valley with Machu Picchu and reducing repeated transfers.");
    }

    if (hasMachu && hasValley) {
      return this.t("product.routeDescriptionClassic", "Balanced option to visit Cusco, the Sacred Valley and Machu Picchu at a comfortable pace.");
    }

    return this.t("product.routeDescriptionSuggested", "Suggested route based on duration, arrival times and the package's main experiences.");
  }

  getAlphabeticIndex(index) {
    const value = Number(index || 0);
    return String.fromCharCode(65 + Math.max(0, value % 26));
  }

  normalizePlainText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  selectDynamicPackageOption(index = 0) {
    const option = this.packageOptions[index];

    if (!option) return;

    this.selectedPackageOption = option;
    this.selectedPackageOptionIndex = index;
    this.selectedPackageExtraCodes = [];
    this.packageContent = null;
    this.dynamicQuote = null;

    this.updatePackageOptionUrl(index);
    this.renderDynamicPackageOptions();

    document.querySelectorAll("[data-package-option-index]").forEach((button) => {
      button.classList.toggle(
        "is-selected",
        Number(button.dataset.packageOptionIndex || 0) === index
      );
      button.setAttribute("aria-pressed", Number(button.dataset.packageOptionIndex || 0) === index ? "true" : "false");
    });

    this.renderDynamicPackageItinerary();
    this.resolveDynamicAccommodationPlan();
    this.renderDynamicPackageContent();
    this.refreshAccommodationSelections();
    this.updatePricing();
  }

  updatePackageOptionUrl(index) {
    if (!window.history?.replaceState) return;

    const url = new URL(window.location.href);
    url.searchParams.set("option", String(index));
    window.history.replaceState({}, "", url.toString());
  }

  renderDynamicPackageItinerary() {
    if (!this.selectedPackageOption || !window.MyCuscoTripItineraryBuilder) return;

    this.selectedItinerary = window.MyCuscoTripItineraryBuilder.buildItinerary(
      this.selectedPackageOption,
      {
        mode: "showcase",
        arrivalTime: "09:00",
        departureTime: "20:00",
        packagesCusco: this.allData?.data?.packagesCusco,
        itineraryHints: this.selectedPackageOption.itineraryHints || {}
      }
    );

    const target = document.getElementById("productItinerary");

    if (!target) return;

    target.innerHTML = this.selectedItinerary.map((day) => {
      const dayImages = this.collectDynamicDayImages(day).slice(0, 1);

      return `
        <div class="experience-itinerary-item experience-itinerary-item--visual experience-itinerary-item--day">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">${this.t("product.day", "Day")} ${this.escapeHtml(day.day)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="${this.escapeHtml(day.day)}" ${this.getItineraryDateLabel(day.day) ? "" : "hidden"}>${this.escapeHtml(this.getItineraryDateLabel(day.day))}</span>
            </div>
            ${(day.items || []).map((item) => `
              <p>
                <strong>${this.escapeHtml(item.title || this.t("product.activity", "Activity"))}</strong>
                ${item.description ? `<br>${this.escapeHtml(item.description)}` : ""}
                ${item.duration ? `<br><small>${this.escapeHtml(item.duration)}</small>` : ""}
              </p>
            `).join("")}
          </div>
          ${this.renderItineraryMedia(dayImages, `${this.t("product.day", "Day")} ${day.day}`)}
        </div>
      `;
    }).join("");
  }

  resolveDynamicAccommodationPlan() {
    if (!this.selectedPackageOption || !window.MyCuscoTripHotelService) {
      this.accommodationPlan = [];
      return;
    }

    this.accommodationPlan = window.MyCuscoTripHotelService.resolveAccommodationPlan(
      this.selectedPackageOption,
      this.selectedItinerary,
      {
        adults: this.adults,
        children: this.children
      },
      this.allData
    );

    this.product.accommodationSummary = this.accommodationPlan.map((item) => ({
      destination: item.destination,
      nights: item.nights,
      label: `${item.label} - ${item.nights} noche${item.nights === 1 ? "" : "s"}`
    }));
  }

  renderDynamicPackageContent() {
    if (!this.selectedPackageOption || !window.MyCuscoTripPackageContentService) return;

    const content = window.MyCuscoTripPackageContentService.buildPackageContent(
      this.selectedPackageOption,
      {
        accommodationPlan: this.accommodationPlan,
        selectedExtraCodes: this.selectedPackageExtraCodes
      }
    );

    this.packageContent = content;

    this.renderIncludes(content.includes || []);
    this.renderExcludes(content.excludes || []);
    this.renderDynamicPackageExtras(content);
  }

  renderDynamicPackageExtras(content) {
    const section = document.getElementById("extrasSection");
    const container = document.getElementById("extrasContainer");

    if (!section || !container) return;

    const extras = Array.isArray(content?.extras) ? content.extras : [];

    if (!extras.length) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }

    section.hidden = false;

    const allInclusiveChecked =
      Array.isArray(content.recommendedExtraCodes) &&
      content.recommendedExtraCodes.length > 0 &&
      content.recommendedExtraCodes.every((code) => this.selectedPackageExtraCodes.includes(code));

    container.innerHTML = `
      <div class="booking-extra-all-inclusive">
        ${content.allInclusiveAvailable ? `
          <label class="booking-extra-item booking-extra-item--all-inclusive" for="package-all-inclusive">
            <input
              type="checkbox"
              id="package-all-inclusive"
              ${allInclusiveChecked ? "checked" : ""}
            />
            <div class="booking-extra-text">
              <strong>${this.escapeHtml(this.t("product.allInclusiveServices", "All-inclusive services"))}</strong>
              <small>${this.escapeHtml(this.t("product.allInclusiveServicesText", "Automatically add recommended tickets, entrance fees, lunches and services."))}</small>
            </div>
          </label>
        ` : ""}
      </div>

      ${extras.map((extra) => `
        <label class="booking-extra-item" for="package-extra-${this.escapeHtml(extra.code)}">
          <input
            type="checkbox"
            id="package-extra-${this.escapeHtml(extra.code)}"
            data-package-extra-code="${this.escapeHtml(extra.code)}"
            ${this.selectedPackageExtraCodes.includes(extra.code) ? "checked" : ""}
          />
          <div class="booking-extra-text">
            <strong>${this.escapeHtml(extra.label || extra.code || this.t("product.additionalService", "Additional service"))}</strong>
            <small>
              ${extra.recommended ? this.escapeHtml(this.t("product.recommended", "Recommended")) : this.escapeHtml(this.t("product.optional", "Optional"))}
              ${extra.sourceTourTitle ? ` · ${this.escapeHtml(extra.sourceTourTitle)}` : ""}
            </small>
          </div>
        </label>
      `).join("")}
    `;

    container.querySelectorAll("[data-package-extra-code]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const code = checkbox.dataset.packageExtraCode;

        if (!code) return;

        if (checkbox.checked) {
          this.selectedPackageExtraCodes = Array.from(new Set([
            ...this.selectedPackageExtraCodes,
            code
          ]));
        } else {
          this.selectedPackageExtraCodes = this.selectedPackageExtraCodes.filter((item) => item !== code);
        }

        this.renderDynamicPackageContent();
        this.updatePricing();
      });
    });

    const allInclusive = document.getElementById("package-all-inclusive");

    allInclusive?.addEventListener("change", () => {
      if (allInclusive.checked) {
        this.selectedPackageExtraCodes = window.MyCuscoTripPackageContentService.applyAllInclusive(
          this.selectedPackageOption
        );
      } else {
        this.selectedPackageExtraCodes = [];
      }

      this.renderDynamicPackageContent();
      this.updatePricing();
    });
  }

  getSelectedDynamicPackageExtras() {
    if (!this.selectedPackageOption || !window.MyCuscoTripPackageContentService) return [];

    return window.MyCuscoTripPackageContentService
      .getSelectedExtras(this.selectedPackageOption, this.selectedPackageExtraCodes)
      .map((extra) => extra.raw || extra);
  }

  createDynamicSection(id, afterElementId) {
    const existing = document.getElementById(id);

    if (existing) return existing;

    const reference = document.getElementById(afterElementId);

    if (!reference || !reference.parentNode) return null;

    const section = document.createElement("div");
    section.id = id;
    reference.parentNode.insertBefore(section, reference.nextSibling);

    return section;
  }
  renderNotFound(message) {
    const main = document.querySelector(".product-page");

    if (!main) return;

    main.innerHTML = `
      <section class="experience-content">
        <div class="container">
          <div class="experience-card">
            <h1>${this.escapeHtml(this.t("product.experienceUnavailable", "Experience unavailable"))}</h1>
            <p>${this.escapeHtml(message)}</p>
            <br />
            <a class="btn" href="${this.resolvePath("all-experiences.html")}">${this.escapeHtml(this.t("product.viewAllExperiences", "View all experiences"))}</a>
          </div>
        </div>
      </section>
    `;
  }

  isPackage(product) {
    if (!product) return false;
    if (product.productKind === "package") return true;
    if (product.category === "paquetes") return true;
    if (typeof product.type === "string" && product.type.toLowerCase().includes("package")) return true;
    if (typeof product.productFamily === "string" && product.productFamily.toLowerCase().includes("package")) return true;
    if (Array.isArray(product.accommodationPlan) && product.accommodationPlan.length > 0) return true;
    if (Array.isArray(product.accommodationSummary) && product.accommodationSummary.length > 0) return true;
    return false;
  }

  getAccommodationSummary(product) {
    if (!product) return [];

    if (Array.isArray(product.accommodationSummary) && product.accommodationSummary.length) {
      return product.accommodationSummary
        .map((item) => ({
          destination: item.destination,
          nights: Number(item.nights || 0),
          label: item.label || `${this.getDestinationLabel(item.destination)} - ${item.nights || 0} noche(s)`
        }))
        .filter((item) => item.destination && item.nights > 0);
    }

    if (Array.isArray(product.accommodationPlan) && product.accommodationPlan.length) {
      const grouped = product.accommodationPlan.reduce((acc, item) => {
        const destination = item.destination;

        if (!destination) return acc;

        if (!acc[destination]) {
          acc[destination] = {
            destination,
            nights: 0,
            label: this.getDestinationLabel(destination)
          };
        }

        acc[destination].nights += 1;

        return acc;
      }, {});

      return Object.values(grouped).map((item) => ({
        destination: item.destination,
        nights: item.nights,
        label: `${item.label} - ${item.nights} noche${item.nights > 1 ? "s" : ""}`
      }));
    }

    return [];
  }

  getHotelsByDestination(destination) {
    const resolvedDestination =
      window.MyCuscoTripDestinationService && this.allData
        ? window.MyCuscoTripDestinationService.resolveHotelDestination(destination, this.allData)
        : destination;

    return this.hotelsData?.destinations?.[resolvedDestination]?.hotels || [];
  }

  getHotelByCode(destination, hotelCode) {
    return this.getHotelsByDestination(destination).find((hotel) => hotel.hotelCode === hotelCode) || null;
  }

  getDefaultHotelCodeForDestination(destination) {
    const normalized = String(destination || "").toLowerCase();

    if (normalized.includes("cusco")) return "cusco-boutique";
    if (normalized.includes("aguas")) return "luz-garden";
    if (normalized.includes("machu")) return "luz-garden";

    return "";
  }

  getSelectedAccommodationForDestination(destination) {
    const hotelCode = this.selectedHotelsByDestination[destination];

    if (!hotelCode || hotelCode === "no-hotel") {
      return {
        hotel: null,
        combination: null
      };
    }

    const hotel = this.getHotelByCode(destination, hotelCode);
    const combination = this.selectedCombinationsByDestination[destination] || null;

    return {
      hotel,
      combination
    };
  }

  getTotalPassengers() {
    return this.adults + this.children;
  }

  normalizeRoomDefinition(room) {
    return {
      roomType: String(room.roomType || ""),
      label: room.label || room.roomType || this.t("quote.room", "Habitación"),
      bedType: room.bedType || "",
      capacity: Number(room.capacity || 0),
      pricePerNight: Number(
        room.pricePerNight ??
        room.publishedPricing?.amount ??
        room.price?.amount ??
        0
      ),
      helperText: room.helperText || "",
      publishedPricing: room.publishedPricing || null
    };
  }

  generateAccommodationCombinations(rooms, passengers, nights) {
    const defs = (Array.isArray(rooms) ? rooms : [])
      .map((room) => this.normalizeRoomDefinition(room))
      .filter((room) => room.capacity > 0 && room.pricePerNight >= 0)
      .sort((a, b) => a.capacity - b.capacity || a.pricePerNight - b.pricePerNight);

    if (!defs.length || passengers <= 0) return [];

    const results = [];
    const seen = new Set();

    const backtrack = (index, remainingPassengers, currentCounts) => {
      if (index === defs.length) {
        if (remainingPassengers === 0) {
          const used = currentCounts
            .map((count, i) => ({
              room: defs[i],
              count
            }))
            .filter((entry) => entry.count > 0);

          if (!used.length) return;

          const key = used
            .map((entry) => `${entry.room.roomType}:${entry.count}`)
            .join("|");

          if (seen.has(key)) return;

          seen.add(key);

          const totalRooms = used.reduce((sum, entry) => sum + entry.count, 0);

          const totalPerNight = used.reduce(
            (sum, entry) => sum + (entry.room.pricePerNight * entry.count),
            0
          );

          const totalForStay = totalPerNight * Number(nights || 0);
          const additionalPerPerson = passengers > 0 ? totalForStay / passengers : 0;

          results.push({
            key,
            rooms: used.map((entry) => ({
              roomType: entry.room.roomType,
              label: entry.room.label,
              bedType: entry.room.bedType,
              capacity: entry.room.capacity,
              pricePerNight: entry.room.pricePerNight,
              count: entry.count,
              helperText: entry.room.helperText,
              publishedPricing: entry.room.publishedPricing || null
            })),
            totalRooms,
            totalPerNight,
            totalForStay,
            additionalPerPerson,
            label: this.buildCombinationLabel(used),
            helperText: used[0]?.room?.helperText || ""
          });
        }

        return;
      }

      const room = defs[index];
      const maxCount = Math.ceil(remainingPassengers / room.capacity);

      for (let count = 0; count <= maxCount; count += 1) {
        const covered = count * room.capacity;

        if (covered > remainingPassengers) break;

        currentCounts[index] = count;
        backtrack(index + 1, remainingPassengers - covered, currentCounts);
      }

      currentCounts[index] = 0;
    };

    backtrack(0, passengers, new Array(defs.length).fill(0));

    return results.sort((a, b) => {
      if (a.totalPerNight !== b.totalPerNight) return a.totalPerNight - b.totalPerNight;
      if (a.totalRooms !== b.totalRooms) return a.totalRooms - b.totalRooms;
      return a.label.localeCompare(b.label, "es");
    });
  }

  normalizeHotelTextKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  getLocalizedRoomDescriptor(descriptor) {
    const locale = this.getLocale();
    const key = this.normalizeHotelTextKey(descriptor)
      .replace(/^una?\s+/i, "")
      .replace(/^\d+\s+/i, "")
      .replace(/^habitaciones?\s+/i, "")
      .replace(/^habitacion\s+/i, "")
      .replace(/^cabana\s+/i, "")
      .trim();

    const labels = {
      simple: { es: "simple", en: "single", pt: "individual", fr: "individuelle", de: "Einzel", it: "singola", zh: "单人", ja: "シングル" },
      "doble twin": { es: "doble twin", en: "twin", pt: "duplo twin", fr: "lits jumeaux", de: "Zweibett", it: "doppia twin", zh: "双床", ja: "ツイン" },
      matrimonial: { es: "matrimonial", en: "double", pt: "casal", fr: "double", de: "Doppel", it: "matrimoniale", zh: "大床", ja: "ダブル" },
      triple: { es: "triple", en: "triple", pt: "triplo", fr: "triple", de: "Dreibett", it: "tripla", zh: "三人", ja: "トリプル" },
      familiar: { es: "familiar", en: "family", pt: "familiar", fr: "familiale", de: "Familien", it: "familiare", zh: "家庭", ja: "ファミリー" },
      "super familiar": { es: "súper familiar", en: "super family", pt: "super familiar", fr: "super familiale", de: "großes Familien", it: "super familiare", zh: "大型家庭", ja: "スーパーファミリー" },
      "matrimonial + cama adicional": { es: "matrimonial + cama adicional", en: "double + extra bed", pt: "casal + cama extra", fr: "double + lit supplémentaire", de: "Doppel + Zustellbett", it: "matrimoniale + letto extra", zh: "大床 + 加床", ja: "ダブル＋エキストラベッド" },
      "familiar cuadruple": { es: "familiar cuádruple", en: "quadruple family", pt: "familiar quádruplo", fr: "familiale quadruple", de: "Vierbett-Familien", it: "familiare quadrupla", zh: "四人家庭", ja: "4名用ファミリー" },
      "simple estandar": { es: "simple estándar", en: "standard single", pt: "individual standard", fr: "individuelle standard", de: "Standard-Einzel", it: "singola standard", zh: "标准单人", ja: "スタンダードシングル" },
      "doble estandar": { es: "doble estándar", en: "standard double", pt: "duplo standard", fr: "double standard", de: "Standard-Doppel", it: "doppia standard", zh: "标准大床", ja: "スタンダードダブル" },
      "doble twin estandar": { es: "doble twin estándar", en: "standard twin", pt: "duplo twin standard", fr: "lits jumeaux standard", de: "Standard-Zweibett", it: "doppia twin standard", zh: "标准双床", ja: "スタンダードツイン" },
      "superior doble": { es: "superior doble", en: "superior double", pt: "superior duplo", fr: "double supérieure", de: "Superior-Doppel", it: "doppia superior", zh: "高级大床", ja: "スーペリアダブル" },
      "superior matrimonial": { es: "superior matrimonial", en: "superior double", pt: "superior casal", fr: "double supérieure", de: "Superior-Doppel", it: "matrimoniale superior", zh: "高级大床", ja: "スーペリアダブル" },
      "superior doble twin": { es: "superior doble twin", en: "superior twin", pt: "superior twin", fr: "lits jumeaux supérieure", de: "Superior-Zweibett", it: "superior twin", zh: "高级双床", ja: "スーペリアツイン" },
      "triple estandar": { es: "triple estándar", en: "standard triple", pt: "triplo standard", fr: "triple standard", de: "Standard-Dreibett", it: "tripla standard", zh: "标准三人", ja: "スタンダードトリプル" },
      "cuadruple estandar": { es: "cuádruple estándar", en: "standard quadruple", pt: "quádruplo standard", fr: "quadruple standard", de: "Standard-Vierbett", it: "quadrupla standard", zh: "标准四人", ja: "スタンダード4名用" }
    };

    return labels[key]?.[locale] || labels[key]?.es || descriptor;
  }

  formatRoomLabel(label) {
    const normalized = String(label || this.t("product.room", "habitación")).trim().replace(/\s+/g, " ");
    if (!normalized) return this.t("product.room", "habitación");

    const cleaned = normalized
      .replace(/^una?\s+/i, "")
      .replace(/^\d+\s+/i, "")
      .replace(/^habitaciones?\s+/i, "")
      .replace(/^habitación\s+/i, "")
      .replace(/^cabaña\s+/i, "")
      .trim();

    const localized = this.getLocalizedRoomDescriptor(cleaned || normalized);
    const locale = this.getLocale();

    return ["zh", "ja"].includes(locale) ? localized : localized.toLowerCase();
  }

  buildCombinationLabel(usedRooms) {
    return usedRooms
      .map((entry) => {
        if (entry.room.roomType === "no-hotel") {
          return entry.room.label;
        }

        const count = Number(entry.count || 0);
        const roomLabel = this.formatRoomLabel(entry.room.label);
        const roomWord = count === 1 ? this.t("product.room", "Room") : this.t("product.rooms", "Rooms");
        const quantity = String(count).padStart(2, "0");

        return `${quantity} ${roomWord} ${roomLabel}`;
      })
      .join(" + ");
  }

  refreshAccommodationSelections() {
    if (!this.product || !this.isPackage(this.product)) return;

    const summary = this.getAccommodationSummary(this.product);
    const passengers = this.getTotalPassengers();

    summary.forEach((item) => {
      const hotels = this.getHotelsByDestination(item.destination);

      const allHotels = [
        {
          hotelCode: "no-hotel",
          hotelName: this.t("product.noAccommodation", "No accommodation"),
          stars: 0,
          location: this.getDestinationLabel(item.destination),
          address: "",
          images: {
            cover: "",
            gallery: []
          },
          amenities: {
            checkin: "",
            checkout: "",
            breakfast: ""
          },
          rooms: [
            {
              roomType: "no-hotel",
              label: this.t("product.noHotelOption", "Choose the option without accommodation"),
              bedType: "",
              capacity: Math.max(passengers, 1),
              pricePerNight: 0,
              helperText: this.t("product.clientChoosesAccommodation", "El cliente seleccionará su propio alojamiento.")
            }
          ]
        },
        ...hotels
      ];

      let hotelCode = this.selectedHotelsByDestination[item.destination];

      if (!hotelCode) {
        this.selectedHotelsByDestination[item.destination] = "no-hotel";
        this.selectedCombinationsByDestination[item.destination] = null;
        return;
      }

      if (hotelCode === "no-hotel") {
        this.selectedCombinationsByDestination[item.destination] = null;
        return;
      }

      const hotel = allHotels.find((itemHotel) => itemHotel.hotelCode === hotelCode);

      if (!hotel) {
        this.selectedHotelsByDestination[item.destination] = "no-hotel";
        this.selectedCombinationsByDestination[item.destination] = null;
        return;
      }

      const combinations = this.generateAccommodationCombinations(
        hotel?.rooms || [],
        passengers,
        Number(item.nights || 0)
      );

      const selectedKey = this.selectedCombinationsByDestination[item.destination]?.key;
      const stillValid = combinations.find((combo) => combo.key === selectedKey);

      if (!stillValid) {
        this.selectedCombinationsByDestination[item.destination] = combinations[0] || null;
      }
    });

    this.renderAccommodationOptions(this.product);
    this.bindAccommodationEvents();
  }

  renderRoomTypeSummary() {
    return;
  }

  renderSelectedHotelGallery() {
    return;
  }

  renderStars(stars) {
    const total = Number(stars || 0);

    if (total <= 0) return "";

    return "★".repeat(total);
  }

  getDestinationLabel(destination) {
    const resolvedDestination =
      window.MyCuscoTripDestinationService && this.allData
        ? window.MyCuscoTripDestinationService.resolveHotelDestination(destination, this.allData)
        : destination;

    if (window.MyCuscoTripDestinationService && this.allData) {
      return window.MyCuscoTripDestinationService.getDestinationLabel(resolvedDestination, this.allData);
    }

    return this.hotelsData?.destinations?.[resolvedDestination]?.label || resolvedDestination || "Destino";
  }

  resolvePath(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/")) return path;

    let cleanPath = String(path).replace(/^\.?\//, "");
    const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    const localizable = ["tours-cusco.json", "tours-machu-picchu.json", "tours-peru.json", "trekkings-cusco.json", "packages-cusco.json", "packages-peru.json", "private-packages.json", "destinations.json"];
    const filename = cleanPath.split("/").pop();
    if (locale !== "es" && cleanPath.startsWith("assets/data/") && localizable.includes(filename)) {
      cleanPath = `assets/data/i18n/${locale}/${filename}`;
    }
    if (locale !== "es" && !cleanPath.startsWith("assets/") && (cleanPath.endsWith(".html") || cleanPath.includes(".html?"))) {
      cleanPath = `${locale}/${cleanPath}`;
    }
    return `${this.basePath}${cleanPath}`;
  }

  resolveAssetPath(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;

    return this.resolvePath(path);
  }

  setText(id, value) {
    const el = document.getElementById(id);

    if (el) el.textContent = value;
  }

  formatMoney(value) {
    if (window.MyCuscoTripCurrencyService && this.allData && this.product?.currency) {
      return window.MyCuscoTripCurrencyService
        .formatMoney(value, this.product.currency, this.allData)
        .replace(`${this.product.currency} `, "")
        .replace("US$ ", "")
        .replace("S/ ", "");
    }

    return Number(value || 0).toFixed(2);
  }

  escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  let started = false;
  const startProductPage = () => {
    if (started) return;
    started = true;
    window.MyCuscoTripProductPage = new MyCuscoTripProductPage();
  };

  if (window.MyCuscoTripI18n?.dictionary && Object.keys(window.MyCuscoTripI18n.dictionary).length) {
    startProductPage();
    return;
  }

  window.addEventListener("mct:i18n-ready", startProductPage, { once: true });
  window.setTimeout(startProductPage, 900);
});

/* =========================================================
   PATCH MCT 2026-05-14 - Detalle comercial para Paquetes Perú
   ========================================================= */
(function () {
  if (typeof MyCuscoTripProductPage === "undefined") return;

  MyCuscoTripProductPage.prototype.renderHighlights = function (product) {
    const target = document.getElementById("productHighlights");
    if (!target) return;

    const customHighlights = Array.isArray(product?.highlights) ? product.highlights : [];
    const experienceType = Array.isArray(product?.experienceType) ? product.experienceType.join(" · ") : (product?.typeLabel || "");
    const details = Array.isArray(product?.details) ? product.details : [];
    const capacity = product?.capacity || product?.duration?.maxGroupSize || "";

    const highlights = customHighlights.length
      ? [
          ...customHighlights,
          experienceType ? `${this.t("product.travelStyle", "Travel style")}: ${experienceType}` : null,
          product?.duration?.label ? `${this.t("product.duration", "Duration")}: ${product.duration.label}` : null,
          capacity ? this.t("product.groupUpTo", "Group service for up to {count} travelers", { count: capacity }) : null,
          ...details
        ].filter(Boolean)
      : [
          product?.shortDescription,
          product?.duration?.label ? `${this.t("product.duration", "Duration")}: ${product.duration.label}` : null,
          experienceType ? `${this.t("product.travelStyle", "Travel style")}: ${experienceType}` : null,
          product?.duration?.guideLanguages?.length ? `${this.t("product.languages", "Languages")}: ${this.formatGuideLanguages(product.duration.guideLanguages)}` : null
        ].filter(Boolean);

    target.innerHTML = highlights.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("");
  };

  MyCuscoTripProductPage.prototype.renderFaq = function (items) {
    const target = document.getElementById("productFaq");
    if (!target) return;

    if (!items.length) {
      target.innerHTML = `<p>${this.escapeHtml(this.t("product.faqPending", "Frequently asked questions will be added soon."))}</p>`;
      return;
    }

    target.innerHTML = items.map((item) => `
      <details class="experience-faq-item">
        <summary>${this.escapeHtml(item.q || item.question || this.t("product.question", "Question"))}</summary>
        <p>${this.escapeHtml(item.a || item.answer || "")}</p>
      </details>
    `).join("");
  };

  MyCuscoTripProductPage.prototype.renderPeruPackageFallback = function (product) {
    const packageOptionsTarget = document.getElementById("packageOptions");
    const itineraryTarget = document.getElementById("productItinerary");
    const paypalButton = document.getElementById("paypalButton");

    if (packageOptionsTarget) packageOptionsTarget.innerHTML = "";
    if (paypalButton) paypalButton.textContent = this.t("product.requestQuote", "Request a quote");
    if (!itineraryTarget) return;

    const itinerary = Array.isArray(product?.dailyItinerary) && product.dailyItinerary.length
      ? product.dailyItinerary
      : Array.isArray(product?.itinerary) ? product.itinerary : [];

    if (itinerary.length) {
      this.renderItinerary(itinerary);
      const pickupInfo = product.pickupInfo ? `
        <details class="experience-itinerary-item experience-itinerary-disclosure">
          <summary>${this.t("product.pickupMeeting", "Pickup & Trip Coordination")}</summary>
          <p>${this.escapeHtml(product.pickupInfo)}</p>
        </details>` : "";
      const important = Array.isArray(product.importantInfo) && product.importantInfo.length ? `
        <details class="experience-itinerary-item experience-itinerary-disclosure">
          <summary>${this.t("product.importantInfo", "Important Information Before You Travel")}</summary>
          <ul class="experience-itinerary-list">${product.importantInfo.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("")}</ul>
        </details>` : "";
      itineraryTarget.insertAdjacentHTML("beforeend", `${pickupInfo}${important}`);
      return;
    }

    itineraryTarget.innerHTML = `
      <div class="experience-itinerary-item">
        <h3>${this.t("product.routeSuggested", "Suggested route")}</h3>
        <p>${this.escapeHtml(product.shortDescription || product.description || this.t("product.multidestinationPackage", "Multi-destination package prepared for a personalized quote."))}</p>
      </div>
    `;
  };
})();

/* =========================================================
   PATCH MCT 2026-06-23 - Machu Picchu clásico: UX de trenes,
   reserva recuperable y revisión previa al pago
   ========================================================= */
(function () {
  if (typeof MyCuscoTripProductPage === "undefined") return;

  const proto = MyCuscoTripProductPage.prototype;
  const originalInit = proto.init;
  const originalRenderProduct = proto.renderProduct;

  proto.init = async function () {
    const paymentState = String(this.params.get("payment") || "").toLowerCase();
    const reservationCode = String(this.params.get("reservationCode") || "").trim();

    if (!this.slug && reservationCode && paymentState.includes("cancel")) {
      const record = this.getLocalReservation?.(reservationCode);
      const payload = record?.payload || record;
      const recoveredSlug = payload?.productSlug || payload?.summary?.productSlug || payload?.product?.slug || "";

      if (recoveredSlug) {
        this.slug = recoveredSlug;
        this.params.set("slug", recoveredSlug);
        this.restoredPaymentRecord = record;
        this.restoredPaymentPayload = payload;
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("slug", recoveredSlug);
          url.searchParams.set("payment", "cancelled");
          url.searchParams.set("reservationCode", reservationCode);
          window.history.replaceState({}, "", url.toString());
        } catch (error) {}
        const result = await originalInit.call(this);
        this.applyRestoredReservationToPage?.(record);
        this.showPaymentReturnNotice?.("cancelled", reservationCode, record);
        return result;
      }

      this.renderNotFound(
        `La reserva ${this.escapeHtml(reservationCode)} no pudo recuperarse en este navegador. Si el cliente cerró sesión, cambió de dispositivo o limpió datos del navegador, conviene buscar la reserva en el backend por código o correo.`
      );
      return;
    }

    const result = await originalInit.call(this);

    if (reservationCode && paymentState.includes("cancel")) {
      const record = this.getLocalReservation?.(reservationCode);
      if (record) {
        this.applyRestoredReservationToPage?.(record);
      }
      this.showPaymentReturnNotice?.("cancelled", reservationCode, record);
    }

    return result;
  };

  proto.renderProduct = function (product) {
    originalRenderProduct.call(this, product);
    this.applyProductCommercialTexts?.(product);
  };

  proto.applyProductCommercialTexts = function (product) {
    const benefits = product?.commercialBenefits || product?.raw?.commercialBenefits || null;
    if (benefits) {
      const benefitItems = document.querySelectorAll(".experience-benefits .benefit-item p");
      if (benefitItems[0] && benefits.flexibleBookingText) benefitItems[0].textContent = benefits.flexibleBookingText;
      if (benefitItems[1] && benefits.quickConfirmationText) benefitItems[1].textContent = benefits.quickConfirmationText;
      if (benefitItems[2] && benefits.personalSupportText) benefitItems[2].textContent = benefits.personalSupportText;
    }

    const pickupInfo = product?.pickupInfo || product?.raw?.pickupInfo || "";
    const importantInfo = product?.importantInfo || product?.raw?.importantInfo || "";
    const accordions = document.querySelectorAll(".experience-accordion-group .experience-accordion");
    accordions.forEach((item) => {
      const summaryText = String(item.querySelector("summary")?.textContent || "").toLowerCase();
      const box = item.querySelector(".experience-note-box");
      if (!box) return;
      if (pickupInfo && (summaryText.includes("recojo") || summaryText.includes("pickup"))) {
        box.innerHTML = `<p>${this.escapeHtml(pickupInfo)}</p>`;
      }
      if (importantInfo && (summaryText.includes("importante") || summaryText.includes("important"))) {
        const list = Array.isArray(importantInfo) ? importantInfo : [importantInfo];
        box.innerHTML = `<ul>${list.map((entry) => `<li>${this.escapeHtml(entry)}</li>`).join("")}</ul>`;
      }
    });
  };

  proto.renderHighlights = function (product) {
    const target = document.getElementById("productHighlights");
    const card = target?.closest(".experience-card");
    if (!target) return;

    if (product?.hideHighlights === true || product?.raw?.hideHighlights === true) {
      target.innerHTML = "";
      if (card) card.hidden = true;
      return;
    }

    if (card) card.hidden = false;
    const customHighlights = Array.isArray(product?.highlights) ? product.highlights : [];
    const experienceType = Array.isArray(product?.experienceType) ? product.experienceType.join(" · ") : (product?.typeLabel || "");
    const details = Array.isArray(product?.details) ? product.details : [];
    const capacity = product?.capacity || product?.duration?.maxGroupSize || "";
    const highlights = customHighlights.length
      ? [
          ...customHighlights,
          experienceType ? `${this.t("product.travelStyle", "Travel style")}: ${experienceType}` : null,
          product?.duration?.label ? `${this.t("product.duration", "Duration")}: ${product.duration.label}` : null,
          capacity ? this.t("product.groupUpTo", "Group service for up to {count} travelers", { count: capacity }) : null,
          ...details
        ].filter(Boolean)
      : [
          product?.shortDescription,
          product?.duration?.label ? `${this.t("product.duration", "Duration")}: ${product.duration.label}` : null,
          experienceType ? `${this.t("product.travelStyle", "Travel style")}: ${experienceType}` : null,
          product?.duration?.guideLanguages?.length ? `${this.t("product.languages", "Languages")}: ${this.formatGuideLanguages(product.duration.guideLanguages)}` : null
        ].filter(Boolean);

    target.innerHTML = highlights.map((item) => `<li>${this.escapeHtml(item)}</li>`).join("");
  };

  proto.renderItinerary = function (items) {
    const target = document.getElementById("productItinerary");
    const packageOptions = document.getElementById("packageOptions");

    if (packageOptions && !this.isPackage(this.product)) {
      packageOptions.hidden = true;
      packageOptions.innerHTML = "";
    }

    if (!target) return;

    if (!Array.isArray(items) || !items.length) {
      target.innerHTML = `<p>${this.escapeHtml(this.t("product.itineraryPending", "Your detailed itinerary will be coordinated for your travel dates."))}</p>`;
      return;
    }

    const isSingleDayTour =
      !this.isPackage(this.product) &&
      Number(this.product?.days || this.product?.raw?.days || 1) <= 1 &&
      !items.some((item) => Number(item?.day || 1) > 1);

    if (isSingleDayTour) {
      const dayLabel = `${this.t("product.day", "Día")} 1`;
      const dateLabel = this.getItineraryDateLabel(1);
      target.innerHTML = `
        <div class="experience-itinerary-item experience-itinerary-item--day" data-itinerary-day="1">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">${this.escapeHtml(dayLabel)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="1" ${dateLabel ? "" : "hidden"}>${this.escapeHtml(dateLabel)}</span>
            </div>
            <h3 class="experience-itinerary-day-title">${this.escapeHtml(this.t("product.fullDayItinerary", "Itinerario detallado"))}</h3>
            <div class="experience-itinerary-timeline">
              ${items.map((item, index) => `
                <article class="experience-itinerary-activity">
                  <span class="experience-itinerary-time-pill">${this.escapeHtml(item.time || item.hour || `${this.t("product.step", "Paso")} ${index + 1}`)}</span>
                  <div>
                    <strong>${this.escapeHtml(item.title || `${this.t("product.step", "Paso")} ${index + 1}`)}</strong>
                    ${item.description ? `<p>${this.escapeHtml(item.description)}</p>` : ""}
                  </div>
                </article>
              `).join("")}
            </div>
          </div>
        </div>
      `;
      return;
    }

    target.innerHTML = items.map((item, index) => {
      const dayNumber = Number(item?.day || index + 1);
      const dayLabel = `${this.t("product.day", "Día")} ${dayNumber}`;
      const dateLabel = this.getItineraryDateLabel(dayNumber);
      const title = item.title || `${this.t("product.step", "Paso")} ${index + 1}`;
      const images = this.shouldShowTourItineraryImages()
        ? this.collectItineraryItemImages(item).slice(0, 1)
        : [];
      return `
        <div class="experience-itinerary-item ${images.length ? "experience-itinerary-item--visual" : ""}" data-itinerary-day="${this.escapeHtml(dayNumber)}">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">${this.escapeHtml(dayLabel)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="${this.escapeHtml(dayNumber)}" ${dateLabel ? "" : "hidden"}>${this.escapeHtml(dateLabel)}</span>
            </div>
            <h3 class="experience-itinerary-day-title">${this.escapeHtml(title)}</h3>
            ${item.time ? `<span class="experience-itinerary-time-pill">${this.escapeHtml(item.time)}</span>` : ""}
            <p>${this.escapeHtml(item.description || "")}</p>
          </div>
          ${this.renderItineraryMedia(images, title)}
        </div>
      `;
    }).join("");
  };

  proto.renderExtras = function (extras) {
    const section = document.getElementById("extrasSection");
    const container = document.getElementById("extrasContainer");
    if (!section || !container) return;

    if (!Array.isArray(extras) || !extras.length) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }

    section.hidden = false;
    const singleChoice = this.product?.extrasSelectionMode === "single" || this.product?.raw?.extrasSelectionMode === "single";
    const inputType = singleChoice ? "radio" : "checkbox";
    const inputName = singleChoice ? "tourExtraSingleChoice" : "tourExtra[]";

    container.innerHTML = `${singleChoice ? `
      <label class="booking-extra-item booking-extra-item--empty" for="extra-none">
        <input type="radio" id="extra-none" name="${inputName}" data-extra-code="" ${this.selectedExtras.size ? "" : "checked"} />
        <div class="booking-extra-text">
          <strong>Sin almuerzo adicional</strong>
          <small>${this.t("product.onlyOneLunchOption", "Puedes elegir solo una opción de almuerzo.")}</small>
        </div>
      </label>
    ` : ""}${extras.map((extra) => {
      const amount = Number(extra.price || extra.publishedPriceUSD || extra.publishedPricing?.amount || 0);
      const extraPrice = `${this.product.currency || "USD"} ${this.formatMoney(amount)}`;
      const checked = this.selectedExtras.has(extra.code) ? "checked" : "";
      return `
        <label class="booking-extra-item" for="extra-${this.escapeHtml(extra.code)}">
          <input type="${inputType}" name="${inputName}" id="extra-${this.escapeHtml(extra.code)}" data-extra-code="${this.escapeHtml(extra.code)}" ${checked} />
          <div class="booking-extra-text">
            <strong>${this.escapeHtml(extra.label)}</strong>
            <small>${extra.perPerson ? this.t("product.pricePerPerson", "Precio por persona") : this.t("product.pricePerBooking", "Precio por reserva")} · ${extraPrice}</small>
          </div>
        </label>
      `;
    }).join("")}`;

    container.querySelectorAll("input[data-extra-code]").forEach((input) => {
      input.addEventListener("change", () => {
        const code = input.dataset.extraCode || "";
        if (singleChoice) {
          this.selectedExtras.clear();
          if (input.checked && code) this.selectedExtras.add(code);
        } else if (input.checked) {
          this.selectedExtras.add(code);
        } else {
          this.selectedExtras.delete(code);
        }
        this.updatePricing();
      });
    });
  };

  proto.renderTrainSelectionOptions = function (product) {
    this.resetTrainSelectionState();
    const section = this.ensureTrainSelectionSection();
    const container = document.getElementById("trainSelectionContainer");
    const help = document.getElementById("trainSelectionHelp");
    const label = document.getElementById("trainSelectionLabel");

    if (!section || !container) return;
    section.hidden = true;
    container.innerHTML = "";
    if (help) help.textContent = "";
    if (label) label.hidden = true;

    if (!this.isTrainSelectionEnabled(product)) return;

    const trainCatalog = this.getTrainCatalog();
    const defaultSelection = this.getDefaultTrainSelection(product);
    const trainConfig = this.getTrainConfig(product);
    const sameCompanyOnly = this.shouldKeepSameTrainCompany(trainConfig);
    this.trainUpgradeSameCompanyOnly = sameCompanyOnly;

    this.availableOutboundTrains = this.getDirectionalTrains(trainCatalog, "outbound", defaultSelection.outboundTrainId)
      .filter((train) => this.isCommercialTrainForFullDay(train));
    this.availableReturnTrains = this.getDirectionalTrains(trainCatalog, "return", defaultSelection.returnTrainId)
      .filter((train) => this.isCommercialTrainForFullDay(train));

    const fallbackOutbound = this.createFallbackTrainOption(defaultSelection.outboundTrainId, this.t("product.trainOutboundIncluded", "Tren de ida incluido"));
    const fallbackReturn = this.createFallbackTrainOption(defaultSelection.returnTrainId, this.t("product.trainReturnIncluded", "Tren de retorno incluido"));
    if (!this.availableOutboundTrains.length && fallbackOutbound) this.availableOutboundTrains = [fallbackOutbound];
    if (!this.availableReturnTrains.length && fallbackReturn) this.availableReturnTrains = [fallbackReturn];
    if (!this.availableOutboundTrains.length && !this.availableReturnTrains.length) return;

    this.selectedOutboundTrainId = defaultSelection.outboundTrainId || this.availableOutboundTrains[0]?.id || "";
    const compatibleReturns = this.getCompatibleReturnTrains(sameCompanyOnly);
    this.selectedReturnTrainId = defaultSelection.returnTrainId || compatibleReturns[0]?.id || this.availableReturnTrains[0]?.id || "";

    section.hidden = false;
    section.classList.add("booking-field--train-upgrade");
    container.innerHTML = `
      <div class="booking-train-upgrade" data-train-selection>
        <div class="booking-train-upgrade__summary" id="trainUpgradeSummaryCards"></div>
        <button class="btn booking-secondary-btn booking-train-upgrade__button" id="openTrainUpgradeModal" type="button">
          <i class="fas fa-train"></i> Upgrade de trenes
        </button>
        <div id="trainSelectionSummary" class="booking-train-selection__summary"></div>
      </div>
    `;

    this.ensureTrainUpgradeModal();
    this.bindTrainUpgradeEvents();
    this.updateTrainSelectionState(sameCompanyOnly);
  };

  proto.isCommercialTrainForFullDay = function (train) {
    const category = String(train?.category || "").toLowerCase();
    if (!category || train?.isLocalTrain) return false;
    return !["hiram_bingham", "hiram-bingham", "first_class", "first-class", "local"].includes(category);
  };

  proto.calculateSelectedTrainAdjustmentTotal = function () {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    const outboundDiff = this.getTrainPositiveDifferencePerPerson(outbound, "outbound");
    const returnDiff = this.getTrainPositiveDifferencePerPerson(returning, "return");
    const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
    this.selectedTrainAdjustmentTotal = total;
    return total;
  };

  proto.getTrainPositiveDifferencePerPerson = function (train, direction) {
    const defaultSelection = this.getDefaultTrainSelection(this.product);
    const defaultId = direction === "outbound" ? defaultSelection.outboundTrainId : defaultSelection.returnTrainId;
    const defaultList = direction === "outbound" ? this.availableOutboundTrains : this.availableReturnTrains;
    const defaultTrain = this.findTrainById(defaultId, defaultList);
    if (!train || !defaultTrain) return 0;
    return Math.max(0, Number(train.price || 0) - Number(defaultTrain.price || 0));
  };

  proto.updateTrainSelectionState = function (sameCompanyOnly = this.trainUpgradeSameCompanyOnly) {
    const outbound = this.getSelectedOutboundTrain();
    let returning = this.getSelectedReturnTrain();
    const compatibleReturns = this.getCompatibleReturnTrains(sameCompanyOnly);

    if (compatibleReturns.length && !compatibleReturns.some((train) => train.id === this.selectedReturnTrainId)) {
      this.selectedReturnTrainId = compatibleReturns[0].id;
      returning = this.getSelectedReturnTrain();
    }

    const outboundDiff = this.getTrainPositiveDifferencePerPerson(outbound, "outbound");
    const returnDiff = this.getTrainPositiveDifferencePerPerson(returning, "return");
    this.selectedTrainAdjustmentTotal = (outboundDiff + returnDiff) * this.getTotalPassengers();

    const summaryCards = document.getElementById("trainUpgradeSummaryCards");
    if (summaryCards) {
      summaryCards.innerHTML = `
        ${this.renderTrainMiniSummary(this.t("booking.train.outbound", "Tren de ida"), outbound, outboundDiff)}
        ${this.renderTrainMiniSummary(this.t("booking.train.return", "Tren de retorno"), returning, returnDiff)}
      `;
    }

    const summary = document.getElementById("trainSelectionSummary");
    if (summary) {
      const adjustmentText = this.selectedTrainAdjustmentTotal > 0
        ? `${this.t("product.excessTotalLabel", "Excedente total")}: ${this.product?.currency || "USD"} ${this.formatMoney(this.selectedTrainAdjustmentTotal)}`
        : this.t("product.noExtraDifferenceIncludedTrains", "Sin excedente adicional frente a los trenes incluidos.");
      summary.innerHTML = `<strong>${this.escapeHtml(adjustmentText)}</strong>${sameCompanyOnly ? `<small>${this.escapeHtml(this.t("product.sameTrainCompanyNote", "La ida y el retorno se mantienen con la misma compañía de tren."))}</small>` : ""}`;
    }

    this.renderTrainUpgradeLists?.();
  };

  proto.renderTrainMiniSummary = function (title, train, diff) {
    if (!train) return "";
    const diffText = diff > 0 ? `+ ${this.product?.currency || "USD"} ${this.formatMoney(diff)} p/p` : this.t("product.includedShort", "Incluido");
    return `
      <button class="booking-train-mini" type="button" data-open-train-upgrade>
        <span>${this.escapeHtml(title)}</span>
        <strong>${this.escapeHtml(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong>
        <small>${this.escapeHtml(`${train.companyName || train.company || ""} · ${train.departureTime || ""} → ${train.arrivalTime || ""}`)}</small>
        <em>${this.escapeHtml(diffText)}</em>
      </button>
    `;
  };

  proto.ensureTrainUpgradeModal = function () {
    if (document.getElementById("trainUpgradeModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="train-upgrade-modal" hidden id="trainUpgradeModal">
        <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
        <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
          <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
          <header class="train-upgrade-modal__header">
            <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
            <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
            <span>${this.t("product.modal.chooseOutboundFirstAutoFilter", "Elige primero el tren de ida. El retorno se filtrará automáticamente por la misma compañía.")}</span>
          </header>
          <div class="train-upgrade-modal__body">
            <section>
              <h3>1. Tren de ida</h3>
              <div class="train-upgrade-modal__list" id="trainUpgradeOutboundList"></div>
            </section>
            <section>
              <h3>2. Tren de retorno</h3>
              <div class="train-upgrade-modal__list" id="trainUpgradeReturnList"></div>
            </section>
          </div>
          <footer class="train-upgrade-modal__footer">
            <div id="trainUpgradeFooterSummary"></div>
            <button class="btn booking-main-btn" type="button" data-close-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
          </footer>
        </div>
      </div>
    `);
  };

  proto.bindTrainUpgradeEvents = function () {
    const open = () => {
      this.renderTrainUpgradeLists();
      const modal = document.getElementById("trainUpgradeModal");
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("train-upgrade-modal-open");
    };
    document.getElementById("openTrainUpgradeModal")?.addEventListener("click", open);
    document.querySelectorAll("[data-open-train-upgrade]").forEach((button) => button.addEventListener("click", open));

    const modal = document.getElementById("trainUpgradeModal");
    if (!modal || modal.dataset.bound === "true") return;
    modal.dataset.bound = "true";

    modal.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close-train-upgrade]");
      if (close) {
        modal.hidden = true;
        document.body.classList.remove("train-upgrade-modal-open");
        return;
      }

      const option = event.target.closest("[data-train-upgrade-option]");
      if (!option) return;
      const direction = option.dataset.trainDirection;
      const id = option.dataset.trainId || "";
      if (direction === "outbound") {
        this.selectedOutboundTrainId = id;
        const compatible = this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly);
        if (!compatible.some((train) => train.id === this.selectedReturnTrainId)) {
          this.selectedReturnTrainId = compatible[0]?.id || "";
        }
      } else {
        this.selectedReturnTrainId = id;
      }
      this.updateTrainSelectionState(this.trainUpgradeSameCompanyOnly);
      this.updatePricing();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) {
        modal.hidden = true;
        document.body.classList.remove("train-upgrade-modal-open");
      }
    });
  };

  proto.renderTrainUpgradeLists = function () {
    const outboundList = document.getElementById("trainUpgradeOutboundList");
    const returnList = document.getElementById("trainUpgradeReturnList");
    if (!outboundList || !returnList) return;

    const compatibleReturns = this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly);
    outboundList.innerHTML = this.availableOutboundTrains.map((train) => this.renderTrainUpgradeCard(train, "outbound")).join("");
    returnList.innerHTML = compatibleReturns.map((train) => this.renderTrainUpgradeCard(train, "return")).join("");

    const footer = document.getElementById("trainUpgradeFooterSummary");
    if (footer) {
      const total = this.calculateSelectedTrainAdjustmentTotal();
      footer.innerHTML = total > 0
        ? `<strong>${this.t("product.excessUpgradeLabel", "Excedente por upgrade")}: ${this.product?.currency || "USD"} ${this.formatMoney(total)}</strong><small>${this.t("product.totalCalculatedForTravelers", "Total calculado para {n} viajero(s).", { n: this.getTotalPassengers() })}</small>`
        : `<strong>${this.t("product.noExtraSurcharge", "Sin excedente adicional")}</strong><small>${this.t("product.trainsNoIncreasePrice", "Los trenes seleccionados no incrementan el precio base.")}</small>`;
    }
  };

  proto.renderTrainUpgradeCard = function (train, direction) {
    const selectedId = direction === "outbound" ? this.selectedOutboundTrainId : this.selectedReturnTrainId;
    const selected = selectedId === train.id;
    const diff = this.getTrainPositiveDifferencePerPerson(train, direction);
    const diffText = diff > 0 ? `+ ${this.product?.currency || "USD"} ${this.formatMoney(diff)} por persona` : "Incluido / sin recargo";
    const logo = this.getTrainCompanyLogo(train.company);
    const departureStation = train.departureStation || train.raw?.departureStation || train.raw?.fromStation || "";
    const arrivalStation = train.arrivalStation || train.raw?.arrivalStation || train.raw?.toStation || "";
    const route = `${departureStation} → ${arrivalStation}`;
    const time = `${train.departureTime || ""} → ${train.arrivalTime || ""}`;
    return `
      <button type="button" class="train-upgrade-card ${selected ? "is-selected" : ""}" data-train-upgrade-option data-train-direction="${this.escapeHtml(direction)}" data-train-id="${this.escapeHtml(train.id)}" aria-pressed="${selected ? "true" : "false"}">
        <span class="train-upgrade-card__logo">${logo ? `<img src="${this.escapeHtml(logo)}" alt="${this.escapeHtml(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" />` : ""}</span>
        <span class="train-upgrade-card__body">
          <strong>${this.escapeHtml(train.label || this.t("product.touristTrain", "Tren turístico"))}</strong>
          <small>${this.escapeHtml(train.companyName || train.company || "")}</small>
          <em>${this.escapeHtml(time)}</em>
          <span>${this.escapeHtml(route)}</span>
        </span>
        <span class="train-upgrade-card__price">${this.escapeHtml(diffText)}</span>
      </button>
    `;
  };

  proto.getTrainCompanyLogo = function (company) {
    const value = String(company || "").toLowerCase();
    if (value.includes("inca")) return this.resolvePath("assets/img/trains/inca-rail.png");
    if (value.includes("peru")) return this.resolvePath("assets/img/trains/perurail.png");
    return "";
  };

  proto.getSelectedTrainSummaryLabel = function () {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    if (!outbound && !returning) return this.t("booking.notApplicable", "No aplica");
    const parts = [];
    if (outbound) parts.push(`Ida: ${outbound.label} ${outbound.departureTime || ""}`.trim());
    if (returning) parts.push(`Retorno: ${returning.label} ${returning.departureTime || ""}`.trim());
    return parts.join(" | ");
  };

  proto.persistLocalReservation = function (reservationCode, payload) {
    if (!reservationCode || !payload) return;
    const record = {
      reservationCode,
      productSlug: payload.productSlug || this.slug || "",
      updatedAt: new Date().toISOString(),
      payload: {
        ...payload,
        code: payload.code || reservationCode,
        productSlug: payload.productSlug || this.slug || ""
      }
    };
    try {
      const value = JSON.stringify(record);
      sessionStorage.setItem(`mct_pre_reservation_${reservationCode}`, value);
      localStorage.setItem(`mct_pre_reservation_${reservationCode}`, value);
      localStorage.setItem("mct_last_pre_reservation", value);
    } catch (error) {}
  };

  proto.getLocalReservation = function (reservationCode) {
    if (!reservationCode) return null;
    const keys = [
      `mct_pre_reservation_${reservationCode}`,
      `mct_pending_payment_${reservationCode}`
    ];
    for (const storage of [sessionStorage, localStorage]) {
      for (const key of keys) {
        try {
          const raw = storage.getItem(key);
          if (!raw) continue;
          return JSON.parse(raw);
        } catch (error) {}
      }
    }
    return null;
  };

  proto.applyRestoredReservationToPage = function (record) {
    const payload = record?.payload || record;
    if (!payload) return;

    if (Number(payload.adults) > 0) this.adults = Number(payload.adults);
    if (Number.isFinite(Number(payload.children))) this.children = Number(payload.children);
    this.updatePassengersUI?.();

    if (payload.selectedTrainIds?.outbound) this.selectedOutboundTrainId = payload.selectedTrainIds.outbound;
    if (payload.selectedTrainIds?.return) this.selectedReturnTrainId = payload.selectedTrainIds.return;

    if (Array.isArray(payload.selectedExtraCodes)) {
      this.selectedExtras = new Set(payload.selectedExtraCodes);
      document.querySelectorAll("[data-extra-code]").forEach((input) => {
        input.checked = this.selectedExtras.has(input.dataset.extraCode || "") || (!input.dataset.extraCode && this.selectedExtras.size === 0);
      });
    }

    if (payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
      this.date = payload.date;
      const input = document.getElementById("travelDate");
      if (input?._flatpickr) input._flatpickr.setDate(payload.date, false);
      else if (input) input.value = payload.date;
      this.refreshItineraryDates?.();
    }

    this.updateTrainSelectionState?.(this.trainUpgradeSameCompanyOnly);
    this.updatePricing?.();
  };

  proto.showPaymentReturnNotice = function (status, reservationCode, record) {
    const panel = document.querySelector(".booking-panel");
    if (!panel || document.getElementById("paymentReturnNotice")) return;
    const hasRecord = Boolean(record);
    const message = hasRecord
      ? `PayPal fue cancelado, pero la reserva ${reservationCode} se mantiene guardada en este navegador. Puedes revisar los datos, ajustar extras o trenes y volver a intentar el pago.`
      : `PayPal fue cancelado para la reserva ${reservationCode}. No se encontró una copia local completa; si esto ocurre en producción, el backend debe recuperar la reserva por código y correo.`;
    panel.insertAdjacentHTML("afterbegin", `
      <div class="payment-return-notice" id="paymentReturnNotice">
        <strong>Pago no completado</strong>
        <p>${this.escapeHtml(message)}</p>
      </div>
    `);
  };

  proto.getPhoneCodeOptionsHtml = function () {
    const countries = [
      ["Perú", "+51"], ["Estados Unidos / Canadá", "+1"], ["México", "+52"], ["Colombia", "+57"], ["Chile", "+56"], ["Argentina", "+54"], ["Brasil", "+55"], ["Bolivia", "+591"], ["Ecuador", "+593"], ["Uruguay", "+598"], ["Paraguay", "+595"], ["Venezuela", "+58"],
      ["España", "+34"], ["Reino Unido", "+44"], ["Francia", "+33"], ["Alemania", "+49"], ["Italia", "+39"], ["Portugal", "+351"], ["Países Bajos", "+31"], ["Bélgica", "+32"], ["Suiza", "+41"], ["Austria", "+43"], ["Irlanda", "+353"], ["Noruega", "+47"], ["Suecia", "+46"], ["Dinamarca", "+45"], ["Finlandia", "+358"], ["Polonia", "+48"], ["República Checa", "+420"], ["Hungría", "+36"], ["Grecia", "+30"], ["Rumanía", "+40"], ["Turquía", "+90"], ["Rusia", "+7"], ["Ucrania", "+380"],
      ["Australia", "+61"], ["Nueva Zelanda", "+64"], ["Japón", "+81"], ["China", "+86"], ["Hong Kong", "+852"], ["Taiwán", "+886"], ["Corea del Sur", "+82"], ["India", "+91"], ["Indonesia", "+62"], ["Tailandia", "+66"], ["Vietnam", "+84"], ["Filipinas", "+63"], ["Malasia", "+60"], ["Singapur", "+65"], ["Israel", "+972"], ["Emiratos Árabes Unidos", "+971"], ["Arabia Saudita", "+966"], ["Qatar", "+974"],
      ["Sudáfrica", "+27"], ["Marruecos", "+212"], ["Egipto", "+20"], ["Kenia", "+254"], ["Tanzania", "+255"], ["Ghana", "+233"], ["Nigeria", "+234"],
      ["Costa Rica", "+506"], ["Panamá", "+507"], ["Guatemala", "+502"], ["El Salvador", "+503"], ["Honduras", "+504"], ["Nicaragua", "+505"], ["República Dominicana", "+1"], ["Puerto Rico", "+1"], ["Cuba", "+53"], ["Jamaica", "+1"],
      ["Afganistán", "+93"], ["Albania", "+355"], ["Argelia", "+213"], ["Andorra", "+376"], ["Angola", "+244"], ["Antigua y Barbuda", "+1"], ["Armenia", "+374"], ["Azerbaiyán", "+994"], ["Bahamas", "+1"], ["Bangladés", "+880"], ["Barbados", "+1"], ["Baréin", "+973"], ["Belice", "+501"], ["Benín", "+229"], ["Bielorrusia", "+375"], ["Bosnia y Herzegovina", "+387"], ["Botsuana", "+267"], ["Brunéi", "+673"], ["Bulgaria", "+359"], ["Burkina Faso", "+226"], ["Burundi", "+257"], ["Bután", "+975"], ["Cabo Verde", "+238"], ["Camboya", "+855"], ["Camerún", "+237"], ["Catar", "+974"], ["Chad", "+235"], ["Chipre", "+357"], ["Comoras", "+269"], ["Congo", "+242"], ["Costa de Marfil", "+225"], ["Croacia", "+385"], ["Dominica", "+1"], ["Eritrea", "+291"], ["Eslovaquia", "+421"], ["Eslovenia", "+386"], ["Estonia", "+372"], ["Etiopía", "+251"], ["Fiyi", "+679"], ["Gabón", "+241"], ["Gambia", "+220"], ["Georgia", "+995"], ["Granada", "+1"], ["Guinea", "+224"], ["Guinea-Bisáu", "+245"], ["Guyana", "+592"], ["Haití", "+509"], ["Irán", "+98"], ["Irak", "+964"], ["Islandia", "+354"], ["Jordania", "+962"], ["Kazajistán", "+7"], ["Kirguistán", "+996"], ["Kuwait", "+965"], ["Laos", "+856"], ["Letonia", "+371"], ["Líbano", "+961"], ["Lituania", "+370"], ["Luxemburgo", "+352"], ["Madagascar", "+261"], ["Malaui", "+265"], ["Maldivas", "+960"], ["Malí", "+223"], ["Malta", "+356"], ["Mauricio", "+230"], ["Moldavia", "+373"], ["Mónaco", "+377"], ["Mongolia", "+976"], ["Montenegro", "+382"], ["Mozambique", "+258"], ["Myanmar", "+95"], ["Namibia", "+264"], ["Nepal", "+977"], ["Níger", "+227"], ["Omán", "+968"], ["Pakistán", "+92"], ["Palestina", "+970"], ["Papúa Nueva Guinea", "+675"], ["Ruanda", "+250"], ["Serbia", "+381"], ["Seychelles", "+248"], ["Sri Lanka", "+94"], ["Túnez", "+216"], ["Uganda", "+256"], ["Uzbekistán", "+998"], ["Zambia", "+260"], ["Zimbabue", "+263"]
    ];
    return countries.map(([country, code]) => `<option value="${this.escapeHtml(code)}" ${code === "+51" ? "selected" : ""}>${this.escapeHtml(code)} · ${this.escapeHtml(country)}</option>`).join("");
  };

  proto.populatePhoneCodeSelects = function (scope = document) {
    const options = this.getPhoneCodeOptionsHtml();
    scope.querySelectorAll?.("select[data-phone-code-select]").forEach((select) => {
      if (select.dataset.phoneCodesLoaded === "true") return;
      const current = select.value;
      select.innerHTML = options;
      if (current) select.value = current;
      select.dataset.phoneCodesLoaded = "true";
    });
  };

  proto.renderPaymentReviewStep = function (payload) {
    const review = document.getElementById("passengerCheckoutReview");
    if (!review) return;
    const pending = (payload.passengers || []).filter((p) => p.completionStatus === "pending");
    const provided = (payload.passengers || []).filter((p) => p.completionStatus !== "pending");
    const rows = [
      ["Experiencia", payload.productTitle],
      ["Fecha", payload.date],
      [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
      [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
      ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"],
      [this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal],
      ["Pagar ahora", payload.payNow],
      ["Saldo pendiente", payload.payLater]
    ];
    review.hidden = false;
    review.innerHTML = `
      <div class="passenger-review-card">
        <div class="passenger-review-card__header">
          <strong>Resumen antes de pagar</strong>
          <span>${this.t("product.modal.confirmBeforePaypal", "Confirma que todo esté correcto antes de ir a PayPal.")}</span>
        </div>
        <div class="passenger-review-grid">
          ${rows.map(([label, value]) => `<div><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value || "-")}</strong></div>`).join("")}
        </div>
        <div class="passenger-review-passengers">
          <strong>Datos de pasajeros</strong>
          <p>${provided.length} pasajero(s) con datos registrados. ${pending.length ? `${pending.length} pasajero(s) pendiente(s) para completar hasta 15 a 30 días antes del viaje.` : "No hay pasajeros pendientes."}</p>
        </div>
      </div>
    `;
    review.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
})();

/* Delegación para abrir el modal desde las tarjetas compactas que se re-renderizan dinámicamente. */
document.addEventListener("click", function (event) {
  const trigger = event.target.closest?.("[data-open-train-upgrade]");
  if (!trigger) return;
  const page = window.MyCuscoTripProductPage;
  if (!page?.renderTrainUpgradeLists) return;
  page.renderTrainUpgradeLists();
  const modal = document.getElementById("trainUpgradeModal");
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add("train-upgrade-modal-open");
});

/* =========================================================
   PATCH MCT V63 - SEO, UX modal trenes y checkout Machu Picchu
   ========================================================= */
(function () {
  if (typeof MyCuscoTripProductPage === "undefined") return;
  const proto = MyCuscoTripProductPage.prototype;
  const oldRenderProduct = proto.renderProduct;
  const oldRenderServiceModes = proto.renderServiceModes;
  const oldUpdatePricing = proto.updatePricing;
  const oldUpdateTrainSelectionState = proto.updateTrainSelectionState;

  function isClassicMachu(page) {
    return String(page.product?.slug || page.product?.raw?.slug || page.slug || "") === "machu-picchu-full-day-clasico";
  }

  proto.setOrCreateMeta = function (selector, attr, value) {
    if (!value) return;
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement("meta");
      if (selector.includes("property=")) {
        const match = selector.match(/property=[\"']([^\"']+)/);
        if (match) el.setAttribute("property", match[1]);
      } else if (selector.includes("name=")) {
        const match = selector.match(/name=[\"']([^\"']+)/);
        if (match) el.setAttribute("name", match[1]);
      }
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };

  proto.updateSeoMetaForProduct = function (product) {
    if (!product) return;
    const title = product.title || this.t("search.tourMachuPicchuClassic", "Machu Picchu Full Day Clásico");
    const desc = product.seoDescription || product.description || product.shortDescription || this.t("product.seoMachuFullDayDescription", "Tour a Machu Picchu desde Cusco con tren turístico, bus, ingreso oficial y guía profesional.");
    const cleanDesc = String(desc).replace(/\s+/g, " ").slice(0, 170);
    const slug = product.slug || this.slug || "machu-picchu-full-day-clasico";
    const url = `https://mycuscotrip.com/product.html?slug=${encodeURIComponent(slug)}`;
    const cover = product.images?.cover ? this.resolveAssetPath(product.images.cover) : "./public/machu-picchu-full-day-clasico-og-v69.jpg";
    const image = slug === "machu-picchu-full-day-clasico"
      ? "https://mycuscotrip.com/public/machu-picchu-full-day-clasico-og-v69.jpg"
      : new URL(cover, "https://mycuscotrip.com/").href;

    document.title = `${title} | My Cusco Trip`;
    this.setOrCreateMeta('meta[name="description"]', "content", cleanDesc);
    this.setOrCreateMeta('meta[property="og:url"]', "content", url);
    this.setOrCreateMeta('meta[property="og:title"]', "content", `${title} | My Cusco Trip`);
    this.setOrCreateMeta('meta[property="og:description"]', "content", cleanDesc);
    this.setOrCreateMeta('meta[property="og:image"]', "content", image);
    this.setOrCreateMeta('meta[property="og:image:secure_url"]', "content", image);
    this.setOrCreateMeta('meta[property="og:image:alt"]', "content", `${title} - My Cusco Trip`);
    this.setOrCreateMeta('meta[name="twitter:title"]', "content", `${title} | My Cusco Trip`);
    this.setOrCreateMeta('meta[name="twitter:description"]', "content", cleanDesc);
    this.setOrCreateMeta('meta[name="twitter:image"]', "content", image);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    let schema = document.getElementById("mct-product-schema");
    if (!schema) {
      schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.id = "mct-product-schema";
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "TouristTrip",
      "name": title,
      "description": cleanDesc,
      "image": image,
      "url": url,
      "touristType": ["Cultural tourism", "Adventure tourism"],
      "provider": { "@type": "TravelAgency", "name": "My Cusco Trip", "url": "https://mycuscotrip.com/" },
      "itinerary": { "@type": "ItemList", "itemListElement": (product.itinerary || []).map((item, index) => ({ "@type": "ListItem", "position": index + 1, "name": item.title || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }) })) }
    });
  };

  proto.renderProduct = function (product) {
    const result = oldRenderProduct.apply(this, arguments);
    this.updateSeoMetaForProduct(product);
    return result;
  };

  proto.renderServiceModes = function (product) {
    if (String(product?.slug || "") === "machu-picchu-full-day-clasico") {
      const section = document.getElementById("serviceModeSection");
      const select = document.getElementById("serviceMode");
      if (section) section.hidden = true;
      if (select) select.value = "group";
      this.serviceMode = "group";
      return;
    }
    return oldRenderServiceModes.apply(this, arguments);
  };

  proto.renderExtras = function (extras) {
    const section = document.getElementById("extrasSection");
    const container = document.getElementById("extrasContainer");
    if (!section || !container) return;
    if (!Array.isArray(extras) || !extras.length) {
      section.hidden = true;
      container.innerHTML = "";
      return;
    }
    section.hidden = false;
    const label = section.querySelector("label");
    if (label) label.textContent = isClassicMachu(this) ? this.t("product.extrasLunchOptionsLabel", "Extras: opciones de almuerzo") : this.t("quote.print.extrasLabel", "Extras");
    const current = [...this.selectedExtras][0] || "";
    container.innerHTML = `
      <select class="booking-extra-select" id="tourExtraLunchSelect" aria-label="${this.escapeHtml(this.t("product.extrasLunchOptionsLabel", "Extras: opciones de almuerzo"))}">
        <option value="">${this.escapeHtml(this.t("product.noAdditionalLunch", "Sin almuerzo adicional"))}</option>
        ${extras.map((extra) => {
          const amount = Number(extra.price || extra.publishedPriceUSD || extra.publishedPricing?.amount || 0);
          const price = `${this.product.currency || "USD"} ${this.formatMoney(amount)}`;
          return `<option value="${this.escapeHtml(extra.code)}" ${current === extra.code ? "selected" : ""}>${this.escapeHtml(extra.label)} · ${this.escapeHtml(price)} ${extra.perPerson ? "p/p" : ""}</option>`;
        }).join("")}
      </select>
      <small class="booking-field-help">${this.escapeHtml(this.t("product.chooseOneLunchOption", "Puedes elegir solo una opción de almuerzo para esta reserva."))}</small>
    `;
    container.querySelector("#tourExtraLunchSelect")?.addEventListener("change", (event) => {
      this.selectedExtras.clear();
      if (event.target.value) this.selectedExtras.add(event.target.value);
      this.updatePricing();
    });
  };

  proto.updateTrainAdjustmentSummaryRow = function (amount, currency) {
    let row = document.getElementById("trainAdjustmentTotalRow");
    const serviceTotalRow = document.getElementById("serviceTotalRow");
    const summary = serviceTotalRow?.parentNode;
    if (!summary) return;
    if (!row) {
      row = document.createElement("div");
      row.id = "trainAdjustmentTotalRow";
      row.className = "booking-summary__line";
      row.innerHTML = `<span>${this.escapeHtml(this.t("product.trainUpgradeButton", "Upgrade de trenes"))}</span><strong id="trainAdjustmentTotal">${this.escapeHtml(currency)} 0.00</strong>`;
      summary.insertBefore(row, serviceTotalRow);
    }
    row.hidden = false;
    const label = row.querySelector("span");
    if (label) label.textContent = this.t("product.trainUpgradeButton", "Upgrade de trenes");
    const value = document.getElementById("trainAdjustmentTotal");
    if (value) value.textContent = `${currency} ${this.formatMoney(Math.max(0, Number(amount || 0)))}`;
  };

  proto.updatePricing = function () {
    const result = oldUpdatePricing.apply(this, arguments);
    const info = document.getElementById("paymentInfo");
    if (info) {
      const percent = Number(this.product?.paymentOptions?.fullPaymentDiscountPercent || 10);
      const currency = this.product?.currency || "USD";
      const partial = Number(this.product?.paymentOptions?.partialPaymentPerPerson || 49.9);
      info.textContent = this.paymentMode === "full"
        ? this.t("product.fullPaymentDiscountNoteA", "Pagando el total ahora estás obteniendo un {percent}% de descuento.", { percent })
        : this.t("product.depositReservationNote", "Reserva con anticipo de {currency} {amount} por persona y completa el saldo días antes de tu viaje.", { currency, amount: this.formatMoney(partial) });
    }
    return result;
  };

  proto.ensureTrainUpgradeModal = function () {
    if (document.getElementById("trainUpgradeModal")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="train-upgrade-modal" hidden id="trainUpgradeModal">
        <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
        <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
          <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
          <header class="train-upgrade-modal__header">
            <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
            <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
            <span>${this.t("product.modal.chooseOutboundFirstAutoFilterAlt", "Elige tu tren de ida. El retorno se filtrará automáticamente por la misma compañía.")}</span>
          </header>
          <div class="train-upgrade-modal__tools">
            <label>${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
            <select id="trainUpgradeSortFilter">
              <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
              <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
              <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
              <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
              <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
              <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
            </select>
          </div>
          <div class="train-upgrade-modal__body">
            <section>
              <h3>${this.t("booking.train.outbound", "Tren de ida")}</h3>
              <div class="train-upgrade-modal__list" id="trainUpgradeOutboundList"></div>
            </section>
            <section>
              <h3>${this.t("booking.train.return", "Tren de retorno")}</h3>
              <div class="train-upgrade-modal__list" id="trainUpgradeReturnList"></div>
            </section>
          </div>
          <footer class="train-upgrade-modal__footer">
            <div id="trainUpgradeFooterSummary"></div>
            <button class="btn booking-main-btn" type="button" data-close-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
          </footer>
        </div>
      </div>
    `);
    document.getElementById("trainUpgradeSortFilter")?.addEventListener("change", (event) => {
      this.trainUpgradeFilter = event.target.value || "early";
      this.renderTrainUpgradeLists();
    });
  };

  proto.filterSortTrainListForModal = function (list, direction) {
    const mode = this.trainUpgradeFilter || "early";
    let out = [...(list || [])];
    const isPanoramic = (train) => /360|vistadome|observatory/i.test(`${train.category} ${train.label}`);
    const isEconomy = (train) => /voyager|expedition/i.test(`${train.category} ${train.label}`);
    if (mode === "panoramic") out = out.filter(isPanoramic);
    if (mode === "economy") out = out.filter(isEconomy);
    if (mode === "nocharge") out = out.filter((train) => this.getTrainPositiveDifferencePerPerson(train, direction) <= 0);
    const byTime = (a, b) => (this.timeToMinutes(a.departureTime) || 9999) - (this.timeToMinutes(b.departureTime) || 9999);
    if (["early", "panoramic", "economy", "nocharge"].includes(mode)) out.sort(byTime);
    if (mode === "late") out.sort((a, b) => byTime(b, a));
    if (mode === "cheap") out.sort((a, b) => Number(a.price || 0) - Number(b.price || 0) || byTime(a, b));
    return out;
  };

  proto.renderTrainUpgradeLists = function () {
    const outboundList = document.getElementById("trainUpgradeOutboundList");
    const returnList = document.getElementById("trainUpgradeReturnList");
    if (!outboundList || !returnList) return;
    const outbound = this.filterSortTrainListForModal(this.availableOutboundTrains, "outbound");
    const compatibleReturns = this.filterSortTrainListForModal(this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly), "return");
    outboundList.innerHTML = outbound.length ? outbound.map((train) => this.renderTrainUpgradeCard(train, "outbound")).join("") : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`;
    returnList.innerHTML = compatibleReturns.length ? compatibleReturns.map((train) => this.renderTrainUpgradeCard(train, "return")).join("") : `<p class="train-upgrade-empty">No hay trenes de retorno para este filtro.</p>`;
    const footer = document.getElementById("trainUpgradeFooterSummary");
    if (footer) {
      const total = this.calculateSelectedTrainAdjustmentTotal();
      footer.innerHTML = total > 0
        ? `<strong>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${this.product?.currency || "USD"} ${this.formatMoney(total)}</strong><small>${this.t("product.totalCalculatedForTravelers", "Total calculado para {n} viajero(s).", { n: this.getTotalPassengers() })}</small>`
        : `<strong>${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</strong><small>${this.t("product.trainsNoIncreasePrice", "Los trenes seleccionados no incrementan el precio base.")}</small>`;
    }
  };

  proto.updateTrainSelectionState = function (sameCompanyOnly = this.trainUpgradeSameCompanyOnly) {
    const result = oldUpdateTrainSelectionState.apply(this, arguments);
    const summary = document.getElementById("trainSelectionSummary");
    if (summary) {
      summary.innerHTML = "";
      summary.hidden = true;
    }
    this.refreshClassicMachuItineraryTimes?.();
    return result;
  };

  proto.addMinutesToTime = function (time, delta) {
    const mins = this.timeToMinutes(time);
    if (!Number.isFinite(mins)) return "";
    let total = (mins + delta) % 1440;
    if (total < 0) total += 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  proto.formatApproxTime = function (time) {
    if (!time) return "aprox.";
    const mins = this.timeToMinutes(time);
    if (!Number.isFinite(mins)) return `${time} aprox.`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const suffix = h >= 12 ? "p.m." : "a.m.";
    const hour12 = ((h + 11) % 12) + 1;
    return `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix} aprox.`;
  };

  proto.getClassicMachuDynamicItinerary = function () {
    const outbound = this.getSelectedOutboundTrain?.();
    const returning = this.getSelectedReturnTrain?.();
    const pickup = this.addMinutesToTime(outbound?.departureTime || "06:40", -160) || "04:00";
    const returnDepart = returning?.departureTime || "20:20";
    const returnArrive = returning?.arrivalTime || "21:59";
    const cuscoArrive = this.addMinutesToTime(returnArrive, 100) || "23:30";
    return [
      { time: this.formatApproxTime(pickup), title: this.t("product.itin.pickupTitle", "Recojo en el hotel y traslado a la estación"), description: this.t("product.itin.pickupDesc", "Recojo desde tu hotel en Cusco o punto coordinado y traslado turístico hacia la estación correspondiente para abordar el tren hacia Machu Picchu Pueblo.") },
      { time: this.formatApproxTime(outbound?.departureTime || "06:40"), title: this.t("product.itin.trainToMachuTitle", "Viaje en tren a Machu Picchu Pueblo"), description: this.t("product.itin.trainToMachuDesc", "Salida en {train} desde {from} hacia {to}.", { train: outbound?.label || this.t("product.touristTrain", "Tren turístico"), from: outbound?.departureStation || outbound?.raw?.departureStation || "Ollantaytambo", to: outbound?.arrivalStation || outbound?.raw?.arrivalStation || "Machu Picchu" }) },
      { time: "09:00 a.m. aprox.", title: this.t("product.itin.busInTitle", "Bus Consettur e ingreso oficial a Machu Picchu"), description: this.t("product.itin.busInDesc", "Coordinación para subir en bus Consettur hasta la puerta de ingreso. El circuito se confirma según disponibilidad oficial de boletos.") },
      { time: "10:00 a.m. aprox.", title: this.t("product.itin.guidedTourTitle", "Tour guiado en Machu Picchu"), description: this.t("product.itin.guidedTourDesc", "Recorrido guiado por la ciudadela inca junto a un guía profesional certificado. La ruta puede corresponder al circuito 1, 2 o 3 según disponibilidad.") },
      { time: "01:00 p.m. aprox.", title: this.t("product.itin.tourEndTitle", "Fin del tour guiado y tiempo libre para almorzar"), description: this.t("product.itin.tourEndDesc", "Finaliza la visita guiada. Tendrás tiempo libre para almorzar en Aguas Calientes; puedes agregar almuerzo en la sección de extras.") },
      { time: "03:00 p.m. aprox.", title: this.t("product.itin.busDownTitle", "Bus de bajada hacia Aguas Calientes"), description: this.t("product.itin.busDownDesc", "Descenso en bus Consettur desde Machu Picchu hacia Aguas Calientes para descansar, caminar por el pueblo o prepararte para el retorno.") },
      { time: this.formatApproxTime(returnDepart), title: this.t("product.itin.returnTrainTitle", "Tren de retorno hacia Ollantaytambo"), description: this.t("product.itin.returnTrainDesc", "Viaje de retorno en {train} desde {from} hacia {to}.", { train: returning?.label || this.t("product.touristTrain", "Tren turístico"), from: returning?.departureStation || returning?.raw?.departureStation || "Machu Picchu", to: returning?.arrivalStation || returning?.raw?.arrivalStation || "Ollantaytambo" }) },
      { time: this.formatApproxTime(returnArrive), title: this.t("product.itin.arrivalCuscoTransferTitle", "Llegada a estación y traslado hacia Cusco"), description: this.t("product.itin.arrivalCuscoTransferDesc", "Llegada estimada a la estación de Ollantaytambo y traslado terrestre hacia la ciudad de Cusco.") },
      { time: this.formatApproxTime(cuscoArrive), title: this.t("product.itin.arrivalCuscoEndTitle", "Llegada a Cusco y fin de los servicios"), description: this.t("product.itin.arrivalCuscoEndDesc", "Desembarque cerca de la Plaza de Armas de Cusco o punto coordinado dentro de la zona operativa. Fin de los servicios.") }
    ];
  };

  proto.refreshClassicMachuItineraryTimes = function () {
    if (!isClassicMachu(this)) return;
    this.renderItinerary(this.getClassicMachuDynamicItinerary());
  };

  proto.renderPaymentReviewStep = function (payload) {
    const review = document.getElementById("passengerCheckoutReview");
    if (!review) return;
    const passengerRows = (payload.passengers || []).map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ");
      const status = p.completionStatus === "pending" || p.completeLater ? "Pendiente de datos" : (name || "Datos registrados");
      const doc = [p.documentType, p.documentNumber].filter(Boolean).join(" · ");
      return `<li><strong>Pasajero ${this.escapeHtml(p.passengerNumber || "")}</strong><span>${this.escapeHtml(status)}</span>${doc ? `<small>${this.escapeHtml(doc)}</small>` : ""}</li>`;
    }).join("");
    const rows = [
      ["Experiencia", payload.productTitle],
      ["Fecha", payload.date],
      [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
      [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
      ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"],
      [this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal],
      ["Pagar ahora", payload.payNow],
      ["Saldo pendiente", payload.payLater]
    ];
    review.hidden = false;
    review.innerHTML = `
      <div class="passenger-review-card passenger-review-card--premium">
        <div class="passenger-review-card__header">
          <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
          <span>Revisa el resumen de tu reserva antes de continuar al pago.</span>
        </div>
        <div class="passenger-review-grid">
          ${rows.map(([label, value]) => `<div><span>${this.escapeHtml(label)}</span><strong>${this.escapeHtml(value || "-")}</strong></div>`).join("")}
        </div>
        <div class="passenger-review-passengers">
          <strong>Datos de pasajeros</strong>
          <ul class="passenger-review-list">${passengerRows}</ul>
        </div>
      </div>
    `;
    window.setTimeout(() => {
      const message = document.querySelector("[data-passenger-message]");
      if (message) message.textContent = "";
      const btn = document.querySelector('#passengerReservationForm button[type="submit"]');
      if (btn) btn.textContent = "Pagar";
    }, 0);
    review.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  document.addEventListener("DOMContentLoaded", () => {
    const submit = document.querySelector('#passengerReservationForm button[type="submit"]');
    if (submit) submit.textContent = this.t("booking.continue", "Continuar");
  });
})();

/* =========================================================
   PATCH MCT V64 - Modal trenes por pasos + resumen checkout
   ========================================================= */
(function () {
  const page = window.MyCuscoTripProductPage;
  const proto = page?.constructor?.prototype;
  if (!proto) return;

  const esc = function (value) {
    return this.escapeHtml ? this.escapeHtml(value == null ? "" : String(value)) : String(value == null ? "" : value);
  };

  const closeTrainModal = () => {
    const modal = document.getElementById("trainUpgradeModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("train-upgrade-modal-open");
  };

  proto.ensureTrainUpgradeModal = function () {
    const existing = document.getElementById("trainUpgradeModal");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", `
      <div class="train-upgrade-modal" hidden id="trainUpgradeModal">
        <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
        <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
          <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
          <header class="train-upgrade-modal__header">
            <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
            <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
            <span></span>
          </header>
          <div class="train-upgrade-modal__tools">
            <label for="trainUpgradeSortFilter">${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
            <select id="trainUpgradeSortFilter">
              <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
              <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
              <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
              <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
              <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
              <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
            </select>
          </div>
          <div class="train-upgrade-modal__body">
            <section id="trainUpgradeOutboundSection">
              <h3>${this.t("booking.train.outbound", "Tren de ida")}</h3>
              <p class="train-upgrade-step-note">${this.t("product.modal.chooseOutboundFirstThenReturn", "Primero elige tu tren de ida. Después se mostrarán solo los retornos compatibles con la misma compañía.")}</p>
              <div class="train-upgrade-modal__list" id="trainUpgradeOutboundList"></div>
            </section>
            <section id="trainUpgradeReturnSection" hidden>
              <h3>${this.t("booking.train.return", "Tren de retorno")}</h3>
              <p class="train-upgrade-step-note">Ahora elige el tren de retorno para completar tu upgrade.</p>
              <div class="train-upgrade-modal__list" id="trainUpgradeReturnList"></div>
            </section>
          </div>
          <footer class="train-upgrade-modal__footer">
            <div id="trainUpgradeFooterSummary"></div>
            <div class="train-upgrade-modal__footer-actions">
              <button class="btn train-upgrade-cancel-btn" type="button" data-close-train-upgrade>${this.t("booking.cancel", "Cancelar")}</button>
              <button class="btn booking-main-btn train-upgrade-apply-btn" type="button" data-close-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
            </div>
          </footer>
        </div>
      </div>
    `);

    const modal = document.getElementById("trainUpgradeModal");
    if (!modal) return;
    modal.dataset.bound = "true";

    document.getElementById("trainUpgradeSortFilter")?.addEventListener("change", (event) => {
      this.trainUpgradeFilter = event.target.value || "early";
      this.renderTrainUpgradeLists();
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-train-upgrade]")) {
        closeTrainModal();
        return;
      }
      const option = event.target.closest("[data-train-upgrade-option]");
      if (!option) return;
      const direction = option.dataset.trainDirection;
      const id = option.dataset.trainId || "";
      if (direction === "outbound") {
        this.selectedOutboundTrainId = id;
        const compatible = this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly);
        if (!compatible.some((train) => train.id === this.selectedReturnTrainId)) {
          this.selectedReturnTrainId = compatible[0]?.id || "";
        }
        this.trainUpgradeStep = "return";
        this.trainUpgradeFilter = "early";
        const filter = document.getElementById("trainUpgradeSortFilter");
        if (filter) filter.value = "early";
      } else {
        this.selectedReturnTrainId = id;
      }
      this.updateTrainSelectionState(this.trainUpgradeSameCompanyOnly);
      this.updatePricing();
      this.renderTrainUpgradeLists();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeTrainModal();
    });
  };

  proto.openTrainUpgradeModalV64 = function () {
    this.ensureTrainUpgradeModal();
    this.trainUpgradeStep = "outbound";
    this.trainUpgradeFilter = "early";
    const filter = document.getElementById("trainUpgradeSortFilter");
    if (filter) filter.value = "early";
    this.renderTrainUpgradeLists();
    const modal = document.getElementById("trainUpgradeModal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("train-upgrade-modal-open");
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("#openTrainUpgradeModal, [data-open-train-upgrade]");
    if (!trigger) return;
    const page = window.MyCuscoTripProductPage;
    if (!page?.openTrainUpgradeModalV64) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    page.openTrainUpgradeModalV64();
  }, true);

  proto.renderTrainUpgradeLists = function () {
    const outboundList = document.getElementById("trainUpgradeOutboundList");
    const returnList = document.getElementById("trainUpgradeReturnList");
    if (!outboundList || !returnList) return;

    const step = this.trainUpgradeStep || "outbound";
    const outboundSection = document.getElementById("trainUpgradeOutboundSection");
    const returnSection = document.getElementById("trainUpgradeReturnSection");
    if (outboundSection) outboundSection.hidden = step !== "outbound";
    if (returnSection) returnSection.hidden = step !== "return";

    const outbound = this.filterSortTrainListForModal(this.availableOutboundTrains, "outbound");
    const compatibleReturns = this.filterSortTrainListForModal(this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly), "return");

    outboundList.innerHTML = outbound.length
      ? outbound.map((train) => this.renderTrainUpgradeCard(train, "outbound")).join("")
      : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`;

    returnList.innerHTML = compatibleReturns.length
      ? compatibleReturns.map((train) => this.renderTrainUpgradeCard(train, "return")).join("")
      : `<p class="train-upgrade-empty">No hay trenes de retorno para este filtro.</p>`;

    const footer = document.getElementById("trainUpgradeFooterSummary");
    if (footer) {
      const total = this.calculateSelectedTrainAdjustmentTotal();
      const label = total > 0
        ? `${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${this.product?.currency || "USD"} ${this.formatMoney(total)}`
        : this.t("product.noAdditionalCharge", "Sin cargo adicional");
      const hint = step === "outbound"
        ? this.t("product.selectOutboundToSeeReturns", "Selecciona la ida para ver los retornos compatibles.")
        : this.t("product.totalCalculatedForTravelers", "Total calculado para {n} viajero(s).", { n: this.getTotalPassengers() });
      footer.innerHTML = `<strong>${esc.call(this, label)}</strong><small>${esc.call(this, hint)}</small>`;
    }
  };

  const oldRenderPassengerPaymentSnapshot = proto.renderPassengerPaymentSnapshot;
  proto.renderPassengerPaymentSnapshot = function (preReservation) {
    oldRenderPassengerPaymentSnapshot?.apply(this, arguments);
    const target = document.getElementById("passengerPaymentSnapshot");
    if (!target || !preReservation) return;

    const summary = preReservation.summary || {};
    const trains = summary.trainSelection || this.getSelectedTrainSummaryLabel?.() || this.t("product.includedBySelection", "Incluidos según selección");
    const extras = summary.extras?.length ? summary.extras.join(", ") : "Sin extras adicionales";
    target.hidden = false;
    target.innerHTML = `
      <aside class="passenger-summary-card" aria-label="${this.escapeHtml(this.t('reservationSummary', 'Resumen de reserva'))}">
        <div class="passenger-summary-card__title">
          <strong>Detalles de tu viaje</strong>
          <span>${esc.call(this, preReservation.code || "")}</span>
        </div>
        <div class="passenger-summary-card__row"><span>Experiencia</span><strong>${esc.call(this, preReservation.productTitle || summary.title || "")}</strong></div>
        <div class="passenger-summary-card__row"><span>Fecha</span><strong>${esc.call(this, preReservation.date || this.t("quote.print.toBeConfirmed", "Por confirmar"))}</strong></div>
        <div class="passenger-summary-card__row"><span>Pasajeros</span><strong>${esc.call(this, `${preReservation.totalPassengers || this.getTotalPassengers()} viajero(s)`)}</strong></div>
        <div class="passenger-summary-card__train"><span>Trenes seleccionados</span><strong>${esc.call(this, trains)}</strong></div>
        <div class="passenger-summary-card__row"><span>Extras</span><strong>${esc.call(this, extras)}</strong></div>
        <div class="passenger-summary-card__row"><span>Total del servicio</span><strong>${esc.call(this, preReservation.serviceTotal || summary.serviceTotal || "")}</strong></div>
        <div class="passenger-summary-card__total"><span>Pagar ahora</span><strong>${esc.call(this, preReservation.payNow || summary.payNow || "")}</strong></div>
        <div class="passenger-summary-card__row"><span>Saldo pendiente</span><strong>${esc.call(this, preReservation.payLater || summary.payLater || "")}</strong></div>
        <p class="passenger-summary-card__note">${this.t("product.modal.completeHolderDataNote", "Completa al menos los datos del titular para continuar. Los pasajeros marcados para completar después quedarán como pendientes en el resumen.")}</p>
      </aside>
    `;
  };

  proto.renderPaymentReviewStep = function (payload) {
    const review = document.getElementById("passengerCheckoutReview");
    if (!review) return;
    const passengerRows = (payload.passengers || []).map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
      const pending = p.completionStatus === "pending" || p.completeLater || !name;
      const status = pending ? "Pendiente de datos" : name;
      const doc = [p.documentType, p.documentNumber].filter(Boolean).join(" · ");
      return `<li><strong>Pasajero ${esc.call(this, p.passengerNumber || "")}</strong><span>${esc.call(this, status)}</span>${doc ? `<small>${esc.call(this, doc)}</small>` : ""}</li>`;
    }).join("");
    const rows = [
      ["Experiencia", payload.productTitle],
      ["Fecha", payload.date],
      [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
      [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
      ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"],
      [this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal],
      ["Pagar ahora", payload.payNow],
      ["Saldo pendiente", payload.payLater]
    ];
    review.hidden = false;
    review.innerHTML = `
      <div class="passenger-review-card passenger-review-card--premium">
        <div class="passenger-review-card__header">
          <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
          <span>Revisa el resumen de tu reserva antes de continuar al pago.</span>
        </div>
        <div class="passenger-review-grid">
          ${rows.map(([label, value]) => `<div><span>${esc.call(this, label)}</span><strong>${esc.call(this, value || "-")}</strong></div>`).join("")}
        </div>
        <div class="passenger-review-passengers">
          <strong>Datos de pasajeros</strong>
          <ul class="passenger-review-list">${passengerRows}</ul>
        </div>
      </div>
    `;
    window.setTimeout(() => {
      const message = document.querySelector("[data-passenger-message]");
      if (message) message.textContent = "";
      const btn = document.querySelector('#passengerReservationForm button[type="submit"]');
      if (btn) btn.textContent = "Pagar";
    }, 0);
    review.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
})();


/* =========================================================
   PATCH MCT V66 - Corrección definitiva summary, trenes y checkout
   ========================================================= */
(function () {
  if (typeof MyCuscoTripProductPage === "undefined") return;
  const proto = MyCuscoTripProductPage.prototype;

  const esc = function (value) {
    return this.escapeHtml ? this.escapeHtml(value == null ? "" : String(value)) : String(value == null ? "" : value);
  };

  const closeTrainModal = () => {
    const modal = document.getElementById("trainUpgradeModal");
    if (modal) modal.hidden = true;
    document.body.classList.remove("train-upgrade-modal-open");
  };

  const setPassengerReviewMode = (active) => {
    const modal = document.getElementById("passengerReservationModal");
    const form = document.getElementById("passengerReservationForm");
    if (modal) modal.classList.toggle("passenger-modal--review", Boolean(active));
    if (!active && form) {
      delete form.dataset.paymentReviewConfirmed;
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.textContent = this.t("booking.continue", "Continuar");
      const review = document.getElementById("passengerCheckoutReview");
      if (review) { review.hidden = true; review.innerHTML = ""; }
    }
  };

  const oldOpenPassengerReservationModal = proto.openPassengerReservationModal;
  proto.openPassengerReservationModal = function () {
    setPassengerReviewMode(false);
    oldOpenPassengerReservationModal?.apply(this, arguments);
    const modal = document.getElementById("passengerReservationModal");
    if (modal) modal.classList.remove("passenger-modal--review");
    const title = document.getElementById("passengerModalTitle");
    if (title) title.textContent = this.t("product.bookingDetailsTitle", "Detalles de reserva");
    const warning = document.querySelector(".passenger-modal__warning");
    if (warning) warning.hidden = false;
  };

  proto.renderTrainMiniSummary = function (title, train, diff) {
    if (!train) return "";
    const logo = this.getTrainCompanyLogo?.(train.company) || "";
    const diffText = diff > 0 ? `+ ${this.product?.currency || "USD"} ${this.formatMoney(diff)} p/p` : this.t("product.includedShort", "Incluido");
    const company = train.companyName || train.company || "";
    const time = `${train.departureTime || ""} → ${train.arrivalTime || ""}`.trim();
    return `
      <button class="booking-train-mini" type="button" data-open-train-upgrade aria-label="${this.escapeHtml(this.t('product.changeItemLabel', 'Cambiar {item}', { item: esc.call(this, title) }))}">
        <span class="booking-train-mini__label">${esc.call(this, title)}</span>
        <strong class="booking-train-mini__name">${esc.call(this, train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong>
        ${logo ? `<span class="booking-train-mini__logo"><img src="${esc.call(this, logo)}" alt="${esc.call(this, company || this.t("quote.train.detailTrainFallback", "Tren"))}" /></span>` : `<span class="booking-train-mini__company">${esc.call(this, company)}</span>`}
        <small class="booking-train-mini__time">${esc.call(this, [company, time].filter(Boolean).join(" · "))}</small>
        <em class="booking-train-mini__badge">${esc.call(this, diffText)}</em>
      </button>
    `;
  };

  proto.updateTrainSelectionState = function (sameCompanyOnly = this.trainUpgradeSameCompanyOnly) {
    const outbound = this.getSelectedOutboundTrain();
    let returning = this.getSelectedReturnTrain();
    const compatibleReturns = this.getCompatibleReturnTrains(sameCompanyOnly);

    if (compatibleReturns.length && !compatibleReturns.some((train) => train.id === this.selectedReturnTrainId)) {
      this.selectedReturnTrainId = compatibleReturns[0].id;
      returning = this.getSelectedReturnTrain();
    }

    const outboundDiff = this.getTrainPositiveDifferencePerPerson(outbound, "outbound");
    const returnDiff = this.getTrainPositiveDifferencePerPerson(returning, "return");
    this.selectedTrainAdjustmentTotal = (outboundDiff + returnDiff) * this.getTotalPassengers();

    const summaryCards = document.getElementById("trainUpgradeSummaryCards");
    if (summaryCards) {
      summaryCards.innerHTML = `
        ${this.renderTrainMiniSummary(this.t("booking.train.outbound", "Tren de ida"), outbound, outboundDiff)}
        ${this.renderTrainMiniSummary(this.t("booking.train.return", "Tren de retorno"), returning, returnDiff)}
      `;
    }

    const summary = document.getElementById("trainSelectionSummary");
    if (summary) {
      summary.hidden = true;
      summary.innerHTML = "";
    }

    this.renderTrainUpgradeLists?.();
  };

  proto.ensureTrainUpgradeModal = function () {
    const existing = document.getElementById("trainUpgradeModal");
    if (existing) existing.remove();

    document.body.insertAdjacentHTML("beforeend", `
      <div class="train-upgrade-modal" hidden id="trainUpgradeModal">
        <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
        <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
          <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
          <header class="train-upgrade-modal__header">
            <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
            <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
            <span>${this.t("product.modal.chooseOutboundThenReturnShort", "Elige primero la ida y después el retorno compatible.")}</span>
          </header>
          <div class="train-upgrade-modal__steps" role="tablist" aria-label="${this.escapeHtml(this.t('product.trainSelectionSteps', 'Pasos para elegir trenes'))}">
            <button type="button" class="train-upgrade-step is-active" data-train-step="outbound">1. Selecciona tu tren de ida</button>
            <button type="button" class="train-upgrade-step" data-train-step="return">2. Selecciona tu tren de retorno</button>
          </div>
          <div class="train-upgrade-modal__tools">
            <label for="trainUpgradeSortFilter">${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
            <select id="trainUpgradeSortFilter">
              <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
              <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
              <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
              <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
              <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
              <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
            </select>
          </div>
          <div class="train-upgrade-modal__body">
            <section id="trainUpgradeOutboundSection">
              <h3>${this.t("booking.train.outbound", "Tren de ida")}</h3>
              <p class="train-upgrade-step-note">${this.t("product.modal.chooseOutboundSeeReturnsNote", "Elige un tren de ida. Al seleccionarlo, verás solo los trenes de retorno compatibles con la misma compañía.")}</p>
              <div class="train-upgrade-modal__list" id="trainUpgradeOutboundList"></div>
            </section>
            <section id="trainUpgradeReturnSection" hidden>
              <h3>${this.t("booking.train.return", "Tren de retorno")}</h3>
              <p class="train-upgrade-step-note">${this.t("product.modal.chooseReturnToComplete", "Elige el tren de retorno para completar la selección.")}</p>
              <div class="train-upgrade-modal__list" id="trainUpgradeReturnList"></div>
            </section>
          </div>
          <footer class="train-upgrade-modal__footer">
            <div id="trainUpgradeFooterSummary"></div>
            <div class="train-upgrade-modal__footer-actions">
              <button class="btn train-upgrade-cancel-btn" type="button" data-close-train-upgrade>${this.t("booking.cancel", "Cancelar")}</button>
              <button class="btn booking-main-btn train-upgrade-apply-btn" type="button" data-close-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
            </div>
          </footer>
        </div>
      </div>
    `);

    const modal = document.getElementById("trainUpgradeModal");
    if (!modal) return;

    document.getElementById("trainUpgradeSortFilter")?.addEventListener("change", (event) => {
      this.trainUpgradeFilter = event.target.value || "early";
      this.renderTrainUpgradeLists();
    });

    modal.addEventListener("click", (event) => {
      if (event.target.closest("[data-close-train-upgrade]")) {
        closeTrainModal();
        return;
      }

      const stepBtn = event.target.closest("[data-train-step]");
      if (stepBtn) {
        this.trainUpgradeStep = stepBtn.dataset.trainStep || "outbound";
        this.renderTrainUpgradeLists();
        return;
      }

      const option = event.target.closest("[data-train-upgrade-option]");
      if (!option) return;
      const direction = option.dataset.trainDirection;
      const id = option.dataset.trainId || "";

      if (direction === "outbound") {
        this.selectedOutboundTrainId = id;
        const compatible = this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly);
        if (!compatible.some((train) => train.id === this.selectedReturnTrainId)) {
          this.selectedReturnTrainId = compatible[0]?.id || "";
        }
        this.trainUpgradeStep = "return";
        this.trainUpgradeFilter = "early";
        const filter = document.getElementById("trainUpgradeSortFilter");
        if (filter) filter.value = "early";
      } else {
        this.selectedReturnTrainId = id;
      }

      this.updateTrainSelectionState(this.trainUpgradeSameCompanyOnly);
      this.updatePricing();
      this.renderTrainUpgradeLists();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeTrainModal();
    });
  };

  proto.openTrainUpgradeModalV66 = function () {
    this.ensureTrainUpgradeModal();
    this.trainUpgradeStep = "outbound";
    this.trainUpgradeFilter = "early";
    const filter = document.getElementById("trainUpgradeSortFilter");
    if (filter) filter.value = "early";
    this.renderTrainUpgradeLists();
    const modal = document.getElementById("trainUpgradeModal");
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("train-upgrade-modal-open");
  };

  proto.openTrainUpgradeModalV64 = proto.openTrainUpgradeModalV66;

  proto.renderTrainUpgradeLists = function () {
    const outboundList = document.getElementById("trainUpgradeOutboundList");
    const returnList = document.getElementById("trainUpgradeReturnList");
    if (!outboundList || !returnList) return;

    const step = this.trainUpgradeStep || "outbound";
    const outboundSection = document.getElementById("trainUpgradeOutboundSection");
    const returnSection = document.getElementById("trainUpgradeReturnSection");
    if (outboundSection) outboundSection.hidden = step !== "outbound";
    if (returnSection) returnSection.hidden = step !== "return";

    document.querySelectorAll(".train-upgrade-step").forEach((button) => {
      const active = button.dataset.trainStep === step;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });

    const outbound = this.filterSortTrainListForModal(this.availableOutboundTrains, "outbound");
    const compatibleReturns = this.filterSortTrainListForModal(this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly), "return");

    outboundList.innerHTML = outbound.length
      ? outbound.map((train) => this.renderTrainUpgradeCard(train, "outbound")).join("")
      : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`;

    returnList.innerHTML = compatibleReturns.length
      ? compatibleReturns.map((train) => this.renderTrainUpgradeCard(train, "return")).join("")
      : `<p class="train-upgrade-empty">No hay trenes de retorno para este filtro.</p>`;

    const footer = document.getElementById("trainUpgradeFooterSummary");
    if (footer) {
      const total = this.calculateSelectedTrainAdjustmentTotal();
      const label = total > 0
        ? `${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${this.product?.currency || "USD"} ${this.formatMoney(total)}`
        : this.t("product.noAdditionalCharge", "Sin cargo adicional");
      const hint = step === "outbound"
        ? this.t("product.selectOutboundToContinue", "Selecciona la ida para continuar con el retorno.")
        : this.t("product.totalCalculatedForTravelers", "Total calculado para {n} viajero(s).", { n: this.getTotalPassengers() });
      footer.innerHTML = `<strong>${esc.call(this, label)}</strong><small>${esc.call(this, hint)}</small>`;
    }
  };

  proto.renderPaymentReviewStep = function (payload) {
    const review = document.getElementById("passengerCheckoutReview");
    const modal = document.getElementById("passengerReservationModal");
    const form = document.getElementById("passengerReservationForm");
    if (!review) return;

    const passengerRows = (payload.passengers || []).map((p) => {
      const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
      const pending = p.completionStatus === "pending" || p.completeLater || !name;
      const status = pending ? "Pendiente de datos" : name;
      const doc = [p.documentType, p.documentNumber].filter(Boolean).join(" · ");
      return `<li class="passenger-review-passenger ${pending ? "is-pending" : "is-complete"}">
        <span>Pasajero ${esc.call(this, p.passengerNumber || "")}</span>
        <strong>${esc.call(this, status)}</strong>
        ${doc ? `<small>${esc.call(this, doc)}</small>` : `<small>${pending ? "Se podrá completar después" : "Datos registrados"}</small>`}
      </li>`;
    }).join("");

    const rows = [
      ["Experiencia", payload.productTitle],
      ["Fecha", payload.date],
      [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
      [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
      ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"],
      [this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal],
      ["Saldo pendiente", payload.payLater]
    ];

    review.hidden = false;
    review.innerHTML = `
      <div class="passenger-review-card passenger-review-card--final">
        <div class="passenger-review-card__header">
          <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
          <span>Revisa los datos antes de continuar al pago.</span>
        </div>
        <div class="passenger-review-total">
          <span>Monto a pagar ahora</span>
          <strong>${esc.call(this, payload.payNow || "")}</strong>
        </div>
        <div class="passenger-review-grid passenger-review-grid--final">
          ${rows.map(([label, value]) => `<div><span>${esc.call(this, label)}</span><strong>${esc.call(this, value || "-")}</strong></div>`).join("")}
        </div>
        <div class="passenger-review-passengers">
          <strong>Datos de pasajeros</strong>
          <ul class="passenger-review-list">${passengerRows}</ul>
        </div>
        <button class="passenger-review-edit-btn" type="button" data-edit-passenger-details>Editar datos de pasajeros</button>
      </div>
    `;

    if (modal) modal.classList.add("passenger-modal--review");
    const title = document.getElementById("passengerModalTitle");
    if (title) title.textContent = this.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
    const warning = document.querySelector(".passenger-modal__warning");
    if (warning) warning.hidden = true;
    const message = document.querySelector("[data-passenger-message]");
    if (message) {
      message.textContent = "";
      message.classList.remove("is-error");
    }
    const submit = form?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "Pagar";
    review.querySelector("[data-edit-passenger-details]")?.addEventListener("click", () => {
      if (form) delete form.dataset.paymentReviewConfirmed;
      if (modal) modal.classList.remove("passenger-modal--review");
      review.hidden = true;
      review.innerHTML = "";
      if (title) title.textContent = this.t("product.bookingDetailsTitle", "Detalles de reserva");
      if (warning) warning.hidden = false;
      if (submit) submit.textContent = this.t("booking.continue", "Continuar");
    });
    review.scrollIntoView({ behavior: "smooth", block: "start" });
  };
})();

/* =========================================================
   PATCH MCT V67 - Ajustes checkout final, summary trenes y modal de upgrade
   ========================================================= */
(() => {
  const init = () => {
    const Page = window.MyCuscoTripProductPage;
    if (!Page?.prototype) return;
    const proto = Page.prototype;
    const esc = function (value) {
      if (typeof this.escapeHtml === "function") return this.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };

    proto.getTrainImageForUpgrade = function (train) {
      const text = `${train?.label || ""} ${train?.category || ""}`.toLowerCase();
      if (text.includes("observatory")) return "trenes/assets/img/vistadome-observatory1.jpg";
      if (text.includes("vistadome")) return "trenes/assets/img/vistadome1.jpg";
      if (text.includes("360")) return "trenes/assets/img/the-3601.jpg";
      if (text.includes("prime")) return "trenes/assets/img/the-prime1.jpg";
      if (text.includes("voyager")) return "trenes/assets/img/the-voyager1.jpg";
      if (text.includes("expedition")) return "trenes/assets/img/vistadome2.jpg";
      return "trenes/assets/img/the-voyager1.jpg";
    };

    proto.getTrainFeatureListForUpgrade = function (train) {
      const text = `${train?.label || ""} ${train?.category || ""}`.toLowerCase();
      if (text.includes("observatory")) return [this.t("product.trainFeature.panoramicCoachShort", "Vagón panorámico"), this.t("product.trainFeature.upperViewShort", "Vista superior"), this.t("product.trainFeature.premiumExperienceShort", "Experiencia premium")];
      if (text.includes("vistadome")) return [this.t("product.trainFeature.panoramicWindowsShort", "Ventanas panorámicas"), this.t("product.trainFeature.scenicExperienceShort", "Experiencia escénica"), this.t("product.trainFeature.moreComfortShort", "Mayor confort")];
      if (text.includes("360")) return [this.t("product.trainFeature.panoramicViewShort", "Vista panorámica"), this.t("product.trainFeature.observatoryCoachShort", "Coche observatorio"), this.t("product.trainFeature.photoExperienceShort", "Experiencia fotográfica")];
      if (text.includes("prime")) return [this.t("product.trainFeature.superiorServiceShort", "Servicio superior"), this.t("product.trainFeature.comfortableAtmosphereShort", "Ambiente cómodo"), this.t("product.trainFeature.bestOnboardExperienceShort", "Mejor experiencia a bordo")];
      if (text.includes("expedition")) return [this.t("product.trainFeature.touristServiceShort", "Servicio turístico"), this.t("product.trainFeature.goodPriceScheduleRatioShort", "Buena relación precio/horario"), this.t("product.trainFeature.operatedByPeruRail", "Operado por PeruRail")];
      return [this.t("product.trainFeature.touristServiceShort", "Servicio turístico"), this.t("product.trainFeature.operatingScheduleShort", "Horario operativo"), this.t("product.trainFeature.includedInExperienceShort", "Incluido en la experiencia")];
    };

    proto.renderTrainMiniSummary = function (title, train, diff) {
      if (!train) return "";
      const currency = this.product?.currency || "USD";
      const diffText = diff > 0 ? `+ ${currency} ${this.formatMoney(diff)}` : this.t("product.includedShort", "Incluido");
      const company = train.companyName || train.company || "";
      const time = `${train.departureTime || ""} → ${train.arrivalTime || ""}`.trim();
      return `
        <button class="booking-train-mini" type="button" data-open-train-upgrade aria-label="${this.escapeHtml(this.t('product.changeItemLabel', 'Cambiar {item}', { item: esc.call(this, title) }))}">
          <span class="booking-train-mini__label">${esc.call(this, title)}</span>
          <strong class="booking-train-mini__name">${esc.call(this, train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong>
          <span class="booking-train-mini__company">${esc.call(this, company)}</span>
          <small class="booking-train-mini__time">${esc.call(this, time)}</small>
          <em class="booking-train-mini__badge">${esc.call(this, diffText)}</em>
        </button>
      `;
    };

    proto.ensureTrainUpgradeModal = function () {
      const existing = document.getElementById("trainUpgradeModal");
      if (existing) existing.remove();

      document.body.insertAdjacentHTML("beforeend", `
        <div class="train-upgrade-modal train-upgrade-modal--v67" hidden id="trainUpgradeModal">
          <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
          <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
            <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
            <header class="train-upgrade-modal__header">
              <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
              <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
              <span>${this.t("product.modal.selectOutboundThenReturnsEnabled", "Primero selecciona el tren de ida. Luego se habilitarán los retornos compatibles.")}</span>
            </header>
            <div class="train-upgrade-modal__tools">
              <label for="trainUpgradeSortFilter">${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
              <select id="trainUpgradeSortFilter">
                <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
                <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
                <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
                <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
                <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
                <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
              </select>
            </div>
            <div class="train-upgrade-modal__body">
              <section id="trainUpgradeOutboundSection" class="train-upgrade-section">
                <div class="train-upgrade-section__heading">
                  <span>1</span>
                  <div><h3>Selecciona tu tren de ida</h3><p>${this.t("product.modal.clickOptionToConfirm", "Haz clic en una opción para ver detalles y confirmar la selección.")}</p></div>
                </div>
                <div class="train-upgrade-modal__list" id="trainUpgradeOutboundList"></div>
              </section>
              <section id="trainUpgradeReturnSection" class="train-upgrade-section" hidden>
                <div class="train-upgrade-section__heading">
                  <span>2</span>
                  <div><h3>Selecciona tu tren de retorno</h3><p>${this.t("product.modal.onlySameCompanyReturns", "Solo se muestran trenes compatibles con la compañía elegida en la ida.")}</p></div>
                </div>
                <div class="train-upgrade-modal__list" id="trainUpgradeReturnList"></div>
              </section>
            </div>
            <footer class="train-upgrade-modal__footer">
              <div id="trainUpgradeFooterSummary"></div>
              <div class="train-upgrade-modal__footer-actions">
                <button class="btn train-upgrade-cancel-btn" type="button" data-close-train-upgrade>${this.t("booking.cancel", "Cancelar")}</button>
                <button class="btn booking-main-btn train-upgrade-apply-btn" type="button" data-close-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
              </div>
            </footer>
          </div>
        </div>
      `);

      const modal = document.getElementById("trainUpgradeModal");
      if (!modal) return;
      document.getElementById("trainUpgradeSortFilter")?.addEventListener("change", (event) => {
        this.trainUpgradeFilter = event.target.value || "early";
        this.renderTrainUpgradeLists();
      });

      modal.addEventListener("click", (event) => {
        if (event.target.closest("[data-close-train-upgrade]")) {
          const closeTrainModal = window.closeTrainModal || (() => {
            const m = document.getElementById("trainUpgradeModal");
            if (m) m.hidden = true;
            document.body.classList.remove("train-upgrade-modal-open");
          });
          closeTrainModal();
          return;
        }

        const selectButton = event.target.closest("[data-select-train-upgrade]");
        if (selectButton) {
          event.preventDefault();
          const direction = selectButton.dataset.trainDirection;
          const id = selectButton.dataset.trainId || "";
          if (direction === "outbound") {
            this.selectedOutboundTrainId = id;
            const compatible = this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly);
            if (!compatible.some((train) => train.id === this.selectedReturnTrainId)) {
              this.selectedReturnTrainId = compatible[0]?.id || "";
            }
            this.expandedReturnTrainId = this.selectedReturnTrainId || "";
            this.updateTrainSelectionState(this.trainUpgradeSameCompanyOnly);
            this.updatePricing();
            this.renderTrainUpgradeLists();
            setTimeout(() => document.getElementById("trainUpgradeReturnSection")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          } else {
            this.selectedReturnTrainId = id;
            this.updateTrainSelectionState(this.trainUpgradeSameCompanyOnly);
            this.updatePricing();
            this.renderTrainUpgradeLists();
          }
          return;
        }

        const card = event.target.closest("[data-train-upgrade-option]");
        if (card) {
          const direction = card.dataset.trainDirection;
          const id = card.dataset.trainId || "";
          if (direction === "outbound") this.expandedOutboundTrainId = this.expandedOutboundTrainId === id ? "" : id;
          else this.expandedReturnTrainId = this.expandedReturnTrainId === id ? "" : id;
          this.renderTrainUpgradeLists();
        }
      });
    };

    proto.openTrainUpgradeModalV66 = function () {
      this.ensureTrainUpgradeModal();
      this.trainUpgradeFilter = "early";
      this.expandedOutboundTrainId = this.selectedOutboundTrainId || "";
      this.expandedReturnTrainId = this.selectedReturnTrainId || "";
      const filter = document.getElementById("trainUpgradeSortFilter");
      if (filter) filter.value = "early";
      this.renderTrainUpgradeLists();
      const modal = document.getElementById("trainUpgradeModal");
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("train-upgrade-modal-open");
    };
    proto.openTrainUpgradeModalV64 = proto.openTrainUpgradeModalV66;

    proto.renderTrainUpgradeLists = function () {
      const outboundList = document.getElementById("trainUpgradeOutboundList");
      const returnList = document.getElementById("trainUpgradeReturnList");
      if (!outboundList || !returnList) return;
      const outbound = this.filterSortTrainListForModal(this.availableOutboundTrains || [], "outbound");
      const compatibleReturns = this.filterSortTrainListForModal(this.getCompatibleReturnTrains(this.trainUpgradeSameCompanyOnly) || [], "return");
      const hasOutboundSelection = Boolean(this.selectedOutboundTrainId);
      const returnSection = document.getElementById("trainUpgradeReturnSection");
      if (returnSection) returnSection.hidden = !hasOutboundSelection;

      outboundList.innerHTML = outbound.length
        ? outbound.map((train) => this.renderTrainUpgradeCard(train, "outbound")).join("")
        : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`;
      returnList.innerHTML = compatibleReturns.length
        ? compatibleReturns.map((train) => this.renderTrainUpgradeCard(train, "return")).join("")
        : `<p class="train-upgrade-empty">No hay trenes de retorno para este filtro.</p>`;

      const footer = document.getElementById("trainUpgradeFooterSummary");
      if (footer) {
        const outboundTrain = this.getSelectedOutboundTrain?.();
        const returnTrain = this.getSelectedReturnTrain?.();
        const outboundDiff = this.getTrainPositiveDifferencePerPerson(outboundTrain, "outbound");
        const returnDiff = this.getTrainPositiveDifferencePerPerson(returnTrain, "return");
        const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
        footer.innerHTML = `<strong>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc.call(this, this.product?.currency || "USD")} ${esc.call(this, this.formatMoney(total))}</strong><small>${hasOutboundSelection ? this.t("product.canApplyOrKeepAdjusting", "Puedes aplicar la selección o seguir ajustando los trenes.") : this.t("product.selectOutboundFirst", "Selecciona primero tu tren de ida.")}</small>`;
      }
    };

    proto.renderTrainUpgradeCard = function (train, direction) {
      const selectedId = direction === "outbound" ? this.selectedOutboundTrainId : this.selectedReturnTrainId;
      const expandedId = direction === "outbound" ? this.expandedOutboundTrainId : this.expandedReturnTrainId;
      const selected = selectedId === train.id;
      const expanded = expandedId === train.id || selected;
      const diff = this.getTrainPositiveDifferencePerPerson(train, direction);
      const currency = this.product?.currency || "USD";
      const priceText = diff > 0 ? `+ ${currency} ${this.formatMoney(diff)}` : "Incluido / sin recargo";
      const company = train.companyName || train.company || "";
      const image = this.getTrainImageForUpgrade(train);
      const features = this.getTrainFeatureListForUpgrade(train);
      return `
        <article class="train-upgrade-card ${selected ? "is-selected" : ""} ${expanded ? "is-expanded" : ""}" data-train-upgrade-option data-train-direction="${esc.call(this, direction)}" data-train-id="${esc.call(this, train.id)}">
          <div class="train-upgrade-card__main">
            <div class="train-upgrade-card__body">
              <strong>${esc.call(this, train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong>
              <small>${esc.call(this, company)}</small>
              <span>${esc.call(this, train.departureTime || "")} → ${esc.call(this, train.arrivalTime || "")}</span>
              <em>${esc.call(this, train.route || "")}</em>
            </div>
            <div class="train-upgrade-card__price">${esc.call(this, priceText)}</div>
          </div>
          <div class="train-upgrade-card__details">
            <img src="${esc.call(this, image)}" alt="${esc.call(this, train.label || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />
            <div>
              <strong>${selected ? this.t("product.selectedTrainLabel", "Tren seleccionado") : this.t("product.trainDetails", "Detalles del tren")}</strong>
              <ul>${features.map((feature) => `<li>${esc.call(this, feature)}</li>`).join("")}</ul>
              <button type="button" class="train-upgrade-select-btn" data-select-train-upgrade data-train-direction="${esc.call(this, direction)}" data-train-id="${esc.call(this, train.id)}">${selected ? this.t("product.trainSelectedState", "Seleccionado") : this.t("product.selectThisTrain", "Seleccionar este tren")}</button>
            </div>
          </div>
        </article>
      `;
    };

    proto.renderPaymentReviewStep = function (payload) {
      const review = document.getElementById("passengerCheckoutReview");
      const modal = document.getElementById("passengerReservationModal");
      const form = document.getElementById("passengerReservationForm");
      if (!review) return;

      const serviceTotalValue = Number(payload.serviceTotalValue || 0);
      const payNowValue = Number(payload.payNowValue || 0);
      const payLaterValue = Number(payload.payLaterValue || 0);
      const hasDiscount = serviceTotalValue > 0 && payNowValue > 0 && payNowValue < serviceTotalValue && payLaterValue <= 0.01;
      const discountAmount = Math.max(0, serviceTotalValue - payNowValue);
      const passengerRows = (payload.passengers || []).map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
        const pending = p.completionStatus === "pending" || p.completeLater || !name;
        const status = pending ? "Pendiente de datos" : name;
        const doc = [p.documentType, p.documentNumber].filter(Boolean).join(" · ");
        return `<li class="passenger-review-passenger ${pending ? "is-pending" : "is-complete"}">
          <span>Pasajero ${esc.call(this, p.passengerNumber || "")}</span>
          <strong>${esc.call(this, status)}</strong>
          ${doc ? `<small>${esc.call(this, doc)}</small>` : `<small>${pending ? "Se podrá completar después" : "Datos registrados"}</small>`}
        </li>`;
      }).join("");

      const rows = [
        ["Experiencia", payload.productTitle],
        ["Fecha", payload.date],
        [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
        [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
        ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"]
      ];
      if (payLaterValue > 0.01) rows.push(["Saldo pendiente", payload.payLater]);

      review.hidden = false;
      review.innerHTML = `
        <div class="passenger-review-card passenger-review-card--final passenger-review-card--v67">
          <div class="passenger-review-card__header">
            <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
            <span>Revisa los datos antes de continuar al pago.</span>
          </div>
          <div class="passenger-review-total">
            <span>Monto a pagar</span>
            <strong>${esc.call(this, payload.payNow || "")}</strong>
            ${hasDiscount ? `<small><del>${esc.call(this, payload.serviceTotal || "")}</del><b> Descuento aplicado: ${esc.call(this, payload.currency || this.product?.currency || "USD")} ${esc.call(this, this.formatMoney(discountAmount))}</b></small>` : ""}
          </div>
          <div class="passenger-review-grid passenger-review-grid--final">
            ${rows.map(([label, value]) => `<div><span>${esc.call(this, label)}</span><strong>${esc.call(this, value || "-")}</strong></div>`).join("")}
          </div>
          <div class="passenger-review-passengers">
            <strong>Datos de pasajeros</strong>
            <ul class="passenger-review-list">${passengerRows}</ul>
          </div>
          <button class="passenger-review-edit-btn" type="button" data-edit-passenger-details>Editar datos de pasajeros</button>
        </div>
      `;

      if (modal) modal.classList.add("passenger-modal--review");
      const title = document.getElementById("passengerModalTitle");
      if (title) title.textContent = this.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
      const warning = document.querySelector(".passenger-modal__warning");
      if (warning) warning.hidden = true;
      const message = document.querySelector("[data-passenger-message]");
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error");
      }
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "Pagar";
      review.querySelector("[data-edit-passenger-details]")?.addEventListener("click", () => {
        if (form) delete form.dataset.paymentReviewConfirmed;
        if (modal) modal.classList.remove("passenger-modal--review");
        review.hidden = true;
        review.innerHTML = "";
        if (title) title.textContent = this.t("product.bookingDetailsTitle", "Detalles de reserva");
        if (warning) warning.hidden = false;
        if (submit) submit.textContent = this.t("booking.continue", "Continuar");
      });
      review.scrollIntoView({ behavior: "smooth", block: "start" });
    };
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* =========================================================
   PATCH MCT V69 - Correccion real sobre instancia activa
   ========================================================= */
(function () {
  function patchV69() {
    const page = window.MyCuscoTripProductPage;
    if (!page || page.__mctV69Applied) return Boolean(page?.__mctV69Applied);

    const proto = Object.getPrototypeOf(page) || page;
    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };

    const formatMoney = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const currency = () => page.product?.currency || "USD";

    proto.getTrainImageForUpgrade = function (train) {
      const text = `${train?.label || ""} ${train?.category || ""}`.toLowerCase();
      if (text.includes("observatory")) return this.resolvePath ? this.resolvePath("trenes/assets/img/vistadome-observatory1.jpg") : "trenes/assets/img/vistadome-observatory1.jpg";
      if (text.includes("vistadome")) return this.resolvePath ? this.resolvePath("trenes/assets/img/vistadome1.jpg") : "trenes/assets/img/vistadome1.jpg";
      if (text.includes("360")) return this.resolvePath ? this.resolvePath("trenes/assets/img/the-3601.jpg") : "trenes/assets/img/the-3601.jpg";
      if (text.includes("prime")) return this.resolvePath ? this.resolvePath("trenes/assets/img/the-prime1.jpg") : "trenes/assets/img/the-prime1.jpg";
      if (text.includes("expedition")) return this.resolvePath ? this.resolvePath("trenes/assets/img/expedition1.jpg") : "trenes/assets/img/expedition1.jpg";
      return this.resolvePath ? this.resolvePath("trenes/assets/img/the-voyager1.jpg") : "trenes/assets/img/the-voyager1.jpg";
    };

    proto.getTrainFeatureListForUpgrade = function (train) {
      const text = `${train?.label || ""} ${train?.category || ""}`.toLowerCase();
      if (text.includes("observatory")) return [this.t("product.trainFeature.observatoryWindows", "Ventanas panorámicas y vista superior."), this.t("product.trainFeature.observatoryCoach", "Coche observatorio para disfrutar el paisaje."), this.t("product.trainFeature.observatoryScenicPremium", "Experiencia escénica premium hacia Machu Picchu."), this.t("product.trainFeature.idealBetterViews", "Ideal para viajeros que desean mejores vistas.")];
      if (text.includes("vistadome")) return [this.t("product.trainFeature.vistadomeWindowsValley", "Ventanas panorámicas para el valle."), this.t("product.trainFeature.comfortableDuringTrip", "Ambiente cómodo durante el recorrido."), this.t("product.trainFeature.scenicTouristService", "Servicio turístico escénico."), this.t("product.trainFeature.goodOnboardUpgrade", "Buena opción para mejorar la experiencia a bordo.")];
      if (text.includes("360")) return [this.t("product.trainFeature.panoramicViewTrip", "Vista panorámica durante el viaje."), this.t("product.trainFeature.observatoryCarByOperation", "Coche observatorio según operación."), this.t("product.trainFeature.superiorPhotoExperience", "Experiencia fotográfica superior."), this.t("product.trainFeature.idealAndeanScenery", "Ideal para disfrutar el paisaje andino.")];
      if (text.includes("prime")) return [this.t("product.trainFeature.superiorServiceIncaRail", "Servicio superior de Inca Rail."), this.t("product.trainFeature.comfortableElegant", "Ambiente cómodo y elegante."), this.t("product.trainFeature.betterOnboardExperience", "Mejor experiencia a bordo."), this.t("product.trainFeature.recommendedBalancedUpgrade", "Opción recomendada para un upgrade equilibrado.")];
      if (text.includes("expedition")) return [this.t("product.trainFeature.practicalSafeService", "Servicio turístico práctico y seguro."), this.t("product.trainFeature.goodSchedulePriceRatio", "Buena relación entre horario y precio."), this.t("product.trainFeature.operatedByPeruRail", "Operado por PeruRail."), this.t("product.trainFeature.idealClassicExperience", "Ideal para una experiencia clásica a Machu Picchu.")];
      return [this.t("product.touristServiceIncluded", "Servicio turístico incluido en la experiencia."), this.t("product.operatingScheduleFullDay", "Horario operativo para Machu Picchu Full Day."), this.t("product.reservationSubjectToAvailability", "Reserva sujeta a disponibilidad final."), this.t("product.categoryConfirmedByAdvisor", "La categoría se confirma con tu asesor de viajes.")];
    };

    proto.formatTrainDurationForUpgrade = function (train) {
      const toMinutes = typeof this.timeToMinutes === "function" ? this.timeToMinutes.bind(this) : (time) => {
        const [h, m] = String(time || "").split(":").map(Number);
        return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
      };
      let start = toMinutes(train?.departureTime);
      let end = toMinutes(train?.arrivalTime);
      if (start == null || end == null) return "";
      if (end < start) end += 24 * 60;
      const diff = Math.max(0, end - start);
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      return h ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
    };

    proto.renderTrainMiniSummary = function (title, train, diff) {
      if (!train) return "";
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : this.t("product.includedShort", "Incluido");
      const company = train.companyName || train.company || "";
      const time = [train.departureTime, train.arrivalTime].filter(Boolean).join(" → ");
      return `
        <button class="booking-train-mini booking-train-mini--v69" type="button" data-open-train-upgrade aria-label="${this.escapeHtml(this.t('product.changeItemLabel', 'Cambiar {item}', { item: esc(title) }))}">
          <span class="booking-train-mini__label">${esc(title)}</span>
          <strong class="booking-train-mini__name">${esc(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong>
          <span class="booking-train-mini__company">${esc(company)}</span>
          <small class="booking-train-mini__time">${esc(time)}</small>
          <em class="booking-train-mini__badge">${esc(diffText)}</em>
        </button>
      `;
    };

    proto.getCompatibleReturnTrainsForDraft = function (outboundTrain) {
      const sameCompanyOnly = Boolean(this.trainUpgradeSameCompanyOnly);
      const config = this.getTrainConfig?.(this.product) || {};
      let compatible = (this.availableReturnTrains || []).filter((train) => {
        if (typeof this.isReturnTrainCompatible === "function") {
          return this.isReturnTrainCompatible(outboundTrain, train, sameCompanyOnly, config);
        }
        if (!sameCompanyOnly || !outboundTrain) return true;
        return String(train.company || "").toLowerCase() === String(outboundTrain.company || "").toLowerCase();
      });
      if (!compatible.length) compatible = [...(this.availableReturnTrains || [])];
      if (typeof this.filterSortTrainListForModal === "function") return this.filterSortTrainListForModal(compatible, "return");
      if (typeof this.sortTrainOptions === "function") return this.sortTrainOptions(compatible, "return", config);
      return compatible;
    };

    proto.ensureTrainUpgradeModal = function () {
      const existing = document.getElementById("trainUpgradeModal");
      if (existing) existing.remove();
      document.body.insertAdjacentHTML("beforeend", `
        <div class="train-upgrade-modal train-upgrade-modal--v69" hidden id="trainUpgradeModal">
          <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
          <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
            <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
            <header class="train-upgrade-modal__header">
              <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
              <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
              <span>Elige primero la ida, confirma el tren y luego selecciona el retorno compatible.</span>
            </header>
            <div class="train-upgrade-modal__tools">
              <label for="trainUpgradeSortFilter">${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
              <select id="trainUpgradeSortFilter">
                <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
                <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
                <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
                <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
                <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
                <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
              </select>
            </div>
            <div class="train-upgrade-modal__body">
              <section class="train-upgrade-section" id="trainUpgradeOutboundSection"></section>
              <section class="train-upgrade-section" id="trainUpgradeReturnSection"></section>
              <section class="train-upgrade-section" id="trainUpgradeFinalSummarySection"></section>
            </div>
            <footer class="train-upgrade-modal__footer">
              <div id="trainUpgradeFooterSummary"></div>
              <div class="train-upgrade-modal__footer-actions">
                <button class="btn train-upgrade-cancel-btn" type="button" data-close-train-upgrade>${this.t("booking.cancel", "Cancelar")}</button>
                <button class="btn booking-main-btn train-upgrade-apply-btn" type="button" data-apply-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
              </div>
            </footer>
          </div>
        </div>
      `);

      const modal = document.getElementById("trainUpgradeModal");
      const filter = document.getElementById("trainUpgradeSortFilter");
      filter?.addEventListener("change", (event) => {
        this.trainUpgradeFilter = event.target.value || "early";
        this.renderTrainUpgradeListsV69();
      });

      modal?.addEventListener("click", (event) => {
        if (event.target.closest("[data-close-train-upgrade]")) {
          modal.hidden = true;
          document.body.classList.remove("train-upgrade-modal-open");
          return;
        }

        const modify = event.target.closest("[data-modify-train-upgrade]");
        if (modify) {
          const direction = modify.dataset.trainDirection;
          if (direction === "outbound") {
            this.trainUpgradeOutboundConfirmed = false;
            this.trainUpgradeReturnConfirmed = false;
            this.trainUpgradeDraftReturnId = this.selectedReturnTrainId || "";
            this.expandedOutboundTrainId = this.trainUpgradeDraftOutboundId || this.selectedOutboundTrainId || "";
          } else {
            this.trainUpgradeReturnConfirmed = false;
            this.expandedReturnTrainId = this.trainUpgradeDraftReturnId || this.selectedReturnTrainId || "";
          }
          this.renderTrainUpgradeListsV69();
          return;
        }

        const confirm = event.target.closest("[data-confirm-train-upgrade]");
        if (confirm) {
          const direction = confirm.dataset.trainDirection;
          const id = confirm.dataset.trainId || "";
          if (direction === "outbound") {
            this.trainUpgradeDraftOutboundId = id;
            this.trainUpgradeOutboundConfirmed = true;
            const outboundTrain = this.findTrainById?.(id, this.availableOutboundTrains) || null;
            const compatible = this.getCompatibleReturnTrainsForDraft(outboundTrain);
            if (!compatible.some((train) => train.id === this.trainUpgradeDraftReturnId)) {
              this.trainUpgradeDraftReturnId = compatible[0]?.id || "";
            }
            this.trainUpgradeReturnConfirmed = false;
            this.expandedReturnTrainId = this.trainUpgradeDraftReturnId || "";
            this.renderTrainUpgradeListsV69();
            setTimeout(() => document.getElementById("trainUpgradeReturnSection")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          } else {
            this.trainUpgradeDraftReturnId = id;
            this.trainUpgradeReturnConfirmed = true;
            this.renderTrainUpgradeListsV69();
            setTimeout(() => document.getElementById("trainUpgradeFinalSummarySection")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
          }
          return;
        }

        const card = event.target.closest("[data-train-upgrade-option]");
        if (card) {
          const direction = card.dataset.trainDirection;
          const id = card.dataset.trainId || "";
          if (direction === "outbound") this.expandedOutboundTrainId = this.expandedOutboundTrainId === id ? "" : id;
          else this.expandedReturnTrainId = this.expandedReturnTrainId === id ? "" : id;
          this.renderTrainUpgradeListsV69();
          return;
        }

        const apply = event.target.closest("[data-apply-train-upgrade]");
        if (apply) {
          if (!this.trainUpgradeOutboundConfirmed || !this.trainUpgradeReturnConfirmed) return;
          this.selectedOutboundTrainId = this.trainUpgradeDraftOutboundId || this.selectedOutboundTrainId;
          this.selectedReturnTrainId = this.trainUpgradeDraftReturnId || this.selectedReturnTrainId;
          this.updateTrainSelectionState?.(this.trainUpgradeSameCompanyOnly);
          this.updatePricing?.();
          modal.hidden = true;
          document.body.classList.remove("train-upgrade-modal-open");
        }
      });
    };

    proto.openTrainUpgradeModalV69 = function () {
      this.ensureTrainUpgradeModal();
      this.trainUpgradeFilter = "early";
      this.trainUpgradeDraftOutboundId = this.selectedOutboundTrainId || this.availableOutboundTrains?.[0]?.id || "";
      const outboundTrain = this.findTrainById?.(this.trainUpgradeDraftOutboundId, this.availableOutboundTrains) || null;
      const compatible = this.getCompatibleReturnTrainsForDraft(outboundTrain);
      this.trainUpgradeDraftReturnId = this.selectedReturnTrainId || compatible[0]?.id || "";
      this.trainUpgradeOutboundConfirmed = false;
      this.trainUpgradeReturnConfirmed = false;
      this.expandedOutboundTrainId = this.trainUpgradeDraftOutboundId;
      this.expandedReturnTrainId = this.trainUpgradeDraftReturnId;
      const filter = document.getElementById("trainUpgradeSortFilter");
      if (filter) filter.value = "early";
      this.renderTrainUpgradeListsV69();
      const modal = document.getElementById("trainUpgradeModal");
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("train-upgrade-modal-open");
    };
    proto.openTrainUpgradeModalV66 = proto.openTrainUpgradeModalV69;
    proto.openTrainUpgradeModalV64 = proto.openTrainUpgradeModalV69;

    proto.renderSelectedTrainSummaryV69 = function (train, direction) {
      if (!train) return "";
      const diff = this.getTrainPositiveDifferencePerPerson?.(train, direction) || 0;
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : "Incluido / sin recargo";
      const logo = this.getTrainCompanyLogo?.(train.company) || "";
      const title = direction === "outbound" ? this.t("booking.train.outbound", "Tren de ida") : this.t("booking.train.return", "Tren de retorno");
      const modifyText = direction === "outbound" ? this.t("product.editOutboundTrain", "Modificar tren de ida") : this.t("product.editReturnTrain", "Modificar tren de retorno");
      const date = this.selectedDate ? this.formatDateForDisplay?.(this.selectedDate) || this.selectedDate : "Fecha de viaje";
      return `
        <article class="train-upgrade-selected-summary">
          <span class="train-upgrade-selected-summary__badge">Tren seleccionado</span>
          <div class="train-upgrade-selected-summary__content">
            ${logo ? `<img src="${esc(logo)}" alt="${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />` : ""}
            <div>
              <strong>${esc(title)}</strong>
              <b>${esc(`${train.companyName || train.company || ""} ${train.label || ""}`.trim())}</b>
              <small>${esc(date)}</small>
              <span>${esc(`${train.route || ""} · ${train.departureTime || ""} → ${train.arrivalTime || ""}`)}</span>
              <em>${esc(diffText)}</em>
            </div>
            <button type="button" data-modify-train-upgrade data-train-direction="${esc(direction)}">${esc(modifyText)}</button>
          </div>
        </article>
      `;
    };

    proto.renderTrainUpgradeListsV69 = function () {
      const outboundSection = document.getElementById("trainUpgradeOutboundSection");
      const returnSection = document.getElementById("trainUpgradeReturnSection");
      const finalSection = document.getElementById("trainUpgradeFinalSummarySection");
      if (!outboundSection || !returnSection || !finalSection) return;

      const outboundTrain = this.findTrainById?.(this.trainUpgradeDraftOutboundId, this.availableOutboundTrains) || null;
      const returnTrain = this.findTrainById?.(this.trainUpgradeDraftReturnId, this.availableReturnTrains) || null;
      const outboundList = typeof this.filterSortTrainListForModal === "function"
        ? this.filterSortTrainListForModal(this.availableOutboundTrains || [], "outbound")
        : [...(this.availableOutboundTrains || [])];
      const compatibleReturns = this.getCompatibleReturnTrainsForDraft(outboundTrain);

      if (this.trainUpgradeOutboundConfirmed) {
        outboundSection.innerHTML = `
          <h3 class="train-upgrade-title">Elige tu tren de ida</h3>
          ${this.renderSelectedTrainSummaryV69(outboundTrain, "outbound")}
        `;
      } else {
        outboundSection.innerHTML = `
          <h3 class="train-upgrade-title">Elige tu tren de ida</h3>
          <p class="train-upgrade-route-label">Ollantaytambo → Machu Picchu</p>
          <div class="train-upgrade-modal__list train-upgrade-modal__list--v69">
            ${outboundList.length ? outboundList.map((train) => this.renderTrainUpgradeCardV69(train, "outbound")).join("") : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`}
          </div>
        `;
      }

      if (!this.trainUpgradeOutboundConfirmed) {
        returnSection.hidden = true;
        finalSection.hidden = true;
      } else {
        returnSection.hidden = false;
        if (this.trainUpgradeReturnConfirmed) {
          returnSection.innerHTML = `
            <h3 class="train-upgrade-title">Elige tu tren de retorno</h3>
            ${this.renderSelectedTrainSummaryV69(returnTrain, "return")}
          `;
        } else {
          returnSection.innerHTML = `
            <h3 class="train-upgrade-title">Elige tu tren de retorno</h3>
            <p class="train-upgrade-route-label">Machu Picchu → Ollantaytambo</p>
            <div class="train-upgrade-modal__list train-upgrade-modal__list--v69">
              ${compatibleReturns.length ? compatibleReturns.map((train) => this.renderTrainUpgradeCardV69(train, "return")).join("") : `<p class="train-upgrade-empty">No hay trenes de retorno compatibles para este filtro.</p>`}
            </div>
          `;
        }
        finalSection.hidden = !this.trainUpgradeReturnConfirmed;
        if (this.trainUpgradeReturnConfirmed) {
          const outboundDiff = this.getTrainPositiveDifferencePerPerson?.(outboundTrain, "outbound") || 0;
          const returnDiff = this.getTrainPositiveDifferencePerPerson?.(returnTrain, "return") || 0;
          const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
          finalSection.innerHTML = `
            <div class="train-upgrade-final-summary">
              <strong>Resumen de trenes seleccionados</strong>
              <span>Ida: ${esc(outboundTrain?.label || "-")} · ${esc(outboundTrain?.departureTime || "")} → ${esc(outboundTrain?.arrivalTime || "")}</span>
              <span>Retorno: ${esc(returnTrain?.label || "-")} · ${esc(returnTrain?.departureTime || "")} → ${esc(returnTrain?.arrivalTime || "")}</span>
              <b>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc(currency())} ${esc(formatMoney(total))}</b>
            </div>
          `;
        }
      }

      const footer = document.getElementById("trainUpgradeFooterSummary");
      const apply = document.querySelector("[data-apply-train-upgrade]");
      if (footer) {
        const outboundDiff = this.getTrainPositiveDifferencePerPerson?.(outboundTrain, "outbound") || 0;
        const returnDiff = this.getTrainPositiveDifferencePerPerson?.(returnTrain, "return") || 0;
        const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
        footer.innerHTML = `<strong>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc(currency())} ${esc(formatMoney(total))}</strong><small>${this.trainUpgradeReturnConfirmed ? this.t("product.readyToApplySelection", "Listo para aplicar la selección.") : this.t("product.confirmBothToApply", "Confirma ida y retorno para aplicar el cambio.")}</small>`;
      }
      if (apply) apply.disabled = !(this.trainUpgradeOutboundConfirmed && this.trainUpgradeReturnConfirmed);
    };
    proto.renderTrainUpgradeLists = proto.renderTrainUpgradeListsV69;

    proto.renderTrainUpgradeCardV69 = function (train, direction) {
      const expandedId = direction === "outbound" ? this.expandedOutboundTrainId : this.expandedReturnTrainId;
      const selectedId = direction === "outbound" ? this.trainUpgradeDraftOutboundId : this.trainUpgradeDraftReturnId;
      const expanded = expandedId === train.id;
      const selected = selectedId === train.id;
      const diff = this.getTrainPositiveDifferencePerPerson?.(train, direction) || 0;
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : this.t("product.includedShort", "Incluido");
      const logo = this.getTrainCompanyLogo?.(train.company) || "";
      const image = this.getTrainImageForUpgrade?.(train) || "";
      const features = this.getTrainFeatureListForUpgrade?.(train) || [];
      const duration = this.formatTrainDurationForUpgrade?.(train) || "";
      const directionLabel = direction === "outbound" ? this.t("product.trainDirectionOutboundLower", "tren de ida") : this.t("product.trainDirectionReturnLower", "tren de retorno");
      return `
        <article class="train-upgrade-card train-upgrade-card--v69 ${expanded ? "is-expanded" : ""} ${selected ? "is-selected" : ""}" data-train-upgrade-option data-train-direction="${esc(direction)}" data-train-id="${esc(train.id)}">
          <div class="train-upgrade-card__main">
            <span class="train-upgrade-card__radio" aria-hidden="true"></span>
            <span class="train-upgrade-card__logo">${logo ? `<img src="${esc(logo)}" alt="${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" />` : ""}</span>
            <span class="train-upgrade-card__service"><strong>${esc(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong><small>${esc(train.companyName || train.company || "")}</small></span>
            <span class="train-upgrade-card__station"><em>Salida</em><b>${esc(train.departureTime || "")}</b><small>${esc((train.route || "").split("→")[0]?.trim() || "Ollantaytambo")}</small></span>
            <span class="train-upgrade-card__duration">${esc(duration)}</span>
            <span class="train-upgrade-card__station"><em>Llegada</em><b>${esc(train.arrivalTime || "")}</b><small>${esc((train.route || "").split("→")[1]?.trim() || "Machu Picchu")}</small></span>
            <span class="train-upgrade-card__price"><em>Cargo adicional</em><b>${esc(diffText)}</b></span>
          </div>
          <div class="train-upgrade-card__details">
            ${image ? `<img src="${esc(image)}" alt="${esc(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />` : ""}
            <div>
              <strong>${esc((train.label || this.t("quote.train.detailTrainFallback", "Tren")) + " — " + (train.companyName || train.company || ""))}</strong>
              <ul>${features.map((feature) => `<li>${esc(feature)}</li>`).join("")}</ul>
              <button type="button" class="train-upgrade-select-btn" data-confirm-train-upgrade data-train-direction="${esc(direction)}" data-train-id="${esc(train.id)}">${this.t("product.selectThisTrainDirection", "Seleccionar este {train}", { train: esc(directionLabel) })}</button>
            </div>
          </div>
        </article>
      `;
    };
    proto.renderTrainUpgradeCard = proto.renderTrainUpgradeCardV69;

    proto.renderPaymentReviewStep = function (payload) {
      const review = document.getElementById("passengerCheckoutReview");
      const modal = document.getElementById("passengerReservationModal");
      const form = document.getElementById("passengerReservationForm");
      if (!review) return;

      const serviceTotalValue = Number(payload.serviceTotalValue || 0);
      const payNowValue = Number(payload.payNowValue || 0);
      const payLaterValue = Number(payload.payLaterValue || 0);
      const hasDiscount = serviceTotalValue > 0 && payNowValue > 0 && payNowValue < serviceTotalValue && payLaterValue <= 0.01;
      const discountAmount = Math.max(0, serviceTotalValue - payNowValue);
      const paymentLabel = hasDiscount ? this.t("product.payNowWithDiscount", "Monto a pagar ahora (descuento aplicado)") : this.t("product.payNowLabel", "Monto a pagar ahora");

      const passengerRows = (payload.passengers || []).map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
        const pending = p.completionStatus === "pending" || p.completeLater || !name;
        const doc = [p.documentType, p.documentNumber].filter(Boolean).join(" · ");
        return `<li class="passenger-review-passenger ${pending ? "is-pending" : "is-complete"}">
          <span>Pasajero ${esc(p.passengerNumber || "")}</span>
          <strong>${esc(pending ? "Pendiente de datos" : name)}</strong>
          ${doc ? `<small>${esc(doc)}</small>` : `<small>${pending ? "Se podrá completar después" : "Datos registrados"}</small>`}
        </li>`;
      }).join("");

      const rows = [
        ["Experiencia", payload.productTitle],
        ["Fecha", payload.date],
        [this.t("product.travelersLabel", "Viajeros"), `${this.t("product.adultsPlural", "{n} adulto(s)", { n: payload.adults || 0 })} · ${this.t("product.childrenPlural", "{n} niño(s)", { n: payload.children || 0 })}`],
        [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
        ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"]
      ];
      if (payLaterValue > 0.01) {
        rows.push([this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal]);
        rows.push(["Saldo pendiente", payload.payLater]);
      }

      review.hidden = false;
      review.innerHTML = `
        <div class="passenger-review-card passenger-review-card--final passenger-review-card--v69">
          <div class="passenger-review-card__header">
            <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
            <span>Revisa los datos antes de continuar al pago.</span>
          </div>
          <div class="passenger-review-total">
            <span>${esc(paymentLabel)}</span>
            <strong>${esc(payload.payNow || "")}</strong>
            ${hasDiscount ? `<small><span>Antes:</span> <del>${esc(payload.serviceTotal || "")}</del> <b>Ahorras ${esc(payload.currency || currency())} ${esc(formatMoney(discountAmount))}</b></small>` : ""}
          </div>
          <div class="passenger-review-grid passenger-review-grid--final">
            ${rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value || "-")}</strong></div>`).join("")}
          </div>
          <div class="passenger-review-passengers">
            <strong>Datos de pasajeros</strong>
            <ul class="passenger-review-list">${passengerRows}</ul>
          </div>
          <button class="passenger-review-edit-btn" type="button" data-edit-passenger-details>Editar datos de pasajeros</button>
        </div>
      `;

      if (modal) modal.classList.add("passenger-modal--review");
      const title = document.getElementById("passengerModalTitle");
      if (title) title.textContent = this.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
      const warning = document.querySelector(".passenger-modal__warning");
      if (warning) warning.hidden = true;
      const message = document.querySelector("[data-passenger-message]");
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error");
      }
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "Pagar";
      review.querySelector("[data-edit-passenger-details]")?.addEventListener("click", () => {
        if (form) delete form.dataset.paymentReviewConfirmed;
        if (modal) modal.classList.remove("passenger-modal--review");
        review.hidden = true;
        review.innerHTML = "";
        if (title) title.textContent = this.t("product.bookingDetailsTitle", "Detalles de reserva");
        if (warning) warning.hidden = false;
        if (submit) submit.textContent = this.t("booking.continue", "Continuar");
      });
      review.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    proto.getPhoneCodeOptionsHtml = function () {
      const countries = [
        ["Perú", "+51"], ["Estados Unidos / Canadá", "+1"], ["México", "+52"], ["Colombia", "+57"], ["Chile", "+56"], ["Argentina", "+54"], ["Brasil", "+55"], ["Bolivia", "+591"], ["Ecuador", "+593"], ["Uruguay", "+598"], ["Paraguay", "+595"], ["Venezuela", "+58"],
        ["España", "+34"], ["Reino Unido", "+44"], ["Francia", "+33"], ["Alemania", "+49"], ["Italia", "+39"], ["Portugal", "+351"], ["Países Bajos", "+31"], ["Bélgica", "+32"], ["Suiza", "+41"], ["Austria", "+43"], ["Irlanda", "+353"], ["Noruega", "+47"], ["Suecia", "+46"], ["Dinamarca", "+45"], ["Finlandia", "+358"], ["Polonia", "+48"], ["República Checa", "+420"], ["Hungría", "+36"], ["Grecia", "+30"], ["Rumanía", "+40"], ["Turquía", "+90"], ["Rusia", "+7"], ["Ucrania", "+380"],
        ["Australia", "+61"], ["Nueva Zelanda", "+64"], ["Japón", "+81"], ["China", "+86"], ["Hong Kong", "+852"], ["Taiwán", "+886"], ["Corea del Sur", "+82"], ["India", "+91"], ["Indonesia", "+62"], ["Tailandia", "+66"], ["Vietnam", "+84"], ["Filipinas", "+63"], ["Malasia", "+60"], ["Singapur", "+65"], ["Israel", "+972"], ["Emiratos Árabes Unidos", "+971"], ["Arabia Saudita", "+966"], ["Qatar", "+974"],
        ["Sudáfrica", "+27"], ["Marruecos", "+212"], ["Egipto", "+20"], ["Kenia", "+254"], ["Tanzania", "+255"], ["Ghana", "+233"], ["Nigeria", "+234"],
        ["Costa Rica", "+506"], ["Panamá", "+507"], ["Guatemala", "+502"], ["El Salvador", "+503"], ["Honduras", "+504"], ["Nicaragua", "+505"], ["República Dominicana", "+1"], ["Puerto Rico", "+1"], ["Cuba", "+53"], ["Jamaica", "+1"],
        ["Afganistán", "+93"], ["Albania", "+355"], ["Argelia", "+213"], ["Andorra", "+376"], ["Angola", "+244"], ["Armenia", "+374"], ["Azerbaiyán", "+994"], ["Bangladés", "+880"], ["Baréin", "+973"], ["Bélgica", "+32"], ["Bulgaria", "+359"], ["Costa de Marfil", "+225"], ["Croacia", "+385"], ["Estonia", "+372"], ["Georgia", "+995"], ["Guinea", "+224"], ["Haití", "+509"], ["Irán", "+98"], ["Irak", "+964"], ["Islandia", "+354"], ["Jordania", "+962"], ["Kazajistán", "+7"], ["Kuwait", "+965"], ["Letonia", "+371"], ["Líbano", "+961"], ["Lituania", "+370"], ["Luxemburgo", "+352"], ["Madagascar", "+261"], ["Malta", "+356"], ["Mónaco", "+377"], ["Nepal", "+977"], ["Pakistán", "+92"], ["Serbia", "+381"], ["Sri Lanka", "+94"], ["Túnez", "+216"], ["Uganda", "+256"], ["Uzbekistán", "+998"], ["Zambia", "+260"]
      ];
      return countries.map(([country, code]) => `<option value="${esc(code)}" data-code="${esc(code)}" data-full-label="${esc(`${code} · ${country}`)}" ${code === "+51" ? "selected" : ""}>${esc(`${code} · ${country}`)}</option>`).join("");
    };

    proto.compactPhoneCodeSelect = function (select) {
      if (!select) return;
      const selectedValue = select.value || "+51";
      Array.from(select.options || []).forEach((option) => {
        const full = option.dataset.fullLabel || option.textContent || option.value;
        option.dataset.fullLabel = full;
        option.textContent = option.value === selectedValue ? (option.dataset.code || option.value) : full;
      });
    };

    proto.expandPhoneCodeSelect = function (select) {
      if (!select) return;
      Array.from(select.options || []).forEach((option) => {
        if (option.dataset.fullLabel) option.textContent = option.dataset.fullLabel;
      });
    };

    proto.populatePhoneCodeSelects = function (scope = document) {
      const options = this.getPhoneCodeOptionsHtml();
      scope.querySelectorAll?.("select[data-phone-code-select]").forEach((select) => {
        const current = select.value || "+51";
        select.innerHTML = options;
        select.value = current;
        if (!select.value) select.value = "+51";
        select.dataset.phoneCodesLoaded = "true";
        if (select.dataset.v69PhoneBound !== "true") {
          select.dataset.v69PhoneBound = "true";
          select.addEventListener("mousedown", () => this.expandPhoneCodeSelect(select));
          select.addEventListener("focus", () => this.expandPhoneCodeSelect(select));
          select.addEventListener("change", () => setTimeout(() => this.compactPhoneCodeSelect(select), 0));
          select.addEventListener("blur", () => this.compactPhoneCodeSelect(select));
        }
        this.compactPhoneCodeSelect(select);
      });
    };

    document.addEventListener("click", function mctTrainOpenCapture(event) {
      const trigger = event.target.closest?.("#openTrainUpgradeModal, [data-open-train-upgrade]");
      if (!trigger) return;
      const activePage = window.MyCuscoTripProductPage;
      if (!activePage?.openTrainUpgradeModalV69) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      activePage.openTrainUpgradeModalV69();
    }, true);

    page.__mctV69Applied = true;
    try {
      page.populatePhoneCodeSelects?.(document);
      page.updateTrainSelectionState?.(page.trainUpgradeSameCompanyOnly);
      page.updatePricing?.();
    } catch (error) {
      console.warn("MCT V69 post-apply warning:", error);
    }
    return true;
  }

  if (!patchV69()) {
    document.addEventListener("DOMContentLoaded", patchV69);
    setTimeout(patchV69, 250);
    setTimeout(patchV69, 800);
  }
})();


/* =========================================================
   PATCH MCT V70 - Modal upgrade compacto, cards completas
   ========================================================= */
(function () {
  function patchV70() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV70Applied) return true;

    const proto = Object.getPrototypeOf(page) || page;
    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const formatMoney = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const currency = () => page.product?.currency || "USD";

    proto.formatTrainStationNameV70 = function (value, direction, endpoint) {
      const raw = String(value || "").trim();
      const normalized = raw.toUpperCase().replace(/\s+/g, "_");
      const map = {
        OLLA: "Ollantaytambo", OLLANTA: "Ollantaytambo", OLLANTAYTAMBO: "Ollantaytambo", OLLA_MAPI: "Ollantaytambo",
        MAPI: "Machu Picchu", MACHU_PICCHU: "Machu Picchu", MACHUPICCHU: "Machu Picchu", MACHU: "Machu Picchu",
        CUSCO: "Cusco", POROY: "Poroy", SAN_PEDRO: "San Pedro", URUBAMBA: "Urubamba", HIDROELECTRICA: "Hidroeléctrica", HIDROELÉCTRICA: "Hidroeléctrica"
      };
      if (map[normalized]) return map[normalized];
      if (raw && !raw.includes("_") && !/^[A-Z0-9]{3,}$/i.test(raw)) return raw;
      if (direction === "return") return endpoint === "from" ? "Machu Picchu" : "Ollantaytambo";
      return endpoint === "from" ? "Ollantaytambo" : "Machu Picchu";
    };

    proto.getTrainEndpointsV70 = function (train, direction) {
      const routeParts = String(train?.route || "").split("→").map((part) => part.trim()).filter(Boolean);
      const from = train?.departureStation || train?.raw?.departureStation || train?.raw?.fromStation || routeParts[0] || "";
      const to = train?.arrivalStation || train?.raw?.arrivalStation || train?.raw?.toStation || routeParts[1] || "";
      return {
        from: this.formatTrainStationNameV70(from, direction, "from"),
        to: this.formatTrainStationNameV70(to, direction, "to")
      };
    };

    proto.ensureTrainUpgradeModalV70 = function () {
      const existing = document.getElementById("trainUpgradeModal");
      if (existing) existing.remove();
      document.body.insertAdjacentHTML("beforeend", `
        <div class="train-upgrade-modal train-upgrade-modal--v69 train-upgrade-modal--v70" hidden id="trainUpgradeModal">
          <div class="train-upgrade-modal__backdrop" data-close-train-upgrade></div>
          <div class="train-upgrade-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="trainUpgradeModalTitle">
            <button class="train-upgrade-modal__close" type="button" data-close-train-upgrade aria-label="${this.escapeHtml(this.t("booking.close", "Cerrar"))}"><i class="fas fa-xmark"></i></button>
            <header class="train-upgrade-modal__header">
              <p>${this.t("product.modal.trainSelectionHeading", "Selección de trenes")}</p>
              <h2 id="trainUpgradeModalTitle">Upgrade de trenes</h2>
              <span>Elige primero la ida, confirma el tren y luego selecciona el retorno compatible.</span>
            </header>
            <div class="train-upgrade-modal__tools train-upgrade-modal__tools--v70">
              <strong class="train-upgrade-modal__step-title" id="trainUpgradeCurrentStepTitle">Elige tu tren de ida</strong>
              <div class="train-upgrade-modal__filter">
                <label for="trainUpgradeSortFilter">${this.t("product.modal.sortFilterLabel", "Ordenar / filtrar")}</label>
                <select id="trainUpgradeSortFilter">
                  <option value="early">${this.t("product.modal.sortEarliest", "Más temprano primero")}</option>
                  <option value="late">${this.t("product.modal.sortLatest", "Más tarde primero")}</option>
                  <option value="cheap">${this.t("product.modal.sortCheapest", "Más barato primero")}</option>
                  <option value="panoramic">${this.t("product.modal.filterPanoramic", "Trenes panorámicos")}</option>
                  <option value="economy">${this.t("product.modal.filterEconomy", "Económicos")}</option>
                  <option value="nocharge">${this.t("product.noAdditionalCharge", "Sin cargo adicional")}</option>
                </select>
              </div>
            </div>
            <div class="train-upgrade-modal__body">
              <section class="train-upgrade-section" id="trainUpgradeOutboundSection"></section>
              <section class="train-upgrade-section" id="trainUpgradeReturnSection"></section>
              <section class="train-upgrade-section" id="trainUpgradeFinalSummarySection"></section>
            </div>
            <footer class="train-upgrade-modal__footer">
              <div id="trainUpgradeFooterSummary"></div>
              <div class="train-upgrade-modal__footer-actions">
                <button class="btn train-upgrade-cancel-btn" type="button" data-close-train-upgrade>${this.t("booking.cancel", "Cancelar")}</button>
                <button class="btn booking-main-btn train-upgrade-apply-btn" type="button" data-apply-train-upgrade>${this.t("product.modal.applySelection", "Aplicar selección")}</button>
              </div>
            </footer>
          </div>
        </div>
      `);

      const modal = document.getElementById("trainUpgradeModal");
      const filter = document.getElementById("trainUpgradeSortFilter");
      filter?.addEventListener("change", (event) => {
        this.trainUpgradeFilter = event.target.value || "early";
        this.renderTrainUpgradeListsV70();
      });

      modal?.addEventListener("click", (event) => {
        if (event.target.closest("[data-close-train-upgrade]")) {
          modal.hidden = true;
          document.body.classList.remove("train-upgrade-modal-open");
          return;
        }

        const modify = event.target.closest("[data-modify-train-upgrade]");
        if (modify) {
          const direction = modify.dataset.trainDirection;
          if (direction === "outbound") {
            this.trainUpgradeOutboundConfirmed = false;
            this.trainUpgradeReturnConfirmed = false;
            this.trainUpgradeDraftReturnId = this.selectedReturnTrainId || "";
            this.expandedOutboundTrainId = this.trainUpgradeDraftOutboundId || this.selectedOutboundTrainId || "";
          } else {
            this.trainUpgradeReturnConfirmed = false;
            this.expandedReturnTrainId = this.trainUpgradeDraftReturnId || this.selectedReturnTrainId || "";
          }
          this.renderTrainUpgradeListsV70();
          return;
        }

        const confirm = event.target.closest("[data-confirm-train-upgrade]");
        if (confirm) {
          const direction = confirm.dataset.trainDirection;
          const id = confirm.dataset.trainId || "";
          if (direction === "outbound") {
            this.trainUpgradeDraftOutboundId = id;
            this.trainUpgradeOutboundConfirmed = true;
            const outboundTrain = this.findTrainById?.(id, this.availableOutboundTrains) || null;
            const compatible = this.getCompatibleReturnTrainsForDraft?.(outboundTrain) || [];
            if (!compatible.some((train) => train.id === this.trainUpgradeDraftReturnId)) {
              this.trainUpgradeDraftReturnId = compatible[0]?.id || "";
            }
            this.trainUpgradeReturnConfirmed = false;
            this.expandedReturnTrainId = this.trainUpgradeDraftReturnId || "";
            this.renderTrainUpgradeListsV70();
            setTimeout(() => document.getElementById("trainUpgradeReturnSection")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          } else {
            this.trainUpgradeDraftReturnId = id;
            this.trainUpgradeReturnConfirmed = true;
            this.renderTrainUpgradeListsV70();
            setTimeout(() => document.getElementById("trainUpgradeFinalSummarySection")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
          }
          return;
        }

        const card = event.target.closest("[data-train-upgrade-option]");
        if (card) {
          const direction = card.dataset.trainDirection;
          const id = card.dataset.trainId || "";
          if (direction === "outbound") this.expandedOutboundTrainId = this.expandedOutboundTrainId === id ? "" : id;
          else this.expandedReturnTrainId = this.expandedReturnTrainId === id ? "" : id;
          this.renderTrainUpgradeListsV70();
          return;
        }

        const apply = event.target.closest("[data-apply-train-upgrade]");
        if (apply) {
          if (!this.trainUpgradeOutboundConfirmed || !this.trainUpgradeReturnConfirmed) return;
          this.selectedOutboundTrainId = this.trainUpgradeDraftOutboundId || this.selectedOutboundTrainId;
          this.selectedReturnTrainId = this.trainUpgradeDraftReturnId || this.selectedReturnTrainId;
          this.updateTrainSelectionState?.(this.trainUpgradeSameCompanyOnly);
          this.updatePricing?.();
          modal.hidden = true;
          document.body.classList.remove("train-upgrade-modal-open");
        }
      });
    };

    proto.openTrainUpgradeModalV70 = function () {
      this.ensureTrainUpgradeModalV70();
      this.trainUpgradeFilter = "early";
      this.trainUpgradeDraftOutboundId = this.selectedOutboundTrainId || this.availableOutboundTrains?.[0]?.id || "";
      const outboundTrain = this.findTrainById?.(this.trainUpgradeDraftOutboundId, this.availableOutboundTrains) || null;
      const compatible = this.getCompatibleReturnTrainsForDraft?.(outboundTrain) || [];
      this.trainUpgradeDraftReturnId = this.selectedReturnTrainId || compatible[0]?.id || "";
      this.trainUpgradeOutboundConfirmed = false;
      this.trainUpgradeReturnConfirmed = false;
      this.expandedOutboundTrainId = this.trainUpgradeDraftOutboundId;
      this.expandedReturnTrainId = this.trainUpgradeDraftReturnId;
      const filter = document.getElementById("trainUpgradeSortFilter");
      if (filter) filter.value = "early";
      this.renderTrainUpgradeListsV70();
      const modal = document.getElementById("trainUpgradeModal");
      if (!modal) return;
      modal.hidden = false;
      document.body.classList.add("train-upgrade-modal-open");
    };

    proto.renderTrainUpgradeListsV70 = function () {
      const outboundSection = document.getElementById("trainUpgradeOutboundSection");
      const returnSection = document.getElementById("trainUpgradeReturnSection");
      const finalSection = document.getElementById("trainUpgradeFinalSummarySection");
      const stepTitle = document.getElementById("trainUpgradeCurrentStepTitle");
      if (!outboundSection || !returnSection || !finalSection) return;

      const outboundTrain = this.findTrainById?.(this.trainUpgradeDraftOutboundId, this.availableOutboundTrains) || null;
      const returnTrain = this.findTrainById?.(this.trainUpgradeDraftReturnId, this.availableReturnTrains) || null;
      const outboundList = typeof this.filterSortTrainListForModal === "function"
        ? this.filterSortTrainListForModal(this.availableOutboundTrains || [], "outbound")
        : [...(this.availableOutboundTrains || [])];
      const compatibleReturns = this.getCompatibleReturnTrainsForDraft?.(outboundTrain) || [];

      if (stepTitle) {
        stepTitle.textContent = !this.trainUpgradeOutboundConfirmed
          ? this.t("product.chooseOutboundTrain", "Elige tu tren de ida")
          : (!this.trainUpgradeReturnConfirmed ? this.t("product.chooseReturnTrain", "Elige tu tren de retorno") : this.t("product.trainSelectedSummaryHeading", "Resumen de trenes seleccionados"));
      }

      if (this.trainUpgradeOutboundConfirmed) {
        outboundSection.innerHTML = this.renderSelectedTrainSummaryV70(outboundTrain, "outbound");
      } else {
        outboundSection.innerHTML = `
          <div class="train-upgrade-modal__list train-upgrade-modal__list--v69 train-upgrade-modal__list--v70">
            ${outboundList.length ? outboundList.map((train) => this.renderTrainUpgradeCardV70(train, "outbound")).join("") : `<p class="train-upgrade-empty">No hay trenes de ida para este filtro.</p>`}
          </div>
        `;
      }

      if (!this.trainUpgradeOutboundConfirmed) {
        returnSection.hidden = true;
        finalSection.hidden = true;
      } else {
        returnSection.hidden = false;
        if (this.trainUpgradeReturnConfirmed) {
          returnSection.innerHTML = this.renderSelectedTrainSummaryV70(returnTrain, "return");
        } else {
          returnSection.innerHTML = `
            <div class="train-upgrade-modal__list train-upgrade-modal__list--v69 train-upgrade-modal__list--v70">
              ${compatibleReturns.length ? compatibleReturns.map((train) => this.renderTrainUpgradeCardV70(train, "return")).join("") : `<p class="train-upgrade-empty">No hay trenes de retorno compatibles para este filtro.</p>`}
            </div>
          `;
        }
        finalSection.hidden = !this.trainUpgradeReturnConfirmed;
        if (this.trainUpgradeReturnConfirmed) {
          const outboundDiff = this.getTrainPositiveDifferencePerPerson?.(outboundTrain, "outbound") || 0;
          const returnDiff = this.getTrainPositiveDifferencePerPerson?.(returnTrain, "return") || 0;
          const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
          finalSection.innerHTML = `
            <div class="train-upgrade-final-summary train-upgrade-final-summary--v70">
              <strong>Resumen de trenes seleccionados</strong>
              <span>Ida: ${esc(outboundTrain?.label || "-")} · ${esc(outboundTrain?.departureTime || "")} → ${esc(outboundTrain?.arrivalTime || "")}</span>
              <span>Retorno: ${esc(returnTrain?.label || "-")} · ${esc(returnTrain?.departureTime || "")} → ${esc(returnTrain?.arrivalTime || "")}</span>
              <b>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc(currency())} ${esc(formatMoney(total))}</b>
            </div>
          `;
        }
      }

      const footer = document.getElementById("trainUpgradeFooterSummary");
      const apply = document.querySelector("[data-apply-train-upgrade]");
      if (footer) {
        const outboundDiff = this.getTrainPositiveDifferencePerPerson?.(outboundTrain, "outbound") || 0;
        const returnDiff = this.getTrainPositiveDifferencePerPerson?.(returnTrain, "return") || 0;
        const total = (outboundDiff + returnDiff) * this.getTotalPassengers();
        footer.innerHTML = `<strong>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc(currency())} ${esc(formatMoney(total))}</strong><small>${this.trainUpgradeReturnConfirmed ? this.t("product.readyToApplySelection", "Listo para aplicar la selección.") : this.t("product.confirmBothToApply", "Confirma ida y retorno para aplicar el cambio.")}</small>`;
      }
      if (apply) apply.disabled = !(this.trainUpgradeOutboundConfirmed && this.trainUpgradeReturnConfirmed);
    };

    proto.renderTrainUpgradeCardV70 = function (train, direction) {
      const expandedId = direction === "outbound" ? this.expandedOutboundTrainId : this.expandedReturnTrainId;
      const selectedId = direction === "outbound" ? this.trainUpgradeDraftOutboundId : this.trainUpgradeDraftReturnId;
      const expanded = expandedId === train.id;
      const selected = selectedId === train.id;
      const diff = this.getTrainPositiveDifferencePerPerson?.(train, direction) || 0;
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : this.t("product.includedShort", "Incluido");
      const logo = this.getTrainCompanyLogo?.(train.company) || "";
      const image = this.getTrainImageForUpgrade?.(train) || "";
      const features = this.getTrainFeatureListForUpgrade?.(train) || [];
      const duration = this.formatTrainDurationForUpgrade?.(train) || "";
      const directionLabel = direction === "outbound" ? this.t("product.trainDirectionOutboundLower", "tren de ida") : this.t("product.trainDirectionReturnLower", "tren de retorno");
      const endpoints = this.getTrainEndpointsV70?.(train, direction) || { from: direction === "return" ? "Machu Picchu" : "Ollantaytambo", to: direction === "return" ? "Ollantaytambo" : "Machu Picchu" };
      return `
        <article class="train-upgrade-card train-upgrade-card--v69 train-upgrade-card--v70 ${expanded ? "is-expanded" : ""} ${selected ? "is-selected" : ""}" data-train-upgrade-option data-train-direction="${esc(direction)}" data-train-id="${esc(train.id)}">
          <div class="train-upgrade-card__main">
            <span class="train-upgrade-card__radio" aria-hidden="true"></span>
            <span class="train-upgrade-card__logo">${logo ? `<img src="${esc(logo)}" alt="${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" />` : ""}</span>
            <span class="train-upgrade-card__service"><strong>${esc(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}</strong><small>${esc(train.companyName || train.company || "")}</small></span>
            <span class="train-upgrade-card__station"><em>Salida</em><b>${esc(train.departureTime || "")}</b><small>${esc(endpoints.from)}</small></span>
            <span class="train-upgrade-card__duration">${esc(duration)}</span>
            <span class="train-upgrade-card__station"><em>Llegada</em><b>${esc(train.arrivalTime || "")}</b><small>${esc(endpoints.to)}</small></span>
            <span class="train-upgrade-card__price"><em>Cargo adicional</em><b>${esc(diffText)}</b></span>
          </div>
          <div class="train-upgrade-card__details">
            ${image ? `<img src="${esc(image)}" alt="${esc(train.label || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />` : ""}
            <div>
              <strong>${esc((train.label || this.t("quote.train.detailTrainFallback", "Tren")) + " — " + (train.companyName || train.company || ""))}</strong>
              <ul>${features.map((feature) => `<li>${esc(feature)}</li>`).join("")}</ul>
              <button type="button" class="train-upgrade-select-btn" data-confirm-train-upgrade data-train-direction="${esc(direction)}" data-train-id="${esc(train.id)}">${this.t("product.selectThisTrainDirection", "Seleccionar este {train}", { train: esc(directionLabel) })}</button>
            </div>
          </div>
        </article>
      `;
    };

    proto.renderSelectedTrainSummaryV70 = function (train, direction) {
      if (!train) return "";
      const diff = this.getTrainPositiveDifferencePerPerson?.(train, direction) || 0;
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : "Incluido / sin recargo";
      const logo = this.getTrainCompanyLogo?.(train.company) || "";
      const title = direction === "outbound" ? this.t("booking.train.outbound", "Tren de ida") : this.t("booking.train.return", "Tren de retorno");
      const modifyText = direction === "outbound" ? this.t("product.editOutboundTrain", "Modificar tren de ida") : this.t("product.editReturnTrain", "Modificar tren de retorno");
      const date = this.selectedDate ? this.formatDateForDisplay?.(this.selectedDate) || this.selectedDate : "Fecha de viaje";
      const endpoints = this.getTrainEndpointsV70?.(train, direction) || { from: "", to: "" };
      return `
        <article class="train-upgrade-selected-summary train-upgrade-selected-summary--v70">
          <span class="train-upgrade-selected-summary__badge">Tren seleccionado</span>
          <div class="train-upgrade-selected-summary__content">
            ${logo ? `<img src="${esc(logo)}" alt="${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />` : ""}
            <div>
              <strong>${esc(title)}</strong>
              <b>${esc(`${train.companyName || train.company || ""} ${train.label || ""}`.trim())}</b>
              <small>${esc(date)}</small>
              <span>${esc(`${endpoints.from} ${train.departureTime || ""} → ${endpoints.to} ${train.arrivalTime || ""}`)}</span>
              <em>${esc(diffText)}</em>
            </div>
            <button type="button" data-modify-train-upgrade data-train-direction="${esc(direction)}">${esc(modifyText)}</button>
          </div>
        </article>
      `;
    };

    proto.ensureTrainUpgradeModal = proto.ensureTrainUpgradeModalV70;
    proto.openTrainUpgradeModalV69 = proto.openTrainUpgradeModalV70;
    proto.openTrainUpgradeModalV66 = proto.openTrainUpgradeModalV70;
    proto.openTrainUpgradeModalV64 = proto.openTrainUpgradeModalV70;
    proto.renderTrainUpgradeLists = proto.renderTrainUpgradeListsV70;
    proto.renderTrainUpgradeListsV69 = proto.renderTrainUpgradeListsV70;
    proto.renderTrainUpgradeCard = proto.renderTrainUpgradeCardV70;
    proto.renderTrainUpgradeCardV69 = proto.renderTrainUpgradeCardV70;
    proto.renderSelectedTrainSummaryV69 = proto.renderSelectedTrainSummaryV70;

    page.__mctV70Applied = true;
    try {
      page.updateTrainSelectionState?.(page.trainUpgradeSameCompanyOnly);
    } catch (error) {
      console.warn("MCT V70 post-apply warning:", error);
    }
    return true;
  }

  if (!patchV70()) {
    document.addEventListener("DOMContentLoaded", patchV70);
    setTimeout(patchV70, 300);
    setTimeout(patchV70, 900);
    setTimeout(patchV70, 1600);
  }
})();

/* =========================================================
   PATCH MCT V71 - Header reserva y ajustes estéticos finales
   ========================================================= */
(function () {
  function patchV71() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV71Applied) return true;

    const proto = Object.getPrototypeOf(page) || page;
    const oldOpen = proto.openPassengerReservationModal;

    function formatReservationDateOnly(value) {
      const date = value ? new Date(value) : new Date();
      if (Number.isNaN(date.getTime())) return this.t("product.reservationGeneratedFallback", "Reserva generada");
      try {
        return this.t("product.reservationGeneratedOn", "Reserva generada: {date}", { date: date.toLocaleDateString(mctLocaleDateTag(), { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "") });
      } catch (_) {
        return this.t("product.reservationGeneratedOn", "Reserva generada: {date}", { date: date.toLocaleDateString(mctLocaleDateTag()) });
      }
    }

    proto.applyPassengerHeaderV71 = function () {
      const modal = document.getElementById("passengerReservationModal");
      if (!modal) return;
      const title = document.getElementById("passengerModalTitle");
      const timestamp = document.getElementById("passengerReservationTimestamp");
      if (title && !modal.classList.contains("passenger-modal--review")) title.textContent = this.t("product.passengerDetailsTitle", "Datos de los pasajeros");
      if (timestamp) timestamp.textContent = formatReservationDateOnly(this.currentPreReservation?.createdAt);
    };

    proto.openPassengerReservationModal = function () {
      const result = oldOpen.apply(this, arguments);
      this.applyPassengerHeaderV71?.();
      return result;
    };

    const oldRenderExtras = proto.renderExtras;
    proto.renderExtras = function (extras) {
      const result = oldRenderExtras.apply(this, arguments);
      const section = document.getElementById("extrasSection");
      const label = section?.querySelector("label");
      if (label) label.textContent = this.t("product.extrasLunchOptionsLabel", "Extras: opciones de almuerzo");
      return result;
    };

    const oldRenderPaymentReviewStep = proto.renderPaymentReviewStep;
    if (typeof oldRenderPaymentReviewStep === "function") {
      proto.renderPaymentReviewStep = function (payload) {
        const result = oldRenderPaymentReviewStep.apply(this, arguments);
        const title = document.getElementById("passengerModalTitle");
        if (title) title.textContent = this.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
        return result;
      };
    }

    page.__mctV71Applied = true;
    try {
      page.applyPassengerHeaderV71?.();
    } catch (error) {
      console.warn("MCT V71 post-apply warning:", error);
    }
    return true;
  }

  if (!patchV71()) {
    document.addEventListener("DOMContentLoaded", patchV71);
    setTimeout(patchV71, 250);
    setTimeout(patchV71, 900);
  }
})();

/* =========================================================
   PATCH MCT V73 - Ajustes finales checkout, pasajeros y trenes
   ========================================================= */
(function () {
  function patchV73() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV73Applied) return true;

    const proto = Object.getPrototypeOf(page) || page;
    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const formatMoney = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const currency = () => page.product?.currency || "USD";

    function normalizeDocumentType(value) {
      const key = String(value || "").trim().toLowerCase();
      const map = {
        dni: "DNI",
        passport: page.t ? page.t("quote.passenger.passport", "Pasaporte") : "Pasaporte",
        pasaporte: page.t ? page.t("quote.passenger.passport", "Pasaporte") : "Pasaporte",
        id_card: page.t ? page.t("product.docTypeIdCard", "Documento de identidad") : "Documento de identidad",
        document: page.t ? page.t("quote.passenger.docPlaceholder", "Documento") : "Documento",
        other: page.t ? page.t("product.docTypeOther", "Otro") : "Otro",
        otro: page.t ? page.t("product.docTypeOther", "Otro") : "Otro"
      };
      if (map[key]) return map[key];
      if (!key) return "";
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
    }

    function formatTravelDate(value) {
      if (!value) return "-";
      const raw = String(value).trim();
      let date = null;
      const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      else {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) date = parsed;
      }
      if (date && !Number.isNaN(date.getTime())) {
        return date.toLocaleDateString(mctLocaleDateTag(), { day: "2-digit", month: "long", year: "numeric" }).replace(/ de /g, " ");
      }
      return raw.replace(/\bde\s+/gi, "").replace(/,/g, "");
    }

    function formatTravelers(adults, children) {
      const a = Number(adults || 0);
      const c = Number(children || 0);
      const parts = [];
      parts.push(String(window.MyCuscoTripI18n?.t("product.adultsPlural", "{n} adulto(s)") ?? "{n} adulto(s)").replace("{n}", a));
      if (c > 0) parts.push(String(window.MyCuscoTripI18n?.t("product.childrenPlural", "{n} niño(s)") ?? "{n} niño(s)").replace("{n}", c));
      return parts.join(" · ");
    }

    function ensurePassengerActionButtons() {
      const actions = document.querySelector(".passenger-modal__actions");
      if (!actions) return;
      let cancel = actions.querySelector(".passenger-modal__cancel-btn");
      const submit = actions.querySelector('button[type="submit"]');
      if (!cancel) {
        cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn passenger-modal__cancel-btn";
        cancel.setAttribute("data-close-passenger-modal", "");
        cancel.textContent = this.t("booking.cancel", "Cancelar");
        actions.insertBefore(cancel, submit || null);
      }
      cancel.onclick = () => page.closePassengerReservationModal?.();
      if (submit && !submit.textContent.trim()) submit.textContent = this.t("booking.continue", "Continuar");
    }

    const oldOpenPassenger = proto.openPassengerReservationModal;
    if (typeof oldOpenPassenger === "function") {
      proto.openPassengerReservationModal = function () {
        const result = oldOpenPassenger.apply(this, arguments);
        window.setTimeout(() => {
          ensurePassengerActionButtons();
          const submit = document.querySelector('#passengerReservationForm button[type="submit"]');
          if (submit) submit.textContent = this.t("booking.continue", "Continuar");
        }, 0);
        return result;
      };
    }

    proto.renderPaymentReviewStep = function (payload) {
      const review = document.getElementById("passengerCheckoutReview");
      const modal = document.getElementById("passengerReservationModal");
      const form = document.getElementById("passengerReservationForm");
      if (!review) return;

      ensurePassengerActionButtons();

      const serviceTotalValue = Number(payload.serviceTotalValue || 0);
      const payNowValue = Number(payload.payNowValue || 0);
      const payLaterValue = Number(payload.payLaterValue || 0);
      const hasDiscount = serviceTotalValue > 0 && payNowValue > 0 && payNowValue < serviceTotalValue && payLaterValue <= 0.01;
      const discountAmount = Math.max(0, serviceTotalValue - payNowValue);
      const paymentLabel = hasDiscount ? this.t("product.payNowWithDiscount", "Monto a pagar ahora (descuento aplicado)") : this.t("product.payNowLabel", "Monto a pagar ahora");

      const passengerRows = (payload.passengers || []).map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
        const pending = p.completionStatus === "pending" || p.completeLater || !name;
        const docType = normalizeDocumentType(p.documentType);
        const doc = [docType, p.documentNumber].filter(Boolean).join(" · ");
        return `<li class="passenger-review-passenger ${pending ? "is-pending" : "is-complete"}">
          <span>Pasajero ${esc(p.passengerNumber || "")}</span>
          <strong>${esc(pending ? "Pendiente de datos" : name)}</strong>
          ${doc ? `<small>${esc(doc)}</small>` : `<small>${pending ? "Se podrá completar después" : "Datos registrados"}</small>`}
        </li>`;
      }).join("");

      const rows = [
        ["Experiencia", payload.productTitle],
        ["Fecha", formatTravelDate(payload.date)],
        ["Viajeros", formatTravelers(payload.adults, payload.children)],
        [this.t("quote.print.trainsLabel", "Trenes"), payload.summary?.trainSelection || this.t("product.includedBySelection", "Incluidos según selección")],
        ["Extras", payload.summary?.extras?.length ? payload.summary.extras.join(", ") : "Sin extras"]
      ];
      if (payLaterValue > 0.01) {
        rows.push([this.t("product.serviceTotalLabel", "Total del servicio"), payload.serviceTotal]);
        rows.push(["Saldo pendiente", payload.payLater]);
      }

      review.hidden = false;
      review.innerHTML = `
        <div class="passenger-review-card passenger-review-card--final passenger-review-card--v73">
          <div class="passenger-review-card__header">
            <strong>${this.t("booking.reservationSummaryTitle", "Resumen de tu reserva")}</strong>
            <span>Revisa los datos antes de continuar al pago.</span>
          </div>
          <div class="passenger-review-total">
            <span>${esc(paymentLabel)}</span>
            <strong>${esc(payload.payNow || "")}</strong>
            ${hasDiscount ? `<small><span>Antes:</span> <del>${esc(payload.serviceTotal || "")}</del> <b>Ahorras ${esc(payload.currency || currency())} ${esc(formatMoney(discountAmount))}</b></small>` : ""}
          </div>
          <div class="passenger-review-grid passenger-review-grid--final">
            ${rows.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(value || "-")}</strong></div>`).join("")}
          </div>
          <div class="passenger-review-passengers">
            <strong>Datos de pasajeros</strong>
            <ul class="passenger-review-list">${passengerRows}</ul>
          </div>
          <button class="passenger-review-edit-btn" type="button" data-edit-passenger-details>Editar datos de pasajeros</button>
        </div>
      `;

      if (modal) modal.classList.add("passenger-modal--review");
      const title = document.getElementById("passengerModalTitle");
      if (title) title.textContent = this.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
      const warning = document.querySelector(".passenger-modal__warning");
      if (warning) warning.hidden = true;
      const message = document.querySelector("[data-passenger-message]");
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error");
      }
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) submit.textContent = "Pagar";
      review.querySelector("[data-edit-passenger-details]")?.addEventListener("click", () => {
        if (form) delete form.dataset.paymentReviewConfirmed;
        if (modal) modal.classList.remove("passenger-modal--review");
        review.hidden = true;
        review.innerHTML = "";
        if (title) title.textContent = "Datos de los pasajeros";
        if (warning) warning.hidden = false;
        if (submit) submit.textContent = this.t("booking.continue", "Continuar");
        ensurePassengerActionButtons();
      });
      review.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    proto.renderSelectedTrainSummaryV70 = function (train, direction) {
      if (!train) return "";
      const diff = this.getTrainPositiveDifferencePerPerson?.(train, direction) || 0;
      const diffText = diff > 0 ? `+ ${currency()} ${formatMoney(diff)}` : "Incluido / sin recargo";
      const logo = this.getTrainCompanyLogo?.(train.company) || "";
      const title = direction === "outbound" ? this.t("booking.train.outbound", "Tren de ida") : this.t("booking.train.return", "Tren de retorno");
      const modifyText = direction === "outbound" ? this.t("product.editOutboundTrain", "Modificar tren de ida") : this.t("product.editReturnTrain", "Modificar tren de retorno");
      const endpoints = this.getTrainEndpointsV70?.(train, direction) || { from: direction === "return" ? "Machu Picchu" : "Ollantaytambo", to: direction === "return" ? "Ollantaytambo" : "Machu Picchu" };
      return `
        <article class="train-upgrade-selected-summary train-upgrade-selected-summary--v70 train-upgrade-selected-summary--v73">
          <span class="train-upgrade-selected-summary__badge">Tren seleccionado</span>
          <div class="train-upgrade-selected-summary__content">
            ${logo ? `<img src="${esc(logo)}" alt="${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))}" loading="lazy" />` : ""}
            <div>
              <strong>${esc(title)}</strong>
              <b>${esc(`${train.companyName || train.company || ""} ${train.label || ""}`.trim())}</b>
              <span>${esc(`${endpoints.from} ${train.departureTime || ""} → ${endpoints.to} ${train.arrivalTime || ""}`)}</span>
              <em>${esc(diffText)}</em>
            </div>
            <button type="button" data-modify-train-upgrade data-train-direction="${esc(direction)}">${esc(modifyText)}</button>
          </div>
        </article>
      `;
    };
    proto.renderSelectedTrainSummaryV69 = proto.renderSelectedTrainSummaryV70;

    const oldRenderTrainLists = proto.renderTrainUpgradeListsV70 || proto.renderTrainUpgradeLists;
    if (typeof oldRenderTrainLists === "function") {
      proto.renderTrainUpgradeListsV70 = function () {
        const result = oldRenderTrainLists.apply(this, arguments);
        const finalSection = document.getElementById("trainUpgradeFinalSummarySection");
        if (finalSection) finalSection.innerHTML = "";
        const footer = document.getElementById("trainUpgradeFooterSummary");
        const outboundTrain = this.findTrainById?.(this.trainUpgradeDraftOutboundId, this.availableOutboundTrains) || this.getSelectedOutboundTrain?.();
        const returnTrain = this.findTrainById?.(this.trainUpgradeDraftReturnId, this.availableReturnTrains) || this.getSelectedReturnTrain?.();
        const outboundDiff = this.getTrainPositiveDifferencePerPerson?.(outboundTrain, "outbound") || 0;
        const returnDiff = this.getTrainPositiveDifferencePerPerson?.(returnTrain, "return") || 0;
        const perPerson = outboundDiff + returnDiff;
        const totalPassengers = this.getTotalPassengers?.() || 1;
        const total = perPerson * totalPassengers;
        if (footer) {
          const note = this.trainUpgradeReturnConfirmed
            ? this.t("product.totalChargeForPassengers", "Cargo total para {n} {word}. Cargo por persona: {currency} {perPerson}.", { n: totalPassengers, word: totalPassengers === 1 ? this.t("product.passengerSingular", "pasajero") : this.t("product.passengerPlural", "pasajeros"), currency: currency(), perPerson: formatMoney(perPerson) })
            : this.t("product.confirmBothToApply", "Confirma ida y retorno para aplicar el cambio.");
          footer.innerHTML = `<strong>${this.t("product.additionalUpgradeCharge", "Cargo adicional por upgrade")}: ${esc(currency())} ${esc(formatMoney(total))}</strong><small>${esc(note)}</small>`;
        }
        const apply = document.querySelector("[data-apply-train-upgrade]");
        if (apply) apply.disabled = !(this.trainUpgradeOutboundConfirmed && this.trainUpgradeReturnConfirmed);
        return result;
      };
      proto.renderTrainUpgradeLists = proto.renderTrainUpgradeListsV70;
      proto.renderTrainUpgradeListsV69 = proto.renderTrainUpgradeListsV70;
    }

    page.__mctV73Applied = true;
    try {
      ensurePassengerActionButtons();
      page.populatePhoneCodeSelects?.(document);
    } catch (error) {
      console.warn("MCT V73 post-apply warning:", error);
    }
    return true;
  }

  if (!patchV73()) {
    document.addEventListener("DOMContentLoaded", patchV73);
    setTimeout(patchV73, 250);
    setTimeout(patchV73, 900);
    setTimeout(patchV73, 1600);
  }
})();

/* =========================================================
   PATCH MCT V76 - Review móvil y botones / sin zoom iOS
   ========================================================= */
(function () {
  function patchV76() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV76Applied) return true;

    const proto = Object.getPrototypeOf(page) || page;
    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const formatMoney = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const currency = () => page.product?.currency || "USD";

    function normalizeDocumentType(value) {
      const raw = String(value || "").trim();
      const lower = raw.toLowerCase();
      if (!raw) return "";
      if (["dni", "d.n.i", "documento nacional de identidad"].includes(lower)) return "DNI";
      if (["passport", "pasaporte"].includes(lower)) return "Pasaporte";
      if (["ce", "c.e.", "carnet de extranjeria", "carné de extranjería", "carnet de extranjería"].includes(lower)) return "CE";
      if (["id", "identity card"].includes(lower)) return page.t ? page.t("product.docTypeIdCard", "Documento de identidad") : "Documento de identidad";
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }

    function formatTravelDate(value) {
      if (!value) return "-";
      const raw = String(value);
      const date = new Date(`${raw}T12:00:00`);
      if (Number.isNaN(date.getTime())) return raw;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "2-digit", month: "long", year: "numeric" }).replace(/^0/, "");
    }

    function formatTravelers(adults, children) {
      const a = Number(adults || 0);
      const c = Number(children || 0);
      const parts = [];
      if (a > 0) parts.push(page.t ? page.t("product.adultsPlural", "{n} adulto(s)", { n: a }) : `${a} adulto(s)`);
      if (c > 0) parts.push(page.t ? page.t("product.childrenPlural", "{n} niño(s)", { n: c }) : `${c} niño(s)`);
      return parts.join(", ") || "-";
    }

    function trainLine(train, label) {
      if (!train) return "";
      const name = String(train.label || (page.t ? page.t("quote.train.detailTrainFallback", "Tren") : "Tren")).trim();
      const time = String(train.departureTime || "").trim();
      return `<span>${esc(label)}: ${esc(name.toUpperCase())}${time ? ` ${esc(time)}` : ""}</span>`;
    }

    function ensurePassengerActionButtons() {
      const actions = document.querySelector(".passenger-modal__actions");
      if (!actions) return;
      let cancel = actions.querySelector(".passenger-modal__cancel-btn");
      const submit = actions.querySelector('button[type="submit"]');
      if (!cancel) {
        cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "btn passenger-modal__cancel-btn";
        cancel.setAttribute("data-close-passenger-modal", "");
        cancel.textContent = page.t ? page.t("booking.cancel", "Cancelar") : "Cancelar";
        actions.insertBefore(cancel, submit || null);
      }
      cancel.onclick = () => page.closePassengerReservationModal?.();
      if (submit && !submit.textContent.trim()) submit.textContent = page.t ? page.t("booking.continue", "Continuar") : "Continuar";
    }

    proto.renderPaymentReviewStep = function (payload) {
      const review = document.getElementById("passengerCheckoutReview");
      const modal = document.getElementById("passengerReservationModal");
      const form = document.getElementById("passengerReservationForm");
      if (!review) return;

      ensurePassengerActionButtons();

      const serviceTotalValue = Number(payload.serviceTotalValue || 0);
      const payNowValue = Number(payload.payNowValue || 0);
      const payLaterValue = Number(payload.payLaterValue || 0);
      const hasDiscount = serviceTotalValue > 0 && payNowValue > 0 && payNowValue < serviceTotalValue && payLaterValue <= 0.01;
      const discountAmount = Math.max(0, serviceTotalValue - payNowValue);
      const paymentLabel = hasDiscount ? page.t("product.payNowWithDiscount", "Monto a pagar ahora (descuento aplicado)") : page.t("product.payNowLabel", "Monto a pagar ahora");

      const passengerRows = (payload.passengers || []).map((p) => {
        const name = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
        const pending = p.completionStatus === "pending" || p.completeLater || !name;
        const docType = normalizeDocumentType(p.documentType);
        const doc = [docType, p.documentNumber].filter(Boolean).join(" · ");
        return `<li class="passenger-review-passenger ${pending ? "is-pending" : "is-complete"}">
          <span>${esc(page.t("quote.passenger.title", "Pasajero {n}", { n: p.passengerNumber || "" }))}</span>
          <strong>${esc(pending ? page.t("product.pendingData", "Pendiente de datos") : name)}</strong>
          ${doc ? `<small>${esc(doc)}</small>` : `<small>${pending ? esc(page.t("product.canCompleteLater", "Se podrá completar después")) : esc(page.t("product.dataRegistered", "Datos registrados"))}</small>`}
        </li>`;
      }).join("");

      const outboundTrain = this.getSelectedOutboundTrain?.() || this.findTrainById?.(this.selectedOutboundTrainId, this.availableOutboundTrains);
      const returnTrain = this.getSelectedReturnTrain?.() || this.findTrainById?.(this.selectedReturnTrainId, this.availableReturnTrains);
      const trainHtml = `<div class="passenger-review-train-lines">${trainLine(outboundTrain, page.t("product.outboundShort", "Ida"))}${trainLine(returnTrain, page.t("product.returnShort", "Retorno")) || `<span>${esc(page.t("product.returnIncludedBySelection", "Retorno: incluido según selección"))}</span>`}</div>`;

      const rows = [
        { label: page.t("product.experienceLabel", "Experiencia"), value: payload.productTitle },
        { label: page.t("product.dateLabel", "Fecha"), value: formatTravelDate(payload.date) },
        { label: page.t("product.travelersLabel", "Viajeros"), value: formatTravelers(payload.adults, payload.children) },
        { label: page.t("quote.summary.trains", "Trenes"), html: trainHtml },
        { label: page.t("quote.print.extrasLabel", "Extras"), value: payload.summary?.extras?.length ? payload.summary.extras.join(", ") : page.t("product.noExtras", "Sin extras") }
      ];
      if (payLaterValue > 0.01) {
        rows.push({ label: page.t("product.serviceTotalLabel", "Total del servicio"), value: payload.serviceTotal });
        rows.push({ label: page.t("quote.summary.balancePending", "Saldo pendiente"), value: payload.payLater });
      }

      review.hidden = false;
      review.innerHTML = `
        <div class="passenger-review-card passenger-review-card--final passenger-review-card--v73 passenger-review-card--v76">
          <div class="passenger-review-total">
            <span>${esc(paymentLabel)}</span>
            <strong>${esc(payload.payNow || "")}</strong>
            ${hasDiscount ? `<small><span>${esc(page.t("product.beforeLabel", "Antes"))}:</span> <del>${esc(payload.serviceTotal || "")}</del> <b>${esc(page.t("product.youSaveAmount", "Ahorras {amount}", { amount: `${payload.currency || currency()} ${formatMoney(discountAmount)}` }))}</b></small>` : ""}
          </div>
          <div class="passenger-review-grid passenger-review-grid--final">
            ${rows.map((row) => `<div><span>${esc(row.label)}</span><strong>${row.html || esc(row.value || "-")}</strong></div>`).join("")}
          </div>
          <div class="passenger-review-passengers">
            <strong>${esc(page.t("product.passengerDataLabel", "Datos de pasajeros"))}</strong>
            <ul class="passenger-review-list">${passengerRows}</ul>
          </div>
          <button class="passenger-review-edit-btn" type="button" data-edit-passenger-details>${esc(page.t("product.editPassengerData", "Editar datos de pasajeros"))}</button>
        </div>
      `;

      if (modal) modal.classList.add("passenger-modal--review");
      const title = document.getElementById("passengerModalTitle");
      if (title) title.textContent = page.t("booking.reservationSummaryTitle", "Resumen de tu reserva");
      const warning = document.querySelector(".passenger-modal__warning");
      if (warning) warning.hidden = true;
      const message = document.querySelector("[data-passenger-message]");
      if (message) {
        message.textContent = "";
        message.classList.remove("is-error");
      }
      const submit = form?.querySelector('button[type="submit"]');
      if (submit) submit.textContent = page.t("booking.pay", "Pagar");
      review.querySelector("[data-edit-passenger-details]")?.addEventListener("click", () => {
        if (form) delete form.dataset.paymentReviewConfirmed;
        if (modal) modal.classList.remove("passenger-modal--review");
        review.hidden = true;
        review.innerHTML = "";
        if (title) title.textContent = page.t("product.passengerDetailsTitle", "Datos de los pasajeros");
        if (warning) warning.hidden = false;
        if (submit) submit.textContent = page.t("booking.continue", "Continuar");
        ensurePassengerActionButtons();
      });
      review.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const oldOpenPassenger = proto.openPassengerReservationModal;
    if (typeof oldOpenPassenger === "function") {
      proto.openPassengerReservationModal = function () {
        const result = oldOpenPassenger.apply(this, arguments);
        window.setTimeout(() => {
          ensurePassengerActionButtons();
          const submit = document.querySelector('#passengerReservationForm button[type="submit"]');
          if (submit && submit.textContent.trim() !== page.t("booking.pay", "Pagar")) submit.textContent = page.t("booking.continue", "Continuar");
        }, 0);
        return result;
      };
    }

    page.__mctV76Applied = true;
    try { ensurePassengerActionButtons(); } catch (error) { console.warn("MCT V76 post-apply warning:", error); }
    return true;
  }

  if (!patchV76()) {
    document.addEventListener("DOMContentLoaded", patchV76);
    setTimeout(patchV76, 250);
    setTimeout(patchV76, 900);
    setTimeout(patchV76, 1600);
  }
})();


/* =========================================================
   PATCH MCT V78 - Impresión y precio Machu Picchu clásico
   ========================================================= */
(function () {
  function patchV78() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV78Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;
    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const isMachuClassic = function () {
      const slug = String(this?.product?.slug || this?.slug || "").trim();
      return slug === "machu-picchu-full-day-clasico";
    };
    const money = function (value) {
      return typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    };
    const addMinutes = function (time, delta) {
      const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
      if (!match) return "";
      let total = (Number(match[1]) * 60) + Number(match[2]) + Number(delta || 0);
      total = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };
    const formatDateLong = function (value) {
      if (!value) return "Fecha por definir";
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "2-digit", month: "long", year: "numeric" }).replace(/^0/, "");
    };
    const trainStationName = function (train, key, fallback) {
      const raw = train?.raw || {};
      return raw[key] || train?.[key] || fallback;
    };
    const selectedOutbound = function (ctx) {
      return ctx.getSelectedOutboundTrain?.() || ctx.findTrainById?.(ctx.selectedOutboundTrainId, ctx.availableOutboundTrains) || null;
    };
    const selectedReturn = function (ctx) {
      return ctx.getSelectedReturnTrain?.() || ctx.findTrainById?.(ctx.selectedReturnTrainId, ctx.availableReturnTrains) || null;
    };

    proto.calculateMachuClassicBasePriceV78 = function () {
      const pax = Math.max(1, Number(this.getTotalPassengers?.() || 1));
      const rules = this.product?.financialRules || {};
      const guideCost = Number(this.product?.internalPricing?.guideCostUSD || 50);
      const fixedNetBasePerPerson = 320;
      const targetNetTotal = (fixedNetBasePerPerson * pax) + guideCost;
      const paypalPercent = Number(rules.paypalFeePercent ?? 5.4) / 100;
      const paypalFixed = Number(rules.paypalFixedUSD ?? 0.3);
      const bankPercent = Number(rules.bankWithdrawPercent ?? 3) / 100;
      const discountPercent = Number(rules.maxPublicDiscountBufferPercent ?? this.product?.paymentOptions?.fullPaymentDiscountPercent ?? 10) / 100;
      const chargedNeeded = ((targetNetTotal / Math.max(0.0001, 1 - bankPercent)) + paypalFixed) / Math.max(0.0001, 1 - paypalPercent);
      const publicBaseTotal = chargedNeeded / Math.max(0.0001, 1 - discountPercent);
      const roundedTotal = Math.ceil(publicBaseTotal * 100) / 100;
      const publicPerPerson = roundedTotal / pax;
      const targetNetPerPerson = targetNetTotal / pax;
      return { pax, guideCost, targetNetTotal, targetNetPerPerson, publicBaseTotal: roundedTotal, publicPerPerson, paypalPercent, paypalFixed, bankPercent, discountPercent };
    };

    const originalRenderProduct = proto.renderProduct;
    if (typeof originalRenderProduct === "function") {
      proto.renderProduct = function (product) {
        const result = originalRenderProduct.apply(this, arguments);
        if (String(product?.slug || this.slug || "") === "machu-picchu-full-day-clasico") {
          const lang = document.getElementById("detailLanguages");
          if (lang) lang.textContent = this.t("product.guideProfessionalEsEn", "Guía profesional: español, inglés (otros idiomas, consultar)");
          const price = this.calculateMachuClassicBasePriceV78?.();
          if (price) this.setText?.("productBasePrice", `${this.product?.currency || "USD"} ${money(price.publicPerPerson)}`);
        }
        this.ensureProductPrintButtonV78?.();
        return result;
      };
    }

    proto.updateMachuClassicPricingV78 = function () {
      const currency = this.product?.currency || "USD";
      const base = this.calculateMachuClassicBasePriceV78();
      const pax = base.pax;
      const basePerPerson = base.publicPerPerson;
      const adultsTotal = Number(this.adults || 0) * basePerPerson;
      const childrenTotal = Number(this.children || 0) * basePerPerson;
      const extrasTotal = this.calculateExtrasTotal?.() || 0;
      const trainAdjustmentTotal = this.calculateSelectedTrainAdjustmentTotal?.() || 0;
      const accommodationTotal = this.calculateAccommodationTotal?.() || 0;
      const serviceTotal = base.publicBaseTotal + extrasTotal + trainAdjustmentTotal + accommodationTotal;
      const fullDiscountPercent = 10;
      if (this.product?.paymentOptions) this.product.paymentOptions.fullPaymentDiscountPercent = 10;
      const partialPerPerson = Number(this.product?.paymentOptions?.partialPaymentPerPerson || 149);
      const discountInfo = this.getDiscountInfo?.(serviceTotal, fullDiscountPercent) || { discount: serviceTotal * 0.10, percent: 10 };
      const discount = Number(discountInfo.discount || 0);
      const discountedTotal = Math.max(serviceTotal - discount, 0);
      let payNow = discountedTotal;
      let payLater = 0;
      let infoText = this.t("product.fullPaymentDiscountNoteB", "Pagando el total ahora obtienes un {percent}% de descuento.", { percent: fullDiscountPercent });
      if (this.paymentMode !== "full") {
        payNow = Math.min(pax * partialPerPerson, discountedTotal);
        payLater = Math.max(discountedTotal - payNow, 0);
        infoText = this.product?.paymentOptions?.partialPaymentLabel || this.t("product.depositReservationNoteShort", "Reserva con anticipo y completa el saldo antes del viaje.");
      }
      this.dynamicMachuClassicQuoteV78 = {
        currency, pax, basePerPerson, publicBaseTotal: base.publicBaseTotal,
        targetNetPerPerson: base.targetNetPerPerson,
        adultsTotal, childrenTotal, extrasTotal, trainAdjustmentTotal, accommodationTotal,
        serviceTotal, discount, payNow, payLater
      };
      this.setText?.("productBasePrice", `${currency} ${money(basePerPerson)}`);
      this.setText?.("adultsTotal", `${currency} ${money(adultsTotal)}`);
      this.setText?.("childrenTotal", `${currency} ${money(childrenTotal)}`);
      this.setText?.("extrasTotal", `${currency} ${money(extrasTotal)}`);
      this.setText?.("serviceTotal", `${currency} ${money(serviceTotal)}`);
      this.setText?.("payNowTotal", `${currency} ${money(payNow)}`);
      this.setText?.("discountTotal", `- ${currency} ${money(discount)}`);
      this.setText?.("payLaterTotal", `${currency} ${money(payLater)}`);
      this.setText?.("accommodationTotal", `${currency} ${money(accommodationTotal)}`);
      const adultsRow = document.getElementById("adultsTotal")?.closest(".booking-summary__line");
      if (adultsRow) {
        const label = adultsRow.querySelector("span");
        if (label) label.textContent = `Adultos x${String(this.adults || 0).padStart(2, "0")}`;
        adultsRow.hidden = false;
      }
      const childrenRow = document.getElementById("childrenTotal")?.closest(".booking-summary__line");
      if (childrenRow) {
        const label = childrenRow.querySelector("span");
        if (label) label.textContent = `Niños x${String(this.children || 0).padStart(2, "0")}`;
        childrenRow.hidden = !(Number(this.children || 0) > 0);
      }
      const extrasRow = document.getElementById("extrasTotal")?.closest(".booking-summary__line");
      if (extrasRow) extrasRow.hidden = !(extrasTotal > 0);
      const discountRow = document.getElementById("discountRow");
      if (discountRow) discountRow.hidden = !(discount > 0 && this.paymentMode === "full");
      const payLaterRow = document.getElementById("payLaterRow");
      if (payLaterRow) payLaterRow.hidden = this.paymentMode === "full" || payLater <= 0;
      const paymentInfo = document.getElementById("paymentInfo");
      if (paymentInfo) paymentInfo.textContent = infoText;
      this.updateTrainAdjustmentSummaryRow?.(trainAdjustmentTotal, currency);
      const payNowLabel = document.getElementById("payNowLabel");
      if (payNowLabel) payNowLabel.textContent = "Pagar ahora";
      return true;
    };

    const originalUpdatePricing = proto.updatePricing;
    proto.updatePricing = function () {
      if (isMachuClassic.call(this)) return this.updateMachuClassicPricingV78();
      return originalUpdatePricing?.apply(this, arguments);
    };

    const originalGetBookingSummary = proto.getBookingSummary;
    proto.getBookingSummary = function () {
      if (!isMachuClassic.call(this)) return originalGetBookingSummary?.apply(this, arguments);
      const currency = this.product?.currency || "USD";
      const quote = this.dynamicMachuClassicQuoteV78 || (this.updateMachuClassicPricingV78?.(), this.dynamicMachuClassicQuoteV78) || {};
      const selectedExtras = (this.product?.extras || []).filter((extra) => this.selectedExtras?.has(extra.code)).map((extra) => extra.label);
      const accommodation = this.getAccommodationSummary?.(this.product).map((item) => {
        const hotelCode = this.selectedHotelsByDestination?.[item.destination];
        if (!hotelCode || hotelCode === "no-hotel") return null;
        const selection = this.getSelectedAccommodationForDestination?.(item.destination);
        if (!selection?.hotel || !selection?.combination) return null;
        return `${item.label || this.getDestinationLabel?.(item.destination)} - ${selection.hotel.hotelName} - ${selection.combination.label}`;
      }).filter(Boolean) || [];
      return {
        title: this.product.title,
        date: this.date || this.t?.("product.toConfirm", "Por confirmar") || "Por confirmar",
        adults: this.adults,
        children: this.children,
        departureTime: this.getSelectedDepartureTimeLabel?.(),
        trainSelection: this.getSelectedTrainSummaryLabel?.(),
        serviceMode: this.serviceMode === "private" ? "Tour privado" : "Tour en grupo",
        accommodation,
        extras: selectedExtras,
        serviceTotal: `${currency} ${money(quote.serviceTotal || 0)}`,
        payNow: `${currency} ${money(quote.payNow || 0)}`,
        payLater: `${currency} ${money(quote.payLater || 0)}`,
        rawServiceTotal: Number(quote.serviceTotal || 0),
        rawPayNow: Number(quote.payNow || 0),
        rawPayLater: Number(quote.payLater || 0),
        paymentMode: this.paymentMode === "full" ? "Pago completo" : "Reserva con anticipo",
        couponCode: this.appliedCoupon?.couponCode || "",
        couponDiscountPercent: this.getAppliedCouponPercent?.() || 0
      };
    };

    proto.ensureProductPrintButtonV78 = function () {
      const button = document.getElementById("printProductItineraryBtn");
      if (!button || button.dataset.v78Ready) return;
      button.dataset.v78Ready = "1";
      button.addEventListener("click", () => this.printProductItineraryV78?.());
    };

    proto.getProductPrintItineraryItemsV78 = function () {
      const items = Array.isArray(this.product?.itinerary) ? JSON.parse(JSON.stringify(this.product.itinerary)) : [];
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const outboundDeparture = out?.departureTime || "06:40";
      const returnDeparture = ret?.departureTime || "20:20";
      const returnArrival = ret?.arrivalTime || "21:59";
      const pickupTime = addMinutes(outboundDeparture, -160) || "04:00";
      const cuscoArrival = addMinutes(returnArrival, 120) || "22:30";
      return items.map((item) => {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        if (text.includes("recojo")) return { ...item, time: `${pickupTime} aprox.` };
        if (text.includes("viaje en tren") || text.includes("tren a machu")) return { ...item, time: `${outboundDeparture} aprox.`, title: item.title || this.t("product.itin.trainToMachuTitle", "Viaje en tren a Machu Picchu Pueblo") };
        if (text.includes("tren de retorno")) return { ...item, time: `${returnDeparture} aprox.` };
        if (text.includes("llegada a estación") || text.includes("ollantaytambo y traslado")) return { ...item, time: `${returnArrival} aprox.` };
        if (text.includes("llegada a cusco")) return { ...item, time: `${cuscoArrival} aprox.` };
        return item;
      });
    };

    proto.renderTrainPrintCardV78 = function (train, direction) {
      if (!train) return `<div class="print-train-card"><span>${direction === "return" ? this.t("booking.train.returnShort", "Retorno") : this.t("booking.train.outboundShort", "Ida")}</span><b>${this.t("quote.print.toBeConfirmed", "Por confirmar")}</b></div>`;
      const from = direction === "return" ? trainStationName(train, "departureStation", "Machu Picchu") : trainStationName(train, "departureStation", "Ollantaytambo");
      const to = direction === "return" ? trainStationName(train, "arrivalStation", "Ollantaytambo") : trainStationName(train, "arrivalStation", "Machu Picchu");
      return `<div class="print-train-card">
        <span>${direction === "return" ? this.t("booking.train.return", "Tren de retorno") : this.t("booking.train.outbound", "Tren de ida")}</span>
        <b>${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))} · ${esc(train.label || "")}</b>
        <small>${esc(from)} ${esc(train.departureTime || "")} → ${esc(to)} ${esc(train.arrivalTime || "")}</small>
      </div>`;
    };

    proto.printProductItineraryV78 = function () {
      this.updatePricing?.();
      const target = document.getElementById("productPrintArea");
      if (!target) return window.print();
      const currency = this.product?.currency || "USD";
      const summary = this.getBookingSummary?.() || {};
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const itinerary = this.getProductPrintItineraryItemsV78?.() || this.product?.itinerary || [];
      const dateLabel = formatDateLong(this.date);
      const generated = new Date().toLocaleDateString(mctLocaleDateTag(), { day: "2-digit", month: "long", year: "numeric" }).replace(/^0/, "");
      const pax = `${this.t("product.adultsPlural", "{n} adulto(s)", { n: this.adults || 0 })}${Number(this.children || 0) > 0 ? `, ${this.t("product.childrenPlural", "{n} niño(s)", { n: this.children })}` : ""}`;
      const includes = (this.product?.includes || []).slice(0, 8);
      target.innerHTML = `<div class="print-sheet">
        <header class="print-header">
          <div>
            <img class="print-logo" src="./assets/img/reserva/logo-color.png" alt="My Cusco Trip" />
            <p class="print-eyebrow">${this.t("product.print.itineraryEyebrow", "ITINERARIO DE VIAJE")}</p>
            <h1>${esc(this.product?.title || this.t("product.print.experienceFallback", "Experiencia My Cusco Trip"))}</h1>
          </div>
          <div class="print-header__right">
            <p><strong>${this.t("product.print.issueDateLabel", "Fecha de emisión:")}</strong> ${esc(generated)}</p>
            <p><strong>${this.t("product.print.travelDateLabel", "Fecha de viaje:")}</strong> ${esc(dateLabel)}</p>
            <p><strong>Pasajeros:</strong> ${esc(pax)}</p>
            <p><strong>Modalidad:</strong> ${esc(summary.paymentMode || "Reserva online")}</p>
          </div>
        </header>
        <div class="print-grid">
          <div class="print-info-box">
            <p><strong>${this.t("product.print.destinationLabel", "Destino:")}</strong> ${esc(this.product?.location || "Cusco / Machu Picchu")}</p>
            <p><strong>${this.t("product.print.durationLabel", "Duración:")}</strong> ${esc(this.product?.duration?.label || "Full Day")}</p>
            <p><strong>${this.t("product.print.guideLabel", "Guía:")}</strong> ${this.t("product.languagesEsEnConsult", "español, inglés (otros idiomas, consultar)")}</p>
          </div>
          <div class="print-info-box">
            <p><strong>Total del servicio:</strong> ${esc(summary.serviceTotal || `${currency} 0.00`)}</p>
            <p><strong>Monto a pagar:</strong> ${esc(summary.payNow || `${currency} 0.00`)}</p>
            <p><strong>Pago:</strong> ${esc(summary.paymentMode || "Pago completo")}</p>
          </div>
        </div>
        <section class="print-section">
          <h2>${this.t("product.print.selectedTrainsHeading", "Trenes seleccionados")}</h2>
          <div class="print-train-grid">${this.renderTrainPrintCardV78(out, "outbound")}${this.renderTrainPrintCardV78(ret, "return")}</div>
        </section>
        <section class="print-section">
          <h2>${this.t("product.print.itineraryHeading", "Itinerario según tu selección")}</h2>
          <div class="print-itinerary-list">
            ${itinerary.map((item, index) => `<article class="print-itinerary-item"><div class="print-itinerary-time">${esc(item.time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</div><div><h3>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</h3><p>${esc(item.description || "")}</p></div></article>`).join("")}
          </div>
        </section>
        <section class="print-section">
          <h2>${this.t("product.print.includesHeading", "Incluye")}</h2>
          <ul class="print-list">${includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>
        <footer class="print-footer">${this.t("product.print.footerNoteShort", "Documento referencial generado desde My Cusco Trip. Los horarios finales se confirman según disponibilidad operativa, trenes, ingreso oficial a Machu Picchu y coordinación del asesor de viaje.")}</footer>
      </div>`;
      window.setTimeout(() => window.print(), 80);
    };

    page.__mctV78Applied = true;
    try {
      page.ensureProductPrintButtonV78?.();
      if (isMachuClassic.call(page)) {
        if (page.product?.paymentOptions) page.product.paymentOptions.fullPaymentDiscountPercent = 10;
        page.updatePricing?.();
        const lang = document.getElementById("detailLanguages");
        if (lang) lang.textContent = this.t("product.guideProfessionalEsEn", "Guía profesional: español, inglés (otros idiomas, consultar)");
      }
    } catch (error) { console.warn("MCT V78 post-apply warning:", error); }
    return true;
  }
  if (!patchV78()) {
    document.addEventListener("DOMContentLoaded", patchV78);
    setTimeout(patchV78, 250);
    setTimeout(patchV78, 900);
    setTimeout(patchV78, 1600);
  }
})();


/* =========================================================
   PATCH MCT V80 - Formato impresión producto + precio por pasajero
   ========================================================= */
(function () {
  function patchV80() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV80Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;

    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const money = function (value) {
      return typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    };
    const isMachuClassic = function () {
      const slug = String(this?.product?.slug || this?.slug || "").trim();
      return slug === "machu-picchu-full-day-clasico";
    };
    const addMinutes = function (time, delta) {
      const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
      if (!match) return "";
      let total = Number(match[1]) * 60 + Number(match[2]) + Number(delta || 0);
      total = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };
    const formatDateLong = function (value) {
      if (!value) return "Fecha por definir";
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
    };
    const trainStationName = function (train, key, fallback) {
      const raw = train?.raw || {};
      const value = raw[key] || train?.[key] || fallback;
      const map = {
        OLLA_MAPI: "Ollantaytambo",
        MAPI_OLLA: "Ollantaytambo",
        CUSCO_MAPI: "Cusco",
        MAPI_CUSCO: "Cusco",
        URU_MAPI: "Urubamba",
        MAPI_URU: "Urubamba",
        HIDRO_MAPI: "Hidroeléctrica",
        MAPI_HIDRO: "Hidroeléctrica",
        MAPI: "Machu Picchu",
        OLLA: "Ollantaytambo"
      };
      return map[String(value || "").trim()] || value;
    };
    const selectedOutbound = function (ctx) {
      return ctx.getSelectedOutboundTrain?.() || ctx.findTrainById?.(ctx.selectedOutboundTrainId, ctx.availableOutboundTrains) || null;
    };
    const selectedReturn = function (ctx) {
      return ctx.getSelectedReturnTrain?.() || ctx.findTrainById?.(ctx.selectedReturnTrainId, ctx.availableReturnTrains) || null;
    };
    const totalPassengers = function (ctx) {
      return Math.max(1, Number(ctx.getTotalPassengers?.() || (Number(ctx.adults || 0) + Number(ctx.children || 0)) || 1));
    };
    const getFinalPassengerPrice = function (ctx, quote) {
      const pax = totalPassengers(ctx);
      const total = Number((quote?.serviceTotal || 0) - (quote?.discount || 0));
      return Math.max(total, 0) / pax;
    };
    const ensureFinalPassengerPriceRow = function () {
      let row = document.getElementById("finalPassengerPriceRow");
      const serviceRow = document.getElementById("serviceTotalRow");
      if (!row && serviceRow?.parentNode) {
        row = document.createElement("div");
        row.id = "finalPassengerPriceRow";
        row.className = "booking-summary__line booking-summary__line--per-passenger";
        row.innerHTML = `<span>Precio final por pasajero</span><strong id="finalPassengerPrice">USD 0.00</strong>`;
        serviceRow.parentNode.insertBefore(row, serviceRow);
      }
      return row;
    };

    const previousUpdateMachuClassicPricing = proto.updateMachuClassicPricingV78;
    if (typeof previousUpdateMachuClassicPricing === "function") {
      proto.updateMachuClassicPricingV78 = function () {
        const result = previousUpdateMachuClassicPricing.apply(this, arguments);
        if (!isMachuClassic.call(this)) return result;
        const currency = this.product?.currency || "USD";
        const quote = this.dynamicMachuClassicQuoteV78 || {};
        const finalPassenger = getFinalPassengerPrice(this, quote);
        const row = ensureFinalPassengerPriceRow();
        if (row) row.hidden = false;
        this.setText?.("finalPassengerPrice", `${currency} ${money(finalPassenger)}`);
        const serviceLabel = document.querySelector("#serviceTotalRow > span");
        if (serviceLabel) serviceLabel.textContent = this.t("product.totalServices", "Total de servicios");
        const payNowLabel = document.getElementById("payNowLabel");
        if (payNowLabel) payNowLabel.textContent = this.t("product.payNowLabel", "Monto a pagar ahora");
        return result;
      };
    }

    const previousGetBookingSummary = proto.getBookingSummary;
    proto.getBookingSummary = function () {
      const summary = previousGetBookingSummary?.apply(this, arguments) || {};
      if (!isMachuClassic.call(this)) return summary;
      const currency = this.product?.currency || "USD";
      const quote = this.dynamicMachuClassicQuoteV78 || (this.updateMachuClassicPricingV78?.(), this.dynamicMachuClassicQuoteV78) || {};
      const finalPassenger = getFinalPassengerPrice(this, quote);
      return {
        ...summary,
        finalPassengerPrice: `${currency} ${money(finalPassenger)}`,
        rawFinalPassengerPrice: finalPassenger,
        paymentModeShort: this.paymentMode === "full" ? "Completo" : "Anticipo"
      };
    };

    proto.getProductPrintItineraryItemsV80 = function () {
      const items = Array.isArray(this.product?.itinerary) ? JSON.parse(JSON.stringify(this.product.itinerary)) : [];
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const outboundDeparture = out?.departureTime || "06:40";
      const returnDeparture = ret?.departureTime || "20:20";
      const returnArrival = ret?.arrivalTime || "21:59";
      const pickupTime = addMinutes(outboundDeparture, -160) || "04:00";
      const cuscoArrival = addMinutes(returnArrival, 120) || "22:30";
      return items.map((item) => {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        if (text.includes("recojo")) return { ...item, time: `${pickupTime} aprox.` };
        if (text.includes("viaje en tren") || text.includes("tren a machu")) return { ...item, time: `${outboundDeparture} aprox.`, title: item.title || this.t("product.itin.trainToMachuTitle", "Viaje en tren a Machu Picchu Pueblo") };
        if (text.includes("tren de retorno")) return { ...item, time: `${returnDeparture} aprox.` };
        if (text.includes("llegada a estación") || text.includes("ollantaytambo y traslado")) return { ...item, time: `${returnArrival} aprox.` };
        if (text.includes("llegada a cusco")) return { ...item, time: `${cuscoArrival} aprox.` };
        return item;
      });
    };

    proto.getProductPrintImageV80 = function () {
      const images = this.product?.images || {};
      return images.cover || this.product?.fallbackImage || (Array.isArray(images.gallery) ? images.gallery[0] : "") || "./assets/img/placeholder/experience.jpg";
    };

    proto.renderTrainPrintCardV80 = function (train, direction) {
      if (!train) return `<div class="print-train-card"><span>${direction === "return" ? this.t("booking.train.returnShort", "Retorno") : this.t("booking.train.outboundShort", "Ida")}</span><b>${this.t("quote.print.toBeConfirmed", "Por confirmar")}</b></div>`;
      const from = direction === "return" ? trainStationName(train, "departureStation", "Machu Picchu") : trainStationName(train, "departureStation", "Ollantaytambo");
      const to = direction === "return" ? trainStationName(train, "arrivalStation", "Ollantaytambo") : trainStationName(train, "arrivalStation", "Machu Picchu");
      return `<div class="print-train-card">
        <span>${direction === "return" ? this.t("booking.train.return", "Tren de retorno") : this.t("booking.train.outbound", "Tren de ida")}</span>
        <b>${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))} · ${esc(train.label || "")}</b>
        <small>${esc(from)} ${esc(train.departureTime || "")} → ${esc(to)} ${esc(train.arrivalTime || "")}</small>
      </div>`;
    };

    proto.getPrintIncludesV80 = function () {
      const selectedLunch = (this.product?.extras || []).filter((extra) => this.selectedExtras?.has(extra.code) && String(extra.exclusiveGroup || "").toLowerCase() === "lunch");
      const includes = Array.isArray(this.product?.includes) ? [...this.product.includes] : [];
      if (selectedLunch.length) {
        const lunchLabel = selectedLunch.map((extra) => extra.label).join(" / ");
        const optionIndex = includes.findIndex((item) => String(item).toLowerCase().includes(String(this.t("product.lunchOption", "opción de almuerzo")).toLowerCase()));
        const lunchText = `Almuerzo incluido: ${lunchLabel}.`;
        if (optionIndex >= 0) includes[optionIndex] = lunchText;
        else includes.push(lunchText);
      }
      return includes.slice(0, 10);
    };

    proto.printProductItineraryV78 = function () {
      this.updatePricing?.();
      const target = document.getElementById("productPrintArea");
      if (!target) return window.print();
      const currency = this.product?.currency || "USD";
      const summary = this.getBookingSummary?.() || {};
      const quote = this.dynamicMachuClassicQuoteV78 || {};
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const itinerary = this.getProductPrintItineraryItemsV80?.() || this.product?.itinerary || [];
      const dateLabel = formatDateLong(this.date);
      const generated = new Date().toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
      const pax = `${this.t("product.adultsPlural", "{n} adulto(s)", { n: this.adults || 0 })}${Number(this.children || 0) > 0 ? `, ${this.t("product.childrenPlural", "{n} niño(s)", { n: this.children })}` : ""}`;
      const includes = this.getPrintIncludesV80?.() || (this.product?.includes || []).slice(0, 10);
      const cover = this.getProductPrintImageV80?.() || "./assets/img/placeholder/experience.jpg";
      const destination = isMachuClassic.call(this) ? this.t("product.machuPicchuArchSite", "Centro arqueológico de Machu Picchu") : (this.product?.location || "Cusco / Machu Picchu");
      const description = this.product?.description || this.product?.shortDescription || "Experiencia organizada por My Cusco Trip con asistencia personalizada antes y durante el viaje.";
      const discount = Number(summary.rawServiceTotal || quote.serviceTotal || 0) - Number(summary.rawPayNow || quote.payNow || 0);
      const showDiscount = this.paymentMode === "full" && Number(quote.discount || discount || 0) > 0;
      const discountText = `- ${currency} ${money(Number(quote.discount || Math.max(discount, 0)))}`;
      const finalPassenger = summary.finalPassengerPrice || `${currency} ${money(getFinalPassengerPrice(this, quote))}`;
      const modeShort = summary.paymentModeShort || (this.paymentMode === "full" ? "Completo" : "Anticipo");

      target.innerHTML = `<div class="print-sheet">
        <header class="print-header print-header--v80">
          <div>
            <img class="print-logo" src="./assets/img/reserva/logo-color.png" alt="My Cusco Trip" />
            <p class="print-eyebrow">${this.t("product.print.itineraryEyebrow", "ITINERARIO DE VIAJE")}</p>
            <h1>${esc(this.product?.title || this.t("product.print.experienceFallback", "Experiencia My Cusco Trip"))}</h1>
            <p class="print-description">${esc(description)}</p>
          </div>
          <div class="print-header__right">
            <p><strong>${this.t("product.print.quoteDateLabel", "Fecha de cotización:")}</strong> ${esc(generated)}</p>
            <p><strong>${this.t("product.print.travelDateLabel", "Fecha de viaje:")}</strong> ${esc(dateLabel)}</p>
            <p><strong>${this.t("product.print.passengerCountLabel", "Cantidad de pasajeros:")}</strong> ${esc(pax)}</p>
            <p><strong>${this.t("product.print.paymentModeLabel", "Modo de pago:")}</strong> ${esc(modeShort)}</p>
          </div>
        </header>
        <figure class="print-banner"><img src="${esc(cover)}" alt="${esc(this.product?.title || "Tour")}" /></figure>
        <div class="print-grid print-grid--trip">
          <div class="print-info-box">
            <p><strong>${this.t("product.print.destinationLabel", "Destino:")}</strong> ${esc(destination)}</p>
            <p><strong>${this.t("product.print.durationLabel", "Duración:")}</strong> ${esc(this.product?.duration?.label || "Full Day")}</p>
            <p><strong>${this.t("product.print.guideLabel", "Guía:")}</strong> ${this.t("product.languagesEsEnConsult", "español, inglés (otros idiomas, consultar)")}</p>
          </div>
          <div class="print-info-box print-info-box--payment">
            <p><strong>${this.t("product.print.finalPricePerPassengerLabel", "Precio final por pasajero:")}</strong> ${esc(finalPassenger)}</p>
            <p><strong>${this.t("product.totalServices", "Total de servicios")}:</strong> ${esc(summary.serviceTotal || `${currency} 0.00`)}</p>
            ${showDiscount ? `<p><strong>${this.t("product.print.discountAppliedLabel", "Descuento aplicado:")}</strong> ${esc(discountText)}</p>` : ""}
            <p class="print-pay-now"><strong>${this.t("product.print.totalToPayLabel", "Monto total a pagar:")}</strong> ${esc(summary.payNow || `${currency} 0.00`)}</p>
          </div>
        </div>
        <section class="print-section">
          <h2>${this.t("product.print.selectedTrainsHeading", "Trenes seleccionados")}</h2>
          <div class="print-train-grid">${this.renderTrainPrintCardV80(out, "outbound")}${this.renderTrainPrintCardV80(ret, "return")}</div>
        </section>
        <section class="print-section">
          <h2>${this.t("product.print.itineraryHeading", "Itinerario según tu selección")}</h2>
          <div class="print-itinerary-list">
            ${itinerary.map((item, index) => `<article class="print-itinerary-item"><div class="print-itinerary-time">${esc(item.time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</div><div><h3>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</h3><p>${esc(item.description || "")}</p></div></article>`).join("")}
          </div>
        </section>
        <section class="print-section">
          <h2>${this.t("product.print.includesHeading", "Incluye")}</h2>
          <ul class="print-list">${includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>
        <footer class="print-footer">${this.t("product.print.footerNoteShort", "Documento referencial generado desde My Cusco Trip. Los horarios finales se confirman según disponibilidad operativa, trenes, ingreso oficial a Machu Picchu y coordinación del asesor de viaje.")}</footer>
      </div>`;
      window.setTimeout(() => window.print(), 80);
    };

    page.__mctV80Applied = true;
    try {
      if (isMachuClassic.call(page)) {
        const row = ensureFinalPassengerPriceRow();
        if (row) row.hidden = false;
        page.updatePricing?.();
      }
    } catch (error) { console.warn("MCT V80 post-apply warning:", error); }
    return true;
  }
  if (!patchV80()) {
    document.addEventListener("DOMContentLoaded", patchV80);
    setTimeout(patchV80, 250);
    setTimeout(patchV80, 900);
    setTimeout(patchV80, 1600);
  }
})();

/* =========================================================
   V81 - Ajuste formato de impresión: galería 3 imágenes,
   descripción bajo itinerario y mejor paginación A4
   ========================================================= */
(function () {
  function patchV81() {
    const page = window.MyCuscoTripProductPage;
    if (!page || page.__mctV81Applied) return false;
    const proto = Object.getPrototypeOf(page) || page;

    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const money = function (value) {
      return Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };
    const selectedOutbound = function (ctx) {
      return ctx.getSelectedOutboundTrain?.() || ctx.findTrainById?.(ctx.selectedOutboundTrainId, ctx.availableOutboundTrains) || null;
    };
    const selectedReturn = function (ctx) {
      return ctx.getSelectedReturnTrain?.() || ctx.findTrainById?.(ctx.selectedReturnTrainId, ctx.availableReturnTrains) || null;
    };
    const formatDateLong = function (value) {
      if (!value) return this.t("quote.print.toBeConfirmed", "Por confirmar");
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
    };
    const isMachuClassic = function (ctx) {
      return String(ctx?.product?.slug || ctx?.slug || "") === "machu-picchu-full-day-clasico";
    };

    proto.getProductPrintImagesV81 = function () {
      const images = this.product?.images || {};
      const candidates = [];
      if (images.cover) candidates.push(images.cover);
      if (this.product?.image) candidates.push(this.product.image);
      if (Array.isArray(images.gallery)) candidates.push(...images.gallery);
      if (this.product?.fallbackImage) candidates.push(this.product.fallbackImage);
      candidates.push("./assets/img/placeholder/experience.jpg");
      const unique = [];
      candidates.forEach((src) => {
        const clean = String(src || "").trim();
        if (clean && !unique.includes(clean)) unique.push(clean);
      });
      while (unique.length < 3) unique.push(unique[unique.length - 1] || "./assets/img/placeholder/experience.jpg");
      return unique.slice(0, 3);
    };

    proto.renderProductPrintGalleryV81 = function () {
      const title = this.product?.title || "Tour";
      return `<div class="print-gallery print-gallery--v81">
        ${this.getProductPrintImagesV81().map((src, index) => `<figure><img src="${esc(src)}" alt="${esc(title)} imagen ${index + 1}" /></figure>`).join("")}
      </div>`;
    };

    proto.printProductItineraryV78 = function () {
      this.updatePricing?.();
      const target = document.getElementById("productPrintArea");
      if (!target) return window.print();
      const currency = this.product?.currency || "USD";
      const summary = this.getBookingSummary?.() || {};
      const quote = this.dynamicMachuClassicQuoteV78 || {};
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const itinerary = this.getProductPrintItineraryItemsV80?.() || this.product?.itinerary || [];
      const dateLabel = formatDateLong(this.date);
      const generated = new Date().toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
      const pax = `${this.t("product.adultsPlural", "{n} adulto(s)", { n: this.adults || 0 })}${Number(this.children || 0) > 0 ? `, ${this.t("product.childrenPlural", "{n} niño(s)", { n: this.children })}` : ""}`;
      const includes = this.getPrintIncludesV80?.() || (this.product?.includes || []).slice(0, 10);
      const destination = isMachuClassic(this) ? this.t("product.machuPicchuArchSite", "Centro arqueológico de Machu Picchu") : (this.product?.location || "Cusco / Machu Picchu");
      const description = this.product?.description || this.product?.shortDescription || "Experiencia organizada por My Cusco Trip con asistencia personalizada antes y durante el viaje.";
      const discount = Number(summary.rawServiceTotal || quote.serviceTotal || 0) - Number(summary.rawPayNow || quote.payNow || 0);
      const showDiscount = this.paymentMode === "full" && Number(quote.discount || discount || 0) > 0;
      const discountText = `- ${currency} ${money(Number(quote.discount || Math.max(discount, 0)))}`;
      const finalPassenger = summary.finalPassengerPrice || `${currency} ${money(Number(summary.rawPayNow || quote.payNow || 0) / Math.max(1, Number(this.getTotalPassengers?.() || 1)))}`;
      const modeShort = summary.paymentModeShort || (this.paymentMode === "full" ? "Completo" : "Anticipo");

      target.innerHTML = `<div class="print-sheet print-sheet--v81">
        <header class="print-header print-header--v80 print-header--v81">
          <div>
            <img class="print-logo" src="./assets/img/reserva/logo-color.png" alt="My Cusco Trip" />
            <p class="print-eyebrow">${this.t("product.print.itineraryEyebrow", "ITINERARIO DE VIAJE")}</p>
            <h1>${esc(this.product?.title || this.t("product.print.experienceFallback", "Experiencia My Cusco Trip"))}</h1>
          </div>
          <div class="print-header__right">
            <p><strong>${this.t("product.print.quoteDateLabel", "Fecha de cotización:")}</strong> ${esc(generated)}</p>
            <p><strong>${this.t("product.print.travelDateLabel", "Fecha de viaje:")}</strong> ${esc(dateLabel)}</p>
            <p><strong>${this.t("product.print.passengerCountLabel", "Cantidad de pasajeros:")}</strong> ${esc(pax)}</p>
            <p><strong>${this.t("product.print.paymentModeLabel", "Modo de pago:")}</strong> ${esc(modeShort)}</p>
          </div>
        </header>
        ${this.renderProductPrintGalleryV81()}
        <div class="print-grid print-grid--trip">
          <div class="print-info-box">
            <p><strong>${this.t("product.print.destinationLabel", "Destino:")}</strong> ${esc(destination)}</p>
            <p><strong>${this.t("product.print.durationLabel", "Duración:")}</strong> ${esc(this.product?.duration?.label || "Full Day")}</p>
            <p><strong>${this.t("product.print.guideLabel", "Guía:")}</strong> ${this.t("product.languagesEsEnConsult", "español, inglés (otros idiomas, consultar)")}</p>
          </div>
          <div class="print-info-box print-info-box--payment">
            <p><strong>${this.t("product.print.finalPricePerPassengerLabel", "Precio final por pasajero:")}</strong> ${esc(finalPassenger)}</p>
            <p><strong>${this.t("product.totalServices", "Total de servicios")}:</strong> ${esc(summary.serviceTotal || `${currency} 0.00`)}</p>
            ${showDiscount ? `<p><strong>${this.t("product.print.discountAppliedLabel", "Descuento aplicado:")}</strong> ${esc(discountText)}</p>` : ""}
            <p class="print-pay-now"><strong>${this.t("product.print.totalToPayLabel", "Monto total a pagar:")}</strong> ${esc(summary.payNow || `${currency} 0.00`)}</p>
          </div>
        </div>
        <section class="print-section print-section--trains">
          <h2>${this.t("product.print.selectedTrainsHeading", "Trenes seleccionados")}</h2>
          <div class="print-train-grid">${this.renderTrainPrintCardV80?.(out, "outbound") || ""}${this.renderTrainPrintCardV80?.(ret, "return") || ""}</div>
        </section>
        <section class="print-section print-section--itinerary">
          <h2>${this.t("product.print.itineraryHeading", "Itinerario según tu selección")}</h2>
          <div class="print-itinerary-list">
            ${itinerary.map((item, index) => `<article class="print-itinerary-item"><div class="print-itinerary-time">${esc(item.time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</div><div><h3>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</h3><p>${esc(item.description || "")}</p></div></article>`).join("")}
          </div>
        </section>
        <section class="print-section print-section--description">
          <h2>${this.t("product.print.descriptionHeading", "Descripción")}</h2>
          <p class="print-description print-description--body">${esc(description)}</p>
        </section>
        <section class="print-section print-section--includes">
          <h2>${this.t("product.print.includesHeading", "Incluye")}</h2>
          <ul class="print-list">${includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>
        <footer class="print-footer">${this.t("product.print.footerNoteShort", "Documento referencial generado desde My Cusco Trip. Los horarios finales se confirman según disponibilidad operativa, trenes, ingreso oficial a Machu Picchu y coordinación del asesor de viaje.")}</footer>
      </div>`;
      window.setTimeout(() => window.print(), 80);
    };

    page.__mctV81Applied = true;
    return true;
  }
  if (!patchV81()) {
    document.addEventListener("DOMContentLoaded", patchV81);
    setTimeout(patchV81, 250);
    setTimeout(patchV81, 900);
    setTimeout(patchV81, 1600);
  }
})();

/* =========================================================
   PATCH MCT V82 - Print: logo, secciones extra, footer y .90
   ========================================================= */
(function () {
  function patchV82() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV82Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;

    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const money = function (value) {
      return typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    };
    const isMachuClassic = function () {
      const slug = String(this?.product?.slug || this?.slug || "").trim();
      return slug === "machu-picchu-full-day-clasico";
    };
    const roundToPointNinety = function (value) {
      const n = Number(value || 0);
      if (!Number.isFinite(n)) return 0.90;
      return Math.max(0, Math.floor(n) + 0.90);
    };
    const addMinutes = function (time, delta) {
      const match = String(time || "").match(/^(\d{1,2}):(\d{2})/);
      if (!match) return "";
      let total = Number(match[1]) * 60 + Number(match[2]) + Number(delta || 0);
      total = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };
    const formatDateLong = function (value) {
      if (!value) return "Fecha por definir";
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
    };
    const trainStationName = function (train, key, fallback) {
      const raw = train?.raw || {};
      const value = raw[key] || train?.[key] || fallback;
      const map = {
        OLLA_MAPI: "Ollantaytambo",
        MAPI_OLLA: "Ollantaytambo",
        CUSCO_MAPI: "Cusco",
        MAPI_CUSCO: "Cusco",
        URU_MAPI: "Urubamba",
        MAPI_URU: "Urubamba",
        HIDRO_MAPI: "Hidroeléctrica",
        MAPI_HIDRO: "Hidroeléctrica",
        MAPI: "Machu Picchu",
        OLLA: "Ollantaytambo"
      };
      return map[String(value || "").trim()] || value;
    };
    const selectedOutbound = function (ctx) {
      return ctx.getSelectedOutboundTrain?.() || ctx.findTrainById?.(ctx.selectedOutboundTrainId, ctx.availableOutboundTrains) || null;
    };
    const selectedReturn = function (ctx) {
      return ctx.getSelectedReturnTrain?.() || ctx.findTrainById?.(ctx.selectedReturnTrainId, ctx.availableReturnTrains) || null;
    };
    const totalPassengers = function (ctx) {
      return Math.max(1, Number(ctx.getTotalPassengers?.() || (Number(ctx.adults || 0) + Number(ctx.children || 0)) || 1));
    };
    const getFinalPassengerPrice = function (ctx, quote) {
      const pax = totalPassengers(ctx);
      const total = Number((quote?.serviceTotal || 0) - (quote?.discount || 0));
      return Math.max(total, 0) / pax;
    };

    proto.calculateMachuClassicBasePriceV78 = function () {
      const pax = Math.max(1, Number(this.getTotalPassengers?.() || 1));
      const rules = this.product?.financialRules || {};
      const guideCost = Number(this.product?.internalPricing?.guideCostUSD || 50);
      const fixedNetBasePerPerson = 320;
      const targetNetTotal = (fixedNetBasePerPerson * pax) + guideCost;
      const paypalPercent = Number(rules.paypalFeePercent ?? 5.4) / 100;
      const paypalFixed = Number(rules.paypalFixedUSD ?? 0.3);
      const bankPercent = Number(rules.bankWithdrawPercent ?? 3) / 100;
      const discountPercent = Number(rules.maxPublicDiscountBufferPercent ?? this.product?.paymentOptions?.fullPaymentDiscountPercent ?? 10) / 100;
      const chargedNeeded = ((targetNetTotal / Math.max(0.0001, 1 - bankPercent)) + paypalFixed) / Math.max(0.0001, 1 - paypalPercent);
      const publicBaseTotalRaw = chargedNeeded / Math.max(0.0001, 1 - discountPercent);
      const publicPerPerson = roundToPointNinety(publicBaseTotalRaw / pax);
      const publicBaseTotal = publicPerPerson * pax;
      const targetNetPerPerson = targetNetTotal / pax;
      return { pax, guideCost, targetNetTotal, targetNetPerPerson, publicBaseTotal, publicPerPerson, paypalPercent, paypalFixed, bankPercent, discountPercent };
    };

    const previousRenderProduct = proto.renderProduct;
    if (typeof previousRenderProduct === "function" && !proto.__mctV82RenderWrapped) {
      proto.__mctV82RenderWrapped = true;
      proto.renderProduct = function () {
        const result = previousRenderProduct.apply(this, arguments);
        if (isMachuClassic.call(this)) {
          const price = this.calculateMachuClassicBasePriceV78?.();
          if (price) this.setText?.("productBasePrice", `${this.product?.currency || "USD"} ${money(price.publicPerPerson)}`);
        }
        return result;
      };
    }

    const previousUpdateMachuClassicPricing = proto.updateMachuClassicPricingV78;
    if (typeof previousUpdateMachuClassicPricing === "function" && !proto.__mctV82PricingWrapped) {
      proto.__mctV82PricingWrapped = true;
      proto.updateMachuClassicPricingV78 = function () {
        const result = previousUpdateMachuClassicPricing.apply(this, arguments);
        if (!isMachuClassic.call(this)) return result;
        const currency = this.product?.currency || "USD";
        const quote = this.dynamicMachuClassicQuoteV78 || {};
        const finalPassenger = getFinalPassengerPrice(this, quote);
        this.setText?.("productBasePrice", `${currency} ${money(Number(quote.basePerPerson || this.calculateMachuClassicBasePriceV78?.().publicPerPerson || 0))}`);
        this.setText?.("finalPassengerPrice", `${currency} ${money(finalPassenger)}`);
        return result;
      };
    }

    proto.getProductPrintItineraryItemsV82 = function () {
      const items = Array.isArray(this.product?.itinerary) ? JSON.parse(JSON.stringify(this.product.itinerary)) : [];
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const outboundDeparture = out?.departureTime || "06:40";
      const returnDeparture = ret?.departureTime || "20:20";
      const returnArrival = ret?.arrivalTime || "21:59";
      const pickupTime = addMinutes(outboundDeparture, -160) || "04:00";
      const cuscoArrival = addMinutes(returnArrival, 120) || "22:30";
      return items.map((item) => {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        if (text.includes("recojo")) return { ...item, time: `${pickupTime} aprox.` };
        if (text.includes("viaje en tren") || text.includes("tren a machu")) return { ...item, time: `${outboundDeparture} aprox.`, title: item.title || this.t("product.itin.trainToMachuTitle", "Viaje en tren a Machu Picchu Pueblo") };
        if (text.includes("tren de retorno")) return { ...item, time: `${returnDeparture} aprox.` };
        if (text.includes("llegada a estación") || text.includes("ollantaytambo y traslado")) return { ...item, time: `${returnArrival} aprox.` };
        if (text.includes("llegada a cusco")) return { ...item, time: `${cuscoArrival} aprox.` };
        return item;
      });
    };

    proto.renderTrainPrintCardV82 = function (train, direction) {
      if (!train) return `<div class="print-train-card"><span>${direction === "return" ? this.t("booking.train.returnShort", "Retorno") : this.t("booking.train.outboundShort", "Ida")}</span><b>${this.t("quote.print.toBeConfirmed", "Por confirmar")}</b></div>`;
      const from = direction === "return" ? trainStationName(train, "departureStation", "Machu Picchu") : trainStationName(train, "departureStation", "Ollantaytambo");
      const to = direction === "return" ? trainStationName(train, "arrivalStation", "Ollantaytambo") : trainStationName(train, "arrivalStation", "Machu Picchu");
      return `<div class="print-train-card">
        <span>${direction === "return" ? this.t("booking.train.return", "Tren de retorno") : this.t("booking.train.outbound", "Tren de ida")}</span>
        <b>${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))} · ${esc(train.label || "")}</b>
        <small>${esc(from)} ${esc(train.departureTime || "")} → ${esc(to)} ${esc(train.arrivalTime || "")}</small>
      </div>`;
    };

    const normalizeList = function (items) {
      return (Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean);
    };

    proto.getPrintIncludesV82 = function () {
      const current = typeof this.getPrintIncludesV80 === "function" ? this.getPrintIncludesV80() : normalizeList(this.product?.includes);
      return normalizeList(current).map((item) => item.replace("Guía profesional certificado en español o inglés.", "Guía profesional certificado en español, inglés (otros idiomas, consultar)."));
    };

    proto.getPrintExcludesV82 = function () {
      return normalizeList(this.product?.excludes || this.product?.notIncludes || this.product?.not_included || []);
    };

    proto.getPrintImportantInfoV82 = function () {
      return normalizeList(this.product?.importantInfo || this.product?.important_info || this.product?.booking?.importantInfo || []);
    };

    proto.printProductItineraryV78 = function () {
      this.updatePricing?.();
      const target = document.getElementById("productPrintArea");
      if (!target) return window.print();
      const currency = this.product?.currency || "USD";
      const summary = this.getBookingSummary?.() || {};
      const quote = this.dynamicMachuClassicQuoteV78 || {};
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const itinerary = this.getProductPrintItineraryItemsV82?.() || this.product?.itinerary || [];
      const dateLabel = formatDateLong(this.date);
      const generated = new Date().toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
      const pax = `${this.t("product.adultsPlural", "{n} adulto(s)", { n: this.adults || 0 })}${Number(this.children || 0) > 0 ? `, ${this.t("product.childrenPlural", "{n} niño(s)", { n: this.children })}` : ""}`;
      const includes = this.getPrintIncludesV82?.() || [];
      const excludes = this.getPrintExcludesV82?.() || [];
      const importantInfo = this.getPrintImportantInfoV82?.() || [];
      const destination = isMachuClassic.call(this) ? this.t("product.machuPicchuArchSite", "Centro arqueológico de Machu Picchu") : (this.product?.location || "Cusco / Machu Picchu");
      const description = this.product?.description || this.product?.shortDescription || "Experiencia organizada por My Cusco Trip con asistencia personalizada antes y durante el viaje.";
      const discount = Number(summary.rawServiceTotal || quote.serviceTotal || 0) - Number(summary.rawPayNow || quote.payNow || 0);
      const showDiscount = this.paymentMode === "full" && Number(quote.discount || discount || 0) > 0;
      const discountText = `- ${currency} ${money(Number(quote.discount || Math.max(discount, 0)))}`;
      const finalPassenger = summary.finalPassengerPrice || `${currency} ${money(Number(summary.rawPayNow || quote.payNow || 0) / totalPassengers(this))}`;
      const modeShort = summary.paymentModeShort || (this.paymentMode === "full" ? "Completo" : "Anticipo");

      target.innerHTML = `<div class="print-sheet print-sheet--v81 print-sheet--v82">
        <header class="print-header print-header--v80 print-header--v81 print-header--v82">
          <div>
            <img class="print-logo print-logo--v82" src="./assets/img/reserva/logo-color.png" alt="My Cusco Trip" />
            <p class="print-eyebrow">${this.t("product.print.itineraryEyebrow", "ITINERARIO DE VIAJE")}</p>
            <h1>${esc(this.product?.title || this.t("product.print.experienceFallback", "Experiencia My Cusco Trip"))}</h1>
          </div>
          <div class="print-header__right">
            <p><strong>${this.t("product.print.quoteDateLabel", "Fecha de cotización:")}</strong> ${esc(generated)}</p>
            <p><strong>${this.t("product.print.travelDateLabel", "Fecha de viaje:")}</strong> ${esc(dateLabel)}</p>
            <p><strong>${this.t("product.print.passengerCountLabel", "Cantidad de pasajeros:")}</strong> ${esc(pax)}</p>
            <p><strong>${this.t("product.print.paymentModeLabel", "Modo de pago:")}</strong> ${esc(modeShort)}</p>
          </div>
        </header>
        ${this.renderProductPrintGalleryV81?.() || ""}
        <div class="print-grid print-grid--trip">
          <div class="print-info-box">
            <p><strong>${this.t("product.print.destinationLabel", "Destino:")}</strong> ${esc(destination)}</p>
            <p><strong>${this.t("product.print.durationLabel", "Duración:")}</strong> ${esc(this.product?.duration?.label || "Full Day")}</p>
            <p><strong>${this.t("product.print.guideLabel", "Guía:")}</strong> ${this.t("product.languagesEsEnConsult", "español, inglés (otros idiomas, consultar)")}</p>
          </div>
          <div class="print-info-box print-info-box--payment">
            <p><strong>${this.t("product.print.finalPricePerPassengerLabel", "Precio final por pasajero:")}</strong> ${esc(finalPassenger)}</p>
            <p><strong>${this.t("product.totalServices", "Total de servicios")}:</strong> ${esc(summary.serviceTotal || `${currency} 0.00`)}</p>
            ${showDiscount ? `<p><strong>${this.t("product.print.discountAppliedLabel", "Descuento aplicado:")}</strong> ${esc(discountText)}</p>` : ""}
            <p class="print-pay-now"><strong>${this.t("product.print.totalToPayLabel", "Monto total a pagar:")}</strong> <span>${esc(summary.payNow || `${currency} 0.00`)}</span></p>
          </div>
        </div>
        <section class="print-section print-section--trains">
          <h2>${this.t("product.print.selectedTrainsHeading", "Trenes seleccionados")}</h2>
          <div class="print-train-grid">${this.renderTrainPrintCardV82(out, "outbound")}${this.renderTrainPrintCardV82(ret, "return")}</div>
        </section>
        <section class="print-section print-section--itinerary">
          <h2>${this.t("product.print.itineraryHeading", "Itinerario según tu selección")}</h2>
          <div class="print-itinerary-list">
            ${itinerary.map((item, index) => `<article class="print-itinerary-item"><div class="print-itinerary-time">${esc(item.time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</div><div><h3>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</h3><p>${esc(item.description || "")}</p></div></article>`).join("")}
          </div>
        </section>
        <section class="print-section print-section--description">
          <h2>${this.t("product.print.descriptionHeading", "Descripción")}</h2>
          <p class="print-description print-description--body">${esc(description)}</p>
        </section>
        <section class="print-section print-section--includes">
          <h2>${this.t("product.print.includesHeading", "Incluye")}</h2>
          <ul class="print-list">${includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>
        ${excludes.length ? `<section class="print-section print-section--excludes"><h2>${this.t("product.print.excludesHeading", "No incluye")}</h2><ul class="print-list">${excludes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>` : ""}
        ${importantInfo.length ? `<section class="print-section print-section--important"><h2>${this.t("product.print.importantInfoHeading", "Información importante")}</h2><ul class="print-list">${importantInfo.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>` : ""}
        <footer class="print-footer">${this.t("product.print.footerNote", "Documento referencial generado desde My Cusco Trip. Los horarios finales se confirmarán según disponibilidad operativa, trenes, ingreso oficial a Machu Picchu y coordinación del asesor de viaje. Esta cotización tiene una vigencia de 2 días hábiles; pasado ese plazo, deberá volver a cotizarse.")}</footer>
      </div>`;
      window.setTimeout(() => window.print(), 80);
    };

    page.__mctV82Applied = true;
    try {
      if (isMachuClassic.call(page)) {
        page.updatePricing?.();
        const price = page.calculateMachuClassicBasePriceV78?.();
        if (price) page.setText?.("productBasePrice", `${page.product?.currency || "USD"} ${money(price.publicPerPerson)}`);
      }
      page.ensureProductPrintButtonV78?.();
    } catch (error) { console.warn("MCT V82 post-apply warning:", error); }
    return true;
  }
  if (!patchV82()) {
    document.addEventListener("DOMContentLoaded", patchV82);
    setTimeout(patchV82, 250);
    setTimeout(patchV82, 900);
    setTimeout(patchV82, 1600);
  }
})();

/* =========================================================
   PATCH MCT V83 - Print: horas a.m./p.m., URL y QR de reserva
   ========================================================= */
(function () {
  function patchV83() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV83Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;

    const esc = function (value) {
      if (typeof page.escapeHtml === "function") return page.escapeHtml(value ?? "");
      return String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    };
    const money = function (value) {
      return typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    };
    const formatDateLong = function (value) {
      if (!value) return "Fecha por definir";
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
    };
    const addMinutes = function (time, delta) {
      const match = String(time || "").match(/^(\d{1,2})[:.](\d{2})/);
      if (!match) return "";
      let total = Number(match[1]) * 60 + Number(match[2]) + Number(delta || 0);
      total = ((total % 1440) + 1440) % 1440;
      return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    };
    const totalPassengers = function (ctx) {
      return Math.max(1, Number(ctx.getTotalPassengers?.() || (Number(ctx.adults || 0) + Number(ctx.children || 0)) || 1));
    };
    const isMachuClassic = function (ctx) {
      return String(ctx?.product?.slug || ctx?.slug || "").trim() === "machu-picchu-full-day-clasico";
    };
    const selectedOutbound = function (ctx) {
      return ctx.getSelectedOutboundTrain?.() || ctx.findTrainById?.(ctx.selectedOutboundTrainId, ctx.availableOutboundTrains) || null;
    };
    const selectedReturn = function (ctx) {
      return ctx.getSelectedReturnTrain?.() || ctx.findTrainById?.(ctx.selectedReturnTrainId, ctx.availableReturnTrains) || null;
    };
    const trainStationName = function (train, key, fallback) {
      const raw = train?.raw || {};
      const value = raw[key] || train?.[key] || fallback;
      const map = {
        OLLA_MAPI: "Ollantaytambo",
        MAPI_OLLA: "Ollantaytambo",
        CUSCO_MAPI: "Cusco",
        MAPI_CUSCO: "Cusco",
        URU_MAPI: "Urubamba",
        MAPI_URU: "Urubamba",
        HIDRO_MAPI: "Hidroeléctrica",
        MAPI_HIDRO: "Hidroeléctrica",
        MAPI: "Machu Picchu",
        OLLA: "Ollantaytambo"
      };
      return map[String(value || "").trim()] || value || fallback;
    };
    const toAmPm = function (timeValue) {
      const raw = String(timeValue || "").trim();
      const match = raw.match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
      if (!match) return raw;
      let hour = Number(match[1]);
      const minute = Number(match[2]);
      const suffix = hour >= 12 ? "p.m." : "a.m.";
      let displayHour = hour % 12;
      if (displayHour === 0) displayHour = 12;
      return `${String(displayHour).padStart(2, "0")}.${String(minute).padStart(2, "0")} ${suffix}`;
    };
    const renderPrintTime = function (value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const hasApprox = /aprox|approx/i.test(raw);
      const clean = raw.replace(/\baprox\.?\b|\bapprox\.?\b/gi, "").trim();
      const formatted = toAmPm(clean || raw);
      if (!formatted) return esc(raw);
      return `<span class="print-time-main">${esc(formatted)}</span>${hasApprox ? `<span class="print-time-approx">(approx.)</span>` : ""}`;
    };
    const renderTrainTime = function (time) {
      return esc(toAmPm(time || ""));
    };
    const normalizeList = function (items) {
      return (Array.isArray(items) ? items : []).map((item) => String(item || "").trim()).filter(Boolean);
    };
    const buildProductUrl = function (ctx) {
      const slug = ctx.product?.slug || ctx.slug || "machu-picchu-full-day-clasico";
      let url;
      try {
        url = new URL(window.location.href);
      } catch (error) {
        return `https://mycuscotrip.com/product.html?slug=${encodeURIComponent(slug)}`;
      }
      url.hash = "";
      url.search = "";
      url.searchParams.set("slug", slug);
      return url.toString();
    };
    const buildQrUrl = function (text) {
      return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(text)}`;
    };

    proto.getProductPrintItineraryItemsV83 = function () {
      const baseItems = Array.isArray(this.product?.itinerary) ? JSON.parse(JSON.stringify(this.product.itinerary)) : [];
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const outboundDeparture = out?.departureTime || "06:40";
      const returnDeparture = ret?.departureTime || "20:20";
      const returnArrival = ret?.arrivalTime || "21:59";
      const pickupTime = addMinutes(outboundDeparture, -160) || "04:00";
      const cuscoArrival = addMinutes(returnArrival, 120) || "22:30";
      return baseItems.map((item) => {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        if (text.includes("recojo")) return { ...item, time: `${pickupTime} approx.` };
        if (text.includes("viaje en tren") || text.includes("tren a machu")) return { ...item, time: `${outboundDeparture} approx.`, title: item.title || this.t("product.itin.trainToMachuTitle", "Viaje en tren a Machu Picchu Pueblo") };
        if (text.includes("tren de retorno")) return { ...item, time: `${returnDeparture} approx.` };
        if (text.includes("llegada a estación") || text.includes("ollantaytambo y traslado")) return { ...item, time: `${returnArrival} approx.` };
        if (text.includes("llegada a cusco")) return { ...item, time: `${cuscoArrival} approx.` };
        return item;
      });
    };

    proto.renderTrainPrintCardV83 = function (train, direction) {
      if (!train) return `<div class="print-train-card"><span>${direction === "return" ? this.t("booking.train.returnShort", "Retorno") : this.t("booking.train.outboundShort", "Ida")}</span><b>${this.t("quote.print.toBeConfirmed", "Por confirmar")}</b></div>`;
      const from = direction === "return" ? trainStationName(train, "departureStation", "Machu Picchu") : trainStationName(train, "departureStation", "Ollantaytambo");
      const to = direction === "return" ? trainStationName(train, "arrivalStation", "Ollantaytambo") : trainStationName(train, "arrivalStation", "Machu Picchu");
      return `<div class="print-train-card print-train-card--v83">
        <span>${direction === "return" ? this.t("booking.train.return", "Tren de retorno") : this.t("booking.train.outbound", "Tren de ida")}</span>
        <b>${esc(train.companyName || train.company || this.t("quote.train.detailTrainFallback", "Tren"))} · ${esc(train.label || "")}</b>
        <small>${esc(from)} ${renderTrainTime(train.departureTime)} → ${esc(to)} ${renderTrainTime(train.arrivalTime)}</small>
      </div>`;
    };

    proto.getPrintIncludesV83 = function () {
      const current = typeof this.getPrintIncludesV82 === "function" ? this.getPrintIncludesV82() : normalizeList(this.product?.includes);
      return normalizeList(current);
    };
    proto.getPrintExcludesV83 = function () {
      return typeof this.getPrintExcludesV82 === "function" ? this.getPrintExcludesV82() : normalizeList(this.product?.excludes || this.product?.notIncludes || this.product?.not_included || []);
    };
    proto.getPrintImportantInfoV83 = function () {
      return typeof this.getPrintImportantInfoV82 === "function" ? this.getPrintImportantInfoV82() : normalizeList(this.product?.importantInfo || this.product?.important_info || this.product?.booking?.importantInfo || []);
    };

    proto.printProductItineraryV78 = function () {
      this.updatePricing?.();
      const target = document.getElementById("productPrintArea");
      if (!target) return window.print();
      const currency = this.product?.currency || "USD";
      const summary = this.getBookingSummary?.() || {};
      const quote = this.dynamicMachuClassicQuoteV78 || {};
      const out = selectedOutbound(this);
      const ret = selectedReturn(this);
      const itinerary = this.getProductPrintItineraryItemsV83?.() || this.product?.itinerary || [];
      const dateLabel = formatDateLong(this.date);
      const generated = new Date().toLocaleDateString(mctLocaleDateTag(), { day: "numeric", month: "long", year: "numeric" });
      const pax = `${this.t("product.adultsPlural", "{n} adulto(s)", { n: this.adults || 0 })}${Number(this.children || 0) > 0 ? `, ${this.t("product.childrenPlural", "{n} niño(s)", { n: this.children })}` : ""}`;
      const includes = this.getPrintIncludesV83?.() || [];
      const excludes = this.getPrintExcludesV83?.() || [];
      const importantInfo = this.getPrintImportantInfoV83?.() || [];
      const destination = isMachuClassic(this) ? this.t("product.machuPicchuArchSite", "Centro arqueológico de Machu Picchu") : (this.product?.location || "Cusco / Machu Picchu");
      const description = this.product?.description || this.product?.shortDescription || "Experiencia organizada por My Cusco Trip con asistencia personalizada antes y durante el viaje.";
      const discount = Number(summary.rawServiceTotal || quote.serviceTotal || 0) - Number(summary.rawPayNow || quote.payNow || 0);
      const showDiscount = this.paymentMode === "full" && Number(quote.discount || discount || 0) > 0;
      const discountText = `- ${currency} ${money(Number(quote.discount || Math.max(discount, 0)))}`;
      const finalPassenger = summary.finalPassengerPrice || `${currency} ${money(Number(summary.rawPayNow || quote.payNow || 0) / totalPassengers(this))}`;
      const modeShort = summary.paymentModeShort || (this.paymentMode === "full" ? "Completo" : "Anticipo");
      const productUrl = buildProductUrl(this);
      const qrUrl = buildQrUrl(productUrl);

      target.innerHTML = `<div class="print-sheet print-sheet--v81 print-sheet--v82 print-sheet--v83">
        <header class="print-header print-header--v80 print-header--v81 print-header--v82">
          <div>
            <img class="print-logo print-logo--v82" src="./assets/img/reserva/logo-color.png" alt="My Cusco Trip" />
            <p class="print-eyebrow">${this.t("product.print.itineraryEyebrow", "ITINERARIO DE VIAJE")}</p>
            <h1>${esc(this.product?.title || this.t("product.print.experienceFallback", "Experiencia My Cusco Trip"))}</h1>
          </div>
          <div class="print-header__right">
            <p><strong>${this.t("product.print.quoteDateLabel", "Fecha de cotización:")}</strong> ${esc(generated)}</p>
            <p><strong>${this.t("product.print.travelDateLabel", "Fecha de viaje:")}</strong> ${esc(dateLabel)}</p>
            <p><strong>${this.t("product.print.passengerCountLabel", "Cantidad de pasajeros:")}</strong> ${esc(pax)}</p>
            <p><strong>${this.t("product.print.paymentModeLabel", "Modo de pago:")}</strong> ${esc(modeShort)}</p>
          </div>
        </header>
        ${this.renderProductPrintGalleryV81?.() || ""}
        <div class="print-grid print-grid--trip">
          <div class="print-info-box">
            <p><strong>${this.t("product.print.destinationLabel", "Destino:")}</strong> ${esc(destination)}</p>
            <p><strong>${this.t("product.print.durationLabel", "Duración:")}</strong> ${esc(this.product?.duration?.label || "Full Day")}</p>
            <p><strong>${this.t("product.print.guideLabel", "Guía:")}</strong> ${this.t("product.languagesEsEnConsult", "español, inglés (otros idiomas, consultar)")}</p>
          </div>
          <div class="print-info-box print-info-box--payment">
            <p><strong>${this.t("product.print.finalPricePerPassengerLabel", "Precio final por pasajero:")}</strong> ${esc(finalPassenger)}</p>
            <p><strong>${this.t("product.totalServices", "Total de servicios")}:</strong> ${esc(summary.serviceTotal || `${currency} 0.00`)}</p>
            ${showDiscount ? `<p><strong>${this.t("product.print.discountAppliedLabel", "Descuento aplicado:")}</strong> ${esc(discountText)}</p>` : ""}
            <p class="print-pay-now"><strong>${this.t("product.print.totalToPayLabel", "Monto total a pagar:")}</strong> <span>${esc(summary.payNow || `${currency} 0.00`)}</span></p>
          </div>
        </div>
        <section class="print-section print-section--trains">
          <h2>${this.t("product.print.selectedTrainsHeading", "Trenes seleccionados")}</h2>
          <div class="print-train-grid">${this.renderTrainPrintCardV83(out, "outbound")}${this.renderTrainPrintCardV83(ret, "return")}</div>
        </section>
        <section class="print-section print-section--itinerary">
          <h2>${this.t("product.print.itineraryHeading", "Itinerario según tu selección")}</h2>
          <div class="print-itinerary-list">
            ${itinerary.map((item, index) => `<article class="print-itinerary-item"><div class="print-itinerary-time">${renderPrintTime(item.time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</div><div><h3>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</h3><p>${esc(item.description || "")}</p></div></article>`).join("")}
          </div>
        </section>
        <section class="print-section print-section--description">
          <h2>${this.t("product.print.descriptionHeading", "Descripción")}</h2>
          <p class="print-description print-description--body">${esc(description)}</p>
        </section>
        <section class="print-section print-section--includes">
          <h2>${this.t("product.print.includesHeading", "Incluye")}</h2>
          <ul class="print-list">${includes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
        </section>
        ${excludes.length ? `<section class="print-section print-section--excludes"><h2>${this.t("product.print.excludesHeading", "No incluye")}</h2><ul class="print-list">${excludes.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>` : ""}
        ${importantInfo.length ? `<section class="print-section print-section--important"><h2>${this.t("product.print.importantInfoHeading", "Información importante")}</h2><ul class="print-list">${importantInfo.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></section>` : ""}
        <section class="print-section print-section--book-v83">
          <div class="print-booking-copy">
            <h2>Puedes reservar este itinerario en:</h2>
            <p>${esc(productUrl)}</p>
            <small>O escaneando este QR desde tu celular.</small>
          </div>
          <div class="print-booking-qr"><img src="${esc(qrUrl)}" alt="${esc(this.t("product.qrReserveItinerary", "QR para reservar este itinerario"))}" /></div>
        </section>
        <footer class="print-footer">${this.t("product.print.footerNote", "Documento referencial generado desde My Cusco Trip. Los horarios finales se confirmarán según disponibilidad operativa, trenes, ingreso oficial a Machu Picchu y coordinación del asesor de viaje. Esta cotización tiene una vigencia de 2 días hábiles; pasado ese plazo, deberá volver a cotizarse.")}</footer>
      </div>`;
      window.setTimeout(() => window.print(), 350);
    };

    page.__mctV83Applied = true;
    try { page.ensureProductPrintButtonV78?.(); } catch (error) { console.warn("MCT V83 post-apply warning:", error); }
    return true;
  }
  if (!patchV83()) {
    document.addEventListener("DOMContentLoaded", patchV83);
    setTimeout(patchV83, 250);
    setTimeout(patchV83, 900);
    setTimeout(patchV83, 1600);
  }
})();

/* =========================================================
   PATCH MCT V84 - Overnight clásico: precio, trenes, hotel y QR robusto
   ========================================================= */
(function () {
  function patchV84() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV84Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;

    const slugOf = (ctx) => String(ctx?.product?.slug || ctx?.slug || "").trim();
    const isFullDayClassic = (ctx) => slugOf(ctx) === "machu-picchu-full-day-clasico";
    const isOvernightClassic = (ctx) => slugOf(ctx) === "machu-picchu-overnight-clasico";
    const isClassicPricedMachu = (ctx) => isFullDayClassic(ctx) || isOvernightClassic(ctx);
    const esc = (value) => typeof page.escapeHtml === "function"
      ? page.escapeHtml(value ?? "")
      : String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    const money = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const paxCount = (ctx) => Math.max(1, Number(ctx.getTotalPassengers?.() || (Number(ctx.adults || 0) + Number(ctx.children || 0)) || 1));
    const roundToPoint90 = (value) => {
      const n = Number(value || 0);
      if (!Number.isFinite(n)) return 0.90;
      return Math.max(0.90, Math.ceil(n - 0.90) + 0.90);
    };
    const hotelIncludedCost = (ctx, pax) => {
      if (!isOvernightClassic(ctx)) return 0;
      const internal = ctx.product?.internalPricing || {};
      const single = Number(internal.defaultHotelCostUSD || 45);
      const shared = Number(internal.defaultHotelCostPerPersonIfSharedUSD || 22.5);
      return pax <= 1 ? single : shared * pax;
    };
    const defaultHotelCode = (ctx) => ctx.product?.accommodationSelection?.defaultHotelCode || ctx.product?.internalPricing?.defaultHotelCode || "luz-garden-3s";

    proto.calculateMachuClassicBasePriceV84 = function () {
      const pax = paxCount(this);
      const rules = this.product?.financialRules || {};
      const internal = this.product?.internalPricing || {};
      const guideCost = Number(internal.guideCostUSD || 50);
      const fixedNetBasePerPerson = Number(internal.fixedNetBasePerPersonUSD || 320);
      const hotelCost = hotelIncludedCost(this, pax);
      const targetNetTotal = (fixedNetBasePerPerson * pax) + guideCost + hotelCost;
      const paypalPercent = Number(rules.paypalFeePercent ?? 5.4) / 100;
      const paypalFixed = Number(rules.paypalFixedUSD ?? 0.3);
      const bankPercent = Number(rules.bankWithdrawPercent ?? 3) / 100;
      const discountPercent = Number(rules.maxPublicDiscountBufferPercent ?? this.product?.paymentOptions?.fullPaymentDiscountPercent ?? 10) / 100;
      const chargedNeeded = ((targetNetTotal / Math.max(0.0001, 1 - bankPercent)) + paypalFixed) / Math.max(0.0001, 1 - paypalPercent);
      const publicBaseTotalRaw = chargedNeeded / Math.max(0.0001, 1 - discountPercent);
      const publicPerPerson = roundToPoint90(publicBaseTotalRaw / pax);
      const publicBaseTotal = publicPerPerson * pax;
      const targetNetPerPerson = targetNetTotal / pax;
      return { pax, guideCost, hotelCost, targetNetTotal, targetNetPerPerson, publicBaseTotal, publicPerPerson, paypalPercent, paypalFixed, bankPercent, discountPercent };
    };

    proto.calculateOvernightHotelUpgradeTotalV84 = function () {
      if (!isOvernightClassic(this)) return 0;
      const destination = "aguas-calientes";
      const selectedCode = this.selectedHotelsByDestination?.[destination] || defaultHotelCode(this);
      if (!selectedCode || selectedCode === defaultHotelCode(this) || selectedCode === "no-hotel") return 0;
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      const selectedPerPerson = Number(selection?.combination?.additionalPerPerson || 0);
      const hotels = this.getHotelsByDestination?.(destination) || [];
      const defaultHotel = hotels.find((h) => h.hotelCode === defaultHotelCode(this));
      let defaultPerPerson = 0;
      if (defaultHotel && typeof this.generateAccommodationCombinations === "function") {
        const combos = this.generateAccommodationCombinations(defaultHotel.rooms || [], paxCount(this), 1);
        defaultPerPerson = Number(combos?.[0]?.additionalPerPerson || 0);
      }
      return Math.max(0, selectedPerPerson - defaultPerPerson) * paxCount(this);
    };

    proto.updateMachuOvernightPricingV84 = function () {
      const currency = this.product?.currency || "USD";
      const base = this.calculateMachuClassicBasePriceV84();
      const pax = base.pax;
      const basePerPerson = base.publicPerPerson;
      const adultsTotal = Number(this.adults || 0) * basePerPerson;
      const childrenTotal = Number(this.children || 0) * basePerPerson;
      const extrasTotal = this.calculateExtrasTotal?.() || 0;
      const trainAdjustmentTotal = this.calculateSelectedTrainAdjustmentTotal?.() || 0;
      const accommodationTotal = this.calculateOvernightHotelUpgradeTotalV84?.() || 0;
      const serviceTotal = base.publicBaseTotal + extrasTotal + trainAdjustmentTotal + accommodationTotal;
      if (this.product?.paymentOptions) this.product.paymentOptions.fullPaymentDiscountPercent = 10;
      const fullDiscountPercent = 10;
      const partialPerPerson = Number(this.product?.paymentOptions?.partialPaymentPerPerson || 149);
      const discountInfo = this.getDiscountInfo?.(serviceTotal, fullDiscountPercent) || { discount: serviceTotal * 0.10, percent: 10 };
      const discount = Number(discountInfo.discount || 0);
      const discountedTotal = Math.max(serviceTotal - discount, 0);
      let payNow = discountedTotal;
      let payLater = 0;
      let infoText = this.t("product.fullPaymentDiscountNoteB", "Pagando el total ahora obtienes un {percent}% de descuento.", { percent: fullDiscountPercent });
      if (this.paymentMode !== "full") {
        payNow = Math.min(pax * partialPerPerson, discountedTotal);
        payLater = Math.max(discountedTotal - payNow, 0);
        infoText = this.product?.paymentOptions?.partialPaymentLabel || this.t("product.depositReservationNoteShort", "Reserva con anticipo y completa el saldo antes del viaje.");
      }
      this.dynamicMachuClassicQuoteV78 = {
        currency, pax, basePerPerson, publicBaseTotal: base.publicBaseTotal,
        targetNetPerPerson: base.targetNetPerPerson,
        adultsTotal, childrenTotal, extrasTotal, trainAdjustmentTotal, accommodationTotal,
        serviceTotal, discount, payNow, payLater, hotelIncludedCost: base.hotelCost
      };
      this.setText?.("productBasePrice", `${currency} ${money(basePerPerson)}`);
      this.setText?.("adultsTotal", `${currency} ${money(adultsTotal)}`);
      this.setText?.("childrenTotal", `${currency} ${money(childrenTotal)}`);
      this.setText?.("extrasTotal", `${currency} ${money(extrasTotal)}`);
      this.setText?.("serviceTotal", `${currency} ${money(serviceTotal)}`);
      this.setText?.("payNowTotal", `${currency} ${money(payNow)}`);
      this.setText?.("discountTotal", `- ${currency} ${money(discount)}`);
      this.setText?.("payLaterTotal", `${currency} ${money(payLater)}`);
      this.setText?.("accommodationTotal", `${currency} ${money(accommodationTotal)}`);
      this.setText?.("finalPassengerPrice", `${currency} ${money(discountedTotal / pax)}`);
      const adultsRow = document.getElementById("adultsTotal")?.closest(".booking-summary__line");
      if (adultsRow) {
        const label = adultsRow.querySelector("span");
        if (label) label.textContent = `Adultos x${String(this.adults || 0).padStart(2, "0")}`;
        adultsRow.hidden = false;
      }
      const childrenRow = document.getElementById("childrenTotal")?.closest(".booking-summary__line");
      if (childrenRow) {
        const label = childrenRow.querySelector("span");
        if (label) label.textContent = `Niños x${String(this.children || 0).padStart(2, "0")}`;
        childrenRow.hidden = !(Number(this.children || 0) > 0);
      }
      const extrasRow = document.getElementById("extrasTotal")?.closest(".booking-summary__line");
      if (extrasRow) extrasRow.hidden = !(extrasTotal > 0);
      const accommodationRow = document.getElementById("accommodationTotal")?.closest(".booking-summary__line");
      if (accommodationRow) {
        const label = accommodationRow.querySelector("span");
        if (label) label.textContent = this.t("product.hotelUpgradeButton", "Upgrade de hotel");
        accommodationRow.hidden = !(accommodationTotal > 0);
      }
      const discountRow = document.getElementById("discountRow");
      if (discountRow) discountRow.hidden = !(discount > 0 && this.paymentMode === "full");
      const payLaterRow = document.getElementById("payLaterRow");
      if (payLaterRow) payLaterRow.hidden = this.paymentMode === "full" || payLater <= 0;
      const paymentInfo = document.getElementById("paymentInfo");
      if (paymentInfo) paymentInfo.textContent = infoText;
      this.updateTrainAdjustmentSummaryRow?.(trainAdjustmentTotal, currency);
      const payNowLabel = document.getElementById("payNowLabel");
      if (payNowLabel) payNowLabel.textContent = "Pagar ahora";
      return true;
    };

    const previousUpdatePricing = proto.updatePricing;
    proto.updatePricing = function () {
      if (isOvernightClassic(this)) return this.updateMachuOvernightPricingV84();
      return previousUpdatePricing?.apply(this, arguments);
    };

    const previousRenderProduct = proto.renderProduct;
    proto.renderProduct = function (product) {
      const result = previousRenderProduct?.apply(this, arguments);
      if (isOvernightClassic(this)) {
        if (this.product?.paymentOptions) this.product.paymentOptions.fullPaymentDiscountPercent = 10;
        const lang = document.getElementById("detailLanguages");
        if (lang) lang.textContent = this.t("product.guideProfessionalEsEn", "Guía profesional: español, inglés (otros idiomas, consultar)");
        const serviceSection = document.getElementById("serviceModeSection");
        const serviceSelect = document.getElementById("serviceMode");
        if (serviceSection) serviceSection.hidden = true;
        if (serviceSelect) serviceSelect.value = "group";
        this.serviceMode = "group";
        this.ensureOvernightDefaultHotelV84?.();
        this.renderAccommodationOptions?.(this.product);
        this.bindAccommodationEvents?.();
        const price = this.calculateMachuClassicBasePriceV84?.();
        if (price) this.setText?.("productBasePrice", `${this.product?.currency || "USD"} ${money(price.publicPerPerson)}`);
        this.updatePricing?.();
      }
      return result;
    };

    proto.ensureOvernightDefaultHotelV84 = function () {
      if (!isOvernightClassic(this)) return;
      const destination = "aguas-calientes";
      if (!this.selectedHotelsByDestination) this.selectedHotelsByDestination = {};
      if (!this.selectedCombinationsByDestination) this.selectedCombinationsByDestination = {};
      if (!this.selectedHotelsByDestination[destination] || this.selectedHotelsByDestination[destination] === "no-hotel") {
        this.selectedHotelsByDestination[destination] = defaultHotelCode(this);
      }
      const hotel = this.getHotelByCode?.(destination, this.selectedHotelsByDestination[destination]);
      if (hotel && !this.selectedCombinationsByDestination[destination]) {
        const combos = this.generateAccommodationCombinations?.(hotel.rooms || [], paxCount(this), 1) || [];
        if (combos[0]) this.selectedCombinationsByDestination[destination] = combos[0];
      }
    };

    const previousGetAccommodationSummary = proto.getAccommodationSummary;
    proto.getAccommodationSummary = function (product) {
      if (String(product?.slug || this.product?.slug || this.slug || "") === "machu-picchu-overnight-clasico") {
        return [{ destination: "aguas-calientes", nights: 1, label: "Aguas Calientes - 1 noche" }];
      }
      return previousGetAccommodationSummary?.apply(this, arguments) || [];
    };

    const previousGetDefaultHotelCode = proto.getDefaultHotelCodeForDestination;
    proto.getDefaultHotelCodeForDestination = function (destination) {
      if (isOvernightClassic(this) && String(destination || "").toLowerCase().includes("aguas")) return defaultHotelCode(this);
      return previousGetDefaultHotelCode?.apply(this, arguments) || "";
    };

    const previousRenderAccommodation = proto.renderAccommodationOptions;
    proto.renderAccommodationOptions = function (product) {
      if (!product || String(product.slug || this.product?.slug || "") !== "machu-picchu-overnight-clasico") {
        return previousRenderAccommodation?.apply(this, arguments);
      }
      const section = document.getElementById("packageAccommodationSection");
      const container = document.getElementById("hotelSelectorsContainer");
      if (!section || !container) return;
      this.ensureOvernightDefaultHotelV84?.();
      const destination = "aguas-calientes";
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      const hotel = selection?.hotel || this.getHotelByCode?.(destination, defaultHotelCode(this));
      const combo = selection?.combination || null;
      const upgradeTotal = this.calculateOvernightHotelUpgradeTotalV84?.() || 0;
      const image = hotel?.images?.cover || hotel?.images?.gallery?.[0] || "";
      section.hidden = false;
      section.classList.add("booking-field--hotel-upgrade-v84");
      container.innerHTML = `<div class="booking-accommodation-card booking-accommodation-card--selected booking-accommodation-card--overnight-v84">
        ${image ? `<div class="booking-accommodation-card__thumb"><img src="${this.resolveAssetPath(image)}" alt="${esc(hotel?.hotelName || "Hotel seleccionado")}" loading="lazy" /></div>` : ""}
        <div class="booking-accommodation-card__header">
          <strong>Hotel incluido</strong>
          <small>1 noche en Aguas Calientes</small>
        </div>
        <div class="booking-accommodation-card__body">
          <p class="booking-accommodation-card__selected">${esc(hotel?.hotelName || "Hotel Luz Garden Machu Picchu")} ${hotel?.stars ? `· ${this.renderStars?.(hotel.stars) || `${hotel.stars}★`}` : ""}</p>
          <p class="booking-accommodation-card__selected">${esc(combo?.label || "Habitación según disponibilidad")}</p>
          <p class="booking-accommodation-card__price">${upgradeTotal > 0 ? `+ ${this.product.currency || "USD"} ${money(upgradeTotal)} total por upgrade` : "Incluido en el precio base"}</p>
          <button type="button" class="btn booking-secondary-btn open-hotel-modal-btn" data-destination="aguas-calientes"><i class="fas fa-hotel"></i> Upgrade de hotel</button>
        </div>
      </div>`;
    };

    const previousGetBookingSummary = proto.getBookingSummary;
    proto.getBookingSummary = function () {
      if (!isOvernightClassic(this)) return previousGetBookingSummary?.apply(this, arguments);
      const currency = this.product?.currency || "USD";
      const quote = this.dynamicMachuClassicQuoteV78 || (this.updateMachuOvernightPricingV84?.(), this.dynamicMachuClassicQuoteV78) || {};
      const selectedExtras = (this.product?.extras || []).filter((extra) => this.selectedExtras?.has(extra.code)).map((extra) => extra.label);
      const selection = this.getSelectedAccommodationForDestination?.("aguas-calientes");
      const accommodation = selection?.hotel ? [`Aguas Calientes - ${selection.hotel.hotelName}${selection.combination?.label ? ` - ${selection.combination.label}` : ""}`] : ["Aguas Calientes - Hotel Luz Garden Machu Picchu"];
      const finalPassenger = Number(quote.payNow || 0) / paxCount(this);
      return {
        title: this.product.title,
        date: this.date || this.t("quote.print.toBeConfirmed", "Por confirmar"),
        adults: this.adults,
        children: this.children,
        departureTime: this.getSelectedDepartureTimeLabel?.(),
        trainSelection: this.getSelectedTrainSummaryLabel?.(),
        serviceMode: "Tour en grupo",
        accommodation,
        extras: selectedExtras,
        serviceTotal: `${currency} ${money(quote.serviceTotal || 0)}`,
        payNow: `${currency} ${money(quote.payNow || 0)}`,
        payLater: `${currency} ${money(quote.payLater || 0)}`,
        rawServiceTotal: Number(quote.serviceTotal || 0),
        rawPayNow: Number(quote.payNow || 0),
        rawPayLater: Number(quote.payLater || 0),
        paymentMode: this.paymentMode === "full" ? "Pago completo" : "Reserva con anticipo",
        paymentModeShort: this.paymentMode === "full" ? "Completo" : "Anticipo",
        finalPassengerPrice: `${currency} ${money(finalPassenger)}`,
        couponCode: this.appliedCoupon?.couponCode || ""
      };
    };

    const previousGetPrintIncludes = proto.getPrintIncludesV83 || proto.getPrintIncludesV82;
    proto.getPrintIncludesV83 = function () {
      const base = (typeof previousGetPrintIncludes === "function" ? previousGetPrintIncludes.apply(this, arguments) : (this.product?.includes || [])) || [];
      if (!isOvernightClassic(this)) return base;
      const selection = this.getSelectedAccommodationForDestination?.("aguas-calientes");
      const hotelName = selection?.hotel?.hotelName || "Hotel Luz Garden Machu Picchu";
      const combo = selection?.combination?.label ? ` (${selection.combination.label})` : "";
      const item = this.t("product.accommodationIncludedNote", "Alojamiento incluido: {hotel}{combo}, 1 noche en Aguas Calientes", { hotel: hotelName, combo });
      return [...base.filter((x) => !String(x).toLowerCase().includes("alojamiento incluido")), item];
    };

    const previousPrint = proto.printProductItineraryV78;
    if (typeof previousPrint === "function") {
      proto.printProductItineraryV78 = function () {
        const originalPrint = window.print;
        let printCalled = false;
        const safePrint = () => {
          if (printCalled) return;
          printCalled = true;
          window.print = originalPrint;
          originalPrint.call(window);
        };
        window.print = () => {
          const area = document.getElementById("productPrintArea");
          const imgs = Array.from(area?.querySelectorAll("img") || []);
          if (!imgs.length) return safePrint();
          let pending = imgs.filter((img) => !img.complete || img.naturalWidth === 0).length;
          if (!pending) return safePrint();
          const done = () => { pending -= 1; if (pending <= 0) window.setTimeout(safePrint, 120); };
          imgs.forEach((img) => {
            if (img.complete && img.naturalWidth > 0) return;
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
          window.setTimeout(safePrint, 2200);
        };
        try {
          const result = previousPrint.apply(this, arguments);
          window.setTimeout(() => { if (!printCalled) window.print(); }, 2600);
          return result;
        } catch (error) {
          window.print = originalPrint;
          throw error;
        }
      };
    }

    page.__mctV84Applied = true;
    try {
      if (isOvernightClassic(page)) {
        page.ensureOvernightDefaultHotelV84?.();
        page.renderAccommodationOptions?.(page.product);
        page.bindAccommodationEvents?.();
        page.updatePricing?.();
      }
    } catch (error) { console.warn("MCT V84 post-apply warning:", error); }
    return true;
  }
  if (!patchV84()) {
    document.addEventListener("DOMContentLoaded", patchV84);
    setTimeout(patchV84, 250);
    setTimeout(patchV84, 900);
    setTimeout(patchV84, 1600);
  }
})();


/* =========================================================
   PATCH MCT V85 - Overnight clásico: hotel incluido, trenes visibles e impresión hotel
   ========================================================= */
(function () {
  function patchV85() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV85Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;
    const slugOf = (ctx) => String(ctx?.product?.slug || ctx?.slug || "").trim();
    const isOvernightClassic = (ctx) => slugOf(ctx) === "machu-picchu-overnight-clasico";
    const esc = (value) => typeof page.escapeHtml === "function"
      ? page.escapeHtml(value ?? "")
      : String(value ?? "").replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
    const money = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const paxCount = (ctx) => Math.max(1, Number(ctx.getTotalPassengers?.() || (Number(ctx.adults || 0) + Number(ctx.children || 0)) || 1));
    const defaultHotelCode = (ctx) => ctx.product?.accommodationSelection?.defaultHotelCode || ctx.product?.internalPricing?.defaultHotelCode || "luz-garden-3s";
    const hotelCreditTotal = (ctx) => {
      const pax = paxCount(ctx);
      const internal = ctx.product?.internalPricing || {};
      const single = Number(internal.defaultHotelCostUSD || ctx.product?.accommodationSelection?.defaultHotelCostUSD || 45);
      const shared = Number(internal.defaultHotelCostPerPersonIfSharedUSD || 22.5);
      return pax <= 1 ? single : (pax === 2 ? single : shared * pax);
    };
    const comboUpgradeTotal = (ctx, hotelCode, combo) => {
      if (!combo) return 0;
      if (!hotelCode || hotelCode === defaultHotelCode(ctx)) return 0;
      return Math.max(0, Number(combo.totalForStay || 0) - hotelCreditTotal(ctx));
    };
    const comboUpgradePerPerson = (ctx, hotelCode, combo) => comboUpgradeTotal(ctx, hotelCode, combo) / paxCount(ctx);

    proto.calculateOvernightHotelUpgradeTotalV84 = function () {
      if (!isOvernightClassic(this)) return 0;
      const destination = "aguas-calientes";
      const selectedCode = this.selectedHotelsByDestination?.[destination] || defaultHotelCode(this);
      if (!selectedCode || selectedCode === "no-hotel") return 0;
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      return comboUpgradeTotal(this, selectedCode, selection?.combination);
    };

    const ensureFinalPassengerRowV85 = function (ctx) {
      let row = document.getElementById("finalPassengerPriceRow");
      const serviceRow = document.getElementById("serviceTotalRow");
      if (!row && serviceRow?.parentNode) {
        row = document.createElement("div");
        row.id = "finalPassengerPriceRow";
        row.className = "booking-summary__line booking-summary__line--per-passenger";
        row.innerHTML = `<span>Precio final por pasajero</span><strong id="finalPassengerPrice">${esc(ctx.product?.currency || "USD")} 0.00</strong>`;
        serviceRow.parentNode.insertBefore(row, serviceRow);
      }
      return row;
    };

    const prevUpdateOvernight = proto.updateMachuOvernightPricingV84;
    if (typeof prevUpdateOvernight === "function") {
      proto.updateMachuOvernightPricingV84 = function () {
        const result = prevUpdateOvernight.apply(this, arguments);
        if (isOvernightClassic(this)) {
          const quote = this.dynamicMachuClassicQuoteV78 || {};
          const pax = paxCount(this);
          const finalPassenger = Number(quote.payNow || 0) / pax;
          const row = ensureFinalPassengerRowV85(this);
          if (row) row.hidden = false;
          this.setText?.("finalPassengerPrice", `${this.product?.currency || "USD"} ${money(finalPassenger)}`);
          this.updateTrainAdjustmentSummaryRow?.(Number(quote.trainAdjustmentTotal || 0), this.product?.currency || "USD");
          const hotelRow = document.getElementById("accommodationTotal")?.closest(".booking-summary__line");
          if (hotelRow) {
            const label = hotelRow.querySelector("span");
            if (label) label.textContent = this.t("product.hotelUpgradeButton", "Upgrade de hotel");
            hotelRow.hidden = !(Number(quote.accommodationTotal || 0) > 0);
          }
        }
        return result;
      };
    }

    const previousOpenHotelModal = proto.openHotelModal;
    proto.openHotelModal = function (destination) {
      if (!isOvernightClassic(this) || String(destination) !== "aguas-calientes") {
        return previousOpenHotelModal?.apply(this, arguments);
      }
      const modal = document.getElementById("hotelSelectionModal");
      const title = document.getElementById("hotelModalTitle");
      const subtitle = document.getElementById("hotelModalSubtitle");
      const list = document.getElementById("hotelModalList");
      const cancelBtn = document.getElementById("cancelHotelModalBtn");
      if (!modal || !title || !subtitle || !list) return;
      this.activeHotelModalDestination = destination;
      if (cancelBtn) cancelBtn.textContent = this.t("product.selectHotelRoom", "Select hotel and room");
      const destinationLabel = this.getDestinationLabel(destination);
      const nights = 1;
      const passengers = paxCount(this);
      title.textContent = "Upgrade de hotel en Aguas Calientes";
      subtitle.textContent = "El Hotel Luz Garden Machu Picchu está incluido. Compara hoteles y habitaciones disponibles para tu noche en Aguas Calientes.";
      const hotels = (this.getHotelsByDestination?.(destination) || []).filter((h) => h?.hotelCode !== "no-hotel");
      const pendingHotelCode = this.selectedHotelsByDestination?.[destination] || defaultHotelCode(this);
      const pendingCombinationKey = this.selectedCombinationsByDestination?.[destination]?.key || "";
      list.innerHTML = hotels.map((hotel) => {
        const combinations = this.generateAccommodationCombinations(hotel.rooms || [], passengers, nights);
        const currentHotelCode = pendingHotelCode;
        const currentCombinationKey = pendingCombinationKey;
        const isSelectedHotel = currentHotelCode === hotel.hotelCode;
        const initialCombo = combinations.find((combo) => isSelectedHotel && combo.key === currentCombinationKey) || combinations[0] || null;
        const images = [...new Set([...(hotel.images?.cover ? [hotel.images.cover] : []), ...(Array.isArray(hotel.images?.gallery) ? hotel.images.gallery : [])])];
        const upgrade = comboUpgradeTotal(this, hotel.hotelCode, initialCombo);
        const upgradePerPerson = comboUpgradePerPerson(this, hotel.hotelCode, initialCombo);
        const badge = hotel.hotelCode === defaultHotelCode(this)
          ? "Hotel incluido en el precio"
          : `+ ${this.product.currency || "USD"} ${money(upgradePerPerson)} por persona`;
        return `
          <article class="hotel-option-card ${isSelectedHotel ? "is-selected" : ""} hotel-option-card--overnight-v85"
            data-hotel-card="${esc(hotel.hotelCode)}" data-destination="${esc(destination)}" data-hotel-code="${esc(hotel.hotelCode)}" data-selected-combo-key="${esc(initialCombo?.key || "")}">
            <div class="hotel-option-card__header">
              <div>
                <h3>${esc(hotel.hotelName)}</h3>
                <p>${this.renderStars?.(hotel.stars || 0) || `${hotel.stars || 0}★`} · ${esc(hotel.location || destinationLabel)}</p>
                ${hotel.address ? `<p>${esc(hotel.address)}</p>` : ""}
              </div>
              <div class="hotel-option-card__badge ${hotel.hotelCode === defaultHotelCode(this) ? "hotel-option-card__badge--included" : ""}">${esc(badge)}</div>
            </div>
            <div class="hotel-option-card__content">
              <div class="hotel-option-card__media"><div class="hotel-option-card__gallery">${this.renderHotelModalGallery(images, hotel.hotelName)}</div>${this.renderHotelFeatures(hotel)}</div>
              <div class="hotel-option-card__body">
                <label>${this.t("product.selectRoomType", "Selecciona tipo de habitación")}</label>
                <div class="hotel-option-card__options">
                  ${combinations.length ? combinations.map((combo) => {
                    const comboUpgrade = comboUpgradeTotal(this, hotel.hotelCode, combo);
                    const comboPerPerson = comboUpgrade / passengers;
                    const sub = hotel.hotelCode === defaultHotelCode(this)
                      ? `${combo.totalRooms} ${combo.totalRooms === 1 ? "habitación" : "habitaciones"} | Incluido en el precio base`
                      : `${combo.totalRooms} ${combo.totalRooms === 1 ? "habitación" : "habitaciones"} | Upgrade total + ${this.product.currency || "USD"} ${money(comboUpgrade)} · ${this.product.currency || "USD"} ${money(comboPerPerson)} por persona`;
                    return `<button type="button" class="hotel-combo-btn ${isSelectedHotel && currentCombinationKey === combo.key ? "is-selected" : ""}" data-destination="${esc(destination)}" data-hotel-code="${esc(hotel.hotelCode)}" data-combo-key="${esc(combo.key)}"><span class="hotel-combo-radio" aria-hidden="true"></span><span class="hotel-combo-btn__main">${esc(combo.label)}</span><span class="hotel-combo-btn__sub">${esc(sub)}</span></button>`;
                  }).join("") : `<p>No hay habitaciones válidas para ${passengers} viajeros.</p>`}
                </div>
              </div>
            </div>
          </article>`;
      }).join("");
      this.bindHotelModalSelectionEvents();
      this.bindHotelModalGalleryEvents();
      modal.hidden = false;
      document.body.classList.add("hotel-modal-open");
    };

    const previousRenderAccommodation = proto.renderAccommodationOptions;
    proto.renderAccommodationOptions = function (product) {
      const result = previousRenderAccommodation?.apply(this, arguments);
      if (!isOvernightClassic(this)) return result;
      const destination = "aguas-calientes";
      this.ensureOvernightDefaultHotelV84?.();
      const section = document.getElementById("packageAccommodationSection");
      const container = document.getElementById("hotelSelectorsContainer");
      if (!section || !container) return result;
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      const hotel = selection?.hotel || this.getHotelByCode?.(destination, defaultHotelCode(this));
      const combo = selection?.combination || null;
      const upgradeTotal = this.calculateOvernightHotelUpgradeTotalV84?.() || 0;
      const image = hotel?.images?.cover || hotel?.images?.gallery?.[0] || "";
      section.hidden = false;
      section.classList.add("booking-field--hotel-upgrade-v84", "booking-field--hotel-upgrade-v85");
      container.innerHTML = `<div class="booking-accommodation-card booking-accommodation-card--selected booking-accommodation-card--overnight-v84 booking-accommodation-card--overnight-v85">
        ${image ? `<div class="booking-accommodation-card__thumb"><img src="${this.resolveAssetPath(image)}" alt="${esc(hotel?.hotelName || "Hotel seleccionado")}" loading="lazy" /></div>` : ""}
        <div class="booking-accommodation-card__header"><strong>Hotel seleccionado</strong><small>1 noche en Aguas Calientes</small></div>
        <div class="booking-accommodation-card__body">
          <p class="booking-accommodation-card__selected">${esc(hotel?.hotelName || "Hotel Luz Garden Machu Picchu")} ${hotel?.stars ? `· ${this.renderStars?.(hotel.stars) || `${hotel.stars}★`}` : ""}</p>
          <p class="booking-accommodation-card__selected">${esc(combo?.label || "Habitación según disponibilidad")}</p>
          <p class="booking-accommodation-card__price">${upgradeTotal > 0 ? `+ ${this.product.currency || "USD"} ${money(upgradeTotal)} total por upgrade` : "Hotel incluido en el precio"}</p>
          <button type="button" class="btn booking-secondary-btn open-hotel-modal-btn" data-destination="aguas-calientes"><i class="fas fa-hotel"></i> Upgrade de hotel</button>
        </div>
      </div>`;
      this.bindAccommodationEvents?.();
      return result;
    };

    const previousRenderProduct = proto.renderProduct;
    proto.renderProduct = function (product) {
      const result = previousRenderProduct?.apply(this, arguments);
      if (isOvernightClassic(this)) {
        this.ensureOvernightDefaultHotelV84?.();
        this.renderTrainSelectionOptions?.(this.product);
        this.renderAccommodationOptions?.(this.product);
        this.updatePricing?.();
      }
      return result;
    };

    const prevGetPrintItinerary = proto.getProductPrintItineraryItemsV83;
    proto.getProductPrintItineraryItemsV83 = function () {
      if (!isOvernightClassic(this)) return prevGetPrintItinerary?.apply(this, arguments) || [];
      const out = this.getSelectedOutboundTrain?.() || this.findTrainById?.(this.selectedOutboundTrainId, this.availableOutboundTrains) || null;
      const ret = this.getSelectedReturnTrain?.() || this.findTrainById?.(this.selectedReturnTrainId, this.availableReturnTrains) || null;
      const outDep = out?.departureTime || "16:36";
      const outArr = out?.arrivalTime || "18:01";
      const retDep = ret?.departureTime || "20:20";
      const retArr = ret?.arrivalTime || "21:59";
      const day1 = this.t("product.print.dayLabel", "Día {n}", { n: 1 });
      const day2 = this.t("product.print.dayLabel", "Día {n}", { n: 2 });
      const approx = this.t("product.print.approx", "aprox.");
      return [
        { time: `${day1} · 01:30 p.m. ${approx}`, title: this.t("product.itin.ovPickupCuscoTitle", "Recojo en Cusco y traslado a Ollantaytambo"), description: this.t("product.itin.ovPickupCuscoDesc", "Recojo desde tu hotel o punto coordinado en Cusco y traslado hacia la estación de tren de Ollantaytambo.") },
        { time: `${day1} · 03:30 p.m. ${approx}`, title: this.t("product.itin.ovArrivalOllantaTitle", "Llegada a Ollantaytambo"), description: this.t("product.itin.ovArrivalOllantaDesc", "Llegada referencial a la estación para realizar el registro y abordar el tren turístico.") },
        { time: `${day1} · ${outDep} ${approx}`, title: this.t("product.itin.ovTrainToAguasTitle", "Viaje en tren a Aguas Calientes"), description: this.t("product.itin.ovTrainToAguasDesc", "Salida en tren turístico hacia Machu Picchu Pueblo/Aguas Calientes según el tren seleccionado.") },
        { time: `${day1} · ${outArr} ${approx}`, title: this.t("product.itin.ovArrivalAguasHotelTitle", "Llegada a Aguas Calientes y traslado al hotel"), description: this.t("product.itin.ovArrivalAguasHotelDesc", "Llegada a Machu Picchu Pueblo y asistencia hacia el hotel seleccionado para realizar el check-in.") },
        { time: `${day1} · ${this.t("product.print.nightLabel", "Noche")}`, title: this.t("product.itin.ovNightTitle", "Noche en Aguas Calientes"), description: this.t("product.itin.ovNightDesc", "Noche libre en Aguas Calientes para descansar antes de la visita a Machu Picchu del día siguiente.") },
        { time: `${day2} · 09:00 a.m. ${approx}`, title: this.t("product.itin.ovMeetingPlazaTitle", "Encuentro en la Plaza de Armas de Aguas Calientes"), description: this.t("product.itin.ovMeetingPlazaDesc", "Reunión con el guía para iniciar la coordinación del tour guiado a Machu Picchu.") },
        { time: `${day2} · 09:30 a.m. ${approx}`, title: this.t("product.itin.ovBusQueueTitle", "Fila y bus Consettur hacia Machu Picchu"), description: this.t("product.itin.ovBusQueueDesc", "Abordaje del bus turístico de subida hasta la puerta de ingreso al Centro Arqueológico de Machu Picchu.") },
        { time: `${day2} · 10:00 a.m. ${approx}`, title: this.t("product.itin.guidedTourTitle", "Tour guiado en Machu Picchu"), description: this.t("product.itin.ovGuidedTourGenericDesc", "Recorrido guiado por Machu Picchu. El circuito se confirma según disponibilidad oficial de boletos.") },
        { time: `${day2} · 01:00 p.m. ${approx}`, title: this.t("product.itin.tourEndTitleShort", "Fin del tour guiado y tiempo para almorzar"), description: this.t("product.itin.ovLunchOptionalDesc", "Finaliza la visita guiada. Puedes agregar almuerzo opcional en Tinkuy/Belmond Sanctuary Lodge o almorzar por tu cuenta.") },
        { time: `${day2} · 03:00 p.m. ${approx}`, title: this.t("product.itin.busDownTitle", "Bus de bajada hacia Aguas Calientes"), description: this.t("product.itin.ovBusDownReturnDesc", "Retorno en bus Consettur hacia Machu Picchu Pueblo. Tendrás tiempo libre hasta la hora del tren.") },
        { time: `${day2} · 07:50 p.m. ${approx}`, title: this.t("product.itin.ovBoardingReturnTitle", "Embarque para el tren de retorno"), description: this.t("product.itin.ovBoardingReturnDesc", "Presentación en la estación de tren de Aguas Calientes para abordar el tren de retorno seleccionado.") },
        { time: `${day2} · ${retDep} ${approx}`, title: this.t("booking.train.return", "Tren de retorno"), description: this.t("product.itin.ovReturnTrainDepartureDesc", "Salida en tren turístico de retorno según la selección disponible.") },
        { time: `${day2} · ${retArr} ${approx}`, title: this.t("product.itin.ovTransferBusTitle", "Llegada y transbordo hacia bus turístico"), description: this.t("product.itin.ovTransferBusDesc", "Transbordo operativo desde tren hacia bus turístico para continuar el viaje hacia la ciudad de Cusco.") },
        { time: `${day2} · 11:45 p.m. ${approx}`, title: this.t("product.itin.arrivalCuscoEndTitleShort", "Llegada a Cusco y fin de servicios"), description: this.t("product.itin.arrivalCuscoEndReferentialDesc", "Llegada referencial a la ciudad de Cusco. El desembarque se realiza cerca de la Plaza de Armas o punto coordinado.") }
      ];
    };

    proto.renderOvernightHotelPrintSectionV85 = function () {
      if (!isOvernightClassic(this)) return "";
      const selection = this.getSelectedAccommodationForDestination?.("aguas-calientes");
      const hotel = selection?.hotel || this.getHotelByCode?.("aguas-calientes", defaultHotelCode(this));
      if (!hotel) return "";
      const combo = selection?.combination || null;
      const images = [...new Set([...(hotel.images?.cover ? [hotel.images.cover] : []), ...(Array.isArray(hotel.images?.gallery) ? hotel.images.gallery : [])])].slice(0, 3);
      const upgrade = this.calculateOvernightHotelUpgradeTotalV84?.() || 0;
      const currency = this.product?.currency || "USD";
      return `<section class="print-section print-section--hotel-v85"><h2>${this.t("booking.hotelSelectedFallback", "Hotel seleccionado")}</h2>
        <div class="print-hotel-summary-v85"><div><strong>${esc(hotel.hotelName || this.t("booking.hotelSelectedFallback", "Hotel seleccionado"))}</strong><small>${hotel.stars ? `${hotel.stars} ${this.t("product.starsWord", "estrellas")} · ` : ""}${this.t("product.oneNightAguasCalientes", "1 noche en Aguas Calientes")}</small><small>${esc(combo?.label || this.t("product.selectRoomAvailability", "Habitación según disponibilidad"))}</small></div><b>${upgrade > 0 ? this.t("product.upgradePlusAmount", "Upgrade + {amount}", { amount: `${currency} ${money(upgrade)}` }) : this.t("product.includedInPrice", "Incluido en el precio")}</b></div>
        ${images.length ? `<div class="print-hotel-gallery-v85">${images.map((src, i) => `<figure><img src="${this.resolveAssetPath(src)}" alt="${esc((hotel.hotelName || "Hotel") + " " + (i + 1))}" /></figure>`).join("")}</div>` : ""}
      </section>`;
    };

    const previousPrint = proto.printProductItineraryV78;
    if (typeof previousPrint === "function") {
      proto.printProductItineraryV78 = function () {
        const result = previousPrint.apply(this, arguments);
        if (isOvernightClassic(this)) {
          const area = document.getElementById("productPrintArea");
          const trains = area?.querySelector(".print-section--trains");
          if (trains && !area.querySelector(".print-section--hotel-v85")) {
            trains.insertAdjacentHTML("afterend", this.renderOvernightHotelPrintSectionV85?.() || "");
          }
        }
        return result;
      };
    }

    page.__mctV85Applied = true;
    try {
      if (isOvernightClassic(page)) {
        page.ensureOvernightDefaultHotelV84?.();
        page.renderTrainSelectionOptions?.(page.product);
        page.renderAccommodationOptions?.(page.product);
        page.updatePricing?.();
      }
    } catch (error) { console.warn("MCT V85 post-apply warning:", error); }
    return true;
  }
  if (!patchV85()) {
    document.addEventListener("DOMContentLoaded", patchV85);
    setTimeout(patchV85, 250);
    setTimeout(patchV85, 900);
    setTimeout(patchV85, 1600);
  }
})();

/* =========================================================
   PATCH MCT V86 - Overnight clásico: upgrade trenes visible + itinerario timeline
   ========================================================= */
(function () {
  function patchV86() {
    const page = window.MyCuscoTripProductPage;
    if (!page) return false;
    if (page.__mctV86Applied) return true;
    const proto = Object.getPrototypeOf(page) || page;

    const esc = (value) => typeof page.escapeHtml === "function" ? page.escapeHtml(value) : String(value ?? "").replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
    const money = (value) => typeof page.formatMoney === "function" ? page.formatMoney(Number(value || 0)) : Number(value || 0).toFixed(2);
    const slugOf = (ctx) => String(ctx?.product?.slug || ctx?.slug || "").trim();
    const isOvernightClassic = (ctx) => slugOf(ctx) === "machu-picchu-overnight-clasico";
    const paxCount = (ctx) => Math.max(1, Number(ctx?.adults || 0) + Number(ctx?.children || 0));
    const defaultHotelCode = (ctx) => String(ctx?.product?.accommodationSelection?.defaultHotelCode || ctx?.product?.internalPricing?.defaultHotelCode || "luz-garden-3s");
    const OUTBOUND_DEFAULT = "INCA_OLLA_MAPI_VOYAGER_1636_OLLANTAYTAMB";
    const RETURN_DEFAULT = "INCA_MAPI_CUSCO_VOYAGER_2020_MACHU_PICCHU";

    function forcedTrainConfig(ctx, product) {
      const original = product?.trainSelection || product?.raw?.trainSelection || {};
      return {
        ...original,
        required: true,
        customerCanChangeTrain: true,
        fixedSelection: false,
        sameCompanyRoundTrip: false,
        allowMixedCompanies: true,
        mode: "overnight_flexible_any_company",
        defaultTrainCodes: {
          ...(original.defaultTrainCodes || {}),
          outbound: OUTBOUND_DEFAULT,
          return: RETURN_DEFAULT
        },
        allowedCompanies: ["incarail", "perurail"],
        allowedRoutes: {
          outbound: ["OLLA_MAPI", "CUSCO_MAPI", "URU_MAPI", "HIDRO_MAPI"],
          return: ["MAPI_CUSCO", "MAPI_OLLA", "MAPI_URU", "MAPI_HIDRO"]
        },
        allowedCategories: "all_available",
        timeWindows: {
          outbound: { min: "05:00", max: "22:00" },
          return: { min: "15:00", max: "22:00" }
        },
        returnOptionsRule: "any_company_afternoon_return",
        priceAdjustmentRule: "selected_train_total_cost_minus_default_train_total_cost"
      };
    }

    const previousIsTrainSelectionEnabled = proto.isTrainSelectionEnabled;
    proto.isTrainSelectionEnabled = function (product) {
      if (isOvernightClassic({ product: product || this.product, slug: this.slug })) return true;
      return previousIsTrainSelectionEnabled?.apply(this, arguments) ?? false;
    };

    const previousGetTrainConfig = proto.getTrainConfig;
    proto.getTrainConfig = function (product) {
      const resolvedProduct = product || this.product;
      if (isOvernightClassic({ product: resolvedProduct, slug: this.slug })) return forcedTrainConfig(this, resolvedProduct);
      return previousGetTrainConfig?.apply(this, arguments) || {};
    };

    const previousGetDefaultTrainSelection = proto.getDefaultTrainSelection;
    proto.getDefaultTrainSelection = function (product) {
      const resolvedProduct = product || this.product;
      if (isOvernightClassic({ product: resolvedProduct, slug: this.slug })) {
        return { outboundTrainId: OUTBOUND_DEFAULT, returnTrainId: RETURN_DEFAULT };
      }
      return previousGetDefaultTrainSelection?.apply(this, arguments) || { outboundTrainId: "", returnTrainId: "" };
    };

    proto.ensureOvernightTrainSectionV86 = function () {
      if (!isOvernightClassic(this)) return;
      const section = document.getElementById("trainSelectionSection");
      const container = document.getElementById("trainSelectionContainer");
      if (!section || !container) return;

      const catalog = this.getTrainCatalog?.() || [];
      const defaultSelection = this.getDefaultTrainSelection?.(this.product) || { outboundTrainId: OUTBOUND_DEFAULT, returnTrainId: RETURN_DEFAULT };
      const previousSelectedOut = this.selectedOutboundTrainId;
      const previousSelectedRet = this.selectedReturnTrainId;

      this.availableOutboundTrains = this.getDirectionalTrains?.(catalog, "outbound", defaultSelection.outboundTrainId) || [];
      this.availableReturnTrains = this.getDirectionalTrains?.(catalog, "return", defaultSelection.returnTrainId) || [];

      if (typeof this.isCommercialTrainForFullDay === "function") {
        this.availableOutboundTrains = this.availableOutboundTrains.filter((train) => this.isCommercialTrainForFullDay(train));
        this.availableReturnTrains = this.availableReturnTrains.filter((train) => this.isCommercialTrainForFullDay(train));
      }

      const fallbackOutbound = this.createFallbackTrainOption?.(defaultSelection.outboundTrainId, "The Voyager 16:36") || null;
      const fallbackReturn = this.createFallbackTrainOption?.(defaultSelection.returnTrainId, "The Voyager 20:20") || null;
      if (!this.availableOutboundTrains.length && fallbackOutbound) this.availableOutboundTrains = [fallbackOutbound];
      if (!this.availableReturnTrains.length && fallbackReturn) this.availableReturnTrains = [fallbackReturn];
      if (!this.availableOutboundTrains.length && !this.availableReturnTrains.length) return;

      this.trainUpgradeSameCompanyOnly = false;
      this.selectedOutboundTrainId = this.availableOutboundTrains.some((train) => train.id === previousSelectedOut) ? previousSelectedOut : (defaultSelection.outboundTrainId || this.availableOutboundTrains[0]?.id || "");
      this.selectedReturnTrainId = this.availableReturnTrains.some((train) => train.id === previousSelectedRet) ? previousSelectedRet : (defaultSelection.returnTrainId || this.availableReturnTrains[0]?.id || "");

      section.hidden = false;
      section.classList.add("booking-field--train-upgrade", "booking-field--train-upgrade-overnight-v86");
      const label = document.getElementById("trainSelectionLabel");
      const help = document.getElementById("trainSelectionHelp");
      if (label) label.hidden = true;
      if (help) help.textContent = "";
      if (!container.querySelector("#openTrainUpgradeModal")) {
        container.innerHTML = `
          <div class="booking-train-upgrade" data-train-selection>
            <div class="booking-train-upgrade__summary" id="trainUpgradeSummaryCards"></div>
            <button class="btn booking-secondary-btn booking-train-upgrade__button" id="openTrainUpgradeModal" type="button">
              <i class="fas fa-train"></i> Upgrade de trenes
            </button>
            <div id="trainSelectionSummary" class="booking-train-selection__summary"></div>
          </div>
        `;
      }
      this.ensureTrainUpgradeModal?.();
      this.bindTrainUpgradeEvents?.();
      this.updateTrainSelectionState?.(false);
      this.updateTrainAdjustmentSummaryRow?.(this.calculateSelectedTrainAdjustmentTotal?.() || 0, this.product?.currency || "USD");
    };

    const previousRenderTrainSelection = proto.renderTrainSelectionOptions;
    proto.renderTrainSelectionOptions = function (product) {
      const resolvedProduct = product || this.product;
      if (!isOvernightClassic({ product: resolvedProduct, slug: this.slug })) {
        return previousRenderTrainSelection?.apply(this, arguments);
      }
      const result = previousRenderTrainSelection?.call(this, resolvedProduct);
      this.ensureOvernightTrainSectionV86?.();
      return result;
    };

    function splitOvernightTime(value, fallbackDay) {
      const text = String(value || "").trim();
      const match = text.match(/D[ií]a\s*(\d+)\s*·\s*(.+)$/i);
      const day = Number(match?.[1] || fallbackDay || 1);
      let time = (match?.[2] || text || "").trim();
      time = time.replace(/\baprox\.?/i, "").trim();
      const approx = /aprox/i.test(text) ? "aprox." : "";
      return { day, time, approx };
    }

    proto.renderOvernightItineraryTimelineV86 = function (items) {
      const target = document.getElementById("productItinerary");
      if (!target || !isOvernightClassic(this)) return false;
      const list = Array.isArray(items) && items.length ? items : (this.product?.itinerary || []);
      if (!list.length) return false;
      const groups = new Map();
      list.forEach((item, index) => {
        const parsed = splitOvernightTime(item.time || item.hour || "", item.day || (index < 5 ? 1 : 2));
        if (!groups.has(parsed.day)) groups.set(parsed.day, []);
        groups.get(parsed.day).push({ ...item, __time: parsed.time, __approx: parsed.approx });
      });
      target.innerHTML = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([day, dayItems]) => {
        const dateLabel = this.getItineraryDateLabel?.(day) || "";
        return `<div class="experience-itinerary-item experience-itinerary-item--day experience-itinerary-item--overnight-v86" data-itinerary-day="${esc(day)}">
          <div class="experience-itinerary-item__content">
            <div class="experience-itinerary-day-meta">
              <span class="experience-itinerary-day-pill">Día ${esc(day)}</span>
              <span class="experience-itinerary-date-pill" data-itinerary-date-for="${esc(day)}" ${dateLabel ? "" : "hidden"}>${esc(dateLabel)}</span>
            </div>
            <h3 class="experience-itinerary-day-title">${this.t("product.fullDayItinerary", "Itinerario detallado del día")}</h3>
            <div class="experience-itinerary-timeline experience-itinerary-timeline--overnight-v86">
              ${dayItems.map((item, index) => `<article class="experience-itinerary-activity experience-itinerary-activity--overnight-v86">
                <span class="experience-itinerary-time-pill experience-itinerary-time-pill--overnight-v86"><strong>${esc(item.__time || this.t("product.print.stepFallback", "Paso {n}", { n: index + 1 }))}</strong>${item.__approx ? `<small>${esc(item.__approx)}</small>` : ""}</span>
                <div class="experience-itinerary-activity__copy"><strong>${esc(item.title || this.t("product.print.activityFallback", "Actividad {n}", { n: index + 1 }))}</strong>${item.description ? `<p>${esc(item.description)}</p>` : ""}</div>
              </article>`).join("")}
            </div>
          </div>
        </div>`;
      }).join("");
      return true;
    };

    const previousRenderItinerary = proto.renderItinerary;
    proto.renderItinerary = function (items) {
      if (isOvernightClassic(this) && this.renderOvernightItineraryTimelineV86?.(items)) return;
      return previousRenderItinerary?.apply(this, arguments);
    };

    const hotelCreditTotal = (ctx) => {
      const pax = paxCount(ctx);
      const internal = ctx.product?.internalPricing || {};
      const single = Number(internal.defaultHotelCostUSD || ctx.product?.accommodationSelection?.defaultHotelCostUSD || 45);
      const shared = Number(internal.defaultHotelCostPerPersonIfSharedUSD || 22.5);
      return pax <= 1 ? single : (pax === 2 ? single : shared * pax);
    };
    const comboUpgradeTotal = (ctx, hotelCode, combo) => {
      if (!combo || !hotelCode || hotelCode === "no-hotel" || hotelCode === defaultHotelCode(ctx)) return 0;
      return Math.max(0, Number(combo.totalForStay || 0) - hotelCreditTotal(ctx));
    };

    proto.calculateOvernightHotelUpgradeTotalV86 = function () {
      if (!isOvernightClassic(this)) return 0;
      const destination = "aguas-calientes";
      const selectedCode = this.selectedHotelsByDestination?.[destination] || defaultHotelCode(this);
      if (!selectedCode || selectedCode === defaultHotelCode(this) || selectedCode === "no-hotel") return 0;
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      return comboUpgradeTotal(this, selectedCode, selection?.combination);
    };
    proto.calculateOvernightHotelUpgradeTotalV84 = function () {
      return this.calculateOvernightHotelUpgradeTotalV86?.() || 0;
    };

    const previousOpenHotelModal = proto.openHotelModal;
    proto.openHotelModal = function (destination) {
      if (!isOvernightClassic(this) || String(destination) !== "aguas-calientes") {
        return previousOpenHotelModal?.apply(this, arguments);
      }
      const modal = document.getElementById("hotelSelectionModal");
      const title = document.getElementById("hotelModalTitle");
      const subtitle = document.getElementById("hotelModalSubtitle");
      const list = document.getElementById("hotelModalList");
      const cancelBtn = document.getElementById("cancelHotelModalBtn");
      if (!modal || !title || !subtitle || !list) return;
      this.activeHotelModalDestination = destination;
      if (cancelBtn) cancelBtn.textContent = this.t("product.selectHotelRoomBtn", "Seleccionar hotel y habitación");
      const passengers = paxCount(this);
      title.textContent = this.t("product.overnightHotelUpgradeTitle", "Upgrade de hotel en Aguas Calientes");
      subtitle.textContent = this.t("product.overnightIntroTextV86", "El Hotel Luz Garden está incluido. Puedes mantenerlo sin cargo o elegir un upgrade de hotel.");
      const hotels = (this.getHotelsByDestination?.(destination) || []).filter((hotel) => hotel?.hotelCode && hotel.hotelCode !== "no-hotel");
      const currentHotelCode = this.selectedHotelsByDestination?.[destination] || defaultHotelCode(this);
      const currentCombinationKey = this.selectedCombinationsByDestination?.[destination]?.key || "";
      list.innerHTML = hotels.map((hotel) => {
        const combinations = this.generateAccommodationCombinations?.(hotel.rooms || [], passengers, 1) || [];
        const isSelectedHotel = currentHotelCode === hotel.hotelCode;
        const initialCombo = combinations.find((combo) => isSelectedHotel && combo.key === currentCombinationKey) || combinations[0] || null;
        const images = [...new Set([...(hotel.images?.cover ? [hotel.images.cover] : []), ...(Array.isArray(hotel.images?.gallery) ? hotel.images.gallery : [])])];
        const hotelIncluded = hotel.hotelCode === defaultHotelCode(this);
        const upgrade = comboUpgradeTotal(this, hotel.hotelCode, initialCombo);
        const badge = hotelIncluded ? this.t("product.hotelIncludedInPrice", "Hotel incluido en el precio") : this.t("product.upgradePerPersonAmount", "+ {price} por persona", { price: `${this.product?.currency || "USD"} ${money(upgrade / passengers)}` });
        return `<article class="hotel-option-card ${isSelectedHotel ? "is-selected" : ""} hotel-option-card--overnight-v86" data-hotel-card="${esc(hotel.hotelCode)}" data-destination="${esc(destination)}" data-hotel-code="${esc(hotel.hotelCode)}" data-selected-combo-key="${esc(initialCombo?.key || "")}">
          <div class="hotel-option-card__header">
            <div><h3>${esc(hotel.hotelName || this.t("quote.hotelGeneric", "Hotel"))}</h3><p>${this.renderStars?.(hotel.stars || 0) || `${hotel.stars || 0}★`} · ${esc(hotel.location || "Aguas Calientes")}</p>${hotel.summary ? `<p>${esc(hotel.summary)}</p>` : ""}</div>
            <div class="hotel-option-card__badge ${hotelIncluded ? "hotel-option-card__badge--included" : ""}">${esc(badge)}</div>
          </div>
          <div class="hotel-option-card__content">
            <div class="hotel-option-card__media"><div class="hotel-option-card__gallery">${this.renderHotelModalGallery?.(images, hotel.hotelName || this.t("quote.hotelGeneric", "Hotel")) || ""}</div>${this.renderHotelFeatures?.(hotel) || ""}</div>
            <div class="hotel-option-card__body"><label>${this.escapeHtml(this.t("booking.selectRoomType", "Selecciona tipo de habitación"))}</label><div class="hotel-option-card__options">
              ${combinations.length ? combinations.map((combo) => {
                const comboUpgrade = comboUpgradeTotal(this, hotel.hotelCode, combo);
                const comboPerPerson = comboUpgrade / passengers;
                const roomWord = combo.totalRooms === 1 ? this.t("product.room", "habitación") : this.t("product.roomsPluralLower", "habitaciones");
                const sub = hotelIncluded
                  ? this.t("product.roomsIncludedInBasePrice", "{rooms} | Incluido en el precio base", { rooms: `${combo.totalRooms} ${roomWord}` })
                  : this.t("product.roomsUpgradeTotal", "{rooms} | Upgrade total + {price} · {pricePerPerson} por persona", { rooms: `${combo.totalRooms} ${roomWord}`, price: `${this.product?.currency || "USD"} ${money(comboUpgrade)}`, pricePerPerson: `${this.product?.currency || "USD"} ${money(comboPerPerson)}` });
                return `<button type="button" class="hotel-combo-btn ${isSelectedHotel && currentCombinationKey === combo.key ? "is-selected" : ""}" data-destination="${esc(destination)}" data-hotel-code="${esc(hotel.hotelCode)}" data-combo-key="${esc(combo.key)}"><span class="hotel-combo-radio" aria-hidden="true"></span><span class="hotel-combo-btn__main">${esc(combo.label)}</span><span class="hotel-combo-btn__sub">${esc(sub)}</span></button>`;
              }).join("") : `<p>${this.escapeHtml(this.t("product.noValidRoomsForTravelers", "No hay habitaciones válidas para {count} viajeros.", { count: passengers }))}</p>`}
            </div></div>
          </div>
        </article>`;
      }).join("");
      this.bindHotelModalSelectionEvents?.();
      this.bindHotelModalGalleryEvents?.();
      modal.hidden = false;
      document.body.classList.add("hotel-modal-open");
    };

    const previousRenderAccommodationOptions = proto.renderAccommodationOptions;
    proto.renderAccommodationOptions = function (product) {
      const result = previousRenderAccommodationOptions?.apply(this, arguments);
      if (!isOvernightClassic(this)) return result;
      const destination = "aguas-calientes";
      this.ensureOvernightDefaultHotelV84?.();
      const section = document.getElementById("packageAccommodationSection");
      const container = document.getElementById("hotelSelectorsContainer");
      if (!section || !container) return result;
      const selection = this.getSelectedAccommodationForDestination?.(destination);
      const hotel = selection?.hotel || this.getHotelByCode?.(destination, defaultHotelCode(this));
      const combo = selection?.combination || null;
      const upgradeTotal = this.calculateOvernightHotelUpgradeTotalV86?.() || 0;
      const image = hotel?.images?.cover || hotel?.images?.gallery?.[0] || "";
      section.hidden = false;
      section.classList.add("booking-field--hotel-upgrade-v86");
      container.innerHTML = `<div class="booking-accommodation-card booking-accommodation-card--selected booking-accommodation-card--overnight-v86">
        ${image ? `<div class="booking-accommodation-card__thumb"><img src="${this.resolveAssetPath?.(image) || image}" alt="${esc(hotel?.hotelName || this.t("booking.hotelSelectedFallback", "Hotel seleccionado"))}" loading="lazy" /></div>` : ""}
        <div class="booking-accommodation-card__header"><strong>${this.escapeHtml(this.t("booking.hotelSelectedFallback", "Hotel seleccionado"))}</strong><small>${this.escapeHtml(this.t("product.oneNightAguasCalientes", "1 noche en Aguas Calientes"))}</small></div>
        <div class="booking-accommodation-card__body"><p class="booking-accommodation-card__selected">${esc(hotel?.hotelName || this.t("product.hotelLuzGardenFallback", "Hotel Luz Garden"))} ${hotel?.stars ? `· ${this.renderStars?.(hotel.stars) || `${hotel.stars}★`}` : ""}</p><p class="booking-accommodation-card__selected">${esc(combo?.label || this.t("product.selectRoomAvailability", "Habitación según disponibilidad"))}</p><p class="booking-accommodation-card__price">${upgradeTotal > 0 ? this.t("product.upgradeTotalAmount", "+ {price} total por upgrade", { price: `${this.product?.currency || "USD"} ${money(upgradeTotal)}` }) : this.t("product.hotelIncludedInPrice", "Hotel incluido en el precio")}</p><button type="button" class="btn booking-secondary-btn open-hotel-modal-btn" data-destination="aguas-calientes"><i class="fas fa-hotel"></i> ${this.t("product.hotelUpgradeButton", "Upgrade de hotel")}</button></div>
      </div>`;
      this.bindAccommodationEvents?.();
      return result;
    };

    const previousRenderProduct = proto.renderProduct;
    proto.renderProduct = function (product) {
      const result = previousRenderProduct?.apply(this, arguments);
      if (isOvernightClassic(this)) {
        this.renderOvernightItineraryTimelineV86?.(this.product?.itinerary || []);
        this.ensureOvernightTrainSectionV86?.();
        this.renderAccommodationOptions?.(this.product);
        this.updatePricing?.();
      }
      return result;
    };

    const kick = () => {
      try {
        if (isOvernightClassic(page)) {
          page.renderOvernightItineraryTimelineV86?.(page.product?.itinerary || []);
          page.ensureOvernightTrainSectionV86?.();
          page.renderAccommodationOptions?.(page.product);
          page.updatePricing?.();
        }
      } catch (error) { console.warn("MCT V86 post-apply warning:", error); }
    };

    page.__mctV86Applied = true;
    kick();
    [250, 700, 1400, 2400].forEach((delay) => setTimeout(kick, delay));
    return true;
  }
  if (!patchV86()) {
    document.addEventListener("DOMContentLoaded", patchV86);
    setTimeout(patchV86, 250);
    setTimeout(patchV86, 900);
    setTimeout(patchV86, 1600);
  }
})();
