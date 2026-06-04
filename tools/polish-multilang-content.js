"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const jsonFiles = [
  "tours-cusco.json",
  "tours-machu-picchu.json",
  "tours-peru.json",
  "trekkings-cusco.json",
  "packages-cusco.json",
  "packages-peru.json",
  "private-packages.json",
  "destinations.json",
  "hotels.json",
  "trains.json",
  "seo-pages.json"
];

const locales = ["es", "en", "pt", "fr", "de"];

const guidePhrase = {
  es: "Guía profesional en español e inglés",
  en: "Professional guide in Spanish and English",
  pt: "Guia profissional em espanhol e inglês",
  fr: "Guide professionnel en espagnol et en anglais",
  de: "Professionelle Reiseleitung auf Spanisch und Englisch"
};

const ui = {
  es: {
    "product.guideSpanishEnglish": "español e inglés (otros idiomas previa consulta/coordinación y pueden tener costo adicional)",
    "product.otherLanguagesOnRequest": "otros idiomas previa consulta/coordinación y pueden tener costo adicional",
    "product.guideIn": "Guía profesional: {languages}",
    "product.groupSizeFlexible": "Según la modalidad seleccionada",
    "product.infoPending": "La información se entrega en la coordinación final del viaje.",
    "product.durationPending": "Duración flexible según la ruta seleccionada",
    "product.toConfirm": "Coordinado con tu asesor de viaje",
    "product.mainExperiencesPending": "Las experiencias principales se ajustan según la ruta seleccionada.",
    "product.accommodationPending": "Alojamiento según la categoría seleccionada",
    "product.itineraryPending": "El itinerario detallado se coordina según tus fechas de viaje.",
    "product.faqPending": "Pronto agregaremos preguntas frecuentes.",
    "product.fullDayItinerary": "Itinerario detallado del día",
    "product.packageOptionsIntro": "Elige la alternativa que mejor se acomode a tu ritmo de viaje, intereses y lugares preferidos. Puedes cambiar de opción sin perder la reserva.",
    "product.showMoreOptions": "Ver más opciones",
    "product.itineraryOption": "Itinerario",
    "product.more": "más",
    "product.routeRecommended": "Ruta recomendada",
    "product.routeIntenseNature": "Ruta intensa de naturaleza",
    "product.routeAdventure": "Ruta con aventura",
    "product.routeNature": "Ruta con naturaleza",
    "product.routeComplete": "Ruta más completa",
    "product.routeClassic": "Ruta clásica",
    "product.paceHighNature": "Ritmo alto · más naturaleza y caminatas",
    "product.paceMediumHigh": "Ritmo medio/alto · incluye caminata escénica",
    "product.paceComplete": "Ritmo completo · más visitas en Valle Sagrado",
    "product.paceEfficient": "Ritmo eficiente · menos traslados repetidos",
    "product.paceComfortable": "Ritmo cómodo · ideal para primera visita",
    "product.routeDescriptionIntenseNature": "Pensada para viajeros que quieren sumar los paisajes naturales más fuertes de Cusco, con días de caminata y descansos intercalados.",
    "product.routeDescriptionAdventure": "Combina los imperdibles culturales con una salida de naturaleza para darle variedad al viaje sin hacerlo demasiado pesado.",
    "product.routeDescriptionConnection": "Ruta eficiente que conecta Valle Sagrado con Machu Picchu y reduce traslados repetidos.",
    "product.routeDescriptionClassic": "Opción equilibrada para conocer Cusco, Valle Sagrado y Machu Picchu con un ritmo cómodo.",
    "product.routeDescriptionSuggested": "Ruta sugerida según duración, horarios de llegada y experiencias principales del paquete.",
    "product.sacredValley": "Valle Sagrado",
    "product.sacredValleyConnection": "Valle Sagrado con conexión",
    "product.sacredValleyVip": "Valle Sagrado VIP",
    "product.sacredValleyVipConnection": "Valle Sagrado VIP con conexión",
    "product.cityTour": "City Tour Cusco",
    "product.southValley": "Valle Sur",
    "product.humantayLake": "Laguna Humantay",
    "product.rainbowMountain": "Montaña de Colores",
    "product.palcoyoMountain": "Montaña Palcoyo",
    "product.sevenLakes": "Siete Lagunas del Ausangate",
    "product.ancestralWelcome": "Bienvenida Ancestral",
    "product.machuPicchuClassic": "Machu Picchu clásico",
    "product.machuPicchuExpress": "Machu Picchu express",
    "product.activity": "Actividad",
    "product.allInclusiveServices": "Servicios todo incluido",
    "product.allInclusiveServicesText": "Agrega automáticamente tickets, entradas, almuerzos y servicios recomendados.",
    "product.additionalService": "Servicio adicional",
    "product.recommended": "Recomendado",
    "product.optional": "Opcional",
    "product.departureAt": "Salida {time}",
    "product.selectDepartureTime": "Selecciona un horario",
    "product.departureTimeFixed": "Este tour tiene un horario fijo de salida.",
    "product.departureTimeHelp": "Elige el horario que prefieres. El equipo de reservas revisará la disponibilidad final.",
    "product.pendingSelection": "Pendiente de selección",
    "product.notApplicable": "No aplica",
    "product.transferIn": "Traslado de llegada al inicio del paquete",
    "product.transferOut": "Traslado de salida al finalizar el paquete",
    "product.travelAssistance": "Asistencia de viaje antes y durante la experiencia",
    "product.indicatedTours": "Tours indicados en el itinerario",
    "product.touristTransportProgram": "Transporte turístico según programa",
    "product.professionalGuideIncluded": "Guía profesional en español e inglés",
    "product.machuExperience": "Experiencia Machu Picchu según la modalidad seleccionada",
    "product.touristTrainSelected": "Tren turístico según el servicio seleccionado",
    "product.consetturBus": "Bus Consettur de subida y bajada a Machu Picchu",
    "product.officialMachuEntry": "Ingreso oficial a Machu Picchu",
    "product.accommodationByCategory": "Alojamiento según la categoría y habitación seleccionadas",
    "product.domesticInternationalFlights": "Vuelos nacionales o internacionales",
    "product.personalExpenses": "Gastos personales",
    "product.notMentionedServices": "Servicios no mencionados expresamente",
    "product.voluntaryTips": "Propinas voluntarias",
    "product.optionalUpgradesNotSelected": "Upgrades opcionales no seleccionados",
    "product.freeTime": "Tiempo libre",
    "product.freeTimeUntilDepartureTransfer": "Tiempo libre hasta el traslado de salida",
    "product.includedDestinations": "Destinos incluidos",
    "product.mainExperiences": "Experiencias principales",
    "product.configurableHotels": "Hoteles configurables",
    "product.configurableHotelsText": "El alojamiento se puede ajustar por destino, categoría y disponibilidad. La propuesta final se revisa mediante cotización personalizada.",
    "product.customQuoteText": "Nuestro equipo puede preparar la ruta final según fechas, hoteles, vuelos internos y preferencias de viaje."
    ,"product.select": "Selecciona",
    "product.selectCountry": "Selecciona país",
    "product.reviewsCount": "(24 reseñas)"
  },
  en: {
    "product.guideSpanishEnglish": "Spanish and English (other languages available upon request/coordination and may have an additional cost)",
    "product.otherLanguagesOnRequest": "other languages available upon request/coordination and may have an additional cost",
    "product.guideIn": "Professional guide: {languages}",
    "product.groupSizeFlexible": "According to the selected service",
    "product.infoPending": "Information will be provided by your travel advisor.",
    "product.durationPending": "Flexible duration by selected route",
    "product.toConfirm": "Coordinated with your travel advisor",
    "product.mainExperiencesPending": "Main experiences are adjusted according to the selected route.",
    "product.accommodationPending": "Accommodation according to the selected category",
    "product.itineraryPending": "Your detailed itinerary will be coordinated for your travel dates.",
    "product.faqPending": "Frequently asked questions will be added soon.",
    "product.fullDayItinerary": "Detailed day itinerary",
    "product.packageOptionsIntro": "Choose the route that best matches your travel pace, interests and preferred places to visit. You can switch options without losing your reservation.",
    "product.showMoreOptions": "Show more options",
    "product.itineraryOption": "Itinerary",
    "product.more": "more",
    "product.routeRecommended": "Recommended route",
    "product.routeIntenseNature": "Nature-intensive route",
    "product.routeAdventure": "Adventure route",
    "product.routeNature": "Nature route",
    "product.routeComplete": "Most complete route",
    "product.routeClassic": "Classic route",
    "product.paceHighNature": "High pace · more nature and hiking",
    "product.paceMediumHigh": "Medium/high pace · includes a scenic hike",
    "product.paceComplete": "Complete pace · more Sacred Valley visits",
    "product.paceEfficient": "Efficient pace · fewer repeated transfers",
    "product.paceComfortable": "Comfortable pace · ideal for a first visit",
    "product.routeDescriptionIntenseNature": "Designed for travelers who want Cusco's strongest natural landscapes, with hiking days and balanced rest.",
    "product.routeDescriptionAdventure": "Combines cultural essentials with a nature outing to add variety without making the trip too heavy.",
    "product.routeDescriptionConnection": "Efficient route connecting the Sacred Valley with Machu Picchu and reducing repeated transfers.",
    "product.routeDescriptionClassic": "Balanced option to visit Cusco, the Sacred Valley and Machu Picchu at a comfortable pace.",
    "product.routeDescriptionSuggested": "Suggested route based on duration, arrival times and the package's main experiences.",
    "product.sacredValley": "Sacred Valley",
    "product.sacredValleyConnection": "Sacred Valley with connection",
    "product.sacredValleyVip": "Sacred Valley VIP",
    "product.sacredValleyVipConnection": "Sacred Valley VIP with connection",
    "product.cityTour": "Cusco City Tour",
    "product.southValley": "South Valley",
    "product.humantayLake": "Humantay Lake",
    "product.rainbowMountain": "Rainbow Mountain",
    "product.palcoyoMountain": "Palcoyo Mountain",
    "product.sevenLakes": "Seven Lakes of Ausangate",
    "product.ancestralWelcome": "Ancestral Welcome",
    "product.machuPicchuClassic": "Machu Picchu Classic",
    "product.machuPicchuExpress": "Machu Picchu Express",
    "product.activity": "Activity",
    "product.allInclusiveServices": "All-inclusive services",
    "product.allInclusiveServicesText": "Automatically add recommended tickets, entrance fees, lunches and services.",
    "product.additionalService": "Additional service",
    "product.recommended": "Recommended",
    "product.optional": "Optional",
    "product.departureAt": "Departure {time}",
    "product.selectDepartureTime": "Select a departure time",
    "product.departureTimeFixed": "This tour has a fixed departure time.",
    "product.departureTimeHelp": "Choose your preferred time. The reservations team will review the final availability.",
    "product.pendingSelection": "Pending selection",
    "product.notApplicable": "Not applicable",
    "product.transferIn": "Arrival transfer at the beginning of the package",
    "product.transferOut": "Departure transfer at the end of the package",
    "product.travelAssistance": "Travel assistance before and during the experience",
    "product.indicatedTours": "Tours indicated in the itinerary",
    "product.touristTransportProgram": "Tourist transport according to the program",
    "product.professionalGuideIncluded": "Professional guide in Spanish and English",
    "product.machuExperience": "Machu Picchu experience according to the selected option",
    "product.touristTrainSelected": "Tourist train according to the selected service",
    "product.consetturBus": "Consettur bus up and down to Machu Picchu",
    "product.officialMachuEntry": "Official Machu Picchu entrance ticket",
    "product.accommodationByCategory": "Accommodation according to the selected category and room",
    "product.domesticInternationalFlights": "Domestic or international flights",
    "product.personalExpenses": "Personal expenses",
    "product.notMentionedServices": "Services not expressly mentioned",
    "product.voluntaryTips": "Voluntary tips",
    "product.optionalUpgradesNotSelected": "Optional upgrades not selected",
    "product.freeTime": "Free time",
    "product.freeTimeUntilDepartureTransfer": "Free time until the departure transfer",
    "product.includedDestinations": "Included destinations",
    "product.mainExperiences": "Main experiences",
    "product.configurableHotels": "Configurable hotels",
    "product.configurableHotelsText": "Accommodation can be adjusted by destination, category and availability. The final proposal is reviewed through a personalized quote.",
    "product.customQuoteText": "Our team can prepare the final route according to your dates, hotels, internal flights and travel preferences."
    ,"product.select": "Select",
    "product.selectCountry": "Select country",
    "product.reviewsCount": "(24 reviews)"
  },
  pt: {
    "product.guideSpanishEnglish": "espanhol e inglês (português sujeito a consulta/coordenação prévia e pode ter custo adicional)",
    "product.otherLanguagesOnRequest": "português sujeito a consulta/coordenação prévia e pode ter custo adicional",
    "product.guideIn": "Guia profissional: {languages}",
    "product.groupSizeFlexible": "De acordo com o serviço selecionado",
    "product.infoPending": "As informações serão entregues pelo seu consultor de viagem.",
    "product.durationPending": "Duração flexível conforme a rota selecionada",
    "product.toConfirm": "Coordenado com seu consultor de viagem",
    "product.mainExperiencesPending": "As principais experiências são ajustadas conforme a rota selecionada.",
    "product.accommodationPending": "Hospedagem conforme a categoria selecionada",
    "product.itineraryPending": "O itinerário detalhado será coordenado conforme suas datas de viagem.",
    "product.faqPending": "Em breve adicionaremos perguntas frequentes.",
    "product.fullDayItinerary": "Itinerário detalhado do dia",
    "product.packageOptionsIntro": "Escolha a rota que melhor combine com seu ritmo de viagem, interesses e lugares preferidos. Você pode mudar de opção sem perder a reserva.",
    "product.showMoreOptions": "Ver mais opções",
    "product.itineraryOption": "Itinerário",
    "product.more": "mais",
    "product.routeRecommended": "Rota recomendada",
    "product.routeIntenseNature": "Rota intensa de natureza",
    "product.routeAdventure": "Rota com aventura",
    "product.routeNature": "Rota de natureza",
    "product.routeComplete": "Rota mais completa",
    "product.routeClassic": "Rota clássica",
    "product.paceHighNature": "Ritmo alto · mais natureza e caminhadas",
    "product.paceMediumHigh": "Ritmo médio/alto · inclui caminhada cênica",
    "product.paceComplete": "Ritmo completo · mais visitas no Vale Sagrado",
    "product.paceEfficient": "Ritmo eficiente · menos traslados repetidos",
    "product.paceComfortable": "Ritmo confortável · ideal para uma primeira visita",
    "product.routeDescriptionIntenseNature": "Pensada para viajantes que querem incluir as paisagens naturais mais fortes de Cusco, com dias de caminhada e descanso equilibrado.",
    "product.routeDescriptionAdventure": "Combina os imperdíveis culturais com uma saída de natureza para dar variedade à viagem sem deixá-la pesada demais.",
    "product.routeDescriptionConnection": "Rota eficiente que conecta o Vale Sagrado a Machu Picchu e reduz traslados repetidos.",
    "product.routeDescriptionClassic": "Opção equilibrada para conhecer Cusco, o Vale Sagrado e Machu Picchu em um ritmo confortável.",
    "product.routeDescriptionSuggested": "Rota sugerida conforme duração, horários de chegada e principais experiências do pacote.",
    "product.sacredValley": "Vale Sagrado",
    "product.sacredValleyConnection": "Vale Sagrado com conexão",
    "product.sacredValleyVip": "Vale Sagrado VIP",
    "product.sacredValleyVipConnection": "Vale Sagrado VIP com conexão",
    "product.cityTour": "City Tour Cusco",
    "product.southValley": "Vale Sul",
    "product.humantayLake": "Lago Humantay",
    "product.rainbowMountain": "Montanha Colorida",
    "product.palcoyoMountain": "Montanha Palcoyo",
    "product.sevenLakes": "Sete Lagoas do Ausangate",
    "product.ancestralWelcome": "Boas-vindas Ancestrais",
    "product.machuPicchuClassic": "Machu Picchu clássico",
    "product.machuPicchuExpress": "Machu Picchu express",
    "product.activity": "Atividade",
    "product.allInclusiveServices": "Serviços tudo incluído",
    "product.allInclusiveServicesText": "Adiciona automaticamente ingressos, entradas, almoços e serviços recomendados.",
    "product.additionalService": "Serviço adicional",
    "product.recommended": "Recomendado",
    "product.optional": "Opcional",
    "product.departureAt": "Saída {time}",
    "product.selectDepartureTime": "Selecione um horário",
    "product.departureTimeFixed": "Este tour tem um horário fixo de saída.",
    "product.departureTimeHelp": "Escolha o horário de sua preferência. A equipe de reservas revisará a disponibilidade final.",
    "product.pendingSelection": "Seleção pendente",
    "product.notApplicable": "Não se aplica",
    "product.transferIn": "Traslado de chegada no início do pacote",
    "product.transferOut": "Traslado de saída ao finalizar o pacote",
    "product.travelAssistance": "Assistência de viagem antes e durante a experiência",
    "product.indicatedTours": "Tours indicados no itinerário",
    "product.touristTransportProgram": "Transporte turístico conforme o programa",
    "product.professionalGuideIncluded": "Guia profissional em espanhol e inglês",
    "product.machuExperience": "Experiência Machu Picchu conforme a opção selecionada",
    "product.touristTrainSelected": "Trem turístico conforme o serviço selecionado",
    "product.consetturBus": "Ônibus Consettur de subida e descida a Machu Picchu",
    "product.officialMachuEntry": "Ingresso oficial para Machu Picchu",
    "product.accommodationByCategory": "Hospedagem conforme a categoria e quarto selecionados",
    "product.domesticInternationalFlights": "Voos nacionais ou internacionais",
    "product.personalExpenses": "Despesas pessoais",
    "product.notMentionedServices": "Serviços não mencionados expressamente",
    "product.voluntaryTips": "Gorjetas voluntárias",
    "product.optionalUpgradesNotSelected": "Upgrades opcionais não selecionados",
    "product.freeTime": "Tempo livre",
    "product.freeTimeUntilDepartureTransfer": "Tempo livre até o traslado de saída",
    "product.includedDestinations": "Destinos incluídos",
    "product.mainExperiences": "Principais experiências",
    "product.configurableHotels": "Hotéis configuráveis",
    "product.configurableHotelsText": "A hospedagem pode ser ajustada por destino, categoria e disponibilidade. A proposta final é revisada por meio de uma cotação personalizada.",
    "product.customQuoteText": "Nossa equipe pode preparar a rota final conforme datas, hotéis, voos internos e preferências de viagem."
    ,"product.select": "Selecione",
    "product.selectCountry": "Selecione o país",
    "product.reviewsCount": "(24 avaliações)"
  },
  fr: {
    "product.guideSpanishEnglish": "espagnol et anglais (français sur demande/coordination préalable et peut entraîner un coût supplémentaire)",
    "product.otherLanguagesOnRequest": "français sur demande/coordination préalable et peut entraîner un coût supplémentaire",
    "product.guideIn": "Guide professionnel : {languages}",
    "product.groupSizeFlexible": "Selon le service sélectionné",
    "product.infoPending": "Les informations seront fournies par votre conseiller voyage.",
    "product.durationPending": "Durée flexible selon l'itinéraire sélectionné",
    "product.toConfirm": "Coordonné avec votre conseiller voyage",
    "product.mainExperiencesPending": "Les expériences principales sont ajustées selon l'itinéraire sélectionné.",
    "product.accommodationPending": "Hébergement selon la catégorie sélectionnée",
    "product.itineraryPending": "L'itinéraire détaillé sera coordonné selon vos dates de voyage.",
    "product.faqPending": "Nous ajouterons bientôt les questions fréquentes.",
    "product.fullDayItinerary": "Itinéraire détaillé de la journée",
    "product.packageOptionsIntro": "Choisissez l'itinéraire qui correspond le mieux à votre rythme de voyage, à vos intérêts et aux lieux que vous souhaitez visiter. Vous pouvez changer d'option sans perdre votre réservation.",
    "product.showMoreOptions": "Voir plus d'options",
    "product.itineraryOption": "Itinéraire",
    "product.more": "de plus",
    "product.routeRecommended": "Itinéraire recommandé",
    "product.routeIntenseNature": "Itinéraire nature intense",
    "product.routeAdventure": "Itinéraire aventure",
    "product.routeNature": "Itinéraire nature",
    "product.routeComplete": "Itinéraire le plus complet",
    "product.routeClassic": "Itinéraire classique",
    "product.paceHighNature": "Rythme soutenu · plus de nature et de randonnées",
    "product.paceMediumHigh": "Rythme moyen/soutenu · inclut une randonnée panoramique",
    "product.paceComplete": "Rythme complet · plus de visites dans la Vallée Sacrée",
    "product.paceEfficient": "Rythme efficace · moins de transferts répétés",
    "product.paceComfortable": "Rythme confortable · idéal pour une première visite",
    "product.routeDescriptionIntenseNature": "Pensé pour les voyageurs qui souhaitent ajouter les paysages naturels les plus forts de Cusco, avec des journées de randonnée et des temps de repos équilibrés.",
    "product.routeDescriptionAdventure": "Combine les incontournables culturels avec une sortie nature pour varier le voyage sans le rendre trop chargé.",
    "product.routeDescriptionConnection": "Itinéraire efficace reliant la Vallée Sacrée à Machu Picchu et réduisant les transferts répétés.",
    "product.routeDescriptionClassic": "Option équilibrée pour découvrir Cusco, la Vallée Sacrée et Machu Picchu à un rythme confortable.",
    "product.routeDescriptionSuggested": "Itinéraire suggéré selon la durée, les horaires d'arrivée et les expériences principales du forfait.",
    "product.sacredValley": "Vallée Sacrée",
    "product.sacredValleyConnection": "Vallée Sacrée avec connexion",
    "product.sacredValleyVip": "Vallée Sacrée VIP",
    "product.sacredValleyVipConnection": "Vallée Sacrée VIP avec connexion",
    "product.cityTour": "City Tour Cusco",
    "product.southValley": "Vallée Sud",
    "product.humantayLake": "Lac Humantay",
    "product.rainbowMountain": "Montagne Arc-en-ciel",
    "product.palcoyoMountain": "Montagne Palcoyo",
    "product.sevenLakes": "Sept Lacs de l'Ausangate",
    "product.ancestralWelcome": "Accueil ancestral",
    "product.machuPicchuClassic": "Machu Picchu classique",
    "product.machuPicchuExpress": "Machu Picchu express",
    "product.activity": "Activité",
    "product.allInclusiveServices": "Services tout inclus",
    "product.allInclusiveServicesText": "Ajoute automatiquement les billets, entrées, déjeuners et services recommandés.",
    "product.additionalService": "Service supplémentaire",
    "product.recommended": "Recommandé",
    "product.optional": "Optionnel",
    "product.departureAt": "Départ {time}",
    "product.selectDepartureTime": "Sélectionnez un horaire",
    "product.departureTimeFixed": "Ce tour a un horaire de départ fixe.",
    "product.departureTimeHelp": "Choisissez l'horaire souhaité. L'équipe de réservation vérifiera la disponibilité finale.",
    "product.pendingSelection": "Sélection en attente",
    "product.notApplicable": "Non applicable",
    "product.transferIn": "Transfert d'arrivée au début du forfait",
    "product.transferOut": "Transfert de départ à la fin du forfait",
    "product.travelAssistance": "Assistance voyage avant et pendant l'expérience",
    "product.indicatedTours": "Tours indiqués dans l'itinéraire",
    "product.touristTransportProgram": "Transport touristique selon le programme",
    "product.professionalGuideIncluded": "Guide professionnel en espagnol et en anglais",
    "product.machuExperience": "Expérience Machu Picchu selon l'option sélectionnée",
    "product.touristTrainSelected": "Train touristique selon le service sélectionné",
    "product.consetturBus": "Bus Consettur aller-retour vers Machu Picchu",
    "product.officialMachuEntry": "Billet officiel d'entrée à Machu Picchu",
    "product.accommodationByCategory": "Hébergement selon la catégorie et la chambre sélectionnées",
    "product.domesticInternationalFlights": "Vols nationaux ou internationaux",
    "product.personalExpenses": "Dépenses personnelles",
    "product.notMentionedServices": "Services non expressément mentionnés",
    "product.voluntaryTips": "Pourboires volontaires",
    "product.optionalUpgradesNotSelected": "Surclassements optionnels non sélectionnés",
    "product.freeTime": "Temps libre",
    "product.freeTimeUntilDepartureTransfer": "Temps libre jusqu'au transfert de départ",
    "product.includedDestinations": "Destinations incluses",
    "product.mainExperiences": "Expériences principales",
    "product.configurableHotels": "Hôtels configurables",
    "product.configurableHotelsText": "L'hébergement peut être ajusté par destination, catégorie et disponibilité. La proposition finale est révisée via un devis personnalisé.",
    "product.customQuoteText": "Notre équipe peut préparer l'itinéraire final selon vos dates, hôtels, vols internes et préférences de voyage."
    ,"product.select": "Sélectionnez",
    "product.selectCountry": "Sélectionnez le pays",
    "product.reviewsCount": "(24 avis)"
  },
  de: {
    "product.guideSpanishEnglish": "Spanisch und Englisch (Deutsch auf Anfrage/Vorabkoordination und ggf. gegen Aufpreis)",
    "product.otherLanguagesOnRequest": "Deutsch auf Anfrage/Vorabkoordination und ggf. gegen Aufpreis",
    "product.guideIn": "Professionelle Reiseleitung: {languages}",
    "product.groupSizeFlexible": "Je nach ausgewähltem Service",
    "product.infoPending": "Die Informationen erhalten Sie von Ihrem Reiseberater.",
    "product.durationPending": "Flexible Dauer je nach ausgewählter Route",
    "product.toConfirm": "Mit Ihrem Reiseberater koordiniert",
    "product.mainExperiencesPending": "Die wichtigsten Erlebnisse werden an die ausgewählte Route angepasst.",
    "product.accommodationPending": "Unterkunft gemäß ausgewählter Kategorie",
    "product.itineraryPending": "Der detaillierte Reiseverlauf wird nach Ihren Reisedaten koordiniert.",
    "product.faqPending": "Häufige Fragen werden in Kürze ergänzt.",
    "product.fullDayItinerary": "Detaillierter Tagesablauf",
    "product.packageOptionsIntro": "Wählen Sie die Route, die am besten zu Ihrem Reisetempo, Ihren Interessen und bevorzugten Orten passt. Sie können die Option wechseln, ohne Ihre Reservierung zu verlieren.",
    "product.showMoreOptions": "Weitere Optionen anzeigen",
    "product.itineraryOption": "Reiseverlauf",
    "product.more": "weitere",
    "product.routeRecommended": "Empfohlene Route",
    "product.routeIntenseNature": "Intensive Naturroute",
    "product.routeAdventure": "Abenteuerroute",
    "product.routeNature": "Naturroute",
    "product.routeComplete": "Umfassendste Route",
    "product.routeClassic": "Klassische Route",
    "product.paceHighNature": "Hohes Tempo · mehr Natur und Wanderungen",
    "product.paceMediumHigh": "Mittleres/hohes Tempo · beinhaltet eine Panoramawanderung",
    "product.paceComplete": "Vollständiges Tempo · mehr Besuche im Heiligen Tal",
    "product.paceEfficient": "Effizientes Tempo · weniger wiederholte Transfers",
    "product.paceComfortable": "Angenehmes Tempo · ideal für den ersten Besuch",
    "product.routeDescriptionIntenseNature": "Für Reisende, die Cuscos stärkste Naturlandschaften mit Wandertagen und ausgewogenen Pausen erleben möchten.",
    "product.routeDescriptionAdventure": "Kombiniert kulturelle Höhepunkte mit einem Naturausflug, damit die Reise abwechslungsreich bleibt, ohne zu schwer zu werden.",
    "product.routeDescriptionConnection": "Effiziente Route, die das Heilige Tal mit Machu Picchu verbindet und wiederholte Transfers reduziert.",
    "product.routeDescriptionClassic": "Ausgewogene Option, um Cusco, das Heilige Tal und Machu Picchu in angenehmem Tempo kennenzulernen.",
    "product.routeDescriptionSuggested": "Vorgeschlagene Route basierend auf Dauer, Ankunftszeiten und den wichtigsten Erlebnissen des Pakets.",
    "product.sacredValley": "Heiliges Tal",
    "product.sacredValleyConnection": "Heiliges Tal mit Verbindung",
    "product.sacredValleyVip": "Heiliges Tal VIP",
    "product.sacredValleyVipConnection": "Heiliges Tal VIP mit Verbindung",
    "product.cityTour": "City Tour Cusco",
    "product.southValley": "Südliches Tal",
    "product.humantayLake": "Humantay-See",
    "product.rainbowMountain": "Regenbogenberg",
    "product.palcoyoMountain": "Palcoyo-Berg",
    "product.sevenLakes": "Sieben Seen des Ausangate",
    "product.ancestralWelcome": "Zeremonieller Empfang",
    "product.machuPicchuClassic": "Machu Picchu klassisch",
    "product.machuPicchuExpress": "Machu Picchu express",
    "product.activity": "Aktivität",
    "product.allInclusiveServices": "All-inclusive-Leistungen",
    "product.allInclusiveServicesText": "Fügt empfohlene Tickets, Eintritte, Mittagessen und Leistungen automatisch hinzu.",
    "product.additionalService": "Zusätzliche Leistung",
    "product.recommended": "Empfohlen",
    "product.optional": "Optional",
    "product.departureAt": "Abfahrt {time}",
    "product.selectDepartureTime": "Wählen Sie eine Uhrzeit",
    "product.departureTimeFixed": "Diese Tour hat eine feste Abfahrtszeit.",
    "product.departureTimeHelp": "Wählen Sie Ihre bevorzugte Uhrzeit. Das Reservierungsteam prüft die endgültige Verfügbarkeit.",
    "product.pendingSelection": "Auswahl ausstehend",
    "product.notApplicable": "Nicht zutreffend",
    "product.transferIn": "Ankunftstransfer zu Beginn des Pakets",
    "product.transferOut": "Abreisetransfer am Ende des Pakets",
    "product.travelAssistance": "Reisebetreuung vor und während des Erlebnisses",
    "product.indicatedTours": "Im Reiseverlauf angegebene Touren",
    "product.touristTransportProgram": "Touristischer Transport gemäß Programm",
    "product.professionalGuideIncluded": "Professionelle Reiseleitung auf Spanisch und Englisch",
    "product.machuExperience": "Machu-Picchu-Erlebnis gemäß ausgewählter Option",
    "product.touristTrainSelected": "Touristenzug gemäß ausgewähltem Service",
    "product.consetturBus": "Consettur-Bus hinauf und hinunter nach Machu Picchu",
    "product.officialMachuEntry": "Offizielles Eintrittsticket für Machu Picchu",
    "product.accommodationByCategory": "Unterkunft gemäß ausgewählter Kategorie und Zimmerart",
    "product.domesticInternationalFlights": "Nationale oder internationale Flüge",
    "product.personalExpenses": "Persönliche Ausgaben",
    "product.notMentionedServices": "Nicht ausdrücklich erwähnte Leistungen",
    "product.voluntaryTips": "Freiwillige Trinkgelder",
    "product.optionalUpgradesNotSelected": "Nicht ausgewählte optionale Upgrades",
    "product.freeTime": "Freizeit",
    "product.freeTimeUntilDepartureTransfer": "Freizeit bis zum Abreisetransfer",
    "product.includedDestinations": "Enthaltene Reiseziele",
    "product.mainExperiences": "Wichtigste Erlebnisse",
    "product.configurableHotels": "Konfigurierbare Hotels",
    "product.configurableHotelsText": "Die Unterkunft kann nach Zielort, Kategorie und Verfügbarkeit angepasst werden. Das finale Angebot wird in einem personalisierten Kostenvoranschlag geprüft.",
    "product.customQuoteText": "Unser Team kann die endgültige Route nach Reisedaten, Hotels, Inlandsflügen und Reisewünschen vorbereiten."
    ,"product.select": "Auswählen",
    "product.selectCountry": "Land auswählen",
    "product.reviewsCount": "(24 Bewertungen)"
  }
};

