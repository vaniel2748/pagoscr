import { createHmac } from 'node:crypto';
import login from '../fixtures/tilopay/login.json' with { type: 'json' };
import checkout from '../fixtures/tilopay/process-payment.json' with { type: 'json' };
import consult from '../fixtures/tilopay/consult.json' with { type: 'json' };
import type { Currency } from '../../src/core/types.js';

export const tilopayConfig = {
  apiUser: 'usuario-ficticio',
  apiPassword: 'clave-ficticia-solo-fixtures',
  apiKey: 'clave-integracion-ficticia',
  testMode: true,
  redirectUrl: 'https://merchant.example/retorno',
  billing: {
    firstName: 'Cliente',
    lastName: 'Prueba',
    address: 'Dirección de prueba',
    address2: '',
    city: 'San José',
    state: 'CR-SJ',
    postalCode: '10101',
    country: 'CR',
    telephone: '88888888',
    email: 'cliente@example.com',
  },
};
export const tilopayLoginFixture = structuredClone(login);
export const tilopayCheckoutFixture = structuredClone(checkout);
export const tilopayConsultFixture = structuredClone(consult);

// Fórmula del plugin oficial con valores ficticios. El vector base fue calculado
// también con Python/hmac de forma independiente: a0a66c8d...b6244ed9.
export function signedTilopayReturn(
  options: {
    order?: string;
    tpt?: string;
    code?: string;
    auth?: string;
    amountCents?: number;
    currency?: Currency;
  } = {},
) {
  const order = options.order ?? 'order_contract';
  const tpt = options.tpt ?? '734312';
  const code = options.code ?? '1';
  const auth = options.auth ?? '123456';
  const cents = BigInt(options.amountCents ?? 2_000_000);
  const whole = String(cents / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const amount = `${whole}.${String(cents % 100n).padStart(2, '0')}`;
  const params = new URLSearchParams({
    api_Key: tilopayConfig.apiKey,
    api_user: tilopayConfig.apiUser,
    orderId: tpt,
    external_orden_id: order,
    amount,
    currency: options.currency ?? 'CRC',
    responseCode: code,
    auth,
    email: tilopayConfig.billing.email,
  });
  const hash = createHmac(
    'sha256',
    `${tpt}|${tilopayConfig.apiKey}|${tilopayConfig.apiPassword}`,
  )
    .update(params.toString())
    .digest('hex');
  const body = { order, tpt, code, auth, OrderHash: hash };
  return { body, rawBody: Buffer.from(JSON.stringify(body)), headers: {} };
}
