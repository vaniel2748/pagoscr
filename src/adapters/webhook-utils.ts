import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError } from '../core/errors.js';
import { isRecord, validateWebhookRequest } from '../core/validation.js';
import type { WebhookRequest } from '../core/types.js';

export function parseWebhookJson(rawBody: Uint8Array): Record<string, unknown> {
  validateWebhookRequest({ rawBody, headers: {} });
  try {
    const body: unknown = JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(rawBody),
    );
    if (isRecord(body)) return body;
  } catch {
    /* Nunca mostrar el cuerpo ni el error de JSON. */
  }
  throw new PaymentError(
    'MALFORMED_WEBHOOK',
    'El cuerpo del webhook debe ser un objeto JSON válido en UTF-8.',
  );
}

export function headerValue(
  headers: WebhookRequest['headers'],
  name: string,
): string | undefined {
  const matches = Object.entries(headers).filter(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return matches.length === 1 ? matches[0]?.[1] : undefined;
}

export function signTimestampBody(
  rawBody: Uint8Array,
  secret: string,
  now: number,
): string {
  const timestamp = Math.floor(now / 1000);
  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/** Algoritmo firmado de ONVO; el modo demo reutiliza la misma primitiva. */
export function verifyTimestampSignature(
  rawBody: Uint8Array,
  header: string | undefined,
  secret: string,
  now: number,
): void {
  const invalid = () =>
    new PaymentError(
      'INVALID_SIGNATURE',
      'Firma inválida o caducada. Usa el cuerpo crudo, el secreto del endpoint y un reloj sincronizado.',
    );
  if (!header || header.length > 8192) throw invalid();
  const parts = header.split(',').map((value) => value.trim().split('='));
  const timestamps = parts.filter(([key]) => key === 't');
  const rawTimestamp = timestamps[0]?.[1];
  if (
    timestamps.length !== 1 ||
    !rawTimestamp ||
    !/^\d{1,16}$/.test(rawTimestamp)
  )
    throw invalid();
  const timestamp = Number(rawTimestamp);
  if (
    !Number.isSafeInteger(timestamp) ||
    Math.abs(Math.floor(now / 1000) - timestamp) > 300
  )
    throw invalid();
  const expected = createHmac('sha256', secret)
    .update(`${rawTimestamp}.`)
    .update(rawBody)
    .digest();
  const valid = parts
    .filter(([key]) => key === 'v1')
    .some(([, signature]) => {
      if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
      const received = Buffer.from(signature, 'hex');
      return (
        received.length === expected.length &&
        timingSafeEqual(received, expected)
      );
    });
  if (!valid) throw invalid();
}
