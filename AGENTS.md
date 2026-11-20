# PagosCR: reglas para agentes

Trabaja en español con Vaniel. Construye un solo paquete TypeScript estricto, con dinero en centavos enteros. `prior-work/` es inmutable y no forma parte del paquete. Respeta el orden P0 → P1 → P2 del plan de la carpeta superior.

## Reglas que no se rompen

1. **Dinero siempre en centavos enteros** (`number` entero, nunca decimales). Ningún cálculo de dinero con punto flotante.
2. **El servidor decide el monto.** El cliente nunca envía el monto final ni el estado del pago.
3. **Ningún secreto en el repositorio.** Las llaves se leen de variables de entorno. Hay un `.env.example` sin valores. Ninguna herramienta MCP devuelve ni registra una llave.
4. **Solo modo de prueba.** `crear_cobro_de_prueba` rechaza llaves de producción (por ejemplo, las que empiezan con `onvo_live_`).
5. **Un webhook no se cree sin verificar.** Se verifica la firma cuando la pasarela la ofrece y, además, se confirma el estado contra la API de la pasarela antes de dar un pago por bueno.
6. **Ninguna cifra sin fuente.** Cada tarifa en `data/tarifas.json` lleva `fuente` (URL) y `verificadoEl` (fecha). El CI falla si falta alguna.
7. **No inventes contratos de API.** Antes de escribir un adaptador, lee la documentación oficial vigente (sección 6). Si algo no está documentado, dilo y pregunta.
8. **No toques RestaurantPay.** Su carpeta es solo de lectura: copias tres archivos y nada más. Nunca copies sus `.env`, credenciales, datos de restaurantes ni nada fuera de esos tres archivos.
9. **Commits pequeños y frecuentes**, en español, con prefijo (`feat:`, `test:`, `docs:`, `ci:`, `fix:`). El historial es la prueba del avance durante el hackathon.
10. **Bitácora al día.** Después de cada bloque de trabajo agrega una entrada en `BITACORA.md` (formato en la sección 9).

### Detente y pregunta a Vaniel antes de:

- Crear el repositorio en GitHub o hacerlo público.
- Publicar en npm.
- Desplegar la plantilla.
- Usar cualquier credencial. Las llaves de prueba de ONVO están en `../.env.onvo`, fuera del repositorio: cárgalas desde ahí (por ejemplo con `dotenv` y esa ruta), nunca copies su contenido dentro de `pagoscr/`, nunca lo muestres en la terminal ni lo escribas en la bitácora.
- Instalar una skill, plugin o servidor MCP que no venga de una fuente oficial (sección 4).
- Cambiar el alcance o saltarte una regla de esta sección.
