# Especificación: tarifas y comparación

El archivo `data/tarifas.json` conserva las seis filas del plan: tarjeta y SINPE
Móvil de ONVO/Tilopay, Tilopay con afiliación BAC y el antecedente BAC directo.
Cada fila tiene URL HTTPS, fecha de verificación, fecha de revisión, estado de
verificación, país y advertencias. Importes USD en centavos y porcentajes en
puntos básicos; `null` significa dato desconocido. El validador rechaza fuentes o
fechas ausentes, fechas inválidas, duplicados, decimales y valores fuera de rango.

`compararPasarelas({ monto, moneda, metodo, tipoCambio? })` recibe centavos y
devuelve costos por transacción ordenados, neto, desglose, fuente, fecha y
advertencias. `tipoCambio` es un entero en céntimos CRC por US$1: `50000` significa
₡500/US$1. No hay valor por defecto. Si hace falta convertir un cargo fijo y no
se indicó el tipo, devuelve `EXCHANGE_RATE_REQUIRED` con instrucciones.

El costo base es porcentaje redondeado al centavo más próximo (mitades hacia
arriba) más cargo fijo; un mínimo, si existe, se aplica al costo total. Todos los
productos, sumas, restas y conversiones monetarias usan enteros/bigint. El neto
puede ser negativo cuando el cargo fijo supera el monto consultado. Los costos
mensuales, de afiliación y por liquidación se muestran en USD y no se reparten
arbitrariamente entre ventas. No se agregan impuestos o retenciones no especificados.

Una fila no verificada, con costos negociados o de otro país no recibe un costo
total ni participa en la clasificación numérica: aparece al final con su motivo.
El antecedente US$45/mes y US$200 de BAC corresponde a Honduras según BAC; se
conserva expresamente como no aplicable a Costa Rica. El 1% de Tilopay/BAC sí
tiene fuente oficial, pero el mínimo de US$0,30 no está corroborado y falta la
comisión bancaria; la fila completa permanece no verificada.

Las tarifas Tilopay se revisaron directamente el 20 de noviembre. ONVO bloquea
el acceso directo automatizado con 403; su página oficial indexada coincide con
los valores suministrados por Vaniel. Se conserva `verificadoEl: 2026-11-11` y
se declara la revisión indirecta del 20. No se presenta como una comprobación
directa nueva. La revisión final del domingo sigue pendiente.

Pruebas: ₡20000 con tipo explícito; USD sin conversión; SINPE; tipo ausente o
inválido; fuentes y fechas obligatorias; exclusión de filas no comparables;
redondeo, límites y neto negativo. El CI ejecuta además el validador de datos.
