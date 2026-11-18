/* Ficha del viajero: buscador, datos, inscripciones con saldo, abonos con su comprobante,
   requisitos con casillas, voucher, invitación y bitácora. Funciones puras arriba (se prueban
   en Node) y, al final, las que tocan DOM y red. NO se calcula dinero aquí: saldo, pagado y
   por validar vienen de v_inscripcion_saldo y los montos de cada abono, tal cual. */
import { supa, rpc, mensajeDeError } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero, mesLargo, avisar, etiquetaPausa } from '../comun/util.js';
import { copiarTexto } from '../comun/portapapeles.js';
import { unaSolaVez, generacion, retrasar } from '../comun/guardia.js';
import { baseApp, rangoFechas } from './salidas.js';
import { irA } from './nav.js';

/* ───────────── lógica pura ───────────── */

export const MIN_BUSQUEDA = 2;

/* El voucher existe desde la Tarea 10: «Ver voucher» abre voucher.html?i=<inscripción>. Si alguna
   vez hubiera que apagarlo, en false el botón avisa en vez de abrir una página que no está. */
export const VOUCHER_DISPONIBLE = true;

/* Texto del buscador -> texto recortado, o null si aún no llega a 2 caracteres. */
export function textoBuscable(t){
  const s = String(t == null ? '' : t).trim();
  return s.length >= MIN_BUSQUEDA ? s : null;
}

/* Resultados de buscar_viajero. `accion` es el handler al que se llama con el id de la persona. */
export function renderResultados(filas, accion = 'abrirFicha'){
  if(!filas || !filas.length) return '<p class="tenue">Sin resultados. Prueba con otra parte del nombre, el documento o el celular.</p>';
  return '<div class="resultados">' + filas.map(f => {
    const seguro = idSeguro(f.viajero_id);
    const datos = [f.num_doc, f.celular].filter(Boolean).map(esc).join(' · ');
    return '<button type="button" class="resultado"' +
      (seguro ? ' onclick="' + esc(accion) + '(\'' + seguro + '\')"' : ' disabled') + '>' +
      '<b>' + esc(f.nombre) + '</b>' +
      (datos ? '<span>' + datos + '</span>' : '') +
      '<span class="tenue-s">' + (f.proxima_salida ? 'Próxima salida: ' + esc(f.proxima_salida) : 'Sin salida próxima') + '</span></button>';
  }).join('') + '</div>';
}

/* Otros viajeros con el mismo documento (puede ser una persona duplicada o un error de digitación). */
export function avisoDocumento(otros){
  if(!otros || !otros.length) return '';
  return '<div class="aviso">Otra ficha tiene el mismo documento: ' + otros.map(o => {
    const seguro = idSeguro(o.id);
    return seguro
      ? '<button type="button" class="enl" onclick="abrirFicha(\'' + seguro + '\')">' + esc(o.nombre) + '</button>'
      : esc(o.nombre);
  }).join(', ') + '. Revisa si es la misma persona.</div>';
}

/* Inscripciones del viajero + sus filas de v_inscripcion_saldo -> una lista plana, la salida más
   reciente primero. Una inscripción sin fila de saldo se conserva. */
export function unirInscripciones(inscripciones, saldos, pausas){
  const porId = new Map((saldos || []).map(s => [s.inscripcion_id, s]));
  return (inscripciones || []).map(i => {
    const s = porId.get(i.id) || {};
    const sal = i.salida || {};
    const plan = sal.plan || {};
    return {
      id: i.id, estado: i.estado, titular_id: i.titular_id || null, codigo_reserva: i.codigo_reserva || null,
      plan_id: plan.id, tipo: plan.tipo, plan_nombre: plan.nombre || '',
      fecha_inicio: sal.fecha_inicio || null, fecha_fin: sal.fecha_fin || null,
      moneda: s.moneda || plan.moneda || 'COP',
      valor_acordado: s.valor_acordado, pagado: s.pagado, por_validar: s.por_validar, saldo: s.saldo,
      estado_mostrado: s.estado_mostrado || i.estado,
      pausa: (pausas && pausas[i.id]) || null,
      descuento_motivo: i.descuento_motivo || null,
      valor_sin_descuento: i.valor_sin_descuento == null ? null : i.valor_sin_descuento
    };
  }).sort((a, b) => String(b.fecha_inicio || '').localeCompare(String(a.fecha_inicio || '')) || String(a.id).localeCompare(String(b.id)));
}

