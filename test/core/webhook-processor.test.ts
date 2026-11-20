import { beforeEach, expect, it, vi } from 'vitest';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import { processWebhook } from '../../src/core/webhook-processor.js';
import type { PaymentProvider } from '../../src/core/payment-provider.js';
import type {
  PaymentRecord,
  VerifiedWebhookEvent,
} from '../../src/core/types.js';

const payment: PaymentRecord = {
  paymentId: 'order_1',
  provider: 'demo',
  providerPaymentId: 'demo_1',
  amountCents: 5000,
  currency: 'CRC',
  status: 'pending',
};
const event: VerifiedWebhookEvent = {
  providerEventId: 'evt_1',
  providerPaymentId: 'demo_1',
  amountCents: 5000,
  currency: 'CRC',
  status: 'succeeded',
};
const request = { rawBody: new TextEncoder().encode('{}'), headers: {} };
let store: InMemoryPaymentStore;
let provider: PaymentProvider;

beforeEach(async () => {
  store = new InMemoryPaymentStore();
  await store.savePayment(payment);
  provider = {
    name: 'demo',
    createCharge: vi.fn(),
    peekWebhookReference: () => 'demo_1',
    verifyWebhook: vi.fn(async () => event),
  };
});

it('carga el contexto desde el almacén del servidor', async () => {
  await expect(processWebhook(provider, request, store)).resolves.toEqual({
    paymentId: 'order_1',
    status: 'succeeded',
    duplicate: false,
  });
  expect(provider.verifyWebhook).toHaveBeenCalledWith(request, payment);
});

it('deduplica la aplicación de eventos simultáneos', async () => {
  const results = await Promise.all(
    Array.from({ length: 10 }, () => processWebhook(provider, request, store)),
  );
  expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
});

it('un rechazo de verificación no consume el id de evento', async () => {
  vi.mocked(provider.verifyWebhook).mockRejectedValueOnce(
    new Error('fallo sintético'),
  );
  await expect(processWebhook(provider, request, store)).rejects.toThrow();
  expect((await processWebhook(provider, request, store)).duplicate).toBe(
    false,
  );
});

it('contrasta monto y moneda incluso si el adaptador se equivoca', async () => {
  vi.mocked(provider.verifyWebhook).mockResolvedValueOnce({
    ...event,
    amountCents: 1,
  });
  await expect(processWebhook(provider, request, store)).rejects.toMatchObject({
    code: 'PAYMENT_MISMATCH',
  });
  expect((await store.findPayment('demo', 'demo_1'))?.status).toBe('pending');
});

it('no revierte un éxito cuando llega después un fallo', async () => {
  await processWebhook(provider, request, store);
  vi.mocked(provider.verifyWebhook).mockResolvedValueOnce({
    ...event,
    providerEventId: 'evt_late',
    status: 'failed',
  });
  expect((await processWebhook(provider, request, store)).status).toBe(
    'succeeded',
  );
});

it('permite que un nuevo intento exitoso reemplace un fallo', async () => {
  vi.mocked(provider.verifyWebhook).mockResolvedValueOnce({
    ...event,
    providerEventId: 'evt_failed',
    status: 'failed',
  });
  await processWebhook(provider, request, store);
  expect((await processWebhook(provider, request, store)).status).toBe(
    'succeeded',
  );
});

it('rechaza referencias inexistentes y cuerpos vacíos o excesivos', async () => {
  const unknown = { ...provider, peekWebhookReference: () => 'otro_pago' };
  await expect(processWebhook(unknown, request, store)).rejects.toMatchObject({
    code: 'PAYMENT_NOT_FOUND',
  });
  for (const rawBody of [new Uint8Array(), new Uint8Array(65_537)]) {
    await expect(
      processWebhook(provider, { ...request, rawBody }, store),
    ).rejects.toMatchObject({ code: 'MALFORMED_WEBHOOK' });
  }
});

it('protege la unicidad y devuelve copias de los registros', async () => {
  await expect(store.savePayment(payment)).rejects.toMatchObject({
    code: 'DUPLICATE_PAYMENT',
  });
  await expect(
    store.savePayment({ ...payment, providerPaymentId: 'otro' }),
  ).rejects.toMatchObject({ code: 'DUPLICATE_PAYMENT' });
  const copy = await store.findPayment('demo', 'demo_1');
  if (copy) Object.assign(copy, { amountCents: 1 });
  expect((await store.findPayment('demo', 'demo_1'))?.amountCents).toBe(5000);
});

it.each([undefined, null, 123])(
  'rechaza una referencia de evento que no sea texto: %s',
  async (providerEventId) => {
    vi.mocked(provider.verifyWebhook).mockResolvedValueOnce({
      ...event,
      providerEventId: providerEventId as unknown as string,
    });
    await expect(
      processWebhook(provider, request, store),
    ).rejects.toMatchObject({ code: 'MALFORMED_WEBHOOK' });
  },
);

it('no reutiliza un id de evento para un pago diferente', async () => {
  await processWebhook(provider, request, store);
  const another = {
    ...payment,
    paymentId: 'order_2',
    providerPaymentId: 'demo_2',
  };
  await store.savePayment(another);
  await expect(
    store.applyVerifiedEvent(another, {
      ...event,
      providerPaymentId: 'demo_2',
    }),
  ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
  expect((await store.findPayment('demo', 'demo_2'))?.status).toBe('pending');
});
