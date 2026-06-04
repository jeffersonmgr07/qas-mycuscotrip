#!/usr/bin/env node
/*
  My Cusco Trip sitemap generator
  Usage from project root:
    node tools/generate-sitemap.js

  It reads current JSON catalog files and writes sitemap.xml at the project root.
*/

const fs = require("fs");
const path = require("path");

const SITE_URL = process.env.SITE_URL || "https://mycuscotrip.com";
const ROOT = process.cwd();
const OUT = path.join(ROOT, "sitemap.xml");

const DATA_FILES = [
  "assets/data/tours-cusco.json",
  "assets/data/tours-machu-picchu.json",
  "assets/data/tours-peru.json",
  "assets/data/packages-cusco.json",
  "assets/data/packages-peru.json"
];

const STATIC_URLS = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/index.html", priority: "1.0", changefreq: "weekly" },
  { loc: "/all-experiences.html", priority: "0.95", changefreq: "weekly" },
  { loc: "/machu-picchu-tours.html", priority: "0.95", changefreq: "weekly" },
  { loc: "/cusco-tours.html", priority: "0.95", changefreq: "weekly" },
  { loc: "/paquetes-cusco.html", priority: "0.95", changefreq: "weekly" },
  { loc: "/explora-peru.html", priority: "0.9", changefreq: "weekly" },
  { loc: "/trekkings.html", priority: "0.85", changefreq: "weekly" },
  { loc: "/booking-status.html", priority: "0.5", changefreq: "monthly" },

  { loc: "/pages/conocenos/sobre-nosotros.html", priority: "0.55", changefreq: "monthly" },
  { loc: "/pages/conocenos/nuestro-compromiso.html", priority: "0.5", changefreq: "monthly" },
  { loc: "/pages/conocenos/plan-sostenibilidad.html", priority: "0.5", changefreq: "monthly" },
  { loc: "/pages/conocenos/responsabilidad-social.html", priority: "0.5", changefreq: "monthly" },
  { loc: "/pages/conocenos/noticias.html", priority: "0.45", changefreq: "weekly" },
  { loc: "/pages/conocenos/red-oficinas.html", priority: "0.45", changefreq: "monthly" },

  { loc: "/pages/informacion-util/planifica-tu-viaje.html", priority: "0.75", changefreq: "monthly" },
  { loc: "/pages/informacion-util/viajes-grupo-privados.html", priority: "0.65", changefreq: "monthly" },
  { loc: "/pages/informacion-util/delegaciones-estudiantes.html", priority: "0.55", changefreq: "monthly" },
  { loc: "/pages/informacion-util/blog-experiencias.html", priority: "0.75", changefreq: "weekly" },
  { loc: "/pages/informacion-util/como-llegar-machu-picchu.html", priority: "0.85", changefreq: "monthly" },
  { loc: "/pages/informacion-util/frecuencia-trenes.html", priority: "0.8", changefreq: "monthly" },
  { loc: "/pages/informacion-util/boleto-machu-picchu.html", priority: "0.85", changefreq: "monthly" },

  { loc: "/pages/ayuda/preguntas-frecuentes.html", priority: "0.65", changefreq: "monthly" },
  { loc: "/pages/ayuda/descargar-travel-voucher.html", priority: "0.35", changefreq: "monthly" },
  { loc: "/pages/ayuda/descargar-tickets-servicios.html", priority: "0.35", changefreq: "monthly" },
  { loc: "/pages/ayuda/cambios-postergaciones.html", priority: "0.55", changefreq: "monthly" },

  { loc: "/pages/legales/terminos-condiciones.html", priority: "0.35", changefreq: "yearly" },
  { loc: "/pages/legales/politica-privacidad.html", priority: "0.35", changefreq: "yearly" },
  { loc: "/pages/legales/politica-cookies.html", priority: "0.35", changefreq: "yearly" },
  { loc: "/pages/legales/terminos-condiciones-generales.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/pages/legales/terminos-uso-sitio-web.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/pages/legales/politica-sistema-integrado-gestion.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/pages/legales/contrato-servicios.html", priority: "0.3", changefreq: "yearly" },
  { loc: "/pages/legales/libro-reclamaciones.html", priority: "0.45", changefreq: "yearly" },

  { loc: "/pages/socios/extranet-agencias.html", priority: "0.45", changefreq: "monthly" },
  { loc: "/pages/socios/proveedores.html", priority: "0.45", changefreq: "monthly" },
  { loc: "/pages/socios/trabaja-con-nosotros.html", priority: "0.45", changefreq: "monthly" },
  { loc: "/pages/socios/aliados.html", priority: "0.45", changefreq: "monthly" }
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function readJson(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    console.warn(`[WARN] Could not parse ${relativePath}: ${error.message}`);
    return null;
  }
}

function getCatalogItems(json) {
  if (!json || typeof json !== "object") return [];
  const buckets = [json.products, json.tours, json.packages, json.packageCards, json.items];
  return buckets.flatMap((entry) => (Array.isArray(entry) ? entry : []));
}

function collectProductUrls() {
  const urls = [];
  for (const file of DATA_FILES) {
    const json = readJson(file);
    const items = getCatalogItems(json);
    for (const item of items) {
      const slug = item && item.slug;
      if (!slug || typeof slug !== "string") continue;
      urls.push({
        loc: `/product.html?slug=${encodeURIComponent(slug)}`,
        priority: item.productKind === "package" || item.type === "package" ? "0.88" : "0.84",
        changefreq: "weekly"
      });
    }
  }
  return urls;
}

function dedupe(urls) {
  const map = new Map();
  for (const entry of urls) {
    if (!entry || !entry.loc) continue;
    if (!map.has(entry.loc)) map.set(entry.loc, entry);
  }
  return [...map.values()];
}

function buildSitemap(urls) {
  const lastmod = today();
  const body = urls.map((entry) => {
    const absoluteLoc = entry.loc.startsWith("http") ? entry.loc : `${SITE_URL}${entry.loc}`;
    return [
      "  <url>",
      `    <loc>${xmlEscape(absoluteLoc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
      `    <changefreq>${entry.changefreq || "monthly"}</changefreq>`,
      `    <priority>${entry.priority || "0.5"}</priority>`,
      "  </url>"
    ].join("\n");
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

const urls = dedupe([...STATIC_URLS, ...collectProductUrls()]);
const xml = buildSitemap(urls);
fs.writeFileSync(OUT, xml, "utf8");
console.log(`[OK] Generated ${path.relative(ROOT, OUT)} with ${urls.length} URLs for ${SITE_URL}`);
