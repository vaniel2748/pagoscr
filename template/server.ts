import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { DemoAdapter } from '../src/adapters/demo.js';
import { OnvoAdapter, type OnvoOptions } from '../src/adapters/onvo.js';
import { InMemoryPaymentStore } from '../src/core/memory-store.js';
import { PaymentError } from '../src/core/errors.js';
import { formatMajorUnits } from '../src/core/money.js';
import { processWebhook } from '../src/core/webhook-processor.js';
import type {
  ClientAction,
  PaymentRecord,
  PaymentStore,
  WebhookRequest,
} from '../src/core/types.js';

const product = {
  id: 'kit-builder',
  nombre: 'Kit Builder',
  descripcion: 'Tu próxima idea empieza acá.',
  montoCentavos: 2_000_000,
  moneda: 'CRC' as const,
};
const cookieName = 'pagoscr_demo';
const maxBodyBytes = 4096;

interface Session {
  token: string;
  payment?: Promise<PaymentRecord>;
  action?: ClientAction;
  refresh?: Promise<PaymentRecord>;
  event?: WebhookRequest;
}
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function json(res: ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
function readRawBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    let failed = false;
    let chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        if (!failed)
          reject(new HttpError(413, `La petición excede ${limit} bytes.`));
        failed = true;
        chunks = [];
      } else if (!failed) chunks.push(chunk);
    });
    req.on('end', () => {
      if (!failed) resolve(Buffer.concat(chunks));
    });
    req.on('error', () =>
      reject(new HttpError(400, 'No se pudo leer la petición.')),
    );
  });
}
async function readJson(
  req: IncomingMessage,
): Promise<Record<string, unknown>> {
  if (
    !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')
  ) {
    req.resume();
    throw new HttpError(415, 'Envía una petición JSON.');
  }
  const body = await readRawBody(req, maxBodyBytes);
  try {
    const value: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(body),
    );
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'La petición JSON está mal formada.');
  }
}
function view(payment: PaymentRecord, action: ClientAction = { type: 'none' }) {
  return {
    id: payment.paymentId,
    estado: payment.status,
    montoCentavos: payment.amountCents,
    moneda: payment.currency,
    montoFormateado: `₡${formatMajorUnits(payment.amountCents)}`,
    pasarela: payment.provider,
    accionCliente: payment.status === 'pending' ? action : { type: 'none' },
  };
}

export interface CheckoutServerOptions {
  readonly assetsDirectory?: URL;
  readonly onvo?: Omit<OnvoOptions, 'checkout'>;
  readonly returnUrl?: string;
  readonly store?: PaymentStore;
}

