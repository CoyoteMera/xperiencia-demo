/* Viajeros: la lista de todos los registrados (con buscador y filtros) y la ficha de cada uno:
   datos, inscripciones con saldo, abonos con su comprobante, requisitos con casillas, voucher e
   invitación. La bitácora se sigue guardando en la base, pero la ficha solo la muestra en modo
   técnico (oficina.html?tecnico). Funciones puras arriba (se prueban
   en Node) y, al final, las que tocan DOM y red. NO se calcula dinero aquí: saldo, pagado y
   por validar vienen de v_inscripcion_saldo y los montos de cada abono, tal cual. */
import { supa, rpc, errorDeBase, falloDe } from '../comun/supa.js';
import { esc, idSeguro, fmtDinero, mesLargo, avisar, etiquetaPausa, semaforoInscripcion, hoyBogota } from '../comun/util.js';
import { copiarTexto } from '../comun/portapapeles.js';
import { unaSolaVez, generacion, retrasar } from '../comun/guardia.js';
import { baseApp, rangoFechas } from './salidas.js';
import { irA } from './nav.js';
import { abrirComprobanteFirmado } from './comprobante.js';

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
      '<span class="tenue-s">' + (f.proxima_salida ? 'Próxima salida: ' + esc(proximaLegible(f.proxima_salida)) : 'Sin salida próxima') + '</span></button>';
  }).join('') + '</div>';
}

/* «Plan · 2026-12-13» (como lo da buscar_viajero) -> «Plan · 13 de diciembre de 2026». */
export function proximaLegible(texto){
  if(texto == null) return '';
  return String(texto).replace(/(\d{4}-\d{2}-\d{2})$/, f => mesLargo(f).replace(/^\S+ /, ''));
}

/* ── Lista de viajeros ── */

const plano = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const digitos = s => String(s == null ? '' : s).replace(/\D/g, '');

/* Viajeros + sus inscripciones no canceladas en salidas próximas -> una fila por persona, por
   nombre. `salidas` son filas de v_salida_resumen (de hoy en adelante); `saldos`, de
   v_inscripcion_saldo. Cada persona lleva sus próximas salidas, la más cercana primero. */
export function armarListaViajeros(viajeros, saldos, salidas){
  const salidaDe = new Map((salidas || []).map(s => [s.salida_id, s]));
  const proximas = {};
  for(const s of saldos || []){
    if(s.estado_mostrado === 'cancelada') continue;
    const sal = salidaDe.get(s.salida_id);
    if(!sal) continue;
    (proximas[s.viajero_id] = proximas[s.viajero_id] || []).push({salida_id: s.salida_id, plan_nombre: sal.plan_nombre,
      fecha_inicio: sal.fecha_inicio, estado: s.estado_mostrado, req_pendientes: s.req_pendientes == null ? null : s.req_pendientes});
  }
  return (viajeros || []).map(v => ({
    id: v.id, nombre: v.nombre || '', num_doc: v.num_doc || '', celular: v.celular || '',
    proximas: (proximas[v.id] || []).sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)))
  })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es') || String(a.id).localeCompare(String(b.id)));
}

/* Filtra la lista. texto: parte del nombre (sin importar tildes ni mayúsculas), del documento o del
   celular (solo los dígitos, desde 3). salida: '' todas, 'ninguna' sin salida próxima, o el id de
   una salida. estado: '' todos o el estado de la inscripción (en la salida elegida, si hay una). */
export function filtrarViajeros(lista, filtros){
  const {texto = '', salida = '', estado = ''} = filtros || {};
  const t = plano(texto).trim();
  const d = digitos(texto);
  return (lista || []).filter(v => {
    if(t && !(plano(v.nombre).includes(t) || plano(v.num_doc).includes(t) || (d.length >= 3 && digitos(v.celular).includes(d)))) return false;
    if(salida === 'ninguna') return v.proximas.length === 0 && !estado;
    const enJuego = salida ? v.proximas.filter(p => p.salida_id === salida) : v.proximas;
    if(salida && !enJuego.length) return false;
    if(estado && !enJuego.some(p => p.estado === estado)) return false;
    return true;
  });
}

