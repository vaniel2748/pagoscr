import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogo, crearAppPagos, ejecutarDemo } from './app.mjs';

test('captura exactamente precio y envío en USD tras guardar el pendiente', async (t) => {
  const red = t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Esta demo no puede usar red.');
  });
  const app = crearAppPagos();
  const orden = app.crearOrden({ productoId: 'kit-builder' });
  const pendiente = await app.crearCobro({ ordenId: orden.ordenId });

  assert.equal(catalogo.precioTexto, '19.99');
  assert.equal(catalogo.envioTexto, '0.01');
  assert.equal(orden.amountCents, 2000);
  assert.equal(pendiente.amountCents, 2000);
  assert.equal(pendiente.currency, 'USD');
  assert.equal(pendiente.status, 'pending');
  assert.ok(pendiente.paymentId);
  assert.ok(pendiente.providerPaymentId);
  assert.deepEqual(await app.obtenerPago(pendiente.paymentId), pendiente);

  const { resultado, pago } = await app.confirmarCobroDemo({ pagoId: pendiente.paymentId });
  assert.equal(resultado.status, 'succeeded');
  assert.equal(resultado.duplicate, false);
  assert.equal(pago.paymentId, pendiente.paymentId);
  assert.equal(pago.providerPaymentId, pendiente.providerPaymentId);
  assert.equal(pago.amountCents, 2000);
  assert.equal(pago.currency, 'USD');
  assert.equal(pago.status, 'succeeded');
  assert.deepEqual(await app.obtenerPago(pago.paymentId), pago);
  assert.equal(red.mock.callCount(), 0);
});

test('rechaza un total enviado por el cliente al crear la orden o el cobro', async () => {
  const app = crearAppPagos();
  assert.throws(
    () => app.crearOrden({ productoId: 'kit-builder', total: '0.01' }),
    { code: 'INVALID_INPUT' },
  );
  const orden = app.crearOrden({ productoId: 'kit-builder' });
  await assert.rejects(
    app.crearCobro({ ordenId: orden.ordenId, total: '0.01' }),
    { code: 'INVALID_INPUT' },
  );
  const pendiente = await app.crearCobro({ ordenId: orden.ordenId });
  assert.equal(pendiente.amountCents, 2000);
  assert.equal(pendiente.currency, 'USD');
});

test('el navegador no puede cambiar centavos, moneda ni estado', async () => {
  const app = crearAppPagos();
  const orden = app.crearOrden({ productoId: 'kit-builder' });
  for (const campo of ['amountCents', 'monto', 'currency', 'moneda', 'status', 'estado']) {
    await assert.rejects(
      app.crearCobro({ ordenId: orden.ordenId, [campo]: 'alterado' }),
      { code: 'INVALID_INPUT' },
    );
  }
  const pendiente = await app.crearCobro({ ordenId: orden.ordenId });
  await assert.rejects(
    app.confirmarCobroDemo({ pagoId: pendiente.paymentId, status: 'succeeded' }),
    { code: 'INVALID_INPUT' },
  );
  assert.equal((await app.obtenerPago(pendiente.paymentId)).status, 'pending');
});

test('la misma orden concurrente genera un único pago', async () => {
  const app = crearAppPagos();
  const orden = app.crearOrden({ productoId: 'kit-builder' });
  const [primero, segundo] = await Promise.all([
    app.crearCobro({ ordenId: orden.ordenId }),
    app.crearCobro({ ordenId: orden.ordenId }),
  ]);
  assert.equal(primero.paymentId, segundo.paymentId);
  assert.equal(primero.providerPaymentId, segundo.providerPaymentId);
});

test('la notificación repetida se deduplica y conserva la captura', async () => {
  const { pendiente, confirmacion, repeticion } = await ejecutarDemo();
  assert.equal(confirmacion.resultado.duplicate, false);
  assert.equal(repeticion.resultado.duplicate, true);
  assert.equal(repeticion.resultado.status, 'succeeded');
  assert.equal(repeticion.pago.paymentId, pendiente.paymentId);
  assert.deepEqual(repeticion.pago, confirmacion.pago);
});

test('rechaza referencias desconocidas sin crear ni confirmar pagos', async () => {
  const app = crearAppPagos();
  assert.throws(() => app.crearOrden({ productoId: 'otro' }), { code: 'INVALID_INPUT' });
  await assert.rejects(app.crearCobro({ ordenId: 'otra' }), { code: 'INVALID_INPUT' });
  await assert.rejects(
    app.confirmarCobroDemo({ pagoId: 'otro' }),
    { code: 'PAYMENT_NOT_FOUND' },
  );
});
