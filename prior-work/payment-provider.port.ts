import { PaymentMethod } from '@prisma/client';

// PUERTO de pago (arquitectura hexagonal): el dominio depende de esta interfaz,
// no de Tilopay/ONVO/SINPE. Cambiar de proveedor = nuevo adaptador, sin tocar
// la logica de negocio.

export interface CreateChargeInput {
  paymentId: string;
  // Total a cobrar (items asignados + propina), en centavos.
  amountCents: number;
  currency: string;
  method: PaymentMethod;
  description: string;
  // URL a la que el proveedor debe devolver el navegador del comensal tras pagar
  // (la pantalla de retorno). Si falta, el adaptador usa su default.
  returnUrl?: string;
  metadata?: Record<string, string>;
}

// Accion que el cliente debe ejecutar para completar el pago.
export type ClientAction =
  | { type: 'none' }
  | {
      type: 'sinpe_instructions';
      sinpePhone: string;
      sinpeName?: string;
      reference: string;
    }
  | { type: 'redirect'; url: string };

export interface CreateChargeResult {
  providerPaymentId: string;
  status: 'pending' | 'succeeded' | 'failed';
  clientAction: ClientAction;
}

// Evento de webhook ya verificado y normalizado.
export interface ProviderWebhookEvent {
  providerEventId: string; // id unico en el proveedor -> idempotencia
  eventType: string;
  providerPaymentId: string;
  status: 'succeeded' | 'failed';
  transactionReference?: string;
  responseCode?: string;
}

// Datos del pago en NUESTROS registros. Algunos proveedores (p. ej. Tilopay)
// firman el callback con el importe/moneda originales para evitar manipulacion;
// la verificacion necesita esos valores de confianza, no los del cuerpo recibido.
export interface WebhookVerifyContext {
  amountCents: number;
  currency: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  // Extrae, SIN verificar, la referencia del pago (nuestro paymentId) del cuerpo,
  // para cargar el pago y construir el contexto antes de verificar la firma.
  // Devuelve null si el cuerpo no es valido.
  peekWebhookReference(rawBody: Buffer | string): string | null;
  // Verifica la firma del webhook y lo normaliza. Lanza si la firma es invalida.
  // Puede ser asíncrono: las pasarelas de banco (p. ej. FAC/PowerTranz) no firman
  // el retorno; la verificación es una llamada servidor a servidor que confirma
  // el cobro con el token recibido.
  verifyAndParseWebhook(
    rawBody: Buffer | string,
    signature: string | undefined,
    context?: WebhookVerifyContext,
  ): ProviderWebhookEvent | Promise<ProviderWebhookEvent>;
  // Corrobora el resultado con el API autenticado de la pasarela.
  confirmWebhook?(
    event: ProviderWebhookEvent,
    context: WebhookVerifyContext,
  ): Promise<void>;
  // Recupera un cobro capturado aunque el navegador no reenvíe el callback.
  lookupCapturedPayment?(
    providerPaymentId: string,
    context: WebhookVerifyContext,
  ): Promise<ProviderWebhookEvent | null>;
}

// Token de inyeccion del proveedor activo.
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
