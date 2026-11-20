import { beforeEach, expect, it, vi } from 'vitest';
import { OnvoAdapter } from '../../src/adapters/onvo.js';
import type { PaymentRecord } from '../../src/core/types.js';
import {
  createdFixture,
  eventFixture,
  fakeSecretKey,
  fakeWebhookSecret,
  fixedNow,
  signedRequest,
  succeededFixture,
} from '../helpers/onvo.js';

const input = {
  paymentId: 'order_contract',
  amountCents: 2_000_000,
  currency: 'CRC' as const,
  description: 'Orden del servidor',
};
const expected: PaymentRecord = {
  ...input,
  provider: 'onvo',
  providerPaymentId: createdFixture.id,
  status: 'pending',
};
let http: ReturnType<typeof vi.fn<typeof fetch>>;
let provider: OnvoAdapter;

beforeEach(() => {
  http = vi.fn<typeof fetch>(async () => Response.json(succeededFixture));
  provider = new OnvoAdapter({
    secretKey: fakeSecretKey,
    webhookSecret: fakeWebhookSecret,
    fetchImpl: http,
    clock: () => fixedNow,
  });
});

it.each([
  ['onvo', 'live', 'secret', 'key', 'sentinel'].join('_'),
  ['onvo', 'test', 'publishable', 'key', 'sentinel'].join('_'),
  '',
  'cualquier-texto',
])('rechaza una llave que no sea secreta de prueba', (secretKey) => {
  expect(() => new OnvoAdapter({ secretKey, fetchImpl: http })).toThrow();
  expect(http).not.toHaveBeenCalled();
});

it('envía únicamente monto del servidor y referencia en metadata', async () => {
  http.mockResolvedValueOnce(Response.json(createdFixture, { status: 201 }));
  await provider.createCharge(input);
  const [url, init] = http.mock.calls[0]!;
  expect(url).toBe('https://api.onvopay.com/v1/payment-intents');
  expect(init?.redirect).toBe('error');
  expect(init?.signal).toBeInstanceOf(AbortSignal);
  expect(init?.headers).toMatchObject({
    Authorization: `Bearer ${fakeSecretKey}`,
  });
  expect(JSON.parse(String(init?.body))).toEqual({
    amount: input.amountCents,
    currency: input.currency,
    description: input.description,
    metadata: { pagoscrPaymentId: input.paymentId },
  });
});

it('acepta cualquiera de las firmas v1 durante rotación', async () => {
  const request = signedRequest(eventFixture);
  request.headers['X-Onvo-Signature'] += `,v1=${'0'.repeat(64)}`;
  await expect(
    provider.verifyWebhook(request, expected),
  ).resolves.toMatchObject({ status: 'succeeded' });
});

it('rechaza firmas alteradas antes de llamar a la API', async () => {
  const request = signedRequest(eventFixture);
  await expect(
    provider.verifyWebhook(
      {
        ...request,
        rawBody: Buffer.from(JSON.stringify(eventFixture, null, 2)),
      },
      expected,
    ),
  ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  expect(http).not.toHaveBeenCalled();
});

it.each([-301, 301])(
  'rechaza marcas de tiempo fuera de tolerancia: %s',
  async (seconds) => {
    const request = signedRequest(
      eventFixture,
      Math.floor(fixedNow / 1000) + seconds,
    );
    await expect(
      provider.verifyWebhook(request, expected),
    ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    expect(http).not.toHaveBeenCalled();
  },
);

it('rechaza marcas de tiempo duplicadas y cabeceras ambiguas', async () => {
  const request = signedRequest(eventFixture);
  await expect(
    provider.verifyWebhook(
      {
        ...request,
        headers: {
          'X-Onvo-Signature': `${request.headers['X-Onvo-Signature']},t=1`,
        },
      },
      expected,
    ),
  ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
  await expect(
    provider.verifyWebhook(
      {
        ...request,
        headers: {
          ...request.headers,
          'x-onvo-signature': request.headers['X-Onvo-Signature'],
        },
      },
      expected,
    ),
  ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
});

it('rechaza un evento firmado de producción', async () => {
  await expect(
    provider.verifyWebhook(
      signedRequest({ ...eventFixture, mode: 'live' }),
      expected,
    ),
  ).rejects.toMatchObject({ code: 'TEST_MODE_REQUIRED' });
  expect(http).not.toHaveBeenCalled();
});

it('rechaza eventos de recursos no admitidos', async () => {
  await expect(
    provider.verifyWebhook(
      signedRequest({ ...eventFixture, type: 'refund.succeeded' }),
      expected,
    ),
  ).rejects.toMatchObject({ code: 'UNSUPPORTED_EVENT' });
});

it.each([
  { mode: 'live' },
  { id: 'otro_pago' },
  { currency: 'USD' },
  { metadata: { pagoscrPaymentId: 'otra_orden' } },
  { receivedAmount: 1 },
])('rechaza confirmaciones de API que no corresponden: %j', async (change) => {
  http.mockResolvedValueOnce(Response.json({ ...succeededFixture, ...change }));
  await expect(
    provider.verifyWebhook(signedRequest(eventFixture), expected),
  ).rejects.toThrow();
});

it('oculta cuerpos de error y errores de red de la pasarela', async () => {
  http.mockResolvedValueOnce(new Response(fakeSecretKey, { status: 401 }));
  let caught: unknown;
  try {
    await provider.createCharge(input);
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ code: 'GATEWAY_ERROR' });
  expect(String(caught)).not.toContain(fakeSecretKey);
  http.mockRejectedValueOnce(new Error(`error sintético con ${fakeSecretKey}`));
  await expect(provider.createCharge(input)).rejects.toMatchObject({
    code: 'GATEWAY_ERROR',
  });
});

it('rechaza respuestas HTML y montos de creación distintos', async () => {
  http.mockResolvedValueOnce(
    new Response('<html>error</html>', { status: 200 }),
  );
  await expect(provider.createCharge(input)).rejects.toMatchObject({
    code: 'GATEWAY_ERROR',
  });
  http.mockResolvedValueOnce(Response.json({ ...createdFixture, amount: 1 }));
  await expect(provider.createCharge(input)).rejects.toMatchObject({
    code: 'PAYMENT_MISMATCH',
  });
});

it('confirma usando una referencia tokenizada y consulta el resultado mínimo', async () => {
  await provider.confirmTestCharge(createdFixture.id, 'pm_fixture');
  expect(http.mock.calls[0]?.[0]).toBe(
    `https://api.onvopay.com/v1/payment-intents/${createdFixture.id}/confirm`,
  );
  expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).toEqual({
    paymentMethodId: 'pm_fixture',
  });
  await expect(provider.getTestPayment(createdFixture.id)).resolves.toEqual({
    providerPaymentId: createdFixture.id,
    amountCents: 2_000_000,
    currency: 'CRC',
    status: 'succeeded',
  });
});

it('pide configurar el secreto del webhook sin llamar a la API', async () => {
  const unconfigured = new OnvoAdapter({
    secretKey: fakeSecretKey,
    fetchImpl: http,
  });
  await expect(
    unconfigured.verifyWebhook(signedRequest(eventFixture), expected),
  ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  expect(http).not.toHaveBeenCalled();
});
