import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PaymentError, parseMajorUnits } from 'pagoscr';
import { crearAppTilopay, ORDEN_ID } from './app.mjs';
import { crearTransporteFixtures, retornoSintetico } from './tilopay-fixtures.mjs';
import consultOriginal from './fixtures/consult.json' with { type: 'json' };
import configuracion from './fixtures/config-sintetica.json' with { type: 'json' };

function preparar(options) {
  const transporte = crearTransporteFixtures(options);
  return { app: crearAppTilopay({ fetchImpl: transporte.fetchImpl }), transporte };
}

function errorConCodigo(code) {
  return (error) => error instanceof PaymentError && error.code === code;
}

test('crea pendiente con monto, moneda y facturación originales del servidor', async () => {
  let solicitud;
  const { app, transporte } = preparar({
    onRequest(operation, body) {
      if (operation === 'processPayment') solicitud = body;
    },
  });
  const creado = await app.crearCobro(ORDEN_ID);
  assert.equal(creado.pago.status, 'pending');
  assert.equal(creado.pago.amountCents, parseMajorUnits('20000.00'));
  assert.equal(creado.pago.currency, 'CRC');
  assert.equal(creado.pago.providerPaymentId, ORDEN_ID);
  assert.equal(creado.clientAction.type, 'redirect');
  assert.equal(solicitud.orderNumber, ORDEN_ID);
  assert.equal(solicitud.amount, '20000.00');
  assert.equal(solicitud.currency, 'CRC');
  assert.equal(solicitud.capture, '1');
  assert.equal(solicitud.hashVersion, 'V2');
  assert.equal(solicitud.redirect, configuracion.redirectUrl);
  const campos = {
    firstName: 'FirstName', lastName: 'LastName', address: 'Address', address2: 'Address2',
    city: 'City', state: 'State', postalCode: 'ZipPostCode', country: 'Country',
    telephone: 'Telephone', email: 'Email',
  };
  for (const [original, sufijo] of Object.entries(campos)) {
    assert.equal(solicitud[`billTo${sufijo}`], configuracion.billing[original]);
  }
  assert.deepEqual(transporte.operaciones, ['login', 'processPayment']);
  assert.equal((await app.estado(ORDEN_ID)).status, 'pending');
});

test('GET con hash V2 válido confirma por consult y deduplica después de verificar', async () => {
  const { app, transporte } = preparar();
  await app.crearCobro(ORDEN_ID);
  const query = new URLSearchParams(retornoSintetico);
  query.set('email', 'otro@example.com');
  query.set('amount', '0.01');
  query.set('status', 'succeeded');
  const response = await app.manejarSolicitud(new Request(`https://merchant.example/retorno?${query}`));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    paymentId: ORDEN_ID, status: 'succeeded', duplicate: false,
  });
  assert.equal((await app.estado(ORDEN_ID)).status, 'succeeded');
  assert.deepEqual(await app.recibirRetorno(retornoSintetico), {
    paymentId: ORDEN_ID, status: 'succeeded', duplicate: true,
  });
  // Se vuelve a verificar y consultar antes de reconocer el duplicado.
  assert.deepEqual(transporte.operaciones, ['login', 'processPayment', 'consult', 'consult']);
});

test('rechaza firma inválida sin consultar ni cambiar el pendiente', async () => {
  const { app, transporte } = preparar();
  await app.crearCobro(ORDEN_ID);
  const query = new URLSearchParams(retornoSintetico);
  query.set('OrderHash', '0'.repeat(64));
  await assert.rejects(app.recibirRetorno(query), errorConCodigo('INVALID_SIGNATURE'));
  assert.equal((await app.estado(ORDEN_ID)).status, 'pending');
  assert.deepEqual(transporte.operaciones, ['login', 'processPayment']);
});

test('el hash V2 predeterminado también exige firma si falta', async () => {
  const { app } = preparar();
  await app.crearCobro(ORDEN_ID);
  const query = new URLSearchParams(retornoSintetico);
  query.delete('OrderHash');
  await assert.rejects(app.recibirRetorno(query), errorConCodigo('INVALID_SIGNATURE'));
  assert.equal((await app.estado(ORDEN_ID)).status, 'pending');
});

