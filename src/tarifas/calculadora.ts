import { PaymentError } from '../core/errors.js';
import {
  addCents,
  assertCents,
  convertUsdCentsToCrc,
  formatMajorUnits,
  percentageCents,
} from '../core/money.js';
import { assertCurrency } from '../core/validation.js';
import type { Currency } from '../core/types.js';
import type { MetodoPago, Tarifa } from './schema.js';
import { validarTarifas } from './schema.js';

export interface ComparacionInput {
  readonly monto: number;
  readonly moneda: Currency;
  readonly metodo: MetodoPago;
  /** Céntimos CRC por US$1. Ejemplo: 50000 = ₡500/US$1. */
  readonly tipoCambio?: number;
}

export interface ResultadoTarifa {
  readonly id: string;
  readonly pasarela: string;
  readonly estado: 'estimado' | 'requiere_cotizacion' | 'no_aplicable';
  readonly costoCentavos: number | null;
  readonly costoFormateado: string | null;
  readonly netoCentavos: number | null;
  readonly desglose: {
    porcentajeCentavos: number;
    fijoCentavos: number;
    ajusteMinimoCentavos: number;
  } | null;
  readonly otrosCargosUsdCentavos: {
    mensualidad: number | null;
    porLiquidacion: number | null;
    afiliacion: number | null;
  };
  readonly fuente: string;
  readonly verificadoEl: string;
  readonly revisadoEl: string;
  readonly verificado: boolean;
  readonly advertencias: readonly string[];
}

export interface Comparacion {
  readonly monto: number;
  readonly moneda: Currency;
  readonly metodo: MetodoPago;
  readonly tipoCambio: number | null;
  readonly resultados: ResultadoTarifa[];
  readonly advertencias: readonly string[];
}

export function calcularComparacion(
  input: ComparacionInput,
  rawTarifas: readonly Tarifa[],
): Comparacion {
  const monto = assertCents(input.monto);
  if (!monto)
    throw new PaymentError(
      'INVALID_INPUT',
      'El monto debe ser positivo y expresado en centavos.',
    );
  const moneda = assertCurrency(input.moneda);
  if (input.metodo !== 'tarjeta' && input.metodo !== 'sinpe_movil')
    throw new PaymentError(
      'INVALID_INPUT',
      'El método debe ser tarjeta o sinpe_movil.',
    );
  if (
    input.tipoCambio !== undefined &&
    assertCents(input.tipoCambio, 'tipoCambio') === 0
  )
    throw new PaymentError(
      'INVALID_INPUT',
      'tipoCambio debe ser positivo, en céntimos CRC por US$1.',
    );
  const selected = validarTarifas(rawTarifas).filter(
    (row) => row.metodo === input.metodo,
  );
  const comparable = (row: Tarifa) =>
    row.pais === 'CR' &&
    row.verificado &&
    !row.requiereCotizacion &&
    row.porcentajePuntosBasicos !== null &&
    row.fijoUsdCentavos !== null;
  if (
    moneda === 'CRC' &&
    input.tipoCambio === undefined &&
    selected.some(
      (row) =>
        comparable(row) &&
        ((row.fijoUsdCentavos ?? 0) > 0 || (row.minimoUsdCentavos ?? 0) > 0),
    )
  ) {
    throw new PaymentError(
      'EXCHANGE_RATE_REQUIRED',
      'Indica tipoCambio explícito en céntimos CRC por US$1; por ejemplo 50000 para ₡500/US$1. No se consulta ni se inventa un valor.',
    );
  }
  const convert = (usdCents: number) =>
    moneda === 'USD'
      ? usdCents
      : usdCents === 0
        ? 0
        : convertUsdCentsToCrc(usdCents, input.tipoCambio!);
  const resultados = selected.map((row): ResultadoTarifa => {
    let costoCentavos: number | null = null;
    let desglose: ResultadoTarifa['desglose'] = null;
    if (comparable(row)) {
      const porcentajeCentavos = percentageCents(
        monto,
        row.porcentajePuntosBasicos!,
      );
      const fijoCentavos = convert(row.fijoUsdCentavos!);
      const base = addCents(porcentajeCentavos, fijoCentavos);
      const minimum = convert(row.minimoUsdCentavos ?? 0);
      costoCentavos = base < minimum ? minimum : base;
      desglose = {
        porcentajeCentavos,
        fijoCentavos,
        ajusteMinimoCentavos: Number(BigInt(costoCentavos) - BigInt(base)),
      };
    }
    const advertencias = [...row.advertencias];
    if (!row.verificado)
      advertencias.unshift(
        'Tarifa no verificada: no se calcula ni se clasifica un costo total.',
      );
    if (costoCentavos !== null && costoCentavos > monto)
      advertencias.push(
        'El costo estimado supera el monto consultado; revisa mínimos y condiciones de la pasarela.',
      );
    return {
      id: row.id,
      pasarela: row.pasarela,
      estado:
        row.pais !== 'CR'
          ? 'no_aplicable'
          : costoCentavos === null
            ? 'requiere_cotizacion'
            : 'estimado',
      costoCentavos,
      costoFormateado:
        costoCentavos === null
          ? null
          : `${moneda === 'CRC' ? '₡' : 'US$'}${formatMajorUnits(costoCentavos)}`,
      netoCentavos:
        costoCentavos === null
          ? null
          : Number(BigInt(monto) - BigInt(costoCentavos)),
      desglose,
      otrosCargosUsdCentavos: {
        mensualidad: row.mensualidadUsdCentavos,
        porLiquidacion: row.liquidacionUsdCentavos,
        afiliacion: row.afiliacionUsdCentavos,
      },
      fuente: row.fuente,
      verificadoEl: row.verificadoEl,
      revisadoEl: row.revisadoEl,
      verificado: row.verificado,
      advertencias,
    };
  });
  resultados.sort((a, b) => {
    if (a.costoCentavos === null)
      return b.costoCentavos === null
        ? a.pasarela.localeCompare(b.pasarela, 'es')
        : 1;
    if (b.costoCentavos === null) return -1;
    return a.costoCentavos === b.costoCentavos
      ? a.pasarela.localeCompare(b.pasarela, 'es')
      : a.costoCentavos < b.costoCentavos
        ? -1
        : 1;
  });
  return {
    monto,
    moneda,
    metodo: input.metodo,
    tipoCambio: input.tipoCambio ?? null,
    resultados,
    advertencias: [
      'Estimación de costo base por transacción. Mensualidad, afiliación y liquidación se muestran aparte en centavos USD.',
      'No se agregan impuestos, retenciones ni cargos que la fuente no especifica. Confirma las condiciones de tu comercio.',
    ],
  };
}
