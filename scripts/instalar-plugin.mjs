import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [client, ...flags] = process.argv.slice(2);
if (
  !['codex', 'claude'].includes(client) ||
  flags.some((flag) => flag !== '--dry-run')
) {
  console.error(
    'Uso: node scripts/instalar-plugin.mjs codex|claude [--dry-run]',
  );
  process.exit(1);
}
const dryRun = flags.includes('--dry-run');
const commands = [];
if (!existsSync(join(root, 'node_modules/tsup/dist/cli-default.js'))) {
  commands.push(['npm', ['ci', '--ignore-scripts']]);
}
commands.push(['npm', ['run', 'build']]);
commands.push([
  client,
  ['plugin', 'marketplace', 'add', join(root, 'build/marketplace')],
]);
commands.push([
  client,
  ['plugin', client === 'codex' ? 'add' : 'install', 'pagoscr@pagoscr-local'],
]);

if (dryRun) {
  console.log(
    JSON.stringify(
      { cliente: client, directorio: root, comandos: commands },
      null,
      2,
    ),
  );
  process.exit(0);
}
// El usuario que ejecuta este comando autoriza modificar la configuración del cliente.
// Sin shell: las rutas con espacios y los argumentos se mantienen separados.
const available = spawnSync(client, ['--version'], {
  cwd: root,
  stdio: 'ignore',
});
if (available.status !== 0) {
  console.error(
    `Instala o actualiza ${client} con soporte de plugins y vuelve a ejecutar este comando.`,
  );
  process.exit(1);
}
for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });
  if (result.status !== 0) {
    console.error(
      `Falló ${command}. Revisa el error del cliente; no se completó la instalación.`,
    );
    process.exit(1);
  }
}
console.log(
  'PagosCR instalado en el cliente seleccionado. Reinicia su sesión para cargarlo.',
);
