# Usar el paquete desde el servidor

Después de `npm run build`, este ejemplo crea y confirma un cobro demo:

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
  status: charge.status,
});
const request = provider.simulatePayment(charge.providerPaymentId);
const result = await processWebhook(provider, request, store);
// result.status === 'succeeded'; repetir el aviso devuelve duplicate: true.
```

Las rutas del ejemplo parten de la raíz del checkout. Desde otra app, instala el
paquete local compilado y cambia el import a `pagoscr`.

Montos en centavos enteros: `2000000` representa ₡20000. El tipo de cambio es
entero y explícito: `50000` céntimos CRC por dólar representa ₡500/US$1.
[Unidades, redondeo y calculadora](tarifas.md).

En una app, autentica al dueño de la orden y usa un almacén persistente que aplique
pago/evento y efectos de entrega en una transacción. El almacén en memoria es para
demo y pruebas. [Seguridad y persistencia](seguridad.md).

Sigue [ONVO](onvo.md) para su checkout alojado y [Tilopay](tilopay.md) para el
retorno GET documentado con confirmación autenticada por consult.
