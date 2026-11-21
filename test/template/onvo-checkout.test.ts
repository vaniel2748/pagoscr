import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createCheckoutServer } from '../../template/server.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import created from '../fixtures/onvo/checkout-session.created.json' with { type: 'json' };
import paid from '../fixtures/onvo/checkout-session.paid.json' with { type: 'json' };
import { fakeSecretKey, succeededFixture } from '../helpers/onvo.js';

let server: Server;
let base: string;
let cookie: string;
let token: string;
let apiSession: unknown;
let unavailable: boolean;
let http: ReturnType<typeof vi.fn<typeof fetch>>;
let store: InMemoryPaymentStore;
const post = (path: string, body: unknown) =>
  fetch(base + path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      cookie,
      origin: base,
      'x-pagoscr-csrf': token,
      'content-type': 'application/json',
    },
  });
const get = (path: string) => fetch(base + path, { headers: { cookie } });
const create = async () =>
  (await post('/api/cobros', { producto: 'kit-builder' })).json();
const creations = () =>
  http.mock.calls.filter(([, init]) => init?.method === 'POST');

beforeEach(async () => {
  apiSession = created;
  unavailable = false;
  http = vi.fn<typeof fetch>(async (url, init) => {
    if (unavailable) throw new Error('detalle-externo-privado');
    return Response.json(
      init?.method === 'POST'
        ? created
        : String(url).includes('/checkout/sessions/')
          ? apiSession
          : succeededFixture,
    );
  });
  store = new InMemoryPaymentStore();
  server = createCheckoutServer({
    onvo: { secretKey: fakeSecretKey, fetchImpl: http },
    store,
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await fetch(base + '/api/catalogo');
  cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  token = (await response.json()).csrfToken;
});
afterEach(async () => {
  server?.closeAllConnections();
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

it('guarda la orden con el precio del catálogo antes de devolver su enlace', async () => {
  const { pago } = await create();
  expect(pago).toMatchObject({
    estado: 'pending',
    montoCentavos: 2_000_000,
    accionCliente: { type: 'redirect', url: created.url },
  });
  expect(await store.findPayment('onvo', created.id)).toMatchObject({
    paymentId: pago.id,
    status: 'pending',
  });
  expect(JSON.stringify(pago)).not.toContain(fakeSecretKey);
  expect(creations()).toHaveLength(1);
});

it('recarga, consulta y creación concurrente reutilizan una sola sesión de pago', async () => {
  const [a, b] = await Promise.all([create(), create()]);
  expect(a.pago.id).toBe(b.pago.id);
  apiSession = paid;
  const [one, two] = await Promise.all([
    get(`/api/cobros/${a.pago.id}`),
    get(`/api/cobros/${a.pago.id}`),
  ]);
  expect((await one.json()).pago.estado).toBe('succeeded');
  expect((await two.json()).pago.estado).toBe('succeeded');
  const catalog = await (await get('/api/catalogo')).json();
  expect(catalog.pago).toMatchObject({
    id: a.pago.id,
    estado: 'succeeded',
    accionCliente: { type: 'none' },
  });
  expect((await create()).pago.id).toBe(a.pago.id);
  expect(creations()).toHaveLength(1);
});

it('volver a la página o cambiar la URL no marca un pago pendiente como confirmado', async () => {
  const { pago } = await create();
  expect((await get('/pago?estado=succeeded&paid=true')).status).toBe(200);
  const result = await (
    await get(`/api/cobros/${pago.id}?estado=succeeded`)
  ).json();
  expect(result.pago.estado).toBe('pending');
  expect((await post(`/api/cobros/${pago.id}/confirmar-demo`, {})).status).toBe(
    404,
  );
});

it.each([
  { monto: 1 },
  { moneda: 'USD' },
  { estado: 'succeeded' },
  { pasarela: 'demo' },
])('el navegador no fija los datos del pago: %j', async (extra) => {
  expect(
    (await post('/api/cobros', { producto: 'kit-builder', ...extra })).status,
  ).toBe(400);
  expect(creations()).toHaveLength(0);
});

it('una API caída conserva la orden pendiente y permite volver a consultar', async () => {
  const { pago } = await create();
  unavailable = true;
  const failure = await get(`/api/cobros/${pago.id}`);
  expect(failure.status).toBe(500);
  expect(await failure.text()).not.toContain('detalle-externo-privado');
  expect(await store.findPayment('onvo', created.id)).toMatchObject({
    status: 'pending',
  });
  unavailable = false;
  apiSession = paid;
  expect((await (await get(`/api/cobros/${pago.id}`)).json()).pago.estado).toBe(
    'succeeded',
  );
  expect(creations()).toHaveLength(1);
});

it('una creación incierta no genera otra sesión al reintentar', async () => {
  unavailable = true;
  expect((await post('/api/cobros', { producto: 'kit-builder' })).status).toBe(
    500,
  );
  unavailable = false;
  expect((await post('/api/cobros', { producto: 'kit-builder' })).status).toBe(
    500,
  );
  expect(creations()).toHaveLength(1);
});

it('otra sesión no puede consultar ni crear un cobro desde el navegador ajeno', async () => {
  const { pago } = await create();
  expect((await fetch(base + `/api/cobros/${pago.id}`)).status).toBe(404);
  const response = await fetch(base + '/api/cobros', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"producto":"kit-builder"}',
  });
  expect(response.status).toBe(403);
  expect(creations()).toHaveLength(1);
});