const logisticsText = {
  es: {
    arrivalTitle: "Recojo desde aeropuerto o terminal terrestre",
    arrivalDescription: "Servicio incluido al inicio del paquete, coordinado según tu hora real de llegada.",
    departureTitle: "Traslado al aeropuerto o terminal terrestre",
    departureDescription: "Servicio incluido al finalizar el paquete, coordinado según tu hora real de salida."
  },
  en: {
    arrivalTitle: "Pickup from airport or bus terminal",
    arrivalDescription: "Included service at the beginning of the package, coordinated according to your actual arrival time.",
    departureTitle: "Transfer to airport or bus terminal",
    departureDescription: "Included service at the end of the package, coordinated according to your actual departure time."
  },
  pt: {
    arrivalTitle: "Busca no aeroporto ou terminal terrestre",
    arrivalDescription: "Serviço incluído no início do pacote, coordenado conforme seu horário real de chegada.",
    departureTitle: "Traslado ao aeroporto ou terminal terrestre",
    departureDescription: "Serviço incluído ao finalizar o pacote, coordenado conforme seu horário real de saída."
  },
  fr: {
    arrivalTitle: "Prise en charge à l'aéroport ou au terminal terrestre",
    arrivalDescription: "Service inclus au début du forfait, coordonné selon votre heure réelle d'arrivée.",
    departureTitle: "Transfert vers l'aéroport ou le terminal terrestre",
    departureDescription: "Service inclus à la fin du forfait, coordonné selon votre heure réelle de départ."
  },
  de: {
    arrivalTitle: "Abholung am Flughafen oder Busbahnhof",
    arrivalDescription: "Inklusive Leistung zu Beginn des Pakets, abgestimmt auf Ihre tatsächliche Ankunftszeit.",
    departureTitle: "Transfer zum Flughafen oder Busbahnhof",
    departureDescription: "Inklusive Leistung am Ende des Pakets, abgestimmt auf Ihre tatsächliche Abfahrtszeit."
  }
};

