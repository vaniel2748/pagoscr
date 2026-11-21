import { expect, it, vi } from 'vitest';
import { OnvoAdapter } from '../../src/adapters/onvo.js';
import type { PaymentRecord } from '../../src/core/types.js';
import open from '../fixtures/onvo/checkout-session.created.json' with { type: 'json' };
import paid from '../fixtures/onvo/checkout-session.paid.json' with { type: 'json' };
import { fakeSecretKey, succeededFixture } from '../helpers/onvo.js';

const expected: PaymentRecord = {
  paymentId: 'order_checkout',
  provider: 'onvo',
  providerPaymentId: paid.id,
  amountCents: 2_000_000,
  currency: 'CRC',
  status: 'pending',
};
// La metadata de la intención no tiene por qué heredar la de la sesión.
const { metadata: _, ...intent } = succeededFixture;
const setup = (session: unknown = paid, payment: unknown = intent) => {
  const http = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json(session))
    .mockResolvedValueOnce(Response.json(payment));
  return {
    http,
    provider: new OnvoAdapter({
      secretKey: fakeSecretKey,
      checkout: true,
      fetchImpl: http,
    }),
  };
};

it('confirma sesión e intención vinculada sin depender de metadata heredada', async () => {
  const { http, provider } = setup();
  await expect(provider.getTestCheckoutPayment(expected)).resolves.toEqual({
    providerPaymentId: paid.id,
    amountCents: expected.amountCents,
    currency: 'CRC',
    status: 'succeeded',
  });
  expect(http.mock.calls.map(([url]) => url)).toEqual([
    `https://api.onvopay.com/v1/checkout/sessions/${paid.id}`,
    `https://api.onvopay.com/v1/payment-intents/${paid.paymentIntentId}`,
  ]);
});

it.each([
  [open, 'pending'],
  [{ ...open, status: 'complete' }, 'pending'],
  [{ ...open, status: 'expired' }, 'failed'],
])('no confirma una sesión sin pago: %j', async (session, status) => {
  const { http, provider } = setup(session);
  await expect(
    provider.getTestCheckoutPayment(expected),
  ).resolves.toMatchObject({ status });
  expect(http).toHaveBeenCalledTimes(1);
});

it.each([
  { ...paid, id: 'cs_other' },
  { ...paid, mode: 'live' },
  { ...paid, status: 'open' },
  { ...paid, status: 'expired' },
  { ...paid, paymentIntentId: undefined },
  { ...paid, paymentIntentId: '../../otra' },
  { ...paid, lineItems: [{ quantity: 1, unitAmount: 1, currency: 'CRC' }] },
  {
    ...paid,
    lineItems: [{ quantity: 1, unitAmount: 2_000_000, currency: 'USD' }],
  },
  { ...paid, lineItems: [{ ...paid.lineItems[0], quantity: 2 }] },
  { ...paid, lineItems: [{ ...paid.lineItems[0], unitAmount: 1 }] },
])(
  'rechaza contradicciones de sesión antes de consultar la intención: %j',
  async (session) => {
    const { http, provider } = setup(session);
    await expect(provider.getTestCheckoutPayment(expected)).rejects.toThrow();
    expect(http).toHaveBeenCalledTimes(1);
  },
);

it.each([
  { ...intent, id: 'pi_other' },
  { ...intent, mode: 'live' },
  { ...intent, amount: 1 },
  { ...intent, currency: 'USD' },
  { ...intent, status: 'processing' },
  { ...intent, receivedAmount: 0 },
  { ...intent, receivedAmount: 1.5 },
])(
  'no confirma una intención incompatible o un cobro parcial: %j',
  async (payment) => {
    await expect(
      setup(paid, payment).provider.getTestCheckoutPayment(expected),
    ).rejects.toThrow();
  },
);

it('no sustituye una caída de la API por confirmación ni expone cuerpos externos', async () => {
  const { http, provider } = setup();
  http
    .mockReset()
    .mockResolvedValueOnce(Response.json(paid))
    .mockResolvedValueOnce(
      Response.json({ mensaje: 'dato-externo-privado' }, { status: 503 }),
    );
  const result = provider.getTestCheckoutPayment(expected);
  await expect(result).rejects.toMatchObject({ code: 'GATEWAY_ERROR' });
  await expect(result).rejects.not.toThrow('dato-externo-privado');
});

it('rechaza referencias ajenas o inválidas antes de enviar una llave', async () => {
  const { http, provider } = setup();
  await expect(
    provider.getTestCheckoutPayment({ ...expected, provider: 'demo' }),
  ).rejects.toThrow();
  await expect(
    provider.getTestCheckoutPayment({
      ...expected,
      providerPaymentId: '../../otro',
    }),
  ).rejects.toThrow();
  expect(http).not.toHaveBeenCalled();
});
