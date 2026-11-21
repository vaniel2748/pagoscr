import catalogo from './catalogo.json' with { type: 'json' };
import { randomUUID } from 'node:crypto';
import {
  addCents,
  DemoAdapter,
  InMemoryPaymentStore,
  parseMajorUnits,
  PaymentError,
  processWebhook,
} from 'pagoscr';

export { catalogo };

/** Cada instancia es una demostración aislada, sin red ni variables de entorno. */
export function crearCheckout() {
  const pasarela = new DemoAdapter();
  const almacen = new InMemoryPaymentStore();
  const ordenes = new Map();

  async function consultarOrden(id) {
    const orden = ordenes.get(id);
    if (!orden) throw new PaymentError('PAYMENT_NOT_FOUND', 'La orden no existe.');
    const pago = await almacen.findPayment('demo', orden.referenciaPasarela);
    if (!pago) throw new PaymentError('PAYMENT_NOT_FOUND', 'El pago no existe.');
    return {
      id,
      productoId: orden.productoId,
      referenciaPasarela: pago.providerPaymentId,
      montoCentavos: pago.amountCents,
      moneda: pago.currency,
      estado: pago.status,
    };
  }

  async function crearOrden(entrada) {
    // Rechazar campos monetarios o de estado, incluso si coinciden con el catálogo.
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)
      || Object.keys(entrada).length !== 1 || entrada.productoId !== catalogo.id) {
      throw new PaymentError('INVALID_INPUT', 'Envía únicamente productoId: kit-builder. El servidor decide monto, moneda y estado.');
    }
    const id = randomUUID();
    const montoCentavos = addCents(
      parseMajorUnits(catalogo.precioTexto),
      parseMajorUnits(catalogo.envioTexto),
    );
    const cobro = await pasarela.createCharge({
      paymentId: id,
      amountCents: montoCentavos,
      currency: catalogo.moneda,
      description: catalogo.nombre,
    });
    await almacen.savePayment({
      paymentId: id,
      provider: 'demo',
      providerPaymentId: cobro.providerPaymentId,
      amountCents: montoCentavos,
      currency: catalogo.moneda,
      status: 'pending',
    });
    ordenes.set(id, { productoId: catalogo.id, referenciaPasarela: cobro.providerPaymentId });
    return consultarOrden(id);
  }

  return {
    crearOrden,
    consultarOrden,
    procesarNotificacion: (notificacion) => processWebhook(pasarela, notificacion, almacen),
    // Solo para el proceso del servidor y las pruebas; nunca se publica como ruta.
    async simularNotificacion(id) {
      const orden = await consultarOrden(id);
      return pasarela.simulatePayment(orden.referenciaPasarela);
    },
  };
}