const extraLabels = {
  en: {
    "btc-circuit-1-nationality": "Partial Tourist Ticket Circuit 1",
    "btc-circuit-2-nationality": "Partial Tourist Ticket Circuit 2",
    "btc-circuit-3-nationality": "Partial Tourist Ticket Circuit 3",
    "qoricancha-ticket": "Entrance to Qoricancha Temple",
    "maras-salt-mines-ticket": "Entrance to Maras Salt Mines",
    "maras-salt-mines-ticket-vip-only": "Entrance to Maras Salt Mines",
    "sacred-valley-buffet-basic": "Sacred Valley buffet lunch",
    "andahuaylillas-church-ticket": "Entrance to Andahuaylillas Church",
    "humantay-entrance-ticket": "Humantay Lake entrance ticket",
    "trekking-food-pack": "Basic breakfast and lunch",
    "vinicunca-entrance-ticket": "Rainbow Mountain Vinicunca entrance ticket",
    "palcoyo-entrance-ticket": "Palcoyo Mountain entrance ticket",
    "seven-lagoons-entrance-ticket": "Seven Lagoons of Ausangate entrance ticket",
    "pacchanta-hot-springs": "Entrance to Pacchanta hot springs",
    "atv-maras-moray": "Maras and Moray ATV quad bike",
    "atv-vinicunca": "Vinicunca ATV quad bike",
    "atv-palcoyo": "Palcoyo ATV quad bike",
    "horse-vinicunca": "Optional horse in Vinicunca",
    "lunch-alpaquito": "Tourist lunch at Alpaquito restaurant",
    "lunch-tinkuy-belmond": "Tinkuy buffet lunch by Belmond Sanctuary Lodge",
    "colca-tourist-ticket": "Colca tourist ticket",
    "santa-catalina-ticket": "Entrance to Santa Catalina Monastery",
    "titicaca-lunch": "Local lunch in Taquile",
    "sillustani-ticket": "Entrance to Sillustani",
    "laguna-azul-lunch": "Regional lunch",
    "ahuashiyacu-ticket": "Entrance to Ahuashiyacu",
    "amazonas-lunch": "Amazonian lunch",
    "tambopata-lunch": "Regional lunch"
  },
  pt: {
    "btc-circuit-1-nationality": "Bilhete Turístico Parcial Circuito 1",
    "btc-circuit-2-nationality": "Bilhete Turístico Parcial Circuito 2",
    "btc-circuit-3-nationality": "Bilhete Turístico Parcial Circuito 3",
    "qoricancha-ticket": "Entrada ao Templo Qoricancha",
    "maras-salt-mines-ticket": "Entrada às Salineras de Maras",
    "maras-salt-mines-ticket-vip-only": "Entrada às Salineras de Maras",
    "sacred-valley-buffet-basic": "Almoço buffet no Vale Sagrado",
    "andahuaylillas-church-ticket": "Entrada à Igreja de Andahuaylillas",
    "humantay-entrance-ticket": "Entrada ao Lago Humantay",
    "trekking-food-pack": "Café da manhã e almoço básicos",
    "vinicunca-entrance-ticket": "Entrada à Montanha Colorida Vinicunca",
    "palcoyo-entrance-ticket": "Entrada à Montanha Palcoyo",
    "seven-lagoons-entrance-ticket": "Entrada às Sete Lagoas do Ausangate",
    "pacchanta-hot-springs": "Entrada às águas termais de Pacchanta",
    "atv-maras-moray": "Quadriciclo ATV Maras e Moray",
    "atv-vinicunca": "Quadriciclo ATV Vinicunca",
    "atv-palcoyo": "Quadriciclo ATV Palcoyo",
    "horse-vinicunca": "Cavalo opcional em Vinicunca",
    "lunch-alpaquito": "Almoço turístico no restaurante Alpaquito",
    "lunch-tinkuy-belmond": "Almoço buffet Tinkuy by Belmond Sanctuary Lodge",
    "colca-tourist-ticket": "Bilhete turístico do Colca",
    "santa-catalina-ticket": "Entrada ao Mosteiro de Santa Catalina",
    "titicaca-lunch": "Almoço local em Taquile",
    "sillustani-ticket": "Entrada a Sillustani",
    "laguna-azul-lunch": "Almoço regional",
    "ahuashiyacu-ticket": "Entrada a Ahuashiyacu",
    "amazonas-lunch": "Almoço amazônico",
    "tambopata-lunch": "Almoço regional"
  },
  fr: {
    "btc-circuit-1-nationality": "Billet touristique partiel Circuit 1",
    "btc-circuit-2-nationality": "Billet touristique partiel Circuit 2",
    "btc-circuit-3-nationality": "Billet touristique partiel Circuit 3",
    "qoricancha-ticket": "Entrée au Temple Qoricancha",
    "maras-salt-mines-ticket": "Entrée aux salines de Maras",
    "maras-salt-mines-ticket-vip-only": "Entrée aux salines de Maras",
    "sacred-valley-buffet-basic": "Déjeuner buffet dans la Vallée Sacrée",
    "andahuaylillas-church-ticket": "Entrée à l'église d'Andahuaylillas",
    "humantay-entrance-ticket": "Entrée au lac Humantay",
    "trekking-food-pack": "Petit-déjeuner et déjeuner basiques",
    "vinicunca-entrance-ticket": "Entrée à la Montagne Arc-en-ciel Vinicunca",
    "palcoyo-entrance-ticket": "Entrée à la montagne Palcoyo",
    "seven-lagoons-entrance-ticket": "Entrée aux Sept Lacs de l'Ausangate",
    "pacchanta-hot-springs": "Entrée aux sources thermales de Pacchanta",
    "atv-maras-moray": "Quad ATV Maras et Moray",
    "atv-vinicunca": "Quad ATV Vinicunca",
    "atv-palcoyo": "Quad ATV Palcoyo",
    "horse-vinicunca": "Cheval optionnel à Vinicunca",
    "lunch-alpaquito": "Déjeuner touristique au restaurant Alpaquito",
    "lunch-tinkuy-belmond": "Déjeuner buffet Tinkuy by Belmond Sanctuary Lodge",
    "colca-tourist-ticket": "Billet touristique du Colca",
    "santa-catalina-ticket": "Entrée au monastère de Santa Catalina",
    "titicaca-lunch": "Déjeuner local à Taquile",
    "sillustani-ticket": "Entrée à Sillustani",
    "laguna-azul-lunch": "Déjeuner régional",
    "ahuashiyacu-ticket": "Entrée à Ahuashiyacu",
    "amazonas-lunch": "Déjeuner amazonien",
    "tambopata-lunch": "Déjeuner régional"
  },
  de: {
    "btc-circuit-1-nationality": "Teilweises Touristenticket Rundgang 1",
    "btc-circuit-2-nationality": "Teilweises Touristenticket Rundgang 2",
    "btc-circuit-3-nationality": "Teilweises Touristenticket Rundgang 3",
    "qoricancha-ticket": "Eintritt zum Qoricancha-Tempel",
    "maras-salt-mines-ticket": "Eintritt zu den Salzminen von Maras",
    "maras-salt-mines-ticket-vip-only": "Eintritt zu den Salzminen von Maras",
    "sacred-valley-buffet-basic": "Buffet-Mittagessen im Heiligen Tal",
    "andahuaylillas-church-ticket": "Eintritt zur Kirche von Andahuaylillas",
    "humantay-entrance-ticket": "Eintritt zum Humantay-See",
    "trekking-food-pack": "Einfaches Frühstück und Mittagessen",
    "vinicunca-entrance-ticket": "Eintritt zum Regenbogenberg Vinicunca",
    "palcoyo-entrance-ticket": "Eintritt zum Palcoyo-Berg",
    "seven-lagoons-entrance-ticket": "Eintritt zu den Sieben Seen des Ausangate",
    "pacchanta-hot-springs": "Eintritt zu den Thermalquellen von Pacchanta",
    "atv-maras-moray": "ATV-Quad Maras und Moray",
    "atv-vinicunca": "ATV-Quad Vinicunca",
    "atv-palcoyo": "ATV-Quad Palcoyo",
    "horse-vinicunca": "Optionales Pferd in Vinicunca",
    "lunch-alpaquito": "Touristisches Mittagessen im Restaurant Alpaquito",
    "lunch-tinkuy-belmond": "Tinkuy-Buffet-Mittagessen by Belmond Sanctuary Lodge",
    "colca-tourist-ticket": "Touristenticket Colca",
    "santa-catalina-ticket": "Eintritt zum Kloster Santa Catalina",
    "titicaca-lunch": "Lokales Mittagessen in Taquile",
    "sillustani-ticket": "Eintritt nach Sillustani",
    "laguna-azul-lunch": "Regionales Mittagessen",
    "ahuashiyacu-ticket": "Eintritt nach Ahuashiyacu",
    "amazonas-lunch": "Amazonas-Mittagessen",
    "tambopata-lunch": "Regionales Mittagessen"
  },
  es: {}
};
extraLabels.es = {
  ...extraLabels.en,
  "btc-circuit-1-nationality": "Boleto Turístico Parcial Circuito 1",
  "btc-circuit-2-nationality": "Boleto Turístico Parcial Circuito 2",
  "btc-circuit-3-nationality": "Boleto Turístico Parcial Circuito 3",
  "qoricancha-ticket": "Ingreso al Templo Qoricancha",
  "andahuaylillas-church-ticket": "Ingreso a la Iglesia de Andahuaylillas",
  "sacred-valley-buffet-basic": "Almuerzo buffet en el Valle Sagrado"
};

