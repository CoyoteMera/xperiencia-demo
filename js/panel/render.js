/* Panel Global: render puro (cadenas de HTML a partir de filas). No toca document, window ni
   Supabase al importarse ni al llamarlo, así que se prueba en Node. NO se calcula dinero aquí:
   v_panel_totales, v_panel_mes, v_panel_cuentas, v_salida_resumen y v_inscripcion_saldo ya traen
   los montos; esto solo los formatea. COP y USD nunca se mezclan en un mismo bloque. */
import { esc, idSeguro, fmtDinero, mesLargo } from '../comun/util.js';
import { rangoFechas } from '../oficina/salidas.js';

const MONEDAS = ['COP', 'USD'];
const NOMBRE_MONEDA = {COP: 'Pesos', USD: 'Dólares'};

/* Avance de la barra de recaudo: recaudado sobre (recaudado + por cobrar), entero de 0 a 100. */
export function avanceRecaudo(recaudado, porCobrar){
  const rec = Number(recaudado) || 0;
  const total = rec + Math.max(Number(porCobrar) || 0, 0);
  if(total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(100 * rec / total)));
}

const porMoneda = filas => MONEDAS.map(m => [m, (filas || []).filter(f => f.moneda === m)]).filter(p => p[1].length);

/* ───────────── Salidas ───────────── */

/* Tarjetas de arriba: una por moneda con lo recaudado, lo que falta por cobrar y los listos. */
export function tarjetasTotales(filas){
  const grupos = porMoneda(filas);
  if(!grupos.length) return '<div class="vacio"><p>No hay salidas próximas.</p></div>';
  return '<div class="totales">' + grupos.map(([m, [f]]) =>
    '<div class="tot ' + m.toLowerCase() + '"><div class="mon">' + esc(NOMBRE_MONEDA[m]) + '</div>' +
    '<dl><div><dt>Recaudado</dt><dd>' + esc(fmtDinero(f.recaudado, m)) + '</dd></div>' +
    '<div><dt>Por cobrar</dt><dd>' + esc(fmtDinero(f.por_cobrar, m)) + '</dd></div>' +
    '<div><dt>Listos para ir</dt><dd><b>' + esc(f.listos) + '</b> de ' + esc(f.inscritos) + '</dd></div></dl></div>'
  ).join('') + '</div>';
}

const SEMAFORO = {verde: 'Todo listo', amarillo: 'En proceso', rojo: 'Urge'};

function cuandoFalta(dias){
  if(dias == null) return '';
  if(dias < 0) return 'ya salió';
  if(dias === 0) return 'sale hoy';
  if(dias === 1) return 'sale mañana';
  return 'en ' + dias + ' días';
}

/* Salidas próximas (filas de v_salida_resumen, ya filtradas y en orden). Cada tarjeta trae su caja
   `tabla-<id>`, donde alternarSalida pinta la tabla de viajeros. */
export function renderSalidasProximas(filas){
  if(!filas || !filas.length) return '<div class="vacio"><p>No hay salidas próximas.</p></div>';
  return filas.map(r => {
    const id = idSeguro(r.salida_id);
    const sem = SEMAFORO[r.semaforo] ? r.semaforo : 'gris';
    return '<div class="item ' + esc(sem === 'rojo' ? 'rojo' : sem === 'verde' ? 'verde' : '') + '">' +
      '<h3>' + esc(r.plan_nombre) + ' <span class="pil ' + sem + '">' + esc(SEMAFORO[r.semaforo] || '—') + '</span></h3>' +
      '<div class="cuando">' + esc(rangoFechas(r.fecha_inicio, r.fecha_fin)) +
      (r.dias_para_salida != null ? ' · ' + esc(cuandoFalta(r.dias_para_salida)) : '') + '</div>' +
      '<div class="barra-recaudo" aria-hidden="true" style="--avance:' + avanceRecaudo(r.recaudado, r.por_cobrar) + '%"><span></span></div>' +
      '<dl class="cifras"><div><dt>Listos</dt><dd><b>' + esc(r.listos) + '</b> de ' + esc(r.inscritos) + '</dd></div>' +
      '<div><dt>Recaudado</dt><dd>' + esc(fmtDinero(r.recaudado, r.moneda)) + '</dd></div>' +
      '<div><dt>Por cobrar</dt><dd>' + esc(fmtDinero(r.por_cobrar, r.moneda)) + '</dd></div></dl>' +
      (id ? '<button type="button" class="enl ver" aria-expanded="false" aria-controls="tabla-' + id + '" onclick="alternarSalida(\'' + id + '\')">Ver viajeros' +
              '<svg class="chev" aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button>' +
            '<div class="tabla-salida" id="tabla-' + id + '" hidden></div>' : '') +
      '</div>';
  }).join('');
}

const ESTADOS = {
  lista: ['Lista', 'verde'], confirmada: ['Confirmada', 'azul'], pendiente: ['Pendiente', 'gris'],
  cancelada: ['Cancelada', 'gris'], viajo: ['Viajó', 'gris']
};

