import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { formatMajorUnits } from '../dist/index.js';

const started = performance.now();
const client = new Client({ name: 'pagoscr-quickstart', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [fileURLToPath(new URL('../dist/mcp/cli.js', import.meta.url))],
  // El SDK solo hereda variables de sistema permitidas. No pasamos llaves.
  env: {
    PAGOSCR_PROVIDER: 'demo',
    ONVO_TEST_SECRET_KEY: '',
    ONVO_WEBHOOK_SECRET: '',
    PAGOSCR_RUN_ONVO_E2E: '',
  },
  stderr: 'pipe',
});
const call = (name, args = {}) =>
  client.callTool({ name, arguments: args }, undefined, { timeout: 10000 });
function data(result) {
  assert.notEqual(
    result.isError,
    true,
    'La herramienta devolvió un error. Revisa su configuración.',
  );
  assert.equal(
    result.structuredContent?.ok,
    true,
    'Falta una respuesta estructurada válida.',
  );
  return result.structuredContent;
}

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'comparar_pasarelas',
    'crear_cobro_de_prueba',
    'diagnosticar_integracion',
    'verificar_webhook',
  ]);
  const diagnosis = data(await call('diagnosticar_integracion'));
  assert.equal(diagnosis.demo.configuracionLocalValida, true);
  assert.equal(diagnosis.onvo.llave.configurada, false);
  console.log(
    'MCP: cuatro herramientas disponibles. Demo listo sin credenciales.',
  );

  const missingRate = await call('comparar_pasarelas', {
    monto: 2_000_000,
    moneda: 'CRC',
    metodo: 'tarjeta',
  });
  assert.equal(missingRate.isError, true);
  assert.equal(
    missingRate.structuredContent?.error.codigo,
    'EXCHANGE_RATE_REQUIRED',
  );
  console.log('CRC sin tipo de cambio: solicita uno explícito, no lo inventa.');

  const comparison = data(
    await call('comparar_pasarelas', {
      monto: 20_000,
      moneda: 'USD',
      metodo: 'tarjeta',
    }),
  );
  const rows = comparison.resultados.filter(
    (row) => row.costoCentavos !== null,
  );
  assert.equal(rows.length, 2);
  console.log('Costo base para cobrar US$200.00, sin convertir moneda:');
  for (const row of rows) {
    assert.ok(row.fuente.startsWith('https://') && row.verificadoEl);
    console.log(
      `  ${row.pasarela}: ${row.costoFormateado} · fuente ${row.fuente} · verificado ${row.verificadoEl}`,
    );
  }
  console.log(
    'Los cargos por liquidación/mensualidad y las advertencias están separados en el resultado.',
  );

  const created = data(
    await call('crear_cobro_de_prueba', {
      pasarela: 'demo',
      monto: 2_000_000,
      moneda: 'CRC',
      descripcion: 'Primer cobro demo de PagosCR',
    }),
  );
  assert.equal(created.cobro.estado, 'pending');
  const request = created.siguientePaso.argumentos;
  const verified = data(await call('verificar_webhook', request));
  assert.equal(verified.valido, true);
  assert.equal(verified.pago.estado, 'succeeded');
  assert.equal(verified.pago.duplicado, false);
  const repeated = data(await call('verificar_webhook', request));
  assert.equal(repeated.pago.duplicado, true);
  console.log(
    `Cobro DEMO ₡${formatMajorUnits(2_000_000)}: confirmado. Evento repetido: detectado.`,
  );
  console.log(
    `Recorrido MCP: ${((performance.now() - started) / 1000).toFixed(2)} segundos. No se movió dinero real.`,
  );
} catch {
  console.error(
    'El inicio rápido falló. Ejecuta npm run check y revisa Node.js, la compilación y la configuración local del MCP.',
  );
  process.exitCode = 1;
} finally {
  await client.close();
}
