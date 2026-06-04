class RestaurantsDirectory {
  constructor() {
    this.restaurants = [];
    this.filteredRestaurants = [];
    this.activeRestaurant = null;
    this.activeGalleryImages = [];
    this.data = null;

    this.elements = {
      grid: document.getElementById("restaurantsGrid"),
      empty: document.getElementById("restaurantsEmpty"),
      count: document.getElementById("restaurantsCount"),
      search: document.getElementById("restaurantSearch"),
      cuisine: document.getElementById("restaurantCuisine"),
      area: document.getElementById("restaurantArea"),
      sort: document.getElementById("restaurantSort"),
      reset: document.getElementById("restaurantsReset"),
      detailsModal: document.getElementById("restaurantDetailsModal"),
      detailsContent: document.getElementById("restaurantDetailsContent"),
      reservationModal: document.getElementById("restaurantReservationModal"),
      reservationTitle: document.getElementById("restaurantReservationTitle"),
      reservationForm: document.getElementById("restaurantReservationForm"),
      reservationTime: document.getElementById("restaurantReservationTime")
    };

    this.init();
  }

  async init() {
    await this.loadRestaurants();
    this.populateFilters();
    this.populateReservationTimes();
    this.bindEvents();
    this.applyFilters();
  }

  async loadRestaurants() {
    try {
      const response = await fetch("restaurantes/restaurantes.json", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo cargar restaurantes.json");
      this.data = await response.json();
      this.restaurants = Array.isArray(this.data.restaurants) ? this.data.restaurants : [];
    } catch (error) {
      console.error("Error cargando restaurantes:", error);
      this.restaurants = [];
      this.data = { whatsapp: "51900608980" };
    }
  }

  populateFilters() {
    const cuisines = new Set();
    const areas = new Set();

    this.restaurants.forEach((restaurant) => {
      (restaurant.cuisine || []).forEach((item) => cuisines.add(item));
      if (restaurant.area) areas.add(restaurant.area);
    });

    this.fillSelect(this.elements.cuisine, "Todas las cocinas", [...cuisines].sort());
    this.fillSelect(this.elements.area, "Todas las zonas", [...areas].sort());
  }

  fillSelect(select, defaultLabel, options) {
    if (!select) return;
    select.innerHTML = [
      `<option value="">${this.escapeHtml(defaultLabel)}</option>`,
      ...options.map((option) => `<option value="${this.escapeHtml(option)}">${this.escapeHtml(option)}</option>`)
    ].join("");
  }

  populateReservationTimes() {
    const select = this.elements.reservationTime;
    if (!select) return;

    const options = ['<option value="">Selecciona horario</option>'];
    for (let hour = 11; hour <= 23; hour += 1) {
      ['00', '30'].forEach((minute) => {
        if (hour === 23 && minute === '30') return;
        const value = `${String(hour).padStart(2, '0')}:${minute}`;
        options.push(`<option value="${value}">${value}</option>`);
      });
    }

    select.innerHTML = options.join('');
  }

  bindEvents() {
    [this.elements.search, this.elements.cuisine, this.elements.area, this.elements.sort].forEach((element) => {
      element?.addEventListener("input", () => this.applyFilters());
      element?.addEventListener("change", () => this.applyFilters());
    });

    this.elements.reset?.addEventListener("click", () => {
      if (this.elements.search) this.elements.search.value = "";
      if (this.elements.cuisine) this.elements.cuisine.value = "";
      if (this.elements.area) this.elements.area.value = "";
      if (this.elements.sort) this.elements.sort.value = "featured";
      this.applyFilters();
    });

    document.addEventListener("click", (event) => {
      const detailsButton = event.target.closest("[data-restaurant-details]");
      if (detailsButton) {
        this.openDetails(detailsButton.dataset.restaurantDetails);
        return;
      }

      const reserveButton = event.target.closest("[data-restaurant-reserve]");
      if (reserveButton) {
        this.openReservation(reserveButton.dataset.restaurantReserve);
        return;
      }

      const galleryButton = event.target.closest("[data-restaurant-gallery-index]");
      if (galleryButton) {
        this.updateMainGalleryImage(Number(galleryButton.dataset.restaurantGalleryIndex || 0));
        return;
      }

      if (event.target.closest("[data-restaurant-modal-close]")) {
        this.closeModals();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.closeModals();
    });

    this.elements.reservationForm?.addEventListener("submit", (event) => this.handleReservationSubmit(event));
  }

  applyFilters() {
    const query = this.normalize(this.elements.search?.value || "");
    const cuisine = this.elements.cuisine?.value || "";
    const area = this.elements.area?.value || "";
    const sort = this.elements.sort?.value || "featured";

    this.filteredRestaurants = this.restaurants.filter((restaurant) => {
      const haystack = this.normalize([
        restaurant.name,
        restaurant.type,
        restaurant.area,
        restaurant.address,
        restaurant.shortDescription,
        ...(restaurant.cuisine || []),
        ...(restaurant.highlights || []),
        ...(restaurant.idealFor || [])
      ].filter(Boolean).join(" "));

      const matchesQuery = !query || haystack.includes(query);
      const matchesCuisine = !cuisine || (restaurant.cuisine || []).includes(cuisine);
      const matchesArea = !area || restaurant.area === area;

      return matchesQuery && matchesCuisine && matchesArea;
    });

    this.sortRestaurants(sort);
    this.renderCards();
  }

  sortRestaurants(sort) {
    const compareBy = (key) => (a, b) => String(a[key] || "").localeCompare(String(b[key] || ""), "es");

    if (sort === "name") this.filteredRestaurants.sort(compareBy("name"));
    if (sort === "area") this.filteredRestaurants.sort(compareBy("area"));
    if (sort === "cuisine") {
      this.filteredRestaurants.sort((a, b) => String((a.cuisine || [])[0] || "").localeCompare(String((b.cuisine || [])[0] || ""), "es"));
    }
  }

  renderCards() {
    if (!this.elements.grid) return;

    if (this.elements.count) {
      const total = this.filteredRestaurants.length;
      this.elements.count.textContent = `${total} restaurante${total === 1 ? "" : "s"} en la selección`;
    }

    this.elements.empty.hidden = this.filteredRestaurants.length > 0;

    this.elements.grid.innerHTML = this.filteredRestaurants.map((restaurant) => this.renderCard(restaurant)).join("");
  }

  renderCard(restaurant) {
    const image = this.getCoverImage(restaurant);
    const cuisine = (restaurant.cuisine || []).slice(0, 3);

    return `
      <article class="restaurant-card">
        <div class="restaurant-card__media">
          ${image
            ? `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(restaurant.name)}" loading="lazy" />`
            : `<div class="restaurant-placeholder" aria-hidden="true">${this.escapeHtml(this.getInitials(restaurant.name))}</div>`}
          <span class="restaurant-card__tag">${this.escapeHtml(restaurant.type || "Restaurante")}</span>
        </div>
        <div class="restaurant-card__body">
          <h3>${this.escapeHtml(restaurant.name)}</h3>
          <div class="restaurant-card__meta"><i class="fas fa-location-dot"></i><span>${this.escapeHtml(restaurant.area || "Cusco")} · ${this.escapeHtml(restaurant.address || "Dirección por confirmar")}</span></div>
          <p class="restaurant-card__description">${this.escapeHtml(restaurant.shortDescription || restaurant.details || "Restaurante recomendado en Cusco.")}</p>
          <div class="restaurant-card__chips">
            ${cuisine.map((item) => `<span class="restaurant-chip">${this.escapeHtml(item)}</span>`).join("")}
          </div>
          <div class="restaurant-card__actions">
            <button type="button" class="restaurant-btn restaurant-btn--outline" data-restaurant-details="${this.escapeHtml(restaurant.id)}">Ver detalles</button>
            <button type="button" class="restaurant-btn restaurant-btn--primary" data-restaurant-reserve="${this.escapeHtml(restaurant.id)}">Reservar</button>
          </div>
        </div>
      </article>
    `;
  }

  openDetails(id) {
    const restaurant = this.findRestaurant(id);
    if (!restaurant || !this.elements.detailsModal || !this.elements.detailsContent) return;

    this.activeRestaurant = restaurant;
    this.activeGalleryImages = this.getGalleryImages(restaurant);
    this.elements.detailsContent.innerHTML = this.renderDetails(restaurant);
    this.elements.detailsModal.hidden = false;
    document.body.classList.add("restaurant-modal-open");

    if (window.MCTTracking?.track) {
      window.MCTTracking.track("restaurant_details_open", {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name
      });
    }
  }

  renderDetails(restaurant) {
    const images = this.activeGalleryImages;
    const hasImages = images.length > 0;
    const mainImage = hasImages ? images[0] : "";
    const menuLink = restaurant.menuPdf || restaurant.menuUrl || "";
    const websiteLink = restaurant.officialUrl || "";
    const mapLink = restaurant.mapUrl || "";

    return `
      <div class="restaurant-detail">
        <div class="restaurant-detail-gallery">
          <div class="restaurant-detail-gallery__main" id="restaurantMainGalleryImage">
            ${mainImage
              ? `<img src="${this.escapeHtml(mainImage)}" alt="${this.escapeHtml(restaurant.name)}" />`
              : `<div class="restaurant-placeholder" aria-hidden="true">${this.escapeHtml(this.getInitials(restaurant.name))}</div>`}
          </div>
          <div class="restaurant-detail-gallery__thumbs">
            ${hasImages
              ? images.slice(0, 6).map((image, index) => `
                  <button type="button" class="restaurant-detail-gallery__thumb" data-restaurant-gallery-index="${index}" aria-label="Ver foto ${index + 1}">
                    <img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(restaurant.name)} ${index + 1}" />
                  </button>
                `).join("")
              : `<div class="restaurant-detail-gallery__thumb"><div class="restaurant-placeholder" aria-hidden="true">${this.escapeHtml(this.getInitials(restaurant.name))}</div></div>`}
          </div>
        </div>
        <div class="restaurant-detail__body">
          <span class="restaurant-modal-kicker">${this.escapeHtml(restaurant.type || "Restaurante")}</span>
          <h3>${this.escapeHtml(restaurant.name)}</h3>
          <div class="restaurant-detail__chips">
            ${(restaurant.cuisine || []).map((item) => `<span class="restaurant-chip">${this.escapeHtml(item)}</span>`).join("")}
          </div>
          <p class="restaurant-detail__text">${this.escapeHtml(restaurant.details || restaurant.shortDescription || "Restaurante recomendado en Cusco.")}</p>
          ${this.renderIdealFor(restaurant)}
          <div class="restaurant-detail__info">
            <div class="restaurant-detail__info-row"><i class="fas fa-location-dot"></i><span>${this.escapeHtml(restaurant.address || "Dirección por confirmar")}</span></div>
            <div class="restaurant-detail__info-row"><i class="fas fa-map"></i><span>${this.escapeHtml(restaurant.area || "Cusco")}</span></div>
            <div class="restaurant-detail__info-row"><i class="fas fa-clock"></i><span>${this.escapeHtml(restaurant.schedule || "Verificar horario antes de reservar")}</span></div>
            ${restaurant.phone ? `<div class="restaurant-detail__info-row"><i class="fas fa-phone"></i><span>${this.escapeHtml(restaurant.phone)}</span></div>` : ""}
          </div>
          <div class="restaurant-detail__actions">
            ${menuLink ? `<a class="restaurant-btn restaurant-btn--outline" href="${this.escapeHtml(menuLink)}" target="_blank" rel="noopener"><i class="fas fa-book-open"></i> Ver carta</a>` : `<span class="restaurant-btn restaurant-btn--outline" aria-disabled="true"><i class="fas fa-book-open"></i> Carta pendiente</span>`}
            ${mapLink ? `<a class="restaurant-btn restaurant-btn--outline" href="${this.escapeHtml(mapLink)}" target="_blank" rel="noopener"><i class="fas fa-location-arrow"></i> Ubicación</a>` : ""}
            ${websiteLink ? `<a class="restaurant-btn restaurant-btn--outline" href="${this.escapeHtml(websiteLink)}" target="_blank" rel="noopener"><i class="fas fa-globe"></i> Web</a>` : ""}
            <button type="button" class="restaurant-btn restaurant-btn--primary" data-restaurant-reserve="${this.escapeHtml(restaurant.id)}"><i class="fab fa-whatsapp"></i> Reservar</button>
          </div>
        </div>
      </div>
    `;
  }

  renderIdealFor(restaurant) {
    const items = restaurant.idealFor || restaurant.highlights || [];
    if (!items.length) return "";

    return `
      <div class="restaurant-detail__chips">
        ${items.map((item) => `<span class="restaurant-chip">Ideal: ${this.escapeHtml(item)}</span>`).join("")}
      </div>
    `;
  }

  updateMainGalleryImage(index) {
    const image = this.activeGalleryImages[index];
    const main = document.getElementById("restaurantMainGalleryImage");
    if (!image || !main || !this.activeRestaurant) return;
    main.innerHTML = `<img src="${this.escapeHtml(image)}" alt="${this.escapeHtml(this.activeRestaurant.name)}" />`;
  }

  openReservation(id) {
    const restaurant = this.findRestaurant(id);
    if (!restaurant || !this.elements.reservationModal) return;

    this.activeRestaurant = restaurant;
    if (this.elements.reservationTitle) {
      this.elements.reservationTitle.textContent = `Reservar ${restaurant.name}`;
    }

    const restaurantInput = this.elements.reservationForm?.querySelector("[name='restaurant']");
    if (restaurantInput) restaurantInput.value = restaurant.name;

    const dateInput = this.elements.reservationForm?.querySelector("[name='date']");
    if (dateInput) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      dateInput.min = `${yyyy}-${mm}-${dd}`;
    }

    if (this.elements.detailsModal) this.elements.detailsModal.hidden = true;
    this.elements.reservationModal.hidden = false;
    document.body.classList.add("restaurant-modal-open");

    if (window.MCTTracking?.track) {
      window.MCTTracking.track("restaurant_reservation_open", {
        restaurant_id: restaurant.id,
        restaurant_name: restaurant.name
      });
    }
  }

  handleReservationSubmit(event) {
    event.preventDefault();
    if (!this.activeRestaurant || !this.elements.reservationForm) return;

    const formData = new FormData(this.elements.reservationForm);
    const diners = formData.get("diners") || "";
    const date = formData.get("date") || "";
    const time = formData.get("time") || "";
    const name = formData.get("name") || "";
    const whatsapp = formData.get("whatsapp") || "";
    const preference = formData.get("preference") || "Sin preferencia";
    const notes = formData.get("notes") || "";
    const contactNumber = this.data?.whatsapp || "51900608980";

    const message = [
      "Hola My Cusco Trip, quiero solicitar una reserva de restaurante.",
      `Restaurante: ${this.activeRestaurant.name}`,
      `Comensales: ${diners}`,
      `Fecha: ${date}`,
      `Hora: ${time}`,
      `Nombre: ${name}`,
      `WhatsApp: ${whatsapp}`,
      `Preferencia: ${preference}`,
      notes ? `Comentarios: ${notes}` : ""
    ].filter(Boolean).join("\n");

    if (window.MCTTracking?.track) {
      window.MCTTracking.track("restaurant_reservation_request", {
        restaurant_id: this.activeRestaurant.id,
        restaurant_name: this.activeRestaurant.name,
        diners,
        date,
        time
      });
    }

    window.open(`https://wa.me/${contactNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  }

  closeModals() {
    if (this.elements.detailsModal) this.elements.detailsModal.hidden = true;
    if (this.elements.reservationModal) this.elements.reservationModal.hidden = true;
    document.body.classList.remove("restaurant-modal-open");
  }

  findRestaurant(id) {
    return this.restaurants.find((restaurant) => restaurant.id === id);
  }

  getCoverImage(restaurant) {
    return restaurant.coverImage || (Array.isArray(restaurant.gallery) ? restaurant.gallery[0] : "") || "";
  }

  getGalleryImages(restaurant) {
    return [restaurant.coverImage, ...(restaurant.gallery || [])].filter(Boolean).filter((item, index, array) => array.indexOf(item) === index);
  }

  getInitials(name) {
    return String(name || "R")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0])
      .join("")
      .toUpperCase();
  }

  normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
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

function initializeRestaurantsDirectory() {
  if (document.body.classList.contains("restaurants-page")) {
    new RestaurantsDirectory();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeRestaurantsDirectory);
} else {
  initializeRestaurantsDirectory();
}
