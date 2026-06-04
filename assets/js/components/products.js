/*
  My Cusco Trip - Featured products for index.html
  Drop-in replacement for assets/js/components/products.js
  Purpose: read the new split catalog files and render the homepage Machu Picchu cards.
*/
(function () {
  "use strict";

  class MyCuscoTripProducts {
    constructor(options = {}) {
      this.container = document.getElementById(options.containerId || "products-container");
      this.limit = Number(options.limit || 6);
      this.basePath = this.getBasePath();
      this.catalog = [];

      if (!this.container) return;
      this.init();
    }

    getBasePath() {
      if (typeof window.BASE_PATH === "string" && window.BASE_PATH) {
        return window.BASE_PATH.endsWith("/") ? window.BASE_PATH : `${window.BASE_PATH}/`;
      }
      return window.MyCuscoTripI18n?.getBasePath?.() || (window.location.hostname.includes("github.io") ? "/mycuscotrip/" : "/");
    }

    resolvePath(path) {
      if (!path) return "";
      const raw = String(path).trim();
      if (/^(https?:)?\/\//i.test(raw) || raw.startsWith("data:")) return raw;
      if (raw.startsWith("/")) return raw;
      let clean = raw.replace(/^\.\//, "");
      const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
      const localizable = ["tours-cusco.json", "tours-machu-picchu.json", "tours-peru.json", "packages-cusco.json", "packages-peru.json", "trekkings-cusco.json"];
      const filename = clean.split("/").pop();
      if (locale !== "es" && clean.startsWith("assets/data/") && localizable.includes(filename)) {
        clean = `assets/data/i18n/${locale}/${filename}`;
        return `${this.basePath}${clean}`.replace(/([^:]\/)\/{2,}/g, "$1");
      }
      if (locale !== "es" && clean.endsWith(".html") || (locale !== "es" && clean.includes(".html?"))) {
        return `${this.basePath}${locale}/${clean}`.replace(/([^:]\/)\/{2,}/g, "$1");
      }
      return `${this.basePath}${clean}`.replace(/([^:]\/)\/{2,}/g, "$1");
    }

    async waitForI18nReady() {
      const hasDictionary = window.MyCuscoTripI18n?.dictionary && Object.keys(window.MyCuscoTripI18n.dictionary).length;
      if (hasDictionary) return;
      await new Promise((resolve) => {
        let done = false;
        const finish = () => { if (!done) { done = true; resolve(); } };
        window.addEventListener("mct:i18n-ready", finish, { once: true });
        setTimeout(finish, 900);
      });
    }

    async init() {
      await this.waitForI18nReady();
      this.renderLoading();
      try {
        const data = await this.loadFeaturedData();
        this.catalog = this.normalizeCatalog(data);
        const featured = this.getFeaturedMachuPicchuItems(this.catalog);
        this.renderProducts(featured);
      } catch (error) {
        console.error("Error cargando experiencias destacadas:", error);
        this.renderEmpty("No se pudieron cargar las experiencias destacadas.");
      }
    }

    async fetchJson(path) {
      const url = this.resolvePath(path);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`No se pudo cargar ${path}: ${response.status}`);
      }
      return response.json();
    }

    async fetchOptionalJson(path) {
      try {
        return await this.fetchJson(path);
      } catch (error) {
        console.warn(`Catálogo opcional no disponible: ${path}`, error);
        return null;
      }
    }

    async loadFeaturedData() {
      const [toursCusco, toursMachuPicchu, packagesCusco] = await Promise.all([
        this.fetchOptionalJson("assets/data/tours-cusco.json"),
        this.fetchOptionalJson("assets/data/tours-machu-picchu.json"),
        this.fetchOptionalJson("assets/data/packages-cusco.json")
      ]);

      return { toursCusco, toursMachuPicchu, packagesCusco };
    }

    normalizeCatalog(data) {
      const items = [];

      this.extractTours(data.toursCusco).forEach((item) => {
        items.push(this.normalizeTour(item, "tours-cusco"));
      });

      this.extractTours(data.toursMachuPicchu).forEach((item) => {
        items.push(this.normalizeTour(item, "tours-machu-picchu"));
      });

      this.extractPackageCards(data.packagesCusco).forEach((item) => {
        items.push(this.normalizePackageCard(item, data.packagesCusco, "packages-cusco"));
      });

      return items.filter(Boolean);
    }

    extractTours(source) {
      if (Array.isArray(source)) return source;
      if (Array.isArray(source?.tours)) return source.tours;
      if (Array.isArray(source?.products)) return source.products;
      return [];
    }

    extractPackageCards(source) {
      if (Array.isArray(source?.packageCards)) return source.packageCards;
      if (Array.isArray(source?.packages)) return source.packages;
      if (Array.isArray(source)) return source.filter((item) => item?.productKind === "package");
      return [];
    }

    normalizeTour(item, source) {
      if (!item || !item.slug) return null;
      return {
        id: item.id || item.internalCode || item.slug,
        internalCode: item.internalCode || "",
        slug: item.slug,
        title: item.title || item.name || "Experiencia",
        productKind: item.productKind || "tour",
        productFamily: item.productFamily || item.category || "tour",
        category: item.category || "",
        status: item.status || "published",
        featured: Boolean(item.featured),
        badge: item.badge || item.typeLabel || "Experiencia",
        location: item.location || item.destinationLabel || "Cusco",
        typeLabel: item.typeLabel || item.duration?.label || item.durationLabel || "Tour",
        days: Number(item.days || item.duration?.days || 1),
        nights: Number(item.nights || 0),
        shortDescription: item.shortDescription || item.description || "Experiencia organizada por My Cusco Trip.",
        image: this.getImage(item),
        price: this.getDisplayPrice(item),
        currency: item.currency || this.getDisplayPrice(item)?.currency || "USD",
        search: item.search || {},
        raw: item,
        source
      };
    }

    normalizePackageCard(card, config, source) {
      if (!card || !card.slug) return null;
      return {
        id: card.id || card.slug,
        internalCode: card.internalCode || "",
        slug: card.slug,
        title: card.title || "Paquete Cusco",
        productKind: card.productKind || "package",
        productFamily: card.productFamily || "cusco-package",
        category: card.category || "packages",
        status: card.status || config?.status || "published",
        featured: Boolean(card.featured),
        badge: card.badge || card.typeLabel || "Paquete",
        location: card.location || "Cusco / Machu Picchu",
        typeLabel: card.typeLabel || `${card.days || ""} días`.trim(),
        days: Number(card.days || 0),
        nights: Number(card.nights || 0),
        shortDescription: card.shortDescription || "Paquete dinámico para viajar a Cusco y Machu Picchu.",
        image: this.getImage(card),
        price: null,
        currency: config?.defaultCurrency || card.currency || "USD",
        search: card.search || {},
        raw: card,
        source
      };
    }

    getImage(item) {
      const candidates = [
        item?.images?.cover,
        item?.image,
        item?.cover,
        item?.imageUrl,
        item?.thumbnail,
        ...(Array.isArray(item?.images?.gallery) ? item.images.gallery : [])
      ].filter(Boolean);

      return candidates.length ? this.resolvePath(candidates[0]) : this.resolvePath("assets/img/quote/fallbacks/machu-picchu.jpg");
    }

    getDisplayPrice(item) {
      const byNationality = item?.basePricingByNationality || {};
      const preferred = byNationality.foreign || byNationality.national || byNationality.andean_community;
      const adult = Number(preferred?.adult ?? item?.basePricing?.adult ?? item?.price ?? item?.adultPrice ?? 0);
      const currency = preferred?.currency || item?.basePricing?.currency || item?.currency || "USD";
      if (!adult) return null;
      return { amount: adult, currency };
    }

    getFeaturedMachuPicchuItems(catalog) {
      const published = catalog.filter((item) => String(item.status || "published").toLowerCase() !== "draft");
      const tours = published.filter((item) => item.productKind === "tour");
      const machuTours = tours.filter((item) => this.isMachuPicchuItem(item));

      let candidates = machuTours.filter((item) => item.featured);
      if (candidates.length < this.limit) {
        candidates = this.uniqueBySlug([...candidates, ...machuTours]);
      }

      candidates.sort((a, b) => this.getCommercialOrder(a) - this.getCommercialOrder(b));
      return candidates.slice(0, this.limit);
    }

    isMachuPicchuItem(item) {
      const haystack = [
        item.internalCode,
        item.title,
        item.slug,
        item.category,
        item.productFamily,
        item.location,
        ...(Array.isArray(item.search?.destinations) ? item.search.destinations : []),
        ...(Array.isArray(item.search?.includedTags) ? item.search.includedTags : []),
        ...(Array.isArray(item.search?.keywords) ? item.search.keywords : [])
      ].join(" ").toLowerCase();

      return haystack.includes("machu") || haystack.includes("mapi");
    }

    getCommercialOrder(item) {
      const code = String(item.internalCode || "").toUpperCase();
      const order = ["MAPI001", "MAPI002", "MAPI003", "MAPI004", "MAPI005", "MAPI006", "MAPI007", "MAPI008", "MAPI009", "MAPI010"];
      const index = order.indexOf(code);
      if (index >= 0) return index;
      if (item.featured) return 50;
      return 100;
    }

    uniqueBySlug(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = item.slug || item.id || item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    t(key, fallback = "") {
      return window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
    }

    translateVisibleLabel(value) {
      const locale = window.MyCuscoTripI18n?.getLocaleFromUrl?.() || "es";
      if (locale === "es") return value;
      const key = String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const map = {
        "nuevo": "New",
        "imperdible": "Must-see",
        "top ventas": "Best seller",
        "mas vendido": "Best seller",
        "recomendado": "Recommended",
        "aventura": "Adventure",
        "naturaleza": "Nature",
        "cultural": "Cultural",
        "con tren": "Train included",
        "ruta vip": "VIP route",
        "conexion machu picchu": "Machu Picchu connection",
        "vip + conexion": "VIP + connection",
        "completo": "Complete",
        "escapada esencial": "Essential escape",
        "gran viaje": "Grand journey",
        "experiencia amplia": "Full experience",
        "profundo": "Deep route",
        "flexible": "Flexible"
      };
      return map[key] || value;
    }

    renderLoading() {
      this.container.innerHTML = `
        <div class="featured-products-empty" style="grid-column:1/-1;text-align:center;padding:32px 16px;color:#56645f;">
          ${this.t("home.loadingFeatured", "Cargando experiencias destacadas...")}
        </div>
      `;
    }

    renderEmpty(message = this.t("home.noFeatured", "No hay experiencias destacadas todavía.")) {
      this.container.innerHTML = `
        <div class="featured-products-empty" style="grid-column:1/-1;text-align:center;padding:32px 16px;color:#56645f;">
          ${this.escapeHtml(message)}
        </div>
      `;
    }

    renderProducts(items) {
      if (!items.length) {
        this.renderEmpty();
        return;
      }

      this.container.innerHTML = items.map((item) => this.renderCard(item)).join("");
    }

    renderCard(item) {
      const optionParam = item.productKind === "package" ? "&option=0" : "";
      const href = this.resolvePath(`product.html?slug=${encodeURIComponent(item.slug)}${optionParam}`);
      const image = this.resolvePath(item.image || "assets/img/quote/fallbacks/machu-picchu.jpg");
      const price = item.price ? `${item.price.currency} ${this.formatMoney(item.price.amount)}` : this.t("cards.flexibleQuote", "Cotización flexible");
      const description = this.truncate(item.shortDescription, 118);

      return `
        <article class="destino-card product-card featured-product-card featured-home-card" data-product-slug="${this.escapeHtml(item.slug)}">
          <a class="product-card__media" href="${this.escapeHtml(href)}" aria-label="${this.escapeHtml(this.t("cards.viewExperience", "Ver experiencia"))} ${this.escapeHtml(item.title)}">
            <img
              src="${this.escapeHtml(image)}"
              alt="${this.escapeHtml(item.title)}"
              loading="lazy"
              onerror="this.onerror=null;this.src='${this.escapeHtml(this.resolvePath("assets/img/quote/fallbacks/machu-picchu.jpg"))}';"
            >
            ${item.badge ? `<span class="product-card__badge">${this.escapeHtml(this.translateVisibleLabel(item.badge))}</span>` : ""}
          </a>
          <div class="product-card__body destino-content">
            <div class="product-card__meta">
              <span><i class="fa-solid fa-location-dot"></i> ${this.escapeHtml(item.location)}</span>
              <span><i class="fa-regular fa-clock"></i> ${this.escapeHtml(this.translateVisibleLabel(item.typeLabel))}</span>
            </div>
            <h3>${this.escapeHtml(item.title)}</h3>
            <p>${this.escapeHtml(description)}</p>
            <div class="product-card__footer">
              <div class="product-card__price">
                <small>${this.escapeHtml(this.t("cards.from", "Desde"))}</small>
                <strong>${this.escapeHtml(price)}</strong>
              </div>
              <a class="btn product-card__cta" href="${this.escapeHtml(href)}">${this.escapeHtml(this.t("cards.viewExperience", "Ver experiencia"))}</a>
            </div>
          </div>
        </article>
      `;
    }

    formatMoney(amount) {
      return Number(amount || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    truncate(text, maxLength) {
      const clean = String(text || "").replace(/\s+/g, " ").trim();
      if (clean.length <= maxLength) return clean;
      return `${clean.slice(0, maxLength - 1).trim()}…`;
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

  window.MyCuscoTripProducts = MyCuscoTripProducts;
})();
