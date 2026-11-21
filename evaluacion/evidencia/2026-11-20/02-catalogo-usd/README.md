# Catálogo USD: cobro demo

Ejecuta `npm start` para crear una orden de `kit-builder`, guardar el pago pendiente,
confirmarlo mediante `DemoAdapter` y repetir la misma notificación. La salida muestra
2000 centavos USD, estado `succeeded` y `duplicate: true` en la repetición.

Ejecuta `npm test` para comprobar captura exacta, conservación de USD, almacenamiento
del pendiente, rechazo del total y estado del cliente, creación concurrente y
deduplicación. No requiere red, credenciales ni instalación adicional.

`crearAppPagos()` en `app.mjs` es el servicio de backend: `crearOrden` recibe solo
`{ productoId }` y `crearCobro` solo `{ ordenId }`. El precio y envío se cargan de
`catalogo.json` en el servidor y se convierten mediante `parseMajorUnits`; `addCents`
los suma sin punto flotante. La moneda proviene del mismo catálogo.

El servidor guarda referencia propia, referencia demo, centavos, moneda y estado
pendiente antes de confirmar. `confirmarCobroDemo({ pagoId })` es una operación
interna de pruebas, sin ruta pública. Genera una notificación firmada y llama a
`processWebhook`, que verifica firma y confirmación del adaptador contra el pago
guardado. Solo su resultado `succeeded` marca el pago confirmado.

El almacenamiento y la deduplicación son en memoria y se pierden al reiniciar.
Esta app mínima es una demo ejecutable de backend, sin HTTP, autenticación ni
entrega de productos. Una app real necesita órdenes autorizadas y almacenamiento
persistente con aplicación atómica de eventos. No se probó ninguna pasarela real.
