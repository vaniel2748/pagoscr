# ONVO sin acceso a una cuenta

Integra un cobro ONVO de prueba en esta app usando la skill PagosCR en vendor/pagoscr/skills/pagoscr. Esta evaluación no tiene cuenta: usa exclusivamente fixtures sintéticos e inyección de fetch; bloquea cualquier petición de red. Conserva los fixtures, sin inventar contratos. Demuestra creación pendiente, confirmación con referencia de método tokenizado y procesamiento del evento firmado con consulta autenticada. npm test debe verificar la orden succeeded, un evento alterado y el rechazo de una llave live antes de red. No describas esto como una E2E real ni como Checkout hospedado.

Trabaja solo en este repositorio. No instales skills/plugins ni modifiques vendor o fixtures.
No leas entornos o credenciales del equipo. No hagas commits en el repositorio de PagosCR.
Informa archivos cambiados, pruebas ejecutadas y qué pago terminó confirmado.
