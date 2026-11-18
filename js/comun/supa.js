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
    e.status = r.status;
    e.sinRed = !r.error.code && !(r.status > 0 && r.status < 500);
    throw e;
  }
  return r.data;
}

export const MENSAJE_SIN_RED = 'Sin conexión. Revisa tu internet.';
const RE_RED = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;

/* Texto en español de un error para mostrarlo en pantalla. Si es de red (la respuesta nunca
   llegó: «Failed to fetch», «Load failed»…) da «Sin conexión»; si no, el mensaje tal cual (el de
   la base ya viene en español). Acepta Error, {message} o texto. Pura. */
export function mensajeDeError(e){
  if(e == null) return '';
  const msg = typeof e === 'string' ? e : String(e.message == null ? '' : e.message);
  if((typeof e === 'object' && e.sinRed) || RE_RED.test(msg)) return MENSAJE_SIN_RED;
  return msg;
}

function errorSinRed(causa){
  const e = new Error(MENSAJE_SIN_RED);
  e.sinRed = true;
  e.causa = causa;
  return e;
}
