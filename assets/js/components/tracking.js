"use strict";

/**
 * My Cusco Trip - Tracking bridge
 * Centraliza eventos para Meta Pixel, GA4, GTM/dataLayer y depuración local.
 */
(function () {
  const defaultConfig = {
    enabled: true,
    debug: false,
    facebookPixelId: "",
    googleAnalyticsId: "",
    googleTagManagerId: "",
    tiktokPixelId: "",
    googleAdsConversionId: "",
    googleAdsConversionLabel: "",
    business: {
      name: "My Cusco Trip",
      currency: "USD",
      whatsapp: "51900608980"
    }
  };

  const config = { ...defaultConfig, ...(window.MCT_TRACKING_CONFIG || {}) };
  config.business = { ...defaultConfig.business, ...(window.MCT_TRACKING_CONFIG?.business || {}) };

  const loaded = {
    ga4: false,
    gtm: false,
    meta: false,
    tiktok: false
  };

  const eventMap = {
    page_view: { ga4: "page_view", meta: "PageView", tiktok: "PageView" },
    view_item: { ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent" },
    select_item: { ga4: "select_item", meta: "ViewContent", tiktok: "ViewContent" },
    generate_lead: { ga4: "generate_lead", meta: "Lead", tiktok: "SubmitForm" },
    begin_checkout: { ga4: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
    add_payment_info: { ga4: "add_payment_info", meta: "AddPaymentInfo", tiktok: "AddPaymentInfo" },
    purchase: { ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment" },
    contact: { ga4: "contact", meta: "Contact", tiktok: "Contact" },
    click_whatsapp: { ga4: "click_whatsapp", meta: "Contact", tiktok: "Contact" },
    coupon_popup_open: { ga4: "coupon_popup_open", meta: "ViewContent", tiktok: "ViewContent" },
    coupon_code_copy: { ga4: "coupon_code_copy", meta: "CustomizeProduct", tiktok: "ClickButton" },
    coupon_form_submit: { ga4: "coupon_form_submit", meta: "Lead", tiktok: "SubmitForm" },
    hotel_modal_open: { ga4: "hotel_modal_open", meta: "ViewContent", tiktok: "ViewContent" },
    hotel_selected: { ga4: "hotel_selected", meta: "CustomizeProduct", tiktok: "ClickButton" },
    passenger_modal_open: { ga4: "passenger_modal_open", meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
    pre_reservation_created: { ga4: "pre_reservation_created", meta: "CompleteRegistration", tiktok: "CompleteRegistration" },
    begin_payment: { ga4: "begin_payment", meta: "InitiateCheckout", tiktok: "InitiateCheckout" }
  };

  function hasValue(value) {
    return typeof value === "string" && value.trim().length > 0;
  }

  function appendScript(src, attrs = {}) {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
    document.head.appendChild(script);
    return script;
  }

  function initGA4() {
    if (!hasValue(config.googleAnalyticsId) || loaded.ga4) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", config.googleAnalyticsId, {
      send_page_view: false
    });

    appendScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(config.googleAnalyticsId)}`);
    loaded.ga4 = true;
  }

  function initGTM() {
    if (!hasValue(config.googleTagManagerId) || loaded.gtm) return;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    appendScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.googleTagManagerId)}`);
    loaded.gtm = true;
  }

  function initMetaPixel() {
    if (!hasValue(config.facebookPixelId) || loaded.meta) return;

    // Si una página ya cargó manualmente el Meta Pixel, reutilizamos esa instancia
    // para evitar inicializaciones duplicadas.
    if (typeof window.fbq === "function") {
      loaded.meta = true;
      return;
    }

    /* eslint-disable */
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    window.fbq("init", config.facebookPixelId);
    loaded.meta = true;
  }

  function initTikTokPixel() {
    if (!hasValue(config.tiktokPixelId) || loaded.tiktok) return;

    /* eslint-disable */
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
      ttq.setAndDefer = function (target, method) {
        target[method] = function () {
          target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (pixelId) {
        var instance = ttq._i[pixelId] || [];
        for (var n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(instance, ttq.methods[n]);
        return instance;
      };
      ttq.load = function (pixelId, options) {
        var src = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[pixelId] = [];
        ttq._i[pixelId]._u = src;
        ttq._t = ttq._t || {};
        ttq._t[pixelId] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[pixelId] = options || {};
        var script = d.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = src + "?sdkid=" + pixelId + "&lib=" + t;
        var firstScript = d.getElementsByTagName("script")[0];
        firstScript.parentNode.insertBefore(script, firstScript);
      };
    }(window, document, "ttq");
    /* eslint-enable */

    window.ttq.load(config.tiktokPixelId);
    loaded.tiktok = true;
  }

  function normalizeParams(params = {}) {
    const normalized = {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname,
      ...params
    };

    Object.keys(normalized).forEach((key) => {
      if (normalized[key] === undefined || normalized[key] === null || normalized[key] === "") {
        delete normalized[key];
      }
    });

    return normalized;
  }

  function toMetaParams(params = {}) {
    const metaParams = { ...params };

    if (params.currency) metaParams.currency = params.currency;
    if (params.value !== undefined) metaParams.value = Number(params.value) || 0;
    if (params.item_id || params.product_id) metaParams.content_ids = [String(params.item_id || params.product_id)];
    if (params.item_name || params.product_name) metaParams.content_name = String(params.item_name || params.product_name);
    if (params.item_category || params.product_category) metaParams.content_category = String(params.item_category || params.product_category);
    if (params.items) metaParams.contents = params.items;

    return metaParams;
  }

  function toTikTokParams(params = {}) {
    const tiktokParams = { ...params };

    if (params.currency) tiktokParams.currency = params.currency;
    if (params.value !== undefined) tiktokParams.value = Number(params.value) || 0;
    if (params.item_id || params.product_id) tiktokParams.content_id = String(params.item_id || params.product_id);
    if (params.item_name || params.product_name) tiktokParams.content_name = String(params.item_name || params.product_name);
    if (params.item_category || params.product_category) tiktokParams.content_type = String(params.item_category || params.product_category);
    if (params.items) tiktokParams.contents = params.items;

    return tiktokParams;
  }

  function debug(eventName, params, providerNames) {
    if (!config.debug) return;
    console.info("[MCT tracking]", eventName, params, providerNames);
  }

  function track(eventName, params = {}, options = {}) {
    if (config.enabled === false) return;

    const mapping = eventMap[eventName] || { ga4: eventName, meta: eventName };
    const normalized = normalizeParams(params);
    const providers = [];

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: mapping.ga4 || eventName, ...normalized });
    providers.push("dataLayer");

    if (typeof window.gtag === "function" && hasValue(config.googleAnalyticsId)) {
      window.gtag("event", mapping.ga4 || eventName, normalized);
      providers.push("ga4");
    }

    if (!options.skipMeta && typeof window.fbq === "function" && hasValue(config.facebookPixelId)) {
      const metaName = options.metaEventName || mapping.meta || eventName;
      const metaParams = toMetaParams(normalized);
      const eventID = options.eventID || normalized.event_id || normalized.eventID || "";
      const standardEvents = new Set([
        "PageView", "ViewContent", "Search", "Lead", "InitiateCheckout",
        "AddPaymentInfo", "Purchase", "Contact", "CompleteRegistration",
        "CustomizeProduct", "AddToCart"
      ]);
      const trackMethod = standardEvents.has(metaName) ? "track" : "trackCustom";
      if (eventID) {
        window.fbq(trackMethod, metaName, metaParams, { eventID });
      } else {
        window.fbq(trackMethod, metaName, metaParams);
      }
      providers.push("meta");
    }

    if (typeof window.ttq?.track === "function" && hasValue(config.tiktokPixelId)) {
      const tiktokName = options.tiktokEventName || mapping.tiktok || eventName;
      const tiktokParams = toTikTokParams(normalized);
      if (tiktokName === "PageView" && typeof window.ttq.page === "function") {
        window.ttq.page();
      } else {
        window.ttq.track(tiktokName, tiktokParams);
      }
      providers.push("tiktok");
    }

    try {
      const history = JSON.parse(localStorage.getItem("mct_tracking_debug_events") || "[]");
      history.push({ eventName, params: normalized, providers, at: new Date().toISOString() });
      localStorage.setItem("mct_tracking_debug_events", JSON.stringify(history.slice(-80)));
    } catch (error) {
      // No interrumpir la navegación si localStorage no está disponible.
    }

    debug(eventName, normalized, providers);
  }

  function trackPageView() {
    track("page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname
    }, {
      metaEventName: "PageView",
      // Las landings con el snippet oficial de Meta ya envían PageView manualmente.
      skipMeta: window.MCT_MANUAL_META_PAGEVIEW_SENT === true
    });
  }

  function getLinkContext(link) {
    const section = link.closest("section, header, footer, aside, main, article");
    return {
      link_text: (link.textContent || link.getAttribute("aria-label") || "").trim().slice(0, 120),
      link_url: link.href,
      link_classes: link.className || "",
      section_id: section?.id || "",
      section_class: section?.className || ""
    };
  }

  function bindGlobalClickTracking() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link) return;

      const href = String(link.getAttribute("href") || "").toLowerCase();
      const context = getLinkContext(link);

      if (href.includes("wa.me") || href.includes("api.whatsapp.com") || href.includes("whatsapp://")) {
        track("click_whatsapp", {
          ...context,
          event_category: "contact",
          contact_channel: "whatsapp"
        }, { metaEventName: "Contact" });
        return;
      }

      if (href.startsWith("mailto:")) {
        track("contact", {
          ...context,
          event_category: "contact",
          contact_channel: "email"
        }, { metaEventName: "Contact" });
        return;
      }

      if (href.includes("product.html")) {
        let productSlug = "";
        try {
          productSlug = new URL(link.href, window.location.href).searchParams.get("slug") || "";
        } catch (error) {
          productSlug = "";
        }

        track("select_item", {
          ...context,
          item_id: productSlug,
          item_name: context.link_text || productSlug,
          item_category: "experience",
          event_category: "catalog",
          product_slug: productSlug
        }, { metaEventName: "ViewContent" });
      }
    }, true);
  }

  function init() {
    if (config.enabled === false) return;
    initGTM();
    initGA4();
    initMetaPixel();
    initTikTokPixel();
    bindGlobalClickTracking();
    trackPageView();
  }

  window.MyCuscoTripTracking = {
    config,
    init,
    track,
    trackPageView
  };

  window.mctTrack = track;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
