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

/* La intención leída del link queda en memoria y en localStorage (con la hora en que se guardó,
   `t`): abrir el correo de confirmación en otra pestaña no debe perder el viaje. Vale 7 días; se
   «gasta» al mostrarse con sesión (solo el almacenamiento: durante la visita sigue en memoria).
   El token de invitación va aparte. Todo con try/catch: en modo privado el almacenamiento falla. */
const LLAVE_INTENCION_VIEJA = 'xpe_intencion';   // antes vivía en sessionStorage con esta misma llave
const VIGENCIA_INTENCION = 7 * 86400000;
let INVITACION = null;

export function guardarIntencion(intencion, ahora = Date.now()){
  if(!intencion) return;
  const {invitacion, ...resto} = intencion;
  if(invitacion) guardarInvitacion(invitacion);
  if(!Object.keys(resto).length) return;
  E.INTENCION = resto;
  try{ localStorage.setItem(LLAVE_INTENCION, JSON.stringify({...resto, t: ahora})); }catch(e){}
}
/* Al abrir la app: guarda lo que trae el enlace y devuelve la dirección sin sus llaves (para
   history.replaceState), o null si no había nada que quitar. Si las llaves se quedaran en la barra,
   cada recarga volvería a guardar la intención (con `t` nuevo) aunque ya se hubiera gastado. */
const LLAVES_ENLACE = ['plan', 'destino', 'fecha', 'cupos', 'salida', 'invitacion'];
export function tomarIntencionDeUrl(href, ahora = Date.now()){
  let u;
  try{ u = new URL(href); }catch(e){ return null; }
  guardarIntencion(parsearIntencion(u.search), ahora);
  const habia = LLAVES_ENLACE.filter(k => u.searchParams.has(k));
  if(!habia.length) return null;
  habia.forEach(k => u.searchParams.delete(k));
  return u.pathname + u.search + u.hash;
}
export function recuperarIntencion(ahora = Date.now()){
  if(E.INTENCION) return E.INTENCION;
  try{
    const g = JSON.parse(localStorage.getItem(LLAVE_INTENCION) || 'null');
    if(g && typeof g === 'object' && typeof g.t === 'number' && ahora - g.t <= VIGENCIA_INTENCION){
      const {t, ...resto} = g;
      if(Object.keys(resto).length) E.INTENCION = resto;
    }else if(g){
      localStorage.removeItem(LLAVE_INTENCION);   // caducada o sin fecha: no vale
    }
  }catch(e){}
  return E.INTENCION;
}
/* Ya se mostró con sesión: al recargar no vuelve a mandar a Inscripción. */
export function gastarIntencion(){
  try{ localStorage.removeItem(LLAVE_INTENCION); }catch(e){}
}
export function olvidarIntencion(){
  E.INTENCION = null;
  try{ localStorage.removeItem(LLAVE_INTENCION); }catch(e){}
  try{ sessionStorage.removeItem(LLAVE_INTENCION_VIEJA); }catch(e){}
}

/* Lo que se le dice a quien llega por un enlace, en Entrada. null si no trae nada. */
export function anuncioDeIntencion(intencion){
  if(!intencion) return null;
  if(intencion.salida) return 'Xperiencia te preparó un viaje. Crea tu cuenta o entra y lo verás listo para confirmar.';
  if(intencion.plan || intencion.fecha){
    const p = intencion.plan && PLANES[intencion.plan];
    return 'Vienes por ' + (p ? p.p : 'un viaje de Xperiencia') + '. Crea tu cuenta o entra y sigues con tu inscripción.';
  }
  return null;
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
/* ─── Última pantalla ────────────────────────────────────────
   Al recargar la página la sesión sigue abierta; con esto vuelve a donde estaba (y, si era el
   registro de cuatro pasos, sigue en él). Va por cuenta: otra persona en el mismo navegador no hereda
   la pantalla. Las que dependen de un envío en curso (comprobante) no se recuerdan. */
const LLAVE_PANTALLA = 'xpe_pantalla';
export const PANTALLAS_RECORDABLES = ['pEscalera', 'pValidar', 'pDatos', 'pInscribir', 'pMiViaje', 'pSalidas', 'pTours'];

export function guardarPantalla(uid, id, onboarding){
  if(!uid || !PANTALLAS_RECORDABLES.includes(id)) return;
  try{ localStorage.setItem(LLAVE_PANTALLA, JSON.stringify({uid, id, onb: !!onboarding})); }catch(e){}
}
export function recuperarPantalla(uid){
  let p = null;
  try{ p = JSON.parse(localStorage.getItem(LLAVE_PANTALLA) || 'null'); }catch(e){}
  return p && uid && p.uid === uid && PANTALLAS_RECORDABLES.includes(p.id) ? {id: p.id, onb: !!p.onb} : null;
}
export function olvidarPantalla(){
  try{ localStorage.removeItem(LLAVE_PANTALLA); }catch(e){}
}

/* El lector del enlace de recuperación vive en comun/ (lo usa también acceso.html). */
export { leerHashDeRecuperacion } from '../comun/recuperacion.js';
export const esUuid = s => RE_UUID.test(String(s || ''));
