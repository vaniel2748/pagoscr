# Evaluación del agente: cinco tareas fijas

Las [cinco tareas](../evaluacion/tareas.json) evalúan integrar pagos en aplicaciones
limpias usando la skill distribuida. **Todavía no se han ejecutado por agentes
independientes**. No hay porcentaje de éxito del agente ni se anuncia 5/5 a partir
de las pruebas de contrato, del inicio rápido o de soluciones escritas por el autor.

| Tarea                | Resultado que debe observarse                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| App vacía, demo CRC  | Pendiente guardado, webhook firmado, succeeded confirmado y monto del cliente rechazado.             |
| Catálogo USD         | US$19,99 + US$0,01 = 2000 centavos exactos, moneda conservada y pago confirmado.                     |
| Eventos concurrentes | Dos eventos iguales, una sola entrega; firma alterada rechazada y orden confirmada una vez.          |
| ONVO con fixtures    | Intención/método tokenizado, evento verificado más consulta; monto alterado y llave live rechazados. |
| Tilopay con fixtures | Retorno GET, V2 y consult; rechazo de firma, monto y entorno alterados.                              |

## Preparar la ejecución

Desde el checkout fuente, después de compilar:

```sh
node scripts/preparar-evaluacion.mjs
```

Crea cinco repositorios Git limpios en `evaluacion/runs/<fecha>/`, con catálogo,
app inicial sin pagos y el paquete ya compilado como dependencia local. npm se
ejecuta offline, sin scripts de instalación ni credenciales; no descarga paquetes.
Cada caso ONVO/Tilopay contiene solo fixtures sintéticos y configuración ficticia.
Guarda hashes de vendor/fixtures para detectar cambios que invaliden la prueba.
Los resultados empiezan pendientes, nunca aprobados por preparar el directorio.

Para validar conducta hay que dar a cada agente **solo** su TAREA.md, su repositorio
y la skill distribuida; no proporcionar implementación propuesta, hallazgos del
autor o contexto de otras tareas. El agente trabaja dentro de esa app, sin tocar
vendor/fixtures, sin instalar plugins, sin leer entornos y sin usar pasarelas reales.
La delegación debe estar autorizada conforme a las instrucciones de la sesión.

## Registrar y revisar

Cronometra desde la entrega del pedido hasta la comprobación independiente del
resultado. Ejecuta el npm test producido, revisa que haya afirmaciones de negocio
observables y contrasta los hashes de archivos congelados. Un test vacío, un pago
marcado exitoso desde el navegador o modificar un fixture para que coincida no pasa.

Por cada tarea registra: herramienta/modelo efectivamente usados, commit inicial,
archivos cambiados, duración incluyendo intervención humana, pruebas, estado final,
modalidad (demo o fixtures) y motivo si falla. Un bloqueo no se excluye del denominador.
Revisa que la descripción final del agente no confunda fixtures con una cuenta real.

El resultado será N/5 tareas completas y M/5 cobros confirmados, distinguiendo demo
y fixtures. Los casos ONVO/Tilopay de esta evaluación no prueban sus API ni entrega
de webhooks reales. La E2E ONVO autorizada del proyecto se reporta por separado.
Si una tarea requiere intervención para pasar, registra el primer resultado y la
corrección; no reemplaces el fallo original por un éxito sin asistencia.
