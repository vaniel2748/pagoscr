#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
if (process.argv.length !== 3) {
  console.error('Uso: node centavos.mjs IMPORTE_DECIMAL_SIN_SEPARADORES.');
  process.exitCode = 1;
} else {
  const result = spawnSync(
    'npx',
    [
      '-y',
      '--package=pagoscr@0.1.0',
      '--',
      'pagoscr-centavos',
      process.argv[2],
    ],
    { stdio: 'inherit', shell: false, timeout: 90000 },
  );
  if (result.error)
    console.error(
      'No se pudo iniciar el conversor. Revisa Node.js, npm y acceso al registro.',
    );
  process.exitCode = result.status ?? 1;
}
