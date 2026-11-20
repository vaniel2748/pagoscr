import { expect, it } from 'vitest';
import { validateChargeInput } from '../../src/core/validation.js';

const input = {
  paymentId: 'order_001',
  amountCents: 2_000_000,
  currency: 'CRC' as const,
  description: 'Orden del servidor',
};

it('valida un cobro calculado por el servidor', () => {
  expect(validateChargeInput(input)).toEqual(input);
});

it.each([
  { amountCents: 0 },
  { amountCents: -1 },
  { amountCents: 1.5 },
  { currency: 'EUR' },
  { paymentId: '' },
  { paymentId: '../otra-orden' },
  { description: '' },
  { description: 'a'.repeat(501) },
  { returnUrl: 'javascript:alert(1)' },
  // Datos sintéticos construidos en ejecución; ninguna credencial real.
  {
    returnUrl: [
      'https://',
      'usuario-ficticio',
      ':',
      'clave-ficticia',
      '@example.com',
    ].join(''),
  },
])('rechaza un cobro inválido: %j', (change) => {
  expect(() => validateChargeInput({ ...input, ...change })).toThrow();
});
