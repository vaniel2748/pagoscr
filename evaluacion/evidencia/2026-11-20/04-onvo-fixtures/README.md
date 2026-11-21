# Cobro ONVO con fixtures

```sh
npm test
npm start
```

No requiere instalación adicional, cuenta, variables de entorno ni acceso a red.
Usa el paquete local y la configuración ficticia de `fixtures/`. El transporte
inyectado devuelve los archivos originales y rechaza cualquier otra operación;
el fetch predeterminado de la app y el global del ejecutable bloquean la red.

La orden del servidor `order_contract`, del usuario sintético `builder_fixture`,
cuesta 2 000 000 centavos CRC según `catalogo.json`. El cliente solo proporciona
referencias; la app rechaza campos de monto o estado y verifica pertenencia.
La creación guarda `pi_fixture_001` como `pending`. La confirmación envía
únicamente la referencia ficticia `pm_fixture_tokenizado` y conserva `pending`.
Finalmente se firma el cuerpo original del evento sintético con HMAC-SHA256 y
un reloj fijo al fixture. PagosCR verifica los bytes, consulta con autenticación
inyectada y aplica `succeeded` solo si coinciden orden, monto, moneda y captura.
Una repetición válida devuelve `duplicate: true`.

Las pruebas incluyen evento alterado, monto alterado con firma válida, captura
incompleta, consulta fallida y reintento, prefijos live/publicable rechazados antes
del transporte, creaciones simultáneas y bloqueo de red. Ninguna salida muestra
la configuración de firma o de autenticación.

Es una integración local de **payment intents con fixtures sintéticos**. No es
una E2E real ni Checkout hospedado; no valida llaves, tokenización mediante SDK,
cuenta ONVO o recepción de un webhook externo. La referencia del método y el evento
son ficticios. El almacén y la identidad son de evaluación en memoria; una app real
necesita sesiones autenticadas y persistencia transaccional de órdenes/eventos.
Una creación incierta queda bloqueada para reconciliación, sin reintentos ciegos.
