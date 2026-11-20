import { expect, it } from 'vitest';
import { tarifas, validarTarifas } from '../../src/tarifas/index.js';

it('valida las seis filas y conserva advertencias para las no verificadas', () => {
  expect(validarTarifas(tarifas)).toHaveLength(6);
  expect(tarifas.filter((r) => !r.verificado)).toHaveLength(2);
});

it.each([
  { fuente: undefined },
  { fuente: '' },
  { fuente: 'sin enlace' },
  { fuente: 'javascript:alert(1)' },
  { verificadoEl: undefined },
  { verificadoEl: '2026-02-30' },
  { revisadoEl: 'ayer' },
  { porcentajePuntosBasicos: 3.9 },
  { porcentajePuntosBasicos: 10001 },
  { fijoUsdCentavos: -1 },
  { mensualidadUsdCentavos: 0.5 },
  { verificado: 'sí' },
  { requiereCotizacion: 'no' },
  { pais: 'XX' },
  { metodo: 'otro' },
  { metodo: ['tarjeta'] },
  { pais: ['CR'] },
  { modalidadVerificacion: ['directa'] },
  { advertencias: 'texto' },
  { pasarela: '' },
])('el CI rechaza un dato de tarifa inválido: %j', (change) => {
  expect(() => validarTarifas([{ ...tarifas[0], ...change }])).toThrow();
});

it('rechaza duplicados, datos vacíos y filas no verificadas sin advertencias', () => {
  expect(() => validarTarifas([tarifas[0], tarifas[0]])).toThrow();
  expect(() => validarTarifas([])).toThrow();
  expect(() =>
    validarTarifas([{ ...tarifas[0], verificado: false, advertencias: [] }]),
  ).toThrow();
});
