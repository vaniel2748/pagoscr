import { createHmac } from 'node:crypto';
import { DemoAdapter, type DemoConfirmation } from '../../src/adapters/demo.js';
import { paymentProviderContract } from './payment-provider.contract.js';

const signingSecret = 'secreto-sintetico-para-el-contrato';
const now = 1_795_200_000_000;

paymentProviderContract('demo', () => {
  let state: DemoConfirmation = {
    providerPaymentId: '',
    amountCents: 2_000_000,
    currency: 'CRC',
    status: 'succeeded',
  };
  let unavailable = false;
  const provider = new DemoAdapter({
    signingSecret,
    clock: () => now,
    lookupPayment: async (id) => {
      if (unavailable) throw new Error('Timeout sintético');
      return { ...state, providerPaymentId: id };
    },
  });
  return {
    provider,
    webhook(payment, options = {}) {
      state = {
        providerPaymentId: payment.providerPaymentId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: options.status ?? 'succeeded',
      };
      const rawBody = Buffer.from(
        JSON.stringify({
          id: options.eventId ?? 'evt_contract',
          mode: 'demo',
          data: {
            providerPaymentId: payment.providerPaymentId,
            amountCents: options.amountCents ?? payment.amountCents,
            currency: options.currency ?? payment.currency,
            status: options.status ?? 'succeeded',
          },
        }),
      );
      const t = Math.floor(now / 1000);
      const signature = createHmac('sha256', signingSecret)
        .update(`${t}.`)
        .update(rawBody)
        .digest('hex');
      return {
        rawBody,
        headers: {
          'x-pagoscr-demo-signature': `t=${t},v1=${options.invalidSignature ? '0'.repeat(64) : signature}`,
        },
      };
    },
    setConfirmation(change) {
      state = { ...state, ...change };
      if (change.unavailable !== undefined) unavailable = change.unavailable;
    },
  };
});
