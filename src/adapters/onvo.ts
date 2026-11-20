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
  verifyTimestampSignature,
} from './webhook-utils.js';

export interface OnvoOptions {
  readonly secretKey: string;
  readonly webhookSecret?: string;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
}

export interface OnvoTestPayment {
  readonly providerPaymentId: string;
  readonly amountCents: number;
  readonly currency: Currency;
  readonly status: PaymentStatus;
}

interface ApiPayment {
  id: string;
  amount: number;
  currency: Currency;
  status: string;
  receivedAmount: number;
  metadata: Record<string, unknown>;
}

export function assertOnvoTestSecretKey(
  value: unknown,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^onvo_test_secret_key_[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new PaymentError(
      'TEST_MODE_REQUIRED',
      'Configura ONVO_TEST_SECRET_KEY con una llave secreta de prueba. Las llaves live y publicables no se admiten.',
    );
  }
}

/** Adaptador de payment intents. Solo prueba; el host no es configurable. */
export class OnvoAdapter implements PaymentProvider {
  readonly name = 'onvo' as const;
  readonly #secretKey: string;
  readonly #webhookSecret: string | undefined;
  readonly #http: typeof fetch;
  readonly #clock: () => number;

  constructor(options: OnvoOptions) {
    assertOnvoTestSecretKey(options.secretKey);
    this.#secretKey = options.secretKey;
    if (
      options.webhookSecret !== undefined &&
      !/^whsec_[A-Za-z0-9_-]+$/.test(options.webhookSecret)
    ) {
      throw new PaymentError(
        'INVALID_INPUT',
        'Configura ONVO_WEBHOOK_SECRET con el secreto de firma del endpoint de prueba.',
      );
    }
    this.#webhookSecret = options.webhookSecret;
    this.#http = options.fetchImpl ?? fetch;
    this.#clock = options.clock ?? Date.now;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const charge = validateChargeInput(input);
    const payment = this.parsePayment(
      await this.request('/payment-intents', 'POST', {
        amount: charge.amountCents,
        currency: charge.currency,
        description: charge.description,
        metadata: { pagoscrPaymentId: charge.paymentId },
      }),
    );
    if (
      payment.amount !== charge.amountCents ||
      payment.currency !== charge.currency ||
      payment.metadata.pagoscrPaymentId !== charge.paymentId
    ) {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'ONVO creó una intención que no coincide con la orden del servidor. No la confirmes.',
      );
    }
    return {
      providerPaymentId: payment.id,
      status: 'pending',
      clientAction: { type: 'none' },
    };
  }

  /** El método debe estar tokenizado. Esta operación no actualiza la orden. */
  async confirmTestCharge(
    providerPaymentId: string,
    paymentMethodId: string,
  ): Promise<void> {
    this.requireReference(providerPaymentId);
    this.requireReference(paymentMethodId);
    const payment = this.parsePayment(
      await this.request(
        `/payment-intents/${providerPaymentId}/confirm`,
        'POST',
        { paymentMethodId },
      ),
    );
    if (payment.id !== providerPaymentId)
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'ONVO devolvió una intención distinta a la solicitada.',
      );
  }

  /** Consulta de servidor; devuelve solo datos normalizados y nunca tokens. */
  async getTestPayment(providerPaymentId: string): Promise<OnvoTestPayment> {
    this.requireReference(providerPaymentId);
    const payment = this.parsePayment(
      await this.request(`/payment-intents/${providerPaymentId}`, 'GET'),
    );
    if (payment.id !== providerPaymentId)
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'ONVO devolvió una intención distinta a la solicitada.',
      );
    if (
      payment.status === 'succeeded' &&
      payment.receivedAmount !== payment.amount
    ) {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'ONVO no confirmó la recepción completa del monto esperado.',
      );
    }
    const status: PaymentStatus =
      payment.status === 'succeeded'
        ? 'succeeded'
        : ['failed', 'canceled'].includes(payment.status)
          ? 'failed'
          : 'pending';
    return {
      providerPaymentId: payment.id,
      amountCents: payment.amount,
      currency: payment.currency,
      status,
    };
  }

  peekWebhookReference(rawBody: Uint8Array): string | null {
    try {
      const body = parseWebhookJson(rawBody);
      return isRecord(body.data) &&
        isRecord(body.data.object) &&
        isReference(body.data.object.id)
        ? body.data.object.id
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
    if (!this.#webhookSecret)
      throw new PaymentError(
        'INVALID_INPUT',
        'Configura ONVO_WEBHOOK_SECRET del endpoint de prueba antes de verificar webhooks.',
      );
    verifyTimestampSignature(
      request.rawBody,
      headerValue(request.headers, 'x-onvo-signature'),
      this.#webhookSecret,
      this.#clock(),
    );
    const body = parseWebhookJson(request.rawBody);
    if (body.mode !== 'test')
      throw new PaymentError(
        'TEST_MODE_REQUIRED',
        'El webhook debe pertenecer al modo de prueba de ONVO.',
      );
    if (
      body.type !== 'payment_intent.succeeded' &&
      body.type !== 'payment_intent.failed'
    ) {
      throw new PaymentError(
        'UNSUPPORTED_EVENT',
        'Configura eventos payment_intent.succeeded y payment_intent.failed en el endpoint de ONVO.',
      );
    }
    if (
      expected.provider !== this.name ||
      !isReference(body.id) ||
      !isRecord(body.data) ||
      !isRecord(body.data.object)
    ) {
      throw new PaymentError(
        'MALFORMED_WEBHOOK',
        'El sobre de ONVO necesita id, modo test y data.object de la intención.',
      );
    }
    const object = body.data.object;
    const succeeded = body.type === 'payment_intent.succeeded';
    if (
      object.object !== 'payment_intent' ||
      !isReference(object.id) ||
      (succeeded
        ? object.status !== 'succeeded'
        : !['requires_payment_method', 'failed'].includes(
            String(object.status),
          ))
    ) {
      throw new PaymentError(
        'MALFORMED_WEBHOOK',
        'El recurso o estado del evento ONVO no corresponde a su tipo.',
      );
    }
    const event: VerifiedWebhookEvent = {
      providerEventId: body.id,
      providerPaymentId: object.id,
      amountCents: assertCents(object.amount),
      currency: assertCurrency(object.currency),
      status: succeeded ? 'succeeded' : 'failed',
    };
    assertEventMatches(event, expected);
    const confirmed = this.parsePayment(
      await this.request(`/payment-intents/${event.providerPaymentId}`, 'GET'),
    );
    const stateMatches = succeeded
      ? confirmed.status === 'succeeded' &&
        confirmed.receivedAmount === expected.amountCents
      : ['requires_payment_method', 'failed'].includes(confirmed.status);
    if (
      confirmed.id !== expected.providerPaymentId ||
      confirmed.amount !== expected.amountCents ||
      confirmed.currency !== expected.currency ||
      confirmed.metadata.pagoscrPaymentId !== expected.paymentId ||
      !stateMatches
    ) {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'La API de ONVO no confirmó el estado, monto, moneda y referencia de la orden. Reintenta tras revisar el pago.',
      );
    }
    return event;
  }

  private requireReference(id: string): void {
    if (!isReference(id))
      throw new PaymentError(
        'INVALID_INPUT',
        'Indica una referencia válida de ONVO. No envíes datos de tarjeta.',
      );
  }

  private parsePayment(data: Record<string, unknown>): ApiPayment {
    if (data.mode !== 'test')
      throw new PaymentError(
        'TEST_MODE_REQUIRED',
        'La respuesta de ONVO debe pertenecer al modo de prueba.',
      );
    if (
      !isReference(data.id) ||
      typeof data.status !== 'string' ||
      !isRecord(data.metadata)
    ) {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'ONVO devolvió una intención incompleta. Revisa el contrato y la configuración.',
      );
    }
    return {
      id: data.id,
      status: data.status,
      amount: assertCents(data.amount),
      currency: assertCurrency(data.currency),
      receivedAmount: assertCents(data.receivedAmount),
      metadata: data.metadata,
    };
  }

  private async request(
    path: string,
    method: 'POST' | 'GET',
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.#http(`https://api.onvopay.com/v1${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(6000),
        headers: {
          Authorization: `Bearer ${this.#secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'No se pudo contactar ONVO en seis segundos. Revisa la conexión; consulta la orden antes de crear otro cobro.',
      );
    }
    if (!response.ok)
      throw new PaymentError(
        'GATEWAY_ERROR',
        `ONVO respondió HTTP ${response.status}. Revisa el modo de prueba y los permisos en el panel.`,
      );
    try {
      const data: unknown = await response.json();
      if (isRecord(data)) return data;
    } catch {
      /* No propagar cuerpos ni mensajes externos. */
    }
    throw new PaymentError(
      'GATEWAY_ERROR',
      'ONVO devolvió una respuesta JSON no válida. Reintenta tras revisar su disponibilidad.',
    );
  }
}
