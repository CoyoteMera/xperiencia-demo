/* Salidas: lista con semáforo y cupos, la gente de cada salida (con «Copiar» y «Exportar a
   Excel»), formulario para crear y editar, y el armador de enlaces. Funciones puras arriba (se
   prueban en Node) y, al final, las que tocan DOM y red. NO se calcula dinero aquí: los montos
   vienen de v_salida_resumen / v_inscripcion_saldo / export_inscritos y se muestran tal cual. */
import { supa, rpc, errorDeBase, falloDe } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero, avisar, hoyBogota, etiquetaPausa, semaforoInscripcion } from '../comun/util.js';
import { copiarTexto, descargarTexto } from '../comun/portapapeles.js';
import { unaSolaVez, generacion } from '../comun/guardia.js';
import { aTSV, aCSV, aplanarRequisitos, armarCSVTodo, nombreArchivoTodo, avisoExportarTodo } from './exportar.js';
import { irA } from './nav.js';

/* ───────────── lógica pura ───────────── */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre'];

/* «20 al 23 de noviembre de 2026», «29 de noviembre al 2 de diciembre de 2026», etc. */
export function rangoFechas(ini, fin){
  const a = String(ini || '').split('-').map(Number);
  const b = String(fin || ini || '').split('-').map(Number);
  if(a.length < 3 || isNaN(a[0])) return '';
  const largo = p => p[2] + ' de ' + MESES[p[1] - 1] + ' de ' + p[0];
  if(a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) return largo(a);
  if(a[0] === b[0] && a[1] === b[1]) return a[2] + ' al ' + largo(b);
  if(a[0] === b[0]) return a[2] + ' de ' + MESES[a[1] - 1] + ' al ' + largo(b);
  return largo(a) + ' al ' + largo(b);
}

/* Vigente = todavía no terminó: empieza hoy o después, o ya empezó y su último día (fecha_fin; sin
   fecha_fin, el de inicio) es hoy o después. */
export function esVigente(s, hoy){
  return (s.fecha_fin || s.fecha_inicio) >= hoy;
}

/* Vigentes primero (la que empezó antes o la más cercana arriba), luego las ya terminadas con la
   más reciente primero. */
export function ordenarSalidas(filas, hoy){
  const cmp = (x, y) => (x.fecha_inicio < y.fecha_inicio ? -1 : x.fecha_inicio > y.fecha_inicio ? 1 : 0);
  const proximas = filas.filter(s => esVigente(s, hoy)).sort(cmp);
  const pasadas = filas.filter(s => !esVigente(s, hoy)).sort((x, y) => cmp(y, x));
  return proximas.concat(pasadas);
}

/* Salidas para las que tiene sentido armar un enlace de inscripción: las vigentes, en orden. */
export function salidasParaEnlace(filas, hoy){
  return ordenarSalidas(filas.filter(s => esVigente(s, hoy)), hoy);
}

const SEMAFORO = {verde: 'Todo listo', amarillo: 'En proceso', rojo: 'Urge'};

/* Recibe la fila: una salida sin inscritos no tiene nada que estar «listo». */
function pilSemaforo(r){
  if(Number(r.inscritos) === 0) return '<span class="pil gris">Sin inscritos</span>';
  const s = r.semaforo;
  const c = SEMAFORO[s] ? s : 'gris';
  return '<span class="pil ' + c + '">' + esc(SEMAFORO[s] || '—') + '</span>';
}

function cuandoFalta(dias){
  if(dias == null) return '';
  if(dias < 0) return 'ya salió';
  if(dias === 0) return 'sale hoy';
  if(dias === 1) return 'sale mañana';
  return 'en ' + dias + ' días';
}

function barraCupos(r){
  const total = Number(r.cupos_total), ocup = Number(r.cupos_ocupados);
  const llena = total > 0 ? ocup >= total : true;
  const pct = total > 0 ? Math.min(100, Math.round(ocup / total * 100)) : 0;
  return '<div class="cupos' + (llena ? ' lleno' : '') + '"><div class="barra" aria-hidden="true"><span style="width:' + pct +
    '%"></span></div><b>' + esc(ocup) + '/' + esc(total) + '</b>' +
    (Number(r.cupos_pendientes) > 0 ? '<span class="tenue-s">' + esc(r.cupos_pendientes) + ' sin confirmar</span>' : '') +
    (llena ? '<span class="tenue-s">Llena</span>' : '') + '</div>';
}

