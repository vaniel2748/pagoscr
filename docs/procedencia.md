# Autoría, trabajo previo y distribución

PagosCR lo construye Vaniel González con Codex durante el Dojo AI Hackathon,
del 20 al 22 de noviembre de 2026. La planificación previa se hizo con Claude Code.
El paquete público usa licencia [MIT](../LICENSE).

`prior-work/` conserva exclusivamente tres archivos de RestaurantPay, importados
sin modificaciones en el primer commit `adff5d9`, desde su commit `cdae3f9`:
puerto de pago, adaptador Tilopay y adaptador sandbox. Esos archivos son evidencia
de procedencia: no se compilan ni se distribuyen en el paquete.

El [estado inicial](../ESTADO-INICIAL.md) declara qué existía antes del hackathon.
Los commits posteriores, la [bitácora](../BITACORA.md) y las
[especificaciones](specs/) muestran lo construido y las decisiones de Vaniel.

El artefacto de plugins contiene runtime JS, skill, tarifas y avisos de licencias
de las dependencias incluidas. El núcleo no depende de Node, NestJS ni Prisma;
los adaptadores y el servidor usan las funciones de su entorno.

El repositorio y su CI son públicos. Publicar npm y desplegar requieren una
decisión separada del dueño. Los archivos de entorno permanecen fuera del paquete.

La revisión y fechas de tarifas, incluido el acceso automatizado 403 de ONVO,
están en [tarifas.md](tarifas.md). La licencia MIT del paquete no concede derechos
sobre recursos de diseño externos mantenidos fuera de este repositorio.
