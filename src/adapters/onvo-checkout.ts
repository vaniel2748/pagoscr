import { PaymentError } from '../core/errors.js';
import { assertCents } from '../core/money.js';
import type {
  CreateChargeInput,
  CreateChargeResult,
  Currency,
  PaymentRecord,
  PaymentStatus,
  VerifiedWebhookEvent,
} from '../core/types.js';
import {
  assertCurrency,
  assertEventMatches,
  isRecord,
  isReference,
} from '../core/validation.js';

export type OnvoRequest = (
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

interface CheckoutOrder {
  readonly amountCents: number;
  readonly currency: Currency;
  readonly providerPaymentId?: string;
}

export function parseCheckoutSession(
  data: Record<string, unknown>,
  expected: CheckoutOrder,
) {
  if (data.mode !== 'test')
    throw new PaymentError(
      'TEST_MODE_REQUIRED',
      'La sesión de ONVO debe pertenecer al modo de prueba.',
    );
  if (
    !isReference(data.id) ||
    !['open', 'complete', 'expired'].includes(String(data.status)) ||
    !['unpaid', 'paid'].includes(String(data.paymentStatus)) ||
    !Array.isArray(data.lineItems) ||
    data.lineItems.length !== 1 ||
    !isRecord(data.lineItems[0])
  )
    throw new PaymentError(
      'GATEWAY_ERROR',
      'ONVO devolvió una sesión incompleta. Revisa el contrato del checkout.',
    );
  const item = data.lineItems[0];
  const price = isRecord(item.price) ? item.price : item;
  if (
    (expected.providerPaymentId !== undefined &&
      data.id !== expected.providerPaymentId) ||
    item.quantity !== 1 ||
    item.isQuantityAdjustable === true ||
    (price.mode !== undefined && price.mode !== 'test') ||
    (price.type !== undefined && price.type !== 'one_time') ||
    assertCents(price.unitAmount) !== expected.amountCents ||
    assertCurrency(price.currency) !== expected.currency ||
    (item.unitAmount !== undefined &&
      item.unitAmount !== expected.amountCents) ||
    (item.currency !== undefined && item.currency !== expected.currency)
  )
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'La sesión de ONVO no coincide con la referencia, cantidad, monto o moneda de la orden del servidor.',
    );
  return {
    id: data.id,
    status: data.status,
    paymentStatus: data.paymentStatus,
    paymentIntentId: data.paymentIntentId,
  };
}

export async function createTestCheckout(
  charge: CreateChargeInput,
  request: OnvoRequest,
): Promise<CreateChargeResult> {
  const data = await request('/checkout/sessions/one-time-link', 'POST', {
    lineItems: [
      {
        quantity: 1,
        unitAmount: charge.amountCents,
        currency: charge.currency,
        description: charge.description,
        isQuantityAdjustable: false,
        priceType: 'one_time',
      },
    ],
    paymentMethodTypes: ['card'],
    captureMethod: 'automatic',
    metadata: { pagoscrPaymentId: charge.paymentId },
    ...(charge.returnUrl
      ? { redirectUrl: charge.returnUrl, cancelUrl: charge.returnUrl }
      : {}),
  });
  const session = parseCheckoutSession(data, charge);
  if (session.status !== 'open' || session.paymentStatus !== 'unpaid')
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'ONVO debe crear una sesión nueva pendiente de pago. Consulta la orden antes de reintentar.',
    );
  let url: URL;
  try {
    if (typeof data.url !== 'string') throw new Error();
    url = new URL(data.url);
    if (
      url.origin !== 'https://checkout.onvopay.com' ||
      url.username ||
      url.password
    )
      throw new Error();
  } catch {
    throw new PaymentError(
      'GATEWAY_ERROR',
      'ONVO no devolvió una URL HTTPS válida de su checkout. No abras enlaces de otros dominios.',
    );
  }
  return {
    providerPaymentId: session.id,
    status: 'pending',
    clientAction: { type: 'redirect', url: url.href },
  };
}

