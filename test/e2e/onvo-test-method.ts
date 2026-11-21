import { assertOnvoTestSecretKey } from '../../src/adapters/onvo.js';
import { isRecord, isReference } from '../../src/core/validation.js';

/** Solo la tarjeta ficticia oficial; jamás datos del usuario ni argumentos MCP. */
export async function officialTestMethod(secretKey: string): Promise<string> {
  assertOnvoTestSecretKey(secretKey);
  // https://docs.onvopay.com/payments/testing
  let method: unknown;
  try {
    const response = await fetch('https://api.onvopay.com/v1/payment-methods', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'card',
        card: {
          number: '4242424242424242',
          expMonth: 12,
          expYear: new Date().getUTCFullYear() + 2,
          cvv: '123',
          holderName: 'PagosCR Prueba',
        },
        billing: { name: 'PagosCR Prueba', address: { country: 'CR' } },
        customer: { name: 'PagosCR Prueba', email: 'pagoscr-test@example.com' },
      }),
    });
    if (!response.ok) throw new Error();
    method = await response.json();
  } catch {
    throw new Error(
      'Falló la creación del método ficticio de ONVO. Revisa conexión, permisos y modo de prueba; no se muestra el cuerpo externo.',
    );
  }
  if (!isRecord(method) || !isReference(method.id))
    throw new Error(
      'ONVO no devolvió una referencia válida para el método ficticio.',
    );
  return method.id;
}
