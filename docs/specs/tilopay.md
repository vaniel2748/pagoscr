# Especificación: Tilopay por retorno GET y consult

Vaniel eligió expresamente el retorno GET documentado con confirmación obligatoria
por `consult`. No se implementa ni se simula el webhook privado de processPayment.
El backend convierte los parámetros del retorno a un objeto JSON sin convertir
tipos ni admitir claves repetidas. Ese JSON es la entrada del puerto común; el
nombre `verifyWebhook` conserva compatibilidad, no cambia el origen del mensaje.

## Contratos oficiales revisados el 20 de noviembre de 2026

- [Login](https://tilopay.com/developers/api/autenticacion): apiuser y password;
  token con expires_in en segundos. No usar email ni asumir una duración fija.
- [processPayment](https://tilopay.com/developers/api/hosted-payment-page/process-payment):
  importe como texto decimal, datos de facturación completos, captura, referencia,
  redirección y plataforma. Tipo 100 devuelve URL alojada; aún no significa pagado.
- [consult](https://tilopay.com/developers/api/procesos-operativos/consult): key y
  orderNumber; tipo 200 y response con las transacciones, monto textual, moneda,
  captura, entorno y resultado. Se exige una única coincidencia completa.
- [Webhooks](https://tilopay.com/developers/api/webhooks): el esquema dedicado se
  obtiene de Soporte y no se presupone aquí.
- [OpenAPI](https://tilopay.com/developers/openapi.json).

## Verificación y dinero

El retorno proporciona order, tpt/tilopay-transaction, code, auth y OrderHash.
Ninguno demuestra por sí solo un pago. Se busca el monto del servidor y se
consulta la API autenticada. Un éxito exige code 1, captura Capture, tipo Payment,
entorno Test, referencia y cantidad exactas. El evento se identifica por tpt:code.
Si existen varias coincidencias o datos distintos, se rechaza. Se ignoran campos
informativos como description y cualquier instrucción incluida por un atacante.

Se conserva la verificación V2 de RestaurantPay como opción de compatibilidad,
basada en el plugin oficial [Tilopay 3.1.3](https://wordpress.org/plugins/tilopay/).
Se leyó el código publicado, sin instalarlo: `includes/WCTilopay.php`, método
`computed_customer_hash`, SHA-256 del archivo
`c1e057173bc4b75ebb4cb498a6b54eaa974e9367812a6720356615ad0c0e862f`.
Se activa por defecto y requiere el correo original de facturación de confianza.
El importe del hash siempre proviene del registro del servidor. La fórmula no es
un contrato público garantizado por Tilopay; para confirmarlo debe acudirse a
Soporte. `requireOrderHash: false` permite solo consulta autenticada, explícitamente;
nunca habilita aceptar el estado del navegador sin consultar.

Todos los formatos y conversiones de dinero usan bigint/texto. Se envían strings
para los campos que así define OpenAPI. No se usan importes decimales number ni
datos de tarjeta. El host es fijo HTTPS, sin redirecciones, con timeout. El token
se renueva según expires_in, con margen, y se invalida ante rechazo de autenticación.

## Alcance de prueba

La instancia exige `testMode: true`, confirmación del operador de que activó prueba
en el panel; el prefijo de la llave no permite distinguirlo. Esto no verifica el
panel remotamente antes de crear una URL. `consult` debe devolver Test para aceptar
un resultado. Por esa limitación, crear_cobro_de_prueba del MCP sigue excluyendo
Tilopay. No se usan credenciales reales ni se ejecuta una E2E Tilopay.

La misma batería de 17 casos corre con hash V2 activo. La fábrica elimina la firma
del cuerpo para probar ausencia de autenticación; no inventa un encabezado propio.
Alterar monto/moneda invalida el hash ligado al contexto, y la suite admite ese
rechazo o discrepancia monetaria según el mecanismo real de cada proveedor.
Casos adicionales cubren retorno GET, consulta sin hash opcional, entorno,
captura, transacción, ambigüedad, token, datos de comprador y URL alojada.

`lookupCapturedPayment(registroDelServidor)` conserva el camino de recuperación
de RestaurantPay: consulta una captura aunque no llegue el retorno del navegador.
Solo acepta una captura Test con la orden, monto y moneda esperados; devuelve un
evento confirmado o null. Usa el mismo id tpt:1 del retorno para deduplicar ambos
caminos mediante `PaymentStore.applyVerifiedEvent`. No devuelve un éxito ante
una autorización pendiente, un reembolso, producción o múltiples capturas.
