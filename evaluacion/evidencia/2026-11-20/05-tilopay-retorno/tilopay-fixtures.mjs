import { readFileSync } from 'node:fs';
import configuracion from './fixtures/config-sintetica.json' with { type: 'json' };
import login from './fixtures/login.json' with { type: 'json' };
import processPayment from './fixtures/process-payment.json' with { type: 'json' };
import consult from './fixtures/consult.json' with { type: 'json' };

export const retornoSintetico = readFileSync(
  new URL('./fixtures/retorno.txt', import.meta.url), 'utf8',
).trim();

// No existe fallback de red. Incluso las rutas inesperadas fallan localmente.
export function crearTransporteFixtures({ consultResponse = consult, onRequest } = {}) {
  const respuestas = structuredClone({ login, processPayment, consult: consultResponse });
  const operaciones = [];

  async function fetchImpl(input, init = {}) {
    const url = new URL(input);
    const operation = url.pathname.slice('/api/v1/'.length);
    if (url.origin !== 'https://app.tilopay.com' ||
        url.pathname !== `/api/v1/${operation}` ||
        !Object.hasOwn(respuestas, operation) || init.method !== 'POST') {
      throw new Error('Solicitud fuera del contrato de fixtures; red deshabilitada.');
    }
    const body = JSON.parse(init.body);
    if (operation === 'login') {
      if (body.apiuser !== configuracion.apiUser || body.password !== configuracion.apiPassword) {
        throw new Error('Login distinto de la configuración sintética.');
      }
    } else if (new Headers(init.headers).get('authorization') !== `bearer ${login.access_token}`) {
      throw new Error('Falta la autenticación del login sintético.');
    }
    operaciones.push(operation);
    await onRequest?.(operation, structuredClone(body));
    return Response.json(structuredClone(respuestas[operation]));
  }

  return { fetchImpl, operaciones };
}
