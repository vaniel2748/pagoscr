import catalogoJson from './catalogo.json' with { type: 'json' };
import {
  addCents,
  InMemoryPaymentStore,
  isReference,
  OnvoAdapter,
  parseMajorUnits,
  PaymentError,
  processWebhook,
} from 'pagoscr';

export const catalogo = Object.freeze(catalogoJson);

// El servidor es dueño de esta orden. No recibe monto, moneda o estado del cliente.
const ordenInicial = Object.freeze({
  ordenId: 'order_contract',
  usuarioId: 'builder_fixture',
  productoId: catalogo.id,
  amountCents: addCents(
    parseMajorUnits(catalogo.precioTexto),
    parseMajorUnits(catalogo.envioTexto),
  ),
  currency: catalogo.moneda,
});

export async function bloquearRed() {
  throw new Error('La red está deshabilitada: inyecta el transporte de fixtures.');
}

/** App local de evaluación: almacén en memoria, configuración y fetch inyectados. */
export function crearAppOnvo({ configuracion, fetchImpl = bloquearRed, clock }) {
  const provider = new OnvoAdapter({
    secretKey: configuracion.secretKey,
    webhookSecret: configuracion.webhookSecret,
    fetchImpl,
    clock,
  });
  const store = new InMemoryPaymentStore();
  let providerPaymentId;
  let creacionEnCurso;
  let requiereReconciliacion = false;

  function autorizar(entrada, campos = []) {
    const permitidos = new Set(['ordenId', 'usuarioId', ...campos]);
    if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)
      || Object.keys(entrada).some((campo) => !permitidos.has(campo))) {
      throw new PaymentError('INVALID_INPUT', 'Envía solo referencias de orden y método tokenizado.');
    }
    if (entrada.ordenId !== ordenInicial.ordenId
      || entrada.usuarioId !== ordenInicial.usuarioId) {
      throw new PaymentError('PAYMENT_NOT_FOUND', 'La orden no pertenece a este usuario.');
    }
  }

  async function leerOrden() {
    const pago = providerPaymentId
      ? await store.findPayment('onvo', providerPaymentId)
      : null;
    return {
      ordenId: ordenInicial.ordenId,
      productoId: ordenInicial.productoId,
      amountCents: ordenInicial.amountCents,
      currency: ordenInicial.currency,
      providerPaymentId: providerPaymentId ?? null,
      status: pago?.status ?? 'pending',
      requiereReconciliacion,
    };
  }

  return {
    async obtenerOrden(entrada) {
      autorizar(entrada);
      return leerOrden();
    },

    async crearCobro(entrada) {
      autorizar(entrada);
      if (creacionEnCurso) return creacionEnCurso;
      if (requiereReconciliacion) {
        throw new PaymentError('GATEWAY_ERROR', 'La creación es incierta. Reconcilia antes de volver a cobrar.');
      }
      if (providerPaymentId) return leerOrden();
      creacionEnCurso = (async () => {
        try {
          const cobro = await provider.createCharge({
            paymentId: ordenInicial.ordenId,
            amountCents: ordenInicial.amountCents,
            currency: ordenInicial.currency,
            description: catalogo.nombre,
          });
          providerPaymentId = cobro.providerPaymentId;
          await store.savePayment({
            paymentId: ordenInicial.ordenId,
            provider: 'onvo',
            providerPaymentId,
            amountCents: ordenInicial.amountCents,
            currency: ordenInicial.currency,
            status: cobro.status,
          });
          return leerOrden();
        } catch (error) {
          requiereReconciliacion = true;
          throw error;
        } finally {
          creacionEnCurso = undefined;
        }
      })();
      return creacionEnCurso;
    },

    async confirmarMetodoTokenizado(entrada) {
      autorizar(entrada, ['paymentMethodId']);
      if (!providerPaymentId || requiereReconciliacion) {
        throw new PaymentError('INVALID_INPUT', 'Primero crea y guarda el cobro pendiente.');
      }
      if (!isReference(entrada.paymentMethodId)) {
        throw new PaymentError('INVALID_INPUT', 'Envía la referencia tokenizada, nunca datos de tarjeta.');
      }
      await provider.confirmTestCharge(providerPaymentId, entrada.paymentMethodId);
      // Confirmar no cambia la orden: solo el evento verificado puede aplicarla.
      return leerOrden();
    },

    async recibirWebhook(request) {
      // Los bytes llegan intactos. PagosCR verifica la firma y consulta la API.
      return processWebhook(provider, request, store);
    },
  };
}
