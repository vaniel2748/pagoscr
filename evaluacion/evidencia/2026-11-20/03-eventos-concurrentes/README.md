# Catálogo con cobros demo

Ejecuta `npm test` para probar la integración y `npm start` para observar una orden
del Kit Builder confirmada como `succeeded`, dos notificaciones concurrentes y una
sola entrega. La dependencia PagosCR ya está disponible localmente; no se necesita
red, instalación ni credenciales.

`crearAppDemo()` en `app.mjs` ofrece estas operaciones del backend:

- `crearOrden({ productoId })`: obtiene precio, envío y moneda de `catalogo.json`,
  convierte texto a centavos con PagosCR y crea un cobro demo pendiente. Rechaza
  campos adicionales como monto o estado enviados por el cliente.
- `simularPago(ordenId, estado?)`: función exclusiva del servidor de prueba. Actualiza
  la confirmación demo independiente y genera una notificación firmada. No es un
  endpoint público.
- `recibirNotificacion({ rawBody, headers })`: entrega los bytes originales a
  `processWebhook`; verifica firma y confirmación antes de aplicar el evento.
- `consultarOrden(ordenId)` y `listarEntregas()`: permiten observar el estado y el
  acceso entregado al producto sin modificar los registros internos.

El almacén implementa `PaymentStore`: aplica evento, estado y entrega sin esperas
en la sección crítica del mismo proceso. Deduplica eventos y conserva una entrega
por orden incluso ante eventos distintos. Un fallo tardío conserva un éxito previo.
La entrega demo es un registro de acceso al Kit Builder, sin servicios externos.

Las pruebas alteran el monto manteniendo la firma original, comprueban el rechazo
antes y después del éxito y procesan las dos copias válidas mediante `Promise.all`.
La salida de `npm test` identifica el pago confirmado, su referencia demo, estado,
monto, duplicado y número de entregas.

Todo se guarda **en memoria y se pierde al reiniciar**, incluido el secreto demo.
Esta garantía de concurrencia solo cubre una instancia en ejecución. Una app real
necesita almacenamiento persistente con una transacción, unicidad de evento y
orden, y una salida transaccional con consumidor idempotente para entregas externas.
Aquí no se prueban pasarelas reales, red, credenciales, HTTP ni reinicios persistentes.
