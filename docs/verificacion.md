# Pruebas, mediciones y límites comprobados

## Control completo

```sh
npm run check
npm run hooks:install
```

El mismo control corre antes de cada commit y en GitHub Actions:

| Control                       | Evidencia                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| Formato y TypeScript estricto | Prettier y tsc sin errores.                                                        |
| Pruebas locales               | 315 casos, incluidas las respuestas ONVO reales anonimizadas.                      |
| Contrato compartido           | 17 casos por adaptador: demo, ONVO y Tilopay; 51 dentro de las 315 pruebas.        |
| Secretos                      | Secretlint y revisión de prefijos de pasarelas; nunca imprimen el valor detectado. |
| Compilación y tarifas         | Paquete, plugins y filas con fuente, fecha y unidades válidas.                     |
| Inicio rápido                 | MCP real por stdio: diagnóstico, comparación, demo confirmado y aviso repetido.    |
| Plugins aislados              | Ambos paquetes arrancan sin depender del checkout ni node_modules externos.        |
| Evaluación reproducida        | 45 pruebas de cinco apps conservadas, con hashes de la evidencia original.         |

El CI usa fixtures y demo, sin llaves ni API de pasarelas. La reproducción de las
apps evaluadas no ejecuta una nueva sesión de agente. [Evaluación completa](evaluacion.md).

## Pruebas ONVO contra la API

El 21 de noviembre de 2026 pasaron las dos E2E reales de modo test: intenciones
y checkout alojado, con ₡20000 ficticios por caso, en 5,57 segundos en total.
El POST de checkout omite campos que sí devuelve el GET; esa diferencia quedó
cubierta con [fixtures reales anonimizados y su procedencia](../test/fixtures/onvo/PROCEDENCIA.md).

El 21 de noviembre Vaniel aceptó la pantalla alojada: pagó con tarjeta ficticia,
vio «Pago confirmado» y comprobó la misma referencia tras recargar. Aportó una
captura de éxito en ONVO test. A las 01:31 de Costa Rica se recibió
un webhook real de checkout test, verificado con firma y consultas API antes de
guardar su copia anonimizada. El CI vuelve a firmar ese fixture modificado con
claves ficticias. El túnel temporal se cerró al completar la recepción.
Tilopay usa fixtures de su retorno documentado y consult; no se ha hecho E2E ni
se ha supuesto el contrato de su webhook privado.

Las pruebas de red requieren opt-in y permiso para las llaves. Desde el checkout:

```sh
PAGOSCR_RUN_ONVO_E2E=1 node --env-file=../.env.onvo ./node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
```

El archivo permanece fuera del repositorio. Sin llave u opt-in, ambas pruebas se
omiten. [Recorrido y verificaciones ONVO](onvo.md).

## Mediciones conservadas

| Fecha      | Recorrido                  | Resultado y entorno                                                                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-20 | Inicio rápido completo     | 6,35 s desde copia sin dependencias/dist y con caché npm vacía; incluye descarga, compilación y demo.                                 |
| 2026-11-20 | API ONVO, intención        | 2,33 s; creación, confirmación y consulta con tarjeta ficticia oficial.                                                               |
| 2026-11-21 | API ONVO, dos E2E          | 5,57 s; intención y sesión alojada.                                                                                                   |
| 2026-11-21 | Checkout público en Chrome | 1280 y 390 px: demo/ONVO sintético, enlace en otra pestaña, confirmación y misma orden al recargar; sin errores JS ni desbordamiento. |

Son mediciones del equipo de desarrollo. Los tiempos, reintentos por cuota y
código del ensayo independiente se detallan en [evaluacion.md](evaluacion.md).
La [bitácora](../BITACORA.md) conserva los bloques y decisiones de cada verificación.
