import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { isBuiltin } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const marketplace = join(root, 'build/marketplace');
const plugin = join(marketplace, 'plugins/pagoscr');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const meta = await readJson(join(root, 'dist/metafile-esm.json'));

// El paquete ejecutable solo puede depender de módulos internos de Node.
for (const output of Object.values(meta.outputs)) {
  for (const dependency of output.imports) {
    if (dependency.external && !isBuiltin(dependency.path)) {
      throw new Error(
        `Dependencia de ejecución sin compilar: ${dependency.path}`,
      );
    }
  }
}

const packages = new Set();
for (const input of Object.keys(meta.inputs)) {
  if (!input.includes('node_modules/')) continue;
  const parts = input.split('node_modules/').at(-1).split('/');
  packages.add(parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/'));
}
const notices = ['PagosCR: avisos de dependencias distribuidas', ''];
for (const name of [...packages].sort()) {
  const directory = join(root, 'node_modules', name);
  const info = await readJson(join(directory, 'package.json'));
  const licenses = (await readdir(directory))
    .filter((file) => /^(license|licence|copying)(\.|$)/i.test(file))
    .sort();
  if (licenses.length === 0) throw new Error(`Falta licencia para ${name}`);
  notices.push(`${name}@${info.version} · ${info.license}`, '');
  for (const license of licenses) {
    notices.push(await readFile(join(directory, license), 'utf8'), '');
  }
}

await rm(marketplace, { recursive: true, force: true });
await mkdir(plugin, { recursive: true });
await writeFile(
  join(root, 'dist/THIRD-PARTY-NOTICES.txt'),
  `${notices.join('\n')}\n`,
);
const copy = async (from, to) => {
  const target = resolve(plugin, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(join(root, from), target, { recursive: true, dereference: false });
};
// Lista explícita: nunca copiar el checkout entero, .env con valores ni prior-work.
for (const directory of ['dist', 'data', 'docs'])
  await copy(directory, directory);
await copy('skill', 'skills/pagoscr');
await copy('LICENSE', 'LICENSE');
await copy('.env.example', '.env.example');
await writeFile(
  join(plugin, 'README.md'),
  `# PagosCR\n\nPlugin local de cobros de prueba en Costa Rica. Requiere Node.js 22.12 o superior.\nIncluye cuatro herramientas MCP, tarifas con fuentes y la [skill de integración](skills/pagoscr/SKILL.md).\n\nEl modo inicial es demo, sin credenciales ni dinero real. No configures llaves de producción.\nLos registros del MCP se guardan en memoria y se pierden al reiniciar.\n\nLos manifiestos para ambos clientes están incluidos. La compilación ya contiene\nlas dependencias JS; no ejecutes npm install en este directorio generado.\nConsulta la [especificación del plugin](docs/specs/plugin.md), [LICENSE](LICENSE)\ny [avisos de terceros](THIRD-PARTY-NOTICES.txt).\n`,
);
for (const file of [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  'mcp-claude.json',
  'mcp-codex.json',
]) {
  await copy(`plugin/${file}`, file);
}
const source = await readJson(join(root, 'package.json'));
const manifest = Object.fromEntries(
  [
    'name',
    'version',
    'description',
    'license',
    'author',
    'type',
    'engines',
    'main',
    'types',
    'bin',
    'exports',
  ].map((key) => [key, source[key]]),
);
await writeFile(
  join(plugin, 'package.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  join(plugin, 'THIRD-PARTY-NOTICES.txt'),
  `${notices.join('\n')}\n`,
);
for (const [client, target] of [
  ['codex', '.agents/plugins/marketplace.json'],
  ['claude', '.claude-plugin/marketplace.json'],
]) {
  const path = join(marketplace, target);
  await mkdir(dirname(path), { recursive: true });
  await cp(join(root, `plugin/marketplace-${client}.json`), path);
}
console.log(
  `Plugin local preparado; ${packages.size} licencias incluidas. No se instaló ni publicó.`,
);
