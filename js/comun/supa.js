/* Cliente de Supabase. Nada se ejecuta al importar: main.js llama a iniciarSupa() una vez.
   El SDK (app/vendor/supabase.js, UMD) lo carga index.html con un <script> clásico y deja
   `supabase` en window. `supa` es un binding vivo: vale null hasta que iniciarSupa() termina. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export let supa = null;

/* Conecta con Supabase. Devuelve null si salió bien, o el error (message === 'sdk-bloqueado'
   cuando el visor no dejó cargar el SDK) para que main.js lo muestre. */
export function iniciarSupa(opciones){
  // {sinSesion:true}: cliente limpio que no lee ni guarda la sesión del navegador (el voucher con
  // token no la necesita, y una vencida haría fallar la llamada).
  const con = !(opciones && opciones.sinSesion);
  // {detectarEnUrl:true}: el SDK lee el enlace de recuperación del hash (solo la app del viajero lo pide).
  const enUrl = !!(opciones && opciones.detectarEnUrl);
  // {cliente}: un cliente ya hecho (el demo en memoria); no mira window.supabase.
  if(opciones && opciones.cliente){ supa = opciones.cliente; return null; }
  try{
    if(typeof window === 'undefined' || !window.supabase || !window.supabase.createClient)
      throw new Error('sdk-bloqueado');
    supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {persistSession: con, autoRefreshToken: con, detectSessionInUrl: enUrl}
    });
    return null;
  }catch(e){
    return e;
  }
}

/* Llama a una función de la base. Si la base responde con error lanza Error(error.message), el
   texto en español que escribió la propia función, para que la pantalla lo muestre tal cual.
   e.code trae el código de Postgres (P0001 = raise exception). e.sinRed es true cuando la
   respuesta nunca llegó (sin señal, servidor caído): esos envíos se reintentan; los demás no. */
export async function rpc(nombre, args){
  if(!supa) throw errorSinRed(new Error('Sin conexión'));
  let r;
  try{
    r = await supa.rpc(nombre, args || {});
  }catch(e){
    throw errorSinRed(e);
  }
  if(r.error){
    const e = new Error(r.error.message);
    e.code = r.error.code || '';
    e.delServidor = true;
    e.status = r.status;
    e.sinRed = !r.error.code && !(r.status > 0 && r.status < 500);
    throw e;
  }
  return r.data;
}

export const MENSAJE_SIN_RED = 'Sin conexión. Revisa tu internet.';
const RE_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

/* De {message, code} de PostgREST (el error de una consulta o de storage) a un Error con .code.
   .delServidor marca que el texto lo escribió el servidor, no la app (ver esErrorReconocido). */
export function errorDeBase(error){
  const e = new Error(error && error.message != null ? String(error.message) : '');
  e.code = (error && error.code) || '';
  e.delServidor = true;
  return e;
}

const nombreDe = e => (e && typeof e === 'object' && e.name) ? String(e.name) : '';
const textoDe = e => typeof e === 'string' ? e : String(e && e.message != null ? e.message : '');

/* ¿Es un error que se puede mostrar tal cual? Sí: sin red, texto de nuestras funciones de la base
   (P0001), error de Auth ya traducido (.traducido), o un texto/Error simple que lanzó la propia app
   (sin código). No: cualquier otro código (23505, 42501, PGRST…), un error del servidor sin código
   (.delServidor: un 401 de la pasarela, un cuerpo que no es JSON) o un error de otro tipo (TypeError,
   errores del SDK). Pura. */
export function esErrorReconocido(e){
  if(e == null) return false;
  if(typeof e === 'string') return true;
  if(e.sinRed || RE_RED.test(textoDe(e))) return true;
  if(e.code === 'P0001' || e.traducido === true) return true;
  if(e.code || e.delServidor) return false;
  const n = nombreDe(e);
  return n === '' || n === 'Error';
}

/* Texto en español de un error para mostrarlo en pantalla. Reconocido: el mensaje tal cual (o
   «Sin conexión» si es de red). No reconocido: «No pudimos <intento>. Intenta de nuevo o escríbenos.»
   y el detalle va a la consola. Acepta Error, {message} o texto. Pura salvo el console.warn. */
export function mensajeDeError(e, intento){
  if(e == null) return '';
  if(esErrorReconocido(e)){
    if((typeof e === 'object' && e.sinRed) || RE_RED.test(textoDe(e))) return MENSAJE_SIN_RED;
    return textoDe(e);
  }
  return genericoDe(e, intento);
}

/* «No pudimos <intento>: <motivo>» si el motivo se puede mostrar; si no, el texto genérico. */
export function falloDe(e, intento){
  if(e != null && esErrorReconocido(e)) return 'No pudimos ' + intento + ': ' + mensajeDeError(e);
  return genericoDe(e, intento);
}

function genericoDe(e, intento){
  try{ console.warn('Error sin traducir (' + (intento || 'operación') + '):', e); }catch(_){}
  return 'No pudimos ' + (intento || 'completar la operación') + '. Intenta de nuevo o escríbenos.';
}

function errorSinRed(causa){
  const e = new Error(MENSAJE_SIN_RED);
  e.sinRed = true;
  e.causa = causa;
  return e;
}
