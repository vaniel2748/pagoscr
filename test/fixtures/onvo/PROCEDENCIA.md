# Respuestas reales de checkout, anonimizadas

`checkout-session.real-created.json` y `checkout-session.real-open.json` provienen
de una llamada autorizada a ONVO **test**, el 21 de noviembre de 2026: creación
por POST /v1/checkout/sessions/one-time-link y consulta por
GET /v1/checkout/sessions/{id}. No son eventos de webhook.

El POST real omite `status` y `lineItems[].quantity`; el GET sí los devuelve.
El adaptador consulta la sesión antes de devolver el enlace para validar la orden
sin completar esos campos con valores supuestos.

Solo se conservan modo, estados, cantidad, ajuste de cantidad, importe, moneda y
tipo de precio. Referencias de sesión/intención y URL se reemplazaron por valores
ficticios consistentes. Se omitieron metadata, cuenta, clientes, datos de contacto,
direcciones, productos, fechas y llaves. Ningún cuerpo íntegro se guardó ni imprimió.

Fuentes: [creación](https://docs.onvopay.com/checkout/one-time-links) y
[consulta de sesión](https://docs.onvopay.com/api/obtener-una-sesion-de-checkout).

## Webhook real de un pago test

`event.checkout-real-succeeded.json` procede de un pago con tarjeta ficticia que
Vaniel completó en la plantilla. Se recibió el 21 de noviembre de 2026 a las
01:31:03, hora de Costa Rica (07:31:03 UTC), por un túnel temporal autorizado.

Antes de guardar la copia, `processWebhook` verificó el cuerpo crudo con
X-Onvo-Signature y el secreto externo; consultó sesión e intención vinculada,
modo test, monto, moneda y recepción completa. El receptor solo capturó el evento
tras la respuesta exitosa del servidor. La prueba de conexión fue un evento
distinto y no se usó como evidencia de un pago.

Se conservaron únicamente tipo, modo, estados, montos y moneda. Las referencias
de evento, sesión, intención y orden se reemplazaron por constantes ficticias;
no se guardaron cuenta, clientes, contactos, tarjetas, llaves ni firma original.
Al cambiar esos bytes, la firma original ya no corresponde al fixture. La
regresión lo firma con el secreto ficticio de las pruebas y confirma contra
respuestas API con las referencias anonimizadas correspondientes.

El túnel y su receptor se cerraron tras recibir el pago verificado.