const southValley = {
  es: {
    title: "Valle Sur de Cusco",
    shortDescription: "Recorre Tipón, Pikillacta y Andahuaylillas en una ruta cultural de medio día al sur de Cusco.",
    description: "Este tour de medio día inicia con el recojo en tu hotel de Cusco entre las 8:00 y 8:30 a. m. Viajaremos hacia el sur para visitar Tipón, reconocido por su ingeniería hidráulica inca; Pikillacta, antigua ciudadela Wari; y la iglesia de Andahuaylillas, famosa por su arte mural y retablos barrocos. El retorno a Cusco suele ser alrededor de las 2:30 p. m.",
    duration: "Medio día",
    includes: ["Recojo en Cusco", "Transporte turístico", guidePhrase.es],
    excludes: ["Boleto turístico parcial Circuito 3", "Ingreso a la Iglesia de Andahuaylillas", "Gastos personales"],
    itinerary: [
      ["Salida desde Cusco", "Recojo en tu hotel entre las 8:00 y 8:30 a. m. para iniciar la ruta hacia el sur del Cusco."],
      ["Tipón", "Visita al sitio arqueológico de Tipón, famoso por sus canales de agua y su sistema hidráulico inca aún funcional."],
      ["Pikillacta", "Recorrido por la antigua ciudadela Wari de Pikillacta, una muestra importante de urbanismo preinca."],
      ["Andahuaylillas", "Visita a la iglesia de Andahuaylillas, conocida como la Capilla Sixtina de América por sus murales, lienzos y retablos barrocos."]
    ]
  },
  en: {
    title: "South Valley of Cusco",
    shortDescription: "Explore Tipon, Pikillacta and Andahuaylillas on a cultural half-day route south of Cusco.",
    description: "This half-day tour starts with pickup at your Cusco hotel between 8:00 and 8:30 AM. We travel south to visit Tipon, known for its Inca hydraulic engineering; Pikillacta, an ancient Wari citadel; and Andahuaylillas Church, famous for its murals and baroque altarpieces. Return to Cusco is usually around 2:30 PM.",
    duration: "Half day",
    includes: ["Pickup in Cusco", "Tourist transport", guidePhrase.en],
    excludes: ["Partial Tourist Ticket Circuit 3", "Entrance to Andahuaylillas Church", "Personal expenses"],
    itinerary: [
      ["Departure from Cusco", "Pickup from your hotel between 8:00 and 8:30 AM to begin the route to southern Cusco."],
      ["Tipon", "Visit the Tipon archaeological site, famous for its Inca hydraulic system and still-functioning water channels."],
      ["Pikillacta", "Explore the ancient Wari citadel of Pikillacta, an important example of pre-Inca urban planning."],
      ["Andahuaylillas", "Visit Andahuaylillas Church, known as the Sistine Chapel of the Americas for its murals, canvases and baroque altarpieces."]
    ]
  },
  pt: {
    title: "Vale Sul de Cusco",
    shortDescription: "Conheça Tipón, Pikillacta e Andahuaylillas em uma rota cultural de meio dia ao sul de Cusco.",
    description: "Este tour de meio dia começa com a busca no seu hotel em Cusco entre 8:00 e 8:30. Seguimos para o sul para visitar Tipón, reconhecido pela engenharia hidráulica inca; Pikillacta, antiga cidadela Wari; e a igreja de Andahuaylillas, famosa por seus murais e retábulos barrocos. O retorno a Cusco costuma ser por volta das 14:30.",
    duration: "Meio dia",
    includes: ["Busca em Cusco", "Transporte turístico", guidePhrase.pt],
    excludes: ["Bilhete Turístico Parcial Circuito 3", "Entrada à Igreja de Andahuaylillas", "Despesas pessoais"],
    itinerary: [
      ["Saída de Cusco", "Busca no seu hotel entre 8:00 e 8:30 para iniciar a rota ao sul de Cusco."],
      ["Tipón", "Visita ao sítio arqueológico de Tipón, famoso por seus canais de água e pelo sistema hidráulico inca ainda funcional."],
      ["Pikillacta", "Percurso pela antiga cidadela Wari de Pikillacta, uma importante mostra de urbanismo pré-inca."],
      ["Andahuaylillas", "Visita à igreja de Andahuaylillas, conhecida como a Capela Sistina da América por seus murais, telas e retábulos barrocos."]
    ]
  },
  fr: {
    title: "Vallée Sud de Cusco",
    shortDescription: "Explorez Tipón, Pikillacta et Andahuaylillas lors d'un itinéraire culturel d'une demi-journée au sud de Cusco.",
    description: "Ce tour d'une demi-journée commence par la prise en charge à votre hôtel à Cusco entre 8h00 et 8h30. Nous partons vers le sud pour visiter Tipón, reconnu pour son ingénierie hydraulique inca ; Pikillacta, ancienne citadelle wari ; et l'église d'Andahuaylillas, célèbre pour ses fresques et retables baroques. Le retour à Cusco se fait généralement vers 14h30.",
    duration: "Demi-journée",
    includes: ["Prise en charge à Cusco", "Transport touristique", guidePhrase.fr],
    excludes: ["Billet touristique partiel Circuit 3", "Entrée à l'église d'Andahuaylillas", "Dépenses personnelles"],
    itinerary: [
      ["Départ de Cusco", "Prise en charge à votre hôtel entre 8h00 et 8h30 pour commencer l'itinéraire vers le sud de Cusco."],
      ["Tipón", "Visite du site archéologique de Tipón, célèbre pour ses canaux d'eau et son système hydraulique inca encore fonctionnel."],
      ["Pikillacta", "Parcours dans l'ancienne citadelle wari de Pikillacta, exemple important d'urbanisme pré-inca."],
      ["Andahuaylillas", "Visite de l'église d'Andahuaylillas, connue comme la Chapelle Sixtine d'Amérique pour ses fresques, toiles et retables baroques."]
    ]
  },
  de: {
    title: "Südliches Tal von Cusco",
    shortDescription: "Erkunden Sie Tipón, Pikillacta und Andahuaylillas auf einer kulturellen Halbtagestour südlich von Cusco.",
    description: "Diese Halbtagestour beginnt mit der Abholung in Ihrem Hotel in Cusco zwischen 8:00 und 8:30 Uhr. Wir fahren nach Süden und besuchen Tipón, bekannt für seine Inka-Wasserbaukunst; Pikillacta, eine alte Wari-Zitadelle; und die Kirche von Andahuaylillas, berühmt für ihre Wandmalereien und barocken Altäre. Die Rückkehr nach Cusco erfolgt normalerweise gegen 14:30 Uhr.",
    duration: "Halbtägig",
    includes: ["Abholung in Cusco", "Touristischer Transport", guidePhrase.de],
    excludes: ["Teilweises Touristenticket Rundgang 3", "Eintritt zur Kirche von Andahuaylillas", "Persönliche Ausgaben"],
    itinerary: [
      ["Abfahrt aus Cusco", "Abholung von Ihrem Hotel zwischen 8:00 und 8:30 Uhr, um die Route südlich von Cusco zu beginnen."],
      ["Tipón", "Besuch der archäologischen Stätte Tipón, berühmt für ihre Wasserkanäle und das noch funktionierende Inka-Hydrauliksystem."],
      ["Pikillacta", "Rundgang durch die alte Wari-Zitadelle Pikillacta, ein wichtiges Beispiel präinkaischer Stadtplanung."],
      ["Andahuaylillas", "Besuch der Kirche von Andahuaylillas, wegen ihrer Wandmalereien, Leinwände und barocken Altäre als Sixtinische Kapelle Amerikas bekannt."]
    ]
  }
};

