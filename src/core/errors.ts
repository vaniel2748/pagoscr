export type PaymentErrorCode =
  | 'INVALID_INPUT'
  | 'EXCHANGE_RATE_REQUIRED'
  | 'INVALID_SIGNATURE'
  | 'MALFORMED_WEBHOOK'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_MISMATCH'
  | 'GATEWAY_ERROR'
  | 'TEST_MODE_REQUIRED'
  | 'DUPLICATE_PAYMENT'
  | 'UNSUPPORTED_EVENT';

/** Mensajes controlados: no incluir cuerpos, cabeceras ni secretos de la pasarela. */
export class PaymentError extends Error {
  override readonly name = 'PaymentError';

  constructor(
    readonly code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
  }
}
