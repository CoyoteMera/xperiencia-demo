/* Abono a mano: la oficina registra un pago que le llegó por fuera de la app (efectivo,
   transferencia a la cuenta) y lo reparte entre las inscripciones del grupo de quien paga.
   Entra ya validado: registrar_abono(..., p_validar => true).
   El dinero lo reparte y lo valida Postgres (tg_validar_asignacion: TRM entre monedas, la suma no
   pasa del abono, misma tolerancia). Aquí NO se suma: solo se leen los montos que escribió la
   persona y se mandan tal cual. Funciones puras arriba y, al final, las de DOM y red. */
import { supa, rpc, mensajeDeError } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero, avisar, uuid } from '../comun/util.js';
import { unaSolaVez, retrasar, generacion } from '../comun/guardia.js';
import { parsearMonto, validarArchivo, rutaComprobante } from '../viajero/comprobantes.js';
import { parsearTRM, MENSAJE_TRM } from './bandeja.js';
import { renderResultados } from './ficha.js';
import { rangoFechas } from './salidas.js';
import { irA } from './nav.js';

/* ───────────── lógica pura ───────────── */

/* El comprobante de un abono a mano va a la carpeta de QUIEN lo registra (la política de Storage
   deja escribir a staff en cualquier carpeta, pero nunca en la de un viajero ajeno). Misma
   ruta y misma lista blanca de tipos que la app del viajero. */
export const rutaDeOficina = rutaComprobante;

/* Inscripciones del grupo de quien paga -> un grupo por salida (la más próxima primero, o la
   pedida), titular antes que sus acompañantes y sin canceladas. `filas` trae por inscripción:
   id, salida_id, titular_id, estado, viajero_id, nombre, plan_nombre, plan_moneda, fecha_inicio, fecha_fin, saldo. */
export function gruposDeAbono(filas, salidaPreferida){
  const vivas = (filas || []).filter(f => f.estado !== 'cancelada');
  const por = new Map();
  for(const f of vivas){
    if(!por.has(f.salida_id)){
      por.set(f.salida_id, {salida_id: f.salida_id, plan_nombre: f.plan_nombre, plan_moneda: f.plan_moneda,
        fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin, filas: []});
    }
    por.get(f.salida_id).filas.push(f);
  }
  const orden = f => (f.titular_id ? 1 : 0);
  const grupos = [...por.values()].map(g => ({
    ...g,
    filas: g.filas.sort((a, b) => (orden(a) - orden(b)) || String(a.nombre).localeCompare(String(b.nombre), 'es') || String(a.id).localeCompare(String(b.id)))
  }));
  return grupos.sort((a, b) =>
    (a.salida_id === salidaPreferida ? -1 : 0) - (b.salida_id === salidaPreferida ? -1 : 0) ||
    String(a.fecha_inicio || '').localeCompare(String(b.fecha_inicio || '')) || String(a.salida_id).localeCompare(String(b.salida_id)));
}

/* ¿Hace falta la TRM? Solo si alguna persona con monto paga en una moneda distinta a la del
   abono. Compara monedas; no suma nada. `filas`: [{planMoneda, monto (texto)}]. */
export function necesitaTRM(monedaAbono, filas){
  return (filas || []).some(f => String(f.monto == null ? '' : f.monto).trim() !== '' && f.planMoneda && f.planMoneda !== monedaAbono);
}

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/* Valores crudos del formulario -> {args} listos para registrar_abono (con p_validar aparte), o
   {error} en español. Cada monto se lee en la moneda en que se paga (el del abono, la de cada
   plan para su reparto). */
export function validarAbonoManual(v){
  if(!v.pagador) return {error: 'Escoge quién paga.'};
  if(v.moneda !== 'COP' && v.moneda !== 'USD') return {error: 'Escoge la moneda del abono.'};
  const monto = parsearMonto(v.monto, v.moneda);
  if(monto === null) return {error: 'Escribe el monto del abono' + (v.moneda === 'USD' ? ' (en dólares, con punto o coma para los centavos).' : ' (en pesos, sin centavos).')};
  const fecha = String(v.fecha == null ? '' : v.fecha).trim();
  if(fecha && !RE_FECHA.test(fecha)) return {error: 'La fecha del pago no es válida.'};

  const asignaciones = [];
  const conMonto = [];
  for(const f of v.filas || []){
    if(String(f.monto == null ? '' : f.monto).trim() === '') continue;
    const m = parsearMonto(f.monto, f.planMoneda);
    if(m === null) return {error: 'Revisa cuánto va para ' + f.nombre + (f.planMoneda === 'USD' ? ' (en dólares).' : ' (en pesos, sin centavos).')};
    asignaciones.push({inscripcion_id: f.inscripcion_id, monto: m});
    conMonto.push(f);
  }
  if(!asignaciones.length) return {error: 'Reparte el abono: escribe cuánto va para al menos una persona.'};

  let trm = null;
  if(necesitaTRM(v.moneda, conMonto)){
    if(String(v.trm == null ? '' : v.trm).trim() === '')
      return {error: 'Escribe la TRM: el abono es en ' + v.moneda + ' y alguien paga su plan en otra moneda.'};
    trm = parsearTRM(v.trm);
    if(trm === null) return {error: MENSAJE_TRM};
  }
  const limpio = t => { const s = String(t == null ? '' : t).trim(); return s === '' ? null : s; };
  return {args: {
    p_pagador: v.pagador, p_monto: monto, p_moneda: v.moneda, p_trm: trm, p_fecha: fecha || null,
    p_medio: limpio(v.medio), p_cuenta: limpio(v.cuenta), p_asignaciones: asignaciones
  }};
}