/* Cifras en lista de definiciones: [[rótulo, valor], …]. */
function cifras(pares){
  return '<dl class="cifras">' + pares.map(([t, v]) => '<div><dt>' + esc(t) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
}

/* Lista de salidas (tarjetas). Cada una abre su detalle con abrirSalida(id). */
export function renderSalidas(filas, hoy){
  if(!filas.length) return '<div class="vacio"><p>No hay salidas todavía.</p></div>';
  return ordenarSalidas(filas, hoy).map(r => {
    const seguro = idSeguro(r.salida_id);
    const color = Number(r.inscritos) !== 0 && ['rojo', 'verde', 'amarillo'].includes(r.semaforo) ? r.semaforo : '';
    return '<div class="item' + (seguro ? ' clic' : '') + ' ' + esc(color) +
      '"' + (seguro ? ' onclick="abrirSalida(\'' + seguro + '\')"' : '') + '>' +
      '<h3>' + esc(r.plan_nombre) + ' ' + pilSemaforo(r) + '</h3>' +
      '<div class="cuando">' + esc(rangoFechas(r.fecha_inicio, r.fecha_fin)) +
      (r.dias_para_salida != null ? ' · ' + esc(cuandoFalta(r.dias_para_salida)) : '') + '</div>' +
      barraCupos(r) +
      cifras([['Inscritos', r.inscritos], ['Listos', r.listos], ['Con saldo', r.con_saldo],
        ['Con requisitos', r.con_requisitos], ['Recaudado', fmtDinero(r.recaudado, r.moneda)],
        ['Por cobrar', fmtDinero(r.por_cobrar, r.moneda)]]) +
      '<button type="button" class="enl">Ver inscritos</button></div>';
  }).join('');
}

/* Inscripciones de una salida (v_inscripcion_saldo) + nombres -> filas en orden de lectura:
   titulares por nombre y, debajo de cada uno, sus acompañantes por nombre. Un acompañante cuyo
   titular no viene en la lista se trata como titular, para no perderlo. */
export function filasInscritos(saldos, nombres, pausas){
  const n = id => (nombres && nombres[id]) || '';
  const p = id => (pausas && pausas[id]) || null;
  const cmp = (a, b) => n(a.viajero_id).localeCompare(n(b.viajero_id), 'es');
  const ids = new Set(saldos.map(s => s.inscripcion_id));
  const titulares = saldos.filter(s => !s.titular_id || !ids.has(s.titular_id)).sort(cmp);
  const hijos = {};
  for(const s of saldos) if(s.titular_id && ids.has(s.titular_id)) (hijos[s.titular_id] = hijos[s.titular_id] || []).push(s);
  const salida = [];
  for(const t of titulares){
    salida.push({...t, nombre: n(t.viajero_id), acompanante: false, pausa: p(t.inscripcion_id)});
    for(const h of (hijos[t.inscripcion_id] || []).sort(cmp)) salida.push({...h, nombre: n(h.viajero_id), acompanante: true, pausa: p(h.inscripcion_id)});
  }
  return salida;
}

export function renderTablaInscritos(filas){
  if(!filas.length) return '<p class="tenue">Esta salida todavía no tiene inscritos.</p>';
  const cuerpo = filas.map(f => {
    const cancel = f.estado_mostrado === 'cancelada';
    const clases = [f.acompanante ? 'acomp' : '', cancel ? 'cancelada' : ''].filter(Boolean).join(' ');
    const est = semaforoInscripcion(f.estado_mostrado, f.req_pendientes);
    const req = f.req_total > 0
      ? (f.req_total - f.req_pendientes) + ' de ' + f.req_total +
        (f.req_bloqueantes_pendientes > 0 ? ' <span class="etq alerta">Bloquea: ' + esc(f.req_bloqueantes_pendientes) + '</span>' : '')
      : '—';
    return '<tr' + (clases ? ' class="' + clases + '"' : '') + '>' +
      '<td class="viajero">' + (idSeguro(f.viajero_id)
        ? '<button type="button" class="enl" onclick="abrirFicha(\'' + idSeguro(f.viajero_id) + '\')">' + esc(f.nombre) + '</button>'
        : esc(f.nombre)) + '</td>' +
      '<td class="num" data-label="Pagado">' + esc(fmtDinero(f.pagado, f.moneda)) +
        (Number(f.por_validar) > 0 ? '<br><span class="etq espera">' + esc(fmtDinero(f.por_validar, f.moneda)) + ' por validar</span>' : '') + '</td>' +
      '<td class="num" data-label="Falta">' + (cancel ? '—' : esc(fmtDinero(f.saldo, f.moneda))) + '</td>' +
      '<td data-label="Requisitos">' + (cancel ? '—' : req) + '</td>' +
      '<td class="estado"><span class="pil ' + est[1] + '">' + esc(est[0]) + '</span>' +
        (f.pausa && !cancel ? ' ' + etiquetaPausa(f.pausa) : '') + '</td></tr>';
  }).join('');
  return '<div class="scroll"><table><caption>Viajeros de la salida (los acompañantes van debajo de su titular)</caption>' +
    '<thead><tr><th scope="col">Viajero</th><th scope="col" class="num">Pagado</th>' +
    '<th scope="col" class="num">Falta</th><th scope="col">Requisitos</th><th scope="col">Estado</th></tr></thead>' +
    '<tbody>' + cuerpo + '</tbody></table></div>';
}

/* Encabezado de la salida, botones y tabla. */
export function renderDetalleSalida(r, filas){
  const seguro = idSeguro(r.salida_id);
  return '<div class="cejilla">Salida</div><h1>' + esc(r.plan_nombre) + '</h1>' +
    '<p class="tenue sub">' + esc(rangoFechas(r.fecha_inicio, r.fecha_fin)) +
    (r.dias_para_salida != null ? ' · ' + esc(cuandoFalta(r.dias_para_salida)) : '') + ' ' + pilSemaforo(r) + '</p>' +
    barraCupos(r) +
    cifras([['Recaudado', fmtDinero(r.recaudado, r.moneda)], ['Por cobrar', fmtDinero(r.por_cobrar, r.moneda)]]) +
    '<div class="acciones">' +
    '<button type="button" class="btn chico" onclick="copiarTabla(false)">Copiar la tabla</button>' +
    '<button type="button" class="btn chico fantasma" onclick="copiarTabla(true)">Copiar con encabezados</button>' +
    '<button type="button" class="btn chico fantasma" onclick="exportarExcel()">Exportar a Excel</button>' +
    '<button type="button" class="btn chico fantasma" ' +
    (seguro ? 'onclick="editarSalida(\'' + seguro + '\')"' : 'disabled') + '>Editar la salida</button>' +
    '<span id="accionesSalidaExtra"><button type="button" class="btn chico fantasma" ' +
    (seguro ? 'onclick="irAbonoSalida(\'' + seguro + '\')"' : 'disabled') + '>Registrar abono a mano</button></span></div>' +
    '<div id="copiaManual" class="copia-manual"></div>' +
    renderTablaInscritos(filas) +
    '<p class="pista">«Lista» aparece sola cuando el saldo es cero y los requisitos que bloquean están cumplidos. ' +
    '«Por validar» es dinero que el viajero dice haber pagado y aún no cuenta en el saldo.</p>';
}

/* ── Formulario ── */

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_SALIDA = [['abierta', 'Abierta — se puede reservar'], ['confirmada', 'Confirmada — ya sale seguro'],
  ['cerrada', 'Cerrada — no mostrar']];

/* Valores crudos del formulario -> {datos} listos para insert/update, o {error} en español. */
export function validarSalida(v){
  const vacioNull = t => { const s = String(t == null ? '' : t).trim(); return s === '' ? null : s; };
  const plan = String(v.plan_id || '').trim();
  if(!plan) return {error: 'Escoge el plan.'};
  const ini = String(v.fecha_inicio || '').trim();
  if(!RE_FECHA.test(ini)) return {error: 'Ponle la fecha de salida.'};
  const finTxt = String(v.fecha_fin || '').trim();
  if(finTxt && !RE_FECHA.test(finTxt)) return {error: 'La fecha de regreso no es válida.'};
  const fin = finTxt || ini;
  if(fin < ini) return {error: 'La fecha de regreso no puede ser antes de la salida.'};
  const cuposTxt = String(v.cupos_total == null ? '' : v.cupos_total).trim();
  const cupos = /^\d+$/.test(cuposTxt) ? parseInt(cuposTxt, 10) : 0;
  if(cupos < 1) return {error: '¿Cuántos cupos tiene esta salida?'};
  if(!ESTADOS_SALIDA.some(e => e[0] === v.estado)) return {error: 'Escoge el estado de la salida.'};
  const limite = vacioNull(v.fecha_limite_pago);
  if(limite !== null){
    if(!RE_FECHA.test(limite)) return {error: 'La fecha límite de pago no es válida.'};
    if(limite > ini) return {error: 'La fecha límite de pago no puede ser después de la salida.'};
  }
  return {datos: {
    plan_id: plan, fecha_inicio: ini, fecha_fin: fin, cupos_total: cupos, nota: vacioNull(v.nota),
    estado: v.estado, coordinador: vacioNull(v.coordinador), punto_encuentro: vacioNull(v.punto_encuentro),
    hora_encuentro: vacioNull(v.hora_encuentro), fecha_limite_pago: limite, es_piloto: !!v.es_piloto
  }};
}

/* H20: guardar una salida que ya empezó se puede, pero se pregunta antes. */
export function fechaYaPaso(datos, hoy){
  return datos.fecha_inicio < hoy;
}

/* H20: el plan no tiene precio y la salida que se edita tampoco trae uno propio. */
export function planSinPrecio(planes, planId, salida){
  const p = (planes || []).find(x => x.id === planId);
  return !!p && p.precio_base == null && !(salida && salida.precio != null);
}

const GRUPOS_PLAN = [['Nevados', 'Nevado'], ['Páramos', 'Páramo'], ['Otros destinos', 'Disfrute']];

/* El formulario de crear/editar. `s` es la fila de salida a editar, o null para una nueva. Los
   planes inactivos no se ofrecen, salvo el de la salida que se edita. */
export function renderFormSalida(planes, s){
  const x = s || {};
  const val = k => esc(x[k] == null ? '' : x[k]);
  const grupos = GRUPOS_PLAN.map(([titulo, tipo]) => {
    const items = planes.filter(p => p.tipo === tipo && (p.activo || p.id === x.plan_id));
    if(!items.length) return '';
    return '<optgroup label="' + esc(titulo) + '">' + items.map(p =>
      '<option value="' + esc(p.id) + '"' + (p.id === x.plan_id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>').join('') +
      '</optgroup>';
  }).join('');
  const estado = x.estado || 'abierta';
  const estados = ESTADOS_SALIDA.map(([k, t]) =>
    '<option value="' + k + '"' + (k === estado ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
  return '<label for="sf-plan">Plan<span class="req">*</span></label>' +
    '<select id="sf-plan" onchange="avisarPlanSinPrecio()"><option value="">Escoge el plan</option>' + grupos + '</select>' +
    '<p class="pista" id="sf-sin-precio" hidden>Este plan no tiene precio: el viajero verá «Precio por confirmar».</p>' +
    '<div class="dos-col"><div><label for="sf-inicio">Fecha de salida<span class="req">*</span></label>' +
    '<input type="date" id="sf-inicio" value="' + val('fecha_inicio') + '"></div>' +
    '<div><label for="sf-fin">Fecha de regreso <span class="opc">si va vacía, dura un día</span></label>' +
    '<input type="date" id="sf-fin" value="' + val('fecha_fin') + '"></div></div>' +
    '<label for="sf-total">Cupos totales<span class="req">*</span></label>' +
    '<input type="tel" id="sf-total" inputmode="numeric" placeholder="12" value="' + val('cupos_total') + '">' +
    '<p class="pista">Los cupos ocupados se cuentan solos desde las inscripciones.</p>' +
    '<label for="sf-estado">Estado</label><select id="sf-estado">' + estados + '</select>' +
    '<label for="sf-nota">Nota para el cliente <span class="opc">opcional</span></label>' +
    '<input type="text" id="sf-nota" placeholder="Quedan 2 cupos en carpa compartida" value="' + val('nota') + '">' +
    '<label for="sf-coord">Coordinador <span class="opc">opcional</span></label>' +
    '<input type="text" id="sf-coord" value="' + val('coordinador') + '">' +
    '<div class="dos-col"><div><label for="sf-punto">Punto de encuentro <span class="opc">opcional</span></label>' +
    '<input type="text" id="sf-punto" value="' + val('punto_encuentro') + '"></div>' +
    '<div><label for="sf-hora">Hora de encuentro <span class="opc">opcional</span></label>' +
    '<input type="text" id="sf-hora" placeholder="4:00 a. m." value="' + val('hora_encuentro') + '"></div></div>' +
    '<label for="sf-limite">Fecha límite de pago <span class="opc">opcional</span></label>' +
    '<input type="date" id="sf-limite" value="' + val('fecha_limite_pago') + '">' +
    '<label class="check' + (x.es_piloto ? ' on' : '') + '" for="sf-piloto"><input type="checkbox" id="sf-piloto"' +
    (x.es_piloto ? ' checked' : '') + '><span>Salida del piloto<em>Marca las salidas con las que se prueba la app.</em></span></label>' +
    '<div style="margin-top:22px"></div>' +
    '<button type="button" class="btn" onclick="guardarSalida()">Guardar salida</button>' +
    '<button type="button" class="btn fantasma" onclick="irOficina(\'salidas\')">Cancelar</button>' +
    '<div id="sf-confirmar" class="aviso" hidden></div>' +
    '<div class="errl" id="sf-error" role="alert"></div>';
}

/* ── Armador de enlaces (antes pLink del demo): ahora apunta a una salida concreta ── */

/* Carpeta de la app a partir de la dirección de la oficina (sin archivo, consulta ni ancla). */
export function baseApp(href){
  return String(href).replace(/[?#].*$/, '').replace(/[^/]*$/, '');
}

export function armarLink(base, salidaId){
  return salidaId ? base + '?salida=' + encodeURIComponent(salidaId) : base;
}

export function textoWhatsApp({plan, rango, link}){
  return 'Hola! Te dejo tu inscripción lista para ' + (plan || 'tu viaje') + (rango ? ' (' + rango + ')' : '') +
    '.\n\n' + link + '\n\nEntras, creas tu cuenta y ya te aparece todo escogido. Cualquier cosa me escribes.';
}

export function urlWhatsApp(texto){
  return 'https://api.whatsapp.com/send/?text=' + encodeURIComponent(texto);
}

/* El selector de salida y el enlace resultante. `salidas`: filas de v_salida_resumen (próximas). */
export function renderEnlace(salidas, seleccionada, base){
  if(!salidas.length) return '<p class="tenue">No hay salidas próximas para armar un enlace.</p>';
  const opciones = salidas.map(s => '<option value="' + esc(s.salida_id) + '"' + (s.salida_id === seleccionada ? ' selected' : '') + '>' +
    esc(s.plan_nombre + ' · ' + rangoFechas(s.fecha_inicio, s.fecha_fin)) + '</option>').join('');
  return '<label for="en-salida">Salida</label><select id="en-salida" onchange="cambiarEnlace()">' + opciones + '</select>' +
    '<div style="margin-top:18px"></div><div class="cejilla">El enlace</div>' +
    '<p class="pista" id="en-link" style="word-break:break-all;line-height:1.7">' + esc(armarLink(base, seleccionada || salidas[0].salida_id)) + '</p>' +
    '<button type="button" class="btn" onclick="copiarEnlace()">Copiar el enlace</button>' +
    '<button type="button" class="btn fantasma" onclick="enlaceWhatsApp()">Mandarlo por WhatsApp</button>' +
    '<div id="en-manual" class="copia-manual"></div>';
}

/* ── Exportación ── */

/* Nombres de requisito únicos, por requisito.orden (y id): el orden de las columnas del export. */
export function ordenRequisitos(reqs){
  const l = reqs.slice().sort((a, b) => (a.orden - b.orden) || (String(a.id) < String(b.id) ? -1 : 1));
  return [...new Set(l.map(r => r.nombre))];
}

export function nombreArchivo(plan, fecha){
  const slug = String(plan || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return 'inscritos-' + (slug ? slug + '-' : '') + fecha + '.csv';
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

let actual = null;          // resumen de la salida abierta (fila de v_salida_resumen)
let salidaEditando = null;  // id de la salida del formulario, o null si es nueva
let planesForm = [];        // planes del formulario (con precio_base)
let salidaForm = null;      // la fila de salida que se edita, o null
let salidasEnlace = [];

const el = id => document.getElementById(id);
const fallo = (caja, e) => { el(caja).innerHTML = '<div class="error">' + esc(falloDe(e, 'cargar')) + '</div>'; };

export async function cargarSalidas(){
  const caja = el('cajaSalidas');
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const r = await supa.from('v_salida_resumen').select('*');
    if(r.error) throw errorDeBase(r.error);
    caja.innerHTML = '<div class="acciones">' +
      '<button type="button" class="btn chico" onclick="nuevaSalida()">Crear una salida</button>' +
      '<button type="button" class="btn chico fantasma" onclick="irOficina(\'enlace\')">Armar enlace para un cliente</button>' +
      '<button type="button" class="btn chico fantasma" onclick="exportarTodo()">Exportar todo a Excel</button></div>' +
      renderSalidas(r.data || [], hoyBogota());
  }catch(e){ fallo('cajaSalidas', e); }
}

export function abrirSalida(id){ return irA('salida', id); }

const vistas = generacion();   // abrir otra salida mientras carga la anterior: gana la última

export async function mostrarSalida(id){
  const caja = el('cajaSalida');
  const mia = vistas.nueva();
  actual = null;   // hasta que cargue la nueva, copiar/exportar no usan los datos de la anterior
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const [res, sal] = await Promise.all([
      supa.from('v_salida_resumen').select('*').eq('salida_id', id).maybeSingle(),
      supa.from('v_inscripcion_saldo').select('*').eq('salida_id', id)
    ]);
    if(res.error) throw errorDeBase(res.error);
    if(sal.error) throw errorDeBase(sal.error);
    if(!res.data) throw new Error('No encontramos esa salida.');
    const viajeros = [...new Set((sal.data || []).map(s => s.viajero_id))];
    const nombres = {};
    if(viajeros.length){
      const v = await supa.from('viajero').select('id, nombre').in('id', viajeros);
      if(v.error) throw errorDeBase(v.error);
      for(const x of v.data || []) nombres[x.id] = x.nombre;
    }
    const pausas = {};
    if((sal.data || []).length){
      const pr = await supa.from('inscripcion_pausa').select('inscripcion_id, razon').in('inscripcion_id', sal.data.map(s => s.inscripcion_id));
      if(pr.error) throw errorDeBase(pr.error);
      for(const x of pr.data || []) pausas[x.inscripcion_id] = x.razon;
    }
    if(!vistas.vigente(mia)) return;
    actual = res.data;
    caja.innerHTML = renderDetalleSalida(res.data, filasInscritos(sal.data || [], nombres, pausas));
  }catch(e){ if(vistas.vigente(mia)) fallo('cajaSalida', e); }
}

/* Filas de export_inscritos con los requisitos ya en columnas, en el orden de requisito.orden. */
async function filasParaExportar(salida){
  const [filas, reqs] = await Promise.all([
    rpc('export_inscritos', {p_salida: salida.salida_id}),
    supa.from('requisito').select('id, nombre, orden').order('orden').order('id')
  ]);
  if(reqs.error) throw errorDeBase(reqs.error);
  return aplanarRequisitos(filas || [], ordenRequisitos(reqs.data || []));
}

async function copiarOMostrar(texto, cajaManual){
  if(await copiarTexto(texto)) return avisar('Tabla copiada. Pégala en Excel o en Sheets.');
  el(cajaManual).innerHTML = '<div class="aviso">Tu navegador no dejó copiar. Selecciona el texto y cópialo a mano.</div>' +
    '<textarea readonly id="textoManual"></textarea>';
  const t = el('textoManual');
  t.value = texto; t.focus(); t.select();
}

/* Con unaSolaVez, un doble clic no copia dos veces ni descarga dos archivos. Se toma `salida`
   al empezar: si se abre otra salida mientras tanto, no se mezclan los datos. */
export const copiarTabla = unaSolaVez(async function(conEncabezados){
  const salida = actual;
  if(!salida) return;
  try{
    const filas = await filasParaExportar(salida);
    if(!filas.length) return avisar('Esta salida no tiene inscritos para copiar.', true);
    await copiarOMostrar(aTSV(filas, !!conEncabezados), 'copiaManual');
  }catch(e){ avisar(falloDe(e, 'copiar'), true); }
});

export const exportarExcel = unaSolaVez(async function(){
  const salida = actual;
  if(!salida) return;
  try{
    const filas = await filasParaExportar(salida);
    if(!filas.length) return avisar('Esta salida no tiene inscritos para exportar.', true);
    descargarTexto(nombreArchivo(salida.plan_nombre, salida.fecha_inicio), aCSV(filas), 'text/csv;charset=utf-8');
    avisar('Archivo listo. Ábrelo con Excel.');
  }catch(e){ avisar(falloDe(e, 'exportar'), true); }
});

/* Respaldo: todas las inscripciones de las salidas próximas en un solo CSV (export_inscritos_todas,
   solo staff). El orden de las columnas de requisitos sale de requisito.orden, como en el export
   de una salida. Con unaSolaVez, un doble clic no descarga dos archivos. */
export const exportarTodo = unaSolaVez(async function(){
  try{
    const [filas, reqs] = await Promise.all([
      rpc('export_inscritos_todas', {}),
      supa.from('requisito').select('id, nombre, orden').order('orden').order('id')
    ]);
    if(reqs.error) throw errorDeBase(reqs.error);
    if(!filas || !filas.length) return avisar('No hay inscripciones en las salidas próximas para exportar.', true);
    descargarTexto(nombreArchivoTodo(hoyBogota()), armarCSVTodo(filas, ordenRequisitos(reqs.data || [])), 'text/csv;charset=utf-8');
    const aviso = avisoExportarTodo(filas.length);
    avisar(aviso.texto, aviso.error);
  }catch(e){ avisar(falloDe(e, 'exportar'), true); }
});

/* ── Crear y editar ── */

export function nuevaSalida(){ return irA('salida-form', null); }
export function editarSalida(id){ return irA('salida-form', id); }

export async function abrirFormulario(id){
  salidaEditando = id || null;
  planesForm = []; salidaForm = null;
  el('tituloSalidaForm').textContent = id ? 'Editar salida' : 'Nueva salida';
  const caja = el('cajaSalidaForm');
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const [p, s] = await Promise.all([
      supa.from('plan').select('id, nombre, tipo, activo, precio_base').order('nombre'),
      id ? supa.from('salida').select('*').eq('id', id).maybeSingle() : Promise.resolve({data: null})
    ]);
    if(p.error) throw errorDeBase(p.error);
    if(s.error) throw errorDeBase(s.error);
    if(id && !s.data) throw new Error('No encontramos esa salida.');
    planesForm = p.data || []; salidaForm = s.data || null;
    caja.innerHTML = renderFormSalida(planesForm, salidaForm);
    avisarPlanSinPrecio();
  }catch(e){ fallo('cajaSalidaForm', e); }
}

/* Muestra u oculta, bajo el plan, el aviso de que el plan no tiene precio. No bloquea. */
export function avisarPlanSinPrecio(){
  const aviso = el('sf-sin-precio'), plan = el('sf-plan');
  if(aviso && plan) aviso.hidden = !planSinPrecio(planesForm, plan.value, salidaForm);
}

export function descartarSalidaPasada(){
  const box = el('sf-confirmar');
  if(box){ box.hidden = true; box.innerHTML = ''; }
}

/* Doble clic: unaSolaVez ignora la segunda llamada en el mismo instante (antes de cualquier
   await) y el botón se bloquea mientras guarda; sin esto salían dos salidas. */
export const guardarSalida = unaSolaVez(async function(confirmada){
  const botones = document.querySelectorAll('#cajaSalidaForm button[onclick="guardarSalida()"], #sf-confirmar button');
  botones.forEach(b => { b.disabled = true; });
  try{ await guardarSalidaAhora(confirmada === true); }
  finally{ botones.forEach(b => { b.disabled = false; }); }
});

/* H20: con fecha pasada y sin confirmar, no guarda: pregunta en línea («Sí, guardar» / «No, volver»). */
async function guardarSalidaAhora(confirmada){
  const v = k => el(k).value;
  const r = validarSalida({
    plan_id: v('sf-plan'), fecha_inicio: v('sf-inicio'), fecha_fin: v('sf-fin'), cupos_total: v('sf-total'),
    estado: v('sf-estado'), nota: v('sf-nota'), coordinador: v('sf-coord'), punto_encuentro: v('sf-punto'),
    hora_encuentro: v('sf-hora'), fecha_limite_pago: v('sf-limite'), es_piloto: el('sf-piloto').checked
  });
  const err = el('sf-error');
  if(r.error){ err.textContent = r.error; descartarSalidaPasada(); return; }
  err.textContent = '';
  if(!confirmada && fechaYaPaso(r.datos, hoyBogota())){
    const box = el('sf-confirmar');
    box.hidden = false;
    box.innerHTML = 'Esa fecha ya pasó. ¿Guardarla así?' +
      '<div class="acciones" style="margin-top:12px"><button type="button" class="btn chico" onclick="guardarSalida(true)">Sí, guardar</button>' +
      '<button type="button" class="btn chico fantasma" onclick="descartarSalidaPasada()">No, volver</button></div>';
    return;
  }
  descartarSalidaPasada();
  try{
    // insert/update directos: la RLS de salida deja escribir solo a staff.
    const q = salidaEditando
      ? await supa.from('salida').update(r.datos).eq('id', salidaEditando).select('id').maybeSingle()
      : await supa.from('salida').insert(r.datos).select('id').maybeSingle();
    if(q.error) throw errorDeBase(q.error);
    if(!q.data) throw new Error('No se guardó (¿tu rol puede editar salidas?).');
    avisar('Salida guardada.');
    await irA(salidaEditando ? 'salida' : 'salidas', salidaEditando || undefined);
  }catch(e){ err.textContent = falloDe(e, 'guardar'); }
}

/* ── Armador de enlaces ── */

export async function abrirEnlace(){
  const caja = el('cajaEnlace');
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const r = await supa.from('v_salida_resumen').select('*');
    if(r.error) throw errorDeBase(r.error);
    const hoy = hoyBogota();
    salidasEnlace = salidasParaEnlace(r.data || [], hoy);
    caja.innerHTML = renderEnlace(salidasEnlace, null, baseApp(location.href));
  }catch(e){ fallo('cajaEnlace', e); }
}

function enlaceActual(){
  const id = el('en-salida').value;
  const s = salidasEnlace.find(x => x.salida_id === id);
  return {id, salida: s, link: armarLink(baseApp(location.href), id)};
}

export function cambiarEnlace(){
  el('en-link').textContent = enlaceActual().link;
}

export async function copiarEnlace(){
  const {link} = enlaceActual();
  if(await copiarTexto(link)) return avisar('Enlace copiado. Pégalo en el chat del cliente.');
  el('en-manual').innerHTML = '<div class="aviso">Tu navegador no dejó copiar. Selecciona el enlace de arriba y cópialo a mano.</div>';
}

export function enlaceWhatsApp(){
  const {salida, link} = enlaceActual();
  const texto = textoWhatsApp({plan: salida && salida.plan_nombre,
    rango: salida && rangoFechas(salida.fecha_inicio, salida.fecha_fin), link});
  window.open(urlWhatsApp(texto), '_blank', 'noopener');
}
