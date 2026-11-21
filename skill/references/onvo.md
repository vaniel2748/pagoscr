# ONVO: integración de prueba

Fuentes oficiales: [autenticación](https://docs.onvopay.com/authentication),
[payment intents](https://docs.onvopay.com/payments/payment-intents),
[firma](https://docs.onvopay.com/webhooks/verify-signatures),
[eventos](https://docs.onvopay.com/webhooks/events),
[pruebas](https://docs.onvopay.com/payments/testing) y
[Checkout](https://docs.onvopay.com/checkout/one-time-links).

La plantilla y el MCP usan checkout alojado con host fijo de ONVO.
`OnvoAdapter({ checkout: true })` crea POST /v1/checkout/sessions/one-time-link,
guarda metadata.pagoscrPaymentId y devuelve pendiente con clientAction.url.
Guarda la orden y la referencia de sesión antes de abrir ese enlace. La tarjeta
se introduce en ONVO; no hay llave publicable ni tarjeta en la plantilla.

`getTestCheckoutPayment(ordenGuardada)` consulta sesión e intención vinculada:
complete/paid, test, cantidad fija, importe, moneda, succeeded y receivedAmount
completo. No presupone metadata heredada. El retorno del navegador no confirma.
`checkout_session.succeeded` pasa por firma y ambas consultas con processWebhook.

Sin checkout:true se conserva el flujo de intenciones y SDK: creación sin URL,
confirmTestCharge con un método tokenizado y getTestPayment. Sus eventos son
payment_intent.succeeded y payment_intent.failed y su metadata debe coincidir.

Verifica X-Onvo-Signature
sobre timestamp + punto + cuerpo crudo, con HMAC-SHA256, tolerancia de 300 segundos
y comparación constante contra cualquier v1 de la rotación. Después consulta la
sesión/intención por API según el flujo: modo test, id, monto y moneda deben coincidir. Para
éxito exige succeeded y receivedAmount completo. No aceptes processing, un retorno
del navegador o una autorización sin captura como pago completado.

Deduplica por event.id, con persistencia. Respeta el plazo de respuesta de ONVO;
si procesas en segundo plano, persiste el trabajo antes de responder 2xx. Una API
no disponible no consume el evento ni cambia el pago a exitoso.

Llaves secretas solo del entorno. Si ya existe autorización para la prueba concreta,
no la vuelvas a pedir; valida el prefijo antes de cualquier petición. Los fixtures
del proyecto son sintéticos y no prueban recepción de un webhook real.
