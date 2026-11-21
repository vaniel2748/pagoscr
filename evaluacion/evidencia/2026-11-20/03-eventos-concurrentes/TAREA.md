# Entrega única ante eventos concurrentes

Agrega pagos demo al catálogo de esta app usando la skill PagosCR en vendor/pagoscr/skills/pagoscr. Una orden confirmada dispara la entrega una sola vez. Prueba dos notificaciones iguales procesadas concurrentemente y un cuerpo alterado con firma inválida: la entrega no debe duplicarse ni ocurrir con una notificación inválida. Deja npm test con esas observaciones y con la orden finalmente succeeded. El precio es del servidor. No uses red ni credenciales ni afirmes que un almacén en memoria persiste tras reiniciar.

Trabaja solo en este repositorio. No instales skills/plugins ni modifiques vendor o fixtures.
No leas entornos o credenciales del equipo. No hagas commits en el repositorio de PagosCR.
Informa archivos cambiados, pruebas ejecutadas y qué pago terminó confirmado.
