import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tasks = JSON.parse(
  await readFile(join(root, 'evaluacion/tareas.json'), 'utf8'),
);
const run = join(
  root,
  'evaluacion/runs',
  new Date().toISOString().replace(/[:.]/g, '-'),
);
await mkdir(run, { recursive: true });
const npmUserConfig = join(run, 'npm-user-vacio.npmrc');
const npmGlobalConfig = join(run, 'npm-global-vacio.npmrc');
await writeFile(npmUserConfig, '');
await writeFile(npmGlobalConfig, '');
const writeJson = (path, value) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
async function inventory(directory, base = directory, result = {}) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await inventory(path, base, result);
    else
      result[relative(base, path)] = createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
  }
  return result;
}
const results = [];
for (const task of tasks) {
  const directory = join(run, task.id);
  await mkdir(join(directory, 'vendor'), { recursive: true });
  await cp(
    join(root, 'build/marketplace/plugins/pagoscr'),
    join(directory, 'vendor/pagoscr'),
    { recursive: true },
  );
  await writeFile(join(directory, '.gitignore'), 'node_modules/\nvendor/\n');
  await writeJson(join(directory, 'package.json'), {
    name: `evaluacion-${task.id}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: { start: 'node app.mjs', test: 'node --test' },
    dependencies: { pagoscr: 'file:./vendor/pagoscr' },
  });
  await writeJson(join(directory, 'catalogo.json'), {
    id: 'kit-builder',
    nombre: 'Kit Builder',
    moneda: task.moneda,
    precioTexto: task.precioTexto,
    envioTexto: task.envioTexto ?? '0.00',
  });
  await writeFile(
    join(directory, 'app.mjs'),
    `import catalogo from './catalogo.json' with { type: 'json' };\nexport { catalogo };\nconsole.log('App de evaluación preparada. Aún no tiene integración de pagos.');\n`,
  );
  await writeFile(
    join(directory, 'TAREA.md'),
    `# ${task.titulo}\n\n${task.prompt}\n\nTrabaja solo en este repositorio. No instales skills/plugins ni modifiques vendor o fixtures.\nNo leas entornos o credenciales del equipo. No hagas commits en el repositorio de PagosCR.\nInforma archivos cambiados, pruebas ejecutadas y qué pago terminó confirmado.\n`,
  );
  if (task.pasarela !== 'demo') {
    const fixtures = join(directory, 'fixtures');
    await mkdir(fixtures);
    const source = join(root, 'test/fixtures', task.pasarela);
    for (const file of await readdir(source)) {
      if (file.endsWith('.json'))
        await cp(join(source, file), join(fixtures, file));
    }
    if (task.pasarela === 'onvo') {
      await writeJson(join(fixtures, 'config-sintetica.json'), {
        secretKey: 'onvo_test_secret_key_fixture',
        webhookSecret: 'whsec_fixture',
      });
    } else {
      await writeJson(join(fixtures, 'config-sintetica.json'), {
        apiUser: 'usuario-ficticio',
        apiPassword: 'clave-ficticia-solo-fixtures',
        apiKey: 'clave-integracion-ficticia',
        testMode: true,
        redirectUrl: 'https://merchant.example/retorno',
        billing: {
          firstName: 'Cliente',
          lastName: 'Prueba',
          address: 'Dirección de prueba',
          address2: '',
          city: 'San José',
          state: 'CR-SJ',
          postalCode: '10101',
          country: 'CR',
          telephone: '88888888',
          email: 'cliente@example.com',
        },
      });
      await writeFile(
        join(fixtures, 'retorno.txt'),
        'order=order_contract&tpt=734312&code=1&auth=123456&OrderHash=a0a66c8d8344be5c292c23bc8e2585c8af668b26796e54aeabb4c64db6244ed9\n',
      );
    }
    await writeFile(
      join(fixtures, 'README.md'),
      'Datos sintéticos, sin cuenta ni credenciales reales. Fuente y contrato en las guías PagosCR distribuidas. No cambiar para aprobar la evaluación.\n',
    );
  }
  execFileSync(
    'npm',
    [
      'install',
      '--offline',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      `--userconfig=${npmUserConfig}`,
      `--globalconfig=${npmGlobalConfig}`,
      `--cache=${join(run, 'npm-cache')}`,
    ],
    { cwd: directory, stdio: 'pipe' },
  );
  const git = (args) =>
    execFileSync(
      'git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'user.name=Evaluación PagosCR',
        '-c',
        'user.email=evaluacion@example.invalid',
        ...args,
      ],
      { cwd: directory, encoding: 'utf8' },
    );
  git(['init', '-q']);
  git(['add', '.']);
  git(['commit', '-qm', 'test: preparar app sin integración de pagos']);
  if (git(['status', '--porcelain']).trim())
    throw new Error('La app inicial no quedó limpia.');
  const frozen = { vendor: await inventory(join(directory, 'vendor')) };
  if (task.pasarela !== 'demo')
    frozen.fixtures = await inventory(join(directory, 'fixtures'));
  await writeJson(join(run, `${task.id}.integridad.json`), frozen);
  results.push({
    id: task.id,
    directorio: directory,
    commitInicial: git(['rev-parse', '--short', 'HEAD']).trim(),
    estado: 'pendiente',
    pagoConfirmado: null,
    duracionAgenteSegundos: null,
  });
}
await writeJson(join(run, 'resultados.json'), {
  preparadoEl: new Date().toISOString(),
  pagoscrCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  metodo: 'Cinco tareas independientes aún no ejecutadas',
  resultados: results,
});
console.log(
  `Cinco repositorios limpios preparados en ${run}. Ningún resultado de agente se ha declarado aprobado.`,
);
