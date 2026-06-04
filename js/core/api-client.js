"use strict";

/**
 * My Cusco Trip - API Client
 * Adaptador único para conectar el frontend estático con el backend futuro.
 * En modo mock no envía datos a internet y solo guarda un borrador mínimo sin documentos.
 */
(function () {
  const DEFAULT_CONFIG = {
    mode: "mock",
    apiBaseUrl: "",
    endpoints: {
      quotes: "/api/quotes",
      couponLeads: "/api/coupons/leads",
      validateCoupon: "/api/coupons/validate",
      preReservations: "/api/pre-reservations",
      reservationsLookup: "/api/reservations/lookup",
      bookings: "/api/bookings",
      passengers: "/api/passengers",
      paypalCreateOrder: "/api/payments/paypal/orders",
      paypalCaptureOrder: "/api/payments/paypal/orders/{orderId}/capture",
      mercadoPagoCreatePreference: "/api/payments/mercadopago/preferences",
      mercadoPagoCapturePayment: "/api/payments/mercadopago/payments/{paymentId}/sync"
    },
    paypal: {
      enabled: false,
      clientId: "PAYPAL_CLIENT_ID_PUBLIC_ONLY",
      currency: "USD",
      intent: "capture",
      components: "buttons"
    },
    storagePolicy: {
      storeSensitivePassengerDataInBrowser: false,
      mockStorage: "sessionStorage",
      localDraftTtlMinutes: 90
    }
  };

  function getBasePath() {
    return window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
  }

  function resolveAssetPath(path) {
    if (!path || /^https?:\/\//i.test(path) || path.startsWith("/")) return path;
    return `${getBasePath()}${String(path).replace(/^\.?\//, "")}`;
  }

  function safeJsonClone(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (error) {
      return {};
    }
  }

  function stripSensitivePassengerData(payload) {
    const clone = safeJsonClone(payload);
    const redactPassenger = (passenger = {}) => {
      const safePassenger = { ...passenger };
      delete safePassenger.documentNumber;
      delete safePassenger.birthdate;
      delete safePassenger.email;
      delete safePassenger.whatsapp;
      return safePassenger;
    };

    if (clone.holder) {
      clone.holder = {
        firstName: clone.holder.firstName || "",
        lastName: clone.holder.lastName || "",
        email: clone.holder.email || "",
        whatsapp: clone.holder.whatsapp || "",
        nationality: clone.holder.nationality || "",
        travels: Boolean(clone.holder.travels)
      };
    }

    if (Array.isArray(clone.passengers)) {
      clone.passengers = clone.passengers.map(redactPassenger);
    }

    clone.browserDraftSanitized = true;
    return clone;
  }

  function normalizeEndpoint(endpoint, params = {}) {
    return Object.entries(params).reduce((path, [key, value]) => {
      return path.replace(`{${key}}`, encodeURIComponent(String(value || "")));
    }, endpoint || "");
  }

  class MyCuscoTripApiClient {
    constructor() {
      this.config = { ...DEFAULT_CONFIG };
      this.configPromise = null;
    }

    async loadConfig() {
      if (this.configPromise) return this.configPromise;
      this.configPromise = (async () => {
        try {
          const response = await fetch(resolveAssetPath("assets/data/backend-config.json"), { cache: "no-store" });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const remoteConfig = await response.json();
          this.config = {
            ...DEFAULT_CONFIG,
            ...remoteConfig,
            endpoints: { ...DEFAULT_CONFIG.endpoints, ...(remoteConfig.endpoints || {}) },
            paypal: { ...DEFAULT_CONFIG.paypal, ...(remoteConfig.paypal || {}) },
            storagePolicy: { ...DEFAULT_CONFIG.storagePolicy, ...(remoteConfig.storagePolicy || {}) }
          };
        } catch (error) {
          console.warn("[MyCuscoTripApiClient] No se pudo cargar backend-config.json. Se usará modo mock.", error);
          this.config = { ...DEFAULT_CONFIG };
        }
        return this.config;
      })();
      return this.configPromise;
    }

    async isBackendEnabled() {
      const config = await this.loadConfig();
      const base = String(config.apiBaseUrl || "").trim();
      if (!base || /PEGAR_AQUI|PASTE_HERE|YOUR_/i.test(base)) return false;
      return Boolean(base && config.mode !== "mock");
    }

    buildUrl(endpoint) {
      const config = this.config || DEFAULT_CONFIG;
      if (/^https?:\/\//i.test(endpoint)) return endpoint;
      const base = String(config.apiBaseUrl || "").replace(/\/$/, "");
      const path = String(endpoint || "").startsWith("/") ? endpoint : `/${endpoint}`;
      return `${base}${path}`;
    }

    getStorage() {
      const storageName = this.config?.storagePolicy?.mockStorage === "localStorage" ? "localStorage" : "sessionStorage";
      try {
        return window[storageName] || window.sessionStorage;
      } catch (error) {
        return null;
      }
    }

    saveMockDraft(type, payload) {
      const storage = this.getStorage();
      const code = payload?.code || payload?.quoteCode || `MCT-${Date.now()}`;
      const sanitized = stripSensitivePassengerData(payload);
      const ttlMinutes = Number(this.config?.storagePolicy?.localDraftTtlMinutes || 90);
      const record = {
        type,
        code,
        status: "pending_backend",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
        payload: sanitized
      };

      if (storage) {
        storage.setItem(`mct_${type}_${code}`, JSON.stringify(record));
      }

      return {
        ok: true,
        mock: true,
        status: "pending_backend",
        code,
        message: "Borrador local creado en modo mock. Conecta el backend para guardar la reserva real.",
        data: record
      };
    }

    isAppsScriptBackend() {
      const mode = String(this.config?.mode || "").toLowerCase();
      const base = String(this.config?.apiBaseUrl || "").toLowerCase();
      return mode === "apps_script" || base.includes("script.google.com/macros/");
    }

    async postAction(action, payload = {}) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        if (action === "createPreReservation") return this.saveMockDraft("pre_reservation", payload);
        if (action === "createQuote") return this.saveMockDraft("quote", payload);
        return {
          ok: false,
          mock: true,
          status: "backend_disabled",
          message: "Backend no configurado."
        };
      }

      if (this.isAppsScriptBackend()) {
        const response = await fetch(this.config.apiBaseUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, payload, ...payload }),
          credentials: "omit",
          redirect: "follow"
        });

        const text = await response.text();
        let body;
        try {
          body = text ? JSON.parse(text) : {};
        } catch (error) {
          body = { ok: response.ok, raw: text };
        }

        if (!response.ok || body?.ok === false) {
          const apiError = new Error(body?.error || body?.message || `HTTP ${response.status}`);
          apiError.status = response.status;
          apiError.body = body;
          throw apiError;
        }

        return body;
      }

      return this.request(this.config.endpoints[action] || `/${action}`, { method: "POST", body: payload });
    }

    async request(endpoint, options = {}) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        return {
          ok: false,
          mock: true,
          status: "backend_disabled",
          message: "Backend no configurado."
        };
      }

      const response = await fetch(this.buildUrl(endpoint), {
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: options.credentials || "omit"
      });

      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await response.json() : await response.text();

      if (!response.ok) {
        const error = new Error(body?.message || body || `HTTP ${response.status}`);
        error.status = response.status;
        error.body = body;
        throw error;
      }

      return body;
    }

    async createQuote(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) return this.saveMockDraft("quote", payload);
      if (this.isAppsScriptBackend()) return this.postAction("createQuote", payload);
      return this.request(this.config.endpoints.quotes, { method: "POST", body: payload });
    }

    async createCouponLead(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        return { ok: true, mock: true, couponCode: payload?.couponCode || "MCTMOCK", message: "Lead guardado localmente en modo mock." };
      }
      if (this.isAppsScriptBackend()) return this.postAction("createCouponLead", payload);
      return this.request(this.config.endpoints.couponLeads, { method: "POST", body: payload });
    }

    async validateCoupon(couponCode) {
      await this.loadConfig();
      const payload = typeof couponCode === "object" ? couponCode : { couponCode };
      if (!(await this.isBackendEnabled())) {
        return { ok: true, mock: true, valid: false, reason: "backend_disabled", message: "Backend no configurado para validar cupones." };
      }
      if (this.isAppsScriptBackend()) return this.postAction("validateCoupon", payload);
      return this.request(this.config.endpoints.validateCoupon, { method: "POST", body: payload });
    }

    async createPreReservation(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) return this.saveMockDraft("pre_reservation", payload);
      if (this.isAppsScriptBackend()) return this.postAction("createPreReservation", payload);
      return this.request(this.config.endpoints.preReservations, { method: "POST", body: payload });
    }

    async lookupReservation(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        return { ok: false, mock: true, found: false, message: "Backend no configurado." };
      }
      if (this.isAppsScriptBackend()) return this.postAction("lookupReservation", payload);
      return this.request(this.config.endpoints.reservationsLookup, { method: "POST", body: payload });
    }

    async createPayPalOrder(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        return {
          ok: false,
          mock: true,
          status: "paypal_backend_required",
          message: "PayPal necesita backend para crear una orden segura y validar el monto."
        };
      }
      if (this.isAppsScriptBackend()) return this.postAction("createPayPalOrder", payload);
      return this.request(this.config.endpoints.paypalCreateOrder, { method: "POST", body: payload });
    }

    async capturePayPalOrder(orderId, payload = {}) {
      await this.loadConfig();
      const finalPayload = { ...payload, orderID: orderId };
      const endpoint = normalizeEndpoint(this.config.endpoints.paypalCaptureOrder, { orderId });
      if (!(await this.isBackendEnabled())) {
        return {
          ok: false,
          mock: true,
          status: "paypal_backend_required",
          message: "PayPal necesita backend para capturar y verificar el pago."
        };
      }
      if (this.isAppsScriptBackend()) return this.postAction("capturePayPalOrder", finalPayload);
      return this.request(endpoint, { method: "POST", body: finalPayload });
    }


    async createMercadoPagoPreference(payload) {
      await this.loadConfig();
      if (!(await this.isBackendEnabled())) {
        return {
          ok: false,
          mock: true,
          status: "mercadopago_backend_required",
          message: "Mercado Pago necesita backend para crear una preferencia segura y validar el monto."
        };
      }
      if (this.isAppsScriptBackend()) return this.postAction("createMercadoPagoPreference", payload);
      return this.request(this.config.endpoints.mercadoPagoCreatePreference, { method: "POST", body: payload });
    }

    async captureMercadoPagoPayment(paymentId, payload = {}) {
      await this.loadConfig();
      const finalPayload = { ...payload, payment_id: paymentId };
      const endpoint = normalizeEndpoint(this.config.endpoints.mercadoPagoCapturePayment, { paymentId });
      if (!(await this.isBackendEnabled())) {
        return {
          ok: false,
          mock: true,
          status: "mercadopago_backend_required",
          message: "Mercado Pago necesita backend para verificar el pago."
        };
      }
      if (this.isAppsScriptBackend()) return this.postAction("captureMercadoPagoPayment", finalPayload);
      return this.request(endpoint, { method: "POST", body: finalPayload });
    }
  }

  window.MyCuscoTripApiClient = new MyCuscoTripApiClient();
  window.MyCuscoTripApiClientClass = MyCuscoTripApiClient;
})();
