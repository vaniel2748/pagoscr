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

## 2026-11-20 14:38 · Verificación del paquete compilado y punto de autorización

- Qué hizo Codex: ejecutó con Node el recorrido demo importando `dist/index.js`: creó ₡20000, confirmó por webhook firmado y reconoció la repetición. Verificó que `prior-work/` no tiene diferencias contra la importación y que el repositorio quedó limpio antes de este registro final.
- Qué decidió o corrigió Vaniel: pendiente de autorización explícita para cargar `../.env.onvo` y ejecutar la prueba ficticia de ONVO. No se inició P0.7 para conservar el orden de piezas.
- Pruebas: 115 pasan, 0 fallan; una E2E omitida, no ejecutada con credenciales. Formato, tipos, Secretlint, control adicional de llaves y compilación ESM/declaraciones pasan. El demo compilado confirma y deduplica sin red.
- Commits: `adff5d9` (importación), `806c727` (harness), `c80b4fe` (núcleo), `ba374e9` (batería), `1ff7e37` (demo), `2471bd7` (ONVO con fixtures). Este commit documental cierra el registro del bloque.

## 2026-11-20 14:52 · ONVO: prueba de API autorizada y aprobada

- Qué hizo Codex: cargó las variables desde el archivo externo con el mecanismo nativo de Node, sin copiar ni mostrar su contenido. Ejecutó la prueba separada: método ficticio oficial, creación de intención por ₡20000, confirmación y consulta del resultado con referencia, importe y moneda coincidentes. El modo de prueba se validó antes de llamar a ONVO.
- Qué decidió o corrigió Vaniel: autorizó explícitamente usar las llaves de prueba para esta operación. La autorización queda registrada y no se vuelve a pedir para el mismo alcance. GitHub, npm y despliegue siguen sin autorizarse.
- Pruebas: E2E de API 1 pasa, 0 fallan, 0 omitidas; duración 2,33 segundos. Se conservan 115 pruebas locales aprobadas. La recepción de un webhook real no forma parte de esta prueba.
- Commits: `2471bd7` implementó ONVO; `508c8ea` registró el cierre anterior. Este bloque cierra P0.6; sigue P0.7 (tarifas y calculadora).

## 2026-11-20 14:58 · Tarifas verificables y calculadora en enteros

- Qué hizo Codex: escribió especificación y pruebas antes de los datos y la calculadora. Guardó las seis filas requeridas con URL, fechas, estado, país y advertencias. Revalidó Tilopay de forma directa; ONVO solo fue accesible mediante su página oficial indexada, por lo que conservó la verificación directa del 11 de noviembre y declaró el bloqueo 403 y la revisión indirecta del 20. Comparaciones en CRC/USD con tipo de cambio explícito en céntimos CRC por USD, redondeo en enteros y cargos de liquidación/mensualidad separados. El CI ejecuta un validador que rechaza fuentes o fechas ausentes.
- Qué decidió o corrigió Vaniel: sin nuevas decisiones. La verificación documental detectó que las cifras previas US$45/mes y US$200 de BAC proceden de Honduras; se preservó la fila no verificada, fuera del cálculo de Costa Rica. Tilopay/BAC publica 1% pero no el mínimo de US$0,30 ni la tarifa bancaria: sigue sin total calculado.
- Pruebas: 157 pasan, 0 fallan, incluidos tres casos que rechazan coerción de arrays a texto. Fuentes, formato, tipos y compilación pasan. E2E autorizada previa: 1 aprobada.
- Commits: E2E `bfc8a81`; tarifas y calculadora en este commit, hash en el siguiente bloque.

## 2026-11-20 15:06 · Servidor MCP con cuatro herramientas

- Qué hizo Codex: escribió especificación y pruebas con el cliente/transporte oficial antes de implementar. Construyó comparar_pasarelas, crear_cobro_de_prueba, verificar_webhook y diagnosticar_integracion con Zod estricto, salida estructurada, tabla de costos, errores públicos controlados y redacción adicional de secretos. El demo devuelve una notificación firmada, la segunda herramienta confirma contra su registro independiente y detecta repeticiones. ONVO verifica firma y consulta la API; la herramienta de creación rechaza Tilopay porque su llave no prueba el modo. El almacén de sesión es explícitamente temporal y admite inyectar uno persistente. Añadió CLI stdio sin registros en stdout.
- Qué decidió o corrigió Vaniel: sin nuevas decisiones. Se usa el SDK oficial `@modelcontextprotocol/sdk` 1.32.2 solicitado en AGENTS.md; su línea v1 sigue mantenida con correcciones y seguridad, mientras v2 tiene otros nombres de paquete. No se instaló ningún plugin ni MCP externo.
- Pruebas: 17 casos MCP pasan, más los 157 previos; tipos y compilación pasan. Se verificaron diagnóstico sin red ni valores, demo completo, ONVO con fixtures de extremo a extremo del protocolo, rechazo de producción antes de red y ocultación de secretos incluso en referencias/errores. npm reporta 0 vulnerabilidades en las dependencias instaladas.
- Commits: tarifas `c8d70f1`; MCP en este commit, hash en el siguiente bloque.

## 2026-11-20 15:13 · Inicio rápido de un comando y P0 completo localmente

- Qué hizo Codex: escribió especificación y guion que instala, compila y usa el ejecutable MCP por stdio con entorno sin credenciales de pasarelas. El recorrido descubre cuatro herramientas, diagnostica, exige tipo explícito para CRC, compara USD, crea un cobro demo, verifica firma/confirmación y detecta repetición. Añadió la ejecución del mismo guion a `npm run check` y, por tanto, al CI y al hook. Reescribió README con comando ejecutable, ejemplos, unidades y límites reales.
- Qué decidió o corrigió Vaniel: sin nuevas decisiones. GitHub, npm, despliegue y credenciales Tilopay siguen sin autorizarse.
- Pruebas: inicio rápido completo aprobado en una copia limpia con espacio en la ruta, sin node_modules/dist y con caché npm vacía: 5 segundos totales, tramo MCP 0,15 segundos. La prueba usó registro público de npm de forma anónima y modo demo sin red hacia pasarelas. 174 pruebas sin red aprobadas en el bloque anterior y 1 E2E ONVO autorizada aprobada; el hook vuelve a comprobar los controles locales antes del commit.
- Commits: MCP `d3d0c39`; inicio rápido `ab776a1`. La revisión posterior de npm pack --dry-run confirma 20 archivos, CLI y tarifas incluidos, sin prior-work ni archivos de credenciales y sin publicar nada.

### Estado tras P0

- P0.1–9 implementados y verificados localmente. El CI remoto/insignia espera autorización para crear GitHub.
- Para P1.10 se releyeron login, processPayment, consult/OpenAPI, tarjetas de prueba y webhooks de Tilopay. El portal publica el retorno GET pero entrega los campos del webhook de processPayment únicamente por Soporte. Antes de escribir el adaptador se consultará a Vaniel si usar el retorno documentado + consult o aportar el contrato oficial del webhook. No se inventarán campos.
