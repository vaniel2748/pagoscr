# Tilopay: retorno GET más consult

Fuentes oficiales: [login](https://tilopay.com/developers/api/autenticacion),
[formulario alojado](https://tilopay.com/developers/api/hosted-payment-page/process-payment),
[consult](https://tilopay.com/developers/api/procesos-operativos/consult),
[webhooks](https://tilopay.com/developers/api/webhooks) y
[pruebas](https://tilopay.com/developers/tarjetas-de-prueba).

Vaniel eligió el retorno GET documentado y confirmación obligatoria por consult.
No se implementa el webhook privado de processPayment, cuyo esquema se pide a
Soporte. No presentes un fixture de retorno como prueba de ese webhook.

El login usa apiuser/password; expires_in decide la caché. Crear la URL necesita
todos los datos de facturación del servidor, importe decimal textual y capture 1.
Una URL creada devuelve pendiente. No inventes datos de comprador ni copies los
valores ficticios de los fixtures a un comercio real.

Recibe order, tpt/tilopay-transaction, code, auth y OrderHash en el GET. Usa
normalizeTilopayReturn para descartar campos informativos y rechazar duplicados.
El hash V2 opcional se derivó del plugin oficial WooCommerce 3.1.3 y está activo
por defecto; no es un algoritmo públicamente garantizado por el portal. Necesita
el correo original de facturación de confianza, no uno que mande el retorno.
Configura la instancia con los datos originales de esa orden/comprador. No desactives
el hash automáticamente por un fallo: revisa correo, formato y contrato con Soporte.
requireOrderHash false es una selección explícita de solo consult; la consulta
autenticada continúa siendo obligatoria y el cuerpo nunca decide el resultado.

La API debe devolver una única transacción con orden y tpt coincidentes, monto
textual exacto, moneda, code, auth, tipo Payment y, para éxito, captura Capture.
Exige environment Test. El código 1 del navegador por sí solo no permite entregar.

Si no vuelve el navegador, lookupCapturedPayment consulta desde el servidor y
recupera solo una captura Test que coincide con el registro original. Aplica su
evento en el almacén atómico; usa el mismo tpt:code para deduplicar con el retorno.

Una sola cuenta/host sirve para prueba y producción. testMode true y
TILOPAY_TEST_MODE=true confirman la elección local del operador, no verifican el
panel remotamente antes de crear una URL. Por eso la creación MCP excluye Tilopay.
No uses credenciales sin autorización ni afirmes una E2E Tilopay: hasta ahora su
validación en PagosCR es exclusivamente con fixtures.
