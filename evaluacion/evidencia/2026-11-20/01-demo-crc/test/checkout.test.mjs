import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { crearCheckout } from '../app.mjs';
import { crearHandler } from '../server.mjs';

// Ejecuta el mismo handler HTTP con streams, sin abrir sockets ni usar red.
async function peticion(handler, method, url, body = '', headers = {}) {
  const req = Readable.from([Buffer.from(body)]);
  Object.assign(req, { method, url, headers });
  const res = {
    writableEnded: false,
    writeHead(status, responseHeaders) { this.status = status; this.headers = responseHeaders; },
    end(value) { this.body = String(value); this.writableEnded = true; },
  };
  await handler(req, res);
  return { status: res.status, body: JSON.parse(res.body) };
}

test('crea pending, verifica notificación firmada y consulta succeeded desde el almacén', async () => {
  const checkout = crearCheckout();
  const orden = await checkout.crearOrden({ productoId: 'kit-builder' });
  assert.equal(orden.montoCentavos, 2_000_000);
  assert.equal(orden.moneda, 'CRC');
  assert.equal(orden.estado, 'pending');
  const notificacion = await checkout.simularNotificacion(orden.id);
  assert.match(notificacion.headers['x-pagoscr-demo-signature'], /^t=\d+,v1=[a-f0-9]{64}$/);
  assert.equal((await checkout.consultarOrden(orden.id)).estado, 'pending');
  const resultado = await checkout.procesarNotificacion(notificacion);
  assert.equal(resultado.duplicate, false);
  const confirmada = await checkout.consultarOrden(orden.id);
  assert.equal(confirmada.estado, 'succeeded');
  assert.equal(confirmada.montoCentavos, orden.montoCentavos);
  assert.equal(confirmada.referenciaPasarela, orden.referenciaPasarela);
  const repetida = await checkout.procesarNotificacion(notificacion);
  assert.equal(repetida.duplicate, true);
  assert.equal(repetida.status, 'succeeded');
});

test('rechaza monto, moneda o estado enviados por un cliente malicioso', async () => {
  const handler = crearHandler();
  for (const ataque of [
    { montoCentavos: 1 }, { amountCents: 1 }, { monto: 1 },
    { moneda: 'USD' }, { estado: 'succeeded' },
  ]) {
    const respuesta = await peticion(handler, 'POST', '/api/ordenes', JSON.stringify({
      productoId: 'kit-builder', ...ataque,
    }));
    assert.equal(respuesta.status, 400);
    assert.equal(respuesta.body.error, 'INVALID_INPUT');
    assert.equal(respuesta.body.id, undefined);
  }
});

test('el handler devuelve pending y la consulta posterior lee succeeded', async () => {
  const handler = crearHandler();
  const creada = await peticion(handler, 'POST', '/api/ordenes', '{"productoId":"kit-builder"}');
  assert.equal(creada.status, 201);
  assert.equal(creada.body.estado, 'pending');
  const consulta = await peticion(handler, 'GET', `/api/ordenes/${creada.body.id}`);
  assert.equal(consulta.status, 200);
  assert.equal(consulta.body.estado, 'succeeded');
  assert.equal(consulta.body.montoCentavos, 2_000_000);
});

test('una firma inválida no consume el evento ni confirma el pago', async () => {
  const checkout = crearCheckout();
  const orden = await checkout.crearOrden({ productoId: 'kit-builder' });
  const valida = await checkout.simularNotificacion(orden.id);
  const handler = crearHandler(checkout);
  const invalida = await peticion(handler, 'POST', '/webhooks/demo', valida.rawBody, {});
  assert.equal(invalida.status, 400);
  assert.equal(invalida.body.error, 'INVALID_SIGNATURE');
  assert.equal((await checkout.consultarOrden(orden.id)).estado, 'pending');
  const aplicada = await peticion(handler, 'POST', '/webhooks/demo', valida.rawBody, valida.headers);
  assert.equal(aplicada.status, 200);
  assert.equal(aplicada.body.duplicate, false);
  assert.equal((await checkout.consultarOrden(orden.id)).estado, 'succeeded');
});

test('rechaza un cuerpo alterado y entradas mal formadas sin cambiar la orden', async () => {
  const checkout = crearCheckout();
  const orden = await checkout.crearOrden({ productoId: 'kit-builder' });
  const notificacion = await checkout.simularNotificacion(orden.id);
  const cuerpo = JSON.parse(Buffer.from(notificacion.rawBody).toString());
  cuerpo.data.amountCents = 1;
  await assert.rejects(checkout.procesarNotificacion({
    ...notificacion, rawBody: Buffer.from(JSON.stringify(cuerpo)),
  }), { code: 'INVALID_SIGNATURE' });
  assert.equal((await checkout.consultarOrden(orden.id)).estado, 'pending');
  const handler = crearHandler(checkout);
  for (const body of ['{', 'null', '[]', '{"productoId":"otro"}']) {
    assert.equal((await peticion(handler, 'POST', '/api/ordenes', body)).status, 400);
  }
  assert.equal((await peticion(handler, 'POST', '/webhooks/demo', '{')).status, 400);
  assert.equal((await peticion(handler, 'GET', '/api/ordenes/desconocida')).status, 404);
  assert.equal((await checkout.consultarOrden(orden.id)).estado, 'pending');
});
