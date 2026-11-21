# Checkout demo de Kit Builder

Usa el paquete local PagosCR, sin credenciales ni servicios externos. El servidor
convierte `precioTexto` y `envioTexto` del catálogo con `parseMajorUnits` y los suma
con `addCents`: Kit Builder cuesta `2000000` centavos CRC (₡20 000,00).

```sh
npm test
npm run demo
```

Ambos comandos funcionan sin red. `npm run demo` imprime la orden `pending` y
la misma referencia consultada desde el almacén como `succeeded`. La simulación
genera una notificación con firma efímera; solo `processWebhook` verifica la firma,
corrobora la confirmación demo y actualiza el registro. Repetir el mismo evento
devuelve `duplicate: true`.

Para abrir la página local, ejecuta `npm start` y visita `http://127.0.0.1:3000`.
El navegador únicamente envía `{ "productoId": "kit-builder" }` a
`POST /api/ordenes`. Los campos adicionales, incluidos monto, moneda y estado,
se rechazan. El servidor devuelve `pending`, simula internamente la notificación
firmada y la página consulta `GET /api/ordenes/:id` hasta observar `succeeded`.
No existe una ruta para pedir firmas o forzar estados. `POST /webhooks/demo`
conserva el cuerpo crudo y exige la firma del adaptador.

Las pruebas ejecutan el handler HTTP con streams en memoria; no abren sockets.
Cubren el éxito, la repetición, clientes que alteran monto/moneda/estado, firma
inválida, cuerpo modificado, JSON inválido y una orden inexistente. El navegador
no se automatizó durante esta evaluación sin red.

El almacenamiento elegido es `InMemoryPaymentStore`, acompañado de un mapa de
referencias de órdenes y del estado demo del adaptador. Todo se pierde al reiniciar
el proceso; cada proceso tiene datos y secreto demo independientes. La deduplicación
solo funciona durante la vida de esa instancia. Esta app es exclusivamente demo:
una integración real necesita órdenes, pagos y eventos persistentes, restricciones
de unicidad y una transacción para aplicar el evento y sus efectos una sola vez,
además de autorización de acceso por usuario. No se verificó ninguna pasarela real.
