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

## Qué se verificó antes de publicar

Se empaquetó el tarball privado y se sirvió desde un registro npm **local temporal**,
manteniendo la solicitud de versión exacta. Las dependencias procedieron del
registro público sin credenciales. Así se probó el artefacto sin subirlo a npm.

| Cliente                    | Instalación nativa comprobada el 21-11-2026                                               |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Codex CLI 0.171.0-alpha.13 | Catálogo GitHub, plugin habilitado 0.1.0 en caché temporal y MCP con cuatro herramientas. |
| Claude Code 2.1.150        | Catálogo GitHub, plugin habilitado 0.1.0 en caché temporal y MCP con cuatro herramientas. |

Cada prueba partió de una carpeta vacía y usó configuración/caché temporales.
Se ejecutaron los lanzadores de las copias instaladas: diagnóstico sin llaves,
comparación, cobro demo confirmado, repetición deduplicada y conversor de centavos.
El directorio de trabajo siguió vacío. El checkout del tarball también sirvió
HTML/CSS/JS y completó el cobro demo con deduplicación.

Estos resultados describen la preparación con registro temporal. Después de
publicar se repite la descarga anónima desde el registro público; el resultado
se conserva en la [bitácora](https://github.com/vaniel2748/pagoscr/blob/main/BITACORA.md).

La instalación local anterior sigue disponible con
`node scripts/instalar-plugin.mjs codex` o `claude`, desde el checkout.
[Guía de instalación](instalacion.md) y [formato del plugin](specs/plugin.md).

Fuentes oficiales revisadas el 21 de noviembre:
[OpenAI](https://developers.openai.com/plugins/build/plugins),
[catálogo Claude](https://code.claude.com/docs/en/plugin-marketplaces) y
[declaración MCP](https://code.claude.com/docs/en/plugins-reference#mcpservers).
