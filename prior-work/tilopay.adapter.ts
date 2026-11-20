import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  ProviderWebhookEvent,
  WebhookVerifyContext,
} from './payment-provider.port';

export interface TilopayConfig {
  // Credenciales del portal Tilopay (admin.tilopay.com/admin/checkout).
  apiUser: string; // "API user"
  apiPassword: string; // "API password"
  apiKey: string; // "Integration key"
  // URL a la que Tilopay devuelve el navegador del comensal tras pagar.
  redirectUrl: string;
  // Email de facturacion enviado a Tilopay. Debe ser ESTABLE: forma parte del
  // hash del callback, asi que lo reusamos al verificar. Usa el correo del comercio.
  billToEmail: string;
  // Base de la API (por defecto produccion). Para sandbox usa la que te indique Tilopay.
  baseUrl?: string;
  requireProduction?: boolean;
  // Permite inyectar fetch en tests.
  fetchImpl?: typeof fetch;
}

interface LoginResponse {
  access_token?: string;
}

interface ProcessPaymentResponse {
  type?: number; // 100 = se generó el formulario de pago
  url?: string; // URL del formulario alojado (tarjeta + SINPE + wallets)
}

// Adaptador REAL para Tilopay (pasarela de Costa Rica: tarjeta, SINPE Movil y
// wallets a traves de su formulario alojado).
//
// Flujo:
//   1) login -> access_token (cacheado unos minutos).
//   2) processPayment -> { type:100, url } -> redirigimos al comensal a `url`.
//   3) Tilopay confirma por callback server-to-server. El cuerpo trae un
//      orderHash (HMAC-SHA256) que validamos con NUESTRO importe/moneda/email,
//      no con los del cuerpo: asi nadie puede falsear un pago "aprobado".
//
// Contrato derivado del plugin oficial de Tilopay para WooCommerce.
export class TilopayAdapter implements PaymentProvider {
  readonly name = 'tilopay';
  private readonly base: string;
  private readonly baseHostname: string;
  private readonly http: typeof fetch;
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: TilopayConfig) {
    const base = new URL(config.baseUrl ?? 'https://app.tilopay.com/api/v1/');
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      throw new Error('La URL de la API de Tilopay debe usar HTTPS');
    }
    this.base = base.href.replace(/\/?$/, '/');
    this.baseHostname = base.hostname;
    this.http = config.fetchImpl ?? fetch;
  }

  // Verifica que las credenciales + el endpoint funcionen (hace el login).
  // Lanza con un mensaje claro si algo falla. No mueve dinero.
  async verifyConnection(): Promise<void> {
    await this.login();
  }

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const token = await this.login();
    // orderNumber = NUESTRO paymentId: es la referencia que Tilopay devuelve en
    // el callback y la que usamos para correlacionar.
    const amount = formatAmount(input.amountCents, input.currency);
    const res = await this.http(this.base + 'processPayment', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        redirect: input.returnUrl ?? this.config.redirectUrl,
        key: this.config.apiKey,
        amount,
        currency: input.currency,
        orderNumber: input.paymentId,
        capture: 1,
        billToFirstName: 'Cliente',
        billToLastName: 'RestaurantPay',
        billToEmail: this.config.billToEmail,
        subscription: 0,
        platform: 'restaurantpay',
        hashVersion: 'V2',
        returnData: input.paymentId,
      }),
    });

    const data = (await safeJson(res)) as ProcessPaymentResponse & {
      [k: string]: unknown;
    };
    // Comparación FLEXIBLE (Tilopay puede devolver type como "100" texto), igual
    // que el plugin oficial (`100 == $result->type`).
    const typeOk = Number(data.type) === 100;
    // La URL del formulario puede venir en `url` (u otro campo según el caso).
    const payUrl =
      (typeof data.url === 'string' && data.url) ||
      (typeof data['urlPayment'] === 'string' &&
        (data['urlPayment'] as string)) ||
      '';
    if (!res.ok || !typeOk || !payUrl) {
      throw new Error(`Tilopay processPayment falló (HTTP ${res.status})`);
    }
    const redirect = new URL(payUrl);
    const isTilopay =
      redirect.hostname === 'tilopay.com' ||
      redirect.hostname.endsWith('.tilopay.com');
    if (
      redirect.protocol !== 'https:' ||
      redirect.username ||
      redirect.password ||
      (!isTilopay && redirect.hostname !== this.baseHostname)
    ) {
      throw new Error('URL de cobro de Tilopay inválida');
    }

    return {
      // Aun no tenemos el id de transaccion de Tilopay (llega en el callback);
      // correlacionamos por orderNumber = paymentId.
      providerPaymentId: input.paymentId,
      status: 'pending',
      clientAction: { type: 'redirect', url: redirect.href },
    };
  }

  peekWebhookReference(rawBody: Buffer | string): string | null {
    try {
      const body = JSON.parse(rawBody.toString());
      // En el retorno Tilopay manda `order`; en otros contextos `orderNumber`.
      return reference(body?.order ?? body?.orderNumber);
    } catch {
      return null;
    }
  }

  verifyAndParseWebhook(
    rawBody: Buffer | string,
    _signature: string | undefined,
    context?: WebhookVerifyContext,
  ): ProviderWebhookEvent {
    const body = JSON.parse(rawBody.toString());
    // Tilopay usa `order`/`OrderHash` en el redirect de retorno, y en otros
    // contextos `orderNumber`/`orderHash`. Aceptamos ambas grafías.
    const orderNumber = reference(body?.order ?? body?.orderNumber);
    const orderHash = body?.OrderHash ?? body?.orderHash;
    const code = scalar(body?.code);
    const tpt = reference(body?.tpt ?? body?.['tilopay-transaction']);
    const auth = scalar(body?.auth ?? '');
    if (
      !orderNumber ||
      !code ||
      !tpt ||
      auth === null ||
      typeof orderHash !== 'string' ||
      !/^[a-f0-9]{64}$/.test(orderHash)
    ) {
      throw new Error('Callback de Tilopay incompleto');
    }
    if (!context) {
      throw new Error('Falta el contexto del pago para verificar el callback');
    }

    // Recalculamos el HMAC EXACTAMENTE como Tilopay (clave = tpt|key|password).
    // El importe/moneda/email salen de NUESTROS registros, no del cuerpo.
    const amount = phpNumberFormat(toMajorUnits(context.amountCents), 2);
    const params: Record<string, string> = {
      api_Key: this.config.apiKey,
      api_user: this.config.apiUser,
      orderId: tpt,
      external_orden_id: orderNumber,
      amount,
      currency: context.currency,
      responseCode: code,
      auth,
      email: this.config.billToEmail,
    };
    const hashKey = `${tpt}|${this.config.apiKey}|${this.config.apiPassword}`;
    const expected = createHmac('sha256', hashKey)
      .update(httpBuildQuery(params))
      .digest('hex');

    if (!safeEqual(expected, orderHash)) {
      throw new Error('orderHash de Tilopay inválido');
    }

    return {
      // Tilopay no envia un id de evento propio: usamos tpt+code como clave de
      // idempotencia (un mismo intento puede notificarse mas de una vez).
      providerEventId: `${tpt}:${code}`,
      eventType: `payment.${code === '1' ? 'succeeded' : 'failed'}`,
      providerPaymentId: orderNumber,
      status: code === '1' ? 'succeeded' : 'failed',
      transactionReference: tpt,
      responseCode: code,
    };
  }

  async confirmWebhook(
    event: ProviderWebhookEvent,
    context: WebhookVerifyContext,
  ): Promise<void> {
    const rows = await this.consult(event.providerPaymentId);
    const match = rows.some(
      (row) =>
        this.matchesCharge(row, event.providerPaymentId, context) &&
        reference(row.id_tilopay) === event.transactionReference &&
        scalar(row.code) === event.responseCode &&
        (event.status !== 'succeeded' || this.isCaptured(row)),
    );
    if (!match)
      throw new Error(
        'La transacción consultada no coincide con el cobro esperado',
      );
  }

  async lookupCapturedPayment(
    providerPaymentId: string,
    context: WebhookVerifyContext,
  ): Promise<ProviderWebhookEvent | null> {
    const rows = await this.consult(providerPaymentId);
    const captured = rows.filter(
      (row) =>
        this.matchesCharge(row, providerPaymentId, context) &&
        this.isCaptured(row),
    );
    if (captured.length !== 1) return null;
    const transactionReference = reference(captured[0].id_tilopay);
    if (!transactionReference) return null;
    return {
      providerEventId: `${transactionReference}:1`,
      eventType: 'payment.succeeded',
      providerPaymentId,
      status: 'succeeded',
      transactionReference,
      responseCode: '1',
    };
  }

  private async consult(
    providerPaymentId: string,
  ): Promise<Record<string, unknown>[]> {
    const token = await this.login();
    const res = await this.http(this.base + 'consult', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(6_000),
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        key: this.config.apiKey,
        orderNumber: providerPaymentId,
        merchantId: '',
      }),
    });
    const data = await safeJson(res);
    if (
      !res.ok ||
      String(data.type) !== '200' ||
      !Array.isArray(data.response)
    ) {
      // Un token revocado debe volver a solicitarse en el próximo intento.
      if (res.status === 401 || res.status === 403) this.cachedToken = null;
      throw new Error('Tilopay no confirmó la transacción');
    }
    return data.response.filter(
      (row): row is Record<string, unknown> =>
        !!row && typeof row === 'object' && !Array.isArray(row),
    );
  }

  private matchesCharge(
    row: Record<string, unknown>,
    providerPaymentId: string,
    context: WebhookVerifyContext,
  ): boolean {
    return (
      row.orderNumber === providerPaymentId &&
      row.currency === context.currency &&
      cents(row.amount) === context.amountCents
    );
  }

  private isCaptured(row: Record<string, unknown>): boolean {
    const environment = scalar(row.environment)?.toLowerCase();
    return (
      scalar(row.code) === '1' &&
      scalar(row.capture)?.toLowerCase() === 'capture' &&
      scalar(row.type)?.toLowerCase() === 'payment' &&
      (!this.config.requireProduction ||
        environment === 'production' ||
        environment === 'prod')
    );
  }

  // Login con cache corto.
  private async login(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.value;
    }
    const res = await this.http(this.base + 'login', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(6_000),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: this.config.apiUser,
        password: this.config.apiPassword,
      }),
    });
    const data = (await safeJson(res)) as LoginResponse;
    if (
      !res.ok ||
      typeof data.access_token !== 'string' ||
      !data.access_token
    ) {
      throw new Error(`Tilopay login falló (HTTP ${res.status})`);
    }
    // Sin expiracion documentada: cacheamos 5 min de forma conservadora.
    this.cachedToken = {
      value: data.access_token,
      expiresAt: now + 5 * 60_000,
    };
    return data.access_token;
  }
}

