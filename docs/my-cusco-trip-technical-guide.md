# My Cusco Trip - Guia tecnica del proyecto

Esta guia resume la arquitectura, archivos, flujos, reglas de negocio y criterios UX/UI desarrollados para el proyecto web **My Cusco Trip**. Sirve como documentacion tecnica interna y tambien como prompt base para continuar el desarrollo en otro chat o proyecto.

---

## 1. Contexto general

**My Cusco Trip** es una web turistica estatica orientada a vender, reservar y cotizar experiencias, tours y paquetes turisticos en Cusco, Machu Picchu y Peru.

El proyecto esta construido con:

- HTML
- CSS
- JavaScript vanilla
- Archivos JSON como fuente de datos
- Sin backend obligatorio por ahora

Los datos principales se cargan mediante `fetch()` desde la carpeta:

```text
assets/data/
```

El proyecto tiene dos flujos principales:

1. **Pagina de producto / reserva**
2. **Pagina de cotizacion de paquetes**

---

## 2. Estructura recomendada de archivos

```text
/
├── product.html
├── quote-packages.html
├── docs/
│   └── my-cusco-trip-technical-guide.md
├── assets/
│   ├── css/
│   │   ├── main.css
│   │   ├── components.css
│   │   ├── header.css
│   │   ├── footer.css
│   │   ├── responsive.css
│   │   ├── product-page.css
│   │   └── quote-packages.css
│   ├── js/
│   │   ├── main.js
│   │   └── pages/
│   │       ├── product.js
│   │       └── quote-packages.js
│   ├── data/
│   │   ├── tours.json
│   │   ├── hotels.json
│   │   ├── packages-peru.json
│   │   ├── trains.json
│   │   └── discount-codes.json
│   └── img/
│       ├── tours/
│       ├── reserva/
│       ├── logos/
│       └── hotels/
```

---

## 3. Separacion de datos

La separacion recomendada de archivos JSON es:

```text
tours.json = catalogo principal de tours, experiencias y paquetes generales
hotels.json = catalogo reutilizable de hoteles por destino
packages-peru.json = paquetes para cotizacion, especialmente mercado peruano
trains.json = trenes por ruta, nacionalidad, categoria y precio
discount-codes.json = codigos promocionales opcionales
```

No se recomienda mezclar los paquetes peruanos de cotizacion dentro de `tours.json`, porque el flujo comercial es diferente. Los paquetes peruanos necesitan cotizar tren, hotel, moneda, nacionalidad, extras y modalidad de pago por separado.

---

## 4. Flujo 1: product.html / product.js

### Proposito

`product.html` es la pagina de detalle y reserva de un tour, experiencia o paquete.

Usa principalmente:

```text
product.html
assets/js/pages/product.js
assets/css/product-page.css
assets/data/tours.json
assets/data/hotels.json
```

### Funciones principales

Debe permitir:

- Ver informacion del tour o paquete
- Ver galeria o portada del producto
- Seleccionar fecha
- Seleccionar adultos y ninos
- Seleccionar extras
- Elegir hotel si el producto es paquete
- Aplicar codigo de descuento
- Elegir forma de pago
- Ver resumen de precio
- Continuar con reserva o pago

---

## 5. Logica de alojamiento en product.js

Para productos tipo paquete, el alojamiento debe funcionar asi:

1. Detectar si el producto es paquete.
2. Leer `accommodationSummary` del producto.
3. Renderizar una tarjeta por destino.
4. Cada tarjeta debe mostrar:
   - destino
   - numero de noches
   - hotel seleccionado
   - acomodacion seleccionada
   - adicional por persona
   - boton `Elegir hotel` o `Cambiar hotel`
5. Al abrir el modal de hoteles:
   - mostrar opcion `Sin hotel`
   - mostrar hoteles reales desde `hotels.json`
   - mostrar imagenes del hotel
   - mostrar combinaciones de habitaciones
6. El modal no debe cerrarse al seleccionar una acomodacion.
7. El usuario debe confirmar con el boton `Seleccionar hotel y acomodacion`.
8. Al confirmar:
   - guardar hotel seleccionado
   - guardar combinacion seleccionada
   - recalcular precio
   - cerrar modal

### Regla importante

Siempre debe existir una opcion:

```text
Sin hotel
```

