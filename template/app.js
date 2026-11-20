const $ = (id) => document.getElementById(id);
let token;
let payment = null;
let product;
let busy = false;

function render() {
  const state = payment?.estado ?? 'new';
  document.body.dataset.state = state;
  $('status-label').textContent =
    state === 'succeeded'
      ? 'Pago confirmado'
      : state === 'pending'
        ? 'Orden lista. Falta confirmar.'
        : 'Todo listo para empezar';
  $('primary-action').textContent = busy
    ? 'Procesando…'
    : state === 'succeeded'
      ? 'Consultar estado'
      : state === 'pending'
        ? 'Confirmar pago demo'
        : 'Crear orden demo';
  $('primary-action').disabled = busy || !token;
  $('replay-action').hidden = state !== 'succeeded';
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
        'Tu orden está lista. Ahora podés confirmar el pago de prueba.';
    } else if (payment.estado === 'pending' || repeat) {
      result = await request(`/api/cobros/${payment.id}/confirmar-demo`, {});
      $('feedback').textContent = result.duplicado
        ? 'Evento repetido detectado. El pago se aplicó una sola vez.'
        : '¡Listo! El servidor verificó tu pago. No se movió dinero real.';
    } else {
      result = await request(`/api/cobros/${payment.id}`);
      $('feedback').textContent =
        'Estado consultado: tu pago sigue confirmado.';
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
try {
  // Datos del catálogo: el navegador nunca calcula ni envía el monto final.
  request('/api/catalogo')
    .then((catalog) => {
      token = catalog.csrfToken;
      product = catalog.producto;
      payment = catalog.pago;
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
