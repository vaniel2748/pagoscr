# Especificación: skill PagosCR

Entrada: petición de agregar o depurar cobros de prueba en Costa Rica, comparar
pasarelas o verificar notificaciones. Salida: integración en el stack existente,
con monto del servidor y un cobro confirmado verificable, o diagnóstico preciso
del bloqueo. Una elección previa de pasarela se respeta.

La skill descubre contexto, diagnostica configuración local, calcula mediante el
MCP, integra backend/checkout y verifica confirmación y deduplicación. Nunca hace
cálculos de tarifas con el modelo ni asume tipos de cambio. Un pequeño conversor
de texto decimal a centavos reutiliza el núcleo determinista del paquete.

SKILL.md mantiene propósito, flujo y reglas esenciales. Tres referencias separan
contratos MCP, ONVO y Tilopay. Incluye la autorización ya existente en la sesión,
modo de prueba, origen no confiable de notificaciones, confirmación API y alcance
real del retorno Tilopay. Las reglas de commits/bitácora y RestaurantPay se aplican
al construir PagosCR, no se imponen como tareas adicionales en la app del builder.

Metadatos de Codex con selección automática por defecto. No se instala la skill
en ninguna configuración personal. Se valida con el script oficial skill-creator,
se revisan referencias locales y se ejecuta el conversor con entradas válidas,
subcentavos y desbordamientos. Esa validación estructural no sustituye la evaluación
del agente de cinco tareas prevista en P2.
