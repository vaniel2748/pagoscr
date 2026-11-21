# Distribución por npm y catálogo GitHub

Vaniel eligió la opción A y autorizó la publicación el 21 de noviembre de 2026.
El runtime y el conversor se distribuyen como **pagoscr@0.1.0**, con versión exacta.
El indicador private:true se retiró después de esa autorización.

## Instalar desde el catálogo GitHub

Desde cualquier carpeta, con Node.js 22.12 o superior, npm, Git y el cliente:

```sh
codex plugin marketplace add vaniel2748/pagoscr && codex plugin add pagoscr@pagoscr
```

```sh
claude plugin marketplace add vaniel2748/pagoscr && claude plugin install pagoscr@pagoscr --scope user
```

El cliente obtiene el catálogo y el plugin de GitHub. No hay un git clone manual
ni una compilación local. El MCP ejecuta `npx -y --package=pagoscr@0.1.0 -- pagoscr-mcp`;
el conversor usa la misma versión exacta. El paquete también incluye
`pagoscr-checkout`, la plantilla y sus recursos.

Los catálogos raíz son `.agents/plugins/marketplace.json` para Codex y
`.claude-plugin/marketplace.json` para Claude. Ambos apuntan a `plugins/pagoscr`.
La compilación genera ese árbol ligero desde `skill/` y las plantillas `plugin/`.
El control del CI exige que sus archivos estén versionados y sincronizados;
no incluye runtime, entornos ni node_modules en el plugin GitHub.

## Publicación y comprobación desde npm

**pagoscr@0.1.0 se publicó el 21 de noviembre de 2026 a las 10:28 de Costa Rica.**
El registro público permitió descargarlo sin autenticación y su integridad SHA-512
coincidió con el tarball enviado: 116 archivos, 771960 bytes comprimidos.
[Paquete público](https://www.npmjs.com/package/pagoscr) y
[evidencia de distribución](evidencia-distribucion-0.1.0.json).

Después de publicar se repitieron las instalaciones nativas desde GitHub con
configuración temporal y cachés nuevas. Los lanzadores de las copias instaladas
descargaron la versión exacta desde npm público, sin credenciales ni registro local.

| Cliente                    | Instalación nativa y ejecución comprobadas el 21-11-2026                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Codex CLI 0.171.0-alpha.13 | Plugin habilitado 0.1.0; cuatro herramientas, cobro demo, deduplicación y conversor. |
| Claude Code 2.1.150        | Plugin habilitado 0.1.0; cuatro herramientas, cobro demo, deduplicación y conversor. |

Cada prueba partió de una carpeta vacía y mantuvo ese directorio sin archivos.
Se ejecutaron diagnóstico sin llaves, comparación, creación y confirmación demo,
repetición deduplicada y conversión de unidades. Los tres ejecutables públicos
también pasaron por separado con otra caché nueva: MCP, conversor y checkout.
El checkout sirvió HTML/CSS/JS, tomó el monto del catálogo del servidor y confirmó
el pago demo con deduplicación.

Estas comprobaciones ejecutan los lanzadores instalados; la evaluación de tareas
por agentes se documenta por separado en [evaluacion.md](evaluacion.md).

## Preparación antes de publicar

Se empaquetó el tarball privado y se sirvió desde un registro npm **local temporal**,
manteniendo la solicitud de versión exacta. Las dependencias procedieron del
registro público sin credenciales. Así se probó el artefacto sin subirlo a npm.

Ese ensayo previo aprobó el mismo recorrido con ambas copias instaladas y los
tres ejecutables. La [bitácora](../BITACORA.md) conserva la preparación, la
autorización de Vaniel y la comprobación posterior desde el registro público.

La instalación local anterior sigue disponible con
`node scripts/instalar-plugin.mjs codex` o `claude`, desde el checkout.
[Guía de instalación](instalacion.md) y [formato del plugin](specs/plugin.md).

Fuentes oficiales revisadas el 21 de noviembre:
[OpenAI](https://developers.openai.com/plugins/build/plugins),
[catálogo Claude](https://code.claude.com/docs/en/plugin-marketplaces) y
[declaración MCP](https://code.claude.com/docs/en/plugins-reference#mcpservers).
