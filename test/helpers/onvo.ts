import { createHmac } from 'node:crypto';
import created from '../fixtures/onvo/payment-intent.created.json' with { type: 'json' };
import succeeded from '../fixtures/onvo/payment-intent.succeeded.json' with { type: 'json' };
import event from '../fixtures/onvo/event.succeeded.json' with { type: 'json' };

// Valores ficticios; nunca se usan contra la API.
export const fakeSecretKey = [
  'onvo',
  'test',
  'secret',
  'key',
  'fixture-no-credentials',
].join('_');
export const fakeWebhookSecret = 'whsec_' + 'fixture-no-credentials';
export const fixedNow = 1_795_200_000_000;
export const createdFixture = structuredClone(created);
export const succeededFixture = structuredClone(succeeded);
export const eventFixture = structuredClone(event);

export function signedRequest(
  body: unknown,
  timestamp = Math.floor(fixedNow / 1000),
) {
  const rawBody = Buffer.from(
    typeof body === 'string' ? body : JSON.stringify(body),
  );
  const signature = createHmac('sha256', fakeWebhookSecret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return {
    rawBody,
    headers: { 'X-Onvo-Signature': `t=${timestamp},v1=${signature}` },
  };
}
