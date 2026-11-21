# ONVO: pantalla de pago de prueba

Contrato revisado en la documentación oficial y OpenAPI el 20 de noviembre de
2026: [enlace fijo](https://docs.onvopay.com/checkout/one-time-links),
[sesión](https://docs.onvopay.com/api/obtener-una-sesion-de-checkout),
[SDK](https://docs.onvopay.com/integrations/sdk) y
[eventos](https://docs.onvopay.com/webhooks/events).

- `OnvoAdapter({ checkout: true })` crea un enlace con un solo artículo, cantidad
  fija, importe entero del servidor, tarjeta y captura automática. Devuelve la
  referencia de sesión y su URL HTTPS de ONVO; conserva el modo anterior de
  intenciones para integraciones existentes.
- La sesión debe ser test y coincidir en importe y moneda. Las referencias se
  guardan antes de devolver el enlace al navegador o al agente.
- Confirmar requiere consultar la sesión y su intención vinculada, comprobar
  `complete`/`paid`, modo test, importe, moneda y recepción completa del dinero.
  No se supone que la metadata se copie automáticamente a la intención.
- `checkout_session.succeeded` verifica cuerpo crudo y firma existentes y pasa
  por `processWebhook`. No se inventa un evento de checkout fallido.
- La plantilla pública conserva demo por defecto. ONVO abre otra pestaña y la
  plantilla consulta al regresar. No se asume que ONVO admita retorno HTTP local;
  un retorno HTTPS configurado sirve la misma página, sin aceptar un estado final.
- Pruebas sintéticas en CI; E2E solo con opt-in y permiso para las llaves test.
  El webhook real y el túnel corresponden al bloque siguiente.