/** Plantilla local de prueba: demo sin credenciales u ONVO test configurado por el servidor. */
export function createCheckoutServer(options: CheckoutServerOptions = {}) {
  const assets = options.assetsDirectory ?? new URL('./', import.meta.url);
  const provider = options.onvo
    ? new OnvoAdapter({ ...options.onvo, checkout: true })
    : new DemoAdapter();
  const store = options.store ?? new InMemoryPaymentStore();
  const sessions = new Map<string, Session>();
  const staticFiles = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/pago', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ] as const);
  const findSession = (req: IncomingMessage) => {
    const id = (req.headers.cookie ?? '')
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return id ? sessions.get(id) : undefined;
  };
  const ensureSession = (req: IncomingMessage, res: ServerResponse) => {
    const previous = findSession(req);
    if (previous) return previous;
    if (sessions.size >= 1000)
      throw new HttpError(429, 'Reinicia el demo para abrir más sesiones.');
    const id = randomBytes(24).toString('base64url');
    const session: Session = { token: randomBytes(24).toString('base64url') };
    sessions.set(id, session);
    res.setHeader(
      'set-cookie',
      `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/`,
    );
    return session;
  };
  const refreshPayment = async (
    payment: PaymentRecord,
  ): Promise<PaymentRecord> => {
    if (!(provider instanceof OnvoAdapter)) return payment;
    const confirmed = await provider.getTestCheckoutPayment(payment);
    if (confirmed.status !== 'pending')
      await store.applyVerifiedEvent(payment, {
        ...confirmed,
        status: confirmed.status,
        providerEventId: `consulta-checkout:${payment.providerPaymentId}:${confirmed.status}`,
      });
    return (await store.findPayment(provider.name, payment.providerPaymentId))!;
  };
  const currentPayment = async (
    session: Session,
    id: string,
    refresh = false,
  ) => {
    const created = await session.payment;
    if (!created || created.paymentId !== id)
      throw new HttpError(404, 'No se encontró tu orden.');
    const current = await store.findPayment(
      provider.name,
      created.providerPaymentId,
    );
    if (!current) throw new HttpError(404, 'No se encontró tu orden.');
    if (
      refresh &&
      current.status === 'pending' &&
      provider instanceof OnvoAdapter
    ) {
      session.refresh ??= refreshPayment(current);
      const refreshing = session.refresh;
      try {
        return await refreshing;
      } finally {
        if (session.refresh === refreshing) delete session.refresh;
      }
    }
    return current;
  };

  const server = createServer((req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader(
      'content-security-policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    );
    void (async () => {
      const host = req.headers.host ?? '';
      if (!/^(?:127\.0\.0\.1|localhost):\d+$/.test(host))
        throw new HttpError(403, 'Este demo se ejecuta solo en localhost.');
      const path = new URL(req.url ?? '/', `http://${host}`).pathname;
      if (
        req.method === 'POST' &&
        path === '/api/webhooks/onvo' &&
        provider instanceof OnvoAdapter
      ) {
        const rawBody = await readRawBody(req, 65_536);
        const signature = req.headers['x-onvo-signature'];
        try {
          const request = {
            rawBody,
            headers: {
              'X-Onvo-Signature':
                typeof signature === 'string' ? signature : undefined,
            },
          };
          if (provider.verifyConnectionTest(request)) {
            json(res, { ok: true, conexion: true });
            return;
          }
          const result = await processWebhook(provider, request, store);
          json(res, {
            ok: true,
            estado: result.status,
            duplicado: result.duplicate,
          });
        } catch (error) {
          if (!(error instanceof PaymentError)) throw error;
          throw new HttpError(
            error.code === 'GATEWAY_ERROR'
              ? 503
              : error.code === 'INVALID_SIGNATURE'
                ? 401
                : 400,
            'No se pudo verificar el aviso de ONVO. Revisa firma, referencia y estado de prueba; un fallo de API permite reintentar.',
          );
        }
        return;
      }
      const file = staticFiles.get(
        path as '/' | '/pago' | '/app.js' | '/styles.css',
      );
      if (req.method === 'GET' && file) {
        const contents = await readFile(new URL(file[0], assets));
        res.writeHead(200, { 'content-type': file[1] });
        res.end(contents);
        return;
      }
      if (req.method === 'GET' && path === '/api/catalogo') {
        const session = ensureSession(req, res);
        const payment = await session.payment;
        json(res, {
          pasarela: provider.name,
          producto: {
            ...product,
            montoFormateado: `₡${formatMajorUnits(product.montoCentavos)}`,
          },
          csrfToken: session.token,
          pago: payment
            ? view(
                await currentPayment(session, payment.paymentId, true),
                session.action,
              )
            : null,
        });
        return;
      }
      const route =
        /^\/api\/cobros\/([A-Za-z0-9_-]{1,128})(\/confirmar-demo)?$/.exec(path);
      if (req.method === 'GET' && route && !route[2]) {
        const session = findSession(req);
        if (!session) throw new HttpError(404, 'No se encontró tu orden.');
        json(res, {
          pago: view(
            await currentPayment(session, route[1]!, true),
            session.action,
          ),
        });
        return;
      }
      if (req.method !== 'POST' || (path !== '/api/cobros' && !route?.[2]))
        throw new HttpError(404, 'Ruta no encontrada.');
      const session = findSession(req);
      if (
        !session ||
        req.headers.origin !== `http://${host}` ||
        req.headers['x-pagoscr-csrf'] !== session.token
      ) {
        req.resume();
        throw new HttpError(
          403,
          'Recarga el checkout para iniciar tu sesión local.',
        );
      }
      const body = await readJson(req);
      if (path === '/api/cobros') {
        if (Object.keys(body).length !== 1 || body.producto !== product.id)
          throw new HttpError(
            400,
            'Selecciona el producto del catálogo; el servidor calcula el precio.',
          );
        session.payment ??= (async () => {
          const order = {
            paymentId: randomUUID(),
            amountCents: product.montoCentavos,
            currency: product.moneda,
            description: product.nombre,
            ...(options.returnUrl ? { returnUrl: options.returnUrl } : {}),
          };
          const charge = await provider.createCharge(order);
          const payment: PaymentRecord = {
            ...order,
            provider: provider.name,
            providerPaymentId: charge.providerPaymentId,
            status: charge.status,
          };
          await store.savePayment(payment);
          session.action = charge.clientAction;
          return payment;
        })();
        const payment = await session.payment;
        json(res, {
          pago: view(
            await currentPayment(session, payment.paymentId),
            session.action,
          ),
        });
        return;
      }
      if (!(provider instanceof DemoAdapter))
        throw new HttpError(
          404,
          'La simulación demo no está disponible en ONVO.',
        );
      if (Object.keys(body).length !== 0)
        throw new HttpError(
          400,
          'La confirmación demo no acepta monto ni estado del navegador.',
        );
      const payment = await currentPayment(session, route![1]!);
      session.event ??= provider.simulatePayment(payment.providerPaymentId);
      const result = await processWebhook(provider, session.event, store);
      json(res, {
        pago: view(await currentPayment(session, payment.paymentId)),
        duplicado: result.duplicate,
      });
    })().catch((error: unknown) => {
      if (!res.headersSent)
        json(
          res,
          {
            error:
              error instanceof HttpError
                ? error.message
                : 'No se pudo consultar el pago. Conservamos tu orden; volvé a consultar antes de crear otro cobro.',
          },
          error instanceof HttpError ? error.status : 500,
        );
      else res.end();
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5000;
  server.maxConnections = 64;
  return server;
}
