import { PaymentError } from '../core/errors.js';
import { isRecord } from '../core/validation.js';

export type MetodoPago = 'tarjeta' | 'sinpe_movil';
export interface Tarifa {
  readonly id: string;
  readonly pasarela: string;
  readonly metodo: MetodoPago;
  readonly pais: 'CR' | 'HN';
  readonly porcentajePuntosBasicos: number | null;
  readonly fijoUsdCentavos: number | null;
  readonly minimoUsdCentavos: number | null;
  readonly mensualidadUsdCentavos: number | null;
  readonly liquidacionUsdCentavos: number | null;
  readonly afiliacionUsdCentavos: number | null;
  readonly requiereCotizacion: boolean;
  readonly verificado: boolean;
  readonly fuente: string;
  readonly verificadoEl: string;
  readonly revisadoEl: string;
  readonly modalidadVerificacion:
    'directa' | 'indice_oficial' | 'referencia_previa';
  readonly advertencias: readonly string[];
}

const amounts = [
  'fijoUsdCentavos',
  'minimoUsdCentavos',
  'mensualidadUsdCentavos',
  'liquidacionUsdCentavos',
  'afiliacionUsdCentavos',
] as const;

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function validarTarifas(value: unknown): Tarifa[] {
  const invalid = () =>
    new PaymentError(
      'INVALID_INPUT',
      'Tarifas inválidas: cada fila necesita datos enteros, fuente HTTPS, fechas ISO y advertencias cuando no está verificada.',
    );
  if (!Array.isArray(value) || value.length === 0) throw invalid();
  const ids = new Set<string>();
  const combinations = new Set<string>();
  return value.map((row: unknown) => {
    if (
      !isRecord(row) ||
      typeof row.id !== 'string' ||
      !/^[a-z0-9_-]{1,64}$/.test(row.id) ||
      typeof row.pasarela !== 'string' ||
      !row.pasarela.trim() ||
      row.pasarela.length > 120 ||
      (row.metodo !== 'tarjeta' && row.metodo !== 'sinpe_movil') ||
      (row.pais !== 'CR' && row.pais !== 'HN') ||
      typeof row.verificado !== 'boolean' ||
      typeof row.requiereCotizacion !== 'boolean'
    )
      throw invalid();
    if (
      row.porcentajePuntosBasicos !== null &&
      (typeof row.porcentajePuntosBasicos !== 'number' ||
        !Number.isSafeInteger(row.porcentajePuntosBasicos) ||
        row.porcentajePuntosBasicos < 0 ||
        row.porcentajePuntosBasicos > 10000)
    )
      throw invalid();
    for (const name of amounts) {
      const amount = row[name];
      if (
        amount !== null &&
        (typeof amount !== 'number' ||
          !Number.isSafeInteger(amount) ||
          amount < 0)
      )
        throw invalid();
    }
    if (
      !validDate(row.verificadoEl) ||
      !validDate(row.revisadoEl) ||
      row.revisadoEl < row.verificadoEl ||
      (row.modalidadVerificacion !== 'directa' &&
        row.modalidadVerificacion !== 'indice_oficial' &&
        row.modalidadVerificacion !== 'referencia_previa')
    )
      throw invalid();
    if (
      !Array.isArray(row.advertencias) ||
      row.advertencias.some(
        (warning: unknown) => typeof warning !== 'string' || !warning.trim(),
      ) ||
      (!row.verificado && row.advertencias.length === 0)
    )
      throw invalid();
    if (typeof row.fuente !== 'string') throw invalid();
    try {
      const url = new URL(row.fuente);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw invalid();
    } catch {
      throw invalid();
    }
    const combination = `${row.pasarela}:${String(row.metodo)}:${String(row.pais)}`;
    if (ids.has(row.id) || combinations.has(combination)) throw invalid();
    ids.add(row.id);
    combinations.add(combination);
    // Se validó cada campo; devolver una copia evita modificar el archivo cargado.
    return { ...row, advertencias: [...row.advertencias] } as unknown as Tarifa;
  });
}
