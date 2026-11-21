# Herramientas MCP de PagosCR

La instancia necesita el ejecutable `pagoscr-mcp` o el CLI compilado por stdio.
No uses un comando que agregue banners a stdout. Si el MCP no está conectado,
usa el paquete desde el backend y comunica esa diferencia; no simules resultados.

## comparar_pasarelas

Argumentos: `monto` en centavos enteros positivos, `moneda` CRC/USD, `metodo`
tarjeta/sinpe_movil y `tipoCambio` opcional en céntimos CRC por US$1. No tiene
tipo por defecto: `EXCHANGE_RATE_REQUIRED` pide uno explícito.

Devuelve tabla y `resultados`: costo/neto en centavos, desglose, cargos USD separados,
fuente, verificadoEl, revisadoEl, estado y advertencias. Las filas no verificadas o
negociadas no reciben total. Conserva la observación de acceso 403 de ONVO si está
presente; no presentes la revisión indexada como una verificación directa nueva.

## crear_cobro_de_prueba

Argumentos: pasarela demo/onvo, monto entero, moneda CRC/USD y descripcion.
No acepta secretos, datos de tarjeta, estado o campos adicionales. Crea un registro
de confianza en esta sesión. El monto viene del servidor o del experimento de
prueba expresamente pedido, no de un formulario público del comprador.

Devuelve `cobro.estado: pending`. En demo, `siguientePaso` contiene herramienta y
argumentos para verificar la notificación firmada. Es una simulación sin dinero.
Con ONVO, cobro.accionCliente.url contiene el enlace HTTPS del checkout alojado.
Ábrelo para introducir la tarjeta ficticia en ONVO; verifica después el evento
checkout_session.succeeded firmado. Crear el enlace o volver de ONVO no confirma.

## verificar_webhook

Argumentos: pasarela demo/onvo/tilopay, cuerpo textual y encabezados. Para ONVO
conserva exactamente el texto recibido; no vuelvas a serializar el JSON. Para
Tilopay usa el objeto producido por `normalizeTilopayReturn` desde el GET.

El pago debe estar registrado en esta sesión o en un PaymentStore persistente
conectado desde el backend. No existe un argumento para registrar el monto esperado
desde el cliente. Un pago desconocido requiere recuperar su registro original.

Éxito de verificación: `valido: true`, motivo y `pago.estado`/`pago.duplicado`.
Solo succeeded permite entregar; failed es un resultado auténtico de fallo.
Un duplicado no aplica efectos de nuevo. Los errores llevan código y mensaje
controlados: no reflejan cuerpos ni credenciales.

## diagnosticar_integracion

Sin argumentos. Muestra presencia y modos de configuración, nunca sus valores.
No llama APIs. Configuración local válida no equivale a permisos comprobados.
Para Tilopay distingue verificación del retorno de creación por MCP, que está
deshabilitada porque el formato de sus credenciales no prueba el entorno.
