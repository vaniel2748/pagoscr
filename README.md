# PagosCR

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

Medición del 20 de noviembre de 2026 en el equipo de desarrollo: **5 segundos**
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

## Conectar el servidor local

Una vez compilado, el cliente del agente debe ejecutar este proceso:

```sh
node /ruta/absoluta/a/pagoscr/dist/mcp/cli.js
```

Usa esa ruta real en la configuración stdio de tu cliente. No uses `npm run`
como comando MCP, porque su salida adicional puede interferir con JSON-RPC.
El empaquetado e instalación del plugin en un comando se incorpora después del
adaptador Tilopay; todavía no se ha publicado ningún paquete en npm.

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

## Verificación y procedencia

```sh
npm run check
npm run hooks:install
```

El mismo control corre antes de cada commit y en GitHub Actions: formato, tipos,
pruebas sin red, Secretlint, control de prefijos de llaves, compilación, validación
de tarifas e inicio rápido por stdio (`quickstart.sh --check`, reutilizando el
paquete que el CI ya compiló).

Hay **174 pruebas sin red** y una prueba de API autorizada aprobada. Demo y ONVO
pasan la misma batería de 17 casos de contrato. Tilopay, skill, empaquetado y
plantilla siguen pendientes. GitHub, npm y despliegue todavía no se han autorizado:
los controles están en verde localmente, y el CI remoto aún no se ha ejecutado.

`prior-work/` conserva tres archivos importados sin cambios desde RestaurantPay;
no se compilan ni se distribuyen en el paquete. Consulta
[ESTADO-INICIAL.md](ESTADO-INICIAL.md), [BITACORA.md](BITACORA.md) y las
[especificaciones](docs/specs/) para ver autoría, decisiones, límites y pruebas.