Esta opcion debe tener costo `0` y permite vender paquetes sin alojamiento incluido.

---

## 6. Limpieza del panel de reserva en product.html

El bloque de alojamiento debe quedar simple:

```html
<div id="packageAccommodationSection" class="booking-field" hidden>
  <div id="hotelSelectorsContainer" class="booking-dynamic-stack"></div>
</div>
```

Se deben eliminar o evitar estos bloques si aparecen:

```text
- accommodationSummary
- roomTypeSection
- selectedHotelGallerySection
- bookingPreviewButton
```

Tambien se eliminaron textos o secciones redundantes como:

```text
- Seleccion de alojamiento
- Cusco 5 noches
- Aguas Calientes 1 noche
- Habitaciones seleccionadas
- Hotel seleccionado
- Ver resumen
```

La forma de pago debe ir debajo del codigo de descuento.

Resultado esperado:

- Solo se ven tarjetas de hotel por destino.
- El boton dice `Elegir hotel` si aun no hay seleccion.
- El boton dice `Cambiar hotel` si ya existe seleccion.
- La opcion `Sin hotel` esta disponible.
- No hay resumen duplicado de hotel.
- No hay fotos extra dentro del panel lateral.

---

## 7. Estilos clave en product-page.css

Agregar al final de `assets/css/product-page.css` estilos para:

- sombra de boton secundario
- estado seleccionado de acomodacion
- bloque visual de `Sin hotel`
- boton de confirmacion del modal
- ajustes responsive

Ejemplo:

```css
.booking-secondary-btn {
  box-shadow: 0 10px 22px rgba(10, 58, 38, 0.12);
}

.booking-secondary-btn:hover {
  box-shadow: 0 14px 28px rgba(10, 58, 38, 0.18);
}

.hotel-gallery-main--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f3faf4 0%, #eef7f1 100%);
  min-height: 220px;
}

.hotel-gallery-empty-state {
  display: grid;
  gap: 6px;
  text-align: center;
  color: #0a3a26;
  padding: 20px;
}

.hotel-gallery-empty-state strong {
  font-size: 1.15rem;
  font-weight: 800;
}

.hotel-gallery-empty-state span {
  color: #56645f;
  font-size: 0.94rem;
}

.hotel-combo-btn.is-selected {
  border-color: #0a3a26;
  background: #f4fbf5;
  box-shadow: 0 10px 20px rgba(10, 58, 38, 0.12);
}
```

---

## 8. Flujo 2: quote-packages.html / quote-packages.js

### Proposito

`quote-packages.html` es una pagina independiente para cotizar paquetes turisticos.

Usa principalmente:

```text
quote-packages.html
assets/js/pages/quote-packages.js
assets/css/quote-packages.css
assets/data/packages-peru.json
assets/data/trains.json
assets/data/hotels.json
assets/data/discount-codes.json
```

Esta pagina esta pensada para cotizaciones de paquetes peruanos o paquetes personalizados.

---

## 9. Campos principales del cotizador

La pagina debe permitir:

- Seleccionar fechas de viaje
- Calcular dias y noches
- Seleccionar nacionalidad
- Seleccionar moneda
- Seleccionar adultos
- Seleccionar ninos
- Elegir paquete compatible
- Ver itinerario
- Elegir hoteles
- Elegir tren de ida
- Elegir tren de retorno
- Agregar extras
- Aplicar codigo de descuento
- Elegir forma de pago
- Completar datos del cliente
- Imprimir cotizacion
- Continuar o solicitar cotizacion

---

## 10. Clase principal de quote-packages.js

La clase principal recomendada es:

```js
class MyCuscoTripQuotePackages
```

Debe inicializar:

- paquetes
- trenes
- hoteles
- codigos de descuento
- adultos
- ninos
- nacionalidad
- moneda
- forma de pago
- fechas
- hoteles seleccionados
- trenes seleccionados
- extras seleccionados
- codigo aplicado
- referencia de cotizacion
- contenido imprimible

Carga recomendada de datos:

```js
const [packagesData, trainsData, hotelsData, discountCodes] = await Promise.all([
  this.fetchJson("assets/data/packages-peru.json"),
  this.fetchJson("assets/data/trains.json"),
  this.fetchJson("assets/data/hotels.json"),
  this.fetchOptionalJson("assets/data/discount-codes.json")
]);
```

