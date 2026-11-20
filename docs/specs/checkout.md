# Especificación: checkout demo local

Una plantilla mínima con Node HTTP nativo, TypeScript y HTML/CSS/JS sin framework.
Evita una dependencia de servidor para tres rutas de demo y permite compilarla con
el paquete existente. Solo escucha en 127.0.0.1; no despliega ni carga credenciales.

El catálogo del servidor contiene un producto de ₡20000. El navegador selecciona
su id; nunca envía monto, moneda final o estado. GET /api/catalogo inicia una sesión
local con cookie HttpOnly/SameSite Strict y token de petición. POST /api/cobros
crea una sola orden por sesión, incluso ante llamadas concurrentes. Los POST
validan origen, token, JSON estricto y tamaño máximo de 4096 bytes.

POST /api/cobros/:id/confirmar-demo es un control explícito y exclusivo de esta
demostración local. El servidor simula y conserva un evento firmado, lo procesa
por processWebhook y consulta el estado del almacén. No hay ruta pública que
acepte un cuerpo de evento o que permita escoger un estado. Repetir procesa el
mismo evento y muestra su deduplicación. GET /api/cobros/:id consulta la orden
únicamente de la sesión dueña. Otro navegador no puede leerla ni confirmarla.

La interfaz distingue pendiente, confirmado y error. Un éxito solo aparece con
estado succeeded devuelto por el backend; volver a cargar recupera el estado de
la misma sesión. No solicita tarjeta ni datos personales. Usa CSP sin scripts
inline, archivos locales y diseño adaptable sin peticiones de terceros.

Pruebas HTTP: recorrido completo, repetición, integridad del precio, rechazo de
estado/monto/moneda del cliente, concurrencia, dueño de sesión, CSRF/origen,
cuerpos mal formados/excesivos, Host y cabeceras. Verificación visual con Playwright
en escritorio y móvil. No se declara integración real de ONVO en esta plantilla.

Limitaciones: almacén/sesiones en memoria, una orden por sesión, eventos demo
firmados válidos cinco minutos, ejecución local. Para una app persistente sigue
docs/seguridad.md e integra explícitamente su pasarela. No se publica sin permiso.
