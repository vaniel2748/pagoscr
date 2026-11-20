import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'pagoscr-plugin-'));
const isolated = join(temporary, 'marketplace aislado');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const inside = (base, path) => {
  const target = resolve(base, path);
  const rel = relative(base, target);
  assert.ok(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  return target;
};
const data = (response) => {
  assert.notEqual(response.isError, true);
  assert.equal(response.structuredContent?.ok, true);
  return response.structuredContent;
};

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert.equal(
      (await lstat(path)).isSymbolicLink(),
      false,
      'No distribuir symlinks',
    );
    assert.ok(!['node_modules', 'prior-work', '.git'].includes(entry.name));
    assert.ok(
      !/^\.env(?:\.|$)/.test(entry.name),
      'No distribuir archivos de entorno',
    );
    if (entry.isDirectory()) await inspect(path);
    else {
      const contents = await readFile(path, 'utf8');
      assert.ok(
        !/onvo_(?:test|live)_(?:secret|publishable)_key_[A-Za-z0-9_-]{12,}/.test(
          contents,
        ),
      );
      assert.ok(!/whsec_[A-Za-z0-9_-]{16,}/.test(contents));
      assert.ok(
        !/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{30,}?-----END/.test(
          contents,
        ),
      );
    }
  }
}

try {
  await cp(join(root, 'build/marketplace'), isolated, { recursive: true });
  await inspect(isolated);
  const plugin = join(isolated, 'plugins/pagoscr');
  const source = await readJson(join(root, 'package.json'));
  for (const clientName of ['claude', 'codex']) {
    const catalogPath =
      clientName === 'claude'
        ? '.claude-plugin/marketplace.json'
        : '.agents/plugins/marketplace.json';
    const catalog = await readJson(join(isolated, catalogPath));
    assert.equal(catalog.name, 'pagoscr-local');
    assert.equal(catalog.plugins.length, 1);
    const catalogSource =
      clientName === 'claude'
        ? catalog.plugins[0].source
        : catalog.plugins[0].source.path;
    assert.equal(inside(isolated, catalogSource), plugin);
    const manifest = await readJson(
      join(plugin, `.${clientName}-plugin/plugin.json`),
    );
    assert.equal(manifest.name, source.name);
    assert.equal(manifest.version, source.version);
    const mcp = await readJson(inside(plugin, manifest.mcpServers));
    const configuration = mcp.mcpServers.pagoscr;
    assert.equal(configuration.command, 'node');
    assert.deepEqual(configuration.env, { PAGOSCR_PROVIDER: 'demo' });
    const args = configuration.args.map((arg) =>
      arg.replaceAll('${CLAUDE_PLUGIN_ROOT}', plugin),
    );
    const cwd = inside(plugin, configuration.cwd ?? '.');
    await lstat(inside(plugin, resolve(cwd, args[0])));
    const client = new Client({
      name: `validacion-plugin-${clientName}`,
      version: source.version,
    });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args,
      cwd,
      env: {
        ...configuration.env,
        ONVO_TEST_SECRET_KEY: '',
        ONVO_WEBHOOK_SECRET: '',
        TILOPAY_API_USER: '',
        TILOPAY_API_PASSWORD: '',
        TILOPAY_API_KEY: '',
        PAGOSCR_RUN_ONVO_E2E: '',
      },
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      assert.equal((await client.listTools()).tools.length, 4);
      const call = (name, args = {}) =>
        client.callTool({ name, arguments: args });
      const diagnosis = data(await call('diagnosticar_integracion'));
      assert.equal(diagnosis.onvo.llave.configurada, false);
      const comparison = data(
        await call('comparar_pasarelas', {
          monto: 2_000_000,
          moneda: 'CRC',
          metodo: 'tarjeta',
          tipoCambio: 50_000,
        }),
      );
      assert.equal(
        comparison.resultados.find((r) => r.id === 'onvo-tarjeta')
          ?.costoCentavos,
        95_500,
      );
      const created = data(
        await call('crear_cobro_de_prueba', {
          pasarela: 'demo',
          monto: 2_000_000,
          moneda: 'CRC',
          descripcion: 'Validación del plugin aislado',
        }),
      );
      const verified = data(
        await call('verificar_webhook', created.siguientePaso.argumentos),
      );
      assert.equal(verified.pago.estado, 'succeeded');
      const repeated = data(
        await call('verificar_webhook', created.siguientePaso.argumentos),
      );
      assert.equal(repeated.pago.duplicado, true);
    } finally {
      await client.close();
    }
  }
  const cents = execFileSync(
    process.execPath,
    ['skills/pagoscr/scripts/centavos.mjs', '20000.00'],
    {
      cwd: plugin,
      encoding: 'utf8',
      timeout: 10_000,
    },
  );
  assert.equal(JSON.parse(cents).centavos, 2_000_000);
  console.log(
    'Plugins: ambos manifiestos, rutas con espacios, tarifas, demo y conversor pasan sin node_modules.',
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
