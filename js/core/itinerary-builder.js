"use strict";

/**
 * My Cusco Trip - Itinerary Builder
 * Convierte combinaciones de tours en itinerarios por día.
 * No genera paquetes, solo organiza visualmente.
 *
 * Reglas showcase:
 * - Día 1: Transfer IN + Bienvenida Ancestral + City Tour si existen.
 * - Día 2: Valle Sagrado, priorizando conexión/VIP si existe.
 * - Día 3: Machu Picchu, salvo paquetes muy cortos.
 * - Días posteriores: tours adicionales.
 * - Último día: solo Transfer OUT / salida.
 *
 * Reglas dynamic:
 * - Preparado para cotizador futuro con arrivalTime/departureTime.
 */

(function () {
  function createEmptyDays(totalDays) {
    return Array.from({ length: totalDays }, (_, i) => ({
      day: i + 1,
      items: []
    }));
  }

  function insertTransferIn(days, config) {
    if (!days.length || !config?.arrival) return;

    days[0].items.push({
      type: "logistics",
      code: config.arrival.code,
      title: config.arrival.title,
      description: config.arrival.description
    });
  }

  function insertTransferOut(days, config) {
    if (!days.length || !config?.departure) return;

    const lastDay = days[days.length - 1];

    lastDay.items.push({
      type: "logistics",
      code: config.departure.code,
      title: config.departure.title,
      description: config.departure.description
    });
  }

  function getTourCode(tour) {
    return tour?.internalCode || tour?.code || tour?.id || "";
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function t(key, fallback = "") {
    return window.MyCuscoTripI18n?.t?.(key, fallback) || fallback || key;
  }

  function getTourText(tour) {
    return normalizeText([
      tour?.internalCode,
      tour?.code,
      tour?.id,
      tour?.slug,
      tour?.title,
      tour?.shortDescription,
      tour?.description,
      tour?.category,
      tour?.productFamily
    ].filter(Boolean).join(" "));
  }

  function hasText(tour, words = []) {
    const text = getTourText(tour);
    return words.some((word) => text.includes(normalizeText(word)));
  }

  function isWelcomeTour(tour) {
    const code = getTourCode(tour);

    return (
      code === "CUZ001" ||
      hasText(tour, [
        "bienvenida",
        "ancestral",
        "panoramico",
        "panorámico",
        "tour panoramico",
        "tour panorámico"
      ])
    );
  }

  function isCityTour(tour) {
    const code = getTourCode(tour);

    return (
      code === "CUZ002" ||
      hasText(tour, ["city tour", "centros arqueologicos", "centros arqueológicos"])
    );
  }

  function isSacredValley(tour) {
    const code = getTourCode(tour);

    if (code === "CUZ004") {
      return false;
    }

    if (["CUZ003FD", "CUZ003CON", "CUZ003VIP", "CUZ003VIPCON"].includes(code)) {
      return true;
    }

    return hasText(tour, [
      "valle sagrado",
      "pisac",
      "pisaq",
      "ollantaytambo",
      "chinchero",
      "maras",
      "moray"
    ]);
  }

  function isSacredValleyConnection(tour) {
    const code = getTourCode(tour);

    if (["CUZ003CON", "CUZ003VIPCON"].includes(code)) {
      return true;
    }

    if (["CUZ003FD", "CUZ003VIP"].includes(code)) {
      return false;
    }

    return isSacredValley(tour) && hasText(tour, [
      "conexion",
      "conexión",
      "aguas calientes"
    ]);
  }

  function isMachuPicchu(tour) {
    const code = getTourCode(tour);
    return /^MAPI/i.test(code) || hasText(tour, ["machu picchu"]);
  }

  function isMachuPicchuExpress(tour) {
    return isMachuPicchu(tour) && hasText(tour, ["express"]);
  }

  function isHeavyTrekking(tour) {
    return hasText(tour, [
      "montana de colores",
      "montaña de colores",
      "vinicunca",
      "humantay",
      "palcoyo",
      "7 lagunas",
      "siete lagunas",
      "ausangate"
    ]);
  }

  function isLightFirstDayTour(tour) {
    return isWelcomeTour(tour) || isCityTour(tour);
  }


  function isMarasMorayTour(tour) {
    const code = getTourCode(tour);

    return (
      code === "CUZ004" ||
      hasText(tour, ["maras", "moray", "salineras"])
    );
  }

  function isSouthValleyTour(tour) {
    const code = getTourCode(tour);

    return (
      code === "CUZ005" ||
      hasText(tour, ["valle sur", "tipon", "pikillacta", "andahuaylillas"])
    );
  }

  function isShortFlexibleTour(tour) {
    return isWelcomeTour(tour) || isCityTour(tour) || isMarasMorayTour(tour) || isSouthValleyTour(tour);
  }

  function isExclusiveFullDayTour(tour) {
    return (
      isSacredValley(tour) ||
      isMachuPicchu(tour) ||
      isHeavyTrekking(tour) ||
      hasText(tour, ["full day", "dia completo", "día completo"])
    );
  }

  function getTourItemsFromDay(day) {
    return (day?.items || []).filter((item) => item.type === "tour");
  }

  function canPlaceTourOnDay(day, tour) {
    if (!day || !tour) return false;

    const tourItems = getTourItemsFromDay(day);

    if (!tourItems.length) return true;

    const candidateIsShort = isShortFlexibleTour(tour);
    const candidateIsExclusive = isExclusiveFullDayTour(tour);

    if (candidateIsExclusive) return false;

    const existingCodes = new Set(tourItems.map((item) => item.code).filter(Boolean));
    if (existingCodes.has(getTourCode(tour))) return false;

    const existingAllShort = tourItems.every((item) => {
      const pseudoTour = {
        internalCode: item.code,
        title: item.title,
        shortDescription: item.description,
        duration: { label: item.duration }
      };

      return isShortFlexibleTour(pseudoTour) && !isExclusiveFullDayTour(pseudoTour);
    });

    return candidateIsShort && existingAllShort && tourItems.length < 2;
  }

  function findAvailableDayIndex(days, tour, startIndex, lastTourDayIndex) {
    const firstIndex = Math.max(startIndex, 0);
    const finalIndex = Math.min(lastTourDayIndex, days.length - 1);

    for (let index = firstIndex; index <= finalIndex; index += 1) {
      if (canPlaceTourOnDay(days[index], tour)) return index;
    }

    return -1;
  }

  function toItineraryItem(tour) {
    return {
      type: "tour",
      code: getTourCode(tour),
      title: tour?.title || "Actividad",
      description: tour?.shortDescription || tour?.description || "",
      duration: tour?.duration?.label || tour?.typeLabel || ""
    };
  }

  function sameTour(a, b) {
    return getTourCode(a) && getTourCode(a) === getTourCode(b);
  }

  function removeTours(sourceTours, toursToRemove) {
    const removeCodes = new Set(toursToRemove.map(getTourCode).filter(Boolean));

    return sourceTours.filter((tour) => {
      const code = getTourCode(tour);
      return !removeCodes.has(code);
    });
  }

  function addToursToDay(days, dayIndex, tours = []) {
    if (!days[dayIndex]) return;

    tours.forEach((tour) => {
      if (!tour) return;
      days[dayIndex].items.push(toItineraryItem(tour));
    });
  }

  function pickDay1ShowcaseTours(tours = []) {
    const welcome = tours.find(isWelcomeTour);
    const city = tours.find(isCityTour);
    const selected = [];

    if (welcome) selected.push(welcome);

    if (city && !selected.some((tour) => sameTour(tour, city))) {
      selected.push(city);
    }

    if (!selected.length) {
      selected.push(...tours.filter(isLightFirstDayTour).slice(0, 2));
    }

    return selected.slice(0, 2);
  }

  function pickSacredValleyTour(tours = []) {
    return (
      tours.find(isSacredValleyConnection) ||
      tours.find(isSacredValley) ||
      null
    );
  }

  function pickMachuPicchuTour(tours = []) {
    return tours.find(isMachuPicchu) || null;
  }

  function sortAdditionalTours(tours = []) {
    return [...tours].sort((a, b) => {
      const scoreA = getAdditionalTourPriority(a);
      const scoreB = getAdditionalTourPriority(b);

      if (scoreA !== scoreB) return scoreA - scoreB;

      return String(a.title || "").localeCompare(String(b.title || ""), "es");
    });
  }

  function getAdditionalTourPriority(tour) {
    if (isHeavyTrekking(tour)) return 20;
    if (hasText(tour, ["valle sur", "tipon", "pikillacta", "andahuaylillas"])) return 30;
    if (hasText(tour, ["maras", "moray", "salineras"])) return 35;
    if (isLightFirstDayTour(tour)) return 80;
    if (isSacredValley(tour)) return 90;
    if (isMachuPicchu(tour)) return 100;

    return 50;
  }
  
  function getTourDayIndexes(totalDays) {
    if (totalDays <= 1) {
      return {
        firstDayIndex: 0,
        valleyDayIndex: 0,
        machuDayIndex: 0,
        firstAdditionalDayIndex: 0,
        lastTourDayIndex: 0,
        lastDayIndex: 0
      };
    }
  
    const lastDayIndex = totalDays - 1;
    const lastTourDayIndex = Math.max(totalDays - 2, 0);
  
    const machuDayIndex = Math.min(
      Math.max(1, totalDays >= 4 ? 2 : 1),
      lastTourDayIndex
    );
  
    return {
      firstDayIndex: 0,
      valleyDayIndex: totalDays >= 4 ? 1 : 0,
      machuDayIndex,
      firstAdditionalDayIndex: Math.min(machuDayIndex + 1, lastTourDayIndex),
      lastTourDayIndex,
      lastDayIndex
    };
  }

  function getHintedDayIndex(hints, key, fallback, minIndex, maxIndex) {
    const value = Number(hints?.[key]);

    if (!Number.isFinite(value)) {
      return Math.min(Math.max(fallback, minIndex), maxIndex);
    }

    return Math.min(Math.max(value, minIndex), maxIndex);
  }

  function pickValleyConnectionTour(tours = []) {
    return (
      tours.find((tour) => getTourCode(tour) === "CUZ003VIPCON") ||
      tours.find((tour) => getTourCode(tour) === "CUZ003CON") ||
      tours.find(isSacredValleyConnection) ||
      null
    );
  }

  function placeRemainingTours(days, tours = [], startIndex, lastTourDayIndex) {
    if (!tours.length) return;

    let currentDayIndex = Math.max(startIndex, 0);

    sortAdditionalTours(tours).forEach((tour) => {
      const targetDayIndex = findAvailableDayIndex(
        days,
        tour,
        currentDayIndex,
        lastTourDayIndex
      );

      if (targetDayIndex < 0) {
        console.warn(
          "[MyCuscoTrip ItineraryBuilder] Tour omitido por falta de día compatible:",
          getTourCode(tour),
          tour?.title || ""
        );
        return;
      }

      addToursToDay(days, targetDayIndex, [tour]);

      if (isExclusiveFullDayTour(tour)) {
        currentDayIndex = targetDayIndex + 1;
      } else {
        currentDayIndex = targetDayIndex;
      }
    });
  }
  
  function placeShowcaseTours(days, tours = [], context = {}) {
    if (!days.length) return;
  
    let remainingTours = [...tours];
  
    const totalDays = days.length;
    const indexes = getTourDayIndexes(totalDays);
    const hints = context.itineraryHints || {};
    const lastStandardTourDayIndex = indexes.lastTourDayIndex;
  
    let day1Tours = [];
    
    if (hints.day1Mode === "free") {
      day1Tours = [];
    } else if (hints.day1Mode === "valley-connection") {
      const day1ValleyConnectionTour = pickValleyConnectionTour(remainingTours);
      day1Tours = day1ValleyConnectionTour ? [day1ValleyConnectionTour] : [];
    } else {
      day1Tours = pickDay1ShowcaseTours(remainingTours);
    }
    
    addToursToDay(days, indexes.firstDayIndex, day1Tours);
    remainingTours = removeTours(remainingTours, day1Tours);
  
    const valleyTour = pickSacredValleyTour(remainingTours);
    if (valleyTour) {
      const hintedValleyDayIndex = getHintedDayIndex(
        hints,
        "valleyDayIndex",
        indexes.valleyDayIndex,
        0,
        lastStandardTourDayIndex
      );
      addToursToDay(days, hintedValleyDayIndex, [valleyTour]);
      remainingTours = removeTours(remainingTours, [valleyTour]);
    }
  
    const machuTour = pickMachuPicchuTour(remainingTours);
    if (machuTour) {
      const hintedMachuDayIndex = getHintedDayIndex(
        hints,
        "machuDayIndex",
        indexes.machuDayIndex,
        1,
        lastStandardTourDayIndex
      );
      const safeMachuDayIndex = Math.max(hintedMachuDayIndex, 1);
      addToursToDay(days, safeMachuDayIndex, [machuTour]);
      remainingTours = removeTours(remainingTours, [machuTour]);
    }
  
    const forcedLastDayCodes = new Set(hints.forceLastDayTourCodes || []);
  
    if (hints.allowLastDayTourBeforeTransferOut && forcedLastDayCodes.size) {
      const forcedLastDayTour = remainingTours.find((tour) => {
        return forcedLastDayCodes.has(getTourCode(tour));
      });
  
      if (forcedLastDayTour) {
        const lastDayIndex = days.length - 1;
        addToursToDay(days, lastDayIndex, [forcedLastDayTour]);
        remainingTours = removeTours(remainingTours, [forcedLastDayTour]);
      }
    }

    const firstAdditionalDayIndex = getHintedDayIndex(
      hints,
      "firstAdditionalDayIndex",
      indexes.firstAdditionalDayIndex,
      0,
      lastStandardTourDayIndex
    );
  
    placeRemainingTours(
      days,
      remainingTours,
      firstAdditionalDayIndex,
      lastStandardTourDayIndex
    );
  }

  function parseTimeToMinutes(time) {
    if (!time || typeof time !== "string") return null;

    const [hoursRaw, minutesRaw = "0"] = time.split(":");
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    return (hours * 60) + minutes;
  }

  function getAvailableArrivalMinutes(arrivalTime) {
    const arrivalMinutes = parseTimeToMinutes(arrivalTime);
    if (arrivalMinutes === null) return null;
    return arrivalMinutes + 120;
  }

  function pickDay1DynamicTours(tours = [], arrivalTime = "15:00") {
    const availableMinutes = getAvailableArrivalMinutes(arrivalTime);

    if (availableMinutes === null) return [];

    const hour09 = 9 * 60;
    const hour13 = 13 * 60;
    const hour16 = 16 * 60;

    const welcome = tours.find(isWelcomeTour);
    const city = tours.find(isCityTour);

    if (availableMinutes <= hour09) {
      return [welcome, city].filter(Boolean).slice(0, 2);
    }

    if (availableMinutes <= hour13) {
      return [city || welcome].filter(Boolean).slice(0, 1);
    }

    if (availableMinutes <= hour16) {
      return [welcome || city].filter(Boolean).slice(0, 1);
    }

    return [];
  }
  function placeDynamicTours(days, tours = [], context = {}) {
    if (!days.length) return;
  
    let remainingTours = [...tours];
  
    const totalDays = days.length;
    const indexes = getTourDayIndexes(totalDays);
    const hints = context.itineraryHints || {};
    const lastStandardTourDayIndex = indexes.lastTourDayIndex;
  
    let day1Tours = [];

    if (hints.day1Mode === "free") {
      day1Tours = [];
    } else if (hints.day1Mode === "valley-connection") {
      const day1ValleyConnectionTour = pickValleyConnectionTour(remainingTours);
      day1Tours = day1ValleyConnectionTour ? [day1ValleyConnectionTour] : [];
    } else {
      day1Tours = pickDay1DynamicTours(remainingTours, context.arrivalTime || "15:00");
    }

    addToursToDay(days, indexes.firstDayIndex, day1Tours);
    remainingTours = removeTours(remainingTours, day1Tours);
  
    const valleyTour = pickSacredValleyTour(remainingTours);
    if (valleyTour) {
      const hintedValleyDayIndex = getHintedDayIndex(
        hints,
        "valleyDayIndex",
        indexes.valleyDayIndex,
        0,
        lastStandardTourDayIndex
      );
      addToursToDay(days, hintedValleyDayIndex, [valleyTour]);
      remainingTours = removeTours(remainingTours, [valleyTour]);
    }
  
    const machuTour = pickMachuPicchuTour(remainingTours);
    if (machuTour) {
      const hintedMachuDayIndex = getHintedDayIndex(
        hints,
        "machuDayIndex",
        indexes.machuDayIndex,
        1,
        lastStandardTourDayIndex
      );
      const safeMachuDayIndex = Math.max(hintedMachuDayIndex, 1);
      addToursToDay(days, safeMachuDayIndex, [machuTour]);
      remainingTours = removeTours(remainingTours, [machuTour]);
    }
  
    const forcedLastDayCodes = new Set(hints.forceLastDayTourCodes || []);
  
    if (hints.allowLastDayTourBeforeTransferOut && forcedLastDayCodes.size) {
      const forcedLastDayTour = remainingTours.find((tour) => {
        return forcedLastDayCodes.has(getTourCode(tour));
      });
  
      if (forcedLastDayTour) {
        const lastDayIndex = days.length - 1;
        addToursToDay(days, lastDayIndex, [forcedLastDayTour]);
        remainingTours = removeTours(remainingTours, [forcedLastDayTour]);
      }
    }

    const firstAdditionalDayIndex = getHintedDayIndex(
      hints,
      "firstAdditionalDayIndex",
      indexes.firstAdditionalDayIndex,
      0,
      lastStandardTourDayIndex
    );
  
    placeRemainingTours(
      days,
      remainingTours,
      firstAdditionalDayIndex,
      lastStandardTourDayIndex
    );
  }

  function cleanEmptyDays(days) {
    return days.map((day, index) => {
      if (!day.items.length) {
        return {
          ...day,
          items: [
            {
              type: "free",
              title: index === days.length - 1
                ? t("product.freeTimeUntilDepartureTransfer", "Free time until the departure transfer")
                : t("product.freeTime", "Free time")
            }
          ]
        };
      }

      return day;
    });
  }

  function buildItinerary(option, context = {}) {
    if (!option) return [];

    const totalDays = Number(option.days || 0);

    if (!Number.isFinite(totalDays) || totalDays <= 0) return [];

    const days = createEmptyDays(totalDays);
    const logistics = context.packagesCusco?.defaultLogisticsServices;
    const mode = context.mode || "showcase";

    insertTransferIn(days, logistics);

    const itineraryContext = {
      ...context,
      itineraryHints: option.itineraryHints || context.itineraryHints || {}
    };
    
    if (mode === "dynamic") {
      placeDynamicTours(days, option.includedTours || [], itineraryContext);
    } else {
      placeShowcaseTours(days, option.includedTours || [], itineraryContext);
    }

    insertTransferOut(days, logistics);

    return cleanEmptyDays(days);
  }

  window.MyCuscoTripItineraryBuilder = {
    buildItinerary
  };
})();
