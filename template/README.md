# Checkout local: demo y ONVO test

Desde el checkout de PagosCR, con Node 22.12 o superior:

```sh
./scripts/quickstart.sh
npm run demo:checkout
```

Abre [http://127.0.0.1:4321](http://127.0.0.1:4321). Crea la orden, confirma el
pago demo y prueba el evento repetido. El servidor define el precio de ₡20000;
el navegador solo elige el producto. No se usan llaves ni se pide una tarjeta.

Si el puerto está ocupado, `PAGOSCR_DEMO_PORT=4322 npm run demo:checkout`.
Ctrl+C detiene el servidor. Solo escucha en 127.0.0.1; no se ha desplegado.
El plugin generado incluye el CLI y estos archivos, y se puede abrir con
`node dist/template/cli.js` desde su raíz, sin instalar dependencias.

`server.ts` usa Node HTTP y las mismas clases DemoAdapter, PaymentStore y
processWebhook del paquete. No se introduce un framework para esta plantilla
mínima. `cli.ts` inicia el proceso; HTML, CSS y JS son archivos estáticos locales.
Los cambios requieren `npm run build` antes de relanzar el demo.

El botón de confirmar es una operación de simulación **exclusiva del demo local**.
El evento se genera y verifica dentro del servidor. No hay endpoint de webhook
demo que acepte datos del navegador. Los POST exigen sesión, origen, token y JSON
sin campos de monto/moneda/estado; otra sesión no puede leer ni confirmar la orden.

Una orden por sesión; recargar recupera su estado. Una ventana privada inicia otra
sesión. El almacén se pierde al reiniciar; no equivale a persistencia de una app.
La repetición reutiliza el evento firmado y debe probarse en sus cinco minutos
de validez. Después se puede consultar el estado confirmado sin repetir eventos.

## ONVO con pantalla de pago

Con permiso para usar las llaves de prueba del archivo externo:

```sh
PAGOSCR_PASARELA=onvo node --env-file=../.env.onvo dist/template/cli.js
```

Crea la orden y pulsa **Pagar con ONVO**. La tarjeta ficticia se introduce en su
página; vuelve a esta pestaña para consultar el resultado. La recarga conserva la
orden y la sesión de pago. El monto sigue viniendo del catálogo del servidor.
El recibo solo aparece tras confirmar sesión e intención por API o procesar el
evento firmado. El retorno `/pago` ignora montos y estados de la URL.

El endpoint local `POST /api/webhooks/onvo` requiere ONVO_WEBHOOK_SECRET y pasa
cuerpo crudo y firma a processWebhook. No se expone automáticamente a internet.
El checkout abre otra pestaña; un retorno opcional PAGOSCR_RETURN_URL debe ser
HTTPS. [Guía y estado de las pruebas](../docs/onvo.md).

Para integrar otra app, carga su orden autorizada y un almacén persistente y sigue
las guías [ONVO](../docs/onvo.md), [Tilopay](../docs/tilopay.md) y
[seguridad](../docs/seguridad.md). No conviertas este simulador en un endpoint
público de cobro real. El despliegue requiere permiso de Vaniel.