// --- helpers ---

// Mantenemos centavos internos; Tilopay opera en unidades mayores con 2 decimales.
function toMajorUnits(amountCents: number): number {
  return amountCents / 100;
}

// Importe enviado a processPayment (2 decimales, sin separador de miles).
function formatAmount(amountCents: number, _currency: string): string {
  return toMajorUnits(amountCents).toFixed(2);
}

// Reproduce PHP number_format(value, 2): separador de miles "," y decimal ".".
// El hash de Tilopay se calcula con esta forma exacta.
function phpNumberFormat(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals > 0 ? `${withThousands}.${decPart}` : withThousands;
}

// Reproduce PHP http_build_query (urlencode form, espacios como "+").
// El orden es el de insercion del objeto.
function httpBuildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${phpUrlEncode(k)}=${phpUrlEncode(v)}`)
    .join('&');
}

function phpUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, '+')
    .replace(
      /[!'()*~]/g,
      (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
    );
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function scalar(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value))
    return String(value);
  if (typeof value === 'string' && value.length <= 128) return value;
  return null;
}

function reference(value: unknown): string | null {
  const text = scalar(value);
  return text && /^[A-Za-z0-9_-]+$/.test(text) ? text : null;
}

function cents(value: unknown): number | null {
  const amount = typeof value === 'number' ? String(value) : value;
  if (typeof amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(amount))
    return null;
  const [whole, fractional = ''] = amount.split('.');
  return Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
}

async function safeJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === 'object' && !Array.isArray(data))
      return data as Record<string, unknown>;
  } catch {
    // Un intermediario también puede responder con texto o HTML.
  }
  return {};
}
