# Tarifas: unidades, fuentes y límites

La calculadora contesta cuánto costaría una operación con las cifras publicadas
guardadas en [data/tarifas.json](../data/tarifas.json). No consulta el tipo de cambio
ni reemplaza la cotización del comercio. Devuelve fuente, fecha y advertencias en
cada fila; las cifras incompletas no reciben un total ni una posición competitiva.

## Unidades exactas

| Dato                    | Unidad                        | Ejemplo                           |
| ----------------------- | ----------------------------- | --------------------------------- |
| monto                   | Centavos enteros de CRC o USD | 2000000 = ₡20000; 20000 = US$200. |
| porcentajePuntosBasicos | Puntos básicos enteros        | 425 = 4,25 %.                     |
| fijoUsdCentavos         | Centavos USD                  | 35 = US$0,35.                     |
| tipoCambio              | Céntimos CRC por US$1         | 50000 = ₡500/US$1, solo ejemplo.  |

Para CRC con cargos en USD, `tipoCambio` es obligatorio. Sin él, la herramienta
devuelve `EXCHANGE_RATE_REQUIRED` y pide el dato. No inventa un cambio ni toma una
cotización de red. Los cálculos intermedios usan bigint y redondean mitades hacia
arriba al centavo; rechazan fracciones number y resultados fuera del rango seguro.

Con monto 2000000, moneda CRC, método tarjeta y tipoCambio **50000 de ejemplo**:

| Pasarela | Porcentaje | Fijo convertido | Costo base | Neto estimado |
| -------- | ---------- | --------------- | ---------- | ------------- |
| ONVO     | ₡780,00    | ₡175,00         | ₡955,00    | ₡19045,00     |
| Tilopay  | ₡850,00    | ₡175,00         | ₡1025,00   | ₡18975,00     |

El ahorro base de este ejemplo es ₡70 por operación. No incluye otros cargos ni
condiciones particulares. La salida separa mensualidad, afiliación y liquidación
en `otrosCargosUsdCentavos`: no las prorratea entre ventas sin conocer su frecuencia.
Una condición no publicada queda null; eso no significa que sea gratis.

```ts
import { compararPasarelas } from 'pagoscr';

export const ejemplo = compararPasarelas({
  monto: 2_000_000,
  moneda: 'CRC',
  metodo: 'tarjeta',
  tipoCambio: 50_000,
});
```

La herramienta MCP usa los mismos argumentos y devuelve una tabla ordenada y
datos estructurados. Admite `tarjeta` y `sinpe_movil`, para CRC o USD. Para el
inicio rápido se compara USD sin convertir moneda ni suponer un cambio.

## Qué fuentes respaldan las filas

| Fila                                | Fuente y estado al 22 de noviembre de 2026                                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ONVO tarjeta · 3,9 % + US$0,35      | Vaniel confirmó la tarifa el 22 con una captura de la página oficial de Costa Rica. [Precios de ONVO](https://onvopay.com/pricing).                                                                                                        |
| ONVO SINPE Móvil · 1,5 %            | Confirmado en la misma captura.                                                                                                                                                                                                            |
| Tilopay tarjeta · 4,25 % + US$0,35  | Consulta directa del 22. [Tarifario oficial](https://tilopay.com/en/tarifas).                                                                                                                                                              |
| Tilopay SINPE Móvil · 2 % + US$0,35 | Misma fuente y fecha. La tarifa de liquidación queda sin confirmar.                                                                                                                                                                        |
| Tilopay + afiliación BAC            | Consulta directa del 22. Publica 1 % más los costos de BAC. El mínimo previo de US$0,30 y la comisión bancaria quedan por confirmar. [Oferta oficial](https://tilopay.com/bac).                                                            |
| BAC directo                         | El tarifario histórico que daba US$45/mes y US$200 de afiliación corresponde a Honduras. La URL primaria exacta está en el JSON. La fila se conserva como antecedente con país HN, verificado=false y estado no_aplicable para Costa Rica. |

Los US$3 por liquidación de ONVO se muestran aparte. El listado oficial indexado
y los términos publicados coinciden en ese cargo. [Términos de ONVO](https://onvopay.com/CR/documents/terminos_y_condiciones.pdf).

`verificadoEl` registra la verificación de la tarifa por transacción,
`revisadoEl` la consulta más reciente y `modalidadVerificacion` cómo se obtuvo la
evidencia. Las filas históricas conservan la fecha de su investigación y muestran
las condiciones pendientes.

## Actualizar sin perder trazabilidad

Abre la fuente oficial, contrasta país, método, porcentaje, fijo y cargos
adicionales. Cambia los enteros y las fechas únicamente con esa evidencia. Si no
se puede acceder o falta una condición, declara el límite; no rellenes el vacío
con un cálculo. Para una tarifa no verificada conserva verificado=false y explica
qué falta. No conviertas números de un país en cotizaciones para otro.

Ejecuta `npm run build && npm run tarifas:check` y las pruebas de calculadora.
El CI rechaza filas sin URL HTTPS/fecha válida, unidades no enteras, identificadores
duplicados y filas no verificadas sin advertencia. Registra fuente y cambio en
BITACORA.md.