const cuscoSummaries = {
  pt: {
    CUZ001: ["Boas-vindas Ancestrais em Cusco", "Aproveite uma introdução panorâmica a Cusco com cerimônia andina, visita a um centro têxtil e vistas do Cristo Blanco.", "Uma experiência curta e cultural para começar sua viagem em Cusco com contexto, paisagens e uma cerimônia simbólica de boas-vindas andina."],
    CUZ002: ["City Tour Cusco + Sítios Arqueológicos", "Percorra Cusco, Sacsayhuamán, Qenqo, Puka Pukara e Tambomachay em uma tarde cultural.", "Tour clássico de meio dia pelos principais sítios arqueológicos próximos a Cusco, ideal para entender a história inca antes de visitar o Vale Sagrado e Machu Picchu."],
    CUZ003FD: ["Vale Sagrado dos Incas - Dia inteiro", "Conheça Pisac, Urubamba, Ollantaytambo e Chinchero em uma rota cultural completa pelo Vale Sagrado.", "Rota full day pelo Vale Sagrado dos Incas, combinando sítios arqueológicos, paisagens andinas, mercado artesanal, tradições têxteis e tempo para almoço opcional em Urubamba."],
    CUZ003CON: ["Vale Sagrado com conexão a Machu Picchu", "Rota clássica pelo Vale Sagrado finalizando em Ollantaytambo para conectar com o trem a Aguas Calientes.", "Versão do Vale Sagrado pensada para quem continuará a Machu Picchu, evitando retornar a Cusco e aproveitando melhor a logística da viagem."],
    CUZ003VIP: ["Vale Sagrado VIP - Dia inteiro", "Rota ampliada por Chinchero, Maras, Moray, Urubamba, Ollantaytambo e Pisac.", "Experiência mais completa pelo Vale Sagrado, incluindo Salineras de Maras e Moray junto aos principais sítios culturais do vale."],
    CUZ003VIPCON: ["Vale Sagrado VIP com conexão a Machu Picchu", "Rota VIP por Chinchero, Maras, Moray, Urubamba e Ollantaytambo, finalizando com conexão a Machu Picchu.", "Opção eficiente para unir a rota VIP do Vale Sagrado com a continuação para Aguas Calientes ou Machu Picchu."],
    CUZ004: ["Maras e Moray", "Descubra o laboratório agrícola inca de Moray e as famosas Salineras de Maras.", "Tour de meio dia ideal para conhecer paisagens agrícolas, terraços circulares incas e as tradicionais piscinas de sal de Maras."],
    CUZ006: ["Lago Humantay", "Caminhe até a lagoa turquesa aos pés do nevado Humantay.", "Full day de natureza e caminhada de altitude até uma das paisagens mais impressionantes da região de Cusco."],
    CUZ007: ["Montanha Colorida Vinicunca", "Viva uma aventura até a famosa montanha arco-íris dos Andes.", "Caminhada de dia inteiro em alta montanha para visitar Vinicunca, com paisagens andinas, comunidades locais e vistas panorâmicas."],
    CUZ008: ["Montanha Palcoyo", "Explore a cordilheira colorida de Palcoyo e seu bosque de pedras em uma caminhada mais acessível.", "Alternativa cênica à Montanha Colorida tradicional, com caminhada mais suave e várias montanhas coloridas no percurso."],
    CUZ009: ["Sete Lagoas do Ausangate", "Explore as Sete Lagoas do Ausangate em um full day entre montanhas, glaciares e paisagens altoandinas.", "Rota de natureza aos pés do Ausangate, combinando caminhada, lagoas de altitude e a possibilidade de visitar as águas termais de Pacchanta."]
  },
  fr: {
    CUZ001: ["Accueil ancestral à Cusco", "Profitez d'une introduction panoramique à Cusco avec cérémonie andine, visite d'un centre textile et vues depuis le Cristo Blanco.", "Une expérience courte et culturelle pour commencer votre voyage à Cusco avec contexte, paysages et cérémonie symbolique de bienvenue andine."],
    CUZ002: ["City Tour Cusco + Sites archéologiques", "Parcourez Cusco, Sacsayhuamán, Qenqo, Puka Pukara et Tambomachay lors d'un après-midi culturel.", "Tour classique d'une demi-journée des principaux sites archéologiques proches de Cusco, idéal pour comprendre l'histoire inca avant le Vallée Sacrée et Machu Picchu."],
    CUZ003FD: ["Vallée Sacrée des Incas - Journée complète", "Découvrez Pisac, Urubamba, Ollantaytambo et Chinchero sur un itinéraire culturel complet dans la Vallée Sacrée.", "Route full day dans la Vallée Sacrée des Incas, combinant sites archéologiques, paysages andins, marché artisanal, traditions textiles et déjeuner optionnel à Urubamba."],
    CUZ003CON: ["Vallée Sacrée avec connexion à Machu Picchu", "Itinéraire classique dans la Vallée Sacrée se terminant à Ollantaytambo pour prendre le train vers Aguas Calientes.", "Version de la Vallée Sacrée conçue pour continuer vers Machu Picchu, en évitant le retour à Cusco et en optimisant la logistique du voyage."],
    CUZ003VIP: ["Vallée Sacrée VIP - Journée complète", "Itinéraire élargi par Chinchero, Maras, Moray, Urubamba, Ollantaytambo et Pisac.", "Expérience plus complète dans la Vallée Sacrée, incluant les salines de Maras et Moray avec les principaux sites culturels de la vallée."],
    CUZ003VIPCON: ["Vallée Sacrée VIP avec connexion à Machu Picchu", "Route VIP par Chinchero, Maras, Moray, Urubamba et Ollantaytambo, avec connexion vers Machu Picchu.", "Option efficace pour combiner la route VIP de la Vallée Sacrée avec la continuation vers Aguas Calientes ou Machu Picchu."],
    CUZ004: ["Maras et Moray", "Découvrez le laboratoire agricole inca de Moray et les célèbres salines de Maras.", "Tour d'une demi-journée idéal pour découvrir les paysages agricoles, les terrasses circulaires incas et les bassins de sel traditionnels de Maras."],
    CUZ006: ["Lac Humantay", "Marchez jusqu'au lac turquoise au pied du glacier Humantay.", "Journée complète de nature et randonnée en altitude vers l'un des paysages les plus impressionnants de la région de Cusco."],
    CUZ007: ["Montagne Arc-en-ciel Vinicunca", "Vivez une aventure jusqu'à la célèbre montagne arc-en-ciel des Andes.", "Randonnée d'une journée en haute montagne pour visiter Vinicunca, avec paysages andins, communautés locales et vues panoramiques."],
    CUZ008: ["Montagne Palcoyo", "Explorez la cordillère colorée de Palcoyo et sa forêt de pierres lors d'une marche plus accessible.", "Alternative panoramique à la Montagne Arc-en-ciel traditionnelle, avec randonnée plus douce et plusieurs montagnes colorées sur le parcours."],
    CUZ009: ["Sept Lacs de l'Ausangate", "Explorez les Sept Lacs de l'Ausangate lors d'une journée complète entre montagnes, glaciers et paysages de haute altitude.", "Itinéraire nature au pied de l'Ausangate, combinant randonnée, lacs d'altitude et possibilité de visiter les sources thermales de Pacchanta."]
  },
  de: {
    CUZ001: ["Zeremonieller Empfang in Cusco", "Genießen Sie eine panoramische Einführung in Cusco mit andiner Zeremonie, Besuch eines Textilzentrums und Blicken vom Cristo Blanco.", "Ein kurzes kulturelles Erlebnis zum Auftakt Ihrer Reise in Cusco mit Kontext, Landschaften und einer symbolischen andinen Willkommenszeremonie."],
    CUZ002: ["City Tour Cusco + Archäologische Stätten", "Erkunden Sie Cusco, Sacsayhuamán, Qenqo, Puka Pukara und Tambomachay an einem kulturellen Nachmittag.", "Klassische Halbtagestour zu den wichtigsten archäologischen Stätten nahe Cusco, ideal als Einführung in die Inka-Geschichte vor dem Heiligen Tal und Machu Picchu."],
    CUZ003FD: ["Heiliges Tal der Inka - Ganztägig", "Besuchen Sie Pisac, Urubamba, Ollantaytambo und Chinchero auf einer vollständigen Kulturroute durch das Heilige Tal.", "Ganztägige Route durch das Heilige Tal der Inka mit archäologischen Stätten, Andenlandschaften, Kunsthandwerksmarkt, Textiltraditionen und optionaler Mittagspause in Urubamba."],
    CUZ003CON: ["Heiliges Tal mit Verbindung nach Machu Picchu", "Klassische Route durch das Heilige Tal mit Ende in Ollantaytambo, um den Zug nach Aguas Calientes zu nehmen.", "Version des Heiligen Tals für Reisende, die nach Machu Picchu weiterfahren, ohne nach Cusco zurückzukehren und mit besserer Reiselogistik."],
    CUZ003VIP: ["Heiliges Tal VIP - Ganztägig", "Erweiterte Route über Chinchero, Maras, Moray, Urubamba, Ollantaytambo und Pisac.", "Umfassendere Erfahrung im Heiligen Tal, inklusive Salzminen von Maras und Moray sowie der wichtigsten Kulturstätten des Tals."],
    CUZ003VIPCON: ["Heiliges Tal VIP mit Verbindung nach Machu Picchu", "VIP-Route über Chinchero, Maras, Moray, Urubamba und Ollantaytambo mit Verbindung nach Machu Picchu.", "Effiziente Option, um die VIP-Route im Heiligen Tal mit der Weiterreise nach Aguas Calientes oder Machu Picchu zu kombinieren."],
    CUZ004: ["Maras und Moray", "Entdecken Sie das landwirtschaftliche Inka-Labor Moray und die berühmten Salzminen von Maras.", "Halbtagestour zu landwirtschaftlichen Landschaften, kreisförmigen Inka-Terrassen und den traditionellen Salzbecken von Maras."],
    CUZ006: ["Humantay-See", "Wandern Sie zur türkisfarbenen Lagune am Fuß des Humantay-Gletschers.", "Ganztägiges Natur- und Höhenerlebnis zu einer der beeindruckendsten Landschaften der Region Cusco."],
    CUZ007: ["Regenbogenberg Vinicunca", "Erleben Sie ein Abenteuer zum berühmten Regenbogenberg der Anden.", "Ganztägige Hochgebirgswanderung nach Vinicunca mit Andenlandschaften, lokalen Gemeinden und Panoramablicken."],
    CUZ008: ["Palcoyo-Berg", "Erkunden Sie die farbige Bergkette von Palcoyo und ihren Steinwald auf einer leichteren Wanderung.", "Panoramische Alternative zum klassischen Regenbogenberg, mit sanfterer Wanderung und mehreren farbigen Bergen entlang der Route."],
    CUZ009: ["Sieben Seen des Ausangate", "Erkunden Sie die Sieben Seen des Ausangate auf einer ganztägigen Route zwischen Bergen, Gletschern und Hochandenlandschaften.", "Naturroute am Fuß des Ausangate mit Wanderung, Hochlandseen und der Möglichkeit, die Thermalquellen von Pacchanta zu besuchen."]
  }
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function dataPath(locale, filename) {
  return locale === "es"
    ? path.join(root, "assets", "data", filename)
    : path.join(root, "assets", "data", "i18n", locale, filename);
}

function productsFrom(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.products)) return data.products;
  if (Array.isArray(data.tours)) return data.tours;
  return [];
}

