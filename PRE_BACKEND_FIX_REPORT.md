# My Cusco Trip - Correcciones pre-backend

Fecha de intervención: 2026-05-21

## Resumen ejecutivo

Se aplicaron correcciones para dejar el frontend más estable antes de conectarlo a backend y pagos con PayPal. El proyecto sigue funcionando como sitio estático, pero ahora cuenta con un adaptador API en modo `mock`, filtros de productos publicados, cotizador funcional, mejoras de seguridad para datos locales y documentación técnica para implementar backend.

## Correcciones aplicadas

### 1. Cotizador de paquetes
- Se reemplazó `assets/js/pages/quote-packages.js`, que estaba roto con un texto inválido de error de servidor.
- Se agregó un cotizador ligero en `quote-packages.html` y versiones localizadas.
- El cotizador genera solicitudes con código `QTC...` y queda preparado para enviar datos a `/api/quotes`.
- En modo actual, guarda solo un borrador seguro de prueba mediante el adaptador API.

### 2. Adaptador API listo para backend
- Se creó `assets/js/core/api-client.js`.
- Se creó `assets/data/backend-config.json`.
- El frontend ya tiene métodos preparados para:
  - `POST /api/quotes`
  - `POST /api/pre-reservations`
  - `POST /api/payments/paypal/orders`
  - `POST /api/payments/paypal/orders/{orderId}/capture`
- El modo actual está configurado como `mock` para evitar envíos reales sin backend.

### 3. Preparación para PayPal
- La reserva ahora genera un payload compatible con integración de pago posterior.
- Se dejó explícito que PayPal requiere backend para crear/capturar órdenes de forma segura.
- No se incluyeron credenciales ni secretos en frontend.

### 4. Seguridad de reservas y pasajeros
- Se retiró el guardado directo de pre-reservas completas con datos sensibles en `localStorage` desde la página de producto.
- En modo `mock`, el adaptador local elimina o reduce datos sensibles antes de guardar el borrador.
- Se añadió política de almacenamiento temporal en `backend-config.json`.

### 5. Portal de agencias
- Se modificó el registro e inicio de sesión demo para evitar guardar contraseñas en texto plano.
- Ahora se usa hash SHA-256 con salt mediante WebCrypto como mejora para prototipo.
- Nota: para producción, la autenticación debe migrarse al backend con hash robusto, sesiones/JWT y roles.

### 6. Filtro de productos públicos
- Se agregó `isPublicProduct()` en `assets/js/core/catalog-normalizer.js`.
- Se aplicó filtro `status === "published"` en catálogo, experiencias y detalle de producto.
- Esto evita mostrar productos en borrador, privados, archivados u ocultos en páginas públicas.

### 7. Traducciones UI
- Se completaron claves funcionales faltantes en los archivos de traducción UI.
- Se añadieron nuevas claves para mensajes de reserva, disponibilidad y pago.
- Los archivos localizados ya no presentan claves faltantes frente al diccionario base.
- Recomendación: hacer revisión nativa de textos largos comerciales/SEO antes de campañas internacionales.

### 8. Imágenes y fallbacks
- Se crearon placeholders para imágenes faltantes:
  - `assets/img/placeholder/experience.jpg`
  - `assets/img/products/default.jpg`
  - `assets/img/airlines/default.png`
  - `assets/img/agentes/jefferson-garcia.jpg`
- Se corrigieron referencias faltantes en JSON para evitar tarjetas rotas.
- Se corrigieron rutas de logos de aerolíneas en cotizadores localizados.

### 9. SEO y metadatos básicos
- Se corrigieron referencias incorrectas de `quote-packages.html` que apuntaban a `explora-peru.html`.
- Se alinearon URLs de schema/OG/canonical en la página de cotización y versiones localizadas.

### 10. Tracking
- Se cambió `debug: true` a `debug: false` en `assets/js/config/tracking-config.js`.

## Archivos técnicos agregados

- `assets/js/core/api-client.js`
- `assets/data/backend-config.json`
- `docs/BACKEND_PAYPAL_RECOMMENDATION.md`
- `docs/prisma-reservation-schema.prisma`
- `PRE_BACKEND_FIX_REPORT.md`

## Validaciones realizadas

- Validación de sintaxis JavaScript con `node --check`: correcta.
- Validación de JSON: correcta en 188 archivos.
- Búsqueda del texto inválido original en archivos funcionales: sin ocurrencias.
- Validación de claves UI faltantes por idioma: 0 faltantes frente al diccionario base.
- Revisión de referencias de imágenes en JSON: sin faltantes detectados.

## Pendientes recomendados antes del backend productivo

1. Convertir `product.js` en módulos más pequeños.
2. Implementar backend real con validaciones de precio y disponibilidad.
3. Crear panel admin para reservas, pasajeros, pagos y agencias.
4. Implementar PayPal Orders API desde backend, nunca con secretos en frontend.
5. Agregar webhooks de PayPal para confirmar pagos de forma confiable.
6. Revisar textos SEO largos por hablantes nativos para EN/PT/FR/DE/IT/ZH/JA.
7. Definir política legal de privacidad, cookies, cambios y cancelaciones según operación real.
