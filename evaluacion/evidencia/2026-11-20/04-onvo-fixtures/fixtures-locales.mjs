import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import catalogo from './catalogo.json' with { type: 'json' };

export const identidadSintetica = Object.freeze({
  ordenId: 'order_contract',
  usuarioId: 'builder_fixture',
});
export const metodoTokenizadoSintetico = 'pm_fixture_tokenizado';

/** Respuestas locales exactas; nunca llama a fetch ni abre conexiones. */
export async function cargarEscenarioSintetico() {
  const leer = (nombre) => readFile(new URL(`./fixtures/${nombre}`, import.meta.url));
  const [configBytes, creadaBytes, confirmadaBytes, eventoBytes] = await Promise.all([
    leer('config-sintetica.json'),
    leer('payment-intent.created.json'),
    leer('payment-intent.succeeded.json'),
    leer('event.succeeded.json'),
  ]);
  const configuracion = JSON.parse(configBytes);
  const creada = JSON.parse(creadaBytes);
  const confirmada = JSON.parse(confirmadaBytes);
  const evento = JSON.parse(eventoBytes);
  const ahora = Date.parse(evento.createdAt);
  const peticiones = [];
  let creadaEnTransporte = false;
  let confirmadaEnTransporte = false;

  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const headers = new Headers(init.headers);
    if (url.origin !== 'https://api.onvopay.com' || url.search || url.hash) {
      throw new Error('Petición bloqueada fuera del contrato sintético.');
    }
    if (headers.get('authorization') !== `Bearer ${configuracion.secretKey}`) {
      throw new Error('La petición sintética necesita autenticación del servidor.');
    }
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    peticiones.push({ method, path: url.pathname, autenticada: true, body });

    if (method === 'POST' && url.pathname === '/v1/payment-intents') {
      const esperado = {
        amount: creada.amount,
        currency: creada.currency,
        description: catalogo.nombre,
        metadata: creada.metadata,
      };
      if (creadaEnTransporte || !isDeepStrictEqual(body, esperado)) {
        throw new Error('La creación no coincide con la orden sintética o está repetida.');
      }
      creadaEnTransporte = true;
      return new Response(creadaBytes, { status: 200 });
    }
    if (method === 'POST' && url.pathname === `/v1/payment-intents/${creada.id}/confirm`) {
      if (!creadaEnTransporte || !isDeepStrictEqual(body, { paymentMethodId: metodoTokenizadoSintetico })) {
        throw new Error('La confirmación requiere la referencia tokenizada sintética.');
      }
      confirmadaEnTransporte = true;
      return new Response(confirmadaBytes, { status: 200 });
    }
    if (method === 'GET' && url.pathname === `/v1/payment-intents/${creada.id}`) {
      if (!creadaEnTransporte || body !== undefined) {
        throw new Error('Consulta sintética sin intención creada.');
      }
      return new Response(confirmadaEnTransporte ? confirmadaBytes : creadaBytes, { status: 200 });
    }
    throw new Error('Petición bloqueada: el fixture no contempla esa operación.');
  }

  function firmarEvento(rawBody = eventoBytes) {
    const bytes = Buffer.from(rawBody);
    const timestamp = Math.floor(ahora / 1000);
    const firma = createHmac('sha256', configuracion.webhookSecret)
      .update(`${timestamp}.`)
      .update(bytes)
      .digest('hex');
    return {
      rawBody: bytes,
      headers: { 'X-Onvo-Signature': `t=${timestamp},v1=${firma}` },
    };
  }

  return {
    configuracion,
    fetchImpl,
    clock: () => ahora,
    firmarEvento,
    peticiones,
    pagoConsultado: () => structuredClone(confirmada),
  };
}