/* Tabla «Cada salida, en vivo»: viajero, pagado, falta, requisitos y estado. `filas` son las de
   v_inscripcion_saldo con `nombre` y `acompanante` (las arma filasInscritos de la oficina). */
export function renderTablaSalida(filas){
  if(!filas || !filas.length) return '<p class="tenue">Esta salida todavía no tiene inscritos.</p>';
  const cuerpo = filas.map(f => {
    const cancel = f.estado_mostrado === 'cancelada';
    const clases = [f.acompanante ? 'acomp' : '', cancel ? 'cancelada' : ''].filter(Boolean).join(' ');
    const est = ESTADOS[f.estado_mostrado] || [f.estado_mostrado || '—', 'gris'];
    const req = f.req_total > 0
      ? (f.req_total - f.req_pendientes) + ' de ' + f.req_total +
        (f.req_bloqueantes_pendientes > 0 ? ' <span class="etq alerta">Bloquea: ' + esc(f.req_bloqueantes_pendientes) + '</span>' : '')
      : '—';
    return '<tr' + (clases ? ' class="' + clases + '"' : '') + '>' +
      '<td class="viajero">' + esc(f.nombre) + '</td>' +
      '<td class="num" data-label="Pagado">' + esc(fmtDinero(f.pagado, f.moneda)) +
        (Number(f.por_validar) > 0 ? '<br><span class="etq espera">' + esc(fmtDinero(f.por_validar, f.moneda)) + ' por validar</span>' : '') + '</td>' +
      '<td class="num" data-label="Falta">' + (cancel ? '—' : esc(fmtDinero(f.saldo, f.moneda))) + '</td>' +
      '<td data-label="Requisitos">' + (cancel ? '—' : req) + '</td>' +
      '<td class="estado"><span class="pil ' + est[1] + '">' + esc(est[0]) + '</span></td></tr>';
  }).join('');
  return '<div class="scroll"><table><caption>Los acompañantes van debajo de su titular</caption>' +
    '<thead><tr><th scope="col">Viajero</th><th scope="col" class="num">Pagado</th>' +
    '<th scope="col" class="num">Falta</th><th scope="col">Requisitos</th><th scope="col">Estado</th></tr></thead>' +
    '<tbody>' + cuerpo + '</tbody></table></div>';
}

/* ───────────── Mes ───────────── */

/* Meses para el selector: los que tienen datos más el mes de `hoy`, el más reciente primero.
   Cada mes es el primer día (AAAA-MM-01), como lo entregan las vistas. */
export function opcionesMes(meses, hoy){
  const set = new Set((meses || []).filter(Boolean).map(m => String(m).slice(0, 7) + '-01'));
  set.add(String(hoy).slice(0, 7) + '-01');
  return [...set].sort().reverse().map(valor => ({valor, etiqueta: mesLargo(valor.slice(0, 7))}));
}

export function renderSelectorMes(opciones, elegido){
  return '<label for="selMes">Mes</label><select id="selMes" onchange="cambiarMes(this.value)">' +
    opciones.map(o => '<option value="' + esc(o.valor) + '"' + (o.valor === elegido ? ' selected' : '') + '>' +
      esc(o.etiqueta) + '</option>').join('') + '</select>';
}

/* Un bloque por moneda: recaudado, pendiente y devoluciones del mes, y lo recibido por cuenta. */
export function renderMes(filasMes, filasCuentas, mes){
  const delMes = (filasMes || []).filter(f => f.mes === mes);
  const cuentas = (filasCuentas || []).filter(f => f.mes === mes);
  const grupos = porMoneda(delMes);
  if(!grupos.length) return '<div class="vacio"><p>Sin movimientos en este mes.</p></div>';
  return grupos.map(([m, [f]]) => {
    const cu = cuentas.filter(c => c.moneda === m);
    return '<section class="mes-mon ' + m.toLowerCase() + '"><h2>' + esc(NOMBRE_MONEDA[m]) + '</h2>' +
      '<dl class="cifras-mes">' +
      '<div><dt>Recaudado</dt><dd>' + esc(fmtDinero(f.recaudado, m)) + '</dd></div>' +
      '<div><dt>Pendiente</dt><dd>' + esc(fmtDinero(f.pendiente, m)) + '</dd></div>' +
      '<div><dt>Devoluciones</dt><dd>' + esc(fmtDinero(f.devoluciones, m)) + '</dd></div></dl>' +
      '<div class="sub-titulo">Recibido por cuenta</div>' +
      (cu.length
        ? '<div class="scroll"><table class="cuentas"><thead><tr><th scope="col">Cuenta</th>' +
          '<th scope="col" class="num">Recibido</th></tr></thead><tbody>' +
          cu.map(c => '<tr><td>' + esc(c.cuenta_nombre) + '</td><td class="num">' + esc(fmtDinero(c.recibido, m)) +
            '</td></tr>').join('') + '</tbody></table></div>'
        : '<p class="tenue">Nada recibido este mes.</p>') +
      '</section>';
  }).join('');
}
