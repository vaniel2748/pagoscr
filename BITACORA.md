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
