# Bitácora de PagosCR

## 2026-11-20 14:20 · Paso 0 e importación

- Qué hizo Codex: leyó AGENTS.md, PLAN-TECNICO.md, ESTADO-INICIAL.md e INICIO-CODEX.md. Verificó Node 24.16.0, npm 11.13.0, Git 2.54.0 y gh 2.104.0. La consulta anónima `npm view pagoscr` devolvió 404: sin paquete público; no garantiza disponibilidad para publicar. Ya hay una skill oficial para crear skills; no instaló ninguna. Creó únicamente el repositorio local e importó los tres archivos autorizados desde RestaurantPay `cdae3f9`, sin modificaciones ni credenciales.
- Qué decidió o corrigió Vaniel: autorizó empezar conforme a INICIO-CODEX.md. No se ha solicitado usar credenciales, crear GitHub, publicar ni desplegar.
- Pruebas: copias idénticas byte por byte y SHA-256 verificados; los tres archivos de origen sin cambios locales; `git diff --cached --check` pasa. No hay pruebas de aplicación todavía.
- Commits: `adff5d9`.

## 2026-11-20 14:20 · Harness de desarrollo

- Qué hizo Codex: preparó reglas para ambos agentes, licencia MIT, variables vacías, TypeScript estricto, tsup, Vitest, Prettier, Secretlint y un control adicional para prefijos ONVO. Añadió hook de pre-commit y workflow de GitHub sin publicación automática. Node mínimo 22.12 por las herramientas vigentes; el entorno tiene Node 24. Conserva `prior-work/` sin reformatear ni compilar.
- Qué decidió o corrigió Vaniel: sin cambios adicionales.
- Pruebas: formato, tipos, escaneo de secretos y compilación ESM + declaraciones pasan. Harness sin casos de aplicación todavía (0 pruebas). Se fijó TypeScript 6 por incompatibilidad de su API de compilador en TypeScript 7 con tsup 9. Secretlint 14 incluye su preset recomendado; no se usa el paquete obsoleto. Dependencias: 0 vulnerabilidades reportadas por npm. El CI remoto queda pendiente de autorización para crear GitHub.
- Commits: este bloque se registra en el commit del harness; hash en el siguiente bloque.

## 2026-11-20 14:24 · Núcleo sin dependencias

- Qué hizo Codex: escribió primero la especificación y las pruebas monetarias. Implementó puerto, tipos, validadores y errores seguros en español. Los montos públicos son enteros seguros; cálculos intermedios con bigint y redondeo de mitades hacia arriba. Definió el contexto de pago del servidor y el contrato de almacén atómico para deduplicar webhooks.
- Qué decidió o corrigió Vaniel: sin cambios adicionales.
- Pruebas: 45 pasan, 0 fallan; se verificó previamente la fase roja por ausencia de implementación. Incluye productos intermedios mayores al rango seguro, desbordamientos, fracciones, NaN y monedas no admitidas. Tipos pasan.
- Commits: harness `806c727`; núcleo en este commit, hash en el próximo bloque.

## 2026-11-20 14:27 · Batería de contrato y procesamiento de webhooks

- Qué hizo Codex: preparó una única suite de 17 casos por adaptador y escribió primero las pruebas del procesador. Implementó carga del contexto del servidor, deduplicación atómica dentro del proceso y estados que no revierten un pago confirmado. El almacén en memoria se limita a demo y pruebas; se documentó la exigencia de transacción persistente para aplicaciones reales.
- Qué decidió o corrigió Vaniel: sin cambios adicionales.
- Pruebas: 53 pasan, 0 fallan. Ocho casos nuevos comprueban contexto, concurrencia, reintento, integridad de monto, cambios de estado y unicidad. La suite compartida está preparada y tipada; todavía no está ejecutada contra ningún adaptador.
- Commits: núcleo `c80b4fe`; batería en este commit, hash en el siguiente bloque.

## 2026-11-20 14:29 · Adaptador demo sin credenciales

- Qué hizo Codex: escribió especificación y pruebas antes del adaptador. Implementó una simulación con registros independientes, secreto efímero propio, HMAC sobre bytes crudos y tolerancia temporal. La operación de simulación es exclusiva del servidor. Vinculó la batería compartida al demo, sin red ni variables de entorno.
- Qué decidió o corrigió Vaniel: sin cambios adicionales; no se usó ninguna credencial externa.
- Pruebas: 73 pasan, 0 fallan: 17 de contrato demo y tres específicas de recorrido completo, bytes crudos y protección contra repeticiones antiguas/futuras. Tipos pasan.
- Commits: batería `ba374e9`; demo en este commit, hash en el próximo bloque.

## 2026-11-20 14:37 · ONVO con fixtures y prueba de red preparada

- Qué hizo Codex: consultó documentación oficial vigente y OpenAPI de ONVO, incluyendo autenticación, firmas, eventos, tarjetas de prueba, payment intents y checkout. Implementó el adaptador de payment intents: llaves secretas solo test, host HTTPS fijo, sin redirecciones, timeout de seis segundos, firma HMAC con rotación v1, contexto del servidor y confirmación autenticada por API antes de aceptar el pago. La creación devuelve pendiente; el adaptador no ofrece aún checkout hospedado. Los fixtures se declaran sintéticos, no grabaciones reales. Añadió una prueba de API separada con doble condición de llave y opt-in; no carga el archivo externo automáticamente.
- Qué decidió o corrigió Vaniel: la autorización para usar las llaves externas sigue pendiente. No se leyeron ni se usaron.
- Pruebas: 115 pasan, 0 fallan, incluida la misma batería de 17 casos para demo y ONVO. Una E2E queda omitida de forma segura sin llave/opt-in; la API real y la entrega de un webhook real no se han probado. La revisión añadió cuatro casos de defensa del núcleo: identificadores de evento deben ser texto y no pueden reutilizarse entre pagos. Se comprobó la fase roja antes de corregirlo. El hook ejecuta el conjunto completo antes del commit.
- Commits: demo `1ff7e37`; ONVO en este commit, hash registrado al cerrar el bloque.

### Pendientes al pausar para autorización

- P0.6: ejecutar la prueba de API de ONVO con autorización de Vaniel; crea/confirma una transacción ficticia de ₡20000 usando la tarjeta de prueba oficial. Webhook real requiere configurar un endpoint, fuera de esta prueba.
- P0.7–9: tarifas/calculadora, cuatro herramientas MCP e inicio rápido ejecutable. Se mantiene el orden de AGENTS.md.
- La página de precios de ONVO respondió 403 al acceso automatizado; no se actualizó su fecha de verificación. Tilopay sí publicó sus tarifas; antes de crear los datos se revalidarán ambas fuentes.
- GitHub, npm y despliegue todavía no autorizados ni realizados; el workflow está validado localmente, no ejecutado en GitHub.
