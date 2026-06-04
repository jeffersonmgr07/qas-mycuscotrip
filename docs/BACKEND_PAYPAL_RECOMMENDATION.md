# Recomendación de backend y PayPal para My Cusco Trip

## Recomendación principal

Para este proyecto recomiendo implementar el backend con:

- **NestJS + TypeScript** para una API REST ordenada por módulos.
- **PostgreSQL** como base de datos principal.
- **Prisma ORM** para modelos, migraciones y consultas tipadas.
- **PayPal Orders v2 API** para crear y capturar pagos desde servidor.
- **Webhooks de PayPal** para confirmar pagos de forma confiable.

## Por qué esta opción encaja con el proyecto

El frontend ya trabaja con tours, paquetes, cotizaciones, pasajeros, agencias, pagos parciales y pagos completos. Eso exige relaciones claras entre reservas, viajeros, pagos y estados. PostgreSQL es más conveniente que guardar reservas en JSON, localStorage o una hoja de cálculo, porque permite integridad referencial, consultas por código de reserva, reportes, auditoría y control de estados.

NestJS conviene porque permite separar módulos como `auth`, `products`, `quotes`, `reservations`, `passengers`, `payments`, `agencies` y `webhooks` sin que el backend crezca desordenado.

## Flujo recomendado de pago con PayPal

1. El frontend genera una pre-reserva con producto, fecha, pasajeros, moneda y monto.
2. El backend valida el producto y recalcula el monto. No debe confiar en el monto enviado por el frontend.
3. El backend crea una orden PayPal con Orders API.
4. El frontend muestra el botón PayPal usando el `orderId` creado por backend.
5. El cliente aprueba el pago.
6. El backend captura la orden.
7. El backend actualiza la reserva a `paid`, `partially_paid` o `payment_failed`.
8. Un webhook de PayPal confirma el evento y deja trazabilidad.

## Endpoints mínimos sugeridos

| Método | Endpoint | Uso |
|---|---|---|
| GET | `/api/products` | Listar productos publicados |
| GET | `/api/products/:slug` | Detalle de producto |
| POST | `/api/quotes` | Crear solicitud de cotización |
| POST | `/api/pre-reservations` | Crear pre-reserva |
| POST | `/api/bookings` | Confirmar reserva |
| GET | `/api/bookings/:code` | Consultar reserva por código |
| POST | `/api/passengers` | Registrar pasajeros |
| POST | `/api/payments/paypal/orders` | Crear orden PayPal |
| POST | `/api/payments/paypal/orders/:orderId/capture` | Capturar pago PayPal |
| POST | `/api/payments/paypal/webhook` | Recibir eventos PayPal |
| POST | `/api/agencies/register` | Registrar agencia |
| POST | `/api/agencies/login` | Login de agencia |
| GET | `/api/agencies/bookings` | Reservas de agencia autenticada |

## Estados recomendados

### Reserva

- `draft`
- `pre_reserved`
- `pending_payment`
- `partially_paid`
- `paid`
- `confirmed`
- `cancelled`
- `expired`

### Pago

- `created`
- `approved`
- `captured`
- `failed`
- `refunded`
- `partially_refunded`

## Variables de entorno mínimas

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/mycuscotrip"
JWT_SECRET="change_me"
FRONTEND_URL="https://mycuscotrip.com"
PAYPAL_ENV="sandbox"
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."
PAYPAL_WEBHOOK_ID="..."
```

## Archivos frontend preparados en esta corrección

- `assets/data/backend-config.json`
- `assets/js/core/api-client.js`
- `assets/js/pages/quote-packages.js`
- `assets/data/payment-config.json`

El frontend queda preparado para modo `mock` y para pasar a backend cambiando `apiBaseUrl` y `mode` en `backend-config.json`.

## Nota de seguridad

No colocar `PAYPAL_CLIENT_SECRET`, tokens, claves privadas ni credenciales de base de datos en archivos públicos del frontend. GitHub Pages o cualquier hosting estático expone esos archivos al navegador.
