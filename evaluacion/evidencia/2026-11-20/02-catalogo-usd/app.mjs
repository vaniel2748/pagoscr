import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  DemoAdapter,
  InMemoryPaymentStore,
  PaymentError,
  addCents,
  assertCurrency,
  parseMajorUnits,
  processWebhook,
} from 'pagoscr';
import catalogoOriginal from './catalogo.json' with { type: 'json' };

const catalogo = Object.freeze(catalogoOriginal);
export { catalogo };

function referenciaUnica(entrada, campo) {
  if (
    entrada === null || typeof entrada !== 'object' || Array.isArray(entrada) ||
    Object.keys(entrada).length !== 1 || !Object.hasOwn(entrada, campo) ||
    typeof entrada[campo] !== 'string' || entrada[campo].length === 0
  ) {
    throw new PaymentError(
      'INVALID_INPUT',
      `Envía únicamente ${campo}; el servidor decide el monto, la moneda y el estado.`,
    );
  }
  return entrada[campo];
}

/** Servicio de backend demo. Sus registros en memoria no sobreviven un reinicio. */
export function crearAppPagos() {
  const proveedor = new DemoAdapter();
  const almacen = new InMemoryPaymentStore();
  const ordenes = new Map();
  const creaciones = new Map();
  const referenciasPago = new Map();
  const notificaciones = new Map();

  async function obtenerPago(pagoId) {
    const referencia = referenciasPago.get(pagoId);
    if (!referencia) throw new PaymentError('PAYMENT_NOT_FOUND', 'El pago no existe.');
    const pago = await almacen.findPayment('demo', referencia);
    if (!pago) throw new PaymentError('PAYMENT_NOT_FOUND', 'El pago no existe.');
    return Object.freeze({ ...pago });
  }

  function crearOrden(entrada) {
    const productoId = referenciaUnica(entrada, 'productoId');
    if (productoId !== catalogo.id) {
      throw new PaymentError('INVALID_INPUT', 'El producto no existe en el catálogo.');
    }
    const orden = Object.freeze({
      ordenId: `orden_${randomUUID()}`,
      productoId,
      descripcion: catalogo.nombre,
      amountCents: addCents(
        parseMajorUnits(catalogo.precioTexto),
        parseMajorUnits(catalogo.envioTexto),
      ),
      currency: assertCurrency(catalogo.moneda),
    });
    ordenes.set(orden.ordenId, orden);
    return orden;
  }

  async function crearCobro(entrada) {
    const ordenId = referenciaUnica(entrada, 'ordenId');
    const orden = ordenes.get(ordenId);
    if (!orden) throw new PaymentError('INVALID_INPUT', 'La orden no existe en el servidor.');

    // Una única creación por orden, también ante llamadas concurrentes.
    // Se conserva una respuesta incierta para evitar reintentos ciegos.
    if (!creaciones.has(ordenId)) {
      creaciones.set(ordenId, (async () => {
        const pagoId = `pago_${randomUUID()}`;
        const cobro = await proveedor.createCharge({
          paymentId: pagoId,
          amountCents: orden.amountCents,
          currency: orden.currency,
          description: orden.descripcion,
        });
        await almacen.savePayment(Object.freeze({
          paymentId: pagoId,
          provider: proveedor.name,
          providerPaymentId: cobro.providerPaymentId,
          amountCents: orden.amountCents,
          currency: orden.currency,
          status: cobro.status,
        }));
        referenciasPago.set(pagoId, cobro.providerPaymentId);
        return pagoId;
      })());
    }
    return obtenerPago(await creaciones.get(ordenId));
  }

  /** Solo el servidor de pruebas genera esta notificación; no es una ruta pública. */
  async function confirmarCobroDemo(entrada) {
    const pagoId = referenciaUnica(entrada, 'pagoId');
    const pendiente = await obtenerPago(pagoId);
    if (!notificaciones.has(pagoId)) {
      notificaciones.set(pagoId, proveedor.simulatePayment(pendiente.providerPaymentId));
    }
    const resultado = await processWebhook(proveedor, notificaciones.get(pagoId), almacen);
    return { resultado, pago: await obtenerPago(pagoId) };
  }

  return Object.freeze({ crearOrden, crearCobro, obtenerPago, confirmarCobroDemo });
}

export async function ejecutarDemo() {
  const app = crearAppPagos();
  const orden = app.crearOrden({ productoId: 'kit-builder' });
  const pendiente = await app.crearCobro({ ordenId: orden.ordenId });
  const confirmacion = await app.confirmarCobroDemo({ pagoId: pendiente.paymentId });
  const repeticion = await app.confirmarCobroDemo({ pagoId: pendiente.paymentId });
  return { orden, pendiente, confirmacion, repeticion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await ejecutarDemo(), null, 2));
}
