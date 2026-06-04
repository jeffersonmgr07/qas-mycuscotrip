"use strict";

/**
 * My Cusco Trip - Hotel Service
 * Selección y cálculo de hoteles por destino real de pernocte.
 * Usa precios publicados. No expone costos netos ni campos internos al cliente.
 */

(function () {
  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getHotelsRoot(allData) {
    const data = getDataPayload(allData || {});
    return data?.hotels || data;
  }

  function getHotelDestinations(allData) {
    const root = getHotelsRoot(allData);
    return root?.destinations || {};
  }

  function getPassengers(params = {}) {
    const adults = Number(params.adults || 1);
    const children = Number(params.children || 0);

    return {
      adults: Number.isFinite(adults) && adults > 0 ? adults : 1,
      children: Number.isFinite(children) && children > 0 ? children : 0,
      total: (Number.isFinite(adults) && adults > 0 ? adults : 1) + (Number.isFinite(children) && children > 0 ? children : 0)
    };
  }

  function resolveHotelDestination(destination, allData) {
    if (window.MyCuscoTripDestinationService) {
      return window.MyCuscoTripDestinationService.resolveHotelDestination(destination, allData);
    }

    if (destination === "machu-picchu") return "aguas-calientes";
    if (destination === "valle-sagrado") return "cusco";

    return destination;
  }

  function getHotelsByDestination(destination, allData) {
    const hotelDestinations = getHotelDestinations(allData);
    const hotelDestinationKey = resolveHotelDestination(destination, allData);
    const destinationNode = hotelDestinations[hotelDestinationKey];

    if (!destinationNode || !Array.isArray(destinationNode.hotels)) {
      return [];
    }

    return destinationNode.hotels
      .filter((hotel) => hotel.status === "published")
      .map((hotel) => sanitizeHotelForCustomer(hotel));
  }

  function sanitizeHotelForCustomer(hotel) {
    if (!hotel || typeof hotel !== "object") return null;

    return {
      hotelCode: hotel.hotelCode,
      hotelName: hotel.hotelName,
      stars: hotel.stars,
      destination: hotel.destination,
      destinationLabel: hotel.destinationLabel,
      location: hotel.location,
      address: hotel.address,
      summary: hotel.summary,
      status: hotel.status,
      recommendedForPackages: hotel.recommendedForPackages,
      features: hotel.features || [],
      amenities: hotel.amenities || {},
      images: hotel.images || {},
      rooms: Array.isArray(hotel.rooms)
        ? hotel.rooms.map(sanitizeRoomForCustomer).filter(Boolean)
        : []
    };
  }

  function sanitizeRoomForCustomer(room) {
    if (!room || typeof room !== "object") return null;

    return {
      roomType: room.roomType,
      label: room.label,
      bedType: room.bedType,
      capacity: Number(room.capacity || 1),
      maxAdults: Number(room.maxAdults || room.capacity || 1),
      maxChildren: Number(room.maxChildren || 0),
      publishedPricing: {
        currency: room.publishedPricing?.currency || "USD",
        amount: Number(room.publishedPricing?.amount || 0),
        penApprox: room.publishedPricing?.penApprox || null,
        pricingIncludesPaymentFees: Boolean(room.publishedPricing?.pricingIncludesPaymentFees)
      }
    };
  }

  function calculateNightsByDestination(itinerary = [], packageDays = 0, allData) {
    const nightsByDestination = {};

    if (!Array.isArray(itinerary) || !itinerary.length) {
      return nightsByDestination;
    }

    itinerary.forEach((day, index) => {
      if (index >= Number(packageDays || itinerary.length) - 1) return;

      const destination = inferOvernightDestinationFromDay(day, allData);
      if (!destination) return;

      const hotelDestination = resolveHotelDestination(destination, allData);
      nightsByDestination[hotelDestination] = (nightsByDestination[hotelDestination] || 0) + 1;
    });

    return nightsByDestination;
  }

  function inferOvernightDestinationFromDay(day, allData) {
    const items = Array.isArray(day?.items) ? day.items : [];
    const codes = items.map((item) => String(item.code || "")).filter(Boolean);

    if (codes.some((code) => /^MAPI/i.test(code))) {
      const hasOvernight = items.some((item) => {
        const title = String(item.title || "").toLowerCase();
        return title.includes("overnight") || title.includes("aguas calientes") || title.includes("machu picchu pueblo");
      });

      if (hasOvernight) return "aguas-calientes";
    }

    if (items.some((item) => String(item.title || "").toLowerCase().includes("aguas calientes"))) {
      return "aguas-calientes";
    }

    if (items.some((item) => String(item.title || "").toLowerCase().includes("lima"))) {
      return "lima";
    }

    if (items.some((item) => String(item.title || "").toLowerCase().includes("arequipa"))) {
      return "arequipa";
    }

    if (items.some((item) => String(item.title || "").toLowerCase().includes("puno"))) {
      return "puno";
    }

    return "cusco";
  }

  function resolveAccommodationPlan(packageOption, itinerary = [], params = {}, allData) {
    const days = Number(packageOption?.days || params.days || 0);
    const nights = Number(packageOption?.nights || params.nights || Math.max(days - 1, 0));

    let nightsByDestination = calculateNightsByDestination(itinerary, days, allData);

    if (!Object.keys(nightsByDestination).length && nights > 0) {
      nightsByDestination = {
        cusco: nights
      };
    }

    return Object.entries(nightsByDestination).map(([destination, destinationNights]) => ({
      destination,
      label: window.MyCuscoTripDestinationService
        ? window.MyCuscoTripDestinationService.getDestinationLabel(destination, allData)
        : destination,
      nights: destinationNights,
      hotels: getHotelsByDestination(destination, allData)
    }));
  }

  function getRoomOptions(hotel, passengersInput = {}) {
    const passengers = typeof passengersInput === "number"
      ? { total: passengersInput }
      : getPassengers(passengersInput);

    const rooms = Array.isArray(hotel?.rooms) ? hotel.rooms : [];

    return rooms.filter((room) => {
      return Number(room.capacity || 0) >= passengers.total;
    });
  }

  function getRoomPrice(room) {
    const amount = Number(room?.publishedPricing?.amount || 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function calculateHotelTotal(selection, nights = 1) {
    if (!selection) return 0;

    const room = selection.room || selection;
    const quantity = Number(selection.quantity || 1);
    const totalNights = Number(nights || selection.nights || 1);

    return getRoomPrice(room) * quantity * totalNights;
  }

  function calculateHotelPerPerson(selection, passengersInput = {}, nights = 1) {
    const passengers = typeof passengersInput === "number"
      ? { total: passengersInput }
      : getPassengers(passengersInput);

    const total = calculateHotelTotal(selection, nights);

    if (!passengers.total) return total;

    return total / passengers.total;
  }

  function generateRoomCombinations(hotel, passengersInput = {}, nights = 1) {
    const passengers = getPassengers(passengersInput);
    const rooms = Array.isArray(hotel?.rooms) ? hotel.rooms : [];

    const validSingleRoomOptions = rooms
      .filter((room) => Number(room.capacity || 0) >= passengers.total)
      .map((room) => buildCombination([room], passengers.total, nights));

    const combinations = [...validSingleRoomOptions];

    rooms.forEach((roomA) => {
      rooms.forEach((roomB) => {
        const capacity = Number(roomA.capacity || 0) + Number(roomB.capacity || 0);

        if (capacity >= passengers.total) {
          combinations.push(buildCombination([roomA, roomB], passengers.total, nights));
        }
      });
    });

    return dedupeCombinations(combinations)
      .sort((a, b) => a.totalPerNight - b.totalPerNight);
  }

  function buildCombination(rooms, passengerTotal, nights) {
    const totalPerNight = rooms.reduce((sum, room) => sum + getRoomPrice(room), 0);
    const total = totalPerNight * Number(nights || 1);

    return {
      key: rooms.map((room) => room.roomType).sort().join("+"),
      label: rooms.map((room) => room.label).join(" + "),
      rooms,
      totalRooms: rooms.length,
      capacity: rooms.reduce((sum, room) => sum + Number(room.capacity || 0), 0),
      currency: rooms[0]?.publishedPricing?.currency || "USD",
      totalPerNight,
      total,
      additionalPerPerson: passengerTotal ? total / passengerTotal : total
    };
  }

  function dedupeCombinations(combinations = []) {
    const seen = new Set();

    return combinations.filter((combo) => {
      if (seen.has(combo.key)) return false;
      seen.add(combo.key);
      return true;
    });
  }

  window.MyCuscoTripHotelService = {
    getHotelsByDestination,
    sanitizeHotelForCustomer,
    sanitizeRoomForCustomer,
    resolveAccommodationPlan,
    calculateNightsByDestination,
    getRoomOptions,
    generateRoomCombinations,
    calculateHotelTotal,
    calculateHotelPerPerson
  };
})();
