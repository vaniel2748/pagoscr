# PagosCR

[![CI](https://github.com/vaniel2748/pagoscr/actions/workflows/ci.yml/badge.svg)](https://github.com/vaniel2748/pagoscr/actions/workflows/ci.yml)

Agregar pagos en Costa Rica exige aprender cada pasarela y entender sus comisiones.
PagosCR ayuda a Claude Code y Codex a comparar costos y agregar cobros de prueba a tu app.

## ¿Cuánto cuesta cobrar ₡20 000?

Ejemplo con tarjeta y un tipo de cambio elegido de **₡500 por US$1**:

| Pasarela | Costo base por venta | Fuente                                    | Verificado |
| -------- | -------------------: | ----------------------------------------- | ---------- |
| ONVO     |                 ₡955 | [Tarifas](https://onvopay.com/pricing)    | 2026-11-11 |
| Tilopay  |               ₡1 025 | [Tarifas](https://tilopay.com/en/tarifas) | 2026-11-20 |

Usá tu propio tipo de cambio; mensualidad/liquidación van aparte y las tarifas no verificadas requieren revisión. [Detalle y fuentes](docs/tarifas.md).

## Instalar en tu agente

Desde el checkout, con Node.js 22.12 o superior y npm:

```sh
node scripts/instalar-plugin.mjs codex
```

Para Claude Code: `node scripts/instalar-plugin.mjs claude`. Reiniciá la sesión.
[Preparar el checkout y ver la instalación completa](docs/instalacion.md).

## Probar el demo sin cuenta ni tarjeta

```sh
./scripts/quickstart.sh
```

Crea un cobro ficticio, lo confirma y comprueba que un aviso repetido no lo duplique.
El mismo recorrido corre en el CI.

## Qué hace el agente

| Herramienta                | Para qué sirve                                                              |
| -------------------------- | --------------------------------------------------------------------------- |
| `comparar_pasarelas`       | Compara el costo de cobrar, con fuente y fecha.                             |
| `crear_cobro_de_prueba`    | Prepara el cobro; ONVO devuelve un enlace para pagar con tarjeta de prueba. |
| `verificar_webhook`        | Comprueba el aviso y el pago con la pasarela, y detecta repeticiones.       |
| `diagnosticar_integracion` | Indica qué falta configurar y cómo corregirlo.                              |

[5 de 5 tareas terminaron en un cobro de prueba confirmado (2 tras un reintento por cuota)](docs/evaluacion.md).

## Abrir la pantalla de pago

Después de compilar, `npm run demo:checkout` abre el checkout demo en
[http://127.0.0.1:4321](http://127.0.0.1:4321).

Para ONVO, configurá las llaves test en el archivo externo y ejecutá:

```sh
PAGOSCR_PASARELA=onvo node --env-file=../.env.onvo dist/template/cli.js
```

Pagás en ONVO y volvés a consultar. El servidor toma el precio de su catálogo y
confirma el resultado con la pasarela. [Pasos y tarjeta de prueba](docs/onvo.md).

## Integrar y revisar

- [Usar el paquete desde tu app](docs/usar-paquete.md) y [plantilla de checkout](template/README.md).
- Guías: [ONVO](docs/onvo.md), [Tilopay](docs/tilopay.md), [seguridad](docs/seguridad.md) y [tarifas](docs/tarifas.md).
- [Pruebas y mediciones](docs/verificacion.md), [clientes comprobados](docs/instalacion.md#clientes-comprobados) y [evaluación completa](docs/evaluacion.md).
- [Procedencia y autoría](docs/procedencia.md), [bitácora](BITACORA.md) y [especificaciones](docs/specs/).

```sh
npm run check
```

315 pruebas locales, 51 de ellas de contrato compartido; 45 pruebas adicionales
reproducen la evaluación del agente. Las E2E de ONVO se ejecutan por separado.

Hecho por Vaniel González con Codex durante el Dojo AI Hackathon del 20 al 22 de
noviembre de 2026; planificación previa con Claude Code. [Licencia MIT](LICENSE).
