import { expect, it, vi } from 'vitest';
import { OnvoAdapter } from '../../src/adapters/onvo.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import { processWebhook } from '../../src/core/webhook-processor.js';
import event from '../fixtures/onvo/event.checkout-real-succeeded.json' with { type: 'json' };
import session from '../fixtures/onvo/checkout-session.paid.json' with { type: 'json' };
import {
  fakeSecretKey,
  fakeWebhookSecret,
  fixedNow,
  signedRequest,
  succeededFixture,
} from '../helpers/onvo.js';

it('procesa el evento real anonimizado y deduplica su repetición', async () => {
  const object = event.data.object;
  const provider = new OnvoAdapter({
    secretKey: fakeSecretKey,
    webhookSecret: fakeWebhookSecret,
    checkout: true,
    clock: () => fixedNow,
    fetchImpl: vi.fn<typeof fetch>(async (url) =>
      Response.json(
        String(url).includes('/checkout/sessions/')
          ? {
              ...session,
              id: object.id,
              paymentIntentId: object.paymentIntentId,
            }
          : { ...succeededFixture, id: object.paymentIntentId },
      ),
    ),
  });
  const store = new InMemoryPaymentStore();
  await store.savePayment({
    paymentId: 'order_real_webhook_fixture',
    provider: 'onvo',
    providerPaymentId: object.id,
    amountCents: 2_000_000,
    currency: 'CRC',
    status: 'pending',
  });
  // La firma original se verificó en vivo antes de anonimizar. Aquí se firma
  // la copia modificada con el secreto ficticio de las pruebas.
  const request = signedRequest(event);
  await expect(processWebhook(provider, request, store)).resolves.toMatchObject(
    { status: 'succeeded', duplicate: false },
  );
  await expect(processWebhook(provider, request, store)).resolves.toMatchObject(
    { status: 'succeeded', duplicate: true },
  );
});
