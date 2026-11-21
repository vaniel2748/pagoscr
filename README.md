# PagosCR

[![CI](https://github.com/vaniel2748/pagoscr/actions/workflows/ci.yml/badge.svg)](https://github.com/vaniel2748/pagoscr/actions/workflows/ci.yml)

Agrega cobros de prueba en Costa Rica y compara costos de pasarelas con fuente y
fecha. Un paquete TypeScript, cuatro herramientas MCP y un demo sin credenciales.

Hecho por Vaniel González con Codex durante el Dojo AI Hackathon del 20 al 22 de
noviembre de 2026. Planificación previa con Claude Code. Licencia MIT.

## Primer cobro en menos de cinco minutos

Requiere Node.js **22.12 o superior** y npm. Desde el checkout de este repositorio:

```sh
./scripts/quickstart.sh
```

Ese comando instala dependencias locales desde el lockfile, compila y abre un
cliente MCP contra el servidor real por stdio. Descubre las cuatro herramientas,
compara costos, crea ₡20000 ficticios, verifica el webhook firmado y detecta su
repetición. No necesita cuenta, llaves ni otro servicio. Imprime el tiempo total.

Medición del 20 de noviembre de 2026 en el equipo de desarrollo: **6 segundos**
desde una copia sin node_modules ni dist y con caché npm vacía, incluida descarga,
compilación y demo. Es una medición local, no una garantía para cualquier conexión.

El diagnóstico de ONVO aparecerá sin configurar: es lo esperado para este demo.
Los cobros y eventos del MCP se guardan en memoria; reiniciar pierde esas
referencias. Conecta un `PaymentStore` persistente al usarlo desde otra app.

## Qué puede hacer el agente

| Herramienta                | Resultado                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `comparar_pasarelas`       | Tabla ordenada de costos base, fuente, fechas y advertencias.                               |
| `crear_cobro_de_prueba`    | Cobro pendiente demo u ONVO test. En demo devuelve una notificación firmada para verificar. |
| `verificar_webhook`        | Firma válida, confirmación contra la pasarela, integridad del monto y deduplicación.        |
| `diagnosticar_integracion` | Presencia y modo de variables, problemas y correcciones; ningún valor secreto.              |

Todos los montos son **centavos enteros**: `2000000` representa ₡20000. El tipo de
cambio también es entero: `50000` céntimos CRC por dólar representa ₡500/US$1.
Debes proporcionar tu propio tipo de cambio; el ejemplo siguiente no es una
cotización de mercado:

```json
{
  "monto": 2000000,
  "moneda": "CRC",
  "metodo": "tarjeta",
  "tipoCambio": 50000
}
```

Con esos datos, el costo base calculado es ₡955 para ONVO y ₡1025 para Tilopay.
Las fuentes están en [data/tarifas.json](data/tarifas.json). Mensualidad, afiliación
y liquidación se muestran aparte. Los datos incompletos/no verificados no reciben
un total ficticio. Las cifras BAC de Honduras se conservan como antecedente
expresamente no aplicable a Costa Rica.

El acceso directo automatizado a precios de ONVO devuelve 403. Su fuente oficial
indexada coincide con los valores declarados por Vaniel; se conserva la fecha de
verificación directa **2026-11-11** y se declara la revisión indirecta del 20.
Tilopay se verificó directamente el **2026-11-20**. Revisa las condiciones de tu
comercio; no se agregan cargos que la fuente no especifica.

## Instalar el plugin en un comando

Desde este checkout, elige tu cliente con soporte de plugins:

```sh
node scripts/instalar-plugin.mjs codex
```

Para Claude Code:

```sh
node scripts/instalar-plugin.mjs claude
```

El comando instala las dependencias de compilación si faltan, genera un catálogo
local y registra `pagoscr@pagoscr-local` en la configuración de usuario del cliente.
Reinicia la sesión para cargar las herramientas. Empieza en modo demo. Para
revisar los comandos sin ejecutar ninguno, agrega `--dry-run`.

Los comandos se probaron realmente el 20 de noviembre de 2026, con autorización,
en Codex 0.169.0-alpha.11.1 (`plugin add`) y Claude Code 2.1.150 (`plugin install`).
Ambos clientes registran el plugin habilitado en configuración de usuario. Los
procesos MCP de sus copias instaladas exponen cuatro herramientas y completan
diagnóstico, cobro demo, confirmación y repetición sin credenciales. Reinicia la
sesión del cliente para cargarlo. No hay paquete npm publicado; el instalador usa
el catálogo local generado desde este checkout público.

`npm run build` genera `build/marketplace/` con ambos catálogos y un plugin que
incluye runtime, dependencias JS compiladas, skill, tarifas y licencias. No copies
solo `plugin/`: contiene las plantillas. Consulta la
[especificación de distribución](docs/specs/plugin.md).

## Conectar solo el servidor local

Una vez compilado, el cliente del agente debe ejecutar este proceso:

```sh
node /ruta/absoluta/a/pagoscr/dist/mcp/cli.js
```

Usa esa ruta real en la configuración stdio de tu cliente. No uses `npm run`
como comando MCP, porque su salida adicional puede interferir con JSON-RPC.
Esta alternativa usa directamente el CLI compilado; no necesita instalar el plugin.

## Usar el paquete desde el servidor

```js
import {
  DemoAdapter,
  InMemoryPaymentStore,
  processWebhook,
} from './dist/index.js';

const provider = new DemoAdapter();
const store = new InMemoryPaymentStore();
// El servidor carga el monto de su catálogo u orden; nunca del navegador.
const order = {
  paymentId: 'orden_1',
  amountCents: 2000000,
  currency: 'CRC',
  description: 'Orden de prueba',
};
const charge = await provider.createCharge(order);
await store.savePayment({
  ...order,
  provider: provider.name,
  providerPaymentId: charge.providerPaymentId,
  amountCents: order.amountCents,
  currency: order.currency,
  status: charge.status,
});
const request = provider.simulatePayment(charge.providerPaymentId);
const result = await processWebhook(provider, request, store);
// result.status === 'succeeded'; repetir el evento devuelve duplicate: true.
```

El núcleo no tiene dependencias de Node, NestJS ni Prisma. El almacén en memoria
es para demo/pruebas; una aplicación real debe aplicar pago y evento dentro de
una transacción persistente con unicidad.

## ONVO en modo de prueba

El adaptador usa payment intents. Crear un cobro devuelve una intención pendiente,
sin checkout hospedado. La app recoge un método tokenizado con el SDK de ONVO;
`confirmTestCharge` lo confirma y `getTestPayment` consulta el resultado mínimo.
El estado de una orden se actualiza con `processWebhook`, que exige firma y
confirmación contra la API. Nunca se admiten llaves live ni datos de tarjeta en
las herramientas MCP.

El 20 de noviembre de 2026 se autorizó y aprobó una prueba contra la API de ONVO:
creación, confirmación y consulta de **₡20000 ficticios**, en 2,33 segundos. La
recepción de un webhook real sigue sin probarse; firmas y entrega se cubren con
fixtures sintéticos basados en la documentación oficial.

La prueba de red está separada del CI y requiere llave secreta test y activación
explícita. Los agentes deben pedir autorización antes de usar credenciales.
Después de autorizarla, desde esta carpeta:

```sh
PAGOSCR_RUN_ONVO_E2E=1 node --env-file=../.env.onvo ./node_modules/vitest/vitest.mjs run --config vitest.e2e.config.ts
```

El archivo externo permanece fuera del repositorio. Las llaves nunca se copian,
devuelven ni registran. No pegues sus valores en el chat.

## Tilopay: retorno documentado y consulta autenticada

El adaptador usa login con `apiuser`, formulario alojado y retorno GET. El backend
convierte los parámetros mediante `normalizeTilopayReturn` y procesa la notificación
con el mismo `processWebhook` del paquete. Se exige confirmación por `consult`,
con referencia, monto, moneda, autorización, captura y entorno Test coincidentes.
El esquema del webhook privado de processPayment no se presupone ni se simula.

El hash V2 del plugin oficial WooCommerce se verifica por defecto; su origen y
opción de solo consulta están en la [especificación Tilopay](docs/specs/tilopay.md).
Los datos de facturación y el correo original provienen del servidor. No hay datos
ficticios ocultos que se envíen como si fueran del comprador.

`lookupCapturedPayment` permite recuperar una captura desde el servidor si el
comprador cierra el navegador antes del retorno; usa el mismo identificador de
evento para evitar duplicar la aplicación del pago. Las pruebas usan fixtures;
no se han usado credenciales reales ni se ha hecho una E2E Tilopay.

Las credenciales de Tilopay no distinguen prueba/producción. El adaptador exige
`testMode: true` y la consulta debe devolver Test; ese indicador local no comprueba
el panel antes de generar una URL. Por eso `crear_cobro_de_prueba` del MCP sigue
limitado a demo/ONVO. La herramienta de verificar puede usar Tilopay si conectas
el registro persistente del backend y configuras sus variables, incluido el correo
original de facturación.

## Plantilla de checkout demo

Después de compilar:

```sh
npm run demo:checkout
```

Abre [http://127.0.0.1:4321](http://127.0.0.1:4321), crea la orden y confirma el
pago demo. El servidor toma ₡20000 del catálogo, genera/verifica la notificación
firmada y permite probar su repetición. No pide tarjeta ni carga llaves. La sesión
dueña de una orden es la única que puede leerla o confirmarla.

Es una plantilla local de Node HTTP con TypeScript y HTML/CSS/JS; escucha únicamente
en 127.0.0.1. El diseño se comprobó en escritorio y móvil. Consulta
[template/README.md](template/README.md) para límites, puertos e integración.

## Evaluación del agente

La [evaluación independiente](docs/evaluacion.md) dio **3/5 tareas completas y tres
cobros demo confirmados**. Dos casos (ONVO/Tilopay con fixtures) fueron bloqueados
por cuota del servicio antes de ejecutar; no se cuentan como éxitos. Las tres
soluciones no requirieron correcciones del autor y sus 17 pruebas se reproducen
con `npm run evaluacion:reproducir`, también incluido en el CI. Hay código original,
hashes, tiempos y límites en el registro. Esa reproducción no es una nueva sesión
de agente ni una E2E de pasarela. El preparador de futuras apps limpias continúa
disponible con `npm run evaluacion:preparar`.

## Verificación y procedencia

Guías de integración: [ONVO](docs/onvo.md), [Tilopay](docs/tilopay.md),
[seguridad y persistencia](docs/seguridad.md) y [tarifas](docs/tarifas.md).

```sh
npm run check
npm run hooks:install
```

El mismo control corre antes de cada commit y en GitHub Actions: formato, tipos,
pruebas sin pasarelas externas, Secretlint, control de prefijos de llaves, compilación, validación
de tarifas, inicio rápido por stdio (`quickstart.sh --check`, reutilizando el
paquete que el CI ya compiló), recorrido de ambos plugins desde una copia aislada
y las 17 pruebas conservadas de la evaluación independiente.

Hay **244 pruebas sin pasarelas externas** y una prueba de API ONVO autorizada aprobada. Demo,
ONVO y Tilopay pasan la misma batería de 17 casos (51 de contrato). En Tilopay se
prueba el retorno documentado con consult, no su webhook privado. La
[skill de agentes](skill/SKILL.md), los paquetes para ambos clientes y la plantilla
están incluidos. El [repositorio público](https://github.com/vaniel2748/pagoscr) y
su CI ya están disponibles; la insignia muestra el estado del workflow. npm y
despliegue no se han realizado y requieren autorización específica.

`prior-work/` conserva tres archivos importados sin cambios desde RestaurantPay;
no se compilan ni se distribuyen en el paquete. Consulta
[ESTADO-INICIAL.md](ESTADO-INICIAL.md), [BITACORA.md](BITACORA.md) y las
[especificaciones](docs/specs/) para ver autoría, decisiones, límites y pruebas.
