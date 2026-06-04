"use strict";

/**
 * My Cusco Trip - Package Generator
 * Genera combinaciones dinámicas, no itinerarios hardcodeados.
 *
 * Versión Cusco con reglas operativas:
 * - Valle Sagrado conexión solo combina con Machu Picchu Overnight.
 * - Valle Sagrado full day solo combina con Machu Picchu Full Day.
 * - Valle Sagrado conexión NO combina con Machu Picchu Full Day.
 * - Valle Sagrado full day NO combina con Machu Picchu Overnight.
 * - Machu Picchu Full Day / Overnight normal NO debe ir antes de trekking pesado.
 * - Machu Picchu Express / Overnight Express sí puede combinar con trekking pesado.
 * - Máximo una experiencia Machu Picchu por paquete.
 * - No duplica tours por contenido.
 */

(function () {
  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getDataPayload(allData) {
    return allData?.data && typeof allData.data === "object" ? allData.data : allData;
  }

  function getProductsFromSource(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.products)) return source.products;
    if (Array.isArray(source.tours)) return source.tours;
    return [];
  }

  function buildTourIndex(data) {
    const index = new Map();

    [
      ...getProductsFromSource(data.toursCusco),
      ...getProductsFromSource(data.toursMachuPicchu)
    ].forEach((tour) => {
      if (tour?.internalCode) index.set(tour.internalCode, tour);
      if (tour?.id) index.set(tour.id, tour);
      if (tour?.slug) index.set(tour.slug, tour);
    });

    return index;
  }

  function getTourByCode(code, tourIndex) {
    return tourIndex.get(code) || null;
  }

  function getTourCode(tour) {
    return tour?.internalCode || tour?.code || tour?.id || "";
  }

  function getTourTitle(tour) {
    return normalizeText(tour?.title || tour?.name || "");
  }

  function getTourSlug(tour) {
    return normalizeText(tour?.slug || "");
  }

  function hasWord(tour, words = []) {
    const text = `${getTourCode(tour)} ${getTourTitle(tour)} ${getTourSlug(tour)} ${normalizeText(tour?.productFamily || "")} ${normalizeText(tour?.category || "")}`;
    return words.some((word) => text.includes(normalizeText(word)));
  }

  function getDurationConfig(packagesCusco, days, nights) {
    const durationConfigs = toArray(packagesCusco?.durationConfigs);
    const d = Number(days);
    const n = Number(nights);

    return durationConfigs.find((item) => {
      return Number(item.days) === d && Number(item.nights) === n;
    }) || null;
  }

  function getPackageCard(packagesCusco, days, nights) {
    const cards = toArray(packagesCusco?.packageCards);
    const d = Number(days);
    const n = Number(nights);

    return cards.find((card) => {
      return Number(card.days) === d && Number(card.nights) === n;
    }) || null;
  }

  function getArrivalDepartureProfile(packagesCusco, params = {}) {
    const profiles = packagesCusco?.arrivalDepartureProfiles || {};
    const arrivalTime = params.arrivalTime || "09:00";
    const departureTime = params.departureTime || "20:00";

    const arrivalHour = Number(String(arrivalTime).split(":")[0]);
    const departureHour = Number(String(departureTime).split(":")[0]);

    const arrivalProfile = arrivalHour >= 14 ? "late-arrival" : "early-arrival";
    const departureProfile = departureHour <= 12 ? "early-departure" : "late-departure";
    const key = `${arrivalProfile}__${departureProfile}`;

    return profiles[key] || profiles["early-arrival__late-departure"] || null;
  }

  function resolveCodes(codes, tourIndex) {
    return toArray(codes)
      .map((code) => tourIndex.get(code))
      .filter(Boolean);
  }

  function uniqueCodes(codes) {
    return Array.from(new Set(toArray(codes).filter(Boolean)));
  }

  function hasCode(codes, code) {
    return toArray(codes).includes(code);
  }

  function removeCodes(codes, codesToRemove) {
    const removeSet = new Set(toArray(codesToRemove));
    return toArray(codes).filter((code) => !removeSet.has(code));
  }
  function removeRedundantTours(codes) {
    const result = uniqueCodes(codes);
    const hasVipValley = result.includes("CUZ003VIP") || result.includes("CUZ003VIPCON");
  
    if (hasVipValley) {
      return result.filter((code) => code !== "CUZ004");
    }
  
    return result;
  }
  
  function getMinimumPostMachuPicchuTours(params) {
    const days = Number(params.days || 0);
  
    // Día 1 = Transfer IN + Bienvenida / City Tour
    // Día 2 = Valle Sagrado conexión
    // Día 3 = Machu Picchu
    // Último día = Transfer OUT
    // Los días entre Machu Picchu y Transfer OUT deben ocuparse.
    return Math.max(days - 4, 0);
  }
  function getShortPackageCommercialSeeds(params, effectiveConfig, packagesCusco, tourIndex) {
    const days = Number(params.days || 0);
    const nights = Number(params.nights || 0);
    const allowed = new Set(toArray(effectiveConfig?.allowedTours));
  
    function canUse(codes) {
      return codes.every((code) => allowed.has(code) && tourIndex.has(code));
    }
  
    function seed(codes, reason, hints = {}, commercialPriority = 1000) {
      if (!canUse(codes)) return null;
  
      return {
        codes: removeRedundantTours(uniqueCodes(codes)),
        reason,
        hints,
        commercialPriority
      };
    }

    function firstAvailableCode(codes) {
      return toArray(codes).find((code) => allowed.has(code) && tourIndex.has(code)) || null;
    }
  
    if (days === 3 && nights === 2) {
      const preferredValleyConnection =
        allowed.has("CUZ003VIPCON") && tourIndex.has("CUZ003VIPCON")
          ? "CUZ003VIPCON"
          : allowed.has("CUZ003CON") && tourIndex.has("CUZ003CON")
            ? "CUZ003CON"
            : null;
    
      return [
        seed(
          ["CUZ001", "CUZ002", "MAPI001"],
          "3d2n-opcion-1-clasica-city-tour-machu-picchu",
          {
            day1Mode: "showcase",
            machuDayIndex: 1,
            allowLastDayTourBeforeTransferOut: false
          },
          3000
        ),
        seed(
          ["MAPI001"],
          "3d2n-opcion-2-llegada-libre-machu-picchu",
          {
            day1Mode: "free",
            machuDayIndex: 1,
            allowLastDayTourBeforeTransferOut: false
          },
          2990
        ),
        preferredValleyConnection
          ? seed(
              [preferredValleyConnection, "MAPI003"],
              "3d2n-opcion-3-valle-conexion-machu-overnight",
              {
                day1Mode: "valley-connection",
                machuDayIndex: 1,
                allowLastDayTourBeforeTransferOut: false
              },
              2980
            )
          : null,
        seed(
          ["CUZ001", "CUZ002", "MAPI002", "CUZ007"],
          "3d2n-opcion-4-city-tour-machu-express-vinicunca-ultimo-dia",
          {
            day1Mode: "showcase",
            machuDayIndex: 1,
            forceLastDayTourCodes: ["CUZ007"],
            allowLastDayTourBeforeTransferOut: true
          },
          2970
        ),
        seed(
          ["CUZ001", "CUZ002", "MAPI002", "CUZ006"],
          "3d2n-opcion-5-city-tour-machu-express-humantay-ultimo-dia",
          {
            day1Mode: "showcase",
            machuDayIndex: 1,
            forceLastDayTourCodes: ["CUZ006"],
            allowLastDayTourBeforeTransferOut: true
          },
          2960
        )
      ].filter(Boolean);
    }
  
    if (days === 4 && nights === 3) {
      const preferredValleyConnection = firstAvailableCode(["CUZ003VIPCON", "CUZ003CON"]);
      const lastDayActiveHints = (code) => ({
        day1Mode: "showcase",
        allowLastDayTourBeforeTransferOut: true,
        forceLastDayTourCodes: [code]
      });
      const machuDay2Hints = {
        day1Mode: "showcase",
        machuDayIndex: 1,
        valleyDayIndex: 2,
        firstAdditionalDayIndex: 2,
        allowLastDayTourBeforeTransferOut: false
      };

      const seeds = [];

      if (preferredValleyConnection) {
        seeds.push(
          seed(
            ["CUZ001", "CUZ002", preferredValleyConnection, "MAPI003"],
            "4d3n-opcion-1-valle-vip-conexion-machu-overnight",
            {
              day1Mode: "showcase",
              allowLastDayTourBeforeTransferOut: false
            },
            4000
          )
        );

        ["CUZ007", "CUZ006", "CUZ008", "CUZ009"].forEach((lastDayCode, index) => {
          seeds.push(
            seed(
              ["CUZ001", "CUZ002", preferredValleyConnection, "MAPI004", lastDayCode],
              `4d3n-valle-conexion-machu-express-ultimo-dia-${lastDayCode}`,
              lastDayActiveHints(lastDayCode),
              3950 - index
            )
          );
        });
      }

      ["CUZ006", "CUZ007", "CUZ008", "CUZ009", "CUZ003FD", "CUZ004", "CUZ005"].forEach((day3Code, index) => {
        seeds.push(
          seed(
            ["CUZ001", "CUZ002", "MAPI002", day3Code],
            `4d3n-machu-full-day-express-dia-3-${day3Code}`,
            machuDay2Hints,
            3900 - index
          )
        );
      });

      return seeds.filter(Boolean);
    }
  
    return [];
  }
  function countPostMachuPicchuCandidateTours(codes, packagesCusco, tourIndex) {
    return uniqueCodes(codes).filter((code) => {
      if (isWelcomeCode(code, packagesCusco, tourIndex)) return false;
      if (isCityTourCode(code, packagesCusco, tourIndex)) return false;
      if (isSacredValleyCode(code, packagesCusco)) return false;
      if (isMachuPicchuCode(code)) return false;
  
      return true;
    }).length;
  }

  function isMachuPicchuCode(code) {
    return /^MAPI/i.test(String(code || ""));
  }

  function isTrekkingCode(code, packagesCusco) {
    const trekkingCodes = toArray(packagesCusco?.tourReferences?.cusco?.trekkings);
    return trekkingCodes.includes(code);
  }

  function isHeavyTrekkingCode(code, packagesCusco, tourIndex) {
    if (isTrekkingCode(code, packagesCusco)) return true;

    const tour = getTourByCode(code, tourIndex);
    if (!tour) return false;

    return hasWord(tour, [
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

  function isWelcomeCode(code, packagesCusco, tourIndex) {
    const refs = packagesCusco?.tourReferences?.cusco || {};
    const known = [
      ...toArray(refs.welcome),
      ...toArray(refs.bienvenida),
      ...toArray(refs.ancestral),
      ...toArray(refs.panorama),
      ...toArray(refs.panoramic)
    ];

    if (known.includes(code)) return true;

    const tour = getTourByCode(code, tourIndex);
    if (!tour) return false;

    return hasWord(tour, [
      "bienvenida",
      "ancestral",
      "panoramico",
      "panorámico"
    ]);
  }

  function isCityTourCode(code, packagesCusco, tourIndex) {
    const refs = packagesCusco?.tourReferences?.cusco || {};
    if (toArray(refs.cityTour).includes(code)) return true;
    if (code === "CUZ002") return true;

    const tour = getTourByCode(code, tourIndex);
    if (!tour) return false;

    return hasWord(tour, ["city tour"]);
  }

  function isSacredValleyCode(code, packagesCusco) {
    const refs = packagesCusco?.tourReferences?.cusco || {};

    return uniqueCodes([
      ...toArray(refs.sacredValley),
      ...toArray(refs.sacredValleyFullDay),
      ...toArray(refs.sacredValleyConnection),
      ...toArray(refs.sacredValleyClassic),
      ...toArray(refs.sacredValleyVip)
    ]).includes(code);
  }

  function isSacredValleyConnectionCode(code, packagesCusco, tourIndex) {
    const refs = packagesCusco?.tourReferences?.cusco || {};
    const explicit = [
      ...toArray(refs.sacredValleyConnection),
      ...toArray(refs.sacredValleyConnections),
      ...toArray(refs.connection)
    ];

    if (explicit.includes(code)) return true;

    const tour = getTourByCode(code, tourIndex);
    if (!tour) return false;

    return isSacredValleyCode(code, packagesCusco) && hasWord(tour, [
      "conexion",
      "conexión",
      "ollantaytambo",
      "aguas calientes"
    ]);
  }

  function isSacredValleyFullDayCode(code, packagesCusco, tourIndex) {
    if (!isSacredValleyCode(code, packagesCusco)) return false;
    if (isSacredValleyConnectionCode(code, packagesCusco, tourIndex)) return false;

    const tour = getTourByCode(code, tourIndex);
    if (!tour) return true;

    return hasWord(tour, ["full day", "dia completo", "día completo", "valle sagrado"]);
  }

  function getMachuPicchuModeByCode(code, packagesCusco, tourIndex) {
    const mapiRefs = packagesCusco?.tourReferences?.machuPicchu || {};
    const tour = getTourByCode(code, tourIndex);

    if (toArray(mapiRefs.fullDayExpress).includes(code)) return "full-day-express";
    if (toArray(mapiRefs.overnightExpress).includes(code)) return "overnight-express";
    if (toArray(mapiRefs.fullDayClassic).includes(code)) return "full-day";
    if (toArray(mapiRefs.overnightClassic).includes(code)) return "overnight";
    if (toArray(mapiRefs.fullDay).includes(code)) return hasWord(tour, ["express"]) ? "full-day-express" : "full-day";
    if (toArray(mapiRefs.overnight).includes(code)) return hasWord(tour, ["express"]) ? "overnight-express" : "overnight";

    if (!tour) return "none";

    if (hasWord(tour, ["overnight", "2 dias", "2 días"])) {
      return hasWord(tour, ["express"]) ? "overnight-express" : "overnight";
    }

    if (hasWord(tour, ["full day", "dia completo", "día completo"])) {
      return hasWord(tour, ["express"]) ? "full-day-express" : "full-day";
    }

    return "full-day";
  }

  function isMachuPicchuExpressMode(mode) {
    return mode === "full-day-express" || mode === "overnight-express";
  }

  function getCodesByMachuMode(packagesCusco, mode) {
    const mapiRefs = packagesCusco?.tourReferences?.machuPicchu || {};

    if (mode === "full-day") {
      return uniqueCodes([
        ...toArray(mapiRefs.fullDayClassic),
        ...toArray(mapiRefs.fullDay)
      ]);
    }

    if (mode === "full-day-express") {
      return uniqueCodes([
        ...toArray(mapiRefs.fullDayExpress),
        ...toArray(mapiRefs.fullDay)
      ]);
    }

    if (mode === "overnight") {
      return uniqueCodes([
        ...toArray(mapiRefs.overnightClassic),
        ...toArray(mapiRefs.overnight)
      ]);
    }

    if (mode === "overnight-express") {
      return uniqueCodes([
        ...toArray(mapiRefs.overnightExpress),
        ...toArray(mapiRefs.overnight)
      ]);
    }

    return [];
  }

  function chooseFirstAvailable(codes, tourIndex) {
    return toArray(codes).find((code) => tourIndex.has(code)) || toArray(codes)[0] || null;
  }

  function createSignature(option) {
    const codes = uniqueCodes(option.includedTourCodes).sort();

    const flags = [
      option.machuPicchuMode || "",
      option.connectionMode || "",
      option.sacredValleyMode || "",
      option.vipMode ? "vip" : "",
      option.hasTrekkingAfterMachuPicchu ? "trek-after-mapi" : ""
    ].filter(Boolean);

    return [...codes, ...flags].sort().join("|");
  }

  function dedupePackageOptions(options = []) {
    const seen = new Set();

    return options.filter((option) => {
      const signature = createSignature(option);
      if (seen.has(signature)) return false;
      seen.add(signature);
      option.signature = signature;
      return true;
    });
  }

  function getCandidatePools(durationConfig, packagesCusco) {
    const refs = packagesCusco?.tourReferences?.cusco || {};

    const allowedTours = uniqueCodes(durationConfig?.allowedTours);
    const requiredTours = uniqueCodes(durationConfig?.requiredTours);

    return {
      requiredTours,
      allowedTours,
      welcome: uniqueCodes([
        ...toArray(refs.welcome),
        ...toArray(refs.bienvenida),
        ...toArray(refs.ancestral),
        ...toArray(refs.panorama),
        ...toArray(refs.panoramic)
      ]).filter((code) => allowedTours.includes(code)),
      cityTour: toArray(refs.cityTour).filter((code) => allowedTours.includes(code)),
      sacredValley: toArray(refs.sacredValley).filter((code) => allowedTours.includes(code)),
      sacredValleyConnection: uniqueCodes([
        ...toArray(refs.sacredValleyConnection),
        ...toArray(refs.sacredValleyConnections),
        ...toArray(refs.connection)
      ]).filter((code) => allowedTours.includes(code)),
      cultural: toArray(refs.cultural).filter((code) => allowedTours.includes(code)),
      halfDay: toArray(refs.halfDay).filter((code) => allowedTours.includes(code)),
      fullDay: toArray(refs.fullDay).filter((code) => allowedTours.includes(code)),
      trekkings: toArray(refs.trekkings).filter((code) => allowedTours.includes(code))
    };
  }

  function applyRequiredTours(option, rules = {}) {
    option.includedTourCodes = uniqueCodes(option.includedTourCodes);

    if (rules.maximumOneMachuPicchuExperiencePerPackage) {
      const machuCodes = option.includedTourCodes.filter(isMachuPicchuCode);

      if (machuCodes.length > 1) {
        const keep = machuCodes[0];

        option.includedTourCodes = option.includedTourCodes.filter((code) => {
          return !isMachuPicchuCode(code) || code === keep;
        });
      }
    }

    return option;
  }

  function chooseMachuPicchuCode(params, durationConfig, packagesCusco, context = {}) {
    const rules = packagesCusco?.globalRules || {};
    const days = Number(params.days);
    const nights = Number(params.nights);
    const tourIndex = context.tourIndex || new Map();

    if (context.forceMode) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, context.forceMode), tourIndex);
    }

    if (rules.threeDaysTwoNightsRequiresFullDayMachuPicchu && days === 3 && nights === 2) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, "full-day"), tourIndex);
    }

    if (context.requiresOvernightExpress) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, "overnight-express"), tourIndex);
    }

    if (context.requiresOvernight) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, "overnight"), tourIndex);
    }

    if (durationConfig?.allowOvernightMachuPicchu) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, "overnight"), tourIndex);
    }

    if (durationConfig?.allowFullDayMachuPicchu !== false) {
      return chooseFirstAvailable(getCodesByMachuMode(packagesCusco, "full-day"), tourIndex);
    }

    return null;
  }

  function detectSacredValleyMode(codes, packagesCusco, tourIndex) {
    const sacredCodes = toArray(codes).filter((code) => isSacredValleyCode(code, packagesCusco));

    if (!sacredCodes.length) return "none";

    if (sacredCodes.some((code) => isSacredValleyConnectionCode(code, packagesCusco, tourIndex))) {
      return "connection";
    }

    return "full-day";
  }

  function detectCurrentMachuMode(codes, packagesCusco, tourIndex) {
    const machuCode = toArray(codes).find(isMachuPicchuCode);
    if (!machuCode) return "none";
    return getMachuPicchuModeByCode(machuCode, packagesCusco, tourIndex);
  }

  function replaceMachuPicchuByMode(codes, mode, packagesCusco, tourIndex) {
    const withoutMachu = removeCodes(codes, toArray(codes).filter(isMachuPicchuCode));
    const selected = chooseMachuPicchuCode({}, {}, packagesCusco, {
      tourIndex,
      forceMode: mode
    });

    if (selected) withoutMachu.push(selected);

    return uniqueCodes(withoutMachu);
  }

  function hasHeavyTrekking(codes, packagesCusco, tourIndex) {
    return toArray(codes).some((code) => isHeavyTrekkingCode(code, packagesCusco, tourIndex));
  }


  function isShortFlexibleCode(code, packagesCusco, tourIndex) {
    return (
      isWelcomeCode(code, packagesCusco, tourIndex) ||
      isCityTourCode(code, packagesCusco, tourIndex) ||
      code === "CUZ004" ||
      code === "CUZ005"
    );
  }

  function getAvailableItineraryServiceDays(params) {
    const days = Number(params?.days || 0);

    if (!Number.isFinite(days) || days <= 0) return 0;

    // El último día queda reservado para Transfer OUT.
    // Las actividades solo se colocan entre el día 1 y el penúltimo día.
    return Math.max(days - 1, 1);
  }

  function estimateRequiredServiceDays(codes, params, packagesCusco, tourIndex) {
    const unique = uniqueCodes(codes);

    const shortFlexibleCodes = unique.filter((code) => isShortFlexibleCode(code, packagesCusco, tourIndex));
    const exclusiveCodes = unique.filter((code) => !isShortFlexibleCode(code, packagesCusco, tourIndex));

    // Bienvenida, City Tour, Maras y Moray y Valle Sur son medios días combinables,
    // pero no deben superar dos experiencias por día.
    const shortFlexibleDays = Math.ceil(shortFlexibleCodes.length / 2);

    // Valle Sagrado, Machu Picchu, Humantay, Vinicunca, Palcoyo y Siete Lagunas
    // consumen un día completo exclusivo cada uno.
    return shortFlexibleDays + exclusiveCodes.length;
  }

  function fitsAvailableServiceDays(codes, params, packagesCusco, tourIndex) {
    const requiredDays = estimateRequiredServiceDays(codes, params, packagesCusco, tourIndex);
    const availableDays = getAvailableItineraryServiceDays(params);

    return requiredDays <= availableDays;
  }

  function applyValleyMachuPicchuRules(option, params, durationConfig, packagesCusco, tourIndex) {
    let codes = uniqueCodes(option.includedTourCodes);
    if (option.forceSacredValleyConnection === true) {
      codes = replaceMachuPicchuByMode(codes, "overnight", packagesCusco, tourIndex);
    
      option.connectionMode = "sacred-valley-connection";
      option.sacredValleyMode = "connection";
      option.requiresOvernight = true;
      option.includedTourCodes = uniqueCodes(codes);
    
      return option;
    }

    const sacredValleyMode = detectSacredValleyMode(codes, packagesCusco, tourIndex);

    if (sacredValleyMode === "connection") {
      codes = replaceMachuPicchuByMode(codes, "overnight", packagesCusco, tourIndex);
      option.connectionMode = "sacred-valley-connection";
      option.sacredValleyMode = "connection";
      option.requiresOvernight = true;
    }

    if (sacredValleyMode === "full-day") {
      const currentMachuMode = detectCurrentMachuMode(codes, packagesCusco, tourIndex);

      if (["overnight", "overnight-express", "none"].includes(currentMachuMode)) {
        codes = replaceMachuPicchuByMode(codes, "full-day", packagesCusco, tourIndex);
      }

      option.connectionMode = "none";
      option.sacredValleyMode = "full-day";
      option.requiresOvernight = false;
    }

    option.includedTourCodes = uniqueCodes(codes);

    return option;
  }

  function applyTrekkingAfterMachuPicchuRules(option, params, durationConfig, packagesCusco, tourIndex) {
    let codes = uniqueCodes(option.includedTourCodes);

    const trekking = hasHeavyTrekking(codes, packagesCusco, tourIndex);
    const machuMode = detectCurrentMachuMode(codes, packagesCusco, tourIndex);

    option.hasTrekkingAfterMachuPicchu = false;
    option.requiresOvernightExpress = false;

    if (!trekking || machuMode === "none") {
      option.includedTourCodes = codes;
      return option;
    }

    if (isMachuPicchuExpressMode(machuMode)) {
      option.hasTrekkingAfterMachuPicchu = true;
      option.includedTourCodes = codes;
      return option;
    }

    const replacementMode = machuMode === "overnight" ? "overnight-express" : "full-day-express";
    const replaced = replaceMachuPicchuByMode(codes, replacementMode, packagesCusco, tourIndex);

    const newMode = detectCurrentMachuMode(replaced, packagesCusco, tourIndex);

    if (isMachuPicchuExpressMode(newMode)) {
      option.hasTrekkingAfterMachuPicchu = true;
      option.requiresOvernightExpress = newMode === "overnight-express";
      option.includedTourCodes = replaced;
      return option;
    }

    option.includedTourCodes = codes.filter((code) => !isHeavyTrekkingCode(code, packagesCusco, tourIndex));
    option.hasTrekkingAfterMachuPicchu = false;

    return option;
  }

  function applyOperationalRules(option, params, durationConfig, packagesCusco, tourIndex) {
    option.connectionMode = "none";
    option.sacredValleyMode = "none";
    option.machuPicchuMode = "none";
    option.hasTrekkingAfterMachuPicchu = false;
    option.requiresOvernight = false;
    option.requiresOvernightExpress = false;

    option.includedTourCodes = uniqueCodes(option.includedTourCodes);

    option = applyValleyMachuPicchuRules(option, params, durationConfig, packagesCusco, tourIndex);
    option = applyTrekkingAfterMachuPicchuRules(option, params, durationConfig, packagesCusco, tourIndex);

    const hasMachu = option.includedTourCodes.some(isMachuPicchuCode);

    if (!hasMachu) {
      const selectedMachu = chooseMachuPicchuCode(params, durationConfig, packagesCusco, {
        tourIndex,
        requiresOvernight: option.requiresOvernight,
        requiresOvernightExpress: option.requiresOvernightExpress
      });

      if (selectedMachu) option.includedTourCodes.push(selectedMachu);
    }

    option.includedTourCodes = removeRedundantTours(option.includedTourCodes);

    option.machuPicchuMode = detectCurrentMachuMode(option.includedTourCodes, packagesCusco, tourIndex);
    option.sacredValleyMode = detectSacredValleyMode(option.includedTourCodes, packagesCusco, tourIndex);

    if (option.sacredValleyMode === "connection") {
      option.connectionMode = "sacred-valley-connection";
    }

    return option;
  }

  function isValidPackageOption(option, params, durationConfig, packagesCusco, tourIndex) {
    const codes = uniqueCodes(option.includedTourCodes);

    const sacredValleyMode = detectSacredValleyMode(codes, packagesCusco, tourIndex);
    const machuMode = detectCurrentMachuMode(codes, packagesCusco, tourIndex);
    const trekking = hasHeavyTrekking(codes, packagesCusco, tourIndex);

    if (sacredValleyMode === "connection" && !["overnight", "overnight-express"].includes(machuMode)) {
      return false;
    }

    if (sacredValleyMode === "full-day" && ["overnight", "overnight-express"].includes(machuMode)) {
      return false;
    }

    if (trekking && ["full-day", "overnight"].includes(machuMode)) {
      return false;
    }

    const machuCodes = codes.filter(isMachuPicchuCode);
    if (machuCodes.length > 1) return false;

    if (!fitsAvailableServiceDays(codes, params, packagesCusco, tourIndex)) {
      return false;
    }

    return true;
  }

  function ensureShowcaseBaseTours(codes, pools, packagesCusco, tourIndex) {
    let result = uniqueCodes(codes);

    const welcomeCode =
      pools.welcome.find((code) => !result.includes(code)) ||
      pools.halfDay.find((code) => isWelcomeCode(code, packagesCusco, tourIndex) && !result.includes(code));

    const cityCode =
      pools.cityTour.find((code) => !result.includes(code)) ||
      pools.halfDay.find((code) => isCityTourCode(code, packagesCusco, tourIndex) && !result.includes(code));

    if (welcomeCode) result.push(welcomeCode);
    if (cityCode) result.push(cityCode);

    return uniqueCodes(result);
  }
  function ensureMachuPicchuRequired(codes, params, durationConfig, packagesCusco, tourIndex) {
    let result = uniqueCodes(codes);
  
    if (result.some(isMachuPicchuCode)) {
      return result;
    }
  
    const days = Number(params.days || 0);
    const nights = Number(params.nights || 0);
  
    let preferredMode = "overnight";
  
    if (days === 3 && nights === 2) {
      preferredMode = "full-day";
    }
  
    const selectedMachu = chooseMachuPicchuCode(params, durationConfig, packagesCusco, {
      tourIndex,
      forceMode: preferredMode
    });
  
    if (selectedMachu) {
      result.push(selectedMachu);
    }
  
    return uniqueCodes(result);
  }
  
  function ensureDefaultValleyConnectionMachuPicchu(codes, params, durationConfig, packagesCusco, tourIndex, pools) {
    let result = uniqueCodes(codes);

    const days = Number(params.days || 0);
    const nights = Number(params.nights || 0);

    if (days === 3 && nights === 2) {
      return ensureMachuPicchuRequired(result, params, durationConfig, packagesCusco, tourIndex);
    }

    if (days < 4 || durationConfig?.allowConnection === false) {
      return result;
    }

    const hasValley = result.some((code) => isSacredValleyCode(code, packagesCusco));
    const hasConnection = result.some((code) => isSacredValleyConnectionCode(code, packagesCusco, tourIndex));

    if (hasConnection) {
      return replaceMachuPicchuByMode(result, "overnight", packagesCusco, tourIndex);
    }

    const connectionCode =
      pools.sacredValleyConnection.find((code) => code === "CUZ003VIPCON" && !result.includes(code)) ||
      pools.sacredValleyConnection.find((code) => code === "CUZ003CON" && !result.includes(code)) ||
      pools.sacredValleyConnection.find((code) => !result.includes(code)) ||
      pools.sacredValley.find((code) => isSacredValleyConnectionCode(code, packagesCusco, tourIndex));

    if (!connectionCode) return result;

    if (hasValley) {
      result = result.filter((code) => !isSacredValleyCode(code, packagesCusco));
    }

    result.push(connectionCode);
    result = replaceMachuPicchuByMode(result, "overnight", packagesCusco, tourIndex);

    return uniqueCodes(result);
  }

  function isProtectedShowcaseCode(code, packagesCusco, tourIndex) {
    return (
      isWelcomeCode(code, packagesCusco, tourIndex) ||
      isCityTourCode(code, packagesCusco, tourIndex) ||
      isSacredValleyCode(code, packagesCusco) ||
      isMachuPicchuCode(code)
    );
  }

  function expandOptionalTours(baseOption, pools, durationConfig, packagesCusco, tourIndex, params = {}) {
    const maxOptions = Number(packagesCusco?.generationEngine?.maxGeneratedOptionsPerDuration || 36);
    const maxTrekkings = Number(durationConfig?.maxTrekkings || 1);
    const options = [];
    const seen = new Set();

    const baseCodes = uniqueCodes(baseOption.includedTourCodes);
    const baseHasSacredValley = baseCodes.some((code) => isSacredValleyCode(code, packagesCusco));

    const optionalFullDays = pools.fullDay.filter((code) => {
      if (baseHasSacredValley && isSacredValleyCode(code, packagesCusco)) return false;
      return true;
    });

    const optionalHalfDays = pools.halfDay.filter((code) => {
      if (isWelcomeCode(code, packagesCusco, tourIndex)) return false;
      if (isCityTourCode(code, packagesCusco, tourIndex)) return false;
      return true;
    });

    const candidates = uniqueCodes([
      ...optionalFullDays,
      ...optionalHalfDays
    ]).filter((code) => {
      if (isSacredValleyCode(code, packagesCusco)) return false;
      if (isMachuPicchuCode(code)) return false;
      return true;
    });

    function pushOption(codes, reason) {
      const normalizedCodes = uniqueCodes(codes);
      const signature = normalizedCodes.slice().sort().join("|");

      if (seen.has(signature)) return;
      if (!fitsAvailableServiceDays(normalizedCodes, params, packagesCusco, tourIndex)) return;

      const trekkingCount = normalizedCodes.filter((code) => isTrekkingCode(code, packagesCusco)).length;
      if (trekkingCount > maxTrekkings) return;

      seen.add(signature);
      options.push({
        ...baseOption,
        includedTourCodes: normalizedCodes,
        generationReason: reason
      });
    }

    pushOption(baseCodes, "recommended-base");

    candidates.forEach((candidateCode) => {
      if (!baseCodes.includes(candidateCode)) {
        pushOption(
          [...baseCodes, candidateCode],
          `optional-add-${candidateCode}`
        );
      }
    });

    const replaceableCodes = baseCodes.filter((code) => {
      return !isProtectedShowcaseCode(code, packagesCusco, tourIndex);
    });

    replaceableCodes.forEach((replaceCode) => {
      candidates.forEach((candidateCode) => {
        if (candidateCode === replaceCode) return;
        if (baseCodes.includes(candidateCode)) return;

        const replacedCodes = baseCodes.map((code) => {
          return code === replaceCode ? candidateCode : code;
        });

        pushOption(
          replacedCodes,
          `optional-replace-${replaceCode}-with-${candidateCode}`
        );
      });
    });

    return options.slice(0, maxOptions);
  }

  function rankPackageOptions(options = [], packagesCusco = {}, tourIndex = new Map()) {
    return [...options]
      .map((option) => ({
        ...option,
        score: calculateOptionScore(option, packagesCusco, tourIndex)
      }))
      .sort((a, b) => {
        if (Number(b.commercialPriority || 0) !== Number(a.commercialPriority || 0)) {
          return Number(b.commercialPriority || 0) - Number(a.commercialPriority || 0);
        }
  
        return Number(b.score || 0) - Number(a.score || 0);
      });
  }
  function estimateOccupiedUsefulDays(option, packagesCusco, tourIndex) {
    const codes = uniqueCodes(option.includedTourCodes);
    let occupied = 0;
  
    const hasWelcome = codes.some((code) => isWelcomeCode(code, packagesCusco, tourIndex));
    const hasCity = codes.some((code) => isCityTourCode(code, packagesCusco, tourIndex));
    const hasValley = codes.some((code) => isSacredValleyCode(code, packagesCusco));
    const hasMachu = codes.some(isMachuPicchuCode);
  
    if (hasWelcome || hasCity) occupied += 1;
    if (hasValley) occupied += 1;
    if (hasMachu) occupied += 1;
  
    codes.forEach((code) => {
      if (isWelcomeCode(code, packagesCusco, tourIndex)) return;
      if (isCityTourCode(code, packagesCusco, tourIndex)) return;
      if (isSacredValleyCode(code, packagesCusco)) return;
      if (isMachuPicchuCode(code)) return;
  
      occupied += 1;
    });
  
    return occupied;
  }
  function calculateOptionScore(option, packagesCusco, tourIndex) {
    let score = 0;
  
    const codes = option.includedTourCodes || [];
  
    // Base comercial
    if (codes.some((code) => code === "CUZ001")) score += 24; // Bienvenida ancestral
    if (codes.some((code) => code === "CUZ002")) score += 22; // City Tour
    if (codes.some((code) => ["CUZ003FD", "CUZ003CON", "CUZ003VIP", "CUZ003VIPCON"].includes(code))) score += 18; // Valle Sagrado
    if (codes.includes("CUZ003VIPCON")) score += 18;
    if (codes.includes("CUZ003CON")) score += 12;
    if (codes.some(isMachuPicchuCode)) score += 30; // Machu Picchu obligatorio
  
    // Prioridad principal: opción recomendada comercial
    if (option.connectionMode === "sacred-valley-connection") score += 40;
    if (option.sacredValleyMode === "connection") score += 25;
    if (option.machuPicchuMode === "overnight") score += 35;
  
    // Opciones express útiles, pero no por encima del default comercial
    if (option.machuPicchuMode === "overnight-express") score += 20;
    if (option.machuPicchuMode === "full-day-express") score += 12;
  
    // Penalizar opciones menos recomendadas para vitrina
    if (option.sacredValleyMode === "full-day") score -= 12;
    if (option.machuPicchuMode === "full-day") score -= 10;
  
    // Tours adicionales de alto valor
    if (codes.some((code) => /^CUZ00[6-9]/.test(code))) score += 10;
  
    // Bonus para la opción base recomendada
    if (option.generationReason === "recommended-base") score += 30;
  
    // Priorizar días ocupados después de Machu Picchu
    const minimumPostMachuTours = getMinimumPostMachuPicchuTours(option);
    const postMachuTours = countPostMachuPicchuCandidateTours(
      option.includedTourCodes,
      packagesCusco,
      tourIndex
    );
  
    if (postMachuTours >= minimumPostMachuTours) {
      score += 80;
    } else {
      score -= (minimumPostMachuTours - postMachuTours) * 60;
    }
  
    // Penalizar días libres útiles
    const usefulDays = Math.max(Number(option.days || 0) - 1, 0);
    const occupiedDays = estimateOccupiedUsefulDays(option, packagesCusco, tourIndex);
    const freeUsefulDays = Math.max(usefulDays - occupiedDays, 0);
  
    if (freeUsefulDays === 0) {
      score += 300;
    } else {
      score -= freeUsefulDays * 180;
    }
  
    if (Number(option.days || 0) >= 8 && freeUsefulDays === 0) {
      score += 250;
    }
  
    if (Number(option.days || 0) >= 9 && freeUsefulDays > 0) {
      score -= freeUsefulDays * 250;
    }
  
    if (Number(option.days || 0) >= 10 && freeUsefulDays > 1) {
      score -= freeUsefulDays * 300;
    }
  
    return score;
  }
  function buildPackageOption({ params, card, durationConfig, profile, codes, tourIndex, packagesCusco, generationReason }) {
    const option = {
      id: `dynamic_${card?.slug || "cusco"}_${Math.random().toString(36).slice(2, 8)}`,
      slug: card?.slug || "",
      title: card?.title || `Paquete Cusco ${params.days}D/${params.nights}N`,
      productKind: "package",
      productFamily: "cusco-package",
      days: Number(params.days),
      nights: Number(params.nights),
      typeLabel: card?.typeLabel || `${params.days} días / ${params.nights} noches`,
      location: card?.location || "Cusco / Machu Picchu",
      image: card?.image || "",
      badge: card?.badge || "",
      currency: packagesCusco?.defaultCurrency || "USD",
      priceMode: "dynamic_from_selected_itinerary",
      arrivalDepartureProfile: profile,
      includedTourCodes: uniqueCodes(codes),
      includedTours: [],
      generationReason: generationReason || "dynamic",
      forceSacredValleyConnection: generationReason === "recommended-base" && Number(params.days || 0) >= 4,
      sourceConfig: durationConfig,
      rawCard: card || null,
      score: 0
    };

    applyRequiredTours(option, packagesCusco?.globalRules || {});
    applyOperationalRules(option, params, durationConfig, packagesCusco, tourIndex);
    applyRequiredTours(option, packagesCusco?.globalRules || {});

    option.includedTours = resolveCodes(option.includedTourCodes, tourIndex);
    option.score = calculateOptionScore(option, packagesCusco, tourIndex);
    option.signature = createSignature(option);

    return option;
  }
  function ensureMinimumShowcaseActivities(codes, pools, params, packagesCusco, tourIndex) {
    let result = uniqueCodes(codes);
  
    const availableServiceDays = getAvailableItineraryServiceDays(params);
    const currentRequiredDays = estimateRequiredServiceDays(result, params, packagesCusco, tourIndex);
    const minimumTourCount = currentRequiredDays >= availableServiceDays
      ? result.length
      : Math.max(Number(params.days || 0), result.length);
  
    const candidates = uniqueCodes([
      ...pools.fullDay,
      ...pools.cultural,
      ...pools.halfDay,
      ...pools.trekkings
    ]).filter((code) => {
      if (result.includes(code)) return false;
      if (result.some((currentCode) => isSacredValleyCode(currentCode, packagesCusco)) && isSacredValleyCode(code, packagesCusco)) return false;
      return true;
    });
  
    for (const candidate of candidates) {
      if (result.length >= minimumTourCount) break;
  
      const testCodes = uniqueCodes([...result, candidate]);
  
      const tempOption = {
        includedTourCodes: testCodes
      };
  
      applyOperationalRules(
        tempOption,
        params,
        {
          days: params.days,
          nights: params.nights,
          maxTrekkings: 1
        },
        packagesCusco,
        tourIndex
      );
  
      if (
        isValidPackageOption(
          tempOption,
          params,
          {
            days: params.days,
            nights: params.nights,
            maxTrekkings: 1
          },
          packagesCusco,
          tourIndex
        ) &&
        fitsAvailableServiceDays(tempOption.includedTourCodes, params, packagesCusco, tourIndex)
      ) {
        result = uniqueCodes(tempOption.includedTourCodes);
      }
    }
  
    return result;
  }

  function generateCuscoPackages(params = {}, context = {}) {
    const data = getDataPayload(context.allData || context.data || {});
    const packagesCusco = data.packagesCusco;

    if (!packagesCusco) {
      console.warn("[MyCuscoTrip PackageGenerator] No se encontró packages-cusco.json");
      return [];
    }

    const days = Number(params.days);
    const nights = Number(params.nights);

    if (!Number.isFinite(days) || !Number.isFinite(nights)) {
      console.warn("[MyCuscoTrip PackageGenerator] Duración inválida:", params);
      return [];
    }

    const durationConfig = getDurationConfig(packagesCusco, days, nights);
    const card = getPackageCard(packagesCusco, days, nights);
    const profile = getArrivalDepartureProfile(packagesCusco, params);
    const tourIndex = buildTourIndex(data);

    if (!durationConfig && !card) {
      console.warn("[MyCuscoTrip PackageGenerator] No hay configuración para duración:", days, nights);
      return [];
    }

    const effectiveConfig = durationConfig || {
      days,
      nights,
      allowedTours: card?.search?.includedTourCodes || [],
      requiredTours: card?.search?.includedTourCodes || [],
      allowFullDayMachuPicchu: true,
      allowOvernightMachuPicchu: days >= 4,
      allowConnection: days >= 5,
      maxTrekkings: 1
    };

    const pools = getCandidatePools(effectiveConfig, packagesCusco);

    let baseCodes = uniqueCodes([
      ...pools.requiredTours
    ]);

    baseCodes = ensureShowcaseBaseTours(baseCodes, pools, packagesCusco, tourIndex);

    baseCodes = ensureDefaultValleyConnectionMachuPicchu(
      baseCodes,
      params,
      effectiveConfig,
      packagesCusco,
      tourIndex,
      pools
    );
    
    baseCodes = ensureMachuPicchuRequired(
      baseCodes,
      params,
      effectiveConfig,
      packagesCusco,
      tourIndex
    );
    
    baseCodes = ensureMinimumShowcaseActivities(
      baseCodes,
      pools,
      params,
      packagesCusco,
      tourIndex
    );

    const selectedMachu = chooseMachuPicchuCode(params, effectiveConfig, packagesCusco, {
      tourIndex
    });

    if (selectedMachu && !baseCodes.some(isMachuPicchuCode)) {
      baseCodes.push(selectedMachu);
    }

    const baseOption = buildPackageOption({
      params,
      card,
      durationConfig: effectiveConfig,
      profile,
      codes: baseCodes,
      tourIndex,
      packagesCusco,
      generationReason: "recommended-base"
    });
    const shortCommercialSeeds = getShortPackageCommercialSeeds(
      params,
      effectiveConfig,
      packagesCusco,
      tourIndex
    );
    
    const shortCommercialOptions = shortCommercialSeeds.map((item) => {
      const option = buildPackageOption({
        params,
        card,
        durationConfig: effectiveConfig,
        profile,
        codes: item.codes,
        tourIndex,
        packagesCusco,
        generationReason: item.reason
      });
    
      option.itineraryHints = item.hints || {};
      option.commercialPriority = Number(item.commercialPriority || 1000);
    
      return option;
    });

    const expanded = expandOptionalTours(baseOption, pools, effectiveConfig, packagesCusco, tourIndex, params)
      .map((option) => buildPackageOption({
        params,
        card,
        durationConfig: effectiveConfig,
        profile,
        codes: ensureMachuPicchuRequired(
          option.includedTourCodes,
          params,
          effectiveConfig,
          packagesCusco,
          tourIndex
        ),
        tourIndex,
        packagesCusco,
        generationReason: option.generationReason
      }))
      .filter((option) => option.includedTourCodes.some(isMachuPicchuCode))
      .filter((option) => isValidPackageOption(option, params, effectiveConfig, packagesCusco, tourIndex));

      const allOptions = [
        ...shortCommercialOptions,
        ...expanded
      ];
      
      const deduped = dedupePackageOptions(allOptions);
      const ranked = rankPackageOptions(deduped, packagesCusco, tourIndex);

    const maxRendered = Number(packagesCusco?.generationEngine?.maxRenderedOptionsPerPage || 12);

    const rankedWithUsefulDayStats = ranked.map((option) => {
      const usefulDays = Math.max(Number(option.days || 0) - 1, 0);
      const occupiedUsefulDays = estimateOccupiedUsefulDays(option, packagesCusco, tourIndex);
      const freeUsefulDays = Math.max(usefulDays - occupiedUsefulDays, 0);

      return {
        ...option,
        occupiedUsefulDays,
        freeUsefulDays
      };
    });

    let filteredByUsefulDays = rankedWithUsefulDayStats;

    if (days >= 5 && days <= 9) {
      filteredByUsefulDays = rankedWithUsefulDayStats.filter((option) => Number(option.freeUsefulDays || 0) === 0);
    }

    if (days === 10) {
      filteredByUsefulDays = rankedWithUsefulDayStats.filter((option) => Number(option.freeUsefulDays || 0) <= 1);
    }

    const finalRanking = filteredByUsefulDays.length > 0
      ? filteredByUsefulDays
      : rankedWithUsefulDayStats;

    return finalRanking.slice(0, maxRendered);
  }

  function generatePeruPackages() {
    console.warn("[MyCuscoTrip PackageGenerator] Paquetes Perú se implementarán después.");
    return [];
  }

  function generatePackageOptions(params = {}, allData = {}) {
    const family = normalizeText(params.productFamily || params.family || "cusco-package");

    if (family === "peru-package") {
      return generatePeruPackages(params, { allData });
    }

    return generateCuscoPackages(params, { allData });
  }

  window.MyCuscoTripPackageGenerator = {
    generatePackageOptions,
    generateCuscoPackages,
    generatePeruPackages,
    applyRequiredTours,
    expandOptionalTours,
    dedupePackageOptions,
    rankPackageOptions,
    isValidPackageOption
  };
})();
