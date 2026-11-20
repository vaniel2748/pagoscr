# ONVO: integración de prueba

Fuentes oficiales: [autenticación](https://docs.onvopay.com/authentication),
[payment intents](https://docs.onvopay.com/payments/payment-intents),
[firma](https://docs.onvopay.com/webhooks/verify-signatures),
[eventos](https://docs.onvopay.com/webhooks/events),
[pruebas](https://docs.onvopay.com/payments/testing) y
[Checkout](https://docs.onvopay.com/checkout/one-time-links).

El adaptador PagosCR usa payment intents y host fijo de ONVO. La creación guarda
metadata.pagoscrPaymentId y devuelve pendiente, sin formulario hospedado. Tokeniza
con el SDK cliente de ONVO y una publishable key test; confirma la referencia del
método desde el servidor. Nunca lleves PAN o CVV reales al backend ni al agente.
El único envío de tarjeta del test E2E del proyecto usa la ficticia oficial y solo
se ejecuta con llave test validada y autorización explícita.

Si se necesita Checkout hospedado, usa su guía oficial para ese flujo; no supongas
que createCharge devuelve una URL de sesión ni mezcles eventos checkout_session
con el adaptador de payment intents sin implementar y probar ese contrato.

Recibe payment_intent.succeeded y payment_intent.failed. Verifica X-Onvo-Signature
sobre timestamp + punto + cuerpo crudo, con HMAC-SHA256, tolerancia de 300 segundos
y comparación constante contra cualquier v1 de la rotación. Después consulta la
intención por API: modo test, id, monto, moneda y metadata deben coincidir. Para
éxito exige succeeded y receivedAmount completo. No aceptes processing, un retorno
del navegador o una autorización sin captura como pago completado.

Deduplica por event.id, con persistencia. Respeta el plazo de respuesta de ONVO;
si procesas en segundo plano, persiste el trabajo antes de responder 2xx. Una API
no disponible no consume el evento ni cambia el pago a exitoso.

Llaves secretas solo del entorno. Si ya existe autorización para la prueba concreta,
no la vuelvas a pedir; valida el prefijo antes de cualquier petición. Los fixtures
del proyecto son sintéticos y no prueban recepción de un webhook real.
