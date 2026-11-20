export type Currency = 'CRC' | 'USD';
export type ProviderName = 'demo' | 'onvo' | 'tilopay';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

/** Solo el servidor construye este objeto desde su orden o catálogo. */
export interface CreateChargeInput {
  readonly paymentId: string;
  readonly amountCents: number;
  readonly currency: Currency;
  readonly description: string;
  readonly returnUrl?: string;
}

export type ClientAction =
  | { readonly type: 'none' }
  | { readonly type: 'redirect'; readonly url: string };

export interface CreateChargeResult {
  readonly providerPaymentId: string;
  readonly status: 'pending';
  readonly clientAction: ClientAction;
}

export interface PaymentRecord {
  readonly paymentId: string;
  readonly provider: ProviderName;
  readonly providerPaymentId: string;
  readonly amountCents: number;
  readonly currency: Currency;
  readonly status: PaymentStatus;
}

export interface WebhookRequest {
  readonly rawBody: Uint8Array;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface VerifiedWebhookEvent {
  readonly providerEventId: string;
  readonly providerPaymentId: string;
  readonly amountCents: number;
  readonly currency: Currency;
  readonly status: 'succeeded' | 'failed';
}

export interface ProcessWebhookResult {
  readonly paymentId: string;
  readonly status: PaymentStatus;
  readonly duplicate: boolean;
}

/** Implementar unicidad y aplicación del evento en una transacción persistente. */
export interface PaymentStore {
  savePayment(payment: PaymentRecord): Promise<void>;
  findPayment(
    provider: ProviderName,
    providerPaymentId: string,
  ): Promise<PaymentRecord | null>;
  applyVerifiedEvent(
    payment: PaymentRecord,
    event: VerifiedWebhookEvent,
  ): Promise<ProcessWebhookResult>;
}
