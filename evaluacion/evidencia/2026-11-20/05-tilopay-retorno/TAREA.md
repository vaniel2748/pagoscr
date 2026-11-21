# Tilopay: retorno GET y consult

Integra Tilopay en esta app usando la skill PagosCR en vendor/pagoscr/skills/pagoscr, únicamente con fixtures y fetch inyectado; ninguna petición de red. El operador ficticio ya eligió el retorno GET documentado más consult obligatorio y el hash V2 por defecto. Usa la facturación original sintética y el retorno de fixtures. Demuestra creación pendiente y confirmación consultada, rechazo de firma inválida y de una consulta con monto o entorno distintos. Deja npm test. Conserva los fixtures. No inventes el webhook privado ni afirmes una E2E de cuenta real.

Trabaja solo en este repositorio. No instales skills/plugins ni modifiques vendor o fixtures.
No leas entornos o credenciales del equipo. No hagas commits en el repositorio de PagosCR.
Informa archivos cambiados, pruebas ejecutadas y qué pago terminó confirmado.
