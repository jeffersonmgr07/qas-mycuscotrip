# Módulo `/agencias` - My Cusco Trip

Archivos principales:

- `agencias/index.html`: portal de experiencias, selector de moneda, carrito y generación de orden.
- `agencias/login.html`: ingreso al portal.
- `agencias/registro.html`: creación de acceso.
- `agencias/assets/data/agencias-tours.json`: catálogo editable de experiencias y tarifas.
- `agencias/assets/js/pages/agencias.js`: lógica de experiencias, carrito, moneda, orden y envío a Google Sheets.
- `agencias/assets/js/pages/registro-agencias.js`: registro de cuentas y envío a Google Sheets.
- `agencias/google-apps-script-agencias.gs`: código para conectar con Google Sheets.

## Qué ya quedó adaptado al proyecto

Los HTML cargan automáticamente:

```html
../components/header.html
../components/footer.html
```

También usan los estilos principales del proyecto:

```html
../assets/css/main.css
../assets/css/components.css
../assets/css/header.css
../assets/css/footer.css
../assets/css/responsive.css
```

No se agregó logo dentro de los HTML porque el logo debe venir desde el header global.

## Tipo de cambio

El tipo de cambio inicial está en `agencias/assets/data/agencias-tours.json`:

```json
"exchangeRate": 3.38
```

También se puede editar desde el campo visible del portal. El valor se guarda en el navegador.

## Fórmula de PayPal + banco

Para recibir un neto completo, el sistema calcula:

```js
total = subtotal / (1 - 0.054 - 0.015)
```

Ejemplo: para recibir 100 netos, se cobra 107.41 aprox.

## Conexión con Google Sheets

### 1. Crear la hoja

Crea un Google Sheet vacío. Copia el ID de la URL.

Ejemplo de URL:

```text
https://docs.google.com/spreadsheets/d/ID_DE_LA_HOJA/edit
```

### 2. Crear Apps Script

En tu Google Sheet:

1. Extensiones → Apps Script.
2. Pega el contenido de `agencias/google-apps-script-agencias.gs`.
3. Cambia:

```js
const SPREADSHEET_ID = '106y_7HTjHpLknivNSeAj1Z6AEBhLvw5hsFqa1GgrGaE'; // vacío si el script está creado desde la hoja con Extensiones > Apps Script
```

por el ID real de tu hoja.

### 3. Publicar el Web App

En Apps Script:

1. Deploy → New deployment.
2. Type: Web app.
3. Execute as: Me.
4. Who has access: Anyone.
5. Deploy.
6. Copia la URL del Web App.

### 4. Pegar la URL en el proyecto

En estos dos archivos:

```text
agencias/assets/js/pages/agencias.js
agencias/assets/js/pages/registro-agencias.js
```

busca:

```js
googleScriptUrl: ''
```

y pega tu URL:

```js
googleScriptUrl: 'https://script.google.com/macros/s/AKfycbwf5cwaC5VsT48XvXh480Jh4ZCVKuBo55AQ9sqon449Tg1ic8rLrHHicuYiMrfneDsA/exec?authuser=0'
```

Con eso, los registros y órdenes se enviarán a Google Sheets.

## Importante sobre seguridad

Esta versión usa `localStorage` para el acceso y Google Sheets para almacenar registros/órdenes. Es simple y rápida para operar, pero no es una autenticación bancaria ni un backend seguro.

Para una zona privada real con usuarios, roles, recuperación de contraseña y control de estados, la siguiente etapa recomendada es Supabase Auth + tablas `agencies`, `orders`, `order_items` y `payments`.

## Dónde editar tarifas y textos

Edita `agencias/assets/data/agencias-tours.json`.

Campos útiles:

- `name`: nombre visible.
- `description`: descripción para el cliente.
- `pricePEN`: precio base en soles.
- `priceUSD`: precio base en dólares para servicios que ya están en USD.
- `priceAltPEN`: precio alternativo, por ejemplo con almuerzo.
- `startLabel`: horarios visibles.
- `durationLabel`: duración.
- `notIncluded`: entradas o pagos no incluidos.
- `image`: imagen cover.
- `jsonSources`: archivos JSON desde donde se intentará cargar el itinerario detallado.


