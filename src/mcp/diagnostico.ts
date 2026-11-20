export type Environment = Readonly<Record<string, string | undefined>>;

export function diagnosticarIntegracion(env: Environment) {
  const key = env.ONVO_TEST_SECRET_KEY;
  const keyMode = !key
    ? 'ausente'
    : key.startsWith('onvo_live_')
      ? 'produccion'
      : /^onvo_test_secret_key_[A-Za-z0-9_-]+$/.test(key)
        ? 'prueba'
        : 'invalida';
  const webhookValid = /^whsec_[A-Za-z0-9_-]+$/.test(
    env.ONVO_WEBHOOK_SECRET ?? '',
  );
  const acciones: string[] = [];
  if (keyMode !== 'prueba')
    acciones.push(
      'Configura ONVO_TEST_SECRET_KEY con una llave secreta test en el entorno del servidor; no la pegues en el chat.',
    );
  if (!webhookValid)
    acciones.push(
      'Configura ONVO_WEBHOOK_SECRET con el secreto de firma del endpoint de prueba para verificar notificaciones.',
    );
  return {
    ok: true,
    modo: 'prueba',
    alcance:
      'Configuración local: no consulta la API ni comprueba la vigencia de las llaves.',
    almacen:
      'Los cobros y eventos se guardan en la memoria de este proceso. Reiniciar pierde las referencias.',
    demo: { configuracionLocalValida: true, requiereCredenciales: false },
    onvo: {
      llave: { configurada: Boolean(key), modo: keyMode },
      secretoWebhookConfigurado: Boolean(env.ONVO_WEBHOOK_SECRET),
      configuracionLocalParaCrearValida: keyMode === 'prueba',
      configuracionLocalParaVerificarValida:
        keyMode === 'prueba' && webhookValid,
      acciones,
    },
    tilopay: {
      crearCobroDePruebaPermitido: false,
      configuracionLocalParaVerificarValida: Boolean(
        env.TILOPAY_API_USER?.trim() &&
        env.TILOPAY_API_PASSWORD?.trim() &&
        env.TILOPAY_API_KEY?.trim() &&
        env.TILOPAY_BILL_TO_EMAIL?.trim() &&
        env.TILOPAY_TEST_MODE === 'true',
      ),
      notificacionAdmitida:
        'Retorno GET documentado normalizado; no el webhook privado de processPayment.',
      variablesConfiguradas: {
        TILOPAY_API_USER: Boolean(env.TILOPAY_API_USER),
        TILOPAY_API_PASSWORD: Boolean(env.TILOPAY_API_PASSWORD),
        TILOPAY_API_KEY: Boolean(env.TILOPAY_API_KEY),
        TILOPAY_TEST_MODE: env.TILOPAY_TEST_MODE === 'true',
        TILOPAY_BILL_TO_EMAIL: Boolean(env.TILOPAY_BILL_TO_EMAIL),
      },
      acciones: [
        'Tilopay usa las mismas credenciales en prueba y producción. La herramienta de crear cobros permite únicamente demo u ONVO con prefijo test.',
        'Para verificar retornos, configura las variables indicadas y el correo original de facturación del servidor. Activa prueba en el panel y TILOPAY_TEST_MODE=true; consult debe corroborar environment Test.',
      ],
    },
  };
}
