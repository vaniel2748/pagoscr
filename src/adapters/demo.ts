import { randomBytes, randomUUID } from 'node:crypto';
import { PaymentError } from '../core/errors.js';
import { assertCents } from '../core/money.js';
import type { PaymentProvider } from '../core/payment-provider.js';
import type {
  CreateChargeInput,
  CreateChargeResult,
  Currency,
  PaymentRecord,
  PaymentStatus,
  VerifiedWebhookEvent,
  WebhookRequest,
} from '../core/types.js';
import {
  assertCurrency,
  assertEventMatches,
  isRecord,
  isReference,
  validateChargeInput,
  validateWebhookRequest,
} from '../core/validation.js';
import {
  headerValue,
  parseWebhookJson,
  signTimestampBody,
  verifyTimestampSignature,
} from './webhook-utils.js';

export interface DemoConfirmation {
  readonly providerPaymentId: string;
  readonly amountCents: number;
  readonly currency: Currency;
  readonly status: PaymentStatus;
}

export interface DemoOptions {
  readonly signingSecret?: string;
  readonly clock?: () => number;
  readonly lookupPayment?: (id: string) => Promise<DemoConfirmation | null>;
}

export class DemoAdapter implements PaymentProvider {
  readonly name = 'demo' as const;
  readonly #secret: string;
  readonly #clock: () => number;
  readonly #lookup: (id: string) => Promise<DemoConfirmation | null>;
  readonly #payments = new Map<string, DemoConfirmation>();

  constructor(options: DemoOptions = {}) {
    this.#secret = options.signingSecret ?? randomBytes(32).toString('hex');
    if (this.#secret.length < 16)
      throw new PaymentError(
        'INVALID_INPUT',
        'El secreto de simulación debe tener al menos 16 caracteres.',
      );
    this.#clock = options.clock ?? Date.now;
    this.#lookup =
      options.lookupPayment ?? (async (id) => this.#payments.get(id) ?? null);
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const charge = validateChargeInput(input);
    const providerPaymentId = `demo_${randomUUID()}`;
    this.#payments.set(providerPaymentId, {
      providerPaymentId,
      amountCents: charge.amountCents,
      currency: charge.currency,
      status: 'pending',
    });
    return {
      providerPaymentId,
      status: 'pending',
      clientAction: { type: 'none' },
    };
  }

  /** Operación exclusiva del servidor de pruebas. Nunca exponer como webhook público. */
  simulatePayment(
    providerPaymentId: string,
    status: 'succeeded' | 'failed' = 'succeeded',
  ): WebhookRequest {
    const payment = this.#payments.get(providerPaymentId);
    if (!payment)
      throw new PaymentError(
        'PAYMENT_NOT_FOUND',
        'Primero crea el cobro demo que quieres simular.',
      );
    this.#payments.set(providerPaymentId, { ...payment, status });
    const rawBody = Buffer.from(
      JSON.stringify({
        id: `evt_${randomUUID()}`,
        mode: 'demo',
        data: { ...payment, status },
      }),
    );
    return {
      rawBody,
      headers: {
        'x-pagoscr-demo-signature': signTimestampBody(
          rawBody,
          this.#secret,
          this.#clock(),
        ),
      },
    };
  }

  peekWebhookReference(rawBody: Uint8Array): string | null {
    try {
      const body = parseWebhookJson(rawBody);
      return isRecord(body.data) && isReference(body.data.providerPaymentId)
        ? body.data.providerPaymentId
        : null;
    } catch {
      return null;
    }
  }

  async verifyWebhook(
    request: WebhookRequest,
    expected: PaymentRecord,
  ): Promise<VerifiedWebhookEvent> {
    validateWebhookRequest(request);
    verifyTimestampSignature(
      request.rawBody,
      headerValue(request.headers, 'x-pagoscr-demo-signature'),
      this.#secret,
      this.#clock(),
    );
    const body = parseWebhookJson(request.rawBody);
    if (
      expected.provider !== this.name ||
      body.mode !== 'demo' ||
      !isReference(body.id) ||
      !isRecord(body.data) ||
      !isReference(body.data.providerPaymentId) ||
      (body.data.status !== 'succeeded' && body.data.status !== 'failed')
    ) {
      throw new PaymentError(
        'MALFORMED_WEBHOOK',
        'El webhook demo necesita modo, evento y datos de pago válidos.',
      );
    }
    const event: VerifiedWebhookEvent = {
      providerEventId: body.id,
      providerPaymentId: body.data.providerPaymentId,
      amountCents: assertCents(body.data.amountCents),
      currency: assertCurrency(body.data.currency),
      status: body.data.status,
    };
    assertEventMatches(event, expected);
    let confirmed: DemoConfirmation | null;
    try {
      confirmed = await this.#lookup(event.providerPaymentId);
    } catch {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'La confirmación demo no está disponible. Reintenta el mismo evento.',
      );
    }
    if (
      !confirmed ||
      confirmed.providerPaymentId !== event.providerPaymentId ||
      confirmed.amountCents !== expected.amountCents ||
      confirmed.currency !== expected.currency ||
      confirmed.status !== event.status
    ) {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'El registro de confirmación demo no coincide con el pago esperado.',
      );
    }
    return event;
  }
}