## Verificación de correo para agencias

Esta versión envía automáticamente un correo de verificación cuando una agencia se registra.

Flujo:
1. La agencia completa `/agencias/registro.html`.
2. Google Apps Script guarda la agencia en la hoja `Agencias` con `estado = Pendiente` y `emailVerificado = No`.
3. Apps Script envía un correo al email de acceso con un botón para verificar.
4. Al hacer clic, la columna `emailVerificado` cambia a `Sí`.
5. Tú revisas la agencia y cambias manualmente `estado` a `Aprobado`.
6. Recién entonces podrá ingresar en `/agencias/login.html`.

Columnas adicionales necesarias en `Agencias`:

```txt
emailVerificado
verificationToken
fechaVerificacion
```

No necesitas agregarlas manualmente si usas el Apps Script incluido: el script las crea automáticamente si no existen.

### Importante
Después de pegar el nuevo Apps Script, debes ir a:

**Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**

La primera vez que el script envíe correos, Google pedirá autorización para usar `MailApp`.


## URL de Apps Script configurada

La URL ya quedó pegada en los archivos JavaScript del portal:

```txt
https://script.google.com/macros/s/AKfycbwf5cwaC5VsT48XvXh480Jh4ZCVKuBo55AQ9sqon449Tg1ic8rLrHHicuYiMrfneDsA/exec?authuser=0
```

Archivos actualizados:

```txt
agencias/assets/js/pages/agencias.js
agencias/assets/js/pages/acceso-agencias.js
agencias/assets/js/pages/registro-agencias.js
```

Nota importante: esa URL es la URL del Web App de Apps Script, no el ID de Google Sheets. En esta versión el Apps Script puede funcionar sin ID si fue creado desde la hoja de cálculo mediante **Extensiones > Apps Script**. Si el Apps Script fue creado como proyecto independiente, debes pegar el ID real de Google Sheets en `SPREADSHEET_ID`.


## PayPal automático con Apps Script

Esta versión incluye una integración inicial automática con PayPal usando Apps Script como backend ligero.

### Seguridad del flujo
- Si la agencia abre PayPal y cierra la ventana sin pagar, la orden NO se marca como pagada.
- La orden solo se marca como Pagada cuando Apps Script ejecuta la captura de PayPal y PayPal responde `COMPLETED`.
- Los webhooks de PayPal requieren verificar firma con headers HTTP. Google Apps Script Web Apps no exponen esos headers de forma suficiente, por eso esta versión no marca pagos desde webhook en Apps Script. Para webhooks verificados se recomienda Vercel Functions, Cloud Run, Supabase Edge Functions o un backend propio.

### Configurar credenciales PayPal
En Apps Script ve a **Configuración del proyecto > Propiedades del script** y agrega:

- `PAYPAL_MODE` = `sandbox` o `live`
- `PAYPAL_CLIENT_ID` = tu Client ID
- `PAYPAL_CLIENT_SECRET` = tu Secret

Luego actualiza la implementación existente como **Nueva versión**.

### URL de retorno PayPal
El script usa:
`https://mycuscotrip.com/agencias/paypal-retorno.html`

Si pruebas en otro dominio, cambia la constante `PORTAL_BASE_URL` en `google-apps-script-agencias.gs`.


## Diagnóstico PayPal

Si al hacer clic en **Pagar con PayPal** aparece `Acción no reconocida: createPayPalOrder`, no es un problema del Client ID ni del Secret. Significa que la URL publicada de Apps Script todavía está ejecutando una versión antigua del código.

Después de pegar el nuevo `google-apps-script-agencias.gs`, guarda y publica con: **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar**.

Para verificar que la versión correcta quedó activa, abre esta URL en el navegador:

https://script.google.com/macros/s/AKfycbwf5cwaC5VsT48XvXh480Jh4ZCVKuBo55AQ9sqon449Tg1ic8rLrHHicuYiMrfneDsA/exec?authuser=0&action=debugActions

Debe mostrar una respuesta JSON con `version: paypal-actions-2026-05-26-v4` y debe incluir `createPayPalOrder` y `capturePayPalOrder` dentro de `actions`.
