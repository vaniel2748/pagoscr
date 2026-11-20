import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentRecord,
  ProviderName,
  VerifiedWebhookEvent,
  WebhookRequest,
} from './types.js';

export interface PaymentProvider {
  readonly name: ProviderName;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  /** Referencia NO autenticada. Solo permite localizar registros del servidor. */
  peekWebhookReference(rawBody: Uint8Array): string | null;
  /** Verificar firma y corroborar el pago con la API antes de devolver éxito. */
  verifyWebhook(
    request: WebhookRequest,
    expected: PaymentRecord,
  ): Promise<VerifiedWebhookEvent>;
}
