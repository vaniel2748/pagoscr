import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = join(root, 'plugins/pagoscr');
const json = async (path) =>
  JSON.parse(await readFile(join(root, path), 'utf8'));
const packageInfo = await json('package.json');
const style = await resolveConfig(join(root, 'package.json'));
const version = packageInfo.version;
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw new Error('La distribución necesita una versión exacta.');
const writeJson = async (path, value) => {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(
    target,
    await format(JSON.stringify(value), { ...style, parser: 'json' }),
  );
};

// Árbol generado propio: no incluye runtime, entornos ni recursos externos.
await rm(plugin, { recursive: true, force: true });
await mkdir(join(plugin, 'skills/pagoscr'), { recursive: true });
await cp(join(root, 'skill'), join(plugin, 'skills/pagoscr'), {
  recursive: true,
});
await cp(join(root, 'LICENSE'), join(plugin, 'LICENSE'));

for (const client of ['codex', 'claude']) {
  const manifest = await json(`plugin/.${client}-plugin/plugin.json`);
  await writeJson(`plugins/pagoscr/.${client}-plugin/plugin.json`, {
    ...manifest,
    version,
    mcpServers: './mcp.json',
  });
  const catalog = await json(`plugin/marketplace-${client}.json`);
  await writeJson(
    client === 'codex'
      ? '.agents/plugins/marketplace.json'
      : '.claude-plugin/marketplace.json',
    {
      ...catalog,
      name: 'pagoscr',
    },
  );
}

await writeJson('plugins/pagoscr/mcp.json', {
  mcpServers: {
    pagoscr: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', `--package=pagoscr@${version}`, '--', 'pagoscr-mcp'],
      env: { PAGOSCR_PROVIDER: 'demo' },
    },
  },
});
const converter = `#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
if (process.argv.length !== 3) {
  console.error('Uso: node centavos.mjs IMPORTE_DECIMAL_SIN_SEPARADORES.');
  process.exitCode = 1;
} else {
  const result = spawnSync('npx', ['-y', '--package=pagoscr@${version}', '--', 'pagoscr-centavos', process.argv[2]], { stdio: 'inherit', shell: false, timeout: 90000 });
  if (result.error) console.error('No se pudo iniciar el conversor. Revisa Node.js, npm y acceso al registro.');
  process.exitCode = result.status ?? 1;
}
`;
await writeFile(
  join(plugin, 'skills/pagoscr/scripts/centavos.mjs'),
  await format(converter, { ...style, parser: 'babel' }),
);
await writeFile(
  join(plugin, 'README.md'),
  `# PagosCR para Codex y Claude Code

Incluye la skill y lanza el MCP con la versión exacta pagoscr@${version} desde npm.
Requiere Node.js 22.12 o superior y npm. El modo inicial es demo sin credenciales.
El conversor también usa la misma versión del paquete.

El estado de publicación y los comandos están en el README principal del repositorio.
Este directorio se genera con scripts/preparar-plugin-npm.mjs desde skill/ y plugin/.
`,
);
console.log(
  `Plugin npm preparado con pagoscr@${version}; no publica ni modifica configuración de clientes.`,
);
