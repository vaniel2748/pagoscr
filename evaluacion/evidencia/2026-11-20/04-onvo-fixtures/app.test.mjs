import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { bloquearRed, crearAppOnvo } from './app.mjs';
import {
  cargarEscenarioSintetico,
  identidadSintetica,
  metodoTokenizadoSintetico,
} from './fixtures-locales.mjs';

let intentosDeRedReal = 0;
globalThis.fetch = async () => {
  intentosDeRedReal += 1;
  throw new Error('Red real bloqueada en la evaluación.');
};
after(() => assert.equal(intentosDeRedReal, 0, 'Ningún flujo debe usar el fetch global.'));

function conCodigo(code) {
  return (error) => {
    assert.equal(error.code, code);
    return true;
  };
}

async function preparar(confirmar = false, transformarConsulta) {
  const escenario = await cargarEscenarioSintetico();
  const app = crearAppOnvo({
    ...escenario,
    fetchImpl: transformarConsulta
      ? async (url, init) => {
        const respuesta = await escenario.fetchImpl(url, init);
        return init.method === 'GET' ? transformarConsulta(respuesta) : respuesta;
      }
      : escenario.fetchImpl,
  });
  await app.crearCobro(identidadSintetica);
  if (confirmar) {
    await app.confirmarMetodoTokenizado({
      ...identidadSintetica,
      paymentMethodId: metodoTokenizadoSintetico,
    });
  }
  return { app, escenario };
}

test('crea pendiente, confirma método y aplica succeeded solo tras firma y consulta autenticada', async () => {
  const escenario = await cargarEscenarioSintetico();
  const app = crearAppOnvo(escenario);
  const creada = await app.crearCobro(identidadSintetica);
  assert.equal(creada.status, 'pending');
  assert.equal(creada.amountCents, 2000000);
  assert.equal(creada.currency, 'CRC');
  assert.equal(creada.providerPaymentId, 'pi_fixture_001');
  assert.equal(escenario.peticiones[0].body.metadata.pagoscrPaymentId, identidadSintetica.ordenId);

  const trasConfirmar = await app.confirmarMetodoTokenizado({
    ...identidadSintetica,
    paymentMethodId: metodoTokenizadoSintetico,
  });
  assert.equal(trasConfirmar.status, 'pending');
  assert.deepEqual(escenario.peticiones[1].body, { paymentMethodId: metodoTokenizadoSintetico });

  const request = escenario.firmarEvento();
  assert.deepEqual(await app.recibirWebhook(request), {
    paymentId: 'order_contract', status: 'succeeded', duplicate: false,
  });
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'succeeded');
  assert.deepEqual(escenario.peticiones.map(({ method, path, autenticada }) => ({ method, path, autenticada })), [
    { method: 'POST', path: '/v1/payment-intents', autenticada: true },
    { method: 'POST', path: '/v1/payment-intents/pi_fixture_001/confirm', autenticada: true },
    { method: 'GET', path: '/v1/payment-intents/pi_fixture_001', autenticada: true },
  ]);

  assert.deepEqual(await app.recibirWebhook(request), {
    paymentId: 'order_contract', status: 'succeeded', duplicate: true,
  });
  assert.equal(escenario.peticiones.at(-1).method, 'GET', 'El duplicado también debe verificarse.');
});

test('rechaza bytes alterados con la firma original antes de consultar', async () => {
  const { app, escenario } = await preparar(true);
  const original = escenario.firmarEvento();
  const evento = JSON.parse(original.rawBody);
  evento.data.object.amount = 1;
  const llamadasAntes = escenario.peticiones.length;
  await assert.rejects(app.recibirWebhook({
    ...original, rawBody: Buffer.from(JSON.stringify(evento)),
  }), conCodigo('INVALID_SIGNATURE'));
  assert.equal(escenario.peticiones.length, llamadasAntes);
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'pending');
  // El rechazo no consume el evento original.
  assert.equal((await app.recibirWebhook(original)).duplicate, false);
});

test('rechaza un monto alterado aun con firma sintética válida', async () => {
  const { app, escenario } = await preparar(true);
  const evento = JSON.parse(escenario.firmarEvento().rawBody);
  evento.data.object.amount = 1;
  await assert.rejects(
    app.recibirWebhook(escenario.firmarEvento(Buffer.from(JSON.stringify(evento)))),
    conCodigo('PAYMENT_MISMATCH'),
  );
  assert.equal(escenario.peticiones.length, 2);
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'pending');
});

test('una firma válida no aprueba si la consulta aún no confirma la captura', async () => {
  const { app, escenario } = await preparar(false);
  await assert.rejects(app.recibirWebhook(escenario.firmarEvento()), conCodigo('PAYMENT_MISMATCH'));
  assert.equal(escenario.peticiones.at(-1).method, 'GET');
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'pending');
});

