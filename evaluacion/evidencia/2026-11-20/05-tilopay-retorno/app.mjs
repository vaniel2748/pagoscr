import { pathToFileURL } from 'node:url';
import {
  addCents,
  InMemoryPaymentStore,
  normalizeTilopayReturn,
  parseMajorUnits,
  PaymentError,
  processWebhook,
  TilopayAdapter,
} from 'pagoscr';
import catalogo from './catalogo.json' with { type: 'json' };
import configuracion from './fixtures/config-sintetica.json' with { type: 'json' };
import { crearTransporteFixtures, retornoSintetico } from './tilopay-fixtures.mjs';

export { catalogo };
export const ORDEN_ID = 'order_contract';

// Backend de esta app de evaluación. No carga entorno ni hace solicitudes de red.
// La única orden pertenece al comprador sintético de los fixtures.
export function crearAppTilopay({ fetchImpl } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('Inyecta un fetch de fixtures; no se permite usar fetch de red.');
  }
  const orden = Object.freeze({
    paymentId: ORDEN_ID,
    amountCents: addCents(
      parseMajorUnits(catalogo.precioTexto),
      parseMajorUnits(catalogo.envioTexto),
    ),
    currency: catalogo.moneda,
    description: catalogo.nombre,
  });
  const facturacionOriginal = Object.freeze({ ...configuracion.billing });
  const provider = new TilopayAdapter({
    apiUser: configuracion.apiUser,
    apiPassword: configuracion.apiPassword,
    apiKey: configuracion.apiKey,
    testMode: configuracion.testMode,
    redirectUrl: configuracion.redirectUrl,
    billing: facturacionOriginal,
    billToEmail: facturacionOriginal.email,
    // Se conserva el valor predeterminado: verificación OrderHash V2 activa.
    fetchImpl,
  });
  const store = new InMemoryPaymentStore();
  let creacionEnCurso;
  let cobro;
  let intentoIncierto = false;

  function validarOrden(ordenId) {
    if (ordenId !== orden.paymentId) {
      throw new PaymentError('PAYMENT_NOT_FOUND', 'La orden no existe en el servidor.');
    }
  }

  async function estado(ordenId) {
    validarOrden(ordenId);
    return store.findPayment('tilopay', orden.paymentId);
  }

  async function respuestaCobro() {
    return { pago: await estado(orden.paymentId), clientAction: { ...cobro.clientAction } };
  }

  async function crearCobro(ordenId) {
    validarOrden(ordenId);
    if (cobro) return respuestaCobro();
    if (creacionEnCurso) return creacionEnCurso;
    if (intentoIncierto) {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Existe un intento incierto para esta orden. Reconcilia con consult antes de intentar otro cobro.',
      );
    }
    intentoIncierto = true;
    creacionEnCurso = (async () => {
      const creado = await provider.createCharge(orden);
      await store.savePayment({
        ...orden,
        provider: 'tilopay',
        providerPaymentId: creado.providerPaymentId,
        status: creado.status,
      });
      cobro = creado;
      intentoIncierto = false;
      return respuestaCobro();
    })();
    try {
      return await creacionEnCurso;
    } finally {
      creacionEnCurso = undefined;
    }
  }

  async function recibirRetorno(query) {
    // El nombre processWebhook es la interfaz común del paquete. Aquí se procesa
    // exclusivamente el retorno GET documentado, nunca el webhook privado.
    return processWebhook(provider, normalizeTilopayReturn(query), store);
  }

  // Handler HTTP ejecutable con Request/Response en memoria, sin abrir sockets.
  // El cliente únicamente elige una referencia de la orden autorizada de prueba.
  async function manejarSolicitud(request) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/cobros') {
        let body;
        try {
          body = await request.json();
        } catch {
          throw new PaymentError('INVALID_INPUT', 'Envía JSON con la referencia ordenId.');
        }
        if (!body || Array.isArray(body) || typeof body !== 'object' ||
            Object.keys(body).length !== 1 || typeof body.ordenId !== 'string') {
          throw new PaymentError('INVALID_INPUT', 'Envía únicamente ordenId; el servidor decide el monto.');
        }
        return Response.json(await crearCobro(body.ordenId), { status: 201 });
      }
      if (request.method === 'GET' && url.pathname === '/retorno') {
        return Response.json(await recibirRetorno(url.searchParams));
      }
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 });
    } catch (error) {
      if (error instanceof PaymentError) {
        return Response.json({ error: error.code, mensaje: error.message }, { status: 400 });
      }
      return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
    }
  }

  return { crearCobro, recibirRetorno, estado, manejarSolicitud };
}

export async function ejecutarDemo() {
  const transporte = crearTransporteFixtures();
  const app = crearAppTilopay({ fetchImpl: transporte.fetchImpl });
  const creacion = await app.crearCobro(ORDEN_ID);
  const confirmacion = await app.recibirRetorno(retornoSintetico);
  const repeticion = await app.recibirRetorno(retornoSintetico);
  return {
    alcance: 'Fixtures sintéticos, sin red ni cuenta real. Almacén en memoria.',
    creacion,
    confirmacion,
    repeticion,
    pagoFinal: await app.estado(ORDEN_ID),
    operacionesSimuladas: [...transporte.operaciones],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await ejecutarDemo(), null, 2));
}
