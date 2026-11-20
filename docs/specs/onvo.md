# Especificación: adaptador ONVO de prueba

## Contrato consultado el 20 de noviembre de 2026

Fuentes oficiales: [autenticación](https://docs.onvopay.com/authentication),
[intenciones de pago](https://docs.onvopay.com/payments/payment-intents),
[firmas](https://docs.onvopay.com/webhooks/verify-signatures),
[eventos](https://docs.onvopay.com/webhooks/events),
[pruebas](https://docs.onvopay.com/payments/testing) y
[OpenAPI](https://docs.onvopay.com/openapi.yaml). También se leyeron las guías de
[Checkout](https://docs.onvopay.com/checkout/overview) y
[enlaces de un solo uso](https://docs.onvopay.com/checkout/one-time-links).

## Entradas, salidas y confirmación

`OnvoAdapter` usa payment intents: crea una intención con monto entero, moneda,
descripción y `metadata.pagoscrPaymentId`. Devuelve una referencia pendiente; no
incluye un checkout hospedado. La app debe recoger un método tokenizado mediante
el SDK cliente o usar Checkout en su flujo de UI posterior. El adaptador nunca
recibe datos de tarjeta. No se interpreta la creación como un pago completado.

Solo acepta llaves secretas con prefijo de prueba. Usa el host fijo de ONVO,
Bearer, HTTPS, rechazo de redirecciones y timeout. `confirmTestCharge` recibe
exclusivamente la referencia de un método tokenizado. `getTestPayment` consulta
la intención y devuelve únicamente referencia, monto, moneda y estado normalizado.

El webhook conserva bytes crudos. Se exige `X-Onvo-Signature`, una marca de tiempo,
HMAC-SHA256 y coincidencia en tiempo constante con alguna firma v1; tolerancia de
300 segundos. El sobre debe estar en modo test. Solo se admiten los eventos
`payment_intent.succeeded` y `payment_intent.failed`. Se contrasta referencia,
importe y moneda del evento con el registro del servidor. Después se consulta la
intención autenticada y se vuelve a contrastar todo, incluido el metadato de la
orden. Un éxito requiere estado succeeded y el monto recibido completo.

## Errores y pruebas

Errores controlados, sin cuerpos ni secretos: llave inadecuada, firma inválida,
evento no admitido, JSON inválido, datos que no coinciden y API no disponible.
No se reintentan automáticamente creaciones de cobro. La app debe guardar una
intención por orden y evitar creaciones simultáneas desde su base de datos.

La batería compartida usa fixtures sintéticos derivados del contrato oficial;
no se presentan como respuestas grabadas de una cuenta real. Los tests adicionales
comprueban autenticación, bytes crudos, rotación de firmas, modo y errores seguros.
La prueba de red separada crea un método de prueba documentado, crea/confirma una
intención y consulta el resultado; se omite sin `ONVO_TEST_SECRET_KEY`. Requiere
autorización de Vaniel antes de cargar variables o ejecutarla. No recibe un webhook
real: la entrega de webhooks sigue cubierta por fixtures hasta configurar un endpoint.
