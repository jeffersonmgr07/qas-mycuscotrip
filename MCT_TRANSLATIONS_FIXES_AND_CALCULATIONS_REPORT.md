# Informe de traducciones, estructura multidioma y correcciones · My Cusco Trip

## Cambios aplicados

1. Se creó `assets/data/static-text-translations.json` con una capa de frases estáticas para español, inglés, portugués, francés, alemán, italiano, japonés y chino simplificado. La versión final contiene 679 frases en inglés, 641 en portugués, 640 en francés, 638 en alemán, 634 en italiano, 648 en japonés y 648 en chino simplificado.
2. Se reemplazó `assets/js/i18n.js` y `js/i18n.js` por una versión compatible con:
   - traducciones por `data-i18n`, `data-i18n-html`, `data-i18n-placeholder`, `data-i18n-label` y `data-i18n-title`;
   - traducción automática de textos estáticos residuales en HTML;
   - traducción de `placeholder`, `aria-label`, `title`, `alt` y valores de botones;
   - observador de DOM para textos insertados dinámicamente por JavaScript;
   - patrones dinámicos frecuentes del cotizador, como `Adultos x2`, `Niños x0`, `Día 1`, duración detectada y tipo de cambio.
3. Se regeneraron las páginas localizadas principales desde la estructura española para que mantengan el mismo HTML, estilos y scripts:
   - `index.html`
   - `all-experiences.html`
   - `cusco-tours.html`
   - `machu-picchu-tours.html`
   - `paquetes-cusco.html`
   - `trekkings.html`
   - `explora-peru.html`
   - `product.html`
   - `quote-packages.html`
   - `private-package.html`
   - `mi-reserva.html`
   - `detalle-reserva.html`
   - `registro-pasajeros.html`
   - `verificar-reserva.html`
   - `cotizador-vuelos.html`
4. Además de la traducción por runtime, se aplicó traducción estática en el HTML fuente de las páginas localizadas principales, incluyendo textos visibles, metadatos SEO y JSON-LD cuando correspondía.
5. Se corrigió especialmente `quote-packages.html` en todos los idiomas: antes las versiones localizadas no usaban la estructura del cotizador español actual; ahora sí cargan `quote-packages.css`, los modales, la versión imprimible y `quote-packages.js`.
6. Se ajustó `assets/js/pages/quote-packages.js` y `js/pages/quote-packages.js` para cargar datos multidioma desde `assets/data/i18n/{lang}/...` cuando la página está en `/en/`, `/pt/`, `/fr/`, `/de/`, `/it/`, `/ja/` o `/zh/`.
7. Se añadió soporte de locale a formatos de fecha y moneda del cotizador.
8. Se agregó `agencias.html` como redirección segura a `/agencias/`.
9. Se añadieron archivos de ayuda de redirección para despliegues estáticos: `_redirects`, `netlify.toml`, `vercel.json` y `.htaccess`.
10. Se incorporó `../assets/js/i18n.js` en las páginas del módulo `/agencias/` y se amplió `agencias-i18n.js` para reconocer todos los idiomas del selector.
11. Las páginas localizadas `/{lang}/agencias.html` ahora redirigen al portal real `/agencias/?lang={lang}` para evitar tener una vitrina vieja o una estructura distinta del portal funcional.

## Validación técnica realizada

- `node --check` aprobado para `assets/js/i18n.js`, `js/i18n.js`, `assets/js/pages/quote-packages.js`, `js/pages/quote-packages.js` y `agencias/assets/js/pages/agencias-i18n.js`.
- JSON válido para `assets/data/static-text-translations.json` y `vercel.json`.
- Verificado que `/{lang}/quote-packages.html` carga `../assets/css/quote-packages.css`, `../assets/js/pages/quote-packages.js` y define `window.MCT_LOCALE`.
- Verificado que las páginas localizadas principales mantienen la estructura base española y usan rutas relativas `../assets/...`.

## Corrección de /agencias

En el ZIP original sí existe `agencias/index.html`, por lo tanto la ruta correcta debería resolver al portal. El problema de ver una imagen grande suele aparecer cuando el hosting no resuelve la ruta limpia `/agencias` hacia `/agencias/`, cuando hay caché antigua o cuando el servidor intenta resolver un recurso estático en vez del índice de carpeta.

La corrección aplicada no toca la lógica de pagos ni el portal. Solo agrega rutas de redirección y una página fallback `agencias.html` que envía al usuario a `/agencias/` conservando query/hash.

## Cálculo técnico del cotizador `quote-packages.html`

### 1. Duración

`calculateDurationFromDates()` toma la fecha inicial y final, calcula la diferencia en días y define:

```txt
days = diferencia + 1
nights = diferencia
```

Ejemplo: del 10 al 13 de junio = 4 días / 3 noches.

### 2. Generación de opciones

`generateAndRenderOptions()` envía a `MyCuscoTripPackageGenerator.generatePackageOptions()` estos parámetros:

```js
{
  days,
  nights,
  arrivalTime,
  departureTime,
  productFamily: "cusco-package"
}
```

El generador arma itinerarios compatibles usando `packages-cusco.json`, `tours-cusco.json`, `tours-machu-picchu.json` y `trekkings-cusco.json`.

### 3. Precio base

El precio base se calcula sumando los tours incluidos en la opción seleccionada:

```txt
baseAdultUSD = suma de getTourBasePriceUSD(tour, "adult")
baseChildUSD = suma de getTourBasePriceUSD(tour, "child")
```

Luego:

```txt
adultTotal = baseAdultUSD × adultos
childTotal = baseChildUSD × niños
baseTotal = adultTotal + childTotal
```

