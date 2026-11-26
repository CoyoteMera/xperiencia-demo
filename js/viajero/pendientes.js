/* Aviso de inscripciones guardadas en el teléfono que esperan señal. Es la UI de la cola de
   almacen.js (que ya no toca el DOM): main.js la registra con alCambiarCola(). */
import { pendientesEnCola } from './almacen.js';

export function pintarPendientes(){
  const caja = document.getElementById('avisoPendientes');
  if(!caja) return;
  const n = pendientesEnCola();
  if(!n){ caja.style.display = 'none'; return; }
  caja.style.display = 'block';
  caja.textContent = n === 1
    ? 'Tienes 1 inscripción guardada esperando conexión. La enviamos apenas haya señal.'
    : 'Tienes ' + n + ' inscripciones guardadas esperando conexión. Las enviamos apenas haya señal.';
}