function localizeDuration(value, locale) {
  const clean = String(value || "").trim();
  if (!clean) return clean;
  const exact = {
    en: { "Medio día": "Half day", "Medio dia": "Half day", "Día completo": "Full day", "Dia completo": "Full day", "3 a 4 horas": "3 to 4 hours", "2 horas aprox.": "Approx. 2 hours", "35 min de vuelo aprox.": "Approx. 35-minute flight" },
    pt: { "Medio día": "Meio dia", "Medio dia": "Meio dia", "Half day": "Meio dia", "Full Day": "Dia inteiro", "Full day": "Dia inteiro", "Día completo": "Dia inteiro", "Dia completo": "Dia inteiro", "3 a 4 horas": "3 a 4 horas", "2 horas aprox.": "aprox. 2 horas", "35 min de vuelo aprox.": "aprox. 35 min de voo" },
    fr: { "Medio día": "Demi-journée", "Medio dia": "Demi-journée", "Half day": "Demi-journée", "Full Day": "Journée complète", "Full day": "Journée complète", "Día completo": "Journée complète", "Dia completo": "Journée complète", "3 a 4 horas": "3 à 4 heures", "2 horas aprox.": "environ 2 heures", "35 min de vuelo aprox.": "environ 35 min de vol" },
    de: { "Medio día": "Halbtägig", "Medio dia": "Halbtägig", "Half day": "Halbtägig", "Full Day": "Ganztägig", "Full day": "Ganztägig", "Día completo": "Ganztägig", "Dia completo": "Ganztägig", "3 a 4 horas": "3 bis 4 Stunden", "2 horas aprox.": "ca. 2 Stunden", "35 min de vuelo aprox.": "ca. 35 Minuten Flug" },
    es: {}
  };
  return exact[locale]?.[clean] || clean;
}

