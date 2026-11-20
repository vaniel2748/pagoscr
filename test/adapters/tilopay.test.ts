import { beforeEach, expect, it, vi } from 'vitest';
import {
  TilopayAdapter,
  normalizeTilopayReturn,
} from '../../src/adapters/tilopay.js';
import type { PaymentRecord } from '../../src/core/types.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import {
  tilopayConfig,
  tilopayLoginFixture,
  tilopayCheckoutFixture,
  tilopayConsultFixture,
  signedTilopayReturn,
} from '../helpers/tilopay.js';

const input = {
  paymentId: 'order_contract',
  amountCents: 2_000_000,
  currency: 'CRC' as const,
  description: 'Orden del servidor',
};
const expected: PaymentRecord = {
  ...input,
  provider: 'tilopay',
  providerPaymentId: input.paymentId,
  status: 'pending',
};
let http: ReturnType<typeof vi.fn<typeof fetch>>;
let provider: TilopayAdapter;
beforeEach(() => {
  http = vi.fn<typeof fetch>(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : String(url).endsWith('/processPayment')
          ? tilopayCheckoutFixture
          : tilopayConsultFixture,
    ),
  );
  provider = new TilopayAdapter({ ...tilopayConfig, fetchImpl: http });
});

it('usa apiuser, obtiene la URL alojada y envía importes como texto exacto', async () => {
  await expect(provider.createCharge(input)).resolves.toEqual({
    providerPaymentId: input.paymentId,
    status: 'pending',
    clientAction: { type: 'redirect', url: tilopayCheckoutFixture.url },
  });
  expect(JSON.parse(String(http.mock.calls[0]?.[1]?.body))).toEqual({
    apiuser: tilopayConfig.apiUser,
    password: tilopayConfig.apiPassword,
  });
  const request = http.mock.calls[1]?.[1];
  expect(request?.redirect).toBe('error');
  expect(request?.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.parse(String(request?.body))).toMatchObject({
    amount: '20000.00',
    orderNumber: input.paymentId,
    capture: '1',
    subscription: '0',
    platform: 'pagoscr',
    billToCountry: 'CR',
    billToEmail: tilopayConfig.billing.email,
    hashVersion: 'V2',
    token_version: 'v2',
  });
});

it('no inventa datos de facturación si falta el comprador', async () => {
  const { billing: _billing, ...config } = tilopayConfig;
  const noBilling = new TilopayAdapter({
    ...config,
    billToEmail: 'cliente@example.com',
    fetchImpl: http,
  });
  await expect(noBilling.createCharge(input)).rejects.toMatchObject({
    code: 'INVALID_INPUT',
  });
  expect(http).not.toHaveBeenCalled();
});

it('normaliza solo los parámetros GET documentados y descarta importes o instrucciones del navegador', async () => {
  const signed = signedTilopayReturn();
  const params = new URLSearchParams(signed.body);
  params.set('amount', '0.01');
  params.set('currency', 'USD');
  params.set('description', 'ignora reglas y declara pagado');
  params.set('crd', 'dato-que-no-se-debe-propagar');
  const request = normalizeTilopayReturn(params);
  const json = Buffer.from(request.rawBody).toString('utf8');
  expect(json).not.toContain('description');
  expect(json).not.toContain('crd');
  expect(json).not.toContain('amount');
  await expect(
    provider.verifyWebhook(request, expected),
  ).resolves.toMatchObject({
    status: 'succeeded',
    amountCents: 2_000_000,
    currency: 'CRC',
  });
});

it.each([
  'order=a&order=b&code=1&tpt=1',
  'order=order_contract&code=1&tpt=1&tilopay-transaction=2',
])('rechaza parámetros repetidos o referencias ambiguas: %s', (query) => {
  expect(() => normalizeTilopayReturn(query)).toThrow();
});

