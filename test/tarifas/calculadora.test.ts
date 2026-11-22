import { describe, expect, it } from 'vitest';
import { compararPasarelas, tarifas } from '../../src/tarifas/index.js';

describe('comparador de tarifas', () => {
  it('compara ₡20000 con un tipo explícito de ₡500 por dólar', () => {
    const result = compararPasarelas({
      monto: 2_000_000,
      moneda: 'CRC',
      metodo: 'tarjeta',
      tipoCambio: 50_000,
    });
    expect(
      result.resultados
        .slice(0, 2)
        .map((r) => [r.pasarela, r.costoCentavos, r.netoCentavos]),
    ).toEqual([
      ['ONVO', 95_500, 1_904_500],
      ['Tilopay', 102_500, 1_897_500],
    ]);
    expect(result.resultados[0]?.costoFormateado).toBe('₡955.00');
    expect(result.resultados[0]?.desglose).toEqual({
      porcentajeCentavos: 78_000,
      fijoCentavos: 17_500,
      ajusteMinimoCentavos: 0,
    });
  });

  it('compara USD sin inventar un tipo de cambio', () => {
    const result = compararPasarelas({
      monto: 20_000,
      moneda: 'USD',
      metodo: 'tarjeta',
    });
    expect(result.resultados.slice(0, 2).map((r) => r.costoCentavos)).toEqual([
      815, 885,
    ]);
    expect(result.tipoCambio).toBeNull();
  });

  it('compara SINPE Móvil sin confundirlo con SINPE bancario', () => {
    const result = compararPasarelas({
      monto: 2_000_000,
      moneda: 'CRC',
      metodo: 'sinpe_movil',
      tipoCambio: 50_000,
    });
    expect(result.resultados.map((r) => [r.pasarela, r.costoCentavos])).toEqual(
      [
        ['ONVO', 30_000],
        ['Tilopay', 57_500],
      ],
    );
  });

  it('pide el tipo de cambio explícito cuando hay un fijo en USD', () => {
    expect(() =>
      compararPasarelas({ monto: 2_000_000, moneda: 'CRC', metodo: 'tarjeta' }),
    ).toThrow(expect.objectContaining({ code: 'EXCHANGE_RATE_REQUIRED' }));
  });

  it.each([0, -1, 500.25, NaN, Infinity])(
    'rechaza un tipo de cambio inválido: %s',
    (tipoCambio) => {
      expect(() =>
        compararPasarelas({
          monto: 10000,
          moneda: 'CRC',
          metodo: 'tarjeta',
          tipoCambio,
        }),
      ).toThrow();
    },
  );

  it.each([0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rechaza montos inválidos: %s',
    (monto) => {
      expect(() =>
        compararPasarelas({ monto, moneda: 'USD', metodo: 'tarjeta' }),
      ).toThrow();
    },
  );

  it('muestra sin total las dos filas que no permiten comparar', () => {
    const result = compararPasarelas({
      monto: 20_000,
      moneda: 'USD',
      metodo: 'tarjeta',
    });
    const unknown = result.resultados.filter((r) => !r.verificado);
    expect(unknown).toHaveLength(2);
    expect(
      unknown.every(
        (r) => r.costoCentavos === null && r.advertencias.length > 0,
      ),
    ).toBe(true);
    expect(unknown.find((r) => r.id === 'bac-directo')?.estado).toBe(
      'no_aplicable',
    );
    expect(unknown.find((r) => r.id === 'tilopay-bac')?.estado).toBe(
      'requiere_cotizacion',
    );
  });

  it('separa la liquidación de ONVO del costo de cada venta', () => {
    const row = compararPasarelas({
      monto: 20_000,
      moneda: 'USD',
      metodo: 'tarjeta',
    }).resultados[0]!;
    expect(row.costoCentavos).toBe(815);
    expect(row.otrosCargosUsdCentavos.porLiquidacion).toBe(300);
    expect(row.advertencias.join(' ')).toContain('liquidación');
  });

  it('incluye la fuente y las fechas de verificación de ONVO', () => {
    const row = compararPasarelas({
      monto: 20000,
      moneda: 'USD',
      metodo: 'tarjeta',
    }).resultados[0]!;
    expect(row.fuente).toBe('https://onvopay.com/pricing');
    expect(row.verificadoEl).toBe('2026-11-22');
    expect(row.revisadoEl).toBe('2026-11-22');
  });

  it('redondea mitades y aplica mínimos con aritmética entera', () => {
    const custom = {
      ...tarifas[0]!,
      id: 'test_minimo',
      porcentajePuntosBasicos: 5000,
      fijoUsdCentavos: 0,
      minimoUsdCentavos: 2,
      advertencias: [],
    };
    const result = compararPasarelas(
      { monto: 1, moneda: 'USD', metodo: 'tarjeta' },
      [custom],
    );
    expect(result.resultados[0]).toMatchObject({
      costoCentavos: 2,
      netoCentavos: -1,
      costoFormateado: 'US$0.02',
    });
    expect(result.resultados[0]?.desglose).toEqual({
      porcentajeCentavos: 1,
      fijoCentavos: 0,
      ajusteMinimoCentavos: 1,
    });
  });

  it('mantiene precisión con montos grandes y rechaza desbordamientos', () => {
    const result = compararPasarelas({
      monto: Number.MAX_SAFE_INTEGER,
      moneda: 'USD',
      metodo: 'tarjeta',
    });
    expect(result.resultados[0]?.costoCentavos).toBe(351_280_770_934_934);
    expect(() =>
      compararPasarelas(
        {
          monto: 100,
          moneda: 'CRC',
          metodo: 'tarjeta',
          tipoCambio: Number.MAX_SAFE_INTEGER,
        },
        [{ ...tarifas[0]!, fijoUsdCentavos: 1000 }],
      ),
    ).toThrow();
  });
});