function buildTourFaq(product, locale) {
  const title = product.title || product.name || "";
  const duration = localizeDuration(product.duration?.label || product.typeLabel || "", locale);
  const hasExtras = Array.isArray(product.extras) && product.extras.length > 0;
  const hasMachu = /machu/i.test(`${title} ${product.slug || ""}`);

  const templates = {
    es: [
      ["¿Cuánto dura la experiencia?", `La duración referencial es ${duration || "según el programa del tour"}. El horario final se coordina antes de la salida para que sepas con claridad el recojo, las visitas y el retorno.`],
      ["¿El tour incluye guía?", "Sí. Todos nuestros tours incluyen guía profesional en español e inglés. Otros idiomas se atienden previa consulta/coordinación y pueden tener costo adicional."],
      ["¿Qué entradas o extras debo considerar?", hasExtras ? "Las entradas, boletos turísticos, almuerzos u otros extras aparecen en la sección de extras para que puedas agregarlos o revisarlos antes de reservar." : "Si alguna entrada especial aplica para tu fecha, el equipo de reservas la revisará contigo antes del pago."],
      ["¿Dónde empieza el servicio?", "El recojo o punto de encuentro se coordina según el tour, tu hotel y la operación del día. Te enviaremos la información final por WhatsApp o correo antes de la experiencia."],
      ["¿Qué debo llevar?", "Recomendamos llevar documento de identidad o pasaporte, agua, protección solar, ropa cómoda, abrigo ligero y dinero en efectivo para gastos personales o entradas no incluidas."]
    ],
    en: [
      ["How long does the experience last?", `The reference duration is ${duration || "based on the tour program"}. The final schedule is coordinated before departure so you clearly know the pickup, visits and return time.`],
      ["Does the tour include a guide?", "Yes. All our tours include a professional guide in Spanish and English. Other languages are available upon request/coordination and may have an additional cost."],
      ["Which tickets or extras should I consider?", hasExtras ? "Entrance tickets, tourist tickets, lunches or other extras are shown in the extras section so you can add or review them before booking." : "If a special entrance ticket applies for your date, the reservations team will review it with you before payment."],
      ["Where does the service start?", "Pickup or the meeting point is coordinated according to the tour, your hotel and the operation of the day. We send the final details by WhatsApp or email before the experience."],
      ["What should I bring?", "We recommend bringing your passport or ID, water, sun protection, comfortable clothes, a light jacket and cash for personal expenses or tickets not included."]
    ],
    pt: [
      ["Quanto tempo dura a experiência?", `A duração referencial é ${duration || "conforme o programa do tour"}. O horário final é coordenado antes da saída para que você saiba com clareza a busca, as visitas e o retorno.`],
      ["O tour inclui guia?", "Sim. Todos os nossos tours incluem guia profissional em espanhol e inglês. Português está sujeito a consulta/coordenação prévia e pode ter custo adicional."],
      ["Quais ingressos ou extras devo considerar?", hasExtras ? "Ingressos, bilhetes turísticos, almoços ou outros extras aparecem na seção de extras para que você possa adicioná-los ou revisá-los antes de reservar." : "Se algum ingresso especial se aplicar à sua data, a equipe de reservas revisará isso com você antes do pagamento."],
      ["Onde começa o serviço?", "A busca ou ponto de encontro é coordenado conforme o tour, seu hotel e a operação do dia. Enviamos os detalhes finais por WhatsApp ou e-mail antes da experiência."],
      ["O que devo levar?", "Recomendamos levar passaporte ou documento de identidade, água, proteção solar, roupa confortável, agasalho leve e dinheiro em espécie para despesas pessoais ou ingressos não incluídos."]
    ],
    fr: [
      ["Combien de temps dure l'expérience ?", `La durée indicative est ${duration || "selon le programme du tour"}. L'horaire final est coordonné avant le départ afin que vous connaissiez clairement la prise en charge, les visites et le retour.`],
      ["Le tour inclut-il un guide ?", "Oui. Tous nos tours incluent un guide professionnel en espagnol et en anglais. Le français est disponible sur demande/coordination préalable et peut entraîner un coût supplémentaire."],
      ["Quels billets ou extras dois-je prévoir ?", hasExtras ? "Les billets d'entrée, billets touristiques, déjeuners ou autres extras sont affichés dans la section extras afin que vous puissiez les ajouter ou les vérifier avant de réserver." : "Si un billet spécial s'applique à votre date, l'équipe de réservation le vérifiera avec vous avant le paiement."],
      ["Où commence le service ?", "La prise en charge ou le point de rendez-vous est coordonné selon le tour, votre hôtel et l'opération du jour. Nous envoyons les détails finaux par WhatsApp ou e-mail avant l'expérience."],
      ["Que dois-je apporter ?", "Nous recommandons d'apporter passeport ou pièce d'identité, eau, protection solaire, vêtements confortables, veste légère et espèces pour les dépenses personnelles ou billets non inclus."]
    ],
    de: [
      ["Wie lange dauert das Erlebnis?", `Die Richtdauer beträgt ${duration || "je nach Tourprogramm"}. Der endgültige Zeitplan wird vor der Abfahrt koordiniert, damit Abholung, Besuche und Rückkehr klar sind.`],
      ["Ist eine Reiseleitung enthalten?", "Ja. Alle unsere Touren beinhalten eine professionelle Reiseleitung auf Spanisch und Englisch. Deutsch ist auf Anfrage/Vorabkoordination verfügbar und kann einen Aufpreis haben."],
      ["Welche Tickets oder Extras sollte ich einplanen?", hasExtras ? "Eintrittskarten, Touristentickets, Mittagessen oder andere Extras werden im Extras-Bereich angezeigt, damit Sie sie vor der Buchung hinzufügen oder prüfen können." : "Falls für Ihr Datum ein besonderes Ticket gilt, prüft das Reservierungsteam dies vor der Zahlung mit Ihnen."],
      ["Wo beginnt der Service?", "Abholung oder Treffpunkt werden je nach Tour, Hotel und Tagesbetrieb koordiniert. Die finalen Details senden wir vor dem Erlebnis per WhatsApp oder E-Mail."],
      ["Was sollte ich mitbringen?", "Wir empfehlen Reisepass oder Ausweis, Wasser, Sonnenschutz, bequeme Kleidung, eine leichte Jacke und Bargeld für persönliche Ausgaben oder nicht enthaltene Tickets."]
    ]
  };

  if (hasMachu) {
    templates.en.push(["Are Machu Picchu tickets guaranteed?", "Tickets are managed according to official availability for your travel date and selected circuit. We review the best available option before confirming the reservation."]);
    templates.es.push(["¿Las entradas a Machu Picchu están garantizadas?", "Las entradas se gestionan según disponibilidad oficial para tu fecha y circuito seleccionado. Revisamos la mejor opción disponible antes de confirmar la reserva."]);
    templates.pt.push(["Os ingressos para Machu Picchu são garantidos?", "Os ingressos são gerenciados conforme a disponibilidade oficial para sua data e circuito selecionado. Revisamos a melhor opção disponível antes de confirmar a reserva."]);
    templates.fr.push(["Les billets pour Machu Picchu sont-ils garantis ?", "Les billets sont gérés selon la disponibilité officielle pour votre date et le circuit sélectionné. Nous vérifions la meilleure option disponible avant de confirmer la réservation."]);
    templates.de.push(["Sind die Tickets für Machu Picchu garantiert?", "Die Tickets werden gemäß offizieller Verfügbarkeit für Ihr Datum und den ausgewählten Rundgang organisiert. Wir prüfen die beste verfügbare Option vor der Reservierungsbestätigung."]);
  }

  return templates[locale].map(([q, a]) => ({ q, a }));
}

function buildPackageFaq(card, locale) {
  const days = Number(card.days || 0);
  const nights = Number(card.nights || Math.max(days - 1, 0));
  const durationText = days ? `${days} ${locale === "en" ? "days" : locale === "pt" ? "dias" : locale === "fr" ? "jours" : locale === "de" ? "Tage" : "días"} / ${nights} ${locale === "en" ? "nights" : locale === "pt" ? "noites" : locale === "fr" ? "nuits" : locale === "de" ? "Nächte" : "noches"}` : "";
  const sets = {
    es: [
      ["¿Cómo se organiza este paquete?", `El paquete se arma como una ruta flexible de ${durationText || "varios días"} con experiencias principales, traslados, trenes y alojamiento según la opción elegida.`],
      ["¿Incluye guía?", "Sí. Los tours del paquete incluyen guía profesional en español e inglés. Otros idiomas se coordinan previa consulta y pueden tener costo adicional."],
      ["¿Qué incluye la base del paquete?", "Incluye traslados de llegada y salida, asistencia de viaje, transporte turístico según programa y las experiencias indicadas en el itinerario."],
      ["¿Qué no está incluido?", "No incluye vuelos nacionales o internacionales, gastos personales, propinas voluntarias, servicios no mencionados ni upgrades opcionales no seleccionados."],
      ["¿Puedo elegir hoteles y trenes?", "Sí. Puedes revisar opciones de alojamiento y tren cuando el paquete lo permite; la tarifa se ajusta según la categoría seleccionada."],
      ["¿Los extras se traducen y se calculan aparte?", "Sí. Los extras como boletos turísticos, ingresos o almuerzos aparecen traducidos y se pueden agregar antes de completar la reserva."]
    ],
    en: [
      ["How is this package organized?", `The package is built as a flexible ${durationText || "multi-day"} route with main experiences, transfers, trains and accommodation according to the selected option.`],
      ["Does it include a guide?", "Yes. Package tours include a professional guide in Spanish and English. Other languages are coordinated upon request and may have an additional cost."],
      ["What is included in the base package?", "It includes arrival and departure transfers, travel assistance, tourist transport according to the program and the experiences indicated in the itinerary."],
      ["What is not included?", "Domestic or international flights, personal expenses, voluntary tips, services not mentioned and optional upgrades not selected are not included."],
      ["Can I choose hotels and trains?", "Yes. You can review hotel and train options when the package allows it; the fare adjusts according to the selected category."],
      ["Are extras translated and calculated separately?", "Yes. Extras such as tourist tickets, entrance fees or lunches appear translated and can be added before completing the reservation."]
    ],
    pt: [
      ["Como este pacote é organizado?", `O pacote é montado como uma rota flexível de ${durationText || "vários dias"} com experiências principais, traslados, trens e hospedagem conforme a opção selecionada.`],
      ["Inclui guia?", "Sim. Os tours do pacote incluem guia profissional em espanhol e inglês. Português é coordenado mediante consulta e pode ter custo adicional."],
      ["O que está incluído na base do pacote?", "Inclui traslados de chegada e saída, assistência de viagem, transporte turístico conforme o programa e as experiências indicadas no itinerário."],
      ["O que não está incluído?", "Voos nacionais ou internacionais, despesas pessoais, gorjetas voluntárias, serviços não mencionados e upgrades opcionais não selecionados não estão incluídos."],
      ["Posso escolher hotéis e trens?", "Sim. Você pode revisar opções de hospedagem e trem quando o pacote permite; a tarifa é ajustada conforme a categoria selecionada."],
      ["Os extras estão traduzidos e são calculados separadamente?", "Sim. Extras como bilhetes turísticos, entradas ou almoços aparecem traduzidos e podem ser adicionados antes de concluir a reserva."]
    ],
    fr: [
      ["Comment ce forfait est-il organisé ?", `Le forfait est construit comme un itinéraire flexible de ${durationText || "plusieurs jours"} avec expériences principales, transferts, trains et hébergement selon l'option sélectionnée.`],
      ["Le guide est-il inclus ?", "Oui. Les tours du forfait incluent un guide professionnel en espagnol et en anglais. Le français est coordonné sur demande et peut entraîner un coût supplémentaire."],
      ["Qu'est-ce qui est inclus dans la base du forfait ?", "La base inclut les transferts d'arrivée et de départ, l'assistance voyage, le transport touristique selon le programme et les expériences indiquées dans l'itinéraire."],
      ["Qu'est-ce qui n'est pas inclus ?", "Les vols nationaux ou internationaux, dépenses personnelles, pourboires volontaires, services non mentionnés et surclassements optionnels non sélectionnés ne sont pas inclus."],
      ["Puis-je choisir les hôtels et les trains ?", "Oui. Vous pouvez vérifier les options d'hébergement et de train lorsque le forfait le permet ; le tarif s'ajuste selon la catégorie sélectionnée."],
      ["Les extras sont-ils traduits et calculés séparément ?", "Oui. Les extras tels que billets touristiques, entrées ou déjeuners apparaissent traduits et peuvent être ajoutés avant de terminer la réservation."]
    ],
    de: [
      ["Wie ist dieses Paket organisiert?", `Das Paket wird als flexible Route von ${durationText || "mehreren Tagen"} mit Haupterlebnissen, Transfers, Zügen und Unterkunft gemäß der ausgewählten Option aufgebaut.`],
      ["Ist eine Reiseleitung enthalten?", "Ja. Die Touren des Pakets beinhalten eine professionelle Reiseleitung auf Spanisch und Englisch. Deutsch wird auf Anfrage koordiniert und kann einen Aufpreis haben."],
      ["Was ist im Basispaket enthalten?", "Enthalten sind Ankunfts- und Abreisetransfers, Reisebetreuung, touristischer Transport gemäß Programm und die im Reiseverlauf angegebenen Erlebnisse."],
      ["Was ist nicht enthalten?", "Nationale oder internationale Flüge, persönliche Ausgaben, freiwillige Trinkgelder, nicht erwähnte Leistungen und nicht ausgewählte optionale Upgrades sind nicht enthalten."],
      ["Kann ich Hotels und Züge auswählen?", "Ja. Wenn das Paket es erlaubt, können Sie Unterkunfts- und Zugoptionen prüfen; der Preis passt sich der gewählten Kategorie an."],
      ["Sind Extras übersetzt und separat berechnet?", "Ja. Extras wie Touristentickets, Eintritte oder Mittagessen erscheinen übersetzt und können vor Abschluss der Reservierung hinzugefügt werden."]
    ]
  };
  return sets[locale].map(([q, a]) => ({ q, a }));
}

