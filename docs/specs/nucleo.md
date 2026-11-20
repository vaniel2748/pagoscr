# Especificación: núcleo de pago

## Entradas y salidas

El servidor construye `CreateChargeInput` desde su catálogo u orden persistida:
referencia propia, centavos, CRC o USD y descripción. El puerto devuelve una
referencia de la pasarela, estado pendiente y una acción de cliente. El navegador
solo conoce referencias y acciones; no determina el monto ni el estado.

`PaymentProvider` crea cobros y verifica webhooks contra un `PaymentRecord` de
confianza. Extraer una referencia de un webhook solo sirve para buscar ese registro;
no autentica el evento. La verificación del adaptador debe comprobar firma, cuando
exista, y confirmar estado, importe y moneda contra la API antes de devolver éxito.

`processWebhook` carga el registro desde `PaymentStore`, verifica con el adaptador,
contrasta los datos normalizados y aplica el evento atómicamente en el almacén.
Deduplica por pasarela + evento. Un evento inválido no consume la referencia de
idempotencia. Un pago exitoso no puede volver a fallido por un evento tardío.

## Dinero

Entradas y salidas monetarias: `number` entero seguro no negativo (positivo para
cobrar). Aritmética intermedia: `bigint`; conversión a `number` solo dentro del
rango seguro. Porcentajes en puntos básicos; redondeo al centavo más próximo con
mitades hacia arriba. Conversiones y formatos decimales usan texto y enteros.
`tipoCambio` representa céntimos de CRC por USD: `50000` equivale a ₡500/US$1.
Nunca se obtiene un tipo de cambio implícito.

## Errores y límites

Errores con código estable y mensaje seguro en español. Se rechazan NaN,
infinitos, decimales, negativos, desbordamientos, otras monedas, referencias vacías
y descripciones de más de 500 caracteres. El núcleo no importa dependencias,
Node.js, NestJS ni Prisma. El almacén en memoria es para pruebas y demo: una app
real debe persistir pagos y eventos con unicidad y transacción en su base de datos.

## Verificación

Pruebas antes de implementación: límites, sumas y porcentajes con operandos
grandes, redondeo, lectura/escritura de unidades mayores sin coma flotante,
conversión explícita de USD a CRC y validación del contrato del servidor.
