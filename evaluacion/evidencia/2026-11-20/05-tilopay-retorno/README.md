# Tilopay: retorno GET y consult con fixtures

```sh
npm test
npm start
```

El paquete PagosCR ya está disponible localmente. No se instalan componentes ni
se carga configuración del equipo. `npm start` crea la orden sintética
`order_contract` en `pending`, procesa el retorno original mediante el hash V2
predeterminado y confirma la captura con la respuesta `consult` del fixture.
El estado observado termina en `succeeded`; una repetición devuelve
`duplicate: true`. Todas las operaciones son simuladas: ninguna visita la URL de
pago ni hace una petición de red.

`crearAppTilopay` exige un `fetchImpl` inyectado. `tilopay-fixtures.mjs` responde
solo a login, processPayment y consult; cualquier ruta distinta falla sin red.
La configuración y facturación originales se cargan de
`fixtures/config-sintetica.json`, exclusivamente para esta demostración.

El backend calcula el importe desde `catalogo.json` con `parseMajorUnits` y
`addCents`. Guarda su orden, referencia Tilopay, centavos enteros, moneda y estado.
Su handler `manejarSolicitud` recibe objetos Request y devuelve Response, sin
abrir un servidor:

- `POST /cobros` acepta únicamente `{ "ordenId": "order_contract" }`.
- `GET /retorno?...` normaliza los campos documentados del retorno. Los campos
  informativos, incluido cualquier monto o correo recibido, no deciden el pago.

Crear la URL conserva `pending`. El éxito exige firma válida con el correo
original del servidor y consult coincidente en orden, transacción, monto, moneda,
código y autorización, con tipo Payment, captura Capture y entorno Test. El
almacén aplica el evento atómicamente y reconoce los duplicados después de
verificar de nuevo. Las creaciones concurrentes comparten una promesa; un intento
incierto bloquea nuevas creaciones y exige reconciliación antes de reintentar.

Las pruebas incluyen firma incorrecta y ausente, monto/entorno/moneda/autorización
distintos en consult, falta de captura, parámetros duplicados y repetición. Las
variantes se hacen en copias en memoria; los fixtures se conservan intactos.

Esto valida el retorno GET documentado con fixtures. No implementa el webhook
privado de processPayment ni prueba una cuenta real de Tilopay. El hash V2 proviene
del plugin oficial WooCommerce según la referencia local de PagosCR; no se
desactiva cuando falla. `testMode: true` es la elección ficticia del operador, no
una comprobación remota del panel. El almacén y el bloqueo están en memoria y se
pierden al reiniciar; una app real necesita autenticación de la orden y un almacén
persistente con transacciones y unicidad para pago, evento y efectos de entrega.
