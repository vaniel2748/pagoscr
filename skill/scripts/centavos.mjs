#!/usr/bin/env node
import { parseMajorUnits } from 'pagoscr';

try {
  if (process.argv.length !== 3) throw new Error();
  console.log(JSON.stringify({ centavos: parseMajorUnits(process.argv[2]) }));
} catch {
  console.error(
    'Uso: node centavos.mjs IMPORTE_DECIMAL_SIN_SEPARADORES. Hasta dos decimales y dentro del rango seguro.',
  );
  process.exitCode = 1;
}