const MEDIOS = ['Transferencia', 'Efectivo', 'Consignación', 'Nequi', 'Tarjeta', 'PayPal'];

/* El formulario. `pagador`: {id, nombre}. `grupos`: de gruposDeAbono. `cuentas`: filas de `cuenta`. */
export function renderFormAbono(pagador, grupos, cuentas){
  const cab = '<div class="cejilla">Abono a mano</div><h1>Registrar un pago</h1>' +
    '<p class="tenue sub">Paga: <b>' + esc(pagador.nombre) + '</b>. Queda validado al guardar y baja el saldo de inmediato.</p>';
  if(!grupos.length){
    return cab + '<div class="vacio"><p>Esta persona no tiene inscripciones activas a las que abonar.</p></div>';
  }
  const opcionesGrupo = grupos.map((g, i) => '<option value="' + esc(g.salida_id) + '"' + (i === 0 ? ' selected' : '') + '>' +
    esc(g.plan_nombre + ' · ' + rangoFechas(g.fecha_inicio, g.fecha_fin)) + '</option>').join('');
  const bloques = grupos.map((g, i) => '<div class="grupo-ab" data-salida="' + esc(g.salida_id) + '"' + (i === 0 ? '' : ' hidden') + '>' +
    g.filas.map(f => {
      const id = idSeguro(f.id);
      return '<div class="fila-ab"><div class="quien"><b>' + esc(f.nombre) + '</b>' +
        (f.titular_id ? ' <span class="etq">Acompañante</span>' : '') +
        '<div class="tenue-s">Falta ' + esc(fmtDinero(f.saldo, f.plan_moneda)) + ' · plan en ' + esc(f.plan_moneda) + '</div></div>' +
        (id ? '<input type="text" inputmode="decimal" id="ab-m-' + id + '" data-insc="' + id + '" data-nombre="' + esc(f.nombre) +
          '" data-moneda="' + esc(f.plan_moneda) + '" placeholder="0" aria-label="Cuánto va para ' + esc(f.nombre) + '" oninput="cambiarAbono()">'
          : '<span class="tenue-s">No se puede abonar a esta fila.</span>') + '</div>';
    }).join('') + '</div>').join('');
  const cuentasOpc = '<option value="">Sin cuenta</option>' + (cuentas || []).map(c =>
    '<option value="' + esc(c.id) + '">' + esc(c.nombre + (c.medio ? ' · ' + c.medio : '')) + '</option>').join('');
  const medios = [...new Set([...MEDIOS, ...(cuentas || []).map(c => c.medio).filter(Boolean)])];

  return cab + '<div class="tarjeta">' +
    '<label for="ab-grupo">Salida</label><select id="ab-grupo" onchange="cambiarAbono()">' + opcionesGrupo + '</select>' +
    '<div class="dos-col"><div><label for="ab-monto">Monto del abono<span class="req">*</span></label>' +
    '<input type="text" inputmode="decimal" id="ab-monto" placeholder="Ej. 800.000"></div>' +
    '<div><label for="ab-moneda">Moneda</label><select id="ab-moneda" onchange="cambiarAbono()">' +
    '<option value="COP" selected>Pesos (COP)</option><option value="USD">Dólares (USD)</option></select></div></div>' +
    '<div id="ab-trm-caja" hidden><label for="ab-trm">TRM (pesos por dólar)<span class="req">*</span></label>' +
    '<input type="text" inputmode="decimal" id="ab-trm" placeholder="Ej. 4120">' +
    '<p class="pista">El abono y el plan están en monedas distintas. Postgres hace la conversión con esta TRM.</p></div>' +
    '<div class="dos-col"><div><label for="ab-fecha">Fecha del pago <span class="opc">si va vacía, hoy</span></label>' +
    '<input type="date" id="ab-fecha"></div>' +
    '<div><label for="ab-medio">Medio <span class="opc">opcional</span></label>' +
    '<input type="text" id="ab-medio" list="ab-medios" placeholder="Transferencia"><datalist id="ab-medios">' +
    medios.map(m => '<option value="' + esc(m) + '">').join('') + '</datalist></div></div>' +
    '<label for="ab-cuenta">Cuenta donde entró <span class="opc">opcional</span></label>' +
    '<select id="ab-cuenta">' + cuentasOpc + '</select>' +
    '<label for="ab-file">Comprobante <span class="opc">opcional · foto o PDF, hasta 10 MB</span></label>' +
    '<input type="file" id="ab-file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,application/pdf">' +
    '<div class="sub-titulo" style="margin-top:20px">¿Para quién es? Escribe cuánto va a cada persona</div>' + bloques +
    '<p class="pista">Escribe el valor en la moneda del plan de cada persona. Postgres revisa que el reparto no pase del abono.</p>' +
    '<div style="margin-top:22px"></div>' +
    '<button type="button" class="btn" onclick="guardarAbono()">Guardar y validar el abono</button>' +
    '<button type="button" class="btn fantasma" onclick="cancelarAbono()">Cancelar</button>' +
    '<div class="errl" id="ab-error" role="alert"></div></div>';
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

const el = id => document.getElementById(id);
const cargas = generacion();
const busquedas = generacion();
let pagadorActual = null;   // {id, nombre}
let salidaPreferida = null;

export function irAbonoSalida(salidaId){ return irA('abono', {salida: salidaId}); }
export function elegirPagador(id){ return irA('abono', {pagador: id, salida: salidaPreferida}); }
export function cancelarAbono(){
  return pagadorActual ? irA('ficha', pagadorActual.id) : irA('salidas');
}

export async function entrarAbono(arg){
  const a = arg || {};
  salidaPreferida = a.salida || null;
  if(a.pagador) return cargarFormulario(a.pagador);
  cargas.nueva();   // descarta la respuesta lenta de un formulario anterior
  pagadorActual = null;
  el('cajaAbono').innerHTML = '<div class="cejilla">Abono a mano</div><h1>Registrar un pago</h1>' +
    '<p class="tenue sub">Primero busca a quien hizo el pago.</p>' +
    '<label for="ab-busca">Buscar por nombre, documento o celular</label>' +
    '<input type="search" id="ab-busca" oninput="buscarPagador()" autocomplete="off" placeholder="Escribe al menos 2 letras">' +
    '<div id="ab-resultados" aria-live="polite"></div>';
  const c = el('ab-busca'); if(c) c.focus();
}

async function buscarPagadorAhora(){
  const campo = el('ab-busca'), caja = el('ab-resultados');
  if(!campo || !caja) return;
  const t = campo.value.trim();
  const mia = busquedas.nueva();
  if(t.length < 2){ caja.innerHTML = ''; return; }
  try{
    const filas = await rpc('buscar_viajero', {p_texto: t});
    if(busquedas.vigente(mia)) caja.innerHTML = renderResultados(filas || [], 'elegirPagador');
  }catch(e){
    if(busquedas.vigente(mia)) caja.innerHTML = '<div class="error">No pudimos buscar: ' + esc(mensajeDeError(e)) + '</div>';
  }
}
export const buscarPagador = retrasar(buscarPagadorAhora, 250);

const SEL_GRUPO = 'id, salida_id, titular_id, estado, viajero:viajero(id, nombre), ' +
  'salida:salida(fecha_inicio, fecha_fin, plan:plan(nombre, moneda))';

/* Las inscripciones del grupo de quien paga: las suyas y las de los grupos a los que pertenece
   (si es titular, sus acompañantes; si es acompañante, su titular y los demás). */
async function filasDelGrupo(pagadorId){
  const q = r => { if(r.error) throw new Error(r.error.message); return r.data || []; };
  const propias = q(await supa.from('inscripcion').select('id, titular_id, estado').eq('viajero_id', pagadorId));
  const raices = [...new Set(propias.filter(i => i.estado !== 'cancelada').map(i => i.titular_id || i.id))].filter(idSeguro);
  if(!raices.length) return [];
  const lista = raices.join(',');
  const insc = q(await supa.from('inscripcion').select(SEL_GRUPO).or('id.in.(' + lista + '),titular_id.in.(' + lista + ')'));
  const ids = insc.map(i => i.id);
  const saldos = ids.length ? q(await supa.from('v_inscripcion_saldo').select('inscripcion_id, saldo').in('inscripcion_id', ids)) : [];
  const saldoDe = new Map(saldos.map(s => [s.inscripcion_id, s.saldo]));
  return insc.map(i => ({
    id: i.id, salida_id: i.salida_id, titular_id: i.titular_id, estado: i.estado,
    viajero_id: i.viajero && i.viajero.id, nombre: (i.viajero && i.viajero.nombre) || '',
    plan_nombre: (i.salida && i.salida.plan && i.salida.plan.nombre) || '',
    plan_moneda: (i.salida && i.salida.plan && i.salida.plan.moneda) || 'COP',
    fecha_inicio: i.salida && i.salida.fecha_inicio, fecha_fin: i.salida && i.salida.fecha_fin,
    saldo: saldoDe.has(i.id) ? saldoDe.get(i.id) : null
  }));
}

async function cargarFormulario(pagadorId){
  const caja = el('cajaAbono');
  const mia = cargas.nueva();
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const v = await supa.from('viajero').select('id, nombre').eq('id', pagadorId).maybeSingle();
    if(v.error) throw new Error(v.error.message);
    if(!v.data) throw new Error('No encontramos a esa persona.');
    const [filas, cuentas] = await Promise.all([
      filasDelGrupo(pagadorId),
      supa.from('cuenta').select('id, nombre, medio').eq('activa', true).order('nombre')
    ]);
    if(cuentas.error) throw new Error(cuentas.error.message);
    if(!cargas.vigente(mia)) return;
    pagadorActual = v.data;
    caja.innerHTML = renderFormAbono(v.data, gruposDeAbono(filas, salidaPreferida), cuentas.data || []);
    cambiarAbono();
  }catch(e){
    if(cargas.vigente(mia)) caja.innerHTML = '<div class="error">No pudimos abrir el formulario: ' + esc(mensajeDeError(e)) + '</div>';
  }
}

