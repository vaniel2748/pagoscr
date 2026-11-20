import { PaymentError } from './errors.js';

export function assertCents(value: unknown, name = 'monto'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new PaymentError(
      'INVALID_INPUT',
      `${name} debe ser un entero seguro no negativo en centavos.`,
    );
  }
  return value;
}

function safeNumber(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new PaymentError(
      'INVALID_INPUT',
      'El resultado monetario excede el rango de enteros seguros.',
    );
  }
  return Number(value);
}

export function addCents(...amounts: number[]): number {
  return safeNumber(
    amounts.reduce((sum, amount) => sum + BigInt(assertCents(amount)), 0n),
  );
}

export function percentageCents(
  amountCents: number,
  basisPoints: number,
): number {
  assertCents(amountCents);
  if (
    !Number.isSafeInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > 10000
  ) {
    throw new PaymentError(
      'INVALID_INPUT',
      'El porcentaje debe expresarse como un entero entre 0 y 10000 puntos básicos.',
    );
  }
  return safeNumber(
    (BigInt(amountCents) * BigInt(basisPoints) + 5000n) / 10000n,
  );
}

/** tipoCambio: céntimos CRC por US$1 (50000 = ₡500). */
export function convertUsdCentsToCrc(
  usdCents: number,
  tipoCambio: number,
): number {
  assertCents(usdCents);
  assertCents(tipoCambio, 'tipoCambio');
  if (tipoCambio === 0) {
    throw new PaymentError(
      'INVALID_INPUT',
      'Indica un tipoCambio positivo en céntimos CRC por US$1.',
    );
  }
  return safeNumber((BigInt(usdCents) * BigInt(tipoCambio) + 50n) / 100n);
}

export function formatMajorUnits(amountCents: number): string {
  const amount = BigInt(assertCents(amountCents));
  return `${amount / 100n}.${String(amount % 100n).padStart(2, '0')}`;
}

export function parseMajorUnits(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,14}(?:\.\d{1,2})?$/.test(value)) {
    throw new PaymentError(
      'INVALID_INPUT',
      'El importe debe ser texto decimal sin separadores, con hasta dos decimales.',
    );
  }
  const [whole = '', fractional = ''] = value.split('.');
  return safeNumber(BigInt(whole) * 100n + BigInt(fractional.padEnd(2, '0')));
}
