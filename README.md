# PagosCR

Cobros de prueba y comparación de pasarelas para builders en Costa Rica.

Construido por Vaniel González con Codex durante el Dojo AI Hackathon,
del 20 al 22 de noviembre de 2026. Planificación previa con Claude Code.

En construcción. El inicio rápido ejecutable se incorpora en P0.9.
Todavía no se ha publicado el paquete ni creado un repositorio remoto.

Estado: importación, harness, núcleo y demo terminados (P0.1–5). ONVO pasa
el contrato con fixtures y su prueba de API en modo test fue autorizada y aprobada
el 20 de noviembre de 2026 (P0.6).
La calculadora y las cuatro herramientas MCP están implementadas (P0.7–8).
El inicio rápido ejecutable sigue pendiente (P0.9).

Requiere Node.js 22.12 o superior; se desarrolla y verifica con Node.js 24.

```sh
npm ci --ignore-scripts
npm run check
npm run hooks:install
```

`npm run check` ejecuta formato, tipos, pruebas sin red, búsqueda de secretos
y compilación. `prior-work/` conserva los tres archivos originales sin cambios;
queda fuera de la compilación y del formato, pero sí se revisa por secretos.

Licencia MIT. Consulta `ESTADO-INICIAL.md` y `BITACORA.md` para la procedencia.

## ONVO: prueba de API, con autorización

El adaptador usa payment intents. Crear un cobro devuelve una intención pendiente,
sin checkout hospedado. `confirmTestCharge` recibe un método tokenizado y
`getTestPayment` consulta el resultado. El estado de una orden se actualiza mediante
`processWebhook`, que verifica firma y confirma el pago con ONVO.

Prueba de API autorizada el 20 de noviembre de 2026: **1 aprobada**, creación,
confirmación y consulta de ₡20000 ficticios. La recepción de un webhook real
sigue sin probarse.

Los tests normales usan respuestas sintéticas basadas en la documentación oficial;
no acceden a variables ni a la red de ONVO. La prueba E2E está separada, exige una
llave secreta test y `PAGOSCR_RUN_ONVO_E2E=1`. Crea y confirma una transacción
ficticia de ₡20000. Cubre API y consulta; no recibe un webhook real.

Solo después de la autorización de Vaniel, desde esta carpeta:

```sh
PAGOSCR_RUN_ONVO_E2E=1 node --env-file=../.env.onvo ./node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
```

Las llaves permanecen en el archivo externo o en variables de entorno. Nunca se
copian a este repositorio ni se imprimen. Sin autorización se puede comprobar
únicamente la omisión segura con `npm run test:e2e`, sin cargar el archivo externo.

Referencias oficiales y alcance: [especificación ONVO](docs/specs/onvo.md).
