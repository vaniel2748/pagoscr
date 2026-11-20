import { OnvoAdapter } from '../../src/adapters/onvo.js';
import {
  createdFixture,
  eventFixture,
  fakeSecretKey,
  fakeWebhookSecret,
  fixedNow,
  signedRequest,
  succeededFixture,
} from '../helpers/onvo.js';
import { paymentProviderContract } from './payment-provider.contract.js';

paymentProviderContract('ONVO con fixtures', () => {
  let state: Record<string, unknown> = structuredClone(succeededFixture);
  let unavailable = false;
  const fetchImpl: typeof fetch = async (url, init) => {
    if (
      String(url) === 'https://api.onvopay.com/v1/payment-intents' &&
      init?.method === 'POST'
    )
      return Response.json(createdFixture, { status: 201 });
    if (
      String(url) ===
        `https://api.onvopay.com/v1/payment-intents/${createdFixture.id}` &&
      init?.method === 'GET'
    ) {
      if (unavailable)
        throw new DOMException('Timeout sintético', 'TimeoutError');
      return Response.json(state);
    }
    throw new Error('Solicitud no prevista por el contrato');
  };
  const provider = new OnvoAdapter({
    secretKey: fakeSecretKey,
    webhookSecret: fakeWebhookSecret,
    clock: () => fixedNow,
    fetchImpl,
  });
  return {
    provider,
    webhook(payment, options = {}) {
      const status = options.status ?? 'succeeded';
      state = {
        ...succeededFixture,
        id: payment.providerPaymentId,
        amount: payment.amountCents,
        currency: payment.currency,
        metadata: { pagoscrPaymentId: payment.paymentId },
        status:
          status === 'succeeded' ? 'succeeded' : 'requires_payment_method',
        receivedAmount: status === 'succeeded' ? payment.amountCents : 0,
      };
      const body = {
        ...eventFixture,
        id: options.eventId ?? 'evt_contract',
        type: `payment_intent.${status}`,
        data: {
          object: {
            ...eventFixture.data.object,
            id: payment.providerPaymentId,
            amount: options.amountCents ?? payment.amountCents,
            currency: options.currency ?? payment.currency,
            status:
              status === 'succeeded' ? 'succeeded' : 'requires_payment_method',
          },
        },
      };
      const request = signedRequest(body);
      if (options.invalidSignature)
        request.headers['X-Onvo-Signature'] =
          `t=${Math.floor(fixedNow / 1000)},v1=${'0'.repeat(64)}`;
      return request;
    },
    setConfirmation(change) {
      if (change.amountCents !== undefined) state.amount = change.amountCents;
      if (change.currency !== undefined) state.currency = change.currency;
      if (change.status !== undefined)
        state.status =
          change.status === 'pending' ? 'processing' : change.status;
      if (change.unavailable !== undefined) unavailable = change.unavailable;
    },
  };
});
