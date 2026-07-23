class MyCuscoTripSearchBar {
  constructor() {
    this.root = document.querySelector(".search-bar.mct-search");
    if (!this.root) return;

    // Evita doble inicialización cuando el componente se carga por HTML + JS global.
    if (this.root.dataset.mctSearchInitialized === "true") return;
    this.root.dataset.mctSearchInitialized = "true";

    this.form = this.root.querySelector("#mctForm");
    this.tabs = this.root.querySelectorAll(".mct-tab");
    this.intentSelect = this.root.querySelector("#mctIntent");
    this.intentLabel = this.root.querySelector("#mctIntentLabel");
    this.submitText = this.root.querySelector("#mctSubmitText");
    this.dateInput = this.root.querySelector("#mctFecha");
    this.dateField = this.root.querySelector(".mct-fecha-field");
    this.durationEl = this.root.querySelector("#mctDuration");

    this.qtyToggle = this.root.querySelector(".mct-qty-toggle");
    this.qtyPanel = this.root.querySelector(".mct-qty-panel");
    this.qtyDone = this.root.querySelector(".mct-qty-done");
    this.qtyLabel = this.root.querySelector("#mctQtyLabel");

    this.adults = 2;
    this.children = 0;
    this.currentTab = "tours";
    this.flatpickrInstance = null;
    this.currentCalendarMode = "single";
    this.DAY = 24 * 60 * 60 * 1000;

    this.selectedDate = "";
    this.selectedStartDate = "";
    this.selectedEndDate = "";
    this.selectedDays = "";
    this.selectedNights = "";

    this.options = {
      tours: [
        {
          value: "machu-picchu-full-day-clasico",
          labelKey: "search.tourMachuPicchuClassic",
          fallback: "Machu Picchu Full Day Clásico",
          url: "./product.html?slug=machu-picchu-full-day-clasico"
        },
        {
          value: "machu-picchu-full-day-express",
          labelKey: "search.tourFullDayExpress",
          fallback: "Machu Picchu Full Day Express",
          url: "./product.html?slug=machu-picchu-full-day-express"
        },
        {
          value: "machu-picchu-overnight-clasico",
          labelKey: "search.tourOvernight",
          fallback: "Machu Picchu Overnight 2D/1N",
          url: "./product.html?slug=machu-picchu-overnight-clasico"
        },
        {
          value: "machu-picchu-panoramico-vistadome",
          labelKey: "search.tourPanoramic",
          fallback: "Machu Picchu Panorámico",
          url: "./product.html?slug=machu-picchu-panoramico-vistadome"
        },
        {
          value: "machu-picchu-luxury-hiram-bingham",
          labelKey: "search.tourHiramBingham",
          fallback: "Machu Picchu Luxury Hiram Bingham",
          url: "./product.html?slug=machu-picchu-luxury-hiram-bingham"
        },
        {
          value: "bienvenida-ancestral-cusco",
          labelKey: "search.tourAncestralWelcomeShort",
          fallback: "Bienvenida a Cusco",
          url: "./product.html?slug=bienvenida-ancestral-cusco"
        },
        {
          value: "todos-tours-machu-picchu",
          labelKey: "search.allMachuPicchuTours",
          fallback: "Todos los tours de Machu Picchu",
          url: "./all-experiences.html?destino=machu-picchu&tipo=tour"
        },
        {
          value: "todos-tours-cusco",
          labelKey: "search.allCuscoTours",
          fallback: "Todos los tours de Cusco",
          url: "./all-experiences.html?destino=cusco&tipo=tour"
        }
      ],
      paquetes: [
        {
          value: "machu-picchu-2d1n",
          labelKey: "search.packageMachuPicchu2d1n",
          fallback: "Machu Picchu 2 días / 1 noche",
          quoteIntent: "machu-picchu-2d1n",
          days: 2,
          nights: 1,
          dateMode: "single-fixed"
        },
        {
          value: "cusco-machu-picchu-3d2n",
          labelKey: "search.packageCuscoMachuPicchu3d2n",
          fallback: "Cusco Machu Picchu 3 días / 2 noches",
          quoteIntent: "cusco-machu-picchu-3d2n",
          days: 3,
          nights: 2,
          dateMode: "single-fixed"
        },
        {
          value: "cusco-valle-machu-picchu-4d3n",
          labelKey: "search.packageCuscoValleMachuPicchu4d3n",
          fallback: "Cusco Valle Machu Picchu 4 días / 3 noches",
          quoteIntent: "cusco-valle-machu-picchu-4d3n",
          days: 4,
          nights: 3,
          dateMode: "single-fixed"
        },
        {
          value: "cusco-valle-machu-picchu-5d4n",
          labelKey: "search.packageCuscoValleMachuPicchu5d4n",
          fallback: "Cusco Valle Machu Picchu 5 días / 4 noches",
          quoteIntent: "cusco-valle-machu-picchu-5d4n",
          days: 5,
          nights: 4,
          dateMode: "single-fixed"
        },
        {
          value: "cusco-valle-machu-picchu-6d5n",
          labelKey: "search.packageCuscoValleMachuPicchu6d5n",
          fallback: "Cusco Valle Machu Picchu 6 días / 5 noches",
          quoteIntent: "cusco-valle-machu-picchu-6d5n",
          days: 6,
          nights: 5,
          dateMode: "single-fixed"
        },
        {
          value: "paquete-personalizado-cusco-machu-picchu",
          labelKey: "search.packageCustomCuscoMachuPicchu",
          fallback: "Paquete personalizado Cusco Machu Picchu",
          quoteIntent: "paquete-personalizado-cusco-machu-picchu",
          dateMode: "range"
        },
        {
          value: "union-ancestral-andes-matrimonio-andino",
          labelKey: "search.packageAncestralUnion",
          fallback: "Unión Ancestral en los Andes / Matrimonio Andino",
          quoteIntent: "union-ancestral-andes-matrimonio-andino",
          dateMode: "range"
        }
      ]
    };

    this.init();
  }

  t(key, fallback = "", params = {}) {
    let value = window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
    Object.entries(params || {}).forEach(([name, val]) => {
      value = String(value).replace(new RegExp(`\\{${name}\\}`, "g"), val);
    });
    return value;
  }

  init() {
    this.renderIntentOptions();
    this.setupTabs();
    this.setupQuantityControls();
    this.setupEventListeners();
    this.updateQuantityLabel();

    if (typeof flatpickr !== "undefined") {
      this.setupFlatpickr();
    }

    this.applyTabRules({ clearDates: false });
  }

  setupTabs() {
    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const tabName = tab.dataset.tab || "tours";
        this.setActiveTab(tabName);
      });
    });
  }

  setActiveTab(tabName) {
    this.currentTab = tabName;

    this.tabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.tab === tabName);
    });

    this.renderIntentOptions();
    this.applyTabRules({ clearDates: true });
  }

  getCurrentOptions() {
    return this.options[this.currentTab] || this.options.tours;
  }

  getCurrentOption() {
    const value = this.intentSelect?.value || "";
    return this.getCurrentOptions().find((option) => option.value === value) || this.getCurrentOptions()[0] || null;
  }

  isFixedPackageOption(option = this.getCurrentOption()) {
    return this.currentTab === "paquetes" && option?.dateMode === "single-fixed" && Number.isFinite(Number(option?.days)) && Number.isFinite(Number(option?.nights));
  }

  isRangePackageOption(option = this.getCurrentOption()) {
    return this.currentTab === "paquetes" && !this.isFixedPackageOption(option);
  }

  getCalendarMode() {
    return this.isRangePackageOption() ? "range" : "single";
  }

  renderIntentOptions() {
    if (!this.intentSelect) return;
    const previousValue = this.intentSelect.value;
    const options = this.getCurrentOptions();

    this.intentSelect.innerHTML = options.map((option) => `
      <option value="${option.value}">${this.t(option.labelKey, option.fallback)}</option>
    `).join("");

    const stillExists = options.some((option) => option.value === previousValue);
    this.intentSelect.value = stillExists ? previousValue : options[0]?.value || "";
  }

  applyTabRules(options = {}) {
    if (!this.dateInput) return;
    const shouldClearDates = options.clearDates !== false;
    const option = this.getCurrentOption();
    const nextMode = this.getCalendarMode();

    if (this.currentTab === "paquetes") {
      if (this.intentLabel) {
        this.intentLabel.dataset.i18n = "search.packageType";
        this.intentLabel.textContent = this.t("search.packageType", "Tipo de paquete");
      }
      if (this.submitText) {
        this.submitText.dataset.i18n = "search.quoteSubmit";
        this.submitText.textContent = this.t("search.quoteSubmit", "Cotizar mi viaje");
      }
      this.dateInput.placeholder = this.isFixedPackageOption(option)
        ? this.t("search.selectStartDate", "Selecciona fecha de inicio")
        : this.t("search.selectDateRange", "Selecciona rango de fechas");
    } else {
      if (this.intentLabel) {
        this.intentLabel.dataset.i18n = "search.experienceType";
        this.intentLabel.textContent = this.t("search.experienceType", "Tipo de viaje");
      }
      if (this.submitText) {
        this.submitText.dataset.i18n = "search.submit";
        this.submitText.textContent = this.t("search.submit", "Buscar experiencias");
      }
      this.dateInput.placeholder = this.t("search.selectDate", "Selecciona fecha");
    }

    if (this.flatpickrInstance && this.currentCalendarMode !== nextMode) {
      this.flatpickrInstance.set("mode", nextMode);
      this.currentCalendarMode = nextMode;
    }

    if (shouldClearDates) this.clearDates();
  }

  setupFlatpickr() {
    if (!this.dateInput) return;

    if (this.dateInput._flatpickr) {
      this.dateInput._flatpickr.destroy();
    }

    const activeLocale = window.MyCuscoTripI18n?.locale || window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
    const locale = flatpickr.l10ns[activeLocale] || flatpickr.l10ns.es || flatpickr.l10ns.default;
    const plugins = [];

    if (typeof confirmDatePlugin !== "undefined") {
      plugins.push(
        new confirmDatePlugin({
          confirmText: "OK",
          showAlways: true,
          theme: "light"
        })
      );
    }

    this.currentCalendarMode = this.getCalendarMode();
    this.flatpickrInstance = flatpickr(this.dateInput, {
      locale,
      altInput: true,
      altFormat: "d M Y",
      dateFormat: "Y-m-d",
      mode: this.currentCalendarMode,
      minDate: "today",
      clickOpens: false,
      disableMobile: true,
      static: false,
      plugins,
      onOpen: () => {
        this.closeQuantityPanel();
      },
      onChange: (selectedDates) => {
        this.handleDateChange(selectedDates);
      }
    });

    this.dateInput._flatpickr = this.flatpickrInstance;

    const visibleInput = this.flatpickrInstance.altInput || this.dateInput;
    visibleInput.setAttribute("readonly", "readonly");
    visibleInput.style.cursor = "pointer";

    const openCalendar = (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.closeQuantityPanel();

      if (!this.flatpickrInstance?.isOpen) {
        this.flatpickrInstance?.open();
      }
    };

    visibleInput.addEventListener("click", openCalendar);
    this.dateField?.addEventListener("click", openCalendar);
  }

  formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  formatDateHuman(isoDate) {
    const date = this.parseDate(isoDate);
    if (!date) return "";
    try {
      return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(date);
    } catch (_) {
      return isoDate;
    }
  }

  parseDate(value) {
    if (!value) return null;
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  addDaysToISO(isoDate, days) {
    const date = this.parseDate(isoDate);
    if (!date) return "";
    date.setDate(date.getDate() + Number(days || 0));
    return this.formatDate(date);
  }

  resetSelectedDates() {
    this.selectedDate = "";
    this.selectedStartDate = "";
    this.selectedEndDate = "";
    this.selectedDays = "";
    this.selectedNights = "";
  }

  handleDateChange(selectedDates) {
    this.resetSelectedDates();

    if (!this.durationEl) return;

    if (this.currentTab === "paquetes") {
      const currentOption = this.getCurrentOption();

      if (this.isFixedPackageOption(currentOption)) {
        if (selectedDates.length >= 1) {
          this.selectedStartDate = this.formatDate(selectedDates[0]);
          this.selectedDays = String(currentOption.days);
          this.selectedNights = String(currentOption.nights);
          this.selectedEndDate = this.addDaysToISO(this.selectedStartDate, currentOption.nights);

          const startLabel = this.formatDateHuman(this.selectedStartDate);
          const endLabel = this.formatDateHuman(this.selectedEndDate);
          this.durationEl.innerHTML = `<i class="fa-regular fa-moon"></i> ${this.t("search.fixedDurationHint", "{days} días / {nights} noches · {start} al {end}", { days: currentOption.days, nights: currentOption.nights, start: startLabel, end: endLabel })}`;
          this.durationEl.style.display = "block";
        } else {
          this.durationEl.textContent = "";
          this.durationEl.style.display = "none";
        }
        return;
      }

      if (selectedDates.length >= 1) {
        this.selectedStartDate = this.formatDate(selectedDates[0]);
      }

      if (selectedDates.length === 2) {
        const nights = Math.max(0, Math.round((selectedDates[1] - selectedDates[0]) / this.DAY));
        const days = nights + 1;

        this.selectedEndDate = this.formatDate(selectedDates[1]);
        this.selectedDays = String(days);
        this.selectedNights = String(nights);

        this.durationEl.innerHTML = `<i class="fa-regular fa-moon"></i> ${this.t("search.daysNights", "{days} días / {nights} noches", { days, nights })}`;
        this.durationEl.style.display = "block";
      } else if (selectedDates.length === 1) {
        this.durationEl.innerHTML = `<i class="fa-regular fa-calendar-days"></i> ${this.t("search.selectEndDateHint", "Selecciona también la fecha de salida")}`;
        this.durationEl.style.display = "block";
      } else {
        this.durationEl.textContent = "";
        this.durationEl.style.display = "none";
      }
    } else {
      if (selectedDates.length >= 1) {
        this.selectedDate = this.formatDate(selectedDates[0]);
        this.selectedDays = "";
        this.selectedNights = "";

        this.durationEl.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${this.t("search.selectedDate", "Fecha seleccionada")}`;
        this.durationEl.style.display = "block";
      } else {
        this.durationEl.textContent = "";
        this.durationEl.style.display = "none";
      }
    }
  }

  clearDates() {
    this.resetSelectedDates();

    if (this.flatpickrInstance) {
      this.flatpickrInstance.clear();
    }
    if (this.durationEl) {
      this.durationEl.textContent = "";
      this.durationEl.style.display = "none";
    }
  }

  setupQuantityControls() {
    if (!this.qtyPanel || !this.qtyToggle) return;

    this.qtyToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const isHidden = this.qtyPanel.hasAttribute("hidden");
      if (isHidden) {
        this.qtyPanel.removeAttribute("hidden");
        this.qtyToggle.setAttribute("aria-expanded", "true");
      } else {
        this.closeQuantityPanel();
      }
    });

    this.qtyDone?.addEventListener("click", () => {
      this.closeQuantityPanel();
    });

    const adultMinus = this.qtyPanel.querySelector('[data-type="adultos"] .minus');
    const adultPlus = this.qtyPanel.querySelector('[data-type="adultos"] .plus');
    const childMinus = this.qtyPanel.querySelector('[data-type="ninos"] .minus');
    const childPlus = this.qtyPanel.querySelector('[data-type="ninos"] .plus');

    adultMinus?.addEventListener("click", () => {
      this.adults = Math.max(1, this.adults - 1);
      this.syncPassengerInputs();
    });

    adultPlus?.addEventListener("click", () => {
      this.adults = Math.min(20, this.adults + 1);
      this.syncPassengerInputs();
    });

    childMinus?.addEventListener("click", () => {
      this.children = Math.max(0, this.children - 1);
      this.syncPassengerInputs();
    });

    childPlus?.addEventListener("click", () => {
      this.children = Math.min(10, this.children + 1);
      this.syncPassengerInputs();
    });

    this.syncPassengerInputs();
  }

  syncPassengerInputs() {
    const adultInput = this.qtyPanel?.querySelector('[data-type="adultos"] input');
    const childInput = this.qtyPanel?.querySelector('[data-type="ninos"] input');

    if (adultInput) adultInput.value = this.adults;
    if (childInput) childInput.value = this.children;

    this.updateQuantityLabel();
  }

  updateQuantityLabel() {
    if (!this.qtyLabel) return;
    const total = this.adults + this.children;
    this.qtyLabel.textContent = `${total} ${total === 1 ? this.t("search.passenger", "pasajero") : this.t("search.passengers", "pasajeros")}`;
  }

  closeQuantityPanel() {
    if (!this.qtyPanel || !this.qtyToggle) return;
    this.qtyPanel.setAttribute("hidden", "");
    this.qtyToggle.setAttribute("aria-expanded", "false");
  }

  setupEventListeners() {
    this.form?.addEventListener("submit", (event) => this.handleSubmit(event));
    this.intentSelect?.addEventListener("change", () => {
      this.applyTabRules({ clearDates: true });
    });

    document.addEventListener("click", (event) => {
      const insideQty =
        this.qtyPanel?.contains(event.target) ||
        this.qtyToggle?.contains(event.target);

      const altInput = this.flatpickrInstance?.altInput;
      const insideDate =
        this.dateField?.contains(event.target) ||
        (altInput && event.target === altInput);

      if (!insideQty && !insideDate) {
        this.closeQuantityPanel();
      }
    });

    window.addEventListener("resize", () => {
      this.closeQuantityPanel();
    });
  }

  buildTourUrl() {
    const option = this.getCurrentOption();
    const params = new URLSearchParams();
    params.set("source", "home-search");
    params.set("intent", option?.value || "tour");
    params.set("adultos", String(this.adults));
    params.set("ninos", String(this.children));
    if (this.selectedDate) {
      params.set("fecha", this.selectedDate);
      params.set("fechaInicio", this.selectedDate);
    }

    const base = option?.url || "./all-experiences.html";
    const connector = base.includes("?") ? "&" : "?";
    return `${base}${connector}${params.toString()}`;
  }

  buildPackageQuoteUrl() {
    const option = this.getCurrentOption();
    const params = new URLSearchParams();
    const fixed = this.isFixedPackageOption(option);
    const days = this.selectedDays !== ""
      ? Number(this.selectedDays)
      : (Number.isFinite(Number(option?.days)) ? Number(option.days) : "");
    const nights = this.selectedNights !== ""
      ? Number(this.selectedNights)
      : (Number.isFinite(Number(option?.nights)) ? Number(option.nights) : NaN);
    const inferredEndDate = !this.selectedEndDate && this.selectedStartDate && Number.isFinite(nights)
      ? this.addDaysToISO(this.selectedStartDate, nights)
      : "";

    params.set("source", "home-search");
    params.set("intent", option?.quoteIntent || option?.value || "paquete-personalizado-cusco-machu-picchu");
    params.set("adultos", String(this.adults));
    params.set("ninos", String(this.children));
    params.set("arrivalTime", "09:00");
    params.set("departureTime", "20:00");

    if (this.selectedStartDate) params.set("fechaInicio", this.selectedStartDate);
    if (this.selectedEndDate || inferredEndDate) params.set("fechaFin", this.selectedEndDate || inferredEndDate);
    if (days) params.set("days", String(days));
    if (Number.isFinite(nights) && nights >= 0) params.set("nights", String(nights));
    if (fixed) params.set("durationLocked", "1");

    return `./quote-packages.html?${params.toString()}`;
  }

  handleSubmit(event) {
    event.preventDefault();
    this.closeQuantityPanel();
    window.location.href = this.currentTab === "paquetes"
      ? this.buildPackageQuoteUrl()
      : this.buildTourUrl();
  }

  refreshTranslations() {
    const currentValue = this.intentSelect?.value;
    this.renderIntentOptions();
    if (currentValue && this.intentSelect) this.intentSelect.value = currentValue;
    this.applyTabRules({ clearDates: false });
    this.updateQuantityLabel();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!window.__mctSearchBarInitialized) {
    window.__mctSearchBarInitialized = true;
    window.mctSearchBarInstance = new MyCuscoTripSearchBar();
  }
});

window.addEventListener("mct:i18n-ready", () => {
  if (window.mctSearchBarInstance) {
    window.mctSearchBarInstance.refreshTranslations();
  }
});
