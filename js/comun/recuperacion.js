/* Enlace del correo de «Olvidé mi contraseña»: lo leen la app del viajero y acceso.html. Puro. */

const VENCIDO_VIAJERO = 'Ese enlace ya se usó o venció. Si estabas confirmando tu cuenta, entra con tu correo y tu contraseña. ' +
  'Si querías cambiar la contraseña, pide otro enlace en «Olvidé mi contraseña».';

/* Qué trae el hash al abrir la app desde el correo de recuperación de contraseña. Pura.
   {tipo:'recuperar'}: enlace bueno (type=recovery). {tipo:'error', mensaje}: enlace vencido o
   inválido, con `mensajeVencido` (por defecto, el texto de la app del viajero). null: cualquier otro hash (o ninguno). */
export function leerHashDeRecuperacion(hash, mensajeVencido = VENCIDO_VIAJERO){
  let p;
  try{ p = new URLSearchParams(String(hash || '').replace(/^#/, '')); }catch(e){ return null; }
  if(p.get('type') === 'recovery' && p.get('access_token')) return {tipo: 'recuperar'};
  if(p.get('error') && /^(otp_expired|access_denied)$/.test(p.get('error_code') || p.get('error') || ''))
    return {tipo: 'error', mensaje: mensajeVencido};
  return null;
}
