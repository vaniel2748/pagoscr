# Plantillas de distribución

Estas son plantillas, no el directorio que se instala. `npm run build` genera el
plugin completo y los catálogos en `build/marketplace/`, copiando únicamente
runtime, skill, tarifas, documentación y avisos de licencia. No incluye prior-work,
credenciales ni node_modules.

La instalación real modifica configuración del cliente y requiere autorización
de Vaniel cuando la ejecuta un agente. Se puede revisar el plan sin instalar:

```sh
node scripts/instalar-plugin.mjs codex --dry-run
node scripts/instalar-plugin.mjs claude --dry-run
```

La [especificación](../docs/specs/plugin.md) registra formatos oficiales, comandos
y diferencias de rutas. No se publica nada automáticamente al compilar.
