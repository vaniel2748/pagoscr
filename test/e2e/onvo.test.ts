import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  OnvoAdapter,
  assertOnvoTestSecretKey,
} from '../../src/adapters/onvo.js';
import { officialTestMethod } from './onvo-test-method.js';

// Dos condiciones: llave de prueba y opt-in explícito. Nunca carga archivos .env.
const enabled =
  process.env.PAGOSCR_RUN_ONVO_E2E === '1' &&
  Boolean(process.env.ONVO_TEST_SECRET_KEY);

describe.skipIf(!enabled)('ONVO: API real en modo de prueba', () => {
  it('crea un método ficticio, cobra ₡20000 y consulta el pago confirmado', async () => {
    const secretKey = process.env.ONVO_TEST_SECRET_KEY;
    assertOnvoTestSecretKey(secretKey);

    const paymentMethodId = await officialTestMethod(secretKey);
    const provider = new OnvoAdapter({ secretKey });
    const input = {
      paymentId: `e2e_${randomUUID()}`,
      amountCents: 2_000_000,
      currency: 'CRC' as const,
      description: 'PagosCR: prueba autorizada sin dinero real',
    };
    const charge = await provider.createCharge(input);
    expect(charge.status).toBe('pending');
    await provider.confirmTestCharge(charge.providerPaymentId, paymentMethodId);
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

  it('crea un checkout alojado, lo paga por API test y consulta sesión e intención', async () => {
    const secretKey = process.env.ONVO_TEST_SECRET_KEY;
    assertOnvoTestSecretKey(secretKey);
    const provider = new OnvoAdapter({ secretKey, checkout: true });
    const order = {
      paymentId: `e2e_checkout_${randomUUID()}`,
      amountCents: 2_000_000,
      currency: 'CRC' as const,
      description: 'PagosCR: checkout autorizado sin dinero real',
    };
    const charge = await provider.createCharge(order);
    expect(charge.status).toBe('pending');
    expect(charge.clientAction).toMatchObject({ type: 'redirect' });
    const expected = {
      ...order,
      provider: 'onvo' as const,
      providerPaymentId: charge.providerPaymentId,
      status: 'pending' as const,
    };
    expect((await provider.getTestCheckoutPayment(expected)).status).toBe(
      'pending',
    );
    const pm = await officialTestMethod(secretKey);
    // Contrato oficial ConfirmCheckoutSession: el campo es pm, no paymentMethodId.
    // Esta E2E de API no sustituye la aceptación manual en la pantalla alojada.
    let response: Response;
    try {
      response = await fetch(
        `https://api.onvopay.com/v1/checkout/sessions/${charge.providerPaymentId}/confirm`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(6000),
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ pm, setupFutureUsage: false, cvv: '123' }),
        },
      );
    } catch {
      throw new Error(
        'No se pudo confirmar el checkout ficticio. Consulta la sesión antes de repetir un cobro.',
      );
    }
    if (!response.ok)
      throw new Error(
        `La confirmación test de checkout respondió HTTP ${response.status}.`,
      );
    let confirmed = await provider.getTestCheckoutPayment(expected);
    for (
      let attempt = 0;
      attempt < 5 && confirmed.status === 'pending';
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      confirmed = await provider.getTestCheckoutPayment(expected);
    }
    expect(confirmed).toEqual({
      providerPaymentId: charge.providerPaymentId,
      amountCents: order.amountCents,
      currency: order.currency,
      status: 'succeeded',
    });
  });
});
