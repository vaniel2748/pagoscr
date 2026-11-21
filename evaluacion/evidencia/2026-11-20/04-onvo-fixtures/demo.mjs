import { bloquearRed, crearAppOnvo } from './app.mjs';
import {
  cargarEscenarioSintetico,
  identidadSintetica,
  metodoTokenizadoSintetico,
} from './fixtures-locales.mjs';

globalThis.fetch = bloquearRed;
const escenario = await cargarEscenarioSintetico();
const app = crearAppOnvo(escenario);
const creada = await app.crearCobro(identidadSintetica);
const trasConfirmar = await app.confirmarMetodoTokenizado({
  ...identidadSintetica,
  paymentMethodId: metodoTokenizadoSintetico,
});
const evento = escenario.firmarEvento();
const resultado = await app.recibirWebhook(evento);
const repetido = await app.recibirWebhook(evento);
const orden = await app.obtenerOrden(identidadSintetica);

console.log(JSON.stringify({
  alcance: 'Integración local con fixtures sintéticos; red bloqueada.',
  estadoAlCrear: creada.status,
  estadoTrasConfirmarMetodo: trasConfirmar.status,
  evento: resultado,
  repetido,
  orden,
  peticiones: escenario.peticiones.map(({ method, path, autenticada }) => ({ method, path, autenticada })),
}, null, 2));