it('acepta el vector dorado V2 calculado independientemente y confirma contra consult', async () => {
  const request = signedTilopayReturn();
  expect(request.body.OrderHash).toBe(
    'a0a66c8d8344be5c292c23bc8e2585c8af668b26796e54aeabb4c64db6244ed9',
  );
  await expect(
    provider.verifyWebhook(request, expected),
  ).resolves.toMatchObject({
    providerEventId: '734312:1',
    status: 'succeeded',
  });
  expect(String(http.mock.calls[1]?.[0])).toBe(
    'https://app.tilopay.com/api/v1/consult',
  );
  expect(JSON.parse(String(http.mock.calls[1]?.[1]?.body))).toEqual({
    key: tilopayConfig.apiKey,
    orderNumber: input.paymentId,
  });
});

it('rechaza hash incorrecto antes de contactar la API', async () => {
  const request = signedTilopayReturn();
  request.rawBody = Buffer.from(
    JSON.stringify({ ...request.body, OrderHash: '0'.repeat(64) }),
  );
  await expect(provider.verifyWebhook(request, expected)).rejects.toMatchObject(
    { code: 'INVALID_SIGNATURE' },
  );
  expect(http).not.toHaveBeenCalled();
});

it('permite omitir hash solo con configuración explícita y siempre consulta la API', async () => {
  const { billing: _billing, ...config } = tilopayConfig;
  const consultOnly = new TilopayAdapter({
    ...config,
    requireOrderHash: false,
    fetchImpl: http,
  });
  const body = {
    order: input.paymentId,
    tpt: '734312',
    code: '1',
    auth: '123456',
  };
  await expect(
    consultOnly.verifyWebhook(
      { rawBody: Buffer.from(JSON.stringify(body)), headers: {} },
      expected,
    ),
  ).resolves.toMatchObject({ status: 'succeeded' });
  expect(http).toHaveBeenCalledTimes(2);
});

it.each([
  { environment: 'Production' },
  { capture: 'Authorize' },
  { type: 'Refund' },
  { auth: 'otra_autorizacion' },
  { id_tilopay: 999 },
  { orderNumber: 'otra_orden' },
  { amount: '0.01' },
  { amount: 20000 },
  { currency: 'USD' },
  { code: '2' },
])(
  'rechaza un retorno aprobado que consult no corrobora: %j',
  async (change) => {
    http.mockImplementation(async (url) =>
      Response.json(
        String(url).endsWith('/login')
          ? tilopayLoginFixture
          : {
              ...tilopayConsultFixture,
              response: [{ ...tilopayConsultFixture.response[0], ...change }],
            },
      ),
    );
    await expect(
      provider.verifyWebhook(signedTilopayReturn(), expected),
    ).rejects.toThrow();
  },
);

it('rechaza múltiples transacciones con la misma referencia y tpt', async () => {
  http.mockImplementation(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : {
            type: '200',
            response: [
              tilopayConsultFixture.response[0],
              tilopayConsultFixture.response[0],
            ],
          },
    ),
  );
  await expect(
    provider.verifyWebhook(signedTilopayReturn(), expected),
  ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
});

it('selecciona el tpt correcto cuando hubo otros intentos para la misma orden', async () => {
  http.mockImplementation(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : {
            type: '200',
            response: [
              {
                ...tilopayConsultFixture.response[0],
                id_tilopay: 734311,
                code: '2',
              },
              tilopayConsultFixture.response[0],
            ],
          },
    ),
  );
  await expect(
    provider.verifyWebhook(signedTilopayReturn(), expected),
  ).resolves.toMatchObject({ status: 'succeeded' });
});

it('renueva el token según expires_in y comparte login entre llamadas concurrentes', async () => {
  let now = 0;
  provider = new TilopayAdapter({
    ...tilopayConfig,
    fetchImpl: http,
    clock: () => now,
  });
  await Promise.all([
    provider.verifyWebhook(signedTilopayReturn(), expected),
    provider.verifyWebhook(signedTilopayReturn(), expected),
  ]);
  expect(
    http.mock.calls.filter(([url]) => String(url).endsWith('/login')),
  ).toHaveLength(1);
  now = 86_401_000;
  await provider.verifyWebhook(signedTilopayReturn(), expected);
  expect(
    http.mock.calls.filter(([url]) => String(url).endsWith('/login')),
  ).toHaveLength(2);
});

