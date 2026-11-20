#!/usr/bin/env node
import { createCheckoutServer } from './server.js';

const port = Number(process.env.PAGOSCR_DEMO_PORT ?? '4321');
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  console.error('PAGOSCR_DEMO_PORT debe ser un entero entre 1024 y 65535.');
  process.exit(1);
}
const server = createCheckoutServer({
  assetsDirectory: new URL('../../template/', import.meta.url),
});
server.once('error', () => {
  console.error(
    'No se pudo abrir el demo. Revisa que el puerto local esté libre.',
  );
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    `Checkout demo: http://127.0.0.1:${port} · Solo prueba, sin credenciales.`,
  );
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.closeAllConnections();
    server.close();
  });
}
