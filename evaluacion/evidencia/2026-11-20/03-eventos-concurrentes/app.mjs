import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  DemoAdapter,
  PaymentError,
  addCents,
  assertEventMatches,
  isRecord,
  parseMajorUnits,
  processWebhook,
} from 'pagoscr';
import producto from './catalogo.json' with { type: 'json' };

export const catalogo = Object.freeze({ ...producto });

/** Demo local: órdenes, eventos, entregas y secreto efímero se pierden al reiniciar. */
export function crearAppDemo() {
  const adaptador = new DemoAdapter();
  const ordenes = new Map();
  const referencias = new Map();
  const eventos = new Map();

  function obtenerOrden(id) {
    const orden = ordenes.get(id);
    if (!orden) {
      throw new PaymentError('PAYMENT_NOT_FOUND', 'La orden no existe. Crea una orden del catálogo.');
    }
    return orden;
  }

  // Puerto PaymentStore. Solo lo utiliza el procesador después de verificar firma
  // y confirmación demo. No hay await en la sección que aplica evento y entrega:
  // es atómica únicamente dentro de este proceso y su bucle de eventos.
  const almacen = {
    async savePayment(pago) {
      if (ordenes.has(pago.paymentId) || referencias.has(pago.providerPaymentId)) {
        throw new PaymentError('DUPLICATE_PAYMENT', 'El cobro ya está registrado.');
      }
      ordenes.set(pago.paymentId, {
        ...pago,
        productoId: catalogo.id,
        entrega: null,
      });
      referencias.set(pago.providerPaymentId, pago.paymentId);
    },

    async findPayment(pasarela, referencia) {
      const orden = ordenes.get(referencias.get(referencia));
      return orden?.provider === pasarela ? structuredClone(orden) : null;
    },

    async applyVerifiedEvent(pago, evento) {
      const actual = obtenerOrden(pago.paymentId);
      assertEventMatches(evento, actual);
      const clave = `${actual.provider}:${evento.providerEventId}`;
      const previo = eventos.get(clave);
      if (previo && (
        previo.providerPaymentId !== evento.providerPaymentId
        || previo.amountCents !== evento.amountCents
        || previo.currency !== evento.currency
        || previo.status !== evento.status
      )) {
        throw new PaymentError('PAYMENT_MISMATCH', 'El evento ya existe con otros datos.');
      }
      if (previo) {
        return { paymentId: actual.paymentId, status: actual.status, duplicate: true };
      }

      const status = actual.status === 'succeeded' ? 'succeeded' : evento.status;
      // La entrega pertenece a la orden: incluso dos eventos de éxito distintos
      // conservan el mismo acceso al producto y no disparan una segunda entrega.
      const entrega = actual.entrega ?? (status === 'succeeded' ? {
        id: `entrega_${randomUUID()}`,
        ordenId: actual.paymentId,
        productoId: actual.productoId,
        estado: 'entregado',
      } : null);
      eventos.set(clave, { ...evento });
      ordenes.set(actual.paymentId, { ...actual, status, entrega });
      return { paymentId: actual.paymentId, status, duplicate: false };
    },
  };

  return Object.freeze({
    async crearOrden(entrada) {
      if (!isRecord(entrada) || Object.keys(entrada).length !== 1
        || entrada.productoId !== catalogo.id) {
        throw new PaymentError(
          'INVALID_INPUT',
          'Envía únicamente productoId con una referencia del catálogo; el servidor fija el precio.',
        );
      }
      const paymentId = `orden_${randomUUID()}`;
      const amountCents = addCents(
        parseMajorUnits(catalogo.precioTexto),
        parseMajorUnits(catalogo.envioTexto),
      );
      const cobro = await adaptador.createCharge({
        paymentId,
        amountCents,
        currency: catalogo.moneda,
        description: catalogo.nombre,
      });
      await almacen.savePayment({
        paymentId,
        provider: adaptador.name,
        providerPaymentId: cobro.providerPaymentId,
        amountCents,
        currency: catalogo.moneda,
        status: cobro.status,
      });
      return structuredClone(obtenerOrden(paymentId));
    },

    consultarOrden(id) {
      return structuredClone(obtenerOrden(id));
    },

    listarEntregas() {
      return structuredClone([...ordenes.values()].flatMap((orden) => orden.entrega ? [orden.entrega] : []));
    },

    recibirNotificacion(solicitud) {
      // Se conservan los bytes crudos. Ninguna deduplicación evita la verificación.
      return processWebhook(adaptador, solicitud, almacen);
    },

    // Exclusivo del servidor de demostración/pruebas, nunca un endpoint público.
    simularPago(id, estado = 'succeeded') {
      return adaptador.simulatePayment(obtenerOrden(id).providerPaymentId, estado);
    },
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = crearAppDemo();
  const orden = await app.crearOrden({ productoId: catalogo.id });
  const notificacion = app.simularPago(orden.paymentId);
  const resultados = await Promise.all([
    app.recibirNotificacion(notificacion),
    app.recibirNotificacion(notificacion),
  ]);
  console.log(JSON.stringify({
    modo: 'demo',
    orden: app.consultarOrden(orden.paymentId),
    notificaciones: resultados,
    entregas: app.listarEntregas().length,
    almacenamiento: 'En memoria; se pierde al reiniciar.',
  }, null, 2));
}
