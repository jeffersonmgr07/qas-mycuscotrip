"use strict";

/**
 * My Cusco Trip - Coupon Popup
 * Captura leads con cupón sin bloquear navegación ni formularios existentes.
 */
(function () {
  const STORAGE_KEY = "mct_coupon_popup_state";
  const DISMISS_DAYS = 7;
  const MIN_DELAY_MS = 2500;
  const MAX_DELAY_MS = 3500;

  class MyCuscoTripCouponPopup {
    constructor(options = {}) {
      this.options = {
        couponCode: options.couponCode || "BETSWELCOME05",
        discountLabel: options.discountLabel || "",
        title: options.title || "",
        endpoint: options.endpoint || "",
        ...options
      };

      this.popup = null;
      this.form = null;
      this.hasShown = false;
      this.timer = null;

      if (this.shouldSkipPage() || this.shouldSuppressPopup()) return;

      this.init();
    }

    init() {
      this.render();
      this.bindEvents();
      this.scheduleShow();
    }

    shouldSkipPage() {
      const path = window.location.pathname.toLowerCase();
      return (
        path.includes("registro-pasajeros") ||
        path.includes("booking-status") ||
        path.includes("mi-reserva") ||
        path.includes("detalle-reserva") ||
        path.includes("verificar-reserva")
      );
    }

    shouldSuppressPopup() {
      const state = this.getStoredState();
      if (state.registered === true) return true;

      if (!state.dismissedAt) return false;

      const dismissedAt = Number(state.dismissedAt);
      if (!Number.isFinite(dismissedAt)) return false;

      const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      return elapsedDays < DISMISS_DAYS;
    }


    t(key, fallback = "") {
      return window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
    }

    formatMessage(key, fallback, params = {}) {
      let message = this.t(key, fallback);
      Object.entries(params).forEach(([name, value]) => {
        message = message.replace(new RegExp(`\{${name}\}`, "g"), String(value));
      });
      return message;
    }

    getStoredState() {
      try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      } catch (error) {
        return {};
      }
    }

    setStoredState(nextState) {
      const current = this.getStoredState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...nextState }));
    }

    scheduleShow() {
      const delay = this.getRandomDelay();
      this.timer = window.setTimeout(() => this.show(), delay);
    }

    getRandomDelay() {
      return Math.round(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    }

    render() {
      if (document.getElementById("couponPopup")) {
        this.popup = document.getElementById("couponPopup");
        this.form = this.popup?.querySelector("form") || null;
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.id = "couponPopup";
      wrapper.className = "coupon-popup";
      wrapper.hidden = true;
      wrapper.setAttribute("role", "dialog");
      wrapper.setAttribute("aria-modal", "true");
      wrapper.setAttribute("aria-labelledby", "couponPopupTitle");

      wrapper.innerHTML = `
        <div class="coupon-popup__backdrop" data-coupon-close></div>
        <div class="coupon-popup__panel">
          <section class="coupon-popup__visual" aria-hidden="true">
            <div class="coupon-popup__card-image"></div>
            <div class="coupon-popup__offer-card">
              <span class="coupon-popup__offer-icon">%</span>
              <span>
                <strong class="coupon-popup__offer-title">${this.escapeHtml(this.options.discountLabel || this.t("coupon.discountLabel", "Hasta 15% de descuento"))}</strong>
                <small class="coupon-popup__offer-text">${this.escapeHtml(this.t("coupon.appliesTo", "Aplica para tours y paquetes seleccionados."))}</small>
              </span>
            </div>
          </section>

          <section class="coupon-popup__content">
            <button type="button" class="coupon-popup__close" data-coupon-close aria-label="${this.escapeHtml(this.t("coupon.close", "Cerrar cupón"))}">×</button>
            <p class="coupon-popup__eyebrow">${this.escapeHtml(this.t("coupon.eyebrow", "Oferta especial"))}</p>
            <h2 id="couponPopupTitle">${this.escapeHtml(this.options.title || this.t("coupon.title", "Recibe hasta 15% de descuento en tu próximo viaje a Cusco"))}</h2>
            <p class="coupon-popup__intro">${this.escapeHtml(this.t("coupon.intro", "Suscríbete para recibir un mayor descuento."))}</p>

            <div class="coupon-popup__code-card">
              <div class="coupon-popup__code-row">
                <strong class="coupon-popup__code" data-coupon-code>${this.escapeHtml(this.options.couponCode)}</strong>
                <button type="button" class="coupon-popup__copy" data-coupon-copy>${this.escapeHtml(this.t("coupon.copy", "Copiar"))}</button>
              </div>
              <p class="coupon-popup__code-note">${this.escapeHtml(this.t("coupon.codeNote", "Este código ofrece 5% de descuento. Suscríbete para mejorar este cupón de descuento."))}</p>
            </div>

            <form class="coupon-popup__form" novalidate>
              <label>
                <span>${this.escapeHtml(this.t("coupon.name", "Nombre"))}</span>
                <input type="text" name="name" autocomplete="name" required minlength="2" />
              </label>

              <label>
                <span>${this.escapeHtml(this.t("coupon.whatsapp", "WhatsApp"))}</span>
                <input type="tel" name="whatsapp" autocomplete="tel" required inputmode="tel" />
              </label>

              <label>
                <span>${this.escapeHtml(this.t("coupon.email", "Correo"))}</span>
                <input type="email" name="email" autocomplete="email" required />
              </label>

              <p class="coupon-popup__message" data-coupon-message aria-live="polite"></p>

              <button type="submit" class="btn coupon-popup__submit">${this.escapeHtml(this.t("coupon.submit", "Suscribirme"))}</button>
            </form>
          </section>
        </div>
      `;

      document.body.appendChild(wrapper);
      this.popup = wrapper;
      this.form = wrapper.querySelector("form");
    }

    bindEvents() {
      this.popup?.querySelectorAll("[data-coupon-close]").forEach((button) => {
        button.addEventListener("click", () => this.dismiss());
      });

      this.popup?.querySelector("[data-coupon-copy]")?.addEventListener("click", () => {
        this.copyCouponCode();
      });

      this.form?.addEventListener("submit", (event) => this.handleSubmit(event));

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.popup && !this.popup.hidden) {
          this.dismiss();
        }
      });
    }

    show() {
      if (this.hasShown || !this.popup || this.shouldSuppressPopup()) return;

      this.hasShown = true;
      this.popup.hidden = false;
      this.popup.classList.add("is-visible");
      document.body.classList.add("coupon-popup-open");
      this.trackEvent("coupon_popup_open", {
        coupon_code: this.options.couponCode,
        discount_label: this.options.discountLabel
      });
    }

    hide() {
      if (!this.popup) return;

      this.popup.classList.remove("is-visible");
      this.popup.hidden = true;
      document.body.classList.remove("coupon-popup-open");
    }

    dismiss() {
      this.setStoredState({ dismissedAt: Date.now() });
      this.hide();
    }

    async copyCouponCode() {
      const code = this.options.couponCode;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const temp = document.createElement("textarea");
          temp.value = code;
          temp.setAttribute("readonly", "");
          temp.style.position = "fixed";
          temp.style.left = "-9999px";
          document.body.appendChild(temp);
          temp.select();
          document.execCommand("copy");
          temp.remove();
        }

        this.setMessage(this.formatMessage("coupon.copySuccess", "Código {code} copiado.", { code }), false);
        this.trackEvent("coupon_code_copy", {
          coupon_code: code,
          event_category: "coupon"
        });
      } catch (error) {
        this.setMessage(this.formatMessage("coupon.copyFallback", "Tu código es {code}.", { code }), false);
      }
    }

    async handleSubmit(event) {
      event.preventDefault();
      if (!this.form) return;

      const formData = new FormData(this.form);
      const payload = {
        name: String(formData.get("name") || "").trim(),
        whatsapp: String(formData.get("whatsapp") || "").trim(),
        email: String(formData.get("email") || "").trim(),
        couponCode: this.options.couponCode,
        requestedCouponLabel: "hasta 15%",
        page: window.location.href,
        createdAt: new Date().toISOString()
      };

      const validation = this.validatePayload(payload);
      if (!validation.valid) {
        this.setMessage(validation.message, true);
        return;
      }

      this.setMessage(this.t("coupon.submitting", "Registrando tus datos..."), false);

      try {
        const result = await this.submitCouponLead(payload);
        const generatedCode = result?.couponCode || result?.code || payload.couponCode || this.options.couponCode;
        const discountPercent = result?.discountPercent || result?.percent || "";

        this.options.couponCode = generatedCode;
        payload.couponCode = generatedCode;

        const codeTarget = this.popup?.querySelector("[data-coupon-code]");
        if (codeTarget) codeTarget.textContent = generatedCode;

        this.setStoredState({
          registered: true,
          registeredAt: Date.now(),
          couponCode: generatedCode,
          discountPercent,
          expiresAt: result?.expiresAt || ""
        });
        this.trackEvent("coupon_form_submit", {
          coupon_code: generatedCode,
          requested_coupon_label: payload.requestedCouponLabel,
          lead_source: "coupon_popup",
          contact_channel: "form",
          email_domain: payload.email.split("@")[1] || ""
        }, { metaEventName: "Lead" });
        this.trackEvent("generate_lead", {
          lead_source: "coupon_popup",
          coupon_code: generatedCode
        }, { metaEventName: "Lead" });
        const successMessage = result?.mock
          ? this.formatMessage("coupon.successMock", "Modo prueba: cupón {code} generado localmente. Configura el backend para enviar correos reales.", { code: generatedCode })
          : this.formatMessage("coupon.successWithCode", "Listo. Tu cupón {code} fue enviado a tu correo y vence en 24 horas.", { code: generatedCode });
        this.setMessage(successMessage, false);
        window.setTimeout(() => this.hide(), 2600);
      } catch (error) {
        console.error("No se pudo registrar el cupón:", error);
        this.setMessage(this.t("coupon.error", "No pudimos registrar tus datos. Inténtalo nuevamente."), true);
      }
    }

    validatePayload(payload) {
      if (!payload.name || payload.name.length < 2) {
        return { valid: false, message: this.t("coupon.validationName", "Ingresa tu nombre.") };
      }

      if (!this.isValidWhatsApp(payload.whatsapp)) {
        return { valid: false, message: this.t("coupon.validationWhatsApp", "Ingresa un WhatsApp válido con código de país o ciudad.") };
      }

      if (!this.isValidEmail(payload.email)) {
        return { valid: false, message: this.t("coupon.validationEmail", "Ingresa un correo válido.") };
      }

      return { valid: true, message: "" };
    }

    isValidWhatsApp(value) {
      const digits = String(value || "").replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }

    isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }

    async submitCouponLead(payload) {
      const finalPayload = {
        ...payload,
        action: "createCouponLead",
        source: "coupon_popup",
        locale: document.documentElement.lang || window.MyCuscoTripI18n?.getCurrentLocale?.() || "es"
      };

      if (window.MyCuscoTripApiClient?.createCouponLead) {
        return window.MyCuscoTripApiClient.createCouponLead(finalPayload);
      }

      if (!this.options.endpoint) {
        console.info("Lead de cupón capturado localmente:", finalPayload);
        return { ok: true, simulated: true, couponCode: finalPayload.couponCode };
      }

      const isAppsScript = String(this.options.endpoint).includes("script.google.com/macros/");
      const response = await fetch(this.options.endpoint, {
        method: "POST",
        headers: { "Content-Type": isAppsScript ? "text/plain;charset=utf-8" : "application/json" },
        body: JSON.stringify(isAppsScript ? { action: "createCouponLead", payload: finalPayload } : finalPayload),
        credentials: "omit",
        redirect: "follow"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json().catch(() => ({ ok: true, couponCode: finalPayload.couponCode }));
    }

    setMessage(message, isError = false) {
      const target = this.popup?.querySelector("[data-coupon-message]");
      if (!target) return;
      target.textContent = message || "";
      target.classList.toggle("is-error", Boolean(isError));
    }

    trackEvent(eventName, params = {}, options = {}) {
      if (typeof window.mctTrack === "function") {
        window.mctTrack(eventName, params, options);
      } else if (window.MyCuscoTripTracking?.track) {
        window.MyCuscoTripTracking.track(eventName, params, options);
      }
    }

    escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }
  }

  window.MyCuscoTripCouponPopup = MyCuscoTripCouponPopup;

  document.addEventListener("DOMContentLoaded", () => {
    window.myCuscoTripCouponPopup = new MyCuscoTripCouponPopup();
  });
})();