function grupoVisible(){
  const sel = el('ab-grupo');
  return sel ? [...document.querySelectorAll('#cajaAbono .grupo-ab')].find(g => g.dataset.salida === sel.value) : null;
}

function filasLeidas(){
  const g = grupoVisible();
  if(!g) return [];
  return [...g.querySelectorAll('input[data-insc]')].map(i => ({
    inscripcion_id: i.dataset.insc, nombre: i.dataset.nombre, planMoneda: i.dataset.moneda, monto: i.value
  }));
}

/* Muestra solo el grupo escogido y la TRM cuando las monedas se cruzan. */
export function cambiarAbono(){
  const sel = el('ab-grupo');
  if(!sel) return;
  document.querySelectorAll('#cajaAbono .grupo-ab').forEach(g => { g.hidden = g.dataset.salida !== sel.value; });
  el('ab-trm-caja').hidden = !necesitaTRM(el('ab-moneda').value, filasLeidas());
}

export const guardarAbono = unaSolaVez(async function(){
  const err = el('ab-error');
  const boton = document.querySelector('#cajaAbono button[onclick="guardarAbono()"]');
  const r = validarAbonoManual({
    pagador: pagadorActual && pagadorActual.id, monto: el('ab-monto').value, moneda: el('ab-moneda').value,
    trm: el('ab-trm').value, fecha: el('ab-fecha').value, medio: el('ab-medio').value, cuenta: el('ab-cuenta').value,
    filas: filasLeidas()
  });
  if(r.error){ err.textContent = r.error; return; }
  const archivo = el('ab-file').files && el('ab-file').files[0];
  if(archivo){
    const motivo = validarArchivo(archivo);
    if(motivo){ err.textContent = motivo; return; }
  }
  err.textContent = '';
  if(boton) boton.disabled = true;
  try{
    let ruta = null;
    if(archivo){
      const s = await supa.auth.getSession();
      const uid = s.data && s.data.session && s.data.session.user && s.data.session.user.id;
      if(!uid) throw new Error('Tu sesión se cerró. Entra otra vez.');
      ruta = rutaDeOficina(uid, uuid(), archivo);
      const sub = await supa.storage.from('comprobantes').upload(ruta, archivo,
        {contentType: archivo.type || 'application/octet-stream', upsert: false});
      if(sub.error) throw new Error('No pudimos subir el archivo: ' + sub.error.message);
    }
    await rpc('registrar_abono', {...r.args, p_comprobante_path: ruta, p_validar: true});
    avisar('Abono registrado y validado.');
    await irA('ficha', pagadorActual.id);
  }catch(e){
    err.textContent = 'No se pudo guardar: ' + mensajeDeError(e);
    if(boton) boton.disabled = false;
  }
});
