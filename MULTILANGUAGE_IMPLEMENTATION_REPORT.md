# Implementación multidioma My Cusco Trip

Se conservó el español como idioma principal en la raíz del sitio y se agregaron carpetas nativas para SEO:

- `/en/` inglés
- `/pt/` portugués
- `/fr/` francés
- `/de/` alemán
- `/it/` italiano
- `/zh/` chino simplificado
- `/ja/` japonés

## Páginas HTML generadas por idioma

- `/en/index.html`
- `/pt/index.html`
- `/fr/index.html`
- `/de/index.html`
- `/it/index.html`
- `/zh/index.html`
- `/ja/index.html`

Cada idioma incluye las páginas públicas principales copiadas en su carpeta, con `lang`, canonical, robots y hreflang propios.

## Datos dinámicos traducidos

Se crearon archivos por idioma en:

`assets/data/i18n/<idioma>/`

Incluye:

- `ui-translations.json`
- `seo-pages.json`
- `tours-cusco.json`
- `tours-machu-picchu.json`
- `tours-peru.json`
- `trekkings-cusco.json`
- `packages-cusco.json`
- `packages-peru.json`
- `private-packages.json`
- `destinations.json`
- `hotels.json`
- `trains.json`

## Archivos modificados

- `assets/js/i18n.js`
- `assets/js/core/data-loader.js`
- `assets/js/pages/product.js`
- `assets/js/pages/quote-packages.js`
- `assets/js/components/header.js`
- `components/header.html`
- `components/footer.html`
- `sitemap.xml`
- HTML principales de la raíz para ampliar hreflang

## Nota importante

La estructura técnica SEO multidioma está creada. Las traducciones largas de productos son una primera versión editable y deben revisarse comercialmente antes de campañas fuertes, especialmente condiciones de reserva, cancelaciones, trenes, entradas, hoteles y políticas de pago.

## Prioridad sugerida de revisión humana

1. Inglés: revisar primero y publicar.
2. Portugués y francés: revisar segundo.
3. Alemán e italiano: revisar tercero.
4. Chino simplificado y japonés: revisar con especial cuidado cultural antes de indexar campañas pagadas.
