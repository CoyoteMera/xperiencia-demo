/* Cancelación de una inscripción y devoluciones pendientes.
   La penalidad y lo que se devuelve los calcula Postgres (calcular_penalidad, registrar_cancelacion):
   aquí solo se pide la fecha, se muestra el resultado tal cual y se manda la corrección si la
   oficina la escribe. Funciones puras arriba y, al final, las de DOM y red. */
import { supa, rpc, mensajeDeError } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero, mesLargo, avisar, hoyBogota } from '../comun/util.js';
import { unaSolaVez, generacion } from '../comun/guardia.js';
import { rangoFechas } from './salidas.js';
import { irA } from './nav.js';

/* ───────────── lógica pura ───────────── */

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/* Penalidad corregida escrita por la oficina -> número (0 vale: se renuncia a la penalidad) o
   null si no sirve. COP: enteros, con o sin puntos de miles. USD: hasta 2 decimales. */
export function parsearPenalidad(texto, moneda){
  const t = String(texto == null ? '' : texto).trim().replace(/\s/g, '');
  if(moneda === 'USD'){
    if(!/^\d+([.,]\d{1,2})?$/.test(t)) return null;
    return Number(t.replace(',', '.'));
  }
  if(!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(t)) return null;
  return parseInt(t.replace(/\./g, ''), 10);
}

/* Formulario -> {args} para registrar_cancelacion, o {error}. Si la penalidad corregida difiere de
   la calculada, la base exige la nota y lo dice; aquí no se compara dinero. */
export function validarCancelacion(v){
  const fecha = String(v.fecha == null ? '' : v.fecha).trim();
  if(!RE_FECHA.test(fecha)) return {error: 'Escoge la fecha de cancelación.'};
  const pen = String(v.penalidad == null ? '' : v.penalidad).trim();
  let final = null;
  if(pen !== ''){
    final = parsearPenalidad(pen, v.moneda);
    if(final === null) return {error: 'La penalidad corregida no es válida' + (v.moneda === 'USD' ? ' (dólares, con hasta 2 decimales).' : ' (pesos, sin centavos).')};
  }
  const nota = String(v.nota == null ? '' : v.nota).trim();
  return {args: {p_fecha: fecha, p_penalidad_final: final, p_nota: nota === '' ? null : nota}};
}

/* Medio y fecha con que se pagó una devolución -> campos a guardar, o {error}. */
export function validarPago(v){
  const medio = String(v.medio == null ? '' : v.medio).trim();
  if(!medio) return {error: 'Escribe el medio con que se devolvió el dinero.'};
  const fecha = String(v.fecha == null ? '' : v.fecha).trim();
  if(!RE_FECHA.test(fecha)) return {error: 'Escoge la fecha de la devolución.'};
  return {datos: {medio, fecha_devolucion: fecha}};
}

/* ¿El cálculo que se ve en pantalla es el de la fecha escrita ahora? Si cambió la fecha después de
   calcular (o el cálculo falló), la confirmación no vale y hay que recalcular. */
export function calculoVigente(calculado, fecha){
  return !!calculado && calculado === fecha;
}

const num = x => String(Number(x));

/* El resultado de calcular_penalidad (una fila), sin tocar nada. */
export function renderCalculo(c, moneda){
  return '<dl class="cifras calculo">' +
    '<div><dt>Días hasta la salida</dt><dd>' + esc(c.dias) + '</dd></div>' +
    '<div><dt>Tramo</dt><dd>' + esc(num(c.pct)) + ' %' +
    (Number(c.cargo_admin_pct) > 0 ? ' + ' + esc(num(c.cargo_admin_pct)) + ' % de gastos administrativos' : '') + '</dd></div>' +
    '<div><dt>Base de la penalidad</dt><dd>' + esc(fmtDinero(c.base, moneda)) + '</dd></div>' +
    '<div><dt>Penalidad</dt><dd class="grande">' + esc(fmtDinero(c.penalidad, moneda)) + '</dd></div>' +
    '<div><dt>Pagado (validado)</dt><dd>' + esc(fmtDinero(c.pagado, moneda)) + '</dd></div>' +
    '<div><dt>A devolver</dt><dd class="grande">' + esc(fmtDinero(c.devolver, moneda)) + '</dd></div></dl>';
}

/* Ruling del proyecto (hilo cancelar-titular, se decide en R4): cancelar a un titular no
   cancela a sus acompañantes. Solo se avisa; la lógica no cambia. */
