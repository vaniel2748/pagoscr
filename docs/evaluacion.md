# Evaluación del agente: cinco tareas fijas

Las [cinco tareas](../evaluacion/tareas.json) evalúan integrar pagos en aplicaciones
limpias usando la skill distribuida. La ejecución autorizada del 20 de noviembre
terminó con **3/5 tareas aprobadas y tres cobros demo confirmados**. Dos subagentes
fueron bloqueados por la cuota del servicio antes de ejecutar sus tareas. Permanecen
en el denominador; no se publica 5/5 ni se infiere éxito de ONVO/Tilopay a partir del demo.

| Caso                 | Primer resultado                         | Pruebas revisadas | Trabajo del agente |
| -------------------- | ---------------------------------------- | ----------------- | ------------------ |
| Demo CRC             | Aprobado, succeeded en el almacén        | 5 pasan           | 3 min              |
| Catálogo USD         | Aprobado, 2000 centavos USD confirmados  | 6 pasan           | 2 min 41 s         |
| Eventos concurrentes | Aprobado, una entrega y evento repetido  | 6 pasan           | 3 min 4 s          |
| ONVO con fixtures    | Bloqueado por cuota antes de implementar | Sin ejecutar      | Sin medición       |
| Tilopay con fixtures | Bloqueado por cuota antes de implementar | Sin ejecutar      | Sin medición       |

Los tiempos de trabajo fueron reportados por los subagentes. La revisión del
coordinador ocurrió después, en paralelo a instalación y autorización de GitHub;
su demora está separada en el [registro JSON](../evaluacion/resultados/2026-11-20.json).
No se presenta el tiempo del agente como una medición completa hasta la revisión.
No hubo correcciones del autor a esas tres soluciones. Se revisó el código, se
repitieron las 17 pruebas y se comprobaron 261 archivos congelados y los catálogos.

Se usaron subagentes Codex sin historial del autor, con el modelo heredado de la
sesión; el identificador del modelo no fue expuesto por la herramienta. Cada uno
recibió solo su app, pedido y skill. El paquete evaluado corresponde al commit
b887033, anterior a los resultados; no se usaron credenciales ni API de pasarelas.

La [evidencia original](../evaluacion/evidencia/2026-11-20/) conserva las soluciones
y pruebas sin reformatearlas, junto con sus hashes. Desde el checkout compilado:

```sh
npm run evaluacion:reproducir
```

Ese comando usa copias temporales y la dependencia local compilada, sin instalar
paquetes ni usar la red. Vuelve a ejecutar los tres casos terminados; **no crea
nuevas sesiones de agente** ni completa los dos casos bloqueados. También corre
en el CI. La E2E real ONVO del proyecto se reporta por separado.

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
Vaniel autorizó expresamente esta ejecución independiente. Para futuras ejecuciones,
la delegación debe respetar las autorizaciones de la sesión.

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
