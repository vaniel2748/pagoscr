import { PaymentError } from './errors.js';
import { assertCents } from './money.js';
import type {
  CreateChargeInput,
  Currency,
  PaymentRecord,
  VerifiedWebhookEvent,
  WebhookRequest,
} from './types.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isReference(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function assertCurrency(value: unknown): Currency {
  if (value !== 'CRC' && value !== 'USD') {
    throw new PaymentError('INVALID_INPUT', 'La moneda debe ser CRC o USD.');
  }
  return value;
}

export function validateChargeInput(input: unknown): CreateChargeInput {
  if (!isRecord(input) || !isReference(input.paymentId)) {
    throw new PaymentError(
      'INVALID_INPUT',
      'Indica una referencia del servidor de hasta 128 letras, números, guiones o guiones bajos.',
    );
  }
  const amountCents = assertCents(input.amountCents);
  if (amountCents === 0)
    throw new PaymentError(
      'INVALID_INPUT',
      'El monto del cobro debe ser mayor que cero centavos.',
    );
  const currency = assertCurrency(input.currency);
  if (
    typeof input.description !== 'string' ||
    !input.description.trim() ||
    input.description.length > 500
  ) {
    throw new PaymentError(
      'INVALID_INPUT',
      'Indica una descripción de entre 1 y 500 caracteres.',
    );
  }
  const result: CreateChargeInput = {
    paymentId: input.paymentId,
    amountCents,
    currency,
    description: input.description.trim(),
  };
  if (input.returnUrl === undefined) return result;
  if (typeof input.returnUrl !== 'string')
    throw new PaymentError(
      'INVALID_INPUT',
      'La URL de retorno debe ser texto.',
    );
  let url: URL;
  try {
    url = new URL(input.returnUrl);
  } catch {
    throw new PaymentError(
      'INVALID_INPUT',
      'Indica una URL de retorno válida.',
    );
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new PaymentError(
      'INVALID_INPUT',
      'La URL de retorno debe usar HTTPS y no contener credenciales.',
    );
  }
  return { ...result, returnUrl: url.href };
}

export function validateWebhookRequest(input: WebhookRequest): void {
  if (
    !(input.rawBody instanceof Uint8Array) ||
    input.rawBody.byteLength === 0 ||
    input.rawBody.byteLength > 65_536
  ) {
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'Envía el cuerpo crudo del webhook, de entre 1 y 65536 bytes.',
    );
  }
}

export function assertEventMatches(
  event: VerifiedWebhookEvent,
  expected: PaymentRecord,
): void {
  assertCents(event.amountCents);
  if (
    event.providerPaymentId !== expected.providerPaymentId ||
    event.amountCents !== expected.amountCents ||
    event.currency !== expected.currency
  ) {
    throw new PaymentError(
      'PAYMENT_MISMATCH',
      'El pago no coincide con la referencia, monto o moneda del servidor.',
    );
  }
  if (
    typeof event.providerEventId !== 'string' ||
    !/^[A-Za-z0-9_:-]{1,256}$/.test(event.providerEventId) ||
    (event.status !== 'succeeded' && event.status !== 'failed')
  ) {
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El evento no tiene una referencia o estado de pago válido.',
    );
  }
}