function normalizeArrayText(items, locale) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => normalizeTextValue(item, locale));
}

function normalizeTextValue(value, locale) {
  if (typeof value !== "string") return value;
  const exact = {
    en: {
      "Fin de servicios": "End of services",
      "Servicios privados in Cusco, Sacred Valley and Machu Picchu.": "Private services in Cusco, the Sacred Valley and Machu Picchu.",
      "Vuelos internacionales.": "International flights.",
      "Lunchs and dinners no mencionados fuera del lodge.": "Lunches and dinners not mentioned outside the lodge.",
      "Traslados privados indicados en itinerario.": "Private transfers indicated in the itinerary.",
      "Seguro de viaje.": "Travel insurance.",
      "Meals and bebidas no especificados": "Meals and drinks not specified",
      "Meals and bebidas": "Meals and drinks",
      "Tiempo en el oasis and actividad de adventure en las dunas.": "Time at the oasis and adventure activity in the dunes.",
      "Paseo and tiempo para disfrutar el entorno.": "Boat ride and time to enjoy the surroundings.",
      "Tiempo para fotos and disfrute del entorno.": "Time for photos and to enjoy the surroundings.",
      "Vuelos internos": "Domestic flights",
      "Titicaca lunch": "Titicaca lunch",
      "Mercado artesanal de Pisac": "Pisac craft market",
      "Llegada a Humantay Lake": "Arrival at Humantay Lake",
      "Llegada a la Rainbow Mountain": "Arrival at Rainbow Mountain",
      "Llegada a Palcoyo": "Arrival at Palcoyo",
      "Primer viaje corto a Peru.": "Short first trip to Peru.",
      "Cusco / San Pedro / Wanchaq / Poroy hacia Machu Picchu": "Cusco / San Pedro / Wanchaq / Poroy to Machu Picchu",
      "Ollantaytambo hacia Machu Picchu": "Ollantaytambo to Machu Picchu",
      "Machu Picchu hacia Cusco / San Pedro / Wanchaq / Poroy": "Machu Picchu to Cusco / San Pedro / Wanchaq / Poroy",
      "Machu Picchu hacia Ollantaytambo": "Machu Picchu to Ollantaytambo"
    },
    pt: {
      "Gastos personales": "Despesas pessoais",
      "Transporte turístico": "Transporte turístico",
      "Recojo en Cusco": "Busca em Cusco",
      "Boleto turístico parcial": "Bilhete turístico parcial",
      "Vuelos nacionales o internacionales": "Voos nacionais ou internacionais",
      "Servicios no mencionados expresamente": "Serviços não mencionados expressamente",
      "Propinas voluntarias": "Gorjetas voluntárias",
      "Upgrades opcionales no seleccionados": "Upgrades opcionais não selecionados",
      "Fin de servicios": "Fim dos serviços"
    },
    fr: {
      "Gastos personales": "Dépenses personnelles",
      "Transporte turístico": "Transport touristique",
      "Recojo en Cusco": "Prise en charge à Cusco",
      "Boleto turístico parcial": "Billet touristique partiel",
      "Vuelos nacionales o internacionales": "Vols nationaux ou internationaux",
      "Servicios no mencionados expresamente": "Services non expressément mentionnés",
      "Propinas voluntarias": "Pourboires volontaires",
      "Upgrades opcionales no seleccionados": "Surclassements optionnels non sélectionnés",
      "Fin de servicios": "Fin des services"
    },
    de: {
      "Gastos personales": "Persönliche Ausgaben",
      "Transporte turístico": "Touristischer Transport",
      "Recojo en Cusco": "Abholung in Cusco",
      "Boleto turístico parcial": "Teilweises Touristenticket",
      "Vuelos nacionales o internacionales": "Nationale oder internationale Flüge",
      "Servicios no mencionados expresamente": "Nicht ausdrücklich erwähnte Leistungen",
      "Propinas voluntarias": "Freiwillige Trinkgelder",
      "Upgrades opcionales no seleccionados": "Nicht ausgewählte optionale Upgrades",
      "Fin de servicios": "Ende der Leistungen"
    },
    es: {}
  };
  if (exact[locale]?.[value]) return exact[locale][value];
  return value;
}

function ensureGuide(product, locale) {
  product.duration = product.duration && typeof product.duration === "object" ? product.duration : { label: product.typeLabel || "" };
  if (!Array.isArray(product.duration.guideLanguages) || !product.duration.guideLanguages.length) {
    product.duration.guideLanguages = ["es", "en"];
  }

  if (Array.isArray(product.includes)) {
    product.includes = normalizeArrayText(product.includes, locale)
      .filter((item) => !/to be confirmed|por confirmar|por confirmar/i.test(String(item)))
      .map((item) => /gu[ií]a profesional|professional guide|guia profissional|guide professionnel|reiseleitung/i.test(String(item)) ? guidePhrase[locale] : item);
    if (!product.includes.some((item) => /gu[ií]a|guide|guia|reiseleitung/i.test(String(item)))) {
      product.includes.push(guidePhrase[locale]);
    }
  }

  if (Array.isArray(product.excludes)) {
    product.excludes = normalizeArrayText(product.excludes, locale);
  }
}

function updateExtras(product, locale) {
  const maps = extraLabels[locale] || extraLabels.en;
  ["extras", "ticketPricingByNationality"].forEach((key) => {
    if (!Array.isArray(product[key])) return;
    product[key].forEach((extra) => {
      if (extra && maps[extra.code]) extra.label = maps[extra.code];
      if (typeof extra.availabilityNote === "string") {
        extra.availabilityNote = normalizeTextValue(extra.availabilityNote, locale)
          .replace(/^Aplicar para ruta/i, locale === "en" ? "Applies to route" : locale === "pt" ? "Aplica-se à rota" : locale === "fr" ? "S'applique à l'itinéraire" : locale === "de" ? "Gilt für die Route" : "Aplicar para ruta");
      }
    });
  });
}

function updateSouthValley(product, locale) {
  if ((product.internalCode || product.code || "") !== "CUZ005") return;
  const copy = southValley[locale];
  const previousImages = Array.isArray(product.itinerary) ? product.itinerary.map((item) => item.images).filter(Boolean) : [];
  product.title = copy.title;
  product.shortDescription = copy.shortDescription;
  product.description = copy.description;
  product.duration = { ...(product.duration || {}), label: copy.duration, guideLanguages: ["es", "en"] };
  product.includes = copy.includes;
  product.excludes = copy.excludes;
  product.itinerary = copy.itinerary.map(([title, description], index) => ({
    title,
    description,
    images: previousImages[index] || []
  }));
}

function updateCuscoSummaries(product, locale) {
  const code = product.internalCode || product.code || "";
  const values = cuscoSummaries[locale]?.[code];
  if (!values) return;
  product.title = values[0];
  product.shortDescription = values[1];
  product.description = values[2];
  if (product.seo && typeof product.seo === "object") {
    product.seo.title = `${values[0]} | My Cusco Trip`;
    product.seo.description = values[1];
  }
}

function updatePackageConfig(data, locale) {
  if (!data || typeof data !== "object") return;
  data.defaultGuideLanguages = ["es", "en"];
  if (data.defaultLogisticsServices) {
    data.defaultLogisticsServices.arrival = {
      ...(data.defaultLogisticsServices.arrival || {}),
      title: logisticsText[locale].arrivalTitle,
      description: logisticsText[locale].arrivalDescription
    };
    data.defaultLogisticsServices.departure = {
      ...(data.defaultLogisticsServices.departure || {}),
      title: logisticsText[locale].departureTitle,
      description: logisticsText[locale].departureDescription
    };
  }
  if (data.detailPageBehavior?.optionUi) {
    data.detailPageBehavior.optionUi.title = ui[locale]["product.packageOptionsIntro"];
    data.detailPageBehavior.optionUi.showMoreLabel = ui[locale]["product.showMoreOptions"];
    data.detailPageBehavior.optionUi.labels = [
      ui[locale]["product.routeRecommended"],
      ui[locale]["product.routeClassic"],
      ui[locale]["product.routeAdventure"],
      ui[locale]["product.routeNature"]
    ];
  }
  if (Array.isArray(data.packageCards)) {
    data.packageCards.forEach((card) => {
      card.duration = { ...(card.duration || {}), label: card.typeLabel || card.duration?.label || "", guideLanguages: ["es", "en"] };
      card.faq = buildPackageFaq(card, locale);
    });
  }
}

function shouldSkipStringKey(key) {
  return /^(slug|code|id|internalCode|image|images|url|href|currency|pricingModel|circuit|sourceFile|targetFile|frequency)$/i.test(key);
}

function normalizeAllStrings(value, locale, key = "") {
  if (typeof value === "string") return shouldSkipStringKey(key) ? value : normalizeTextValue(value, locale);
  if (Array.isArray(value)) return value.map((item) => normalizeAllStrings(item, locale, key));
  if (value && typeof value === "object") {
    Object.keys(value).forEach((childKey) => {
      value[childKey] = normalizeAllStrings(value[childKey], locale, childKey);
    });
  }
  return value;
}

function updateUiTranslations() {
  const baseFile = path.join(root, "assets", "data", "ui-translations.json");
  const base = readJson(baseFile);
  locales.forEach((locale) => {
    base[locale] = { ...(base[locale] || {}), ...ui[locale] };
  });
  writeJson(baseFile, base);

  ["en", "pt", "fr", "de"].forEach((locale) => {
    const file = path.join(root, "assets", "data", "i18n", locale, "ui-translations.json");
    const current = fs.existsSync(file) ? readJson(file) : {};
    writeJson(file, { ...current, ...ui[locale] });
  });
}

function updateContent() {
  locales.forEach((locale) => {
    jsonFiles.forEach((filename) => {
      const file = dataPath(locale, filename);
      if (!fs.existsSync(file)) return;
      const data = readJson(file);

      if (filename === "packages-cusco.json" || filename === "packages-peru.json") {
        updatePackageConfig(data, locale);
      }

      productsFrom(data).forEach((product) => {
        ensureGuide(product, locale);
        updateExtras(product, locale);
        if (filename === "tours-cusco.json") updateCuscoSummaries(product, locale);
        updateSouthValley(product, locale);
        if (filename.includes("tours") || filename.includes("trekkings")) {
          product.faq = buildTourFaq(product, locale);
        }
        if (product.duration?.label) product.duration.label = localizeDuration(product.duration.label, locale);
        if (Array.isArray(product.includes)) product.includes = normalizeArrayText(product.includes, locale);
        if (Array.isArray(product.excludes)) product.excludes = normalizeArrayText(product.excludes, locale);
      });

      normalizeAllStrings(data, locale);

      writeJson(file, data);
    });
  });
}

updateUiTranslations();
updateContent();

console.log("Multilingual content polished for es, en, pt, fr and de.");
