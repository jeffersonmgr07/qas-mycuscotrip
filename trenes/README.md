# Módulo de venta de trenes - My Cusco Trip

Carpeta creada para trabajar la venta de trenes sin alterar los estilos ni la lógica principal del sitio.

## Archivos principales

- `index.html`: página pública para buscar y comprar trenes.
- `paypal-retorno.html`: página de retorno para confirmar el pago PayPal.
- `assets/css/trenes.css`: estilos propios del módulo.
- `assets/js/config.js`: configuración editable del módulo.
- `assets/js/trenes.js`: lógica del buscador, selección de trenes, extras, pasajeros y creación de orden.
- `assets/js/paypal-retorno.js`: captura de pago PayPal al volver desde PayPal.
- `backend/google-apps-script-trenes.gs`: backend completo para Google Sheets + PayPal.
- `backend/google-sheet-template-trenes.xlsx`: plantilla referencial de hojas y columnas.

## Integración visual

El módulo carga el header y footer generales del proyecto desde:

```txt
/components/header.html
/components/footer.html
```

También carga los estilos globales del sitio y luego aplica sus estilos propios desde:

```txt
/trenes/assets/css/trenes.css
```

## Idiomas

La carpeta incluye copias para rutas de idioma:

```txt
/en/trenes/
/pt/trenes/
/fr/trenes/
/de/trenes/
/it/trenes/
/ja/trenes/
/zh/trenes/
```

El contenido del módulo está traducido en español e inglés. Para otros idiomas, la cabecera y el footer se traducen con el sistema general del sitio, y el contenido del módulo queda en español hasta que se agreguen más traducciones.

## Configuración del frontend

Edita `trenes/assets/js/config.js`:

```js
window.MCT_TRAIN_CONFIG = {
  appsScriptUrl: 'PEGAR_AQUI_URL_DE_GOOGLE_APPS_SCRIPT',
  trainsJsonPath: '/assets/data/trains.json',
  paypalReturnPath: '/trenes/paypal-retorno.html',
  exchangeRate: 3.38,
  currency: 'USD',
  supportWhatsApp: '+51900608980',
  bookingPrefix: 'CUZ-T'
};
```

El módulo lee el JSON desde:

```txt
/assets/data/trains.json
```

Por eso no duplica el catálogo de trenes.

## Configuración de Google Apps Script

1. Crea un Google Sheet nuevo.
2. Copia su ID.
3. Abre Extensiones > Apps Script.
4. Pega el contenido de `backend/google-apps-script-trenes.gs`.
5. Cambia:

```js
const SPREADSHEET_ID = 'PEGAR_AQUI_ID_DE_GOOGLE_SHEET';
const PUBLIC_BASE_URL = 'https://mycuscotrip.com/trenes';
const SUPPORT_EMAIL = 'reservas@mycuscotrip.com';
```

6. Ejecuta `setupTrainSheets()` una vez.
7. En Propiedades del script agrega:

```txt
PAYPAL_MODE = sandbox o live
PAYPAL_CLIENT_ID = tu client id
PAYPAL_CLIENT_SECRET = tu secret
```

8. Implementa como aplicación web:
   - Ejecutar como: tú.
   - Acceso: cualquier usuario con el enlace.
9. Copia la URL `/exec` en `trenes/assets/js/config.js`.

## Reglas implementadas

- Por defecto busca `Ollantaytambo → Machu Picchu`.
- El buscador superior queda minimalista: tipo de viaje, fechas, pasajeros, cupón y buscar.
- Las estaciones se eligen debajo del buscador con botones de ruta.
- Permite ida desde Cusco, Ollantaytambo, Urubamba o Hidroeléctrica.
- Permite retorno hacia Cusco, Ollantaytambo, Urubamba o Hidroeléctrica.
- En ida y vuelta, el retorno se muestra después de elegir ida y se filtra por la misma empresa.
- Se puede combinar categoría, pero no empresa.
- No se muestran trenes locales en esta página porque su compra es personal/presencial.
- El precio de niño se lee desde el JSON; si faltara, usa adulto × 0.80.
- El modal solicita nacionalidad desplegable, tipo/número de documento, fecha de nacimiento, WhatsApp con código de país y correo.
- Solo el titular necesita WhatsApp y correo obligatorios.
- Extras:
  - Circuito 2 gratis en ida y vuelta.
  - Circuito 1 o 3: USD 15.90 por persona en grupo reducido de 4 a 6 pax.
  - Consetur subida y bajada: USD 24.00 por persona.
  - Desayuno Power Peruano: USD 8.90 por persona.
  - Almuerzo Power Peruano: USD 15.90 por persona.
- Código de reserva: `CUZ-T-HEX-RANDOM`.

## Nota operativa

La página cobra la orden con PayPal, pero la emisión real del boleto debe validarse con la empresa ferroviaria. Por eso los correos y textos indican que la compra queda sujeta a disponibilidad final.
