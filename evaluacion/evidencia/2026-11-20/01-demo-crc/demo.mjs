import assert from 'node:assert/strict';
import { crearCheckout } from './app.mjs';

const checkout = crearCheckout();
const pendiente = await checkout.crearOrden({ productoId: 'kit-builder' });
assert.equal(pendiente.estado, 'pending');
const notificacion = await checkout.simularNotificacion(pendiente.id);
// Simular no modifica la orden. La firma y el contexto aún deben verificarse.
assert.equal((await checkout.consultarOrden(pendiente.id)).estado, 'pending');
const aplicada = await checkout.procesarNotificacion(notificacion);
const repetida = await checkout.procesarNotificacion(notificacion);
const confirmada = await checkout.consultarOrden(pendiente.id);
assert.equal(aplicada.duplicate, false);
assert.equal(repetida.duplicate, true);
assert.equal(confirmada.estado, 'succeeded');
console.log(JSON.stringify({
  pendiente,
  notificacion: { firmada: true, duplicada: repetida.duplicate },
  confirmadaDesdeAlmacen: confirmada,
}, null, 2));
