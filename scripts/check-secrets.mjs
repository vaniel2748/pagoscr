import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Complementa Secretlint con los prefijos propios de las pasarelas.
// Solo informa nombres de archivos; nunca imprime el valor encontrado.
const rules = [
  /onvo_(?:test|live)_(?:secret|publishable)_key_[A-Za-z0-9_-]{12,}/,
  /whsec_[A-Za-z0-9_-]{16,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
let errors = 0;
for (const file of new Set(files)) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    console.error(`Archivo de entorno no permitido: ${file}`);
    errors++;
    continue;
  }
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  if (rules.some((rule) => rule.test(content))) {
    console.error(`Posible credencial incrustada: ${file}`);
    errors++;
  }
}
if (errors) process.exitCode = 1;
else console.log('Secretos: sin credenciales detectadas.');
