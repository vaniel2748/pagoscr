import { PaymentError } from './errors.js';
import type { PaymentProvider } from './payment-provider.js';
import type {
  PaymentStore,
  ProcessWebhookResult,
  WebhookRequest,
} from './types.js';
import {
  assertEventMatches,
  isReference,
  validateWebhookRequest,
} from './validation.js';

export async function processWebhook(
  provider: PaymentProvider,
  request: WebhookRequest,
  store: PaymentStore,
): Promise<ProcessWebhookResult> {
  validateWebhookRequest(request);
  const reference = provider.peekWebhookReference(request.rawBody);
  if (!isReference(reference)) {
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El webhook no contiene una referencia de pago válida. Revisa el cuerpo crudo.',
    );
  }
  const payment = await store.findPayment(provider.name, reference);
  if (!payment || payment.provider !== provider.name) {
    throw new PaymentError(
      'PAYMENT_NOT_FOUND',
      'No se encontró el cobro en los registros del servidor. Guarda su referencia al crearlo.',
    );
  }
  const event = await provider.verifyWebhook(request, payment);
  assertEventMatches(event, payment);
  // Aplicar y deduplicar solo después de autenticar y confirmar con la pasarela.
  return store.applyVerifiedEvent(payment, event);
}
