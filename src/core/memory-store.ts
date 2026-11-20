import { PaymentError } from './errors.js';
import { assertCents } from './money.js';
import type {
  PaymentRecord,
  PaymentStore,
  ProcessWebhookResult,
  ProviderName,
  VerifiedWebhookEvent,
} from './types.js';
import {
  assertCurrency,
  assertEventMatches,
  isReference,
} from './validation.js';

/** Solo demo y pruebas. Para producción, persistir y aplicar en una transacción. */
export class InMemoryPaymentStore implements PaymentStore {
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly paymentIds = new Set<string>();
  private readonly events = new Map<string, VerifiedWebhookEvent>();

  async savePayment(payment: PaymentRecord): Promise<void> {
    assertCents(payment.amountCents);
    assertCurrency(payment.currency);
    if (
      !isReference(payment.paymentId) ||
      !isReference(payment.providerPaymentId) ||
      payment.amountCents === 0
    ) {
      throw new PaymentError(
        'INVALID_INPUT',
        'El registro del servidor necesita referencias y un monto positivo.',
      );
    }
    const key = this.key(payment.provider, payment.providerPaymentId);
    if (this.payments.has(key) || this.paymentIds.has(payment.paymentId)) {
      throw new PaymentError(
        'DUPLICATE_PAYMENT',
        'La referencia del pago ya existe. Reutiliza el cobro registrado.',
      );
    }
    this.payments.set(key, { ...payment });
    this.paymentIds.add(payment.paymentId);
  }

  async findPayment(
    provider: ProviderName,
    providerPaymentId: string,
  ): Promise<PaymentRecord | null> {
    const payment = this.payments.get(this.key(provider, providerPaymentId));
    return payment ? { ...payment } : null;
  }

  async applyVerifiedEvent(
    payment: PaymentRecord,
    event: VerifiedWebhookEvent,
  ): Promise<ProcessWebhookResult> {
    // No hay await entre comprobar y escribir: operación atómica en este proceso.
    const key = this.key(payment.provider, payment.providerPaymentId);
    const current = this.payments.get(key);
    if (!current || current.paymentId !== payment.paymentId) {
      throw new PaymentError(
        'PAYMENT_NOT_FOUND',
        'No existe el registro de pago que se intenta actualizar.',
      );
    }
    assertEventMatches(event, current);
    const eventKey = `${payment.provider}:${event.providerEventId}`;
    const previous = this.events.get(eventKey);
    if (
      previous &&
      (previous.providerPaymentId !== event.providerPaymentId ||
        previous.amountCents !== event.amountCents ||
        previous.currency !== event.currency ||
        previous.status !== event.status)
    ) {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'La referencia del evento ya se usó con datos de pago distintos.',
      );
    }
    if (previous)
      return {
        paymentId: current.paymentId,
        status: current.status,
        duplicate: true,
      };
    const status = current.status === 'succeeded' ? 'succeeded' : event.status;
    this.payments.set(key, { ...current, status });
    this.events.set(eventKey, { ...event });
    return { paymentId: current.paymentId, status, duplicate: false };
  }

  private key(provider: ProviderName, id: string): string {
    return `${provider}:${id}`;
  }
}