/* Opciones del filtro de salida: todas, sin salida próxima y cada salida próxima. */
export function opcionesSalida(salidas, elegida){
  const op = (valor, texto) => '<option value="' + esc(valor) + '"' + (valor === elegida ? ' selected' : '') + '>' + esc(texto) + '</option>';
  return op('', 'Todas') + op('ninguna', 'Sin salida próxima') +
    (salidas || []).map(s => op(s.salida_id, proximaLegible(s.plan_nombre + ' · ' + s.fecha_inicio))).join('');
}

export const TOPE_LISTA = 200;

/* La lista ya filtrada. `total` es cuántos viajeros hay registrados. Se pintan a lo sumo
   TOPE_LISTA; si hay más, se pide afinar la búsqueda. */
export function renderListaViajeros(filas, total){
  if(!total) return '<p class="tenue">Todavía no hay viajeros registrados.</p>';
  if(!filas.length) return '<p class="tenue">Ningún viajero coincide. Prueba con otra parte del nombre, el documento o el celular, o cambia los filtros.</p>';
  const vistas = filas.slice(0, TOPE_LISTA);
  const conteo = filas.length === total ? total + (total === 1 ? ' viajero' : ' viajeros')
    : filas.length + ' de ' + total + ' viajeros';
  return '<p class="tenue-s conteo">' + esc(conteo) +
    (filas.length > TOPE_LISTA ? ' · se ven los primeros ' + TOPE_LISTA + ', afina la búsqueda para ver el resto' : '') + '</p>' +
    '<div class="resultados">' + vistas.map(v => {
      const seguro = idSeguro(v.id);
      const datos = [v.num_doc, v.celular].filter(Boolean).map(esc).join(' · ');
      const p = v.proximas[0];
      const est = p ? semaforoInscripcion(p.estado, p.req_pendientes) : null;
      return '<button type="button" class="resultado"' + (seguro ? ' onclick="abrirFicha(\'' + seguro + '\')"' : ' disabled') + '>' +
        '<b>' + esc(v.nombre) + '</b>' + (datos ? '<span>' + datos + '</span>' : '') +
        (p ? '<span class="tenue-s">Próxima salida: ' + esc(proximaLegible(p.plan_nombre + ' · ' + p.fecha_inicio)) +
             (v.proximas.length > 1 ? ' y ' + (v.proximas.length - 1) + ' más' : '') + '</span>' +
             '<span class="pil ' + est[1] + '">' + esc(est[0]) + '</span>'
           : '<span class="tenue-s">Sin salida próxima</span>') +
        '</button>';
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
      estado_mostrado: s.estado_mostrado || i.estado, req_pendientes: s.req_pendientes == null ? null : s.req_pendientes,
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

/* Los estados con las palabras de la app; los que no están aquí ya se leen tal cual. */
const ESTADO_LEGIBLE = {por_validar: 'por validar', viajo: 'viajó'};
const legible = (k, v) => (k === 'estado' && typeof v === 'string' && ESTADO_LEGIBLE[v]) || v;

/* Qué campos cambiaron entre dos versiones de una fila (solo en una modificación). Sin
   identificadores ni marcas de tiempo: los campos *_por, *_id y *_at no se listan. */
export function cambiosBitacora(antes, despues){
  if(!antes || !despues) return [];
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter(k => !/_(por|id|at)$/.test(k));
  return claves.filter(k => JSON.stringify(antes[k] ?? null) !== JSON.stringify(despues[k] ?? null))
    .map(k => ({campo: k, antes: corto(legible(k, antes[k])), despues: corto(legible(k, despues[k]))}));
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
      (r.tipo === 'dato' ? '<span class="tenue-s">' + (r.cumplido ? 'listo con sus datos' : 'falta en sus datos') + '</span>' : '') +
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
  const est = semaforoInscripcion(i.estado_mostrado, i.req_pendientes);
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
    (a.estado === 'validado' && Number(a.sinRepartir) > 0 ? '<div class="linea">Sin repartir: <b>' + esc(fmtDinero(a.sinRepartir, a.moneda)) + '</b></div>' : '') +
    (a.estado === 'rechazado' && a.motivo ? '<div class="linea">Motivo del rechazo: ' + esc(a.motivo) + '</div>' : '') +
    (a.estado === 'rechazado' && (a.para || []).length ? '<div class="linea">Era para: <b>' + esc(a.para.join(', ')) + '</b></div>' : '') +
    (a.path ? '<div class="acciones"><button type="button" class="btn chico fantasma" ' +
      (seguro ? 'onclick="verComprobante(\'' + seguro + '\')"' : 'disabled') + '>Ver comprobante</button></div>'
      : '<div class="tenue-s">Sin comprobante.</div>') +
    '</div>';
}

/* La ficha completa. d = {viajero, privado, duplicados, inscripciones (ya unidas), abonos,
   requisitos: {inscripcion_id: [...]}, bitacora, actores, tecnico}. La bitácora solo sale con
   `tecnico` (oficina.html?tecnico): es para revisar cambios, no para el día a día. */
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
    (d.tecnico ? '<h2>Bitácora <span class="etq">Modo técnico</span></h2>' + renderBitacora(d.bitacora, d.actores) : '');
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

const el = id => document.getElementById(id);
const listas = generacion();      // una lista lenta no pisa a una más nueva
const cargas = generacion();      // ni una ficha lenta a otra
let lista = null;                 // {viajeros: armarListaViajeros(...), salidas}
/* Modo técnico: con ?tecnico en la dirección, la ficha trae y muestra la bitácora. */
const modoTecnico = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('tecnico');
let pathsAbono = {};              // abono_id -> ruta en Storage (nunca la URL firmada)
let invitacionActual = '';
let fichaId = null;

export function abrirFicha(id){ return irA('ficha', id); }

/* Pinta la lista con lo que haya en el buscador y los filtros. */
function pintarLista(){
  const caja = el('cajaResultados');
  if(!caja || !lista) return;
  const filtros = {texto: (el('busca') || {}).value || '', salida: (el('filtroSalida') || {}).value || '',
    estado: (el('filtroEstado') || {}).value || ''};
  caja.innerHTML = renderListaViajeros(filtrarViajeros(lista.viajeros, filtros), lista.viajeros.length);
}

/* Handler de oninput/onchange: espera a que la persona termine de teclear. */
export const buscarViajeros = retrasar(pintarLista, 150);

/* Todas las filas de una consulta, de 1000 en 1000 (la base no entrega más de una vez). */
async function todas(armar){
  const filas = [];
  for(let desde = 0; ; desde += 1000){
    const r = await armar().range(desde, desde + 999);
    if(r.error) throw errorDeBase(r.error);
    filas.push(...(r.data || []));
    if((r.data || []).length < 1000) return filas;
  }
}

async function datosDeLista(){
  const sal = await supa.from('v_salida_resumen').select('salida_id, plan_nombre, fecha_inicio')
    .gte('fecha_inicio', hoyBogota()).order('fecha_inicio');
  if(sal.error) throw errorDeBase(sal.error);
  const salidas = sal.data || [];
  const ids = salidas.map(s => s.salida_id);
  const [viajeros, saldos] = await Promise.all([
    todas(() => supa.from('viajero').select('id, nombre, num_doc, celular').order('nombre').order('id')),
    ids.length ? todas(() => supa.from('v_inscripcion_saldo').select('inscripcion_id, viajero_id, salida_id, estado_mostrado, req_pendientes')
      .in('salida_id', ids).order('inscripcion_id')) : Promise.resolve([])
  ]);
  return {viajeros: armarListaViajeros(viajeros, saldos, salidas), salidas};
}

/* Carga (o recarga) la lista. Lo escrito en el buscador y los filtros se conserva. */
async function cargarLista(){
  const caja = el('cajaResultados');
  const mia = listas.nueva();
  if(!lista) caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const d = await datosDeLista();
    if(!listas.vigente(mia)) return;
    lista = d;
    const sel = el('filtroSalida');
    if(sel){
      const antes = sel.value;
      sel.innerHTML = opcionesSalida(d.salidas, antes);
      if(sel.value !== antes) sel.value = '';
    }
    pintarLista();
  }catch(e){
    if(listas.vigente(mia)) caja.innerHTML = '<div class="error">' + esc(falloDe(e, 'cargar la lista')) + '</div>';
  }
}

/* Se entra con un id de viajero (viene de la lista, de la tabla de una salida, del Panel Global o
   de otra vista) y se ve su ficha; o sin nada (la pestaña «Viajeros») y se ve la lista. */
export async function entrarFicha(id){
  const enLista = !id;
  if(el('cajaLista')) el('cajaLista').hidden = !enLista;
  if(el('vistaFicha')) el('vistaFicha').hidden = enLista;
  if(enLista){
    fichaId = null;
    await cargarLista();
    return;
  }
  fichaId = id;
  await cargarFicha(id);
}

async function datosDeFicha(id){
  const q = (r) => { if(r.error) throw errorDeBase(r.error); return r.data; };
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

  // Lo que quedó sin repartir de cada abono lo calcula la base (v_abono_sin_repartir, con la TRM).
  const abonoIds = abonos.map(a => a.id);
  let sinRep = [];
  if(abonoIds.length){
    try{
      sinRep = await supa.from('v_abono_sin_repartir').select('abono_id, sin_repartir').in('abono_id', abonoIds).then(q);
    }catch(e){
      console.warn('No se pudo leer lo sin repartir de los abonos', e);   // dato informativo: la ficha abre sin él
    }
  }
  const sinRepDe = new Map((sinRep || []).map(x => [x.abono_id, x.sin_repartir]));
  for(const a of abonos) a.sinRepartir = sinRepDe.has(a.id) ? sinRepDe.get(a.id) : null;

  const requisitos = {};
  for(const i of inscUnidas) requisitos[i.id] = requisitosDeInscripcion(reqs, estados, i, v, vp);
  const base = {viajero: v, privado: vp, duplicados: dup || [], inscripciones: inscUnidas, abonos, requisitos};
  if(!modoTecnico()) return {...base, bitacora: [], actores: {}, tecnico: false};

  // Solo en modo técnico: la bitácora de la persona, sus inscripciones, abonos y devoluciones.
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

  return {...base, bitacora, actores, tecnico: true};
}

const SEL_ABONO = 'id, monto, moneda, trm, fecha, medio, cuenta_id, cuenta:cuenta(nombre), estado, motivo_rechazo, comprobante_path, ' +
  'pagador:viajero!pagador_viajero_id(nombre), asignaciones:abono_asignacion(inscripcion:inscripcion(viajero:viajero(nombre)))';

/* Para quién era el abono: los nombres de su reparto, sin repetir. */
function nombresDelReparto(a){
  const nombres = (a.asignaciones || []).map(x => x && x.inscripcion && x.inscripcion.viajero && x.inscripcion.viajero.nombre).filter(Boolean);
  return [...new Set(nombres)];
}

function fila(a){
  return {id: a.id, pagador: (a.pagador && a.pagador.nombre) || '', monto: a.monto, moneda: a.moneda, trm: a.trm == null ? null : a.trm,
    fecha: a.fecha || null, medio: a.medio || '', cuenta: (a.cuenta && a.cuenta.nombre) || a.cuenta_id || '', estado: a.estado, motivo: a.motivo_rechazo || null,
    path: a.comprobante_path || null, para: nombresDelReparto(a)};
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
    if(cargas.vigente(mia)) caja.innerHTML = '<div class="error">' + esc(falloDe(e, 'abrir la ficha')) + '</div>';
  }
}

/* Casilla de un requisito manual. Se recarga la ficha: lo que se ve es lo que quedó en la base. */
export async function marcarRequisito(insc, req, cumplido){
  document.querySelectorAll('#cajaFicha .req-check').forEach(c => { c.disabled = true; });
  try{
    await rpc('marcar_requisito', {p_inscripcion: insc, p_requisito: req, p_cumplido: !!cumplido});
    avisar(cumplido ? 'Requisito marcado.' : 'Requisito desmarcado.');
  }catch(e){
    avisar(falloDe(e, 'guardar'), true);
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
    avisar(falloDe(e, 'guardar'), true);
  }
  if(fichaId) await cargarFicha(fichaId);
}

/* El comprobante se firma al hacer clic (ver comprobante.js); aquí solo se busca la ruta del abono. */
export function verComprobante(abonoId){
  return abrirComprobanteFirmado(pathsAbono[abonoId]);
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
    caja.innerHTML = '<div class="error">' + esc(falloDe(e, 'crear la invitación')) + '</div>';
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