Si un tour de Machu Picchu o similar trae tren incluido en su precio público, el cotizador descuenta el tren base mediante `defaultTrainCostUSD` o `defaultTrainSelection.pricingSnapshot.totalAdultTrainCost`, porque el tren se elige aparte dentro del cotizador.

### 4. Hoteles

`getAccommodationPlan()` reparte noches entre Cusco y Aguas Calientes. Si el paquete requiere overnight o conexión a Machu Picchu, asigna normalmente 1 noche a Aguas Calientes y el resto a Cusco.

Cada hotel lee habitaciones desde `hotels.json`. El sistema crea combinaciones compatibles con el número de pasajeros:

```txt
precioHotelUSD = suma(precioPorNocheHabitaciones) × nochesDestino
```

La opción `Sin hotel / solo tours` siempre cuesta 0.

### 5. Trenes

`getTrainOptions(direction)` filtra trenes por:

- dirección: ida o retorno;
- nacionalidad;
- ruta permitida;
- empresa permitida;
- ventana horaria;
- regla de misma empresa en retorno si ida fue PeruRail o Inca Rail;
- tren local solo para nacionales peruanos.

El total de tren se calcula por persona:

```txt
trenTotal = precioAdulto × adultos + precioNiño × niños
```

Luego se convierte a la moneda activa.

### 6. Extras

Los extras salen de los tours incluidos en la opción seleccionada. No se suman automáticamente; solo si el usuario los marca.

```txt
extraTotal = precioExtra × pasajeros
```

Si `extra.perPerson === false`, se cobra una sola vez por reserva.

### 7. Subtotal

```txt
subtotal = baseTotal + hotelTotal + trainTotal + extrasTotal
```

### 8. Descuentos

`applyManualDiscountCode()` valida que el código exista, esté activo y tenga tipo `percent` o `fixed`.

```txt
descuentoPercent = subtotal × porcentaje
descuentoFixed = monto fijo convertido a moneda activa
```

Además, si el pago es completo y no hay cupón manual aplicado, se aplica descuento automático de 5%:

```txt
fullDiscount = subtotal × 0.05
```

### 9. Total, anticipo y saldo

```txt
discount = manualDiscount + fullDiscount
total = subtotal - discount
```

En pago completo:

```txt
advance = total
balance = 0
```

En pago parcial, la versión actual del JS usa un anticipo fijo referencial de USD 49.90 por pasajero, convertido a la moneda activa, limitado para no superar el total:

```txt
advance = min(total, convert(49.90 × pasajeros, USD, monedaActiva))
balance = total - advance
```

Nota técnica: la guía recomendaba un porcentaje parcial configurable, pero el JS actual usa anticipo fijo por pasajero. Si deseas alinear el JS con la guía, conviene mover ese valor a `payment-config.json` o `packages-cusco.json`.

## Cálculo técnico de vitrinas y otras páginas

### `index.html` / cards destacadas

Las cards del home se cargan desde `assets/js/components/products.js`. Este componente lee catálogos JSON, normaliza los productos y muestra precio desde los campos públicos del producto, normalmente `priceFrom`, `basePricing`, `currency` o campos normalizados por el catálogo. No recalcula hoteles ni trenes; solo presenta precio inicial o “desde”.

### `all-experiences.html`

La vitrina general usa `assets/js/pages/all-experiences.js` con `assets/js/core/data-loader.js` y `catalog-normalizer.js`. Carga catálogos de tours, trekkings, paquetes y experiencias. El cálculo visible es de exhibición: filtra, ordena y muestra precio base. No ejecuta el cálculo completo de reserva hasta entrar a `product.html`.

### Landing pages: `cusco-tours.html`, `machu-picchu-tours.html`, `paquetes-cusco.html`, `trekkings.html`, `explora-peru.html`

Estas páginas usan `assets/js/pages/catalog-landing.js`. El cálculo es de vitrina:

```txt
precio visible = precio público normalizado del producto
```

No se suman hoteles, trenes ni extras en estas vitrinas. Esas variables se calculan después en `product.html` o `quote-packages.html`.

### `product.html`

`product.html` usa `assets/js/pages/product.js`, `pricing-engine.js`, `currency-service.js`, `hotel-service.js` y datos del producto. El flujo calcula:

```txt
base = precio adulto × adultos + precio niño × niños
extras = extras seleccionados
hotel = adicional de alojamiento seleccionado si aplica
descuento = código aplicado o regla comercial
total = base + extras + hotel - descuento
```

En paquetes, los hoteles se muestran por destino y siempre existe `Sin hotel` con costo 0. El modal no guarda el hotel hasta confirmar la selección.

## Mejoras recomendadas para la siguiente fase

1. Centralizar todos los textos dinámicos de `quote-packages.js`, `product.js` y agencias en claves i18n, en vez de depender solo de traducción por frase exacta.
2. Mover reglas de pago parcial y descuento completo a `payment-config.json` para que no queden hardcodeadas en JS.
3. Crear una validación automática que detecte textos españoles residuales en `/en`, `/pt`, `/fr`, `/de`, `/it`, `/ja` y `/zh` antes de publicar.
4. Optimizar imágenes a WebP/AVIF y agregar `srcset` para mejorar Core Web Vitals.
5. Unificar los catálogos duplicados `assets/data/agencias-tours.json` y `agencias/assets/data/agencias-tours.json` o documentar cuál es fuente maestra.
6. Agregar pruebas manuales mínimas por idioma: home, vitrina, producto, cotizador, agencias y retorno PayPal.
7. Revisar canonical y `og:url` por idioma después de subir a producción.
