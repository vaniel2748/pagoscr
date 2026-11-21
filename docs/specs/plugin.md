# Especificación: distribución local para Claude Code y Codex

Fuentes oficiales leídas el 20 de noviembre de 2026:
[OpenAI: empaquetar plugins](https://developers.openai.com/plugins/build/plugins),
[Claude: manifiesto](https://code.claude.com/docs/en/plugins-reference) y
[marketplace](https://code.claude.com/docs/en/plugin-marketplaces).
También se consultó la ayuda instalada: Codex 0.169.0-alpha.11.1 usa plugin add;
Claude Code 2.1.150 usa plugin install y dispone de plugin validate --strict.

Se generan dos catálogos locales en build/marketplace y un plugin compartido en
plugins/pagoscr. El catálogo Codex vive en .agents/plugins/marketplace.json y el
de Claude en .claude-plugin/marketplace.json. Las plantillas versionadas viven en
plugin/. No se anuncian URLs GitHub/npm que aún no existen.

El 21 de noviembre Vaniel eligió preparar la distribución npm: los catálogos raíz
y `plugins/pagoscr` ya están en GitHub, con runtime y conversor fijados a 0.1.0.
La publicación fue autorizada con un sí separado. Los clientes se probaron con
el tarball en un registro temporal antes de usar el registro público. [Diseño, comandos y evidencia](../distribucion-npm.md).

El plugin contiene ambos manifiestos, skill/referencias/conversor, paquete ESM,
tarifas, licencia y avisos de dependencias. El MCP y sus dependencias JS quedan
compilados juntos; la ejecución requiere Node, sin node_modules externo. Se
conservan los nombres del paquete y exports para el conversor de la skill.

Claude referencia el CLI con CLAUDE_PLUGIN_ROOT. La configuración de Codex usa
cwd relativo al plugin y un argumento relativo al CLI, verificado contra el
[cargador oficial](https://github.com/openai/codex/blob/main/codex-rs/codex-mcp/src/plugin_config.rs).
Así no depende de una expansión de variables propia del otro cliente. No se usa
shell para lanzar el servidor ni se añaden llaves al manifiesto. El demo es el
modo inicial y las credenciales permanecen fuera del artefacto.

`node scripts/instalar-plugin.mjs codex` o `claude` instala desde un checkout con
un comando: dependencias si faltan, compilación, catálogo local y alta del plugin
mediante la CLI elegida. --dry-run muestra cada programa/argumento sin ejecutarlo.
El instalador modifica configuración de usuario solo cuando se invoca realmente;
su ejecución por un agente requiere la autorización de AGENTS.md. Preparar y
validar el paquete no instala nada ni usa cuentas del cliente.

Verificación: manifiestos y rutas contenidos, ausencia de archivos de entorno,
prior-work y node_modules, arranque stdio del paquete aislado, demo completo y
conversor sin dependencias del repo. El cliente Claude valida además el catálogo
y plugin con su validador nativo, si está disponible. El 20 de noviembre Vaniel
autorizó y se completó la instalación real en ambos clientes. Sus listados nativos
confirman habilitación y las copias instaladas pasan el recorrido MCP demo sin
credenciales. No se ejecutaron modelos externos ni se usaron API de pasarelas
para verificar la instalación.