test('una captura incompleta en la consulta autenticada no aplica el evento', async () => {
  const { app, escenario } = await preparar(true, async (respuesta) => {
    const pago = await respuesta.json();
    return Response.json({ ...pago, receivedAmount: 0 });
  });
  await assert.rejects(app.recibirWebhook(escenario.firmarEvento()), conCodigo('PAYMENT_MISMATCH'));
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'pending');
});

test('una consulta no disponible permite reintentar el mismo evento sin aprobar antes', async () => {
  let disponible = false;
  const { app, escenario } = await preparar(true, async (respuesta) => {
    if (!disponible) throw new Error('Fallo sintético de consulta.');
    return respuesta;
  });
  const request = escenario.firmarEvento();
  await assert.rejects(app.recibirWebhook(request), conCodigo('GATEWAY_ERROR'));
  assert.equal((await app.obtenerOrden(identidadSintetica)).status, 'pending');
  disponible = true;
  assert.deepEqual(await app.recibirWebhook(request), {
    paymentId: 'order_contract', status: 'succeeded', duplicate: false,
  });
});

for (const secretKey of ['onvo_live_secret_key_fixture', 'onvo_test_publishable_key_fixture']) {
  test(`rechaza prefijo ${secretKey.includes('live') ? 'live' : 'publicable'} antes del transporte`, async () => {
    const escenario = await cargarEscenarioSintetico();
    let llamadas = 0;
    assert.throws(() => crearAppOnvo({
      ...escenario,
      configuracion: { ...escenario.configuracion, secretKey },
      fetchImpl: async () => { llamadas += 1; throw new Error('No debe llamarse.'); },
    }), (error) => {
      assert.equal(error.code, 'TEST_MODE_REQUIRED');
      assert.equal(error.message.includes(secretKey), false);
      return true;
    });
    assert.equal(llamadas, 0);
  });
}

test('dos creaciones simultáneas y una repetición reutilizan una única intención', async () => {
  const escenario = await cargarEscenarioSintetico();
  const app = crearAppOnvo(escenario);
  const resultados = await Promise.all([
    app.crearCobro(identidadSintetica),
    app.crearCobro(identidadSintetica),
  ]);
  assert.deepEqual(resultados[0], resultados[1]);
  assert.deepEqual(await app.crearCobro(identidadSintetica), resultados[0]);
  assert.equal(escenario.peticiones.length, 1);
});

test('rechaza monto o estado del cliente y una identidad ajena antes del transporte', async () => {
  const escenario = await cargarEscenarioSintetico();
  const app = crearAppOnvo(escenario);
  await assert.rejects(app.crearCobro({ ...identidadSintetica, amountCents: 1 }), conCodigo('INVALID_INPUT'));
  await assert.rejects(app.crearCobro({ ...identidadSintetica, status: 'succeeded' }), conCodigo('INVALID_INPUT'));
  const ajena = { ...identidadSintetica, usuarioId: 'otro_usuario' };
  await assert.rejects(app.crearCobro(ajena), conCodigo('PAYMENT_NOT_FOUND'));
  await assert.rejects(app.obtenerOrden(ajena), conCodigo('PAYMENT_NOT_FOUND'));
  await assert.rejects(app.confirmarMetodoTokenizado({
    ...ajena, paymentMethodId: metodoTokenizadoSintetico,
  }), conCodigo('PAYMENT_NOT_FOUND'));
  assert.equal(escenario.peticiones.length, 0);
});

test('sin transporte inyectado bloquea la red y no reintenta una creación incierta', async () => {
  const escenario = await cargarEscenarioSintetico();
  await assert.rejects(bloquearRed(), /red está deshabilitada/);
  const app = crearAppOnvo({ configuracion: escenario.configuracion });
  await assert.rejects(app.crearCobro(identidadSintetica), conCodigo('GATEWAY_ERROR'));
  assert.equal((await app.obtenerOrden(identidadSintetica)).requiereReconciliacion, true);
  await assert.rejects(app.crearCobro(identidadSintetica), /Reconcilia/);
  assert.equal(intentosDeRedReal, 0);
});

test('el transporte local rechaza cualquier host o ruta fuera de sus fixtures', async () => {
  const escenario = await cargarEscenarioSintetico();
  await assert.rejects(escenario.fetchImpl('https://example.invalid/pago'), /bloqueada/);
  await assert.rejects(escenario.fetchImpl('https://api.onvopay.com/v1/desconocido', {
    headers: { Authorization: `Bearer ${escenario.configuracion.secretKey}` },
  }), /bloqueada/);
});
