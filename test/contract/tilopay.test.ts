import { TilopayAdapter } from '../../src/adapters/tilopay.js';
import { formatMajorUnits } from '../../src/core/money.js';
import {
  tilopayConfig,
  tilopayLoginFixture,
  tilopayCheckoutFixture,
  tilopayConsultFixture,
  signedTilopayReturn,
} from '../helpers/tilopay.js';
import { paymentProviderContract } from './payment-provider.contract.js';

paymentProviderContract('Tilopay retorno GET + consult, hash V2 activo', () => {
  let row: Record<string, unknown> = { ...tilopayConsultFixture.response[0] };
  let unavailable = false;
  const fetchImpl: typeof fetch = async (url) => {
    if (String(url) === 'https://app.tilopay.com/api/v1/login')
      return Response.json(tilopayLoginFixture);
    if (String(url) === 'https://app.tilopay.com/api/v1/processPayment')
      return Response.json(tilopayCheckoutFixture);
    if (String(url) === 'https://app.tilopay.com/api/v1/consult') {
      if (unavailable)
        throw new DOMException('Timeout sintético', 'TimeoutError');
      return Response.json({ type: '200', response: [row] });
    }
    throw new Error('Solicitud Tilopay no prevista');
  };
  return {
    provider: new TilopayAdapter({ ...tilopayConfig, fetchImpl }),
    webhook(payment, options = {}) {
      const code = options.status === 'failed' ? '2' : '1';
      const tpt = options.eventId ? '734313' : '734312';
      row = {
        ...tilopayConsultFixture.response[0],
        id_tilopay: Number(tpt),
        orderNumber: payment.providerPaymentId,
        amount: formatMajorUnits(payment.amountCents),
        currency: payment.currency,
        code,
      };
      const request = signedTilopayReturn({
        order: payment.providerPaymentId,
        tpt,
        code,
        amountCents: options.amountCents ?? payment.amountCents,
        currency: options.currency ?? payment.currency,
      });
      if (options.invalidSignature)
        request.rawBody = Buffer.from(
          JSON.stringify({ ...request.body, OrderHash: '0'.repeat(64) }),
        );
      return request;
    },
    withoutAuthentication(request) {
      const body = JSON.parse(Buffer.from(request.rawBody).toString('utf8'));
      delete body.OrderHash;
      return { ...request, rawBody: Buffer.from(JSON.stringify(body)) };
    },
    setConfirmation(change) {
      if (change.amountCents !== undefined)
        row.amount = formatMajorUnits(change.amountCents);
      if (change.currency !== undefined) row.currency = change.currency;
      if (change.status !== undefined) {
        row.code =
          change.status === 'succeeded'
            ? '1'
            : change.status === 'failed'
              ? '2'
              : '0';
        row.capture = change.status === 'pending' ? 'Authorize' : 'Capture';
      }
      if (change.unavailable !== undefined) unavailable = change.unavailable;
    },
  };
});
