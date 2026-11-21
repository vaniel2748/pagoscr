# Seguridad y estado del pago

PagosCR está limitado a **pruebas**. El demo no mueve dinero; ONVO rechaza llaves
live antes de llamar a la red. En Tilopay el operador activa prueba en el panel
y el resultado consultado debe declarar Test. El adaptador no puede comprobar
ese ajuste antes de crear la URL, por eso la herramienta MCP de creación no lo ofrece.

## La orden vive en el servidor

El navegador puede seleccionar un producto o una orden que le pertenezca. El
backend autentica al comprador y carga precio, moneda e identificador desde su
catálogo/base de datos. No copie monto, moneda final, estado ni referencia de
otro comprador desde el body del navegador. Un UUID o una referencia difícil de
adivinar no sustituyen autorización.

Las herramientas MCP son para el agente autorizado del builder. No expongas
`crear_cobro_de_prueba(monto, ...)` como endpoint público de checkout. El monto
de esa herramienta sirve para una prueba deliberada del agente; el checkout de
una app obtiene el importe de su propio servidor.

Dinero: `number` entero seguro en centavos y cálculos intermedios con bigint.
`parseMajorUnits('20000.00')` da 2000000; no uses `parseFloat(texto) * 100`.
El tipo de cambio también es entero y explícito. Más detalle en [tarifas](tarifas.md).

## Secretos y datos del comprador

Las variables de [.env.example](../.env.example) están vacías. Configura sus valores
fuera del repositorio. No los pongas en frontend, prompts, fixtures, capturas,
salidas MCP ni bitácora. El diagnóstico indica presencia/modo, nunca el valor.
Los adaptadores usan propiedades privadas y errores públicos controlados.

Un agente pide autorización antes de usar una credencial; no la vuelve a pedir
para una operación ya autorizada con el mismo alcance. Las llaves ONVO usadas en
la E2E del proyecto permanecen en un archivo externo, sin copiarlo al paquete.
No cargues automáticamente ese archivo al arrancar el demo.

Tokeniza tarjetas con el cliente de la pasarela. El MCP no recibe PAN ni CVV.
Minimiza los datos de facturación almacenados y evita registrar el query completo
de retorno Tilopay. No incluyas cuerpos de respuesta remotos en errores al usuario.
Los hosts de API son fijos HTTPS, sin seguir redirecciones, con timeout.

## Verificar antes de aplicar

`peekWebhookReference` es una lectura **no autenticada**, útil solo para localizar
el registro. `processWebhook` carga la orden y exige verificación del adaptador:

| Pasarela | Autenticación y confirmación                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Demo     | Firma HMAC efímera, timestamp y registro de simulación independiente.                                                  |
| ONVO     | Cuerpo crudo, X-Onvo-Signature, tolerancia de cinco minutos y consulta autenticada de sesión/intención según el flujo. |
| Tilopay  | Retorno GET normalizado, OrderHash V2 por defecto y consult autenticado obligatorio.                                   |

El evento debe coincidir con pasarela, referencia, monto y moneda del registro.
La firma por sí sola no convierte un pago en exitoso. Tampoco lo hacen un retorno
del navegador, una URL de pago, HTTP 200, `valido: true` sin estado succeeded, ni
una autorización pendiente. Si la API no confirma, conserva pendiente o el estado
preexistente; no cambies a éxito para que pase la demostración.

El verificador admite hasta 65536 bytes; el servidor HTTP debe imponer el límite
al leer el stream, antes de acumular un cuerpo arbitrario. En ONVO usa los bytes
recibidos antes del parser JSON. No mezcles la firma de una pasarela con otra.
Los retornos Tilopay se adaptan explícitamente; no representan su webhook privado.

## Confirmar por consulta del servidor

La plantilla también puede confirmar un checkout sin esperar su webhook. Consulta
ONVO con la llave test del servidor y la sesión guardada: exige complete/paid,
cantidad, monto y moneda de la orden, más su intención vinculada succeeded con
receivedAmount completo. La URL de retorno o el estado del navegador no participan.

Ese resultado se registra con `consulta-checkout:<sesión>:<estado>`, un id interno
determinista para deduplicar la confirmación. No pretende ser un evento de ONVO.
El cliente no lo envía ni lo escoge; `PaymentStore` comprueba el pago original y
aplica el resultado verificado atómicamente. Equivale a confirmar Tilopay mediante
`lookupCapturedPayment` y `consult`: la consulta autenticada aporta la evidencia.

## Persistir y deduplicar

`InMemoryPaymentStore` y el almacén por defecto del MCP son para demo/pruebas.
Se pierden al reiniciar y no coordinan procesos. Para una app, implementa el
contrato `PaymentStore` con estas garantías:

1. Orden única y referencia única por pasarela; monto/moneda originales inmutables.
2. Id de evento único por pasarela, vinculado a referencia, monto, moneda y estado.
3. Inserción del evento y actualización del pago en **una transacción**. Ante un
   duplicado idéntico, devuelve el estado actual con duplicate=true. Ante el mismo
   id con datos distintos, rechaza.
4. Nunca reviertas succeeded por un evento tardío de fallo. Un fallo previo puede
   avanzar a succeeded solo con confirmación válida posterior.
5. Entrega/facturación con efecto único, mediante la misma transacción o un outbox
   persistente. Una comprobación en memoria seguida de dos escrituras no es atómica.

Una consulta y un webhook pueden tener ids distintos para el mismo pago. Vincula
el efecto de entrega a la orden, además de deduplicar eventos, para no entregarla
dos veces cuando lleguen ambas confirmaciones.

Mantén la misma referencia al reintentar y reconcilia un timeout de creación antes
de generar otro cobro. No se promete idempotencia distribuida de creación: depende
de la orden y del almacén de tu aplicación.

## Verificaciones disponibles

`npm run check` ejecuta contrato común, pruebas específicas, tipos, secretos,
validación de tarifas, compilación e inicio rápido. Comprueba ambos paquetes
desde una copia aislada. No usa credenciales de pasarelas ni llama sus API.
Las E2E de API ONVO requieren activación y autorización. Además, el 21 de noviembre
se recibió y verificó un webhook real de checkout test antes de anonimizarlo;
su [procedencia](../test/fixtures/onvo/PROCEDENCIA.md) distingue la firma original
de la firma ficticia usada para probar la copia modificada en CI. Tilopay se ha
comprobado con fixtures. Los avisos de terceros acompañan la distribución compilada.
