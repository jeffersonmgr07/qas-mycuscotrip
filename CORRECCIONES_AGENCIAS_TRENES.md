# Correcciones aplicadas - agencias y trenes

## Módulo agencias
Archivos modificados:
- `agencias/assets/js/pages/agencias-i18n.js`
- `agencias/assets/js/pages/agencias.js`
- `agencias/assets/js/pages/ordenes-agencias.js`

Cambios:
- Se agregó el diccionario completo en español para evitar que se muestren claves como `agency.book`, `agency.viewItinerary`, `agency.perPerson`, `agency.selectCountry`, `orders.viewDetails`, etc.
- Se reforzó la función `t()` para usar textos de respaldo si alguna clave no existe.
- No se cambió la conexión de pagos ni la lógica de guardado de órdenes.

## Módulo trenes
Archivos modificados:
- `trenes/index.html`
- `de/trenes/index.html`
- `en/trenes/index.html`
- `fr/trenes/index.html`
- `it/trenes/index.html`
- `ja/trenes/index.html`
- `pt/trenes/index.html`
- `zh/trenes/index.html`
- `trenes/assets/css/trenes.css`
- `trenes/assets/js/trenes.js`

Cambios:
- Hero actualizado con el texto: “Compra tu tren a Machu Picchu y obtén los mejores beneficios”.
- Textos del hero en blanco y badges nuevos:
  - Tour guiado gratuito dentro de Machu Picchu
  - Asistencia 24/7
  - Beneficios exclusivos por tu compra
- Se eliminó visualmente el badge “Mejor opción”.
- “Ida y vuelta” y “Solo ida” se mantienen en una sola línea.
- Se redujeron espacios entre buscador, rutas y resultados.
- Se agregó selección progresiva dentro del módulo trenes:
  1. El usuario marca un tren.
  2. Aparece el botón “Seleccionar este tren”.
  3. Al confirmar, se muestra solo el tren elegido y aparece “Modificar tren de ida/retorno”.
  4. Luego se muestra la lista de retorno.
  5. Al confirmar retorno, quedan visibles los trenes seleccionados y el resumen.
- La asistencia incluida ahora aparece como nota simple: “Asistencia personalizada 24/7 incluida sin costo”.

Nota: Para la selección progresiva fue necesario tocar únicamente `trenes/assets/js/trenes.js`, sin modificar otros JS del proyecto.
