import assert from 'node:assert/strict';
import test from 'node:test';
import { addCents, parseMajorUnits } from 'pagoscr';
import { catalogo, crearAppDemo } from './app.mjs';

async function preparar() {
  const app = crearAppDemo();
  const orden = await app.crearOrden({ productoId: catalogo.id });
  return { app, orden };
}

function alterarCuerpo(notificacion) {
  const cuerpo = JSON.parse(Buffer.from(notificacion.rawBody).toString('utf8'));
  cuerpo.data.amountCents = addCents(cuerpo.data.amountCents, 1);
  // Se conserva la firma original: estos bytes alterados no deben ser aceptados.
  return { ...notificacion, rawBody: Buffer.from(JSON.stringify(cuerpo)) };
}

test('el catálogo del servidor fija centavos y moneda; una orden pendiente no entrega', async () => {
  const { app, orden } = await preparar();
  assert.equal(orden.amountCents, addCents(
    parseMajorUnits(catalogo.precioTexto), parseMajorUnits(catalogo.envioTexto),
  ));
  assert.ok(Number.isSafeInteger(orden.amountCents));
  assert.equal(orden.currency, catalogo.moneda);
  assert.equal(orden.status, 'pending');
  assert.equal(orden.provider, 'demo');
  assert.equal(orden.entrega, null);
  assert.deepEqual(app.listarEntregas(), []);
  for (const entrada of [
    { productoId: catalogo.id, amountCents: 1 },
    { productoId: catalogo.id, status: 'succeeded' },
    { productoId: 'producto-inexistente' },
    null,
  ]) {
    await assert.rejects(app.crearOrden(entrada), { code: 'INVALID_INPUT' });
  }
});

test('firma inválida no entrega; dos notificaciones iguales concurrentes dejan una entrega y succeeded', async (t) => {
  const { app, orden } = await preparar();
  const notificacion = app.simularPago(orden.paymentId);
  const alterada = alterarCuerpo(notificacion);

  await assert.rejects(app.recibirNotificacion(alterada), { code: 'INVALID_SIGNATURE' });
  assert.equal(app.consultarOrden(orden.paymentId).status, 'pending');
  assert.equal(app.listarEntregas().length, 0);

  // Ambas llamadas comienzan antes de esperar a cualquiera de ellas.
  const resultados = await Promise.all([
    app.recibirNotificacion(notificacion),
    app.recibirNotificacion(notificacion),
  ]);
  assert.deepEqual(resultados.map((r) => r.duplicate).sort(), [false, true]);
  assert.ok(resultados.every((r) => r.status === 'succeeded' && r.paymentId === orden.paymentId));
  const final = app.consultarOrden(orden.paymentId);
  assert.equal(final.status, 'succeeded');
  assert.equal(app.listarEntregas().length, 1);
  assert.equal(final.entrega.ordenId, orden.paymentId);
  assert.equal(final.entrega.productoId, catalogo.id);
  assert.equal(final.entrega.estado, 'entregado');

  // Una referencia ya procesada tampoco permite saltarse la firma.
  await assert.rejects(app.recibirNotificacion(alterada), { code: 'INVALID_SIGNATURE' });
  assert.deepEqual(app.consultarOrden(orden.paymentId), final);
  assert.equal(app.listarEntregas().length, 1);
  t.diagnostic(JSON.stringify({
    pagoConfirmado: final.paymentId,
    referenciaDemo: final.providerPaymentId,
    estado: final.status,
    centavos: final.amountCents,
    moneda: final.currency,
    notificacionesConcurrentes: resultados,
    firmaAlterada: 'INVALID_SIGNATURE antes y después de confirmar',
    entregas: app.listarEntregas().length,
  }));
});

test('eventos de éxito distintos para una misma orden también conservan una sola entrega', async () => {
  const { app, orden } = await preparar();
  const primero = app.simularPago(orden.paymentId);
  const segundo = app.simularPago(orden.paymentId);
  const resultados = await Promise.all([
    app.recibirNotificacion(primero),
    app.recibirNotificacion(segundo),
  ]);
  assert.ok(resultados.every((r) => r.duplicate === false));
  assert.equal(app.consultarOrden(orden.paymentId).status, 'succeeded');
  assert.equal(app.listarEntregas().length, 1);
  const entrega = app.listarEntregas()[0];
  await app.recibirNotificacion(segundo);
  assert.deepEqual(app.listarEntregas(), [entrega]);
});

test('una notificación de éxito no basta si la confirmación independiente no coincide', async () => {
  const { app, orden } = await preparar();
  const exitoAnterior = app.simularPago(orden.paymentId);
  app.simularPago(orden.paymentId, 'failed');
  await assert.rejects(app.recibirNotificacion(exitoAnterior), { code: 'PAYMENT_MISMATCH' });
  assert.equal(app.consultarOrden(orden.paymentId).status, 'pending');
  assert.equal(app.listarEntregas().length, 0);
  const exitoConfirmado = app.simularPago(orden.paymentId);
  await app.recibirNotificacion(exitoConfirmado);
  assert.equal(app.consultarOrden(orden.paymentId).status, 'succeeded');
  assert.equal(app.listarEntregas().length, 1);
});

test('un fallo confirmado o JSON mal formado no entrega; un éxito posterior sí', async () => {
  const { app, orden } = await preparar();
  await assert.rejects(app.recibirNotificacion({
    rawBody: Buffer.from('{'), headers: {},
  }), { code: 'MALFORMED_WEBHOOK' });
  assert.equal(app.consultarOrden(orden.paymentId).status, 'pending');
  const fallo = app.simularPago(orden.paymentId, 'failed');
  const resultado = await app.recibirNotificacion(fallo);
  assert.equal(resultado.status, 'failed');
  assert.equal(app.listarEntregas().length, 0);
  await app.recibirNotificacion(app.simularPago(orden.paymentId));
  const entrega = app.listarEntregas()[0];
  const falloTardio = app.simularPago(orden.paymentId, 'failed');
  await app.recibirNotificacion(falloTardio);
  assert.equal(app.consultarOrden(orden.paymentId).status, 'succeeded');
  assert.deepEqual(app.listarEntregas(), [entrega]);
});

test('las consultas devuelven copias y el almacén de otra instancia no conserva pagos', async () => {
  const { app, orden } = await preparar();
  orden.amountCents = 1;
  orden.status = 'succeeded';
  assert.equal(app.consultarOrden(orden.paymentId).status, 'pending');
  assert.equal(app.listarEntregas().length, 0);
  const otraApp = crearAppDemo();
  assert.throws(() => otraApp.consultarOrden(orden.paymentId), { code: 'PAYMENT_NOT_FOUND' });
  assert.equal(otraApp.listarEntregas().length, 0);
});
