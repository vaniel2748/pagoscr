# PagosCR

Cobros de prueba y comparación de pasarelas para builders en Costa Rica.

Construido por Vaniel González con Codex durante el Dojo AI Hackathon,
del 20 al 22 de noviembre de 2026. Planificación previa con Claude Code.

En construcción. El inicio rápido ejecutable se incorpora en P0.9.
Todavía no se ha publicado el paquete ni creado un repositorio remoto.

Requiere Node.js 22.12 o superior; se desarrolla y verifica con Node.js 24.

```sh
npm ci --ignore-scripts
npm run check
npm run hooks:install
```

`npm run check` ejecuta formato, tipos, pruebas sin red, búsqueda de secretos
y compilación. `prior-work/` conserva los tres archivos originales sin cambios;
queda fuera de la compilación y del formato, pero sí se revisa por secretos.

Licencia MIT. Consulta `ESTADO-INICIAL.md` y `BITACORA.md` para la procedencia.
