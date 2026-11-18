/* Sesión y rol para las pantallas de oficina y panel. Nada se ejecuta al importar.
   La barrera real es la base (RLS y las funciones revisan el rol); esto solo evita mostrar una
   pantalla de oficina a quien no le toca. */
import { supa } from './supa.js';

const ENTRADA = 'index.html';

/* Exige sesión y que perfil.rol esté en `roles`. Si cumple devuelve {user, rol}; si no (sin
   sesión, sin perfil, rol distinto, o cualquier fallo al comprobarlo) redirige a index.html y
   devuelve null: ante la duda no deja pasar. `opciones` es para pruebas: `cliente` reemplaza al
   cliente de Supabase y `redirigir(url)` a la navegación. */
export async function exigirRol(roles, opciones){
  const o = opciones || {};
  const cliente = 'cliente' in o ? o.cliente : supa;
  const redirigir = o.redirigir || (url => { location.replace(url); });
  try{
    if(!cliente || !Array.isArray(roles) || !roles.length) throw new Error('sin-acceso');
    const {data} = await cliente.auth.getSession();
    const user = data && data.session && data.session.user;
    if(!user) throw new Error('sin-sesion');
    const r = await cliente.from('perfil').select('rol').eq('user_id', user.id).maybeSingle();
    if(r.error || !r.data || !roles.includes(r.data.rol)) throw new Error('sin-rol');
    return {user, rol: r.data.rol};
  }catch(e){
    redirigir(ENTRADA);
    return null;
  }
}

/* Los mismos roles que es_staff() acepta en la base (una prueba lo compara con la migración).
   Viven aquí para que la app del viajero y la oficina usen una sola lista. */
export const ROLES_OFICINA = ['oficina', 'dueno'];

const OFICINA = 'oficina.html';

/* A dónde debe ir quien tiene este rol al entrar: la oficina para el personal, null (se queda en
   la app del viajero) para cualquier otro. */
export function rutaPorRol(rol){
  return ROLES_OFICINA.includes(rol) ? OFICINA : null;
}

/* El rol de la sesión abierta, o null (sin sesión, sin perfil o cualquier fallo: ante la duda es
   un viajero). `cliente` es para pruebas; por defecto, el de Supabase. */
export async function rolActual(cliente){
  const c = cliente === undefined ? supa : cliente;
  try{
    if(!c) return null;
    const {data} = await c.auth.getSession();
    const user = data && data.session && data.session.user;
    if(!user) return null;
    const r = await c.from('perfil').select('rol').eq('user_id', user.id).maybeSingle();
    return r.error || !r.data ? null : r.data.rol;
  }catch(e){
    return null;
  }
}

/* Solo el dueño ve el panel: «panel.html» para su rol, null para cualquier otro (el enlace
   «Ir al Panel Global» de la oficina se muestra solo si esto no es null). La barrera real es la
   interfaz: panel.html exige el rol con exigirRol(['dueno']). */
export function rutaPanel(rol){
  return rol === 'dueno' ? 'panel.html' : null;
}
