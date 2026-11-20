# Tilopay: formulario alojado, retorno y consult

PagosCR usa el **retorno GET documentado y consulta autenticada obligatoria**,
según la elección de Vaniel. El contrato privado del webhook de processPayment
se obtiene de Soporte; no se inventa ni se presenta el retorno como ese webhook.

Fuentes oficiales revisadas el 20 de noviembre de 2026:
[login](https://tilopay.com/developers/api/autenticacion),
[processPayment y retorno](https://tilopay.com/developers/api/hosted-payment-page/process-payment),
[consult](https://tilopay.com/developers/api/procesos-operativos/consult),
[webhooks](https://tilopay.com/developers/api/webhooks) y
[tarjetas de prueba](https://tilopay.com/developers/tarjetas-de-prueba).

## Elegir prueba y cargar datos originales

El operador debe activar prueba en el panel del comercio. Tilopay comparte host y
credenciales entre modos: `testMode: true` declara esa elección local, **no verifica
el panel antes de generar una URL**. La creación MCP excluye Tilopay por ese motivo.
El adaptador acepta resultados únicamente cuando consult devuelve entorno Test.
Todavía no se han usado credenciales ni ejecutado una E2E de Tilopay en PagosCR.

Guarda API user, password y key como variables de entorno del backend. El login
usa **apiuser**, no email, y renueva el token según `expires_in`. El constructor
necesita los datos originales de facturación; no uses los fixtures como datos
del comprador. Una instancia con hash activo pertenece al contexto de esa orden
y correo, no a todos los compradores de una aplicación.

```ts
import {
  TilopayAdapter,
  normalizeTilopayReturn,
  processWebhook,
  type TilopayBilling,
  type PaymentStore,
  type PaymentRecord,
} from 'pagoscr';

export function configurarTilopay(facturacionOriginal: TilopayBilling) {
  const apiUser = process.env.TILOPAY_API_USER;
  const apiPassword = process.env.TILOPAY_API_PASSWORD;
  const apiKey = process.env.TILOPAY_API_KEY;
  if (
    !apiUser ||
    !apiPassword ||
    !apiKey ||
    process.env.TILOPAY_TEST_MODE !== 'true'
  ) {
    throw new Error('Configura Tilopay y confirma prueba en el panel.');
  }
  return new TilopayAdapter({
    apiUser,
    apiPassword,
    apiKey,
    testMode: true,
    billing: facturacionOriginal,
    billToEmail: facturacionOriginal.email,
  });
}

export async function recibirRetornoTilopay(
  query: URLSearchParams,
  provider: TilopayAdapter,
  store: PaymentStore,
) {
  return processWebhook(provider, normalizeTilopayReturn(query), store);
}

export async function recuperarCapturaTilopay(
  registroDelServidor: PaymentRecord,
  provider: TilopayAdapter,
  store: PaymentStore,
) {
  const event = await provider.lookupCapturedPayment(registroDelServidor);
  return event ? store.applyVerifiedEvent(registroDelServidor, event) : null;
}
```

Al crear, llama `createCharge` con orden, centavos y moneda cargados del servidor,
y una `returnUrl` HTTPS controlada por tu app. Guarda la respuesta pendiente en
el `PaymentStore` como en el [ejemplo ONVO](onvo.md). Tilopay usa el id de la orden
como `providerPaymentId`. Redirige únicamente a `charge.clientAction.url` cuando
su tipo sea `redirect`; el adaptador valida HTTPS y dominio Tilopay.

## Procesar el retorno

Recibe order, tpt o tilopay-transaction, code, auth y OrderHash. La normalización
rechaza claves repetidas/referencias en conflicto y descarta los demás campos.
Usa order solo para localizar el registro y su facturación de confianza; no para
autorizar acceso a datos del comprador. Elige la instancia con el correo original
de esa orden y llama a `recibirRetornoTilopay`.

El hash **V2** está activo por defecto y procede de
[Tilopay para WooCommerce 3.1.3](https://wordpress.org/plugins/tilopay/),
`WCTilopay::computed_customer_hash`. Su origen exacto, SHA-256 y fórmula están en
la [especificación](specs/tilopay.md). No es un algoritmo públicamente garantizado
por el portal de la API. Pide confirmación a Soporte si cambia su integración.
Nunca desactives el hash automáticamente al fallar: revisa correo, versión y
contexto. `requireOrderHash: false` es una elección explícita de solo consulta;
consult sigue siendo obligatorio. Si también configuras correo original, un hash
presente se comprueba aun en ese modo; sin correo y con esa opción explícita se
usa solo consult.

La consulta debe devolver una única transacción coincidente en orden, tpt,
importe textual exacto, moneda, código y autorización, tipo Payment y entorno
Test. Para éxito exige código 1 y captura Capture. Un code=1 del navegador o la
existencia de una URL no demuestra pago. No entregues con una autorización pendiente.

Si el comprador cierra el navegador, `recuperarCapturaTilopay` consulta desde el
servidor. Devuelve null si no hay captura; rechaza producción y ambigüedades.
Comparte el identificador tpt:1 con el retorno: aplica ambos caminos al mismo
almacén transaccional para deduplicar y evitar entregar dos veces.

| Problema                    | Qué revisar                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Faltan datos de facturación | Carga nombre, apellidos, dirección, ciudad, estado, código postal, país ISO, teléfono y correo del servidor. address2 puede estar vacío. |
| INVALID_SIGNATURE           | Correo original normalizado, OrderHash V2 y contrato del plugin oficial.                                                                 |
| TEST_MODE_REQUIRED          | Panel en prueba y environment Test en consult.                                                                                           |
| PAYMENT_MISMATCH            | Referencia/tpt, moneda, importe, captura, autorización y transacciones duplicadas.                                                       |
| GATEWAY_ERROR               | Login apiuser, permisos y disponibilidad; reconcilia antes de crear otra orden.                                                          |