export function avisoAcompanantes(n){
  const k = Number(n) || 0;
  if(k < 1) return '';
  return '<div class="aviso"><b>Ojo: es titular de un grupo.</b> Tiene ' + k + (k === 1 ? ' acompañante' : ' acompañantes') +
    ' inscrito' + (k === 1 ? '' : 's') + '. Cancelarlo a él NO cancela al grupo: ' + (k === 1 ? 'su acompañante sigue confirmado' : 'sus acompañantes siguen confirmados') +
    ' y el cupo del grupo deja de contarse. Si también cancelan, hay que cancelarlos aparte.</div>';
}

/* El formulario de una inscripción. info = {id, viajeroId, nombre, plan_nombre, fecha_inicio, fecha_fin,
   moneda, estado, acompanantes}. */
export function renderFormCancelacion(info, hoy){
  const volver = idSeguro(info.viajeroId);
  const cab = (volver ? '<button type="button" class="volver" onclick="abrirFicha(\'' + volver + '\')">← Volver a la ficha</button>' : '') +
    '<div class="cejilla">Cancelación</div><h1>' + esc(info.nombre) + '</h1>' +
    '<p class="tenue sub">' + esc(info.plan_nombre) + ' · ' + esc(rangoFechas(info.fecha_inicio, info.fecha_fin)) + '</p>';
  if(info.estado === 'cancelada'){
    return cab + '<div class="aviso">Esta inscripción ya está cancelada.</div>';
  }
  return cab + avisoAcompanantes(info.acompanantes) +
    '<div class="tarjeta">' +
    '<label for="cc-fecha">Fecha de cancelación</label>' +
    '<div class="fila-cc"><input type="date" id="cc-fecha" value="' + esc(hoy) + '" onchange="calcularCancelacion()">' +
    '<button type="button" class="btn chico" onclick="calcularCancelacion()">Calcular la penalidad</button></div>' +
    '<div id="cc-calculo" aria-live="polite"></div>' +
    '<div class="sub-titulo" style="margin-top:20px">Corregir la penalidad <span class="opc">opcional</span></div>' +
    '<label for="cc-pen">Penalidad corregida (' + esc(info.moneda) + ')</label>' +
    '<input type="text" inputmode="decimal" id="cc-pen" placeholder="Déjala vacía para usar la calculada">' +
    '<label for="cc-nota">Nota <span class="opc">obligatoria si cambias la penalidad</span></label>' +
    '<input type="text" id="cc-nota" placeholder="Ej. Justa causa: 5 % más costos no recuperables">' +
    '<div style="margin-top:22px"></div>' +
    '<button type="button" class="btn peligro" onclick="pedirConfirmacion()">Cancelar esta inscripción</button>' +
    '<div id="cc-confirmar" class="aviso" hidden></div>' +
    '<div class="errl" id="cc-error" role="alert"></div></div>';
}

/* Una fila de devolucion con sus embeds -> objeto plano. */
export function normalizarDevolucion(f){
  const i = f.inscripcion || null;
  const v = (i && i.viajero) || null;
  const s = (i && i.salida) || {};
  return {
    id: f.id, nombre: (v && v.nombre) || f.cliente_texto || 'Sin nombre', viajeroId: (v && v.id) || null,
    plan: (s.plan && s.plan.nombre) || '', fechaSalida: s.fecha_inicio || null,
    fechaCancelacion: f.fecha_cancelacion || null, dias: f.dias, pct: f.pct_aplicado,
    penalidadCalculada: f.penalidad_calculada, penalidadFinal: f.penalidad_final, nota: f.nota_correccion || '',
    monto: f.monto_devolver, moneda: f.moneda || 'COP'
  };
}

