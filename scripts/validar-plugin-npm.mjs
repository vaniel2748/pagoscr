import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const plugin = join(root, 'plugins/pagoscr');
const json = async (path) =>
  JSON.parse(await readFile(join(root, path), 'utf8'));
const source = await json('package.json');
const paths = [
  '.agents/plugins/marketplace.json',
  '.claude-plugin/marketplace.json',
];
async function inspect(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    assert.equal((await lstat(path)).isSymbolicLink(), false);
    assert.ok(
      !['dist', 'node_modules', '.git', 'prior-work'].includes(item.name),
    );
    assert.ok(!/^\.env(?:\.|$)/.test(item.name));
    if (item.isDirectory()) await inspect(path);
    else paths.push(path.slice(root.length));
  }
}
await inspect(plugin);
for (const client of ['codex', 'claude']) {
  const manifest = await json(`plugins/pagoscr/.${client}-plugin/plugin.json`);
  assert.equal(manifest.name, source.name);
  assert.equal(manifest.version, source.version);
  assert.equal(manifest.mcpServers, './mcp.json');
}
const configuration = (await json('plugins/pagoscr/mcp.json')).mcpServers
  .pagoscr;
assert.equal(configuration.command, 'npx');
assert.deepEqual(configuration.args, [
  '-y',
  `--package=pagoscr@${source.version}`,
  '--',
  'pagoscr-mcp',
]);
assert.deepEqual(configuration.env, { PAGOSCR_PROVIDER: 'demo' });
assert.equal(
  await readFile(join(plugin, 'skills/pagoscr/SKILL.md'), 'utf8'),
  await readFile(join(root, 'skill/SKILL.md'), 'utf8'),
);
for (const [args, message] of [
  [
    ['ls-files', '--error-unmatch', '--', ...paths],
    'Versiona todos los archivos del plugin y sus catálogos.',
  ],
  [
    ['diff', '--quiet', '--', ...paths],
    'El plugin generado cambió: ejecuta npm run build y versiona sus cambios.',
  ],
]) {
  assert.equal(
    spawnSync('git', args, { cwd: root, stdio: 'ignore' }).status,
    0,
    message,
  );
}
console.log(
  `Plugin GitHub: versión npm ${source.version} fija, skill sincronizada y artefactos versionados sin runtime ni entornos.`,
);