for (const [nombre, campo, valor, code] of [
  ['monto distinto', 'amount', '19999.99', 'PAYMENT_MISMATCH'],
  ['entorno distinto', 'environment', 'Production', 'TEST_MODE_REQUIRED'],
  ['moneda distinta', 'currency', 'USD', 'PAYMENT_MISMATCH'],
  ['autorización distinta', 'auth', '654321', 'PAYMENT_MISMATCH'],
  ['sin captura', 'capture', 'Authorization', 'PAYMENT_MISMATCH'],
]) {
  test(`consult rechaza ${nombre} y conserva el pago pendiente`, async () => {
    const consultResponse = structuredClone(consultOriginal);
    consultResponse.response[0][campo] = valor;
    const { app, transporte } = preparar({ consultResponse });
    await app.crearCobro(ORDEN_ID);
    await assert.rejects(app.recibirRetorno(retornoSintetico), errorConCodigo(code));
    assert.equal((await app.estado(ORDEN_ID)).status, 'pending');
    assert.equal(transporte.operaciones.at(-1), 'consult');
  });
}

test('retorno repetido con firma alterada se rechaza incluso después del éxito', async () => {
  const { app } = preparar();
  await app.crearCobro(ORDEN_ID);
  await app.recibirRetorno(retornoSintetico);
  const query = new URLSearchParams(retornoSintetico);
  query.set('OrderHash', '0'.repeat(64));
  await assert.rejects(app.recibirRetorno(query), errorConCodigo('INVALID_SIGNATURE'));
  assert.equal((await app.estado(ORDEN_ID)).status, 'succeeded');
});

test('retorno con parámetros duplicados se rechaza antes de consultar', async () => {
  const { app, transporte } = preparar();
  await app.crearCobro(ORDEN_ID);
  await assert.rejects(
    app.recibirRetorno(`${retornoSintetico}&code=1`), errorConCodigo('MALFORMED_WEBHOOK'),
  );
  assert.deepEqual(transporte.operaciones, ['login', 'processPayment']);
});

test('creaciones concurrentes y repetidas reutilizan el mismo cobro', async () => {
  const { app, transporte } = preparar();
  const [primero, segundo] = await Promise.all([
    app.crearCobro(ORDEN_ID), app.crearCobro(ORDEN_ID),
  ]);
  assert.deepEqual(primero, segundo);
  assert.deepEqual(await app.crearCobro(ORDEN_ID), primero);
  assert.equal(transporte.operaciones.filter((operation) => operation === 'processPayment').length, 1);
});

test('el POST solo admite referencia, nunca monto ni estado del navegador', async () => {
  const { app, transporte } = preparar();
  const response = await app.manejarSolicitud(new Request('https://merchant.example/cobros', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ordenId: ORDEN_ID, amountCents: 1, status: 'succeeded' }),
  }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_INPUT');
  assert.deepEqual(transporte.operaciones, []);
  const valido = await app.manejarSolicitud(new Request('https://merchant.example/cobros', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ordenId: ORDEN_ID }),
  }));
  assert.equal(valido.status, 201);
  assert.equal((await valido.json()).pago.status, 'pending');
});

test('la orden debe existir antes de crear o aceptar el retorno', async () => {
  const { app, transporte } = preparar();
  await assert.rejects(app.crearCobro('orden_ajena'), errorConCodigo('PAYMENT_NOT_FOUND'));
  await assert.rejects(app.recibirRetorno(retornoSintetico), errorConCodigo('PAYMENT_NOT_FOUND'));
  assert.deepEqual(transporte.operaciones, []);
});

test('una creación incierta bloquea reintentos ciegos de processPayment', async () => {
  const transporte = crearTransporteFixtures({
    onRequest(operation) {
      if (operation === 'processPayment') throw new Error('Respuesta simulada perdida.');
    },
  });
  const app = crearAppTilopay({ fetchImpl: transporte.fetchImpl });
  await assert.rejects(app.crearCobro(ORDEN_ID), errorConCodigo('GATEWAY_ERROR'));
  await assert.rejects(app.crearCobro(ORDEN_ID), errorConCodigo('GATEWAY_ERROR'));
  assert.equal(transporte.operaciones.filter((operation) => operation === 'processPayment').length, 1);
});

test('no permite crear la app sin transporte inyectado', () => {
  assert.throws(() => crearAppTilopay(), /fetch de fixtures/);
});