export function renderDevoluciones(lista, hoy){
  if(!lista.length) return '<div class="vacio"><p>No hay devoluciones pendientes.</p></div>';
  return lista.map(d => {
    const id = idSeguro(d.id);
    const idv = idSeguro(d.viajeroId);
    return '<div class="item" id="dv-' + esc(d.id) + '">' +
      '<h3>' + (idv ? '<button type="button" class="enl" onclick="abrirFicha(\'' + idv + '\')">' + esc(d.nombre) + '</button>' : esc(d.nombre)) + '</h3>' +
      '<div class="cuando">' + [d.plan, d.fechaSalida ? 'sale el ' + mesLargo(d.fechaSalida) : '',
        d.fechaCancelacion ? 'canceló el ' + mesLargo(d.fechaCancelacion) : ''].filter(Boolean).map(esc).join(' · ') + '</div>' +
      '<dl class="cifras"><div><dt>A devolver</dt><dd>' + esc(fmtDinero(d.monto, d.moneda)) + '</dd></div>' +
      '<div><dt>Penalidad</dt><dd>' + esc(fmtDinero(d.penalidadFinal, d.moneda)) + '</dd></div></dl>' +
      (d.nota ? '<div class="linea">Nota: ' + esc(d.nota) + '</div>' : '') +
      '<div class="dos-col"><div><label for="dv-medio-' + esc(d.id) + '">Medio</label>' +
      '<input type="text" id="dv-medio-' + esc(d.id) + '" placeholder="Ej. Transferencia"></div>' +
      '<div><label for="dv-fecha-' + esc(d.id) + '">Fecha de la devolución</label>' +
      '<input type="date" id="dv-fecha-' + esc(d.id) + '" value="' + esc(hoy) + '"></div></div>' +
      '<div class="acciones"><button type="button" class="btn chico verde" ' +
      (id ? 'onclick="marcarPagada(\'' + id + '\')"' : 'disabled') + '>Marcar pagada</button></div>' +
      '<div class="errl" id="dv-err-' + esc(d.id) + '" role="alert"></div></div>';
  }).join('');
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

const el = id => document.getElementById(id);
const cargas = generacion();
const calculos = generacion();
let inscripcionActual = null;   // info de la inscripción que se cancela
let calculado = null;           // fecha para la que ya se mostró el cálculo


const SEL_DEV = 'id, inscripcion_id, cliente_texto, fecha_cancelacion, dias, pct_aplicado, penalidad_calculada, ' +
  'penalidad_final, nota_correccion, monto_devolver, moneda, estado, ' +
  'inscripcion:inscripcion(id, viajero:viajero(id, nombre), salida:salida(fecha_inicio, plan:plan(nombre)))';

export async function entrarCancelacion(arg){
  const a = arg || {};
  const mia = cargas.nueva();
  inscripcionActual = null; calculado = null;
  el('cajaCancelacion').innerHTML = '<div class="aviso">Un momento…</div>';
  let form = '<div class="cejilla">Dinero</div><h1>Devoluciones</h1>' +
    '<p class="tenue sub">Para cancelar a alguien, abre su ficha en «Viajeros» y usa «Cancelar esta inscripción».</p>';
  try{
    if(a.inscripcion){
      const info = await infoInscripcion(a.inscripcion);
      if(!cargas.vigente(mia)) return;
      inscripcionActual = info;
      form = renderFormCancelacion(info, hoyBogota());
    }
    const lista = await devolucionesPendientes();
    if(!cargas.vigente(mia)) return;
    el('cajaCancelacion').innerHTML = form + '<h2>Devoluciones pendientes</h2><div id="cajaDevoluciones">' +
      renderDevoluciones(lista, hoyBogota()) + '</div>';
    if(inscripcionActual && inscripcionActual.estado !== 'cancelada') await calcularCancelacion();
  }catch(e){
    if(cargas.vigente(mia)) el('cajaCancelacion').innerHTML = '<div class="error">No pudimos abrir esta pantalla: ' + esc(mensajeDeError(e)) + '</div>';
  }
}

async function infoInscripcion(id){
  const r = await supa.from('inscripcion')
    .select('id, estado, viajero:viajero(id, nombre), salida:salida(fecha_inicio, fecha_fin, plan:plan(nombre, moneda))')
    .eq('id', id).maybeSingle();
  if(r.error) throw new Error(r.error.message);
  if(!r.data) throw new Error('No encontramos esa inscripción.');
  const ac = await supa.from('inscripcion').select('id', {count: 'exact', head: true}).eq('titular_id', id).neq('estado', 'cancelada');
  if(ac.error) throw new Error(ac.error.message);
  const d = r.data, s = d.salida || {}, p = s.plan || {};
  return {id: d.id, viajeroId: d.viajero && d.viajero.id, nombre: (d.viajero && d.viajero.nombre) || '', plan_nombre: p.nombre || '',
    fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, moneda: p.moneda || 'COP', estado: d.estado, acompanantes: ac.count || 0};
}

async function devolucionesPendientes(){
  const r = await supa.from('devolucion').select(SEL_DEV).eq('estado', 'pendiente').order('fecha_cancelacion', {ascending: true});
  if(r.error) throw new Error(r.error.message);
  return (r.data || []).map(normalizarDevolucion);
}

/* Pide a la base el cálculo para la fecha escogida y lo pinta tal cual. */
export async function calcularCancelacion(){
  if(!inscripcionActual) return;
  const caja = el('cc-calculo'), fecha = el('cc-fecha').value;
  const mia = calculos.nueva();
  calculado = null;
  descartarConfirmacion();   // la confirmación mostrada era de otra fecha
  if(!RE_FECHA.test(fecha)){ caja.innerHTML = '<div class="aviso">Escoge la fecha de cancelación.</div>'; return; }
  caja.innerHTML = '<div class="aviso">Calculando…</div>';
  try{
    const filas = await rpc('calcular_penalidad', {p_inscripcion: inscripcionActual.id, p_fecha: fecha});
    if(!calculos.vigente(mia)) return;
    const c = Array.isArray(filas) ? filas[0] : filas;
    if(!c) throw new Error('La base no devolvió el cálculo.');
    calculado = fecha;
    caja.innerHTML = renderCalculo(c, inscripcionActual.moneda);
  }catch(e){
    if(calculos.vigente(mia)) caja.innerHTML = '<div class="error">' + esc(mensajeDeError(e)) + '</div>';
  }
}

/* Primer paso: la cancelación no se puede deshacer desde aquí, así que se pide confirmar. */
export function pedirConfirmacion(){
  const err = el('cc-error'), box = el('cc-confirmar');
  const v = validarCancelacion({fecha: el('cc-fecha').value, penalidad: el('cc-pen').value, nota: el('cc-nota').value,
    moneda: inscripcionActual.moneda});
  if(v.error){ err.textContent = v.error; return; }
  if(!calculoVigente(calculado, v.args.p_fecha)){ err.textContent = 'Primero calcula la penalidad para esa fecha y revísala.'; return; }
  err.textContent = '';
  box.hidden = false;
  box.innerHTML = '<b>¿Cancelar la inscripción de ' + esc(inscripcionActual.nombre) + '?</b> Se cancela el ' +
    esc(mesLargo(v.args.p_fecha)) + ' y se abre la devolución pendiente. No se puede deshacer desde aquí.' +
    '<div class="acciones" style="margin-top:12px"><button type="button" class="btn chico" onclick="confirmarCancelacion()">Sí, cancelar</button>' +
    '<button type="button" class="btn chico fantasma" onclick="descartarConfirmacion()">No, volver</button></div>';
}

export function descartarConfirmacion(){
  const box = el('cc-confirmar');
  if(box){ box.hidden = true; box.innerHTML = ''; }
}

export const confirmarCancelacion = unaSolaVez(async function(){
  const err = el('cc-error');
  const v = validarCancelacion({fecha: el('cc-fecha').value, penalidad: el('cc-pen').value, nota: el('cc-nota').value,
    moneda: inscripcionActual.moneda});
  if(v.error){ err.textContent = v.error; return; }
  if(!calculoVigente(calculado, v.args.p_fecha)){
    err.textContent = 'La fecha cambió: calcula la penalidad otra vez antes de cancelar.';
    descartarConfirmacion();
    return;
  }
  document.querySelectorAll('#cc-confirmar button').forEach(b => { b.disabled = true; });
  try{
    await rpc('registrar_cancelacion', {p_inscripcion: inscripcionActual.id, ...v.args});
    avisar('Inscripción cancelada. La devolución quedó pendiente.');
    await irA('cancelacion');
  }catch(e){
    err.textContent = 'No se pudo cancelar: ' + mensajeDeError(e);
    descartarConfirmacion();
  }
});

/* «Marcar pagada»: no hay RPC, la RLS deja escribir `devolucion` solo a staff. El filtro
   estado = 'pendiente' evita pagar dos veces desde dos pestañas. */
export const marcarPagada = unaSolaVez(async function(id){
  const err = document.getElementById('dv-err-' + id);
  const v = validarPago({medio: el('dv-medio-' + id).value, fecha: el('dv-fecha-' + id).value});
  if(v.error){ err.textContent = v.error; return; }
  err.textContent = '';
  const botones = document.querySelectorAll('#dv-' + CSS.escape(id) + ' button');
  botones.forEach(b => { b.disabled = true; });
  try{
    const r = await supa.from('devolucion').update({estado: 'pagada', ...v.datos}).eq('id', id).eq('estado', 'pendiente')
      .select('id').maybeSingle();
    if(r.error) throw new Error(r.error.message);
    if(!r.data) throw new Error('Esta devolución ya no está pendiente. Recarga la lista.');
    avisar('Devolución marcada como pagada.');
    const lista = await devolucionesPendientes();
    const caja = el('cajaDevoluciones');
    if(caja) caja.innerHTML = renderDevoluciones(lista, hoyBogota());
  }catch(e){
    botones.forEach(b => { b.disabled = false; });
    err.textContent = 'No se pudo guardar: ' + mensajeDeError(e);
  }
});
