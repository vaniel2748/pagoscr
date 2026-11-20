# Especificación: adaptador demo

El adaptador demo no usa red, variables de entorno ni credenciales externas.
Valida la entrada del servidor y crea un identificador aleatorio pendiente. Mantiene
un registro de confirmación independiente del webhook. Cada instancia genera su
propio secreto efímero para firmar las notificaciones simuladas con HMAC-SHA256.

`simulatePayment(id, estado)` es una operación del servidor para pruebas: cambia
el estado simulado y devuelve el cuerpo crudo y su firma. No es un endpoint público.
El sobre incluye modo demo y referencia de evento. La firma cubre marca de tiempo
en segundos + punto + cuerpo crudo; la tolerancia es de cinco minutos y se compara
en tiempo constante. La firma de demo es un contrato propio, no de una pasarela.

La verificación exige firma, formato, modo, referencia, importe, moneda y estado
coherentes con el registro del servidor y con la confirmación simulada. Nunca
acepta el estado del cuerpo como única prueba del pago. La consulta de confirmación
y el reloj se pueden inyectar para pruebas sin red.

Errores: entrada inválida, firma inválida o caducada, webhook mal formado, datos
alterados y confirmación no disponible. No expone secretos ni cuerpos originales
en mensajes de error. La batería compartida se complementa con el recorrido real
de creación → simulación → verificación → deduplicación y casos de firma cruda.
