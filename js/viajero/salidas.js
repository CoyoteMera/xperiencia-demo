/* Próximas salidas: el calendario que ve el viajero. Las salidas las carga la oficina
   (Tarea 9); aquí solo se leen, de v_salidas_publicas. */
import { E } from './estado.js';
import { waXperiencia } from './catalogo.js';
import { esc, mesLargo, faltanDias, hoyBogota } from '../comun/util.js';

/* Salidas que alguien se puede apuntar: no cerradas y no pasadas. Las ordena por fecha. */
export function salidasAbiertas(salidas, hoy = hoyBogota()){
  return (salidas || [])
    .filter(x => x.estado !== 'cerrada' && x.fecha >= hoy)
    .sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0);
}

/* Qué salida queda escogida y cuáles se muestran según lo que trajo el enlace (función pura).
     ?salida=<uuid>          esa salida, si sigue abierta
     ?plan=<id>              la única salida abierta de ese plan; si hay varias, solo las de ese plan
     ?plan=<id>&fecha=<día>  la salida de ese plan que empieza ese día, si es una sola
   Devuelve {preseleccionada: id|null, lista, filtradaPorPlan: planId|null}. */
export function salidasParaIntencion(salidas, intencion, hoy = hoyBogota()){
  const abiertas = salidasAbiertas(salidas, hoy);
  const r = {preseleccionada: null, lista: abiertas, filtradaPorPlan: null};
  if(!intencion) return r;

  if(intencion.salida){
    const s = abiertas.find(x => x.id === intencion.salida);
    if(s){ r.preseleccionada = s.id; return r; }
  }
  if(intencion.plan){
    const delPlan = abiertas.filter(x => x.plan_id === intencion.plan);
    if(intencion.fecha){
      const ese = delPlan.filter(x => x.fecha === intencion.fecha);
      if(ese.length === 1){ r.preseleccionada = ese[0].id; return r; }
    }
    if(delPlan.length === 1){ r.preseleccionada = delPlan[0].id; return r; }
    if(delPlan.length > 1){ r.lista = delPlan; r.filtradaPorPlan = intencion.plan; }
  }
  return r;
}

/* Qué dice la salida a la que ya me inscribí, según el estado de mi inscripción: el cupo solo
   está confirmado cuando la oficina valida el abono. */
export function textoMiCupo(estado){
  return estado === 'pendiente' ? 'Inscrito · falta tu abono para confirmar el cupo' : '✓ Tu cupo está confirmado';
}

export function pintarSalidas(){
  const caja = document.getElementById('listaSalidas');
  const hoy = hoyBogota();
  const lista = salidasAbiertas(E.BD.salidas, hoy);

  if(!lista.length){
    caja.innerHTML = '<div class="vacio"><p>Todavía no hay fechas publicadas.<br>' +
      'Escríbenos y te contamos qué viene.</p></div>';
    return;
  }

  // las salidas a las que ya me inscribí (con el estado de mi inscripción), para marcarlas
  const mios = new Map((E.BD.misViajes || []).map(x => [x.salida_id, x.estado]));

  caja.innerHTML = lista.map(x => {
    const total = Math.max(0, parseInt(x.cupos_total,10)   || 0);
    const ocup  = Math.max(0, parseInt(x.cupos_ocupados,10) || 0);
    const libres = Math.max(0, total - ocup);
    const pct = total ? Math.min(100, Math.round(ocup / total * 100)) : 0;
    const yoVoy = mios.has(x.id);
    const lleno = total > 0 && libres === 0;
    const cuenta = faltanDias(x.fecha, hoy);

    let estado;
    if(lleno)                          estado = 'Sin cupos — pregunta por lista de espera';
    else if(x.estado === 'confirmada') estado = 'Salida confirmada · ' + libres +
                                       (libres===1 ? ' cupo libre' : ' cupos libres');
    else                               estado = libres === 1 ? 'Queda 1 cupo' : 'Quedan ' + libres + ' cupos';

    return '<div class="grupo' + (yoVoy?' mio':'') + '">' +
      (yoVoy ? '<div class="sello">Vas en esta salida</div>' : '') +
      '<h3>' + esc(x.plan) + '</h3>' +
      '<div class="cuando">' + mesLargo(x.fecha) +
        (cuenta ? ' <em>· ' + cuenta + '</em>' : '') + '</div>' +
      (total ? '<div class="barra"><i style="width:'+pct+'%"></i><span style="width:'+pct+'%"></span></div>' +
               '<div class="conteo"><b>' + ocup + ' de ' + total + '</b> cupos tomados</div>' : '') +
      '<div class="faltan' + (lleno || x.estado==='confirmada' ? ' completo' : '') + '">' + estado + '</div>' +
      (x.nota ? '<p class="pista" style="margin-top:10px">' + esc(x.nota) + '</p>' : '') +
      (yoVoy
        ? '<div class="ya-reservo' + (mios.get(x.id) === 'pendiente' ? ' pendiente' : '') + '">' +
          textoMiCupo(mios.get(x.id)) + '</div>'
        : (lleno ? '' : '<button class="btn reservar" onclick="quieroEstaSalida(&quot;' + esc(x.id) +
            '&quot;)">Inscribirme a esta salida</button>') +
          '<a class="btn secundario reservar" href="' + waSalida(x) + '" target="_blank" rel="noopener">' +
          (lleno ? 'Preguntar por lista de espera' : 'Preguntar por esta salida') + '</a>') +
      '</div>';
  }).join('');
}

function waSalida(x){
  return waXperiencia('Hola, me interesa la salida de ' + x.plan + ' el ' +
    mesLargo(x.fecha) + '. ¿Todavía hay cupo? Vengo de la app Mi Xperiencia.');
}
