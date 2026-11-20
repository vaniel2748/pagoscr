import { describe, expect, it } from 'vitest';
import {
  addCents,
  assertCents,
  convertUsdCentsToCrc,
  formatMajorUnits,
  parseMajorUnits,
  percentageCents,
} from '../../src/core/money.js';

describe('dinero entero', () => {
  it.each([0, 1, 2_000_000, Number.MAX_SAFE_INTEGER])(
    'acepta %s centavos',
    (value) => {
      expect(assertCents(value)).toBe(value);
    },
  );
  it.each([
    -1,
    0.01,
    NaN,
    Infinity,
    -Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '100',
    null,
  ])('rechaza una cantidad inválida: %s', (value) => {
    expect(() => assertCents(value)).toThrow();
  });
  it('suma sin exceder enteros seguros', () => {
    expect(addCents(10, 20, 30)).toBe(60);
    expect(addCents(Number.MAX_SAFE_INTEGER - 1, 1)).toBe(
      Number.MAX_SAFE_INTEGER,
    );
    expect(() => addCents(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
  it('cobra 425 puntos básicos y redondea mitades hacia arriba', () => {
    expect(percentageCents(2_000_000, 425)).toBe(85_000);
    expect(percentageCents(1, 5000)).toBe(1);
    expect(percentageCents(1, 4999)).toBe(0);
    expect(percentageCents(35, 10000)).toBe(35);
  });
  it('calcula porcentajes cuyo producto intermedio excede el rango de number', () => {
    expect(percentageCents(Number.MAX_SAFE_INTEGER, 425)).toBe(
      382_805_968_326_492,
    );
  });
  it.each([-1, 10001, 1.5, NaN])(
    'rechaza puntos básicos inválidos: %s',
    (rate) => {
      expect(() => percentageCents(100, rate)).toThrow();
    },
  );
  it('convierte dólares con un tipo de cambio entero explícito', () => {
    expect(convertUsdCentsToCrc(35, 50_000)).toBe(17_500);
    expect(convertUsdCentsToCrc(1, 50_050)).toBe(501);
    expect(() => convertUsdCentsToCrc(35, 0)).toThrow();
    expect(() => convertUsdCentsToCrc(35, 500.5)).toThrow();
    expect(() =>
      convertUsdCentsToCrc(Number.MAX_SAFE_INTEGER, 50_000),
    ).toThrow();
  });
  it.each([
    [0, '0.00'],
    [1, '0.01'],
    [101, '1.01'],
    [2_000_000, '20000.00'],
    [Number.MAX_SAFE_INTEGER, '90071992547409.91'],
  ] as const)('formatea %s sin coma flotante', (cents, major) => {
    expect(formatMajorUnits(cents)).toBe(major);
    expect(parseMajorUnits(major)).toBe(cents);
  });
  it('acepta unidades mayores con cero o un decimal', () => {
    expect(parseMajorUnits('12')).toBe(1200);
    expect(parseMajorUnits('12.3')).toBe(1230);
  });
  it.each([
    '-1',
    '1.001',
    '1e3',
    '1,000',
    ' 1',
    '',
    '90071992547409.92',
    'NaN',
  ])('rechaza texto monetario ambiguo: %s', (major) => {
    expect(() => parseMajorUnits(major)).toThrow();
  });
});
