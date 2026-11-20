import { expect, it, vi } from 'vitest';
import { DemoAdapter } from '../../src/adapters/demo.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import { processWebhook } from '../../src/core/webhook-processor.js';
import type { PaymentRecord } from '../../src/core/types.js';

it('recorre un cobro demo confirmado sin red ni credenciales', async () => {
  const network = vi
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('No se permite red'));
  const provider = new DemoAdapter();
  const input = {
    paymentId: 'order_demo',
    amountCents: 2_000_000,
    currency: 'CRC' as const,
    description: 'Demo sin credenciales',
  };
  const charge = await provider.createCharge(input);
  const payment: PaymentRecord = {
    ...input,
    provider: 'demo',
    providerPaymentId: charge.providerPaymentId,
    status: charge.status,
  };
  const store = new InMemoryPaymentStore();
  await store.savePayment(payment);
  const notification = provider.simulatePayment(charge.providerPaymentId);
  expect((await processWebhook(provider, notification, store)).status).toBe(
    'succeeded',
  );
  expect((await processWebhook(provider, notification, store)).duplicate).toBe(
    true,
  );
  expect(network).not.toHaveBeenCalled();
});

it('firma los bytes exactos y rechaza un cuerpo vuelto a serializar', async () => {
  const provider = new DemoAdapter();
  const input = {
    paymentId: 'order_bytes',
    amountCents: 1000,
    currency: 'USD' as const,
    description: 'Bytes crudos',
  };
  const charge = await provider.createCharge(input);
  const payment: PaymentRecord = {
    ...input,
    provider: 'demo',
    providerPaymentId: charge.providerPaymentId,
    status: 'pending',
  };
  const request = provider.simulatePayment(charge.providerPaymentId);
  const changed = {
    ...request,
    rawBody: Buffer.from(
      JSON.stringify(
        JSON.parse(Buffer.from(request.rawBody).toString()),
        null,
        2,
      ),
    ),
  };
  await expect(provider.verifyWebhook(changed, payment)).rejects.toMatchObject({
    code: 'INVALID_SIGNATURE',
  });
});

it('rechaza notificaciones antiguas y marcas de tiempo futuras', async () => {
  let now = 1_795_200_000_000;
  const provider = new DemoAdapter({ clock: () => now });
  const input = {
    paymentId: 'order_clock',
    amountCents: 1000,
    currency: 'USD' as const,
    description: 'Reloj',
  };
  const charge = await provider.createCharge(input);
  const payment: PaymentRecord = {
    ...input,
    provider: 'demo',
    providerPaymentId: charge.providerPaymentId,
    status: 'pending',
  };
  const request = provider.simulatePayment(charge.providerPaymentId);
  now += 301_000;
  await expect(provider.verifyWebhook(request, payment)).rejects.toMatchObject({
    code: 'INVALID_SIGNATURE',
  });
  now -= 602_000;
  await expect(provider.verifyWebhook(request, payment)).rejects.toMatchObject({
    code: 'INVALID_SIGNATURE',
  });
});
