import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError } from '../core/errors.js';
import {
  assertCents,
  formatMajorUnits,
  parseMajorUnits,
} from '../core/money.js';
import type { PaymentProvider } from '../core/payment-provider.js';
import type {
  CreateChargeInput,
  CreateChargeResult,
  PaymentRecord,
  VerifiedWebhookEvent,
  WebhookRequest,
} from '../core/types.js';
import {
  isRecord,
  isReference,
  validateChargeInput,
  validateWebhookRequest,
} from '../core/validation.js';
import { parseWebhookJson } from './webhook-utils.js';

export interface TilopayBilling {
  readonly firstName: string;
  readonly lastName: string;
  readonly address: string;
  readonly address2: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly country: string;
  readonly telephone: string;
  readonly email: string;
}

export interface TilopayOptions {
  readonly apiUser: string;
  readonly apiPassword: string;
  readonly apiKey: string;
  /** El operador debe activar prueba en el panel; la llave no distingue el modo. */
  readonly testMode: boolean;
  readonly redirectUrl?: string;
  readonly billing?: TilopayBilling;
  /** Correo original del servidor para verificar retornos después de un reinicio. */
  readonly billToEmail?: string;
  /** V2 de WooCommerce por defecto; false permite solo consult explícitamente. */
  readonly requireOrderHash?: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly clock?: () => number;
}

interface ReturnFields {
  order: string;
  tpt: string;
  code: string;
  auth: string;
  orderHash: unknown;
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.length <= 128) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  return null;
}

function readReturn(body: Record<string, unknown>): ReturnFields {
  const tpt = body.tpt ?? body['tilopay-transaction'];
  if (
    !isReference(body.order) ||
    !isReference(tpt) ||
    typeof body.code !== 'string' ||
    !body.code ||
    body.code.length > 64 ||
    (body.auth !== undefined &&
      (typeof body.auth !== 'string' || body.auth.length > 128)) ||
    (body.tpt !== undefined &&
      body['tilopay-transaction'] !== undefined &&
      body.tpt !== body['tilopay-transaction'])
  ) {
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El retorno Tilopay necesita order, tpt/tilopay-transaction, code y auth coherentes.',
    );
  }
  return {
    order: body.order,
    tpt,
    code: body.code,
    auth: typeof body.auth === 'string' ? body.auth : '',
    orderHash: body.OrderHash,
  };
}

/** Backend GET: conserva solo los campos documentados y rechaza claves repetidas. */
export function normalizeTilopayReturn(
  query: URLSearchParams | string,
): WebhookRequest {
  if (typeof query === 'string' && Buffer.byteLength(query, 'utf8') > 65_536)
    throw new PaymentError(
      'MALFORMED_WEBHOOK',
      'El retorno Tilopay excede el tamaño permitido.',
    );
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  const body: Record<string, string> = {};
  for (const name of [
    'order',
    'tpt',
    'tilopay-transaction',
    'code',
    'auth',
    'OrderHash',
  ]) {
    const values = params.getAll(name);
    if (values.length > 1)
      throw new PaymentError(
        'MALFORMED_WEBHOOK',
        'El retorno Tilopay contiene parámetros duplicados.',
      );
    if (values[0] !== undefined) body[name] = values[0];
  }
  readReturn(body);
  const request = { rawBody: Buffer.from(JSON.stringify(body)), headers: {} };
  validateWebhookRequest(request);
  return request;
}

function phpEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')
    .replace(
      /[!'()*~]/g,
      (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    );
}

/** Fórmula observada en WCTilopay::computed_customer_hash, plugin oficial 3.1.3. */
function expectedOrderHash(
  fields: ReturnFields,
  payment: PaymentRecord,
  config: { user: string; password: string; key: string; email: string },
): Buffer {
  const [whole = '', fraction = ''] = formatMajorUnits(
    payment.amountCents,
  ).split('.');
  const amount = `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
  const values: Record<string, string> = {
    api_Key: config.key,
    api_user: config.user,
    orderId: fields.tpt,
    external_orden_id: fields.order,
    amount,
    currency: payment.currency,
    responseCode: fields.code,
    auth: fields.auth,
    email: config.email,
  };
  const payload = Object.entries(values)
    .map(([key, value]) => `${phpEncode(key)}=${phpEncode(value)}`)
    .join('&');
  return createHmac('sha256', `${fields.tpt}|${config.key}|${config.password}`)
    .update(payload)
    .digest();
}

function validateBilling(billing: TilopayBilling | undefined): TilopayBilling {
  if (!billing)
    throw new PaymentError(
      'INVALID_INPUT',
      'Configura los datos de facturación del comprador desde el servidor antes de crear la URL Tilopay.',
    );
  for (const key of [
    'firstName',
    'lastName',
    'address',
    'city',
    'state',
    'postalCode',
    'country',
    'telephone',
    'email',
  ] as const) {
    if (
      typeof billing[key] !== 'string' ||
      !billing[key].trim() ||
      billing[key].length > 500
    )
      throw new PaymentError(
        'INVALID_INPUT',
        'Los datos de facturación Tilopay deben estar completos y venir del servidor.',
      );
  }
  if (
    typeof billing.address2 !== 'string' ||
    billing.address2.length > 500 ||
    !/^[A-Z]{2}$/.test(billing.country) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email)
  )
    throw new PaymentError(
      'INVALID_INPUT',
      'Revisa dirección secundaria, país ISO y correo del comprador.',
    );
  return { ...billing, email: billing.email.trim().toLowerCase() };
}

export class TilopayAdapter implements PaymentProvider {
  readonly name = 'tilopay' as const;
  readonly #user: string;
  readonly #password: string;
  readonly #key: string;
  readonly #email: string | undefined;
  readonly #requireHash: boolean;
  readonly #billing: TilopayBilling | undefined;
  readonly #redirect: string | undefined;
  readonly #http: typeof fetch;
  readonly #clock: () => number;
  #token: { value: string; expiresAt: number } | undefined;
  #pendingLogin: Promise<string> | undefined;

  constructor(options: TilopayOptions) {
    if (options.testMode !== true)
      throw new PaymentError(
        'TEST_MODE_REQUIRED',
        'Activa prueba en el panel Tilopay y confirma testMode: true. Sus credenciales no distinguen producción.',
      );
    if (
      [options.apiUser, options.apiPassword, options.apiKey].some(
        (value) => typeof value !== 'string' || !value.trim(),
      )
    )
      throw new PaymentError(
        'INVALID_INPUT',
        'Configura usuario, contraseña y key Tilopay en el entorno del servidor.',
      );
    this.#user = options.apiUser;
    this.#password = options.apiPassword;
    this.#key = options.apiKey;
    this.#requireHash = options.requireOrderHash ?? true;
    this.#email = (options.billToEmail ?? options.billing?.email)
      ?.trim()
      .toLowerCase();
    if (this.#requireHash && !this.#email)
      throw new PaymentError(
        'INVALID_INPUT',
        'Configura el correo original de facturación del servidor para verificar OrderHash V2.',
      );
    this.#billing = options.billing ? { ...options.billing } : undefined;
    this.#redirect = options.redirectUrl;
    this.#http = options.fetchImpl ?? fetch;
    this.#clock = options.clock ?? Date.now;
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const charge = validateChargeInput(input);
    const billing = validateBilling(this.#billing);
    if (this.#email && billing.email !== this.#email)
      throw new PaymentError(
        'INVALID_INPUT',
        'El correo de facturación debe coincidir con el original usado para verificar el hash.',
      );
    const returnUrl = charge.returnUrl ?? this.#redirect;
    if (!returnUrl)
      throw new PaymentError(
        'INVALID_INPUT',
        'Configura una URL HTTPS de retorno GET para Tilopay.',
      );
    const validated = validateChargeInput({ ...charge, returnUrl });
    const data = await this.request(
      'processPayment',
      {
        redirect: validated.returnUrl!,
        key: this.#key,
        amount: formatMajorUnits(charge.amountCents),
        currency: charge.currency,
        orderNumber: charge.paymentId,
        capture: '1',
        subscription: '0',
        platform: 'pagoscr',
        hashVersion: 'V2',
        token_version: 'v2',
        billToFirstName: billing.firstName,
        billToLastName: billing.lastName,
        billToAddress: billing.address,
        billToAddress2: billing.address2,
        billToCity: billing.city,
        billToState: billing.state,
        billToZipPostCode: billing.postalCode,
        billToCountry: billing.country,
        billToTelephone: billing.telephone,
        billToEmail: billing.email,
      },
      await this.login(),
    );
    if (String(data.type) !== '100' || typeof data.url !== 'string')
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay no generó una URL de pago válida. Consulta la orden antes de reintentar.',
      );
    let url: URL;
    try {
      url = new URL(data.url);
    } catch {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay devolvió una URL de pago inválida.',
      );
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.hostname !== 'tilopay.com' && !url.hostname.endsWith('.tilopay.com'))
    )
      throw new PaymentError(
        'GATEWAY_ERROR',
        'La URL de pago debe usar HTTPS y pertenecer a Tilopay.',
      );
    return {
      providerPaymentId: charge.paymentId,
      status: 'pending',
      clientAction: { type: 'redirect', url: url.href },
    };
  }

  peekWebhookReference(rawBody: Uint8Array): string | null {
    try {
      return readReturn(parseWebhookJson(rawBody)).order;
    } catch {
      return null;
    }
  }

  async verifyWebhook(
    request: WebhookRequest,
    expected: PaymentRecord,
  ): Promise<VerifiedWebhookEvent> {
    validateWebhookRequest(request);
    const fields = readReturn(parseWebhookJson(request.rawBody));
    assertCents(expected.amountCents);
    if (
      expected.provider !== this.name ||
      fields.order !== expected.providerPaymentId ||
      fields.order !== expected.paymentId
    )
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'El retorno no corresponde a la orden del servidor.',
      );
    if (this.#requireHash || (fields.orderHash !== undefined && this.#email)) {
      if (
        typeof fields.orderHash !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(fields.orderHash) ||
        !this.#email
      )
        throw new PaymentError(
          'INVALID_SIGNATURE',
          'Falta un OrderHash V2 válido para el retorno Tilopay.',
        );
      const calculated = expectedOrderHash(fields, expected, {
        user: this.#user,
        password: this.#password,
        key: this.#key,
        email: this.#email,
      });
      if (!timingSafeEqual(calculated, Buffer.from(fields.orderHash, 'hex')))
        throw new PaymentError(
          'INVALID_SIGNATURE',
          'OrderHash no coincide con el contexto de confianza del servidor.',
        );
    }
    const data = await this.request(
      'consult',
      { key: this.#key, orderNumber: expected.providerPaymentId },
      await this.login(),
    );
    if (String(data.type) !== '200' || !Array.isArray(data.response))
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay no devolvió una consulta válida. Reintenta sin cambiar la referencia de la orden.',
      );
    const matches = data.response.filter(
      (row: unknown): row is Record<string, unknown> =>
        isRecord(row) &&
        row.orderNumber === expected.providerPaymentId &&
        text(row.id_tilopay) === fields.tpt,
    );
    const row = matches[0];
    if (matches.length !== 1 || !row)
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'No existe una única transacción Tilopay con la referencia y tpt esperados.',
      );
    if (
      typeof row.environment !== 'string' ||
      row.environment.toLowerCase() !== 'test'
    )
      throw new PaymentError(
        'TEST_MODE_REQUIRED',
        'La transacción consultada debe pertenecer al entorno Test de Tilopay.',
      );
    let amount: number;
    try {
      amount = parseMajorUnits(row.amount);
    } catch {
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'Tilopay no confirmó un importe decimal textual válido.',
      );
    }
    const succeeded = fields.code === '1';
    if (
      amount !== expected.amountCents ||
      row.currency !== expected.currency ||
      text(row.code) !== fields.code ||
      text(row.auth) !== fields.auth ||
      typeof row.type !== 'string' ||
      row.type.toLowerCase() !== 'payment' ||
      (succeeded &&
        (typeof row.capture !== 'string' ||
          row.capture.toLowerCase() !== 'capture'))
    )
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'Consult no confirmó monto, moneda, resultado, autorización y captura de la orden.',
      );
    return {
      providerEventId: `${fields.tpt}:${fields.code}`,
      providerPaymentId: fields.order,
      amountCents: amount,
      currency: expected.currency,
      status: succeeded ? 'succeeded' : 'failed',
    };
  }

  /** Recuperación autenticada de servidor si el navegador no envía el retorno. */
  async lookupCapturedPayment(
    expected: PaymentRecord,
  ): Promise<VerifiedWebhookEvent | null> {
    if (
      expected.provider !== this.name ||
      !isReference(expected.providerPaymentId)
    )
      throw new PaymentError(
        'INVALID_INPUT',
        'Carga el registro original Tilopay desde el servidor antes de consultar.',
      );
    assertCents(expected.amountCents);
    const data = await this.request(
      'consult',
      { key: this.#key, orderNumber: expected.providerPaymentId },
      await this.login(),
    );
    if (String(data.type) !== '200' || !Array.isArray(data.response))
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay no devolvió una consulta válida para reconciliar la orden.',
      );
    const rows = data.response.filter(
      (row: unknown): row is Record<string, unknown> =>
        isRecord(row) && row.orderNumber === expected.providerPaymentId,
    );
    const captured = rows.filter((row) => {
      if (
        typeof row.environment !== 'string' ||
        row.environment.toLowerCase() !== 'test'
      )
        throw new PaymentError(
          'TEST_MODE_REQUIRED',
          'La recuperación Tilopay solo acepta transacciones del entorno Test.',
        );
      let amount: number;
      try {
        amount = parseMajorUnits(row.amount);
      } catch {
        return false;
      }
      return (
        amount === expected.amountCents &&
        row.currency === expected.currency &&
        text(row.code) === '1' &&
        typeof row.type === 'string' &&
        row.type.toLowerCase() === 'payment' &&
        typeof row.capture === 'string' &&
        row.capture.toLowerCase() === 'capture' &&
        isReference(text(row.id_tilopay))
      );
    });
    if (captured.length > 1)
      throw new PaymentError(
        'PAYMENT_MISMATCH',
        'Hay múltiples capturas para la orden; revisa antes de entregar.',
      );
    const row = captured[0];
    if (!row) return null;
    return {
      providerEventId: `${text(row.id_tilopay)}:1`,
      providerPaymentId: expected.providerPaymentId,
      amountCents: expected.amountCents,
      currency: expected.currency,
      status: 'succeeded',
    };
  }

  private async login(): Promise<string> {
    if (this.#token && this.#token.expiresAt > this.#clock())
      return this.#token.value;
    if (this.#pendingLogin) return this.#pendingLogin;
    this.#pendingLogin = this.performLogin();
    try {
      return await this.#pendingLogin;
    } finally {
      this.#pendingLogin = undefined;
    }
  }

  private async performLogin(): Promise<string> {
    const data = await this.request('login', {
      apiuser: this.#user,
      password: this.#password,
    });
    const seconds = data.expires_in;
    if (
      typeof data.access_token !== 'string' ||
      !data.access_token ||
      /[\r\n]/.test(data.access_token) ||
      typeof seconds !== 'number' ||
      !Number.isSafeInteger(seconds) ||
      seconds <= 0 ||
      !Number.isSafeInteger(this.#clock() + seconds * 1000)
    )
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay no devolvió un token y expires_in válidos. Revisa las credenciales de prueba.',
      );
    const ttl = seconds * 1000;
    this.#token = {
      value: data.access_token,
      expiresAt: this.#clock() + ttl - Math.min(30000, Math.floor(ttl / 10)),
    };
    return data.access_token;
  }

  private async request(
    operation: 'login' | 'processPayment' | 'consult',
    body: Record<string, unknown>,
    token?: string,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.#http(
        `https://app.tilopay.com/api/v1/${operation}`,
        {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(operation === 'login' ? 3000 : 5000),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        },
      );
    } catch {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'No se pudo contactar Tilopay dentro del tiempo permitido. Consulta la orden antes de crear otro cobro.',
      );
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        this.#token = undefined;
      throw new PaymentError(
        'GATEWAY_ERROR',
        `Tilopay respondió HTTP ${response.status}. Revisa permisos, conexión y modo de prueba.`,
      );
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay no devolvió JSON válido.',
      );
    }
    if (!isRecord(data))
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay devolvió una respuesta incompleta.',
      );
    if (['401', '403'].includes(String(data.type))) {
      this.#token = undefined;
      throw new PaymentError(
        'GATEWAY_ERROR',
        'Tilopay rechazó la autenticación. Revisa las credenciales de prueba y reintenta.',
      );
    }
    return data;
  }
}
