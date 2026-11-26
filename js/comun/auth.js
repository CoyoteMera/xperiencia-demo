/* Errores de Supabase Auth a texto en español: los usan la app del viajero y acceso.html. Puro. */

const MENSAJES_AUTH = {
  'credenciales': 'Correo o contraseña incorrectos.',
  'clave-igual': 'Esa es tu contraseña actual. Escribe una distinta.',
  'correo-existe': 'Ese correo ya tiene cuenta. Entra con tu contraseña, o usa «Olvidé mi contraseña» para poner una nueva.',
  'correo-sin-confirmar': 'Falta confirmar tu correo. Abre el enlace que te mandamos (mira también el correo no deseado).',
  'clave-debil': 'La contraseña es muy corta. Usa al menos 6 caracteres.',
  'demasiados-intentos': 'Demasiados intentos. Espera unos minutos.',
  'correo-invalido': 'Ese correo no parece válido.',
  'sin-conexion': 'Sin conexión. Revisa tu internet.'
};

const INTENTOS_AUTH = {entrar: 'entrar', crear: 'crear tu cuenta', clave: 'cambiar tu contraseña', reenviar: 'reenviar el correo'};

/* Los errores de Supabase Auth, a {codigo, mensaje} en español (los mismos textos que daba el
   demo con los códigos de su proveedor anterior). `contexto` ('entrar' | 'crear' | 'clave' | 'reenviar') solo cambia el texto de lo
   que no reconocemos. Pura: la usan las pruebas. */
export function normalizarErrorAuth(e, contexto = 'entrar'){
  const code = e && e.code ? String(e.code) : '';
  const msg = e && e.message ? String(e.message) : '';
  const nombre = e && e.name ? String(e.name) : '';
  let codigo = 'otro';
  if(code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(msg))
    codigo = 'correo-existe';
  else if(code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    codigo = 'credenciales';
  else if(code === 'email_not_confirmed')
    codigo = 'correo-sin-confirmar';
  else if(code === 'same_password')
    codigo = 'clave-igual';
  else if(code === 'weak_password')
    codigo = 'clave-debil';
  else if(['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'].includes(code)
          || (e && e.status === 429))
    codigo = 'demasiados-intentos';
  else if(code === 'email_address_invalid' || code === 'validation_failed')
    codigo = 'correo-invalido';
  else if(nombre === 'AuthRetryableFetchError' || /failed to fetch|networkerror|network request failed|load failed/i.test(msg))
    codigo = 'sin-conexion';
  if(codigo === 'otro'){
    try{ console.warn('Error de Auth sin traducir (' + contexto + '):', e); }catch(_){}
    return {codigo, mensaje: 'No pudimos ' + (INTENTOS_AUTH[contexto] || INTENTOS_AUTH.entrar) + '. Intenta de nuevo o escríbenos.'};
  }
  return {codigo, mensaje: MENSAJES_AUTH[codigo]};
}
