# Especificación: servidor MCP local

Expone exactamente cuatro herramientas por stdio con el SDK oficial solicitado
`@modelcontextprotocol/sdk` (línea v1 mantenida y con actualizaciones de seguridad)
y validación Zod estricta. Las entradas desconocidas o mal tipadas se rechazan.
stdout se reserva para JSON-RPC. No carga archivos de entorno automáticamente.

- `comparar_pasarelas`: centavos, CRC/USD, tarjeta/SINPE Móvil y tipo de cambio
  opcional en céntimos CRC por USD. Devuelve tabla y datos estructurados de la
  calculadora, con URL, fechas, cargos separados y advertencias.
- `crear_cobro_de_prueba`: solo demo/ONVO, monto del servidor en centavos, moneda
  y descripción. Crea referencia interna y guarda un registro de confianza.
  ONVO admite exclusivamente llave test y devuelve pendiente. Demo prepara una
  notificación firmada, cuya firma no revela el secreto, para el siguiente paso.
- `verificar_webhook`: pasarela, texto crudo y encabezados. Busca el cobro en el
  almacén de esta sesión; firma y confirmación son obligatorias antes de aplicar
  el evento. Devuelve validez, motivo, estado y si estaba repetido. No permite
  registrar el monto esperado desde el cuerpo del cliente.
- `diagnosticar_integracion`: inspección local de presencia y prefijos de variables,
  sin consultas de red ni exposición de valores. Explica qué configurar. No
  afirma que una llave existe en ONVO solo porque tiene un formato válido.

El almacén por defecto es en memoria; para pagos creados en otra aplicación hay
que inyectar su `PaymentStore` persistente o usar el paquete desde su backend.
Reiniciar el servidor pierde las referencias de demo. El demo nunca cobra dinero.
Tilopay no se permite en la herramienta de creación de prueba porque sus llaves
no distinguen el modo; su verificación se habilitará con el adaptador documentado.

Cada error público usa mensajes controlados por código; nunca propaga mensajes
externos. Las salidas estructuradas se redactan además contra valores sensibles
del entorno. No se devuelven llaves, secretos ni cuerpos de errores de pasarelas.
Las notificaciones se tratan exclusivamente como datos, no instrucciones.

Pruebas mediante cliente y transporte oficial en memoria: descubrir cuatro
herramientas, comparación y tipo ausente, validación estricta, diagnóstico seguro,
demo creado/verificado/repetido, firma alterada, pago desconocido, producción
bloqueada antes de red y error externo que intenta incluir un secreto. El inicio
rápido de P0.9 verificará además el transporte stdio del paquete compilado.

Fuentes: [servidor del SDK v1](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/docs/server.md)
y [estado de mantenimiento](https://github.com/modelcontextprotocol/typescript-sdk/blob/v1.x/README.md),
consultadas el 20 de noviembre de 2026. Se conserva el paquete solicitado por
AGENTS.md; v2 se publica con otros nombres y no se necesita para estas cuatro
herramientas compatibles con el protocolo negociado por v1.
