# ONVO: primer cobro de prueba

La plantilla y el MCP crean un **enlace de pago de ONVO en modo test**. El comprador
introduce la tarjeta en ONVO; PagosCR conserva la orden y consulta su resultado.
Primero ejecuta el [demo](../README.md) y compila con `npm run build`.
Una app local puede incorporar este checkout con
`npm install /ruta/absoluta/a/pagoscr`; no hay una versión publicada en npm.

Documentación oficial revisada el 20 de noviembre de 2026:
[autenticación](https://docs.onvopay.com/authentication),
[checkout alojado](https://docs.onvopay.com/checkout/one-time-links),
[sesiones](https://docs.onvopay.com/api/obtener-una-sesion-de-checkout),
[intenciones](https://docs.onvopay.com/payments/payment-intents),
[tarjetas de prueba](https://docs.onvopay.com/payments/testing),
[firmas](https://docs.onvopay.com/webhooks/verify-signatures) y
[eventos](https://docs.onvopay.com/webhooks/events).

## Preparar el backend

El operador configura `ONVO_TEST_SECRET_KEY` y, para recibir eventos,
`ONVO_WEBHOOK_SECRET`. El checkout alojado no necesita una llave en el navegador.
Obtén los valores fuera del repositorio; nunca los pegues al
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
  if (!secretKey) {
    throw new Error('Configura la llave secreta test de ONVO del backend.');
  }
  return new OnvoAdapter({
    secretKey,
    checkout: true,
    ...(webhookSecret ? { webhookSecret } : {}),
  });
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
reutiliza la sesión existente al reintentar. Un timeout al crear no demuestra
que la pasarela no creó nada: reconcilia la orden antes de repetir la operación.

## Abrir la plantilla y pagar

Con permiso para usar las llaves externas, desde la raíz del repositorio:

```sh
npm run build
PAGOSCR_PASARELA=onvo node --env-file=../.env.onvo dist/template/cli.js
```

Abre [la plantilla local](http://127.0.0.1:4321), crea la orden y pulsa **Pagar
con ONVO**. En su pestaña usa la tarjeta ficticia oficial `4242 4242 4242 4242`,
CVV `123` y una fecha futura. Vuelve a la plantilla: consulta al recuperar el foco;
también puedes pulsar **Consultar pago**. Recarga y comprueba la misma referencia.
La confirmación de la pantalla alojada con esta integración sigue pendiente de
la prueba manual de Vaniel; el recorrido local se comprobó con fixtures.

El monto viene del catálogo; el navegador envía solo el producto. La orden se
guarda antes de devolver `clientAction.url`; el MCP la devuelve en
`cobro.accionCliente.url`. La URL de retorno no decide el estado del pago.
El POST real omite `status` y la cantidad del artículo; PagosCR consulta la sesión
completa antes de entregar el enlace. Hay [respuestas reales anonimizadas](../test/fixtures/onvo/PROCEDENCIA.md)
que cubren esa diferencia frente al esquema general de OpenAPI.
No se asume que ONVO admita HTTP local como retorno: se abre otra pestaña. Si
configuras `PAGOSCR_RETURN_URL`, debe ser HTTPS y servir la página neutral `/pago`.

`getTestCheckoutPayment(ordenGuardada)` consulta `GET /checkout/sessions/{id}` y,
si está `complete`/`paid`, su intención vinculada por `GET /payment-intents/{id}`.
Comprueba modo test, referencia, cantidad fija, monto, moneda y `receivedAmount`
completo. La plantilla actualiza la orden solo con esa comprobación. No presupone
que la metadata de la sesión se copie a la intención.

Si no llega el webhook, esa consulta autenticada permite confirmar la orden.
La plantilla registra el resultado con el identificador interno determinista
`consulta-checkout:<sesión>:<estado>`. Lo genera el servidor a partir de la sesión
guardada y del resultado validado; no es un evento emitido por ONVO ni un dato que
el navegador pueda elegir. Se aplica y deduplica mediante `PaymentStore`, sin
crear otro cobro. Cumple la misma función que `lookupCapturedPayment` de Tilopay
con su `consult` autenticado. [Persistencia y efectos únicos](seguridad.md).

## Recibir el evento firmado

En modo ONVO, el endpoint local es `POST /api/webhooks/onvo` y recibe
`checkout_session.succeeded`. Su ruta lee **bytes crudos antes de cualquier
parser JSON**, hasta 65536 bytes, y entrega `X-Onvo-Signature` sin modificar.
No reconstruyas el cuerpo con JSON.stringify: cambia lo firmado.

`processWebhook` verifica HMAC-SHA256, timestamp con tolerancia de 300 segundos y
cualquier firma v1 válida de la rotación. Después consulta sesión e intención y
exige que confirmen el mismo pago y monto completo. Una firma válida por sí sola
no demuestra un cobro. Una API no disponible devuelve 503 para reintentar.

ONVO entrega al menos una vez. Persiste pago/evento en una transacción con
unicidad por pasarela e id de evento. Un duplicado válido devuelve `duplicate: true`;
no repitas entrega ni facturación. Responde 2xx dentro de diez segundos **después**
de aplicar el evento o de encolar trabajo de forma durable. Un fallo de API no
marca el pago como completado. [Seguridad y persistencia](seguridad.md).

## Qué está comprobado

La suite común usa fixtures; el checkout también incluye respuestas reales
anonimizadas de creación y consulta. El 21 de noviembre de 2026 pasaron las dos
E2E contra la API de ONVO test, intenciones y checkout, en 5,57 segundos en total.
Ambas cobran ₡20000 ficticios y consultan el resultado. No se ha recibido un webhook real.
La E2E está separada del CI: una prueba de intenciones y otra de checkout que paga
por API con el método ficticio; no sustituye la prueba manual de su pantalla.
Con autorización para esta prueba, desde el checkout fuente, carga el
archivo externo sin copiarlo y ejecuta:

```sh
PAGOSCR_RUN_ONVO_E2E=1 node --env-file=../.env.onvo ./node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
```

Ese archivo pertenece al entorno de desarrollo; otra app configura su propio
entorno de prueba. El plugin distribuido no contiene llaves ni el archivo externo.

## Compatibilidad con intenciones existentes

Sin `checkout: true`, `OnvoAdapter` conserva el flujo de intenciones:
`createCharge` devuelve pendiente sin URL, el SDK oficial tokeniza el método,
`confirmTestCharge` recibe su referencia y `getTestPayment` consulta el resultado.
Sus eventos son `payment_intent.succeeded` y `payment_intent.failed`; además de
firma y consulta, se comprueba `metadata.pagoscrPaymentId`. Nunca pases tarjetas
ni CVV a las herramientas MCP. [Contrato del checkout](specs/onvo-checkout.md).

| Problema           | Qué revisar                                                                   |
| ------------------ | ----------------------------------------------------------------------------- |
| TEST_MODE_REQUIRED | Llave secreta test; no publicable ni live.                                    |
| INVALID_SIGNATURE  | Bytes originales, secreto del endpoint, reloj y encabezado.                   |
| PAYMENT_NOT_FOUND  | Orden guardada y mismo almacén entre creación y evento.                       |
| PAYMENT_MISMATCH   | Orden/monto/moneda/metadata originales y estado consultado. No fuerces éxito. |
| GATEWAY_ERROR      | Disponibilidad de ONVO; conserva la referencia y reintenta la consulta.       |
