import rawTarifas from '../../data/tarifas.json' with { type: 'json' };
import { calcularComparacion, type ComparacionInput } from './calculadora.js';
import { validarTarifas, type Tarifa } from './schema.js';

export const tarifas: readonly Tarifa[] = validarTarifas(rawTarifas);
export function compararPasarelas(
  input: ComparacionInput,
  source: readonly Tarifa[] = tarifas,
) {
  return calcularComparacion(input, source);
}
export { validarTarifas };
export type { MetodoPago, Tarifa } from './schema.js';
export type {
  ComparacionInput,
  Comparacion,
  ResultadoTarifa,
} from './calculadora.js';
