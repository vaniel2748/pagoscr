# PagosCR: estado al comenzar el Dojo AI Hackathon

Las reglas piden documentar el estado de un proyecto ya iniciado y separar el trabajo previo del avance hecho entre el 20 y el 22 de noviembre de 2026. Este archivo es esa declaración. Va en la raíz del repositorio de PagosCR desde el primer commit.

Redactado el 11 de noviembre de 2026. La sección 5 se completa el viernes 20 a las 9:00 a. m.

## 1. Resumen

- **PagosCR no existe todavía.** Al 11 de noviembre no hay repositorio, paquete, skill, servidor MCP ni plantilla.
- **Sí existe trabajo previo en otro proyecto.** RestaurantPay (repositorio privado, en producción desde octubre de 2026) tiene una integración de cobros con Tilopay. De ahí salen la experiencia y dos piezas de código que PagosCR toma como punto de partida.
- **Antes del 20 solo se hace preparación sin código:** cuentas, credenciales de prueba, verificación de tarifas y preguntas a los organizadores.
- **También existe un plan escrito antes del hackathon.** `PLAN-TECNICO.md` (11 de noviembre) define la arquitectura, las pruebas y el calendario. Es planificación, no código, y se declara aquí para que conste.

## 2. Trabajo previo (RestaurantPay)

Estado del repositorio al redactar: commit `c09a125` del 15 de octubre de 2026. Carpeta `apps/api/src/modules/payments/`.

| Pieza                          | Archivo                              | Líneas | Pruebas | ¿Se reutiliza?                                        |
| ------------------------------ | ------------------------------------ | ------ | ------- | ----------------------------------------------------- |
| Puerto de pago (interfaz)      | `providers/payment-provider.port.ts` | 73     | —       | Sí, como base                                         |
| Adaptador de Tilopay           | `providers/tilopay.adapter.ts`       | 263    | 10      | Sí, como base                                         |
| Adaptador de pruebas           | `providers/sandbox.adapter.ts`       | 58     | —       | Sí, como base del modo demo                           |
| Adaptador sin configurar       | `providers/unconfigured.adapter.ts`  | 27     | —       | No                                                    |
| Adaptador BAC (FAC/PowerTranz) | `providers/fac.adapter.ts`           | 50     | 3       | No: rechaza todo cobro, falta la documentación de BAC |
| Fábrica de proveedores         | `payment-provider.factory.ts`        | 141    | —       | No: es específica de RestaurantPay                    |
| Servicio de pagos              | `payments.service.ts`                | 688    | 8       | No: maneja cuentas de mesa y división de cuenta       |

Documentos previos que alimentan el proyecto, todos de RestaurantPay:

- `docs/adr/0002-integracion-tilopay.md` (26 de junio): contrato de Tilopay y decisiones.
- `docs/SECURITY.md` y `docs/THREAT_MODEL.md`: reglas de seguridad para apps de dinero.
- `docs/PASARELAS-COSTOS.md` (13 de octubre): comparación de costos entre pasarelas.
- `docs/ACTIVAR_TILOPAY.md`: guía para activar cobros por comercio.

## 3. Lo que no existe y se construye del 20 al 22

- Paquete independiente y público, sin dependencias de RestaurantPay ni de NestJS/Prisma.
- Adaptador de ONVO Pay.
- Confirmación del cobro contra la API de Tilopay (`/api/v1/consult`), que el adaptador actual no hace.
- Servidor MCP: calculadora de costos por pasarela, crear cobro de prueba, verificar webhook.
- Skill para Claude Code con las reglas de seguridad y el flujo de integración.
- Plantilla de checkout.
- Modo demo que corre sin credenciales, para que el jurado pueda revisarlo.
- Documentación, publicación en Dojo Marketplace y video del demo.

## 4. Cómo se distingue lo previo de lo nuevo

1. El primer commit de PagosCR importa, sin cambios, solo los tres archivos marcados "Sí" en la tabla. Mensaje: `import: trabajo previo de RestaurantPay`.
2. Todo commit posterior es avance del hackathon. La diferencia contra ese primer commit es lo que se evalúa.
3. `BITACORA.md` registra, por bloque de trabajo, qué hizo la herramienta de IA y qué decidió la persona.

## 5. Para completar el viernes 20 a las 9:00 a. m.

| Dato                                       | Valor                                                                |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Commit de RestaurantPay del que se importa | `cdae3f9` (los tres archivos sin cambios locales)                    |
| Commit de importación en PagosCR           | `adff5d9`                                                            |
| Fecha y hora del primer commit             | 2026-11-20 14:18:16 CST (UTC−6)                                      |
| Integrantes del equipo                     | Vaniel González                                                      |
| Herramientas de IA usadas                  | Codex para construcción; planificación previa hecha con Claude Code. |

La tabla de la sección 2 declara el estado del 11 de noviembre. La importación del 20 de noviembre usa el estado actual indicado arriba: 84 líneas del puerto, 426 del adaptador Tilopay y 50 del adaptador sandbox. Se copiaron exclusivamente esos tres archivos, sin modificaciones, a `prior-work/`. Ninguna credencial ni otro archivo de RestaurantPay se importó.
