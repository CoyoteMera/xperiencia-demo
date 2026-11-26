/* Navegación de la oficina. Nada toca document al importarse.
   Cada pantalla es una <section class="pantalla" id="v-<id>"> del HTML y se registra con
   registrarVista(id, {tab, alEntrar}). `tab` es la pestaña que queda resaltada (por defecto, el
   mismo id: una vista de detalle declara la pestaña de su lista); `alEntrar(arg)` pinta la vista.
   Así 9c agrega Ficha, Abono y Cancelación registrándolas, sin tocar lo ya montado. */

/* Los mismos roles que es_staff() acepta en la base (una prueba lo compara con la migración).
   La lista vive en comun/sesion.js: la app del viajero la usa para mandar al personal a la oficina. */
import { ROLES_OFICINA } from '../comun/sesion.js';
export { ROLES_OFICINA };

const registro = new Map();

export function registrarVista(id, opciones){
  registro.set(id, opciones || {});
}

/* Pura: qué vista y qué pestaña corresponden a un id, o null si no está registrada. */
export function resolverVista(id, vistas){
  const o = vistas && vistas.get(id);
  if(!o) return null;
  return {id, tab: o.tab || id};
}

/* Muestra una vista, resalta su pestaña y la pinta. Es el handler `irOficina` de los botones. */
export async function irA(id, arg){
  const v = resolverVista(id, registro);
  if(!v) return;
  document.querySelectorAll('main > .pantalla').forEach(s => s.classList.remove('viva'));
  const seccion = document.getElementById('v-' + id);
  if(seccion) seccion.classList.add('viva');
  document.querySelectorAll('#tabsOficina [data-tab]').forEach(b => {
    const on = b.dataset.tab === v.tab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  window.scrollTo(0, 0);
  const alEntrar = registro.get(id).alEntrar;
  if(alEntrar) await alEntrar(arg);
}
