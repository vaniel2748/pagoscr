import { expect, it, vi } from 'vitest';
import { OnvoAdapter } from '../../src/adapters/onvo.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import { processWebhook } from '../../src/core/webhook-processor.js';
import type { PaymentRecord } from '../../src/core/types.js';
import session from '../fixtures/onvo/checkout-session.paid.json' with { type: 'json' };
import event from '../fixtures/onvo/event.checkout-succeeded.json' with { type: 'json' };
import {
  fakeSecretKey,
  fakeWebhookSecret,
  fixedNow,
  signedRequest,
  succeededFixture,
} from '../helpers/onvo.js';

const expected: PaymentRecord = {
  paymentId: 'order_checkout',
  provider: 'onvo',
  providerPaymentId: session.id,
  amountCents: 2_000_000,
  currency: 'CRC',
  status: 'pending',
};
const setup = async () => {
  const http = vi.fn<typeof fetch>(async (url) =>
    Response.json(
      String(url).includes('/checkout/sessions/') ? session : succeededFixture,
    ),
  );
  const provider = new OnvoAdapter({
    secretKey: fakeSecretKey,
    webhookSecret: fakeWebhookSecret,
    checkout: true,
    fetchImpl: http,
    clock: () => fixedNow,
  });
  const store = new InMemoryPaymentStore();
  await store.savePayment(expected);
  return { http, provider, store };
};

it('confirma el evento firmado consultando ambos recursos y deduplica avisos concurrentes', async () => {
  const { provider, store } = await setup();
  const results = await Promise.all(
    Array.from({ length: 3 }, () =>
      processWebhook(provider, signedRequest(event), store),
    ),
  );
  expect(results.filter((r) => !r.duplicate)).toHaveLength(1);
  expect(results.every((r) => r.status === 'succeeded')).toBe(true);
  expect(await store.findPayment('onvo', session.id)).toMatchObject({
    status: 'succeeded',
  });
});

it('no consulta la API ni cambia estado con un cuerpo alterado después de firmar', async () => {
  const { provider, store, http } = await setup();
  const request = signedRequest(event);
  request.rawBody = Buffer.from(JSON.stringify(event, null, 2));
  await expect(processWebhook(provider, request, store)).rejects.toMatchObject({
    code: 'INVALID_SIGNATURE',
  });
  expect(http).not.toHaveBeenCalled();
  expect(await store.findPayment('onvo', session.id)).toMatchObject({
    status: 'pending',
  });
});

it.each([
  { amountTotal: 1 },
  { currency: 'USD' },
  { paymentStatus: 'unpaid' },
  { status: 'open' },
  { object: 'payment_intent' },
  { paymentIntentId: undefined },
  { metadata: { pagoscrPaymentId: 'otra_orden' } },
])('no confía en un evento firmado incompatible: %j', async (change) => {
  const { provider, store, http } = await setup();
  await expect(
    processWebhook(
      provider,
      signedRequest({
        ...event,
        data: { object: { ...event.data.object, ...change } },
      }),
      store,
    ),
  ).rejects.toThrow();
  expect(http).not.toHaveBeenCalled();
  expect(await store.findPayment('onvo', session.id)).toMatchObject({
    status: 'pending',
  });
});

it('rechaza eventos de producción y tipos de checkout no documentados', async () => {
  const { provider, store, http } = await setup();
  await expect(
    processWebhook(provider, signedRequest({ ...event, mode: 'live' }), store),
  ).rejects.toMatchObject({ code: 'TEST_MODE_REQUIRED' });
  await expect(
    processWebhook(
      provider,
      signedRequest({ ...event, type: 'checkout_session.failed' }),
      store,
    ),
  ).rejects.toMatchObject({ code: 'UNSUPPORTED_EVENT' });
  expect(http).not.toHaveBeenCalled();
});

it.each([{ paymentStatus: 'unpaid' }, { paymentIntentId: 'pi_other' }])(
  'la sesión consultada debe confirmar el mismo pago: %j',
  async (change) => {
    const { provider, store, http } = await setup();
    http.mockResolvedValueOnce(Response.json({ ...session, ...change }));
    await expect(
      processWebhook(provider, signedRequest(event), store),
    ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    expect(await store.findPayment('onvo', session.id)).toMatchObject({
      status: 'pending',
    });
  },
);

it('una consulta API no disponible permite reintentar el mismo evento', async () => {
  const { provider, store, http } = await setup();
  http.mockResolvedValueOnce(new Response('', { status: 503 }));
  await expect(
    processWebhook(provider, signedRequest(event), store),
  ).rejects.toMatchObject({ code: 'GATEWAY_ERROR' });
  await expect(
    processWebhook(provider, signedRequest(event), store),
  ).resolves.toMatchObject({ status: 'succeeded', duplicate: false });
});
