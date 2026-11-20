import { randomBytes } from 'node:crypto';
import {
  CreateChargeInput,
  CreateChargeResult,
  PaymentProvider,
  ProviderWebhookEvent,
} from './payment-provider.port';

// Proveedor de DESARROLLO. Simula el flujo sin cobrar de verdad para poder
// recorrer pagos end-to-end en local. NUNCA debe usarse en produccion.
export class SandboxAdapter implements PaymentProvider {
  readonly name = 'sandbox';

  // Número SINPE del comercio a mostrar al comensal (si está configurado).
  constructor(private readonly sinpePhone = '8888-8888') {}

  async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
    const providerPaymentId = 'sbx_' + randomBytes(12).toString('hex');

    // SINPE Movil: el cliente "transferiria" a este numero.
    if (input.method === 'sinpe_movil') {
      return {
        providerPaymentId,
        status: 'pending',
        clientAction: {
          type: 'sinpe_instructions',
          sinpePhone: this.sinpePhone,
          reference: input.paymentId.slice(0, 8).toUpperCase(),
        },
      };
    }

    // Apple Pay / Google Pay / tarjeta: en real el wallet/PSP resuelve el cobro.
    // En sandbox lo dejamos pendiente y se confirma via webhook simulado.
    return {
      providerPaymentId,
      status: 'pending',
      clientAction: { type: 'none' },
    };
  }

  peekWebhookReference(): string | null {
    return null;
  }

  // La simulación usa el endpoint autenticado de su propia sesión.
  verifyAndParseWebhook(): ProviderWebhookEvent {
    throw new Error('Sandbox no recibe webhooks públicos');
  }
}
