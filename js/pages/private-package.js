"use strict";

(function () {
  const state = {
    proposal: null,
    allData: null,
    selections: {}
  };

  const WHATSAPP_DEFAULT = "51900608980";

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(amount, currency = "USD") {
    const value = Number(amount || 0);
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "USD" ? 2 : 0
    }).format(value);
  }

  function normalizePhone(phone) {
    return String(phone || WHATSAPP_DEFAULT).replace(/\D/g, "") || WHATSAPP_DEFAULT;
  }

  function getProductsFromSource(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.products)) return source.products;
    if (Array.isArray(source.tours)) return source.tours;
    if (Array.isArray(source.items)) return source.items;
    return [];
  }

  function getAllTours() {
    const data = state.allData?.data || {};
    return [
      ...getProductsFromSource(data.toursCusco),
      ...getProductsFromSource(data.toursMachuPicchu),
      ...getProductsFromSource(data.toursPeru),
      ...getProductsFromSource(data.trekkingsCusco)
    ];
  }

  function getTourBySlug(slug) {
    return getAllTours().find((tour) => tour.slug === slug) || null;
  }

  function getHotelsByDestination(destination) {
    const hotelsData = state.allData?.data?.hotels;
    const block = hotelsData?.destinations?.[destination];
    return Array.isArray(block?.hotels)
      ? block.hotels.filter((hotel) => hotel.status !== "draft")
      : [];
  }

  function getHotelByCode(destination, hotelCode) {
    return getHotelsByDestination(destination).find((hotel) => hotel.hotelCode === hotelCode) || null;
  }

  function getRoomPrice(room) {
    return Number(room?.publishedPricing?.amount || room?.price || 0);
  }

  function getRoomCurrency(room) {
    return room?.publishedPricing?.currency || state.proposal?.currency || "USD";
  }

  function generateRoomCombinations(rooms, passengers) {
    const validRooms = Array.isArray(rooms)
      ? rooms.filter((room) => Number(room.capacity || 0) > 0)
      : [];

    if (!validRooms.length) return [];

    const maxRooms = Math.min(3, passengers);
    const combos = [];

    function walk(startIndex, picked) {
      const capacity = picked.reduce((sum, room) => sum + Number(room.capacity || 0), 0);
      if (capacity >= passengers) {
        const totalPerNight = picked.reduce((sum, room) => sum + getRoomPrice(room), 0);
        const label = picked.map((room) => room.label || room.roomType || "Habitación").join(" + ");
        combos.push({
          key: picked.map((room, index) => `${room.roomType || room.label || "room"}-${index}`).join("__"),
          rooms: picked,
          label,
          capacity,
          totalRooms: picked.length,
          totalPerNight,
          currency: getRoomCurrency(picked[0])
        });
        return;
      }

      if (picked.length >= maxRooms) return;

      for (let i = startIndex; i < validRooms.length; i += 1) {
        walk(i, [...picked, validRooms[i]]);
      }
    }

    walk(0, []);

    return combos
      .sort((a, b) => {
        const overflowA = a.capacity - passengers;
        const overflowB = b.capacity - passengers;
        if (overflowA !== overflowB) return overflowA - overflowB;
        if (a.totalRooms !== b.totalRooms) return a.totalRooms - b.totalRooms;
        return a.totalPerNight - b.totalPerNight;
      })
      .slice(0, 4);
  }

  function getBestCombo(hotel, passengers) {
    return generateRoomCombinations(hotel?.rooms || [], passengers)[0] || null;
  }

  function collectFeatures(hotel) {
    const features = [];

    if (Array.isArray(hotel?.features)) features.push(...hotel.features);
    if (hotel?.amenities && typeof hotel.amenities === "object") {
      Object.values(hotel.amenities).forEach((value) => {
        if (typeof value === "string" && value.trim()) features.push(value.trim());
      });
    }

    return [...new Set(features)].slice(0, 6);
  }

  function getHotelImage(hotel) {
    return hotel?.images?.cover || hotel?.image || "./assets/img/quote/fallbacks/cusco.jpg";
  }

  function getProposalByParams(privateData) {
    const params = getParams();
    const quote = params.get("quote") || params.get("code") || params.get("slug");
    const token = params.get("token") || "";
    const packages = Array.isArray(privateData?.packages) ? privateData.packages : [];

    const proposal = packages.find((item) => {
      return item.quoteCode === quote || item.slug === quote || item.id === quote;
    }) || packages[0] || null;

    if (!proposal) return null;

    if (proposal.accessToken && token && token !== proposal.accessToken) return null;
    if (proposal.accessToken && !token && quote) return null;

    return proposal;
  }

  function renderUnavailable() {
    document.body.innerHTML = `
      <main class="private-unavailable">
        <div class="private-unavailable__card">
          <h1>Propuesta no disponible</h1>
          <p>El enlace privado no existe, expiró o no tiene el token correcto. Solicita un nuevo enlace a My Cusco Trip.</p>
          <a class="private-btn private-btn--whatsapp" href="https://wa.me/${WHATSAPP_DEFAULT}" target="_blank" rel="noopener">
            <i class="fab fa-whatsapp"></i> Contactar por WhatsApp
          </a>
        </div>
      </main>`;
  }

  function initSelections() {
    const passengers = Number(state.proposal?.passengers?.total || 1);
    (state.proposal?.lodging || []).forEach((item) => {
      const hotels = getHotelsByDestination(item.destination);
      const defaultHotel = getHotelByCode(item.destination, item.defaultHotelCode) || hotels[0] || null;
      if (!defaultHotel) return;
      state.selections[item.destination] = {
        hotelCode: defaultHotel.hotelCode,
        combo: getBestCombo(defaultHotel, passengers)
      };
    });
  }

  function renderHero() {
    const proposal = state.proposal;
    const hero = qs("#privateHero");
    if (hero) {
      hero.style.backgroundImage = `linear-gradient(135deg, rgba(10,58,38,.62), rgba(10,58,38,.18)), url('${proposal.heroImage || "./public/share-image.jpg"}')`;
    }
    qs("#proposalBadge").textContent = proposal.badge || "Propuesta privada";
    qs("#proposalTitle").textContent = proposal.title || "Propuesta privada";
    qs("#proposalSubtitle").textContent = proposal.subtitle || "";

    const meta = qs("#proposalMeta");
    if (meta) {
      meta.innerHTML = [
        ["fa-users", `${proposal.passengers?.total || 1} pasajeros`],
        ["fa-calendar-days", `${proposal.days || ""} días / ${proposal.nights || ""} noches`],
        ["fa-user-shield", proposal.serviceType === "private" ? "Servicio privado" : "Servicio personalizado"],
        ["fa-language", (proposal.language || []).join(" / ").toUpperCase()]
      ].map(([icon, label]) => `<span class="private-meta-pill"><i class="fas ${icon}"></i>${escapeHtml(label)}</span>`).join("");
    }
  }

  function renderClientSummary() {
    const proposal = state.proposal;
    const container = qs("#clientSummary");
    if (!container) return;

    const items = [
      ["Cliente", proposal.client?.displayName || "Cliente privado"],
      ["Pasajeros", `${proposal.passengers?.adults || 0} adultos + ${proposal.passengers?.teens || 0} adolescentes`],
      ["Idioma", (proposal.language || []).join(" / ").toUpperCase()],
      ["Servicio", proposal.serviceType === "private" ? "Solo privado" : "Personalizado"],
      ["Destinos", (proposal.destinations || []).slice(0, 4).join(", ")],
      ["Canal", proposal.client?.contactChannel || "WhatsApp"]
    ];

    container.innerHTML = items.map(([label, value]) => `
      <div class="private-summary-item">
        <small>${escapeHtml(label)}</small>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }

  function renderItinerary() {
    const container = qs("#proposalItinerary");
    if (!container) return;

    container.innerHTML = (state.proposal.itinerary || []).map((day) => `
      <article class="private-day">
        <div class="private-day__image" style="background-image:url('${escapeHtml(day.image || state.proposal.heroImage || "./public/share-image.jpg")}')"></div>
        <div class="private-day__body">
          <span class="private-day__kicker">Día ${escapeHtml(day.day)} · ${escapeHtml(day.overnight || "")}</span>
          <h3>${escapeHtml(day.title)}</h3>
          <ul>${(day.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </article>
    `).join("");
  }

  function renderLodging() {
    const container = qs("#lodgingSelector");
    if (!container) return;

    const passengers = Number(state.proposal?.passengers?.total || 1);
    const currency = state.proposal?.currency || "USD";

    container.innerHTML = (state.proposal.lodging || []).map((item) => {
      const hotels = getHotelsByDestination(item.destination);
      const current = state.selections[item.destination];
      const hotelCards = hotels.map((hotel) => {
        const combo = getBestCombo(hotel, passengers);
        const selected = current?.hotelCode === hotel.hotelCode;
        const features = collectFeatures(hotel);
        const total = combo ? combo.totalPerNight * Number(item.nights || 1) : 0;

        return `
          <button type="button" class="private-hotel-card ${selected ? "is-selected" : ""}" data-destination="${escapeHtml(item.destination)}" data-hotel-code="${escapeHtml(hotel.hotelCode)}">
            <div class="private-hotel-card__top">
              <div>
                <h4>${escapeHtml(hotel.hotelName)}</h4>
                <p>${escapeHtml(hotel.stars ? `${hotel.stars}★ · ${hotel.location || item.label}` : hotel.location || item.label)}</p>
              </div>
              <strong class="private-hotel-card__price">${money(total, currency)}</strong>
            </div>
            <div class="private-hotel-card__image" style="background-image:url('${escapeHtml(getHotelImage(hotel))}')"></div>
            <div class="private-hotel-features">
              ${features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join("")}
            </div>
            <div class="private-hotel-combo">
              <strong>${escapeHtml(combo?.label || "Acomodación por confirmar")}</strong><br>
              ${combo ? `${combo.totalRooms} hab. · ${money(combo.totalPerNight, currency)} por noche · ${item.nights} noche${Number(item.nights) !== 1 ? "s" : ""}` : "Solicitar disponibilidad"}
            </div>
          </button>
        `;
      }).join("");

      return `
        <section class="private-lodging-block">
          <div class="private-lodging-block__header">
            <div>
              <h3>${escapeHtml(item.label || item.destination)}</h3>
              <small>${Number(item.nights || 0)} noche${Number(item.nights || 0) !== 1 ? "s" : ""}</small>
            </div>
            <small>${escapeHtml(item.required ? "Alojamiento requerido" : "Opcional")}</small>
          </div>
          <div class="private-hotel-options">
            ${hotelCards || `<p class="private-muted">No hay hoteles/lodges configurados para este destino.</p>`}
          </div>
        </section>
      `;
    }).join("");

    qsa(".private-hotel-card").forEach((button) => {
      button.addEventListener("click", () => {
        const destination = button.dataset.destination;
        const hotelCode = button.dataset.hotelCode;
        const hotel = getHotelByCode(destination, hotelCode);
        state.selections[destination] = {
          hotelCode,
          combo: getBestCombo(hotel, passengers)
        };
        renderLodging();
        renderPricing();
      });
    });
  }

  function renderLists() {
    const includes = qs("#proposalIncludes");
    const excludes = qs("#proposalExcludes");
    const notes = qs("#proposalNotes");

    if (includes) includes.innerHTML = (state.proposal.includes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    if (excludes) excludes.innerHTML = (state.proposal.excludes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    if (notes) notes.innerHTML = (state.proposal.notes || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function calculatePricing() {
    const proposal = state.proposal;
    const currency = proposal.currency || "USD";
    const passengers = Number(proposal.passengers?.total || 1);
    const basePerPerson = Number(proposal.pricing?.baseServicesPerPerson || 0);
    const baseTotal = basePerPerson * passengers;

    let lodgingTotal = 0;
    const lodgingRows = [];

    (proposal.lodging || []).forEach((item) => {
      const selection = state.selections[item.destination];
      const hotel = selection?.hotelCode ? getHotelByCode(item.destination, selection.hotelCode) : null;
      const combo = selection?.combo;
      const nights = Number(item.nights || 0);
      const total = combo ? Number(combo.totalPerNight || 0) * nights : 0;
      lodgingTotal += total;
      lodgingRows.push({
        label: item.label || item.destination,
        hotelName: hotel?.hotelName || "Por confirmar",
        total
      });
    });

    return {
      currency,
      passengers,
      basePerPerson,
      baseTotal,
      lodgingTotal,
      lodgingRows,
      total: baseTotal + lodgingTotal,
      perPerson: passengers ? (baseTotal + lodgingTotal) / passengers : 0
    };
  }

  function renderPricing() {
    const pricing = calculatePricing();
    qs("#priceTotal").textContent = money(pricing.total, pricing.currency);
    qs("#pricePerPerson").textContent = `${money(pricing.perPerson, pricing.currency)} aprox. por persona`;

    const breakdown = qs("#priceBreakdown");
    if (breakdown) {
      breakdown.innerHTML = `
        <div class="private-breakdown-row"><span>Servicios base privados</span><strong>${money(pricing.baseTotal, pricing.currency)}</strong></div>
        ${pricing.lodgingRows.map((row) => `
          <div class="private-breakdown-row"><span>${escapeHtml(row.label)} · ${escapeHtml(row.hotelName)}</span><strong>${money(row.total, pricing.currency)}</strong></div>
        `).join("")}
        <div class="private-breakdown-row"><span>Vuelos internos</span><strong>No incluidos</strong></div>
      `;
    }

    updateWhatsappLinks(pricing);
  }

  function buildWhatsappText(pricing) {
    const proposal = state.proposal;
    const hotelsText = (proposal.lodging || []).map((item) => {
      const selection = state.selections[item.destination];
      const hotel = selection?.hotelCode ? getHotelByCode(item.destination, selection.hotelCode) : null;
      return `- ${item.label}: ${hotel?.hotelName || "Por confirmar"}`;
    }).join("%0A");

    return [
      `Hola, deseo consultar esta propuesta privada: ${proposal.title}`,
      `Código: ${proposal.quoteCode}`,
      `Pasajeros: ${proposal.passengers?.total || 1}`,
      `Alojamiento seleccionado:`,
      hotelsText,
      `Total estimado: ${money(pricing.total, pricing.currency)}`,
      `Link: ${window.location.href}`
    ].join("%0A");
  }

  function updateWhatsappLinks(pricing) {
    const phone = normalizePhone(state.proposal?.client?.whatsapp || WHATSAPP_DEFAULT);
    const href = `https://wa.me/${phone}?text=${buildWhatsappText(pricing)}`;
    ["#proposalWhatsappTop", "#proposalWhatsappSide"].forEach((selector) => {
      const link = qs(selector);
      if (link) link.href = href;
    });
  }

  async function init() {
    try {
      state.allData = await window.MyCuscoTripDataLoader.loadAllData();
      const privateData = state.allData?.data?.privatePackages || await window.MyCuscoTripDataLoader.loadJson("assets/data/private-packages.json");
      state.proposal = getProposalByParams(privateData);

      if (!state.proposal) {
        renderUnavailable();
        return;
      }

      initSelections();
      renderHero();
      renderClientSummary();
      renderItinerary();
      renderLodging();
      renderLists();
      renderPricing();
    } catch (error) {
      console.error("[PrivatePackage] Error al iniciar propuesta privada:", error);
      renderUnavailable();
    }
  }

  window.MyCuscoTripPrivatePackage = { init };
})();
