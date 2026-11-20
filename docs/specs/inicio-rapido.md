# Especificación: inicio rápido ejecutable

Desde el checkout de fuentes, `./scripts/quickstart.sh` verifica Node, instala
dependencias locales con el lockfile sin scripts de instalación, compila y completa
un pago demo. No publica ni configura cuentas, plugins o servidores en el equipo.
`--check` omite instalación/compilación para el CI, que ya hizo ambos pasos.

El cliente oficial abre el ejecutable MCP compilado por stdio, con entorno
restringido sin credenciales de pasarelas. Descubre las cuatro herramientas,
diagnostica el demo, comprueba que CRC sin tipo de cambio pide uno y compara USD
sin conversión implícita. Después crea ₡20000 ficticios, verifica la notificación
firmada y comprueba la deduplicación. Cierra el cliente y el proceso hijo.

La salida muestra el resultado y el tiempo. Una aserción fallida termina con
código distinto de cero, haciendo fallar el CI. Cada llamada tiene timeout de
diez segundos. No imprime cuerpos firmados ni información del entorno.

El tiempo de instalación no se confunde con el tiempo de protocolo: el shell
mide el flujo completo; el cliente mide el tramo MCP. La meta de cinco minutos
se evalúa ejecutando el comando completo desde un checkout sin node_modules.
Las pruebas de API ONVO quedan separadas y no se ejecutan con este guion.
