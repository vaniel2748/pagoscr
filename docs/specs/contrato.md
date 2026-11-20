# Especificación: batería compartida de adaptadores

`paymentProviderContract(nombre, fábrica)` se invoca sin duplicar casos desde la
prueba de cada adaptador. Cada fábrica inyecta respuestas de confirmación y genera
notificaciones sintéticas siguiendo el formato de su pasarela. Nunca usa red ni
credenciales reales. El modo demo también mantiene un registro independiente del
cuerpo recibido para confirmar sus pagos.

Los 17 casos por adaptador cubren creación pendiente, cuatro montos inválidos,
webhook válido, firma inválida y ausente, repetición, recepción simultánea, monto y
moneda alterados, JSON mal formado, API pendiente, importe distinto en la API,
API no disponible y fallo tardío. Se ejecutan con el mismo procesador y almacén
que expone el paquete. La aplicación del evento debe ser atómica y la verificación
no debe consumir el identificador del evento si la API falla.

El procesador tiene además pruebas con un puerto simulado: recupera exclusivamente
el contexto del servidor, vuelve a validar lo que devuelve el adaptador, deduplica
10 llamadas simultáneas, permite recuperar un intento fallido y conserva un éxito
ante notificaciones tardías. El almacén en memoria no es una base de datos para
producción.

La suite queda preparada en P0.4 y se vincula al adaptador demo en P0.5, a ONVO
en P0.6 y a Tilopay en P1.10. Preparar la suite no significa haber aprobado esos
adaptadores; la bitácora separa ambos estados.
