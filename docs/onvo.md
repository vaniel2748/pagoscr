# ONVO: primer cobro de prueba

PagosCR implementa **payment intents** en modo test. Crear devuelve `pending`,
sin una URL de Checkout alojado. Primero ejecuta el [demo](../README.md) y compila
con `npm run build`. Una app local puede incorporar este checkout con
`npm install /ruta/absoluta/a/pagoscr`; no hay una versión publicada en npm.

Documentación oficial revisada el 20 de noviembre de 2026:
[autenticación](https://docs.onvopay.com/authentication),
[intenciones](https://docs.onvopay.com/payments/payment-intents),
[tarjetas de prueba](https://docs.onvopay.com/payments/testing),
[firmas](https://docs.onvopay.com/webhooks/verify-signatures) y
[eventos](https://docs.onvopay.com/webhooks/events).

## Preparar el backend

El operador configura `ONVO_TEST_SECRET_KEY` y, para recibir eventos,
`ONVO_WEBHOOK_SECRET`. La app cliente usa únicamente la publishable key **test**
con el SDK de ONVO. Obtén los valores fuera del repositorio; nunca los pegues al
agente, al manifiesto del plugin ni a una página HTML. Un agente necesita permiso
antes de usar credenciales; conserva una autorización ya concedida para la misma prueba.

El servidor carga la orden desde su catálogo/base de datos y llama al adaptador.
Este ejemplo recibe ese objeto de confianza, no el JSON del navegador:

```ts
import {
  OnvoAdapter,
  type CreateChargeInput,
  type PaymentStore,
  type WebhookRequest,
  processWebhook,
} from 'pagoscr';

export function configurarOnvo() {
  const secretKey = process.env.ONVO_TEST_SECRET_KEY;
  const webhookSecret = process.env.ONVO_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    throw new Error('Configura las dos variables de ONVO del backend.');
  }
  return new OnvoAdapter({ secretKey, webhookSecret });
}

export async function crearCobroOnvo(
  ordenDelServidor: CreateChargeInput,
  store: PaymentStore,
  provider: OnvoAdapter,
) {
  const charge = await provider.createCharge(ordenDelServidor);
  await store.savePayment({
    paymentId: ordenDelServidor.paymentId,
    provider: 'onvo',
    providerPaymentId: charge.providerPaymentId,
    amountCents: ordenDelServidor.amountCents,
    currency: ordenDelServidor.currency,
    status: charge.status,
  });
  return charge;
}

export async function recibirEventoOnvo(
  request: WebhookRequest,
  store: PaymentStore,
  provider: OnvoAdapter,
) {
  return processWebhook(provider, request, store);
}
```

Guarda la referencia antes de continuar. Usa un identificador de orden único y
reutiliza la intención existente al reintentar. Un timeout al crear no demuestra
que la pasarela no creó nada: reconcilia la orden antes de repetir la operación.

## Tokenizar, confirmar y recibir el evento

La app recoge el método mediante el SDK oficial de ONVO. Envía al backend su
referencia tokenizada; el backend verifica dueño de la orden, carga su referencia
de intención y llama a `provider.confirmTestCharge(idDeIntencion, idDeMetodo)`.
No expongas esa operación como un endpoint que acepte cualquier intención ajena.
Nunca pases número de tarjeta o CVV a las herramientas MCP.

Configura un endpoint de prueba para `payment_intent.succeeded` y
`payment_intent.failed`. Su ruta debe leer **bytes crudos antes de cualquier
parser JSON**, hasta 65536 bytes, y entregar `X-Onvo-Signature` sin modificar.
No reconstruyas el cuerpo con JSON.stringify: cambia lo firmado.

`processWebhook` verifica HMAC-SHA256, timestamp con tolerancia de 300 segundos y
cualquier firma v1 válida de la rotación. Después consulta la intención por API y
contrasta modo test, referencia, metadata de la orden, monto y moneda. Un éxito
requiere `succeeded` y `receivedAmount` completo. El resultado del navegador o de
`confirmTestCharge` por sí solo no aplica el pago a la orden.

ONVO entrega al menos una vez. Persiste pago/evento en una transacción con
unicidad por pasarela e id de evento. Un duplicado válido devuelve `duplicate: true`;
no repitas entrega ni facturación. Responde 2xx dentro de diez segundos **después**
de aplicar el evento o de encolar trabajo de forma durable. Un fallo de API no
marca el pago como completado. [Seguridad y persistencia](seguridad.md).

## Qué está comprobado

La suite común pasa con fixtures sintéticos. El 20 de noviembre se autorizó y
aprobó una prueba contra la API: tarjeta ficticia oficial, intención de ₡20000,
confirmación y consulta, en 2,33 segundos. No se ha recibido un webhook real.
La E2E está separada del CI. Con autorización, desde el checkout fuente, carga el
archivo externo sin copiarlo y ejecuta:

```sh
PAGOSCR_RUN_ONVO_E2E=1 node --env-file=../.env.onvo ./node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
```

Ese archivo pertenece al entorno de desarrollo; otra app configura su propio
entorno de prueba. El plugin distribuido no contiene llaves ni el archivo externo.

Si necesitas Checkout hospedado, consulta su
[flujo oficial](https://docs.onvopay.com/checkout/one-time-links).
Ese contrato y sus eventos no están implementados en este adaptador.

| Problema           | Qué revisar                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| TEST_MODE_REQUIRED | Llave secreta test; no publicable ni live.                                    |
| INVALID_SIGNATURE  | Bytes originales, secreto del endpoint, reloj y encabezado.                   |
| PAYMENT_NOT_FOUND  | Orden guardada y mismo almacén entre creación y evento.                       |
| PAYMENT_MISMATCH   | Orden/monto/moneda/metadata originales y estado consultado. No fuerces éxito. |
| GATEWAY_ERROR      | Disponibilidad de ONVO; conserva la referencia y reintenta la consulta.       |