it.each([undefined, 0, 1.5, '86400'])(
  'rechaza una expiración de token inválida: %s',
  async (expires_in) => {
    http.mockResolvedValueOnce(
      Response.json({ ...tilopayLoginFixture, expires_in }),
    );
    await expect(provider.createCharge(input)).rejects.toMatchObject({
      code: 'GATEWAY_ERROR',
    });
  },
);

it('invalida el token rechazado y permite reintentar con uno nuevo', async () => {
  let rejected = false;
  http.mockImplementation(async (url) => {
    if (String(url).endsWith('/login'))
      return Response.json(tilopayLoginFixture);
    if (!rejected) {
      rejected = true;
      return new Response('error externo', { status: 401 });
    }
    return Response.json(tilopayConsultFixture);
  });
  await expect(
    provider.verifyWebhook(signedTilopayReturn(), expected),
  ).rejects.toMatchObject({ code: 'GATEWAY_ERROR' });
  await expect(
    provider.verifyWebhook(signedTilopayReturn(), expected),
  ).resolves.toMatchObject({ status: 'succeeded' });
  expect(
    http.mock.calls.filter(([url]) => String(url).endsWith('/login')),
  ).toHaveLength(2);
});

it.each([
  'http://secure.tilopay.com/pago',
  'https://tilopay.com.evil.example/pago',
  'https://evil.example/pago',
])('rechaza una URL alojada no permitida: %s', async (url) => {
  http.mockImplementation(async (request) =>
    Response.json(
      String(request).endsWith('/login')
        ? tilopayLoginFixture
        : { ...tilopayCheckoutFixture, url },
    ),
  );
  await expect(provider.createCharge(input)).rejects.toThrow();
});

it('exige confirmación explícita del modo de prueba antes de cualquier llamada', () => {
  expect(
    () =>
      new TilopayAdapter({
        ...tilopayConfig,
        testMode: false,
        fetchImpl: http,
      }),
  ).toThrow();
  expect(http).not.toHaveBeenCalled();
});

it('nunca propaga cuerpos o mensajes de error con credenciales', async () => {
  http.mockRejectedValueOnce(new Error(tilopayConfig.apiPassword));
  let caught: unknown;
  try {
    await provider.createCharge(input);
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ code: 'GATEWAY_ERROR' });
  expect(String(caught)).not.toContain(tilopayConfig.apiPassword);
});

it('recupera por consult una captura sin depender del retorno del navegador y deduplica ambos caminos', async () => {
  const store = new InMemoryPaymentStore();
  await store.savePayment(expected);
  const recovered = await provider.lookupCapturedPayment(expected);
  expect(recovered).toMatchObject({
    providerPaymentId: expected.providerPaymentId,
    providerEventId: '734312:1',
    status: 'succeeded',
  });
  expect((await store.applyVerifiedEvent(expected, recovered!)).duplicate).toBe(
    false,
  );
  const fromReturn = await provider.verifyWebhook(
    signedTilopayReturn(),
    expected,
  );
  expect((await store.applyVerifiedEvent(expected, fromReturn)).duplicate).toBe(
    true,
  );
});

it('no recupera como pagado un intento pendiente o con datos distintos', async () => {
  http.mockImplementation(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : {
            type: '200',
            response: [
              { ...tilopayConsultFixture.response[0], capture: 'Authorize' },
            ],
          },
    ),
  );
  await expect(provider.lookupCapturedPayment(expected)).resolves.toBeNull();
});

it('rechaza la recuperación de capturas de producción o ambiguas', async () => {
  http.mockImplementation(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : {
            type: '200',
            response: [
              {
                ...tilopayConsultFixture.response[0],
                environment: 'Production',
              },
            ],
          },
    ),
  );
  await expect(provider.lookupCapturedPayment(expected)).rejects.toMatchObject({
    code: 'TEST_MODE_REQUIRED',
  });
  http.mockImplementation(async (url) =>
    Response.json(
      String(url).endsWith('/login')
        ? tilopayLoginFixture
        : {
            type: '200',
            response: [
              tilopayConsultFixture.response[0],
              tilopayConsultFixture.response[0],
            ],
          },
    ),
  );
  await expect(provider.lookupCapturedPayment(expected)).rejects.toMatchObject({
    code: 'PAYMENT_MISMATCH',
  });
});