/** La referencia persistida de sesión enlaza la orden con su intención de pago. */
export async function getTestCheckoutPayment(
  expected: PaymentRecord,
  request: OnvoRequest,
  eventPaymentIntentId?: string,
) {
  if (
    expected.provider !== 'onvo' ||
    !isReference(expected.providerPaymentId) ||
    assertCents(expected.amountCents) === 0
  )
    throw new PaymentError(
      'INVALID_INPUT',
      'Consulta una orden de ONVO guardada por el servidor, con referencia y monto válidos.',
    );
  assertCurrency(expected.currency);
  const session = parseCheckoutSession(
    await request(`/checkout/sessions/${expected.providerPaymentId}`, 'GET'),
    expected,
  );
  if (
    eventPaymentIntentId !== undefined &&
    eventPaymentIntentId !== session.paymentIntentId
  )
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'El evento y la API de ONVO indican intenciones de pago distintas para la sesión.',
    );
  let status: PaymentStatus =
    session.status === 'expired' ? 'failed' : 'pending';
  if (session.paymentStatus === 'paid') {
    if (session.status !== 'complete' || !isReference(session.paymentIntentId))
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'La sesión pagada necesita estado complete y una intención de pago válida. Vuelve a consultar ONVO.',
      );
    const payment = await request(
      `/payment-intents/${session.paymentIntentId}`,
      'GET',
    );
    if (payment.mode !== 'test')
      throw new PaymentError(
        'TEST_MODE_REQUIRED',
        'La intención vinculada al checkout debe pertenecer al modo de prueba.',
      );
    if (
      payment.id !== session.paymentIntentId ||
      assertCents(payment.amount) !== expected.amountCents ||
      assertCurrency(payment.currency) !== expected.currency ||
      payment.status !== 'succeeded' ||
      assertCents(payment.receivedAmount) !== expected.amountCents
    )
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'La API de ONVO no confirmó el monto completo, moneda y estado de la intención vinculada. Vuelve a consultar la orden.',
      );
    status = 'succeeded';
  }
  return {
    providerPaymentId: session.id,
    amountCents: expected.amountCents,
    currency: expected.currency,
    status,
  };
}

/** Se llama únicamente después de verificar firma, cuerpo crudo y modo del sobre. */
export async function verifyCheckoutEvent(
  body: Record<string, unknown>,
  expected: PaymentRecord,
  request: OnvoRequest,
): Promise<VerifiedWebhookEvent> {
  if (
    !isReference(body.id) ||
    !isRecord(body.data) ||
    !isRecord(body.data.object)
  )
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El evento de checkout necesita id y data.object.',
    );
  const object = body.data.object;
  if (
    object.object !== 'checkout_session' ||
    !isReference(object.id) ||
    object.status !== 'complete' ||
    object.paymentStatus !== 'paid' ||
    !isReference(object.paymentIntentId)
  )
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El evento debe describir una sesión complete/paid con su intención de pago.',
    );
  if (
    isRecord(object.metadata) &&
    object.metadata.pagoscrPaymentId !== undefined &&
    object.metadata.pagoscrPaymentId !== expected.paymentId
  )
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'La referencia de la orden en el evento de ONVO no coincide con el servidor.',
    );
  const event: VerifiedWebhookEvent = {
    providerEventId: body.id,
    providerPaymentId: object.id,
    amountCents: assertCents(object.amountTotal),
    currency: assertCurrency(object.currency),
    status: 'succeeded',
  };
  assertEventMatches(event, expected);
  const confirmed = await getTestCheckoutPayment(
    expected,
    request,
    object.paymentIntentId,
  );
  if (confirmed.status !== 'succeeded')
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'La API de ONVO todavía no confirmó el pago del checkout. Reintenta el aviso más tarde.',
    );
  return event;
}
