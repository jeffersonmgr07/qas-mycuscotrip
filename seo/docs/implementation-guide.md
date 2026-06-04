# Implementación SEO técnica - My Cusco Trip

Dominio base: https://mycuscotrip.com

## 1. Copiar archivos

Copiar en la raíz del proyecto:

- robots.txt
- sitemap.xml

Copiar en sus carpetas:

- tools/generate-sitemap.js
- assets/js/core/seo-service.js

## 2. Product SEO dinámico

En product.html, cargar seo-service.js antes de product.js:

```html
<script src="./assets/js/core/seo-service.js"></script>
<script src="./assets/js/pages/product.js"></script>
```

El servicio SEO detecta `product.html?slug=...`, carga los JSON del catálogo, actualiza title, description, canonical, Open Graph, Twitter Card y JSON-LD TouristTrip/Offer.

## 3. Generar sitemap

Desde la raíz del proyecto:

```bash
node tools/generate-sitemap.js
```

Opcional con dominio explícito:

```bash
SITE_URL=https://mycuscotrip.com node tools/generate-sitemap.js
```

## 4. Google Search Console

1. Verificar el dominio mycuscotrip.com.
2. Enviar https://mycuscotrip.com/sitemap.xml.
3. Usar URL Inspection para probar index.html, all-experiences.html y varios product.html?slug=...
4. Revisar errores de cobertura e indexación.

## 5. Validar datos estructurados

Usar Rich Results Test o Schema Markup Validator para:

- index.html
- machu-picchu-tours.html
- product.html?slug=machu-picchu-full-day-clasico

## 6. Importante sobre palabras clave

No usar meta keywords. Google no las usa para ranking. Trabajar keywords en:

- title
- h1
- h2
- textos útiles
- FAQs
- enlaces internos
- URLs
- alt de imágenes
- schema cuando corresponda
