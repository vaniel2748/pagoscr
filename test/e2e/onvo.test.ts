import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  OnvoAdapter,
  assertOnvoTestSecretKey,
} from '../../src/adapters/onvo.js';
import { isRecord, isReference } from '../../src/core/validation.js';

// Dos condiciones: llave de prueba y opt-in explícito. Nunca carga archivos .env.
const enabled =
  process.env.PAGOSCR_RUN_ONVO_E2E === '1' &&
  Boolean(process.env.ONVO_TEST_SECRET_KEY);

describe.skipIf(!enabled)('ONVO: API real en modo de prueba', () => {
  it('crea un método ficticio, cobra ₡20000 y consulta el pago confirmado', async () => {
    const secretKey = process.env.ONVO_TEST_SECRET_KEY;
    assertOnvoTestSecretKey(secretKey);

    // Único lugar del proyecto que envía una tarjeta: solo la ficticia documentada
    // por ONVO, con llave test validada antes de cualquier solicitud.
    // https://docs.onvopay.com/payments/testing
    let method: unknown;
    try {
      const response = await fetch(
        'https://api.onvopay.com/v1/payment-methods',
        {
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
            customer: {
              name: 'PagosCR Prueba',
              email: 'pagoscr-test@example.com',
            },
          }),
        },
      );
      if (!response.ok)
        throw new Error('No se pudo crear el método de prueba.');
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
    const provider = new OnvoAdapter({ secretKey });
    const input = {
      paymentId: `e2e_${randomUUID()}`,
      amountCents: 2_000_000,
      currency: 'CRC' as const,
      description: 'PagosCR: prueba autorizada sin dinero real',
    };
    const charge = await provider.createCharge(input);
    expect(charge.status).toBe('pending');
    await provider.confirmTestCharge(charge.providerPaymentId, method.id);
    let confirmed = await provider.getTestPayment(charge.providerPaymentId);
    for (
      let attempt = 0;
      attempt < 5 && confirmed.status === 'pending';
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      confirmed = await provider.getTestPayment(charge.providerPaymentId);
    }
    expect(confirmed).toEqual({
      providerPaymentId: charge.providerPaymentId,
      amountCents: input.amountCents,
      currency: input.currency,
      status: 'succeeded',
    });
  });
});
