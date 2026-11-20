import { readFile } from 'node:fs/promises';
import { validarTarifas } from '../dist/index.js';

const rows = validarTarifas(
  JSON.parse(
    await readFile(new URL('../data/tarifas.json', import.meta.url), 'utf8'),
  ),
);
console.log(
  `Tarifas: ${rows.length} filas con fuente, fecha y montos enteros válidos.`,
);