const lleno = v => v != null && String(v).trim() !== '';

/* Requisitos que aplican a una inscripción, por requisito.orden. Uno «manual» está cumplido si la
   oficina lo marcó; uno «dato» se cumple con la columna `campo` del viajero (o de su ficha
   privada) no vacía: la misma regla que v_inscripcion_saldo. */
export function requisitosDeInscripcion(reqs, estados, insc, viajero, privado){
  const v = viajero || {}, p = privado || {};
  return (reqs || [])
    .filter(r => (r.plan_id == null || r.plan_id === insc.plan_id) && (r.aplica_tipo == null || r.aplica_tipo === insc.tipo))
    .sort((a, b) => (a.orden - b.orden) || String(a.id).localeCompare(String(b.id)))
    .map(r => {
      const e = (estados || []).find(x => x.inscripcion_id === insc.id && x.requisito_id === r.id);
      const cumplido = r.tipo === 'dato' ? (lleno(v[r.campo]) || lleno(p[r.campo])) : !!(e && e.cumplido);
      return {id: r.id, nombre: r.nombre, tipo: r.tipo, bloquea: !!r.bloquea, cumplido, nota: (e && e.nota) || ''};
    });
}

function corto(v){
  if(v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return s.length > 60 ? s.slice(0, 60) + '…' : s;
}

/* Qué campos cambiaron entre dos versiones de una fila (solo en una modificación). */
export function cambiosBitacora(antes, despues){
  if(!antes || !despues) return [];
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  return claves.filter(k => JSON.stringify(antes[k] ?? null) !== JSON.stringify(despues[k] ?? null))
    .map(k => ({campo: k, antes: corto(antes[k]), despues: corto(despues[k])}));
}

const ACCION = {INSERT: 'Creó', UPDATE: 'Cambió', DELETE: 'Borró'};
const TABLA = {viajero: 'el viajero', viajero_privado: 'sus datos privados', inscripcion: 'una inscripción', abono: 'un abono',
  abono_asignacion: 'el reparto de un abono', requisito_estado: 'un requisito', devolucion: 'una devolución',
  inscripcion_pausa: 'una pausa'};

function cuandoBogota(iso){
  try{
    return new Intl.DateTimeFormat('es-CO', {timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short'}).format(new Date(iso));
  }catch(e){ return String(iso || ''); }
}

export function renderBitacora(filas, actores){
  if(!filas || !filas.length) return '<p class="tenue">Sin movimientos registrados.</p>';
  const quien = (actores && actores) || {};
  return '<ul class="bitacora">' + filas.map(f => {
    const cambios = cambiosBitacora(f.antes, f.despues);
    return '<li><b>' + esc(ACCION[f.accion] || f.accion) + '</b> ' + esc(TABLA[f.tabla] || f.tabla) +
      ' <span class="tenue-s">' + esc(cuandoBogota(f.at)) + (f.actor && quien[f.actor] ? ' · ' + esc(quien[f.actor]) : '') + '</span>' +
      (cambios.length ? '<div class="cambios">' + cambios.map(c =>
        '<span>' + esc(c.campo) + ': ' + esc(c.antes || '—') + ' → ' + esc(c.despues || '—') + '</span>').join('') + '</div>' : '') +
      '</li>';
  }).join('') + '</ul>';
}

/* ── Invitación ── */

export function linkInvitacion(base, token){
  return base + 'index.html?invitacion=' + encodeURIComponent(token);
}

/* Sin nombre, documento ni saldos: el enlace basta. */
export function textoInvitacion(link){
  return 'Hola! Te invito a crear tu cuenta en Xperiencia para completar tu inscripción.\n\n' + link +
    '\n\nEntras con este enlace, creas tu contraseña y tu inscripción queda unida a tu cuenta. El enlace vence en 14 días.';
}

export function urlWaMe(texto){
  return 'https://wa.me/?text=' + encodeURIComponent(texto);
}

/* ── Pantalla ── */

const PIL_ABONO = {validado: ['Validado', 'verde'], por_validar: ['Por validar', 'amarillo'], rechazado: ['Rechazado', 'rojo']};
const PIL_INSC = {lista: ['Lista', 'verde'], confirmada: ['Confirmada', 'azul'], pendiente: ['Pendiente', 'gris'],
  cancelada: ['Cancelada', 'gris'], viajo: ['Viajó', 'gris']};

function datosViajero(v, p){
  const f = (rotulo, valor) => lleno(valor) ? '<div><dt>' + esc(rotulo) + '</dt><dd>' + esc(valor) + '</dd></div>' : '';
  const doc = [v.tipo_doc, v.num_doc].filter(lleno).join(' ');
  const pr = p || {};
  return '<dl class="datos">' +
    f('Documento', doc) + f('Nacimiento', v.nacimiento ? mesLargo(v.nacimiento) : '') + f('Celular', v.celular) +
    f('Correo', v.correo) + f('Ciudad', v.ciudad) + f('Instagram', v.instagram) + f('Talla', v.talla) + f('Dieta', v.dieta) +
    f('Contacto de emergencia', [pr.emergencia_nombre, pr.emergencia_parentesco, pr.emergencia_tel].filter(lleno).join(' · ')) +
    f('EPS', pr.eps) + f('RH', pr.rh) + f('Condición médica', pr.condicion) + f('Alergias', pr.alergias) + f('Medicamentos', pr.medicamentos) +
    '</dl>';
}

function renderRequisitos(insc, lista){
  if(!lista.length) return '';
  const filas = lista.map(r => {
    const a = idSeguro(insc.id), b = idSeguro(r.id);
    const caja = r.tipo === 'dato'
      ? '<input type="checkbox" disabled' + (r.cumplido ? ' checked' : '') + ' aria-label="Se cumple con los datos del viajero">'
      : '<input type="checkbox" class="req-check"' + (r.cumplido ? ' checked' : '') +
        (a && b ? ' onchange="marcarRequisito(\'' + a + '\',\'' + b + '\',this.checked)"' : ' disabled') + '>';
    return '<li><label>' + caja + '<span>' + esc(r.nombre) + '</span></label>' +
      (r.cumplido ? '<span class="etq ok">Listo</span>' : r.bloquea ? '<span class="etq alerta">Bloquea</span>' : '') +
      (r.tipo === 'dato' ? '<span class="tenue-s">se cumple con sus datos</span>' : '') +
      (r.nota ? '<span class="tenue-s">' + esc(r.nota) + '</span>' : '') + '</li>';
  }).join('');
  return '<div class="sub-titulo">Requisitos</div><ul class="reqs">' + filas + '</ul>';
}

/* Descuento del 5 %: con descuento, la línea y «Quitar»; sin él y con valor acordado, el motivo
   (por defecto «Cumpleaños») y «Aplicar». El valor ya rebajado viene de la base. */
function renderDescuento(i, a){
  if(i.descuento_motivo){
    return '<div class="linea">Descuento 5 % por ' + esc(i.descuento_motivo) + ' · antes ' +
      esc(fmtDinero(i.valor_sin_descuento, i.moneda)) + '</div>' +
      '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
      (a ? 'onclick="quitarDescuento(\'' + a + '\')"' : 'disabled') + '>Quitar descuento</button></div>';
  }
  if(i.valor_acordado == null) return '';
  return '<div class="descuento"><label for="desc-' + esc(i.id) + '">Motivo del descuento</label>' +
    '<input type="text" id="desc-' + esc(i.id) + '" value="Cumpleaños" maxlength="80"></div>' +
    '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
    (a ? 'onclick="aplicarDescuento(\'' + a + '\')"' : 'disabled') + '>Aplicar 5 % de descuento</button></div>';
}

/* Pausa con razón: con pausa, la etiqueta y «Quitar pausa»; sin ella, la razón y «Poner en pausa». */
function renderPausa(i, a){
  if(i.pausa){
    return '<div class="linea">' + etiquetaPausa(i.pausa) + '</div>' +
      '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
      (a ? 'onclick="quitarPausa(\'' + a + '\')"' : 'disabled') + '>Quitar pausa</button></div>';
  }
  return '<div class="descuento"><label for="pausa-' + esc(i.id) + '">Razón de la pausa</label>' +
    '<input type="text" id="pausa-' + esc(i.id) + '" maxlength="120"></div>' +
    '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
    (a ? 'onclick="pausarInscripcion(\'' + a + '\')"' : 'disabled') + '>Poner en pausa</button></div>';
}

function renderInscripcion(i, reqs){
  const est = PIL_INSC[i.estado_mostrado] || [i.estado_mostrado || '—', 'gris'];
  const cancelada = i.estado === 'cancelada';
  const a = idSeguro(i.id);
  const m = i.moneda;
  return '<div class="item' + (cancelada ? ' cancelada' : '') + '">' +
    '<h3>' + esc(i.plan_nombre) + ' <span class="pil ' + est[1] + '">' + esc(est[0]) + '</span>' +
    (i.titular_id ? ' <span class="etq">Acompañante</span>' : '') + '</h3>' +
    '<div class="cuando">' + esc(rangoFechas(i.fecha_inicio, i.fecha_fin)) +
    (i.codigo_reserva ? ' · Código ' + esc(i.codigo_reserva) : '') + '</div>' +
    '<dl class="cifras"><div><dt>Valor</dt><dd>' + esc(fmtDinero(i.valor_acordado, m)) + '</dd></div>' +
    '<div><dt>Pagado</dt><dd>' + esc(fmtDinero(i.pagado, m)) + '</dd></div>' +
    (Number(i.por_validar) > 0 ? '<div><dt>Por validar</dt><dd>' + esc(fmtDinero(i.por_validar, m)) + '</dd></div>' : '') +
    '<div><dt>Falta</dt><dd>' + (cancelada ? '—' : esc(fmtDinero(i.saldo, m))) + '</dd></div></dl>' +
    (cancelada ? '' : renderDescuento(i, a) + renderPausa(i, a)) +
    renderRequisitos(i, cancelada ? [] : reqs) +
    '<div class="acciones">' +
    (VOUCHER_DISPONIBLE
      ? '<a class="btn chico fantasma" href="voucher.html?i=' + encodeURIComponent(i.id) + '">Ver voucher</a>'
      : '<button type="button" class="btn chico fantasma" onclick="avisarVoucher()">Ver voucher</button>') +
    (!cancelada ? '<button type="button" class="btn chico fantasma" ' +
      (a ? 'onclick="irCancelacion(\'' + a + '\')"' : 'disabled') + '>Cancelar esta inscripción</button>' : '') +
    '</div></div>';
}

function renderAbonoFicha(a){
  const est = PIL_ABONO[a.estado] || [a.estado, 'gris'];
  const seguro = idSeguro(a.id);
  const para = (a.paraEsta || []).map(x => fmtDinero(x.monto, x.moneda)).join(' y ');
  return '<div class="item">' +
    '<h3>' + esc(fmtDinero(a.monto, a.moneda)) + ' <span class="pil ' + est[1] + '">' + esc(est[0]) + '</span></h3>' +
    '<div class="cuando">' + [a.fecha ? mesLargo(a.fecha) : 'Sin fecha', a.medio, a.cuenta].filter(Boolean).map(esc).join(' · ') + '</div>' +
    '<div class="linea">Paga: <b>' + esc(a.pagador || '—') + '</b>' + (para ? ' · Para esta persona: <b>' + esc(para) + '</b>' : '') +
    (a.trm != null ? ' · TRM ' + esc(a.trm) : '') + '</div>' +
    (a.estado === 'rechazado' && a.motivo ? '<div class="linea">Motivo del rechazo: ' + esc(a.motivo) + '</div>' : '') +
    (a.path ? '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
      (seguro ? 'onclick="verComprobante(\'' + seguro + '\')"' : 'disabled') + '>Ver comprobante</button></div>'
      : '<div class="tenue-s">Sin comprobante.</div>') +
    '</div>';
}

/* La ficha completa. d = {viajero, privado, duplicados, inscripciones (ya unidas), abonos,
   requisitos: {inscripcion_id: [...]}, bitacora, actores}. */
export function renderFicha(d){
  const v = d.viajero;
  const seguro = idSeguro(v.id);
  const invitar = v.user_id
    ? '<p class="tenue-s">Ya tiene cuenta en la app.</p>'
    : '<button type="button" class="btn chico fantasma" ' +
      (seguro ? 'onclick="mandarInvitacion(\'' + seguro + '\')"' : 'disabled') + '>Mandar invitación</button>';
  return '<div class="cejilla">Viajero</div><h1>' + esc(v.nombre) + '</h1>' +
    avisoDocumento(d.duplicados) +
    '<div class="acciones">' +
    '<button type="button" class="btn chico" ' + (seguro ? 'onclick="irAbono(\'' + seguro + '\')"' : 'disabled') + '>Registrar abono a mano</button>' +
    invitar + '</div>' +
    '<div id="cajaInvitacion"></div>' +
    datosViajero(v, d.privado) +
    '<h2>Inscripciones</h2>' +
    ((d.inscripciones || []).map(i => renderInscripcion(i, (d.requisitos || {})[i.id] || [])).join('') ||
      '<p class="tenue">Todavía no tiene inscripciones.</p>') +
    '<h2>Abonos</h2>' +
    ((d.abonos || []).map(renderAbonoFicha).join('') || '<p class="tenue">Todavía no tiene abonos.</p>') +
    '<h2>Bitácora</h2>' + renderBitacora(d.bitacora, d.actores);
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

const el = id => document.getElementById(id);
const busquedas = generacion();   // una respuesta lenta del buscador no pisa a una más nueva
const cargas = generacion();      // ni una ficha lenta a otra
let pathsAbono = {};              // abono_id -> ruta en Storage (nunca la URL firmada)
let invitacionActual = '';
let fichaId = null;

export function abrirFicha(id){ return irA('ficha', id); }

async function buscarAhora(){
  const campo = el('busca');
  const caja = el('cajaResultados');
  if(!campo || !caja) return;
  const texto = textoBuscable(campo.value);
  const mia = busquedas.nueva();
  if(texto === null){ caja.innerHTML = ''; return; }
  try{
    const filas = await rpc('buscar_viajero', {p_texto: texto});
    if(!busquedas.vigente(mia)) return;
    caja.innerHTML = renderResultados(filas || []);
  }catch(e){
    if(busquedas.vigente(mia)) caja.innerHTML = '<div class="error">No pudimos buscar: ' + esc(mensajeDeError(e)) + '</div>';
  }
}

/* Handler de oninput: espera a que la persona termine de teclear. */
export const buscarViajeros = retrasar(buscarAhora, 250);

/* Se entra con un id de viajero (viene de un resultado, de la tabla de una salida o de otra vista)
   o sin nada (la pestaña «Viajeros»: queda el buscador listo). */
export async function entrarFicha(id){
  const campo = el('busca');
  if(!id){
    if(campo) campo.focus();
    return;
  }
  fichaId = id;
  await cargarFicha(id);
}

async function datosDeFicha(id){
  const q = (r) => { if(r.error) throw new Error(r.error.message); return r.data; };
  const [v, vp, insc, saldos, reqs, abonosPagador] = await Promise.all([
    supa.from('viajero').select('*').eq('id', id).maybeSingle().then(q),
    supa.from('viajero_privado').select('*').eq('viajero_id', id).maybeSingle().then(q),
    supa.from('inscripcion').select('id, estado, titular_id, codigo_reserva, descuento_motivo, valor_sin_descuento, salida:salida(fecha_inicio, fecha_fin, plan:plan(id, nombre, tipo, moneda))')
      .eq('viajero_id', id).then(q),
    supa.from('v_inscripcion_saldo').select('*').eq('viajero_id', id).then(q),
    supa.from('requisito').select('*').then(q),
    supa.from('abono').select(SEL_ABONO).eq('pagador_viajero_id', id).then(q)
  ]);
  if(!v) throw new Error('No encontramos a esa persona.');
  const inscIds = (insc || []).map(i => i.id);

  const [dup, estados, asignadas, devs, pausas] = await Promise.all([
    lleno(v.num_doc) ? supa.from('viajero').select('id, nombre').eq('num_doc', v.num_doc).neq('id', id).limit(10).then(q) : Promise.resolve([]),
    inscIds.length ? supa.from('requisito_estado').select('*').in('inscripcion_id', inscIds).then(q) : Promise.resolve([]),
    inscIds.length ? supa.from('abono_asignacion').select('monto, inscripcion_id, abono:abono(' + SEL_ABONO + ')').in('inscripcion_id', inscIds).then(q) : Promise.resolve([]),
    inscIds.length ? supa.from('devolucion').select('id').in('inscripcion_id', inscIds).then(q) : Promise.resolve([]),
    inscIds.length ? supa.from('inscripcion_pausa').select('inscripcion_id, razon').in('inscripcion_id', inscIds).then(q) : Promise.resolve([])
  ]);

  const inscUnidas = unirInscripciones(insc, saldos, Object.fromEntries((pausas || []).map(p => [p.inscripcion_id, p.razon])));
  const monedaDe = Object.fromEntries(inscUnidas.map(i => [i.id, i.moneda]));

  // Abonos que paga esta persona + abonos asignados a sus inscripciones (los pague quien los pague).
  const porId = new Map();
  for(const a of abonosPagador || []) porId.set(a.id, {...fila(a), paraEsta: []});
  for(const x of asignadas || []){
    if(!x.abono) continue;
    if(!porId.has(x.abono.id)) porId.set(x.abono.id, {...fila(x.abono), paraEsta: []});
    porId.get(x.abono.id).paraEsta.push({monto: x.monto, moneda: monedaDe[x.inscripcion_id] || 'COP'});
  }
  const abonos = [...porId.values()].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || String(a.id).localeCompare(String(b.id)));

  const filasIds = [id, ...inscIds, ...abonos.map(a => a.id), ...(devs || []).map(x => x.id)];
  const [bit, bitReq] = await Promise.all([
    supa.from('bitacora').select('id, at, actor, tabla, fila_id, accion, antes, despues').in('fila_id', filasIds)
      .order('at', {ascending: false}).limit(60).then(q),
    inscIds.length ? supa.from('bitacora').select('id, at, actor, tabla, fila_id, accion, antes, despues').eq('tabla', 'requisito_estado')
      .in('despues->>inscripcion_id', inscIds).order('at', {ascending: false}).limit(30).then(q) : Promise.resolve([])
  ]);
  const bitacora = [...(bit || []), ...(bitReq || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)) || b.id - a.id).slice(0, 60);
  const actoresIds = [...new Set(bitacora.map(b => b.actor).filter(Boolean))];
  const actores = {};
  if(actoresIds.length){
    const p = await supa.from('perfil').select('user_id, nombre').in('user_id', actoresIds);
    if(!p.error) for(const x of p.data || []) if(x.nombre) actores[x.user_id] = x.nombre;
  }

  const requisitos = {};
  for(const i of inscUnidas) requisitos[i.id] = requisitosDeInscripcion(reqs, estados, i, v, vp);
  return {viajero: v, privado: vp, duplicados: dup || [], inscripciones: inscUnidas, abonos, requisitos, bitacora, actores};
}

const SEL_ABONO = 'id, monto, moneda, trm, fecha, medio, cuenta_id, estado, motivo_rechazo, comprobante_path, ' +
  'pagador:viajero!pagador_viajero_id(nombre)';

function fila(a){
  return {id: a.id, pagador: (a.pagador && a.pagador.nombre) || '', monto: a.monto, moneda: a.moneda, trm: a.trm == null ? null : a.trm,
    fecha: a.fecha || null, medio: a.medio || '', cuenta: a.cuenta_id || '', estado: a.estado, motivo: a.motivo_rechazo || null,
    path: a.comprobante_path || null};
}

export async function cargarFicha(id){
  const caja = el('cajaFicha');
  const mia = cargas.nueva();
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const d = await datosDeFicha(id);
    if(!cargas.vigente(mia)) return;
    pathsAbono = Object.fromEntries(d.abonos.filter(a => a.path).map(a => [a.id, a.path]));
    invitacionActual = '';
    caja.innerHTML = renderFicha(d);
  }catch(e){
    if(cargas.vigente(mia)) caja.innerHTML = '<div class="error">No pudimos abrir la ficha: ' + esc(mensajeDeError(e)) + '</div>';
  }
}

/* Casilla de un requisito manual. Se recarga la ficha: lo que se ve es lo que quedó en la base. */
export async function marcarRequisito(insc, req, cumplido){
  document.querySelectorAll('#cajaFicha .req-check').forEach(c => { c.disabled = true; });
  try{
    await rpc('marcar_requisito', {p_inscripcion: insc, p_requisito: req, p_cumplido: !!cumplido});
    avisar(cumplido ? 'Requisito marcado.' : 'Requisito desmarcado.');
  }catch(e){
    avisar('No se pudo guardar: ' + mensajeDeError(e), true);
  }
  if(fichaId) await cargarFicha(fichaId);
}

/* Descuento del 5 %: la base hace la cuenta; aquí se avisa y se recarga lo que quedó. */
export async function aplicarDescuento(insc){
  const campo = el('desc-' + insc);
  await guardarCambio('aplicar_descuento', {p_inscripcion: insc, p_motivo: campo ? campo.value : ''}, 'Descuento aplicado.');
}

export async function pausarInscripcion(insc){
  const campo = el('pausa-' + insc);
  const razon = campo ? campo.value.trim() : '';
  if(!razon) return avisar('Escribe la razón de la pausa', true);
  await guardarCambio('pausar_inscripcion', {p_inscripcion: insc, p_razon: razon}, 'Inscripción en pausa.');
}

export async function quitarPausa(insc){
  await guardarCambio('quitar_pausa', {p_inscripcion: insc}, 'Pausa quitada.');
}

export async function quitarDescuento(insc){
  await guardarCambio('quitar_descuento', {p_inscripcion: insc}, 'Descuento quitado.');
}

async function guardarCambio(nombre, args, ok){
  try{
    await rpc(nombre, args);
    avisar(ok);
  }catch(e){
    avisar('No se pudo guardar: ' + mensajeDeError(e), true);
  }
  if(fichaId) await cargarFicha(fichaId);
}

/* El comprobante se firma al hacer clic (10 minutos) y la URL no se guarda en ningún lado.
   La ventana se abre antes del await para que el navegador no la tome por una ventana emergente. */
export async function verComprobante(abonoId){
  const path = pathsAbono[abonoId];
  if(!path) return avisar('Este abono no tiene comprobante.', true);
  const w = window.open('', '_blank');
  try{
    const u = await supa.storage.from('comprobantes').createSignedUrl(path, 600);
    if(u.error || !u.data) throw new Error(u.error ? u.error.message : 'sin URL');
    if(w){ w.opener = null; w.location.href = u.data.signedUrl; }
    else avisar('Tu navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo otra vez.', true);
  }catch(e){
    if(w) w.close();
    avisar('No pudimos abrir el comprobante: ' + mensajeDeError(e), true);
  }
}

export function avisarVoucher(){
  avisar('El voucher todavía no está disponible: llega en la siguiente entrega.', true);
}

export const mandarInvitacion = unaSolaVez(async function(viajeroId){
  const caja = el('cajaInvitacion');
  try{
    const token = await rpc('crear_invitacion', {p_viajero: viajeroId});
    invitacionActual = linkInvitacion(baseApp(location.href), token);
    caja.innerHTML = '<div class="tarjeta"><div class="cejilla">Enlace de invitación</div>' +
      '<p class="pista" style="word-break:break-all;line-height:1.7">' + esc(invitacionActual) + '</p>' +
      '<p class="pista">Vale 14 días. Quien lo abra crea su cuenta y queda unido a esta ficha.</p>' +
      '<div class="acciones"><button type="button" class="btn chico" onclick="copiarInvitacion()">Copiar el enlace</button>' +
      '<button type="button" class="btn chico fantasma" onclick="invitacionWhatsApp()">Mandarlo por WhatsApp</button></div>' +
      '<div id="invitacionManual" class="copia-manual"></div></div>';
  }catch(e){
    caja.innerHTML = '<div class="error">No se pudo crear la invitación: ' + esc(mensajeDeError(e)) + '</div>';
  }
});

export async function copiarInvitacion(){
  if(!invitacionActual) return;
  if(await copiarTexto(invitacionActual)) return avisar('Enlace copiado. Pégalo en el chat de la persona.');
  el('invitacionManual').innerHTML = '<div class="aviso">Tu navegador no dejó copiar. Selecciona el enlace de arriba y cópialo a mano.</div>';
}

export function invitacionWhatsApp(){
  if(!invitacionActual) return;
  window.open(urlWaMe(textoInvitacion(invitacionActual)), '_blank', 'noopener');
}

/* Desde la ficha se va a registrar un abono a mano o a cancelar una inscripción. */
export function irAbono(viajeroId){ return irA('abono', {pagador: viajeroId}); }
export function irCancelacion(inscripcionId){ return irA('cancelacion', {inscripcion: inscripcionId}); }