Tambien se puede intentar cargar tipo de cambio online y usar un fallback si falla.

---

## 11. Flujo del cotizador

El flujo funcional debe ser:

1. Usuario selecciona fechas.
2. Sistema calcula dias y noches.
3. Sistema muestra paquetes compatibles con esa duracion.
4. Usuario selecciona paquete.
5. Sistema muestra:
   - itinerario
   - servicios incluidos
   - hoteles por destino
   - tren de ida
   - tren de retorno
   - extras
6. Usuario selecciona nacionalidad.
7. Nacionalidad controla:
   - monedas permitidas
   - disponibilidad de tren local
   - mensajes informativos
8. Usuario selecciona moneda.
9. Sistema convierte precios si es necesario.
10. Usuario aplica codigo de descuento si tiene.
11. Usuario elige pago completo o parcial.
12. Sistema calcula:
   - paquete base
   - precio de ninos
   - hoteles
   - trenes
   - extras
   - descuentos
   - total
   - anticipo
   - saldo
13. Sistema actualiza el resumen y version imprimible.

---

## 12. Reglas de nacionalidad y moneda

Nacionalidades recomendadas:

```text
national = peruanos
foreign = extranjeros
andean_community = Comunidad Andina
```

Reglas:

```text
Peruanos:
- pueden cotizar en PEN o USD
- pueden ver opcion de tren local
- deben ver mensaje de disponibilidad del tren local

Extranjeros:
- solo cotizan en USD
- no pueden ver tren local

Comunidad Andina:
- normalmente cotiza en USD
- no necesariamente ve tren local, salvo configuracion especial
```

Funcion responsable sugerida:

```js
applyCurrencyRulesByNationality()
```

---

## 13. Estructura recomendada de packages-peru.json

```json
{
  "packages": [
    {
      "id": "pkg_pe_004",
      "slug": "paquete-cusco-machu-picchu-4d-3n-peruanos",
      "title": "Paquete Cusco y Machu Picchu 4D/3N",
      "market": "peru",
      "currency": "PEN",
      "days": 4,
      "nights": 3,
      "status": "published",
      "basePricing": {
        "adult": 690,
        "child": 650
      },
      "priceIncludesTrain": false,
      "accommodationSummary": [
        {
          "destination": "cusco",
          "nights": 2,
          "label": "Cusco - 2 noches"
        },
        {
          "destination": "aguas-calientes",
          "nights": 1,
          "label": "Aguas Calientes - 1 noche"
        }
      ],
      "trainSelection": {
        "required": true,
        "outboundRoute": "ollantaytambo-aguas-calientes",
        "returnRoute": "aguas-calientes-ollantaytambo"
      },
      "includes": [
        "Traslados aeropuerto / hotel / estacion",
        "City Tour Cusco",
        "Valle Sagrado",
        "Machu Picchu",
        "Bus Consettur ida y vuelta",
        "Ingreso Machu Picchu",
        "Guia profesional"
      ],
      "excludes": [
        "Tren turistico o local",
        "Hotel si el cliente elige sin alojamiento",
        "Vuelos",
        "Alimentacion no mencionada"
      ]
    }
  ],
  "paymentOptions": {
    "fullPaymentDiscountPercent": 5,
    "partialPaymentPercent": 40
  },
  "currencyRules": {
    "national": {
      "allowedCurrencies": ["PEN", "USD"],
      "defaultCurrency": "PEN"
    },
    "foreign": {
      "allowedCurrencies": ["USD"],
      "defaultCurrency": "USD"
    },
    "andean_community": {
      "allowedCurrencies": ["USD"],
      "defaultCurrency": "USD"
    }
  }
}
```

---

## 14. Estructura recomendada de trains.json

```json
{
  "exchangeRate": {
    "fallbackRate": 3.75
  },
  "trainCategories": {
    "local": {
      "label": "Tren Local",
      "importantMessage": "Disponible solo para peruanos y sujeto a compra presencial."
    },
    "expedition": {
      "label": "Expedition"
    },
    "vistadome": {
      "label": "Vistadome"
    }
  },
  "routes": {
    "ollantaytambo-aguas-calientes": {
      "label": "Ollantaytambo - Aguas Calientes",
      "options": [
        {
          "code": "local-train-outbound",
          "company": "PeruRail",
          "serviceName": "Tren Local",
          "categoryCode": "local",
          "currency": "PEN",
          "pricePerPerson": 12,
          "isLocalTrain": true,
          "allowedNationalities": ["national"]
        },
        {
          "code": "perurail-expedition-outbound",
          "company": "PeruRail",
          "serviceName": "Expedition",
          "categoryCode": "expedition",
          "currency": "USD",
          "pricePerPerson": 70,
          "allowedNationalities": ["national", "foreign", "andean_community"]
        }
      ]
    }
  }
}
```

