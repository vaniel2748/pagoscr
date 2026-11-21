const $ = (id) => document.getElementById(id);
let token;
let payment = null;
let product;
let busy = false;
let provider = 'demo';

function render() {
  const state = payment?.estado ?? 'new';
  const onvo = provider === 'onvo';
  document.body.dataset.state = state;
  $('status-label').textContent =
    state === 'succeeded'
      ? 'Pago confirmado'
      : state === 'failed'
        ? 'El pago no se confirmó'
        : state === 'pending'
          ? onvo
            ? 'Esperando el pago en ONVO'
            : 'Orden lista. Falta confirmar.'
          : 'Todo listo para empezar';
  $('primary-action').textContent = busy
    ? 'Procesando…'
    : state === 'succeeded'
      ? 'Consultar estado'
      : state === 'pending'
        ? onvo
          ? 'Consultar pago'
          : 'Confirmar pago demo'
        : state === 'failed'
          ? 'Consultar estado'
          : onvo
            ? 'Crear orden de prueba'
            : 'Crear orden demo';
  $('primary-action').className =
    onvo && state === 'pending' ? 'replay-button' : 'primary-button';
  $('primary-action').disabled = busy || !token;
  $('replay-action').hidden = onvo || state !== 'succeeded';
  const payLink = $('onvo-payment');
  const canPay =
    onvo && state === 'pending' && payment?.accionCliente?.type === 'redirect';
  payLink.hidden = !canPay;
  if (canPay) payLink.href = payment.accionCliente.url;
  else payLink.removeAttribute('href');
  $('replay-action').disabled = busy;
  $('reference-block').hidden = !payment;
  $('payment-reference').textContent = payment?.id ?? '';
  document
    .querySelector('.checkout-card')
    .setAttribute('aria-busy', String(busy));
  const completed = state === 'succeeded' ? 3 : state === 'pending' ? 1 : 0;
  ['step-order', 'step-payment', 'step-receipt'].forEach((id, i) => {
    $(id).classList.toggle('done', i < completed);
    $(id).classList.toggle('current', i === completed);
    $(id).querySelector('.step-icon').textContent =
      i < completed ? '✓' : String(i + 1);
  });
}
async function request(path, body) {
  const options =
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-pagoscr-csrf': token,
          },
          body: JSON.stringify(body),
        };
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? 'No se pudo completar la prueba.');
  return result;
}
async function act(repeat = false) {
  if (busy) return;
  busy = true;
  $('error').hidden = true;
  render();
  try {
    let result;
    if (!payment) {
      result = await request('/api/cobros', { producto: product.id });
      $('feedback').textContent =
        provider === 'onvo'
          ? 'Abrí el pago en ONVO, usá una tarjeta de prueba y volvé a esta pestaña.'
          : 'Tu orden está lista. Ahora podés confirmar el pago de prueba.';
    } else if (
      provider === 'demo' &&
      (payment.estado === 'pending' || repeat)
    ) {
      result = await request(`/api/cobros/${payment.id}/confirmar-demo`, {});
      $('feedback').textContent = result.duplicado
        ? 'Evento repetido detectado. El pago se aplicó una sola vez.'
        : '¡Listo! El servidor verificó tu pago. No se movió dinero real.';
    } else {
      result = await request(`/api/cobros/${payment.id}`);
      $('feedback').textContent =
        result.pago.estado === 'succeeded'
          ? '¡Listo! El servidor confirmó tu pago de prueba.'
          : result.pago.estado === 'failed'
            ? 'El enlace venció sin un pago confirmado. Revisá la orden antes de crear otro cobro.'
            : 'ONVO todavía no confirmó el pago. Podés volver a consultar.';
    }
    payment = result.pago;
  } catch (error) {
    $('error').textContent =
      error instanceof Error
        ? error.message
        : 'Revisá tu conexión y volvé a intentar.';
    $('error').hidden = false;
  } finally {
    busy = false;
    render();
  }
}
$('primary-action').addEventListener('click', () => act());
$('replay-action').addEventListener('click', () => act(true));
window.addEventListener('focus', () => {
  if (provider === 'onvo' && payment?.estado === 'pending') void act();
});
try {
  // Datos del catálogo: el navegador nunca calcula ni envía el monto final.
  request('/api/catalogo')
    .then((catalog) => {
      token = catalog.csrfToken;
      provider = catalog.pasarela ?? 'demo';
      product = catalog.producto;
      payment = catalog.pago;
      if (provider === 'onvo') {
        $('mode-label').textContent = 'ONVO · prueba';
        $('intro-copy').textContent =
          'Probá un cobro con tarjeta en la página de ONVO. Usá únicamente una tarjeta de prueba.';
        $('card-feature').textContent = 'Tarjeta de prueba';
        $('operation-type').textContent = 'ONVO · prueba';
        $('payment-step-title').textContent = 'Pagá en ONVO';
        $('payment-step-copy').textContent =
          'Se abre en otra pestaña. Volvé aquí al terminar.';
        $('feedback').textContent =
          payment?.estado === 'pending'
            ? 'Tu orden sigue lista. Abrí ONVO para pagar o consultá el estado.'
            : 'Creá tu orden para abrir el pago con tarjeta de prueba.';
      }
      $('product-name').textContent = product.nombre;
      document.querySelectorAll('[data-price]').forEach((node) => {
        node.textContent = product.montoFormateado;
      });
      if (payment?.estado === 'succeeded')
        $('feedback').textContent =
          'Recuperamos tu recibo: el pago está confirmado.';
      render();
    })
    .catch(() => {
      $('status-label').textContent = 'No se pudo cargar el checkout';
      $('primary-action').textContent = 'Recargá la página';
      $('error').textContent =
        'Revisá que el servidor local esté activo y recargá la página.';
      $('error').hidden = false;
      document
        .querySelector('.checkout-card')
        .setAttribute('aria-busy', 'false');
    });
} catch {
  /* El mensaje estático permanece visible si el navegador no admite fetch. */
}
