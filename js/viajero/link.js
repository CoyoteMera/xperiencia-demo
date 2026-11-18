/* Link preparado: Xperiencia manda xperiencia.com.co/app/?plan=…&fecha=… (o ?salida=…, o
   ?invitacion=…), la persona se registra y cae directo en ese viaje. Se guarda en sessionStorage
   porque el registro son tres pantallas. (El armado de enlaces es de la oficina, Tarea 9.) */
import { E } from './estado.js';
import { DESTINOS, PLANES } from './catalogo.js';

const LLAVE_INTENCION = 'xpe_intencion';
const LLAVE_INVITACION = 'xpe_invitacion';
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_TOKEN = /^[\w-]{1,64}$/;

/* Lee la intención del link (?plan=…&fecha=…&cupos=…&salida=…&invitacion=…). Función pura:
   recibe location.search y devuelve un objeto o null si no hay nada válido. Solo trae las
   llaves `salida` e `invitacion` cuando vienen. No guarda nada: eso lo hace guardarIntencion(). */
export function parsearIntencion(search){
  let p = {};
  try{ p = Object.fromEntries(new URLSearchParams(search)); }catch(e){ return null; }
  const crudo = (p.plan || p.destino || '').trim();

  // Acepta plan_id exacto, o destino_id (toma el plan más barato de ese destino)
  let planId = null;
  if(crudo){
    if(PLANES[crudo]) planId = crudo;
    else if(DESTINOS[crudo]){
      const lista = DESTINOS[crudo].planes.slice()
        .sort((a,b) => (parseInt(a.pr||'0',10)) - (parseInt(b.pr||'0',10)));
      planId = lista.length ? lista[0].pi : null;
    }
  }
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha||'') ? p.fecha : null;
  const cupos = /^[1-5]$/.test(p.cupos||'') ? p.cupos : null;
  const salida = RE_UUID.test((p.salida||'').trim()) ? p.salida.trim() : null;
  const invitacion = RE_TOKEN.test((p.invitacion||'').trim()) ? p.invitacion.trim() : null;

  const r = {};
  if(planId || fecha){ r.plan = planId; r.fecha = fecha; r.cupos = cupos; }
  if(salida) r.salida = salida;
  if(invitacion) r.invitacion = invitacion;
  return Object.keys(r).length ? r : null;
}

/* ─── Qué hacer al abrir la sesión ───────────────────────────
   Una invitación se usa ANTES de que la cuenta tenga ficha propia. Si la cuenta crea su ficha
   primero, usar_invitacion falla («Tu cuenta ya tiene una ficha») y queda una ficha duplicada.
     usar-invitacion      sin ficha y con invitación guardada: unir la cuenta a la ficha invitada
     completar-perfil     sin ficha y sin invitación: pedir los datos
     descartar-invitacion con ficha: la invitación ya no sirve (no se gasta); avisar y seguir
     entrar               con ficha y sin invitación                                           */
export function pasoAlEntrar({tieneFicha, invitacion}){
  if(!tieneFicha) return invitacion ? 'usar-invitacion' : 'completar-perfil';
  return invitacion ? 'descartar-invitacion' : 'entrar';
}

/* La intención leída del link queda en memoria y en sessionStorage: si se perdiera en el camino
   del registro, el link no habría servido de nada. El token de invitación va aparte (no es
   «ir a inscribirse») y en localStorage, que sobrevive a abrir el correo de confirmación en
   otra pestaña. Los dos con try/catch: en modo privado el almacenamiento puede fallar. */
let INVITACION = null;

export function guardarIntencion(intencion){
  if(!intencion) return;
  const {invitacion, ...resto} = intencion;
  if(invitacion) guardarInvitacion(invitacion);
  if(!Object.keys(resto).length) return;
  E.INTENCION = resto;
  try{ sessionStorage.setItem(LLAVE_INTENCION, JSON.stringify(E.INTENCION)); }catch(e){}
}
export function recuperarIntencion(){
  if(E.INTENCION) return E.INTENCION;
  try{ E.INTENCION = JSON.parse(sessionStorage.getItem(LLAVE_INTENCION) || 'null'); }catch(e){}
  return E.INTENCION;
}
export function olvidarIntencion(){
  E.INTENCION = null;
  try{ sessionStorage.removeItem(LLAVE_INTENCION); }catch(e){}
}

export function guardarInvitacion(token){
  INVITACION = token;
  try{ localStorage.setItem(LLAVE_INVITACION, token); }catch(e){}
}
export function recuperarInvitacion(){
  if(INVITACION) return INVITACION;
  try{ INVITACION = localStorage.getItem(LLAVE_INVITACION) || null; }catch(e){}
  return INVITACION;
}
export function olvidarInvitacion(){
  INVITACION = null;
  try{ localStorage.removeItem(LLAVE_INVITACION); }catch(e){}
}
/* Qué trae el hash al abrir la app desde el correo de recuperación de contraseña. Pura.
   {tipo:'recuperar'}: enlace bueno (type=recovery). {tipo:'error', mensaje}: enlace vencido o
   inválido, ya en español. null: cualquier otro hash (o ninguno). */
export function leerHashDeRecuperacion(hash){
  let p;
  try{ p = new URLSearchParams(String(hash || '').replace(/^#/, '')); }catch(e){ return null; }
  if(p.get('type') === 'recovery' && p.get('access_token')) return {tipo: 'recuperar'};
  if(p.get('error') && /^(otp_expired|access_denied)$/.test(p.get('error_code') || p.get('error') || ''))
    return {tipo: 'error',
      mensaje: 'El enlace para cambiar tu contraseña ya venció. Pide uno nuevo en «Olvidé mi contraseña».'};
  return null;
}
export const esUuid = s => RE_UUID.test(String(s || ''));