---

## 15. Estructura recomendada de hotels.json

```json
{
  "destinations": {
    "cusco": {
      "label": "Cusco",
      "hotels": [
        {
          "hotelCode": "casa-andina-cusco",
          "hotelName": "Casa Andina Cusco",
          "stars": 3,
          "location": "Centro Historico",
          "address": "Cusco, Peru",
          "summary": "Hotel centrico recomendado para paquetes turisticos.",
          "images": {
            "cover": "assets/img/hotels/casa-andina/cover.jpg",
            "gallery": [
              "assets/img/hotels/casa-andina/1.jpg",
              "assets/img/hotels/casa-andina/2.jpg"
            ]
          },
          "rooms": [
            {
              "roomType": "double",
              "label": "Habitacion doble",
              "bedType": "1 cama matrimonial o 2 camas",
              "capacity": 2,
              "pricePerNight": 45
            },
            {
              "roomType": "triple",
              "label": "Habitacion triple",
              "bedType": "3 camas",
              "capacity": 3,
              "pricePerNight": 65
            }
          ]
        }
      ]
    }
  }
}
```

---

## 16. Formula de calculo

```text
Subtotal =
  paquete base adultos
+ paquete base ninos
+ hoteles
+ tren ida
+ tren retorno
+ extras

Descuentos =
  descuento por pago completo
+ descuento manual por codigo

Total =
  subtotal - descuentos

Si pago parcial:
  anticipo = total * porcentaje de anticipo
  saldo = total - anticipo

Si pago completo:
  pagar ahora = total
  saldo = 0
```

Reglas:

- Pago completo puede aplicar descuento automatico.
- Pago parcial no aplica descuento por pago completo.
- Codigo manual puede ser `percent` o `fixed`.
- Codigo `fixed` debe convertirse a la moneda activa.
- Extras pueden ser por persona o por reserva.
- Hoteles se calculan por estadia.
- Trenes se calculan por persona.

---

## 17. discount-codes.json

Ejemplo:

```json
[
  {
    "code": "CUSCO10",
    "active": true,
    "type": "percent",
    "value": 10,
    "label": "Descuento especial Cusco"
  },
  {
    "code": "MCT50",
    "active": true,
    "type": "fixed",
    "value": 50,
    "currency": "USD",
    "label": "Descuento fijo promocional"
  }
]
```

La validacion debe revisar:

- que el codigo exista
- que este activo
- que tenga tipo valido
- que tenga valor mayor a 0

Funcion sugerida:

```js
applyManualDiscountCode()
```

---

## 18. Version imprimible de cotizacion

Debe mostrar:

- logo de My Cusco Trip
- referencia de cotizacion
- datos del cliente
- fechas de viaje
- pasajeros
- paquete seleccionado
- itinerario
- hoteles seleccionados
- trenes seleccionados
- extras
- descuentos
- total
- anticipo y saldo si aplica
- notas del cliente

Logo recomendado:

```html
<img
  class="print-logo"
  src="assets/img/reserva/logo-color.png"
  alt="My Cusco Trip"
/>
```

---

## 19. Reglas UX/UI

Mantener estas reglas:

- Diseno limpio, moderno y turistico.
- Verde oscuro como color principal.
- Tarjetas con sombra suave.
- Estados seleccionados visibles.
- Botones grandes en movil.
- Modales responsive.
- Empty states claros.
- No duplicar informacion.
- Resumen de precio claro.
- El usuario no debe perder selecciones al cambiar datos.
- Siempre debe existir opcion `Sin hotel`.
- El tren local debe tener mensaje de disponibilidad.

---

## 20. Prompt maestro para continuar el proyecto

