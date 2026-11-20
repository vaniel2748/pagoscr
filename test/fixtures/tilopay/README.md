# Fixtures Tilopay

Datos sintéticos basados en OpenAPI y las referencias oficiales de login,
processPayment y consult, revisadas el 20 de noviembre de 2026. No son respuestas
grabadas con credenciales reales.

El retorno modela exclusivamente los parámetros GET documentados. Se genera su
OrderHash V2 con valores ficticios durante la prueba, reproduciendo el algoritmo
del plugin oficial WooCommerce que originó prior-work. No se inventa el esquema
del webhook privado de processPayment. Consulta [la especificación](../../../docs/specs/tilopay.md).
