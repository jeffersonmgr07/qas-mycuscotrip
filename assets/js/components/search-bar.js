class MyCuscoTripSearchBar {
  constructor() {
    this.root = document.querySelector(".search-bar.mct-search");
    if (!this.root) return;

    this.form = this.root.querySelector("#mctForm");
    this.tabs = this.root.querySelectorAll(".mct-tab");
    this.destinoSelect = this.root.querySelector("#mctDestino");
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
    this.DAY = 24 * 60 * 60 * 1000;

    this.selectedDate = "";
    this.selectedStartDate = "";
    this.selectedEndDate = "";
    this.selectedDays = "";
    this.selectedNights = "";

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
    this.setupTabs();
    this.setupQuantityControls();
    this.setupEventListeners();
    this.updateQuantityLabel();

    if (typeof flatpickr !== "undefined") {
      this.setupFlatpickr();
    }

    this.applyTabRules();
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

    this.applyTabRules();
    this.clearDates();
  }

  applyTabRules() {
    if (!this.destinoSelect || !this.dateInput) return;

    if (this.currentTab === "paquetes") {
      this.dateInput.placeholder = this.t("search.selectDateRange", "Selecciona rango de fechas");
    } else {
      this.dateInput.placeholder = this.t("search.selectDate", "Selecciona fecha");
    }

    if (this.flatpickrInstance) {
      this.flatpickrInstance.set(
        "mode",
        this.currentTab === "paquetes" ? "range" : "single"
      );
    }
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

    this.flatpickrInstance = flatpickr(this.dateInput, {
      locale,
      altInput: true,
      altFormat: "d M Y",
      dateFormat: "Y-m-d",
      mode: "single",
      minDate: "today",
      clickOpens: false,
      disableMobile: true,
      static: false,
      plugins,
      onOpen: () => {
        this.closeQuantityPanel();
      },
      onClose: () => {},
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
      if (selectedDates.length === 2) {
        const nights = Math.max(0, Math.round((selectedDates[1] - selectedDates[0]) / this.DAY));
        const days = nights + 1;

        this.selectedStartDate = this.formatDate(selectedDates[0]);
        this.selectedEndDate = this.formatDate(selectedDates[1]);
        this.selectedDays = String(days);
        this.selectedNights = String(nights);

        this.durationEl.innerHTML = `<i class="fa-regular fa-moon"></i> ${this.t("search.daysNights", "{days} días / {nights} noches", { days, nights })}`;
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

  buildAllExperiencesUrl() {
    const tipo = this.currentTab === "paquetes" ? "paquetes" : "tours";
    const destino = this.destinoSelect?.value || "machu-picchu";

    const params = new URLSearchParams();
    params.set("tipo", tipo);
    params.set("destino", destino);
    params.set("adultos", String(this.adults));
    params.set("ninos", String(this.children));

    if (tipo === "paquetes") {
      if (this.selectedDays) params.set("days", this.selectedDays);
      if (this.selectedNights) params.set("nights", this.selectedNights);
      if (this.selectedStartDate) params.set("fechaInicio", this.selectedStartDate);
      if (this.selectedEndDate) params.set("fechaFin", this.selectedEndDate);
    } else if (this.selectedDate) {
      params.set("fecha", this.selectedDate);
    }

    return `./all-experiences.html?${params.toString()}`;
  }

  handleSubmit(event) {
    event.preventDefault();
    window.location.href = this.buildAllExperiencesUrl();
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
    window.mctSearchBarInstance.applyTabRules();
    window.mctSearchBarInstance.updateQuantityLabel();
  }
});
