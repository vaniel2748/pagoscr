#!/usr/bin/env node
import { createCheckoutServer } from './server.js';

const port = Number(process.env.PAGOSCR_DEMO_PORT || '4321');
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) {
  console.error('PAGOSCR_DEMO_PORT debe ser un entero entre 1024 y 65535.');
  process.exit(1);
}
const pasarela = process.env.PAGOSCR_PASARELA || 'demo';
if (pasarela !== 'demo' && pasarela !== 'onvo') {
  console.error('PAGOSCR_PASARELA debe ser demo u onvo.');
  process.exit(1);
}
let server: ReturnType<typeof createCheckoutServer>;
try {
  server = createCheckoutServer({
    assetsDirectory: new URL('../../template/', import.meta.url),
    ...(pasarela === 'onvo'
      ? {
          onvo: {
            secretKey: process.env.ONVO_TEST_SECRET_KEY ?? '',
            ...(process.env.ONVO_WEBHOOK_SECRET
              ? { webhookSecret: process.env.ONVO_WEBHOOK_SECRET }
              : {}),
          },
          ...(process.env.PAGOSCR_RETURN_URL
            ? { returnUrl: process.env.PAGOSCR_RETURN_URL }
            : {}),
        }
      : {}),
  });
} catch {
  console.error(
    'Configura una llave secreta test de ONVO y, si recibes avisos, el secreto de firma del endpoint.',
  );
  process.exit(1);
}
server.once('error', () => {
  console.error(
    'No se pudo abrir el checkout. Revisa que el puerto local esté libre.',
  );
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(
    `Checkout ${pasarela}: http://127.0.0.1:${port} · ${pasarela === 'demo' ? 'Simulación sin credenciales.' : 'ONVO en modo de prueba; la tarjeta se introduce en su página.'}`,
  );
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.closeAllConnections();
    server.close();
  });
}
