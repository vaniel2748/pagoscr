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