```text
Estoy trabajando en el proyecto web “My Cusco Trip”, una web turistica estatica hecha con HTML, CSS, JavaScript vanilla y archivos JSON. No usamos backend por ahora. Los datos se cargan con fetch() desde assets/data.

Necesito que actues como desarrollador frontend senior especializado en turismo, reservas, cotizadores, UX/UI responsive y JavaScript vanilla.

Arquitectura actual:

- product.html
- quote-packages.html
- assets/css/main.css
- assets/css/components.css
- assets/css/header.css
- assets/css/footer.css
- assets/css/responsive.css
- assets/css/product-page.css
- assets/css/quote-packages.css
- assets/js/pages/product.js
- assets/js/pages/quote-packages.js
- assets/data/tours.json
- assets/data/hotels.json
- assets/data/packages-peru.json
- assets/data/trains.json
- assets/data/discount-codes.json

Hay dos flujos principales:

1. product.html / product.js
Es la pagina de producto y reserva. Usa tours.json y hotels.json. Sirve para tours, experiencias y paquetes generales. Permite seleccionar fecha, adultos, ninos, extras, hotel si el producto es paquete, codigo de descuento, forma de pago y resumen final. En paquetes, el alojamiento se muestra como tarjetas por destino. El modal de hotel permite elegir hotel y acomodacion. Siempre debe existir opcion “Sin hotel” con costo 0. El modal no debe cerrar al tocar una acomodacion; solo debe cerrar al confirmar. El boton debe decir “Elegir hotel” si no hay seleccion y “Cambiar hotel” si ya existe seleccion. Se eliminaron bloques redundantes como “Habitaciones seleccionadas”, “Hotel seleccionado”, fotos extra dentro del panel y boton “Ver resumen”. La forma de pago debe aparecer debajo del codigo de descuento.

2. quote-packages.html / quote-packages.js
Es un cotizador independiente de paquetes. Usa packages-peru.json, trains.json, hotels.json y opcionalmente discount-codes.json. Sirve para paquetes peruanos o cotizaciones personalizadas. El usuario selecciona fechas; el sistema calcula dias/noches y muestra paquetes compatibles. Luego se seleccionan itinerario, hoteles, tren de ida, tren de retorno, extras, nacionalidad, moneda, codigo de descuento y forma de pago. Nacionalidades: national = peruanos, foreign = extranjeros, andean_community = Comunidad Andina. El tren local solo debe mostrarse para peruanos y debe indicar que esta sujeto a disponibilidad presencial. El cotizador intenta cargar tipo de cambio online y usa fallback 3.75 si falla. Debe tener version imprimible con logo, referencia, datos del cliente, paquete, hoteles, trenes, extras, descuentos, total, anticipo y saldo.

Reglas de datos:

tours.json = catalogo principal de tours y paquetes generales.
packages-peru.json = paquetes de cotizacion con precios base sin tren ni alojamiento.
hotels.json = hoteles organizados por destino.
trains.json = trenes organizados por rutas.
discount-codes.json = codigos promocionales opcionales.

Reglas de calculo:

Subtotal = paquete base adultos + paquete base ninos + hoteles + tren ida + tren retorno + extras.
Descuentos = descuento por pago completo + descuento manual por codigo.
Total = subtotal - descuentos.
Si pago parcial: anticipo = total * porcentaje de anticipo y saldo = total - anticipo.
Si pago completo: se puede aplicar descuento automatico.

Reglas UX:

- Diseno limpio, moderno y turistico.
- Verde oscuro como color principal.
- Tarjetas seleccionadas con borde, sombra y estado visual claro.
- Modales responsive.
- Botones grandes en movil.
- Empty states claros cuando no hay datos.
- Nunca duplicar informacion en el panel.
- Mantener el resumen de precio claro y ordenado.
- Evitar romper el flujo existente.

Cuando te pida cambios, dame instrucciones exactas por archivo:
1. que buscar
2. que reemplazar
3. que agregar
4. en que archivo
5. resultado esperado

Si me das codigo, entregalo completo por funcion o por bloque, no fragmentos sueltos dificiles de ubicar.
```

---

## 21. Donde colocar este archivo

Crear una carpeta llamada:

```text
docs/
```

Dentro colocar este archivo con el nombre:

```text
my-cusco-trip-technical-guide.md
```

Ruta final:

```text
docs/my-cusco-trip-technical-guide.md
```

Este archivo no afecta el funcionamiento de la web. Es solo documentacion tecnica del proyecto.

