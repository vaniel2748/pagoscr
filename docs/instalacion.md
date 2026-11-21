# Instalar PagosCR en el agente

Requiere Node.js 22.12 o superior, npm y un cliente con soporte de plugins.
La distribución actual se prepara desde una copia del repositorio:

```sh
git clone https://github.com/vaniel2748/pagoscr.git
cd pagoscr
```

## Codex

```sh
node scripts/instalar-plugin.mjs codex
```

## Claude Code

```sh
node scripts/instalar-plugin.mjs claude
```

El instalador prepara dependencias si faltan, compila y registra el catálogo
local y `pagoscr@pagoscr-local` en la configuración de usuario. Reinicia la sesión
del agente para cargar las cuatro herramientas. El modo inicial es demo.
Añade `--dry-run` para ver los programas y argumentos que ejecutaría.

No hay versión publicada en npm. La instalación sin clonar está pendiente de
publicar la opción A ya preparada; estos comandos usan el checkout local existente.
[Comandos remotos preparados y pruebas en ambos clientes](distribucion-npm.md).

## Clientes comprobados

El 20 de noviembre de 2026 se instaló realmente en Codex 0.169.0-alpha.11.1
(`plugin add`) y Claude Code 2.1.150 (`plugin install`). Los listados nativos
confirmaron habilitación; las copias instaladas completaron diagnóstico, cobro
demo, confirmación y repetición mediante sus servidores MCP.

`npm run build` genera `build/marketplace/`: catálogo Codex en
`.agents/plugins/marketplace.json`, catálogo Claude en `.claude-plugin/marketplace.json`
y un plugin compartido con runtime, skill, tarifas y licencias. `plugin/` contiene
las plantillas; el artefacto generado incluye el código necesario para ejecutarlas.
[Formato y rutas](specs/plugin.md).

## Conectar solo el servidor

Después de compilar, usa el proceso stdio en la configuración de tu cliente:

```sh
node /ruta/absoluta/a/pagoscr/dist/mcp/cli.js
```

Reemplaza la ruta por la del checkout. Usa directamente Node: la salida adicional
de `npm run` puede interferir con JSON-RPC. Esta opción conecta el MCP sin instalar
el plugin completo.
