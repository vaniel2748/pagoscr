import { expect, it, vi } from 'vitest';
import { OnvoAdapter } from '../../src/adapters/onvo.js';
import created from '../fixtures/onvo/checkout-session.created.json' with { type: 'json' };
import { fakeSecretKey } from '../helpers/onvo.js';

const order = {
  paymentId: 'order_checkout',
  amountCents: 2_000_000,
  currency: 'CRC' as const,
  description: 'Pedido del servidor',
};
const setup = (body: unknown = created) => {
  const http = vi.fn<typeof fetch>(async () => Response.json(body));
  const provider = new OnvoAdapter({
    secretKey: fakeSecretKey,
    checkout: true,
    fetchImpl: http,
  });
  return { http, provider };
};

it('crea un enlace fijo de tarjeta con importe del servidor y modo test', async () => {
  const { http, provider } = setup();
  await expect(provider.createCharge(order)).resolves.toEqual({
    providerPaymentId: created.id,
    status: 'pending',
    clientAction: { type: 'redirect', url: created.url },
  });
  expect(http.mock.calls[0]?.[0]).toBe(
    'https://api.onvopay.com/v1/checkout/sessions/one-time-link',
  );
  expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).toEqual({
    lineItems: [
      {
        quantity: 1,
        unitAmount: order.amountCents,
        currency: order.currency,
        description: order.description,
        isQuantityAdjustable: false,
        priceType: 'one_time',
      },
    ],
    paymentMethodTypes: ['card'],
    captureMethod: 'automatic',
    metadata: { pagoscrPaymentId: order.paymentId },
  });
});

it('solo añade un retorno HTTPS del servidor cuando está configurado', async () => {
  const { http, provider } = setup();
  await provider.createCharge({
    ...order,
    returnUrl: 'https://mi-app.example/pago',
  });
  expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).toMatchObject({
    redirectUrl: 'https://mi-app.example/pago',
    cancelUrl: 'https://mi-app.example/pago',
  });
  await expect(
    provider.createCharge({ ...order, returnUrl: 'http://localhost/pago' }),
  ).rejects.toThrow();
  expect(http).toHaveBeenCalledTimes(1);
});

it.each([
  { ...created, mode: 'live' },
  { ...created, status: 'inventado' },
  { ...created, paymentStatus: 'inventado' },
  {
    ...created,
    lineItems: [{ quantity: 2, unitAmount: 2_000_000, currency: 'CRC' }],
  },
  { ...created, lineItems: [{ quantity: 1, unitAmount: 1, currency: 'CRC' }] },
  {
    ...created,
    lineItems: [{ quantity: 1, unitAmount: 2_000_000, currency: 'USD' }],
  },
  { ...created, lineItems: [] },
])(
  'rechaza un checkout cuya respuesta contradice la orden: %j',
  async (body) => {
    await expect(setup(body).provider.createCharge(order)).rejects.toThrow();
  },
);

it.each([
  'javascript:alert(1)',
  'http://checkout.onvopay.com/pay/cs_fixture',
  'https://checkout.onvopay.com.ajeno.example/pay/cs_fixture',
  'https://usuario@checkout.onvopay.com/pay/cs_fixture',
])('rechaza enlaces de pago fuera del destino documentado: %s', async (url) => {
  await expect(
    setup({ ...created, url }).provider.createCharge(order),
  ).rejects.toThrow();
});

it('rechaza importes decimales antes de contactar la API', async () => {
  const { http, provider } = setup();
  await expect(
    provider.createCharge({ ...order, amountCents: 1.5 }),
  ).rejects.toThrow();
  expect(http).not.toHaveBeenCalled();
});
