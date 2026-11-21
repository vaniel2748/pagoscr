import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const report = JSON.parse(
  await readFile(
    join(root, 'evaluacion/resultados/2026-11-20-completa.json'),
    'utf8',
  ),
);
const temporary = await mkdtemp(join(tmpdir(), 'pagoscr-repro-evaluacion-'));
let tests = 0;
try {
  for (const result of report.resultados.filter(
    (item) => item.estado === 'aprobado',
  )) {
    const source = join(root, 'evaluacion/evidencia/2026-11-20', result.id);
    for (const [file, hash] of Object.entries(result.archivosEvidencia)) {
      const actual = createHash('sha256')
        .update(await readFile(join(source, file)))
        .digest('hex');
      assert.equal(actual, hash, 'La evidencia original fue modificada.');
    }
    const directory = join(temporary, result.id);
    await cp(source, directory, { recursive: true });
    await mkdir(join(directory, 'node_modules'), { recursive: true });
    // Equivale a la dependencia local ya compilada, sin registry ni instalación.
    await symlink(
      join(root, 'build/marketplace/plugins/pagoscr'),
      join(directory, 'node_modules/pagoscr'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    const output = execFileSync('npm', ['test', '--', '--test-reporter=tap'], {
      cwd: directory,
      encoding: 'utf8',
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        TMPDIR: process.env.TMPDIR,
        LANG: process.env.LANG,
        NPM_CONFIG_USERCONFIG: join(directory, '.npmrc-vacio'),
        NPM_CONFIG_GLOBALCONFIG: join(directory, '.npmrc-global-vacio'),
        NPM_CONFIG_OFFLINE: 'true',
        NPM_CONFIG_UPDATE_NOTIFIER: 'false',
      },
    });
    const count = /# tests (\d+)/.exec(output);
    assert.equal(
      Number(count?.[1]),
      result.pruebas.pasan,
      'No se ejecutaron todos los casos registrados.',
    );
    tests += result.pruebas.pasan;
    console.log(
      `${result.id}: ${result.pruebas.pasan} pruebas pasan; evidencia original intacta.`,
    );
  }
  assert.equal(tests, report.resumen.pruebasDeEvaluacionAprobadas);
  console.log(
    `Reproducción: ${tests} pruebas; ${report.resumen.cobrosDemoConfirmados} cobros demo y ${report.resumen.cobrosFixturesConfirmados} con fixtures. Sin API de pasarelas. El informe inicial conserva los dos bloqueos por cuota.`,
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
