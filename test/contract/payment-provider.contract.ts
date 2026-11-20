import { beforeEach, describe, expect, it } from 'vitest';
import type { PaymentProvider } from '../../src/core/payment-provider.js';
import { InMemoryPaymentStore } from '../../src/core/memory-store.js';
import { processWebhook } from '../../src/core/webhook-processor.js';
import type {
  CreateChargeInput,
  Currency,
  PaymentRecord,
  PaymentStatus,
  WebhookRequest,
} from '../../src/core/types.js';

export interface WebhookOptions {
  amountCents?: number;
  currency?: Currency;
  eventId?: string;
  status?: 'succeeded' | 'failed';
  invalidSignature?: boolean;
}

export interface ContractHarness {
  provider: PaymentProvider;
  webhook(payment: PaymentRecord, options?: WebhookOptions): WebhookRequest;
  setConfirmation(change: {
    amountCents?: number;
    currency?: Currency;
    status?: PaymentStatus;
    unavailable?: boolean;
  }): void;
}

export function paymentProviderContract(
  name: string,
  factory: () => ContractHarness,
): void {
  describe(`contrato de ${name}`, () => {
    let harness: ContractHarness;
    let store: InMemoryPaymentStore;
    let payment: PaymentRecord;
    const input: CreateChargeInput = {
      paymentId: 'order_contract',
      amountCents: 2_000_000,
      currency: 'CRC',
      description: 'Cobro de prueba del servidor',
    };

    beforeEach(async () => {
      harness = factory();
      store = new InMemoryPaymentStore();
      const charge = await harness.provider.createCharge(input);
      payment = {
        paymentId: input.paymentId,
        provider: harness.provider.name,
        providerPaymentId: charge.providerPaymentId,
        amountCents: input.amountCents,
        currency: input.currency,
        status: charge.status,
      };
      await store.savePayment(payment);
    });

    it('crea un cobro pendiente con referencia propia', () => {
      expect(payment.status).toBe('pending');
      expect(payment.providerPaymentId).toMatch(/^[A-Za-z0-9_-]+$/);
    });
    it.each([0, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])(
      'rechaza montos inválidos: %s',
      async (amountCents) => {
        await expect(
          harness.provider.createCharge({ ...input, amountCents }),
        ).rejects.toThrow();
      },
    );
    it('acepta un webhook válido tras confirmar con la pasarela', async () => {
      await expect(
        processWebhook(harness.provider, harness.webhook(payment), store),
      ).resolves.toEqual({
        paymentId: input.paymentId,
        status: 'succeeded',
        duplicate: false,
      });
    });
    it('rechaza firma inválida y permite reintentar el mismo evento válido', async () => {
      const invalid = harness.webhook(payment, { invalidSignature: true });
      await expect(
        processWebhook(harness.provider, invalid, store),
      ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
      expect(
        (
          await processWebhook(
            harness.provider,
            harness.webhook(payment),
            store,
          )
        ).duplicate,
      ).toBe(false);
    });
    it('rechaza la ausencia de autenticación', async () => {
      const valid = harness.webhook(payment);
      await expect(
        processWebhook(harness.provider, { ...valid, headers: {} }, store),
      ).rejects.toMatchObject({ code: 'INVALID_SIGNATURE' });
    });
    it('deduplica un evento repetido', async () => {
      const request = harness.webhook(payment);
      expect(
        (await processWebhook(harness.provider, request, store)).duplicate,
      ).toBe(false);
      expect(
        (await processWebhook(harness.provider, request, store)).duplicate,
      ).toBe(true);
    });
    it('aplica una sola vez un evento recibido simultáneamente', async () => {
      const request = harness.webhook(payment);
      const results = await Promise.all([
        processWebhook(harness.provider, request, store),
        processWebhook(harness.provider, request, store),
      ]);
      expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    });
    it('rechaza un monto alterado aun con firma válida', async () => {
      await expect(
        processWebhook(
          harness.provider,
          harness.webhook(payment, { amountCents: 1 }),
          store,
        ),
      ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    });
    it('rechaza una moneda alterada aun con firma válida', async () => {
      await expect(
        processWebhook(
          harness.provider,
          harness.webhook(payment, { currency: 'USD' }),
          store,
        ),
      ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    });
    it('rechaza un cuerpo mal formado', async () => {
      await expect(
        processWebhook(
          harness.provider,
          { rawBody: new TextEncoder().encode('{malformado'), headers: {} },
          store,
        ),
      ).rejects.toMatchObject({ code: 'MALFORMED_WEBHOOK' });
    });
    it('no acepta un éxito si la pasarela todavía lo tiene pendiente', async () => {
      const request = harness.webhook(payment);
      harness.setConfirmation({ status: 'pending' });
      await expect(
        processWebhook(harness.provider, request, store),
      ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    });
    it('contrasta el monto contra la respuesta de la API', async () => {
      const request = harness.webhook(payment);
      harness.setConfirmation({ amountCents: 1 });
      await expect(
        processWebhook(harness.provider, request, store),
      ).rejects.toMatchObject({ code: 'PAYMENT_MISMATCH' });
    });
    it('permite reintentar tras una API no disponible o tardía', async () => {
      const request = harness.webhook(payment);
      harness.setConfirmation({ unavailable: true });
      await expect(
        processWebhook(harness.provider, request, store),
      ).rejects.toMatchObject({ code: 'GATEWAY_ERROR' });
      expect(
        (
          await store.findPayment(
            harness.provider.name,
            payment.providerPaymentId,
          )
        )?.status,
      ).toBe('pending');
      harness.setConfirmation({ unavailable: false });
      expect(
        (await processWebhook(harness.provider, request, store)).duplicate,
      ).toBe(false);
    });
    it('un fallo tardío no revierte un pago confirmado', async () => {
      await processWebhook(harness.provider, harness.webhook(payment), store);
      const late = harness.webhook(payment, {
        status: 'failed',
        eventId: 'evt_late',
      });
      expect((await processWebhook(harness.provider, late, store)).status).toBe(
        'succeeded',
      );
    });
  });
}
