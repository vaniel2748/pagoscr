import { afterEach, beforeEach, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { request as rawRequest, type Server } from 'node:http';
import { createCheckoutServer } from '../../template/server.js';

let server: Server;
let base: string;
interface Browser {
  cookie: string;
  token: string;
  catalog: { producto: { id: string; montoCentavos: number; moneda: string } };
}

beforeEach(async () => {
  server = createCheckoutServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  server?.closeAllConnections();
  if (server?.listening)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function browser(): Promise<Browser> {
  const response = await fetch(`${base}/api/catalogo`);
  const catalog = await response.json();
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
  return {
    cookie: response.headers.get('set-cookie')!.split(';')[0]!,
    token: catalog.csrfToken,
    catalog,
  };
}
function post(
  user: Browser,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(base + path, {
    method: 'POST',
    headers: {
      cookie: user.cookie,
      origin: base,
      'x-pagoscr-csrf': user.token,
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
async function create(user: Browser) {
  const response = await post(user, '/api/cobros', { producto: 'kit-builder' });
  expect(response.status).toBe(200);
  return response.json();
}

it('muestra el catálogo del servidor y crea una orden pendiente sin credenciales', async () => {
  const user = await browser();
  expect(user.catalog.producto).toMatchObject({
    id: 'kit-builder',
    montoCentavos: 2_000_000,
    moneda: 'CRC',
  });
  const result = await create(user);
  expect(result.pago).toMatchObject({
    estado: 'pending',
    montoCentavos: 2_000_000,
    moneda: 'CRC',
  });
  expect(JSON.stringify(result)).not.toMatch(/signature|rawBody|whsec_/);
});

it.each([
  { monto: 1 },
  { montoCentavos: 1 },
  { moneda: 'USD' },
  { estado: 'succeeded' },
  { pasarela: 'onvo' },
])('rechaza campos finales del navegador: %j', async (extra) => {
  const user = await browser();
  expect(
    (await post(user, '/api/cobros', { producto: 'kit-builder', ...extra }))
      .status,
  ).toBe(400);
});

it('confirma por el adaptador y deduplica el mismo evento', async () => {
  const user = await browser();
  const { pago } = await create(user);
  const route = `/api/cobros/${pago.id}/confirmar-demo`;
  const confirmed = await (await post(user, route, {})).json();
  expect(confirmed.pago.estado).toBe('succeeded');
  expect(confirmed.duplicado).toBe(false);
  const repeated = await (await post(user, route, {})).json();
  expect(repeated.pago.estado).toBe('succeeded');
  expect(repeated.duplicado).toBe(true);
  const persisted = await fetch(`${base}/api/cobros/${pago.id}`, {
    headers: { cookie: user.cookie },
  });
  expect((await persisted.json()).pago.estado).toBe('succeeded');
});

it('no acepta un estado propuesto en la ruta de simulación', async () => {
  const user = await browser();
  const { pago } = await create(user);
  expect(
    (
      await post(user, `/api/cobros/${pago.id}/confirmar-demo`, {
        estado: 'succeeded',
      })
    ).status,
  ).toBe(400);
  const result = await fetch(`${base}/api/cobros/${pago.id}`, {
    headers: { cookie: user.cookie },
  });
  expect((await result.json()).pago.estado).toBe('pending');
});

it('dos creaciones simultáneas reutilizan una orden', async () => {
  const user = await browser();
  const [one, two] = await Promise.all([create(user), create(user)]);
  expect(one.pago.id).toBe(two.pago.id);
});

it('otro navegador no puede leer ni confirmar una orden ajena', async () => {
  const owner = await browser();
  const outsider = await browser();
  const { pago } = await create(owner);
  expect(
    (
      await fetch(`${base}/api/cobros/${pago.id}`, {
        headers: { cookie: outsider.cookie },
      })
    ).status,
  ).toBe(404);
  expect(
    (await post(outsider, `/api/cobros/${pago.id}/confirmar-demo`, {})).status,
  ).toBe(404);
});

it.each([
  { origin: 'https://otro.invalid' },
  { 'x-pagoscr-csrf': 'incorrecto' },
  { cookie: '' },
])('rechaza peticiones sin contexto del navegador: %j', async (headers) => {
  const user = await browser();
  expect(
    (await post(user, '/api/cobros', { producto: 'kit-builder' }, headers))
      .status,
  ).toBe(403);
});

it('rechaza JSON mal formado sin devolver el cuerpo', async () => {
  const user = await browser();
  const response = await fetch(`${base}/api/cobros`, {
    method: 'POST',
    headers: {
      cookie: user.cookie,
      origin: base,
      'x-pagoscr-csrf': user.token,
      'content-type': 'application/json',
    },
    body: '{mensaje-privado',
  });
  expect(response.status).toBe(400);
  expect(await response.text()).not.toContain('mensaje-privado');
});

it('limita el tamaño del cuerpo', async () => {
  const user = await browser();
  expect(
    (await post(user, '/api/cobros', { producto: 'x'.repeat(5000) })).status,
  ).toBe(413);
});

it('bloquea hosts ajenos y sirve CSP con archivos locales', async () => {
  // fetch normaliza Host; HTTP nativo permite probar el valor realmente recibido.
  const forbidden = await new Promise<number | undefined>((resolve, reject) => {
    const request = rawRequest(
      base,
      { headers: { host: 'otro.invalid' } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.once('error', reject);
    request.end();
  });
  expect(forbidden).toBe(403);
  const response = await fetch(base);
  expect(response.headers.get('content-security-policy')).toContain(
    "script-src 'self'",
  );
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.text()).toContain('lang="es"');
});

it('no publica un endpoint de webhook demo ni archivos arbitrarios', async () => {
  expect((await fetch(`${base}/api/webhooks/demo`)).status).toBe(404);
  expect((await fetch(`${base}/.env`)).status).toBe(404);
});
