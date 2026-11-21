# Evaluación del agente: cinco tareas fijas

Las [cinco tareas](../evaluacion/tareas.json) terminaron con **5/5 aprobadas**:
tres cobros demo y dos confirmaciones con fixtures (ONVO y Tilopay). Las dos
últimas se completaron al reintentar interrupciones de cuota. El
[primer informe 3/5](../evaluacion/resultados/2026-11-20.json) conserva ambos
bloqueos; el [informe completo](../evaluacion/resultados/2026-11-20-completa.json)
registra los reintentos sin convertirlos en éxitos al primer intento.

| Caso                 | Resultado observado                                                           | Pruebas  |
| -------------------- | ----------------------------------------------------------------------------- | -------- |
| Demo CRC             | succeeded en el almacén y repetición detectada                                | 5 pasan  |
| Catálogo USD         | 2000 centavos USD confirmados                                                 | 6 pasan  |
| Eventos concurrentes | Una entrega ante dos notificaciones iguales                                   | 6 pasan  |
| ONVO con fixtures    | Pendiente, método tokenizado, firma y consulta autenticada antes de succeeded | 12 pasan |
| Tilopay con fixtures | Retorno GET con V2, consult Test y captura confirmada                         | 16 pasan |

No hubo correcciones del autor a las cinco implementaciones. Los subagentes
trabajaron sin historial del autor, con la app, pedido, paquete y skill locales.
El modelo fue heredado de la sesión; la herramienta no expuso su identificador.
El paquete evaluado corresponde al commit b887033. Se revisó el código, se
repitieron las 45 pruebas y se comprobaron 261 archivos congelados y los cinco
catálogos. Ninguna de estas evaluaciones usó credenciales o API de pasarelas.

Los tres primeros agentes reportaron 3 min, 2 min 41 s y 3 min 4 s de trabajo.
La revisión del coordinador fue posterior y está separada en el registro. Los dos
últimos intervalos reportados incluyen la interrupción de cuota; no se pudo aislar
con confianza su tiempo activo. No se promete integrar ONVO/Tilopay en menos de
cinco minutos a partir de estos tiempos ni se presentan fixtures como E2E reales.
La E2E ONVO autorizada del proyecto se reporta por separado.

La [evidencia original](../evaluacion/evidencia/2026-11-20/) conserva código y
pruebas sin reformatear, junto con sus hashes. Desde el checkout compilado:

```sh
npm run evaluacion:reproducir
```

Usa copias temporales y la dependencia compilada, sin instalar paquetes ni usar
la red. Repite las 45 pruebas de las cinco soluciones y también corre en el CI.
Esta reproducción no crea nuevas sesiones de agente.

Criterios fijados antes de ejecutar:

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

Para un nuevo ensayo registra N/5 tareas completas y M/5 cobros confirmados, distinguiendo demo
y fixtures. Los casos ONVO/Tilopay de esta evaluación no prueban sus API ni entrega
de webhooks reales. La E2E ONVO autorizada del proyecto se reporta por separado.
Si una tarea requiere intervención para pasar, registra el primer resultado y la
corrección; no reemplaces el fallo original por un éxito sin asistencia.
