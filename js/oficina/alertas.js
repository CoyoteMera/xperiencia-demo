/* Alertas: v_alertas (salidas a pocos días con saldo o requisitos que bloquean) agrupada por
   salida. Es lo primero que se ve al entrar a la oficina. Las funciones puras se prueban en Node;
   la que toca red y DOM solo corre cuando se la llama. Los saldos vienen de la vista. */
import { supa, mensajeDeError } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero } from '../comun/util.js';
import { rangoFechas } from './salidas.js';

/* Filas de v_alertas (una por inscripción) -> una entrada por salida: la más cercana primero, la
   gente por nombre, con cuántos tienen saldo y cuántos tienen requisitos que bloquean. */
export function agruparAlertas(filas){
  const por = new Map();
  for(const f of filas){
    if(!por.has(f.salida_id)){
      por.set(f.salida_id, {salida_id: f.salida_id, plan_nombre: f.plan_nombre, fecha_inicio: f.fecha_inicio,
        dias: f.dias_para_salida, items: []});
    }
    por.get(f.salida_id).items.push(f);
  }
  return [...por.values()].map(g => ({
    ...g,
    items: g.items.sort((a, b) => String(a.viajero_nombre).localeCompare(String(b.viajero_nombre), 'es')),
    conSaldo: g.items.filter(i => Number(i.saldo) > 0).length,
    conRequisitos: g.items.filter(i => Number(i.req_bloqueantes_pendientes) > 0).length
  })).sort((a, b) => (a.dias - b.dias) || String(a.salida_id).localeCompare(String(b.salida_id)));
}

function cuando(d){
  if(d === 0) return 'sale hoy';
  if(d === 1) return 'sale mañana';
  return 'en ' + d + ' días';
}

export function renderAlertas(grupos){
  if(!grupos.length)
    return '<div class="vacio"><p><b>Todo al día.</b><br>Ninguna salida cercana tiene saldo ni requisitos que bloqueen.</p></div>';
  return grupos.map(g => {
    const resumen = [g.conSaldo + ' con saldo', g.conRequisitos + ' con requisitos que bloquean'].join(' · ');
    const filas = g.items.map(i =>
      '<li><span>' + esc(i.viajero_nombre) + '</span><span>' +
      (Number(i.saldo) > 0 ? 'Falta ' + esc(fmtDinero(i.saldo, i.moneda)) : '') +
      (Number(i.saldo) > 0 && Number(i.req_bloqueantes_pendientes) > 0 ? ' · ' : '') +
      (Number(i.req_bloqueantes_pendientes) > 0
        ? '<span class="etq alerta">Bloquea: ' + esc(i.req_bloqueantes_pendientes) + '</span>' : '') +
      '</span></li>').join('');
    return '<div class="item rojo grupo-alerta">' +
      '<h3>' + esc(g.plan_nombre) + '</h3>' +
      '<div class="cuando">' + esc(rangoFechas(g.fecha_inicio, g.fecha_inicio)) + ' · ' + esc(cuando(g.dias)) + '</div>' +
      '<div class="linea">' + esc(resumen) + '</div>' +
      '<ul>' + filas + '</ul>' +
      '<button type="button" class="btn chico fantasma" ' +
      (idSeguro(g.salida_id) ? 'onclick="abrirSalida(\'' + idSeguro(g.salida_id) + '\')"' : 'disabled') + '>Ver la salida</button>' +
      '</div>';
  }).join('');
}

/* Lee v_alertas y pinta las alertas. Se llama al entrar a la oficina. */
export async function cargarAlertas(){
  const caja = document.getElementById('cajaAlertas');
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const r = await supa.from('v_alertas').select('*');
    if(r.error) throw new Error(r.error.message);
    caja.innerHTML = renderAlertas(agruparAlertas(r.data || []));
  }catch(e){
    caja.innerHTML = '<div class="error">No pudimos cargar las alertas: ' + esc(mensajeDeError(e)) + '</div>';
  }
}
