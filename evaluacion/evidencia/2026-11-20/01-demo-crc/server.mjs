import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PaymentError } from 'pagoscr';
import { crearCheckout } from './app.mjs';

const pagina = new URL('./public/index.html', import.meta.url);

function responder(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function leerCuerpo(req) {
  const partes = [];
  let bytes = 0;
  for await (const parte of req) {
    const buffer = Buffer.from(parte);
    bytes += buffer.length;
    if (bytes > 16_384) throw new PaymentError('INVALID_INPUT', 'El cuerpo excede el límite permitido.');
    partes.push(buffer);
  }
  return Buffer.concat(partes);
}

export function crearHandler(checkout = crearCheckout()) {
  return async (req, res) => {
    try {
      const ruta = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && ruta === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(await readFile(pagina));
        return;
      }
      if (req.method === 'POST' && ruta === '/api/ordenes') {
        let entrada;
        try {
          entrada = JSON.parse((await leerCuerpo(req)).toString('utf8'));
        } catch (error) {
          if (error instanceof PaymentError) throw error;
          throw new PaymentError('INVALID_INPUT', 'Envía un objeto JSON con productoId.');
        }
        const orden = await checkout.crearOrden(entrada);
        responder(res, 201, orden);
        // Este servidor es exclusivamente demo: simula la confirmación en el backend.
        // La respuesta conserva pending; solo processWebhook puede actualizar el almacén.
        const notificacion = await checkout.simularNotificacion(orden.id);
        await checkout.procesarNotificacion(notificacion);
        return;
      }
      const consulta = /^\/api\/ordenes\/([a-zA-Z0-9-]+)$/.exec(ruta);
      if (req.method === 'GET' && consulta) {
        responder(res, 200, await checkout.consultarOrden(consulta[1]));
        return;
      }
      if (req.method === 'POST' && ruta === '/webhooks/demo') {
        const rawBody = await leerCuerpo(req);
        const headers = Object.fromEntries(Object.entries(req.headers).map(([nombre, valor]) => [
          nombre, typeof valor === 'string' ? valor : undefined,
        ]));
        responder(res, 200, await checkout.procesarNotificacion({ rawBody, headers }));
        return;
      }
      responder(res, 404, { error: 'NOT_FOUND', mensaje: 'Ruta no disponible.' });
    } catch (error) {
      if (res.writableEnded) {
        // Error de simulación después de responder: nunca inventar succeeded.
        console.error('No se pudo confirmar la notificación demo; consulta el estado de la orden.');
        return;
      }
      const conocido = error instanceof PaymentError;
      responder(res, conocido ? (error.code === 'PAYMENT_NOT_FOUND' ? 404 : 400) : 500, {
        error: conocido ? error.code : 'INTERNAL_ERROR',
        mensaje: conocido ? error.message : 'No se pudo procesar el pago.',
      });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer(crearHandler()).listen(3000, '127.0.0.1', () => {
    console.log('Checkout demo: http://127.0.0.1:3000');
  });
}
