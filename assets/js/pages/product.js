"use strict";

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
          .replace(/^(es|spa)$/i, "Spanish")
          .replace(/^(en|eng)$/i, "English")
          .replace(/espa[nñ]ol/gi, "Spanish")
          .replace(/ingl[eé]s/gi, "English")
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

    this.setText("detailCapacity", this.t("product.maxTravelers", this.label("Máximo {count} viajeros por grupo", "Maximum {count} travelers per group"), { count: capacity }));
    this.setText("detailDuration", duration);
    this.setText("detailLanguages", this.t("product.guideIn", this.label("Guía profesional: {languages}", "Professional guide: {languages}"), { languages }));
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
      flatpickr(dateInput, {
        locale: flatpickr.l10ns.es,
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
    const sideImages = finalImages.slice(1);
    const mobileImages = finalImages;

    gallery.innerHTML = `
      <div class="experience-gallery__main">
        <img src="${mainImage}" alt="${this.escapeHtml(this.product?.title || "Experiencia")}" loading="eager" />
      </div>

      ${sideImages.length ? `
        <div class="experience-gallery__side experience-gallery__slider" data-gallery-slider data-current-slide="0">
          ${sideImages.map((src, index) => `
            <img
              class="experience-gallery__slide ${index === 0 ? "is-active" : ""}"
              src="${src}"
              alt="Galería ${index + 2}"
              loading="lazy"
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

    return date.toLocaleDateString("es-PE", {
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

    const fallbackOutbound = this.createFallbackTrainOption(defaultSelection.outboundTrainId, this.label("Tren de ida incluido", "Included outbound train"));
    const fallbackReturn = this.createFallbackTrainOption(defaultSelection.returnTrainId, this.label("Tren de retorno incluido", "Included return train"));

    if (!this.availableOutboundTrains.length && fallbackOutbound) this.availableOutboundTrains = [fallbackOutbound];
    if (!this.availableReturnTrains.length && fallbackReturn) this.availableReturnTrains = [fallbackReturn];
    if (!this.availableOutboundTrains.length && !this.availableReturnTrains.length) return;

    this.selectedOutboundTrainId = defaultSelection.outboundTrainId || this.availableOutboundTrains[0]?.id || "";
    this.selectedReturnTrainId = defaultSelection.returnTrainId || this.getCompatibleReturnTrains(sameCompanyOnly)[0]?.id || this.availableReturnTrains[0]?.id || "";

    section.hidden = false;
    container.innerHTML = `
      <div class="booking-train-selection" data-train-selection>
        <div class="booking-train-selection__intro">
          <strong>${this.escapeHtml(this.t("product.touristTrain", this.label("Tren turístico", "Tourist train")))}</strong>
          <small>${this.escapeHtml(this.getTrainSelectionIntro(product, trainConfig))}</small>
        </div>
        ${this.availableOutboundTrains.length ? `
          <label class="booking-train-select-field" for="outboundTrainSelect">
            <span>${this.escapeHtml(this.label("Tren de ida", "Outbound train"))}</span>
            <select id="outboundTrainSelect" data-train-direction="outbound" ${this.isTrainDirectionLocked("outbound", trainConfig) ? "disabled" : ""}>
              ${this.availableOutboundTrains.map((train) => this.renderTrainOption(train, this.selectedOutboundTrainId)).join("")}
            </select>
            ${this.isTrainDirectionLocked("outbound", trainConfig) ? `<small class="booking-field-help">${this.escapeHtml(this.label("Tren de ida fijo para esta versión.", "Outbound train fixed for this version."))}</small>` : ""}
          </label>
        ` : ""}
        ${this.availableReturnTrains.length ? `
          <label class="booking-train-select-field" for="returnTrainSelect">
            <span>${this.escapeHtml(this.label("Tren de retorno", "Return train"))}</span>
            <select id="returnTrainSelect" data-train-direction="return" ${this.isTrainDirectionLocked("return", trainConfig) ? "disabled" : ""}>
              ${this.getCompatibleReturnTrains(sameCompanyOnly).map((train) => this.renderTrainOption(train, this.selectedReturnTrainId)).join("")}
            </select>
            ${this.isTrainDirectionLocked("return", trainConfig) ? `<small class="booking-field-help">${this.escapeHtml(this.label("Tren de retorno fijo para esta versión.", "Return train fixed for this version."))}</small>` : ""}
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
    section.innerHTML = `<label>${this.escapeHtml(this.t("product.touristTrain", this.label("Tren turístico", "Tourist train")))}</label><div id="trainSelectionContainer" class="booking-train-selection-wrap"></div>`;
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
    if (config?.fixedSelection === true) return this.label("Esta versión ya tiene trenes definidos para mantener el horario operativo.", "This version already has defined trains to maintain the operating schedule.");
    if (config?.fixedDirection === "outbound" || config?.fixedDirections?.includes?.("outbound")) return this.label("El tren de ida está definido por la categoría del producto. Puedes elegir el retorno disponible según la operación.", "The outbound train is defined by the product category. You can choose the available return according to the operation.");
    return this.label("Elige los servicios de tren disponibles para esta versión. La diferencia de precio se calculará según el tren seleccionado.", "Choose the train services available for this version. The price difference will be calculated according to the selected train.");
  }

  createFallbackTrainOption(id, label) {
    if (!id) return null;
    return { id, company: "", label, direction: "", route: "", departureTime: "", arrivalTime: "", price: 0, raw: {} };
  }

  renderTrainOption(train, selectedId) {
    const selected = train.id === selectedId ? " selected" : "";
    const meta = [train.company, train.departureTime, train.arrivalTime ? `${this.label("llega", "arrives")} ${train.arrivalTime}` : ""].filter(Boolean).join(" · ");
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
    const companyNote = sameCompanyOnly ? this.label("Los trenes de ida y retorno se mantienen con la misma compañía cuando hay disponibilidad.", "Outbound and return trains stay with the same company when available.") : "";
    const adjustmentText = this.selectedTrainAdjustmentTotal > 0
      ? `${this.label("Diferencia total", "Total difference")}: ${this.product?.currency || "USD"} ${this.formatMoney(this.selectedTrainAdjustmentTotal)}`
      : this.label("Sin diferencia adicional frente al tren incluido.", "No additional difference from the included train.");
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
      row.innerHTML = `<span>${this.escapeHtml(this.label("Tren seleccionado", "Selected train"))}</span><strong id="trainAdjustmentTotal">${this.escapeHtml(currency)} 0.00</strong>`;
      summary.insertBefore(row, serviceTotalRow);
    }
    row.hidden = !(amount > 0);
    const value = document.getElementById("trainAdjustmentTotal");
    if (value) value.textContent = `${currency} ${this.formatMoney(amount)}`;
  }

  getSelectedTrainSummaryLabel() {
    const outbound = this.getSelectedOutboundTrain();
    const returning = this.getSelectedReturnTrain();
    if (!outbound && !returning) return this.label("No aplica", "Not applicable");
    const parts = [];
    if (outbound) parts.push(`${this.label("Ida", "Outbound")}: ${outbound.label}`);
    if (returning) parts.push(`${this.label("Retorno", "Return")}: ${returning.label}`);
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
      ${groupEnabled ? `<option value="group">${this.escapeHtml(modes.group?.label || "Tour en grupo")}</option>` : ""}
      ${privateEnabled ? `<option value="private">${this.escapeHtml(modes.private?.label || "Tour privado")}</option>` : ""}
    `;

    this.serviceMode = groupEnabled ? "group" : "private";

    if (help) {
      help.textContent = privateEnabled
        ? "Selecciona si deseas viajar en servicio compartido o privado."
        : "Esta experiencia se ofrece actualmente en servicio grupal.";
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
          <button type="button" class="hotel-gallery-nav hotel-gallery-prev" aria-label="Imagen anterior">‹</button>
          <button type="button" class="hotel-gallery-nav hotel-gallery-next" aria-label="Imagen siguiente">›</button>
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
    this.currentPreReservation = preReservation;

    this.setText("passengerReservationCode", preReservation.code);
    this.setText("passengerReservationTimestamp", this.t("product.bookingGenerated", "Reservation generated: {date}", { date: preReservation.createdAtDisplayLabel }));
    this.renderPassengerPaymentSnapshot(preReservation);
    this.bindPassengerReservationModalEvents();
    this.syncPassengerHolderState();
    this.renderAdditionalPassengerFields();
    this.populateCountrySelects();
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

    document.getElementById("passengerReservationForm")?.addEventListener("submit", (event) => {
      this.handlePassengerReservationSubmit(event);
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

    return `<option value="">Selecciona país</option>${countries.map((country) => `<option value="${this.escapeHtml(country)}">${this.escapeHtml(country)}</option>`).join("")}`;
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
      container.innerHTML = `<p class="passenger-modal__note">No hay pasajeros adicionales según la cantidad seleccionada.</p>`;
      return;
    }

    container.innerHTML = Array.from({ length: additionalCount }, (_, index) => {
      const passengerNumber = startNumber + index;
      return `
        <details class="passenger-modal__optional-passenger" open>
          <summary>Pasajero ${passengerNumber} <span>Datos del turista</span></summary>
          <label class="passenger-modal__check passenger-modal__check--later">
            <input type="checkbox" name="passenger_${passengerNumber}_complete_later" data-passenger-later="${passengerNumber}" />
            <span>Ingresaré los datos de este pasajero más adelante.</span>
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
                <option value="id_card">Documento de identidad</option>
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
        whatsapp: holder.whatsapp,
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
      } catch (storageError) {}

      if (paypalResult?.approvalUrl) {
        window.location.assign(paypalResult.approvalUrl);
        return;
      }

      throw new Error(paypalResult?.message || paypalResult?.error || "PayPal no devolvió enlace de pago.");
    } catch (error) {
      console.error("No se pudo guardar la pre-reserva:", error);
      if (message) {
        const backendMessage = error?.body?.error || error?.body?.message || error?.message || "No se pudo registrar la reserva. Revisa la conexión o la configuración del backend.";
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
      label: room.label || room.roomType || "Habitación",
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
