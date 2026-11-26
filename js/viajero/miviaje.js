/* «Mi viaje»: mis inscripciones con su saldo, mis acompañantes y la subida de comprobantes.
   Todos los montos vienen de Postgres (v_inscripcion_saldo, mis_acompanantes): aquí solo se
   les da formato. El navegador no suma abonos ni resta saldos. */
import { E } from './estado.js';
import { PLANES } from './catalogo.js';
import { abonoUno, pctAbono } from './inscribir.js';
import { subirComprobante, validarArchivo, parsearMonto } from './comprobantes.js';
import { recargarMiViaje } from './sync.js';
import { textoRechazo } from './guia.js';
import { ir } from './nav.js';
import { supa, mensajeDeError } from '../comun/supa.js';
import { mostrarError, marcarCampos, cargando, esc, fmtDinero, fmtMoneda, mesLargo, faltanDias, hoyBogota } from '../comun/util.js';

const ESTADOS = {
  pendiente: 'Pendiente de abono', confirmada: 'Confirmada', lista: 'Lista para ir',
  viajo: 'Ya viajaste', cancelada: 'Cancelada'
};
/* El voucher aparece cuando se valida el primer abono (voucher.html, Tarea 10). */
const CON_VOUCHER = ['confirmada', 'lista', 'viajo'];

/* Primero lo que viene (por fecha), después lo ya viajado y lo cancelado. */
function ordenadas(ins){
  const peso = i => (i.estado_mostrado === 'viajo' || i.estado_mostrado === 'cancelada') ? 1 : 0;
  return ins.slice().sort((a, b) =>
    peso(a) - peso(b) ||
    (peso(a) ? -1 : 1) * String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)));
}

function cifra(rotulo, valor, extra){
  return '<div class="cifra-m' + (extra ? ' ' + extra : '') + '"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
}

/* Los comprobantes rechazados de esta inscripción y de mis acompañantes (no cancelados) en ella. */
function rechazos(i, acomp){
  const lista = E.RECHAZOS || [];
  const mios = lista.filter(r => r.inscripcion_id === i.inscripcion_id).map(r => textoRechazo(r));
  const suyos = acomp.filter(a => a.estado !== 'cancelada').flatMap(a =>
    lista.filter(r => r.inscripcion_id === a.inscripcion_id).map(r => textoRechazo(r, a.nombre)));
  return mios.concat(suyos).map(t => '<p class="pista rechazo">' + esc(t) + '</p>').join('');
}

/* Lo que falta para quedar listo. Con la lista de la base (mis_requisitos_pendientes), cada uno por
   su nombre, los obligatorios primero; sin ella (demo, o no se pudo cargar), la cuenta de siempre. */
function requisitos(i){
  const lista = (E.REQUISITOS || []).filter(r => r.inscripcion_id === i.inscripcion_id);
  if(lista.length){
    const orden = lista.map((r, n) => [r, n]).sort((a, b) => (b[0].bloquea ? 1 : 0) - (a[0].bloquea ? 1 : 0) || a[1] - b[1]);
    return '<div class="pista requisitos"><p>Te falta para quedar listo:</p><ul>' + orden.map(([r]) =>
      '<li><b>' + esc(r.nombre) + '</b>' + (r.bloquea ? ' · obligatorio' : '') + ' · ' +
      (r.es_dato
        ? '<button type="button" class="enlace" onclick="ir(\'pDatos\')">Complétalo en «Tus datos»</button>'
        : 'lo gestiona la oficina') + '</li>').join('') + '</ul></div>';
  }
  if(!(i.req_pendientes > 0)) return '';
  return '<p class="pista">Te ' + (i.req_pendientes === 1 ? 'falta 1 requisito' : 'faltan ' + i.req_pendientes + ' requisitos') +
    (i.req_bloqueantes_pendientes > 0
      ? ' (' + (i.req_bloqueantes_pendientes === 1 ? '1 es obligatorio' : i.req_bloqueantes_pendientes + ' son obligatorios') + ')'
      : '') + ' para quedar listo.</p>';
}

/* Una fila de «Tus acompañantes»: valor, saldo, lo que está por validar y si se canceló. */
function filaAcompanante(a){
  return '<div class="acomp-m"><b>' + esc(a.nombre) + '</b><span>Valor ' + fmtDinero(a.valor_acordado, a.moneda) +
    ' · Saldo ' + fmtDinero(a.saldo, a.moneda) +
    (a.estado !== 'cancelada' && Number(a.por_validar) > 0 ? ' · Por validar: ' + fmtDinero(a.por_validar, a.moneda) : '') +
    '</span>' + (a.estado === 'cancelada' ? '<span class="nota-cancelada">Cancelada</span>' : '') + '</div>';
}

function tarjeta(i, hoy){
  const m = i.moneda;
  const estado = ESTADOS[i.estado_mostrado] || i.estado_mostrado;
  const activa = i.estado_mostrado !== 'cancelada' && i.estado_mostrado !== 'viajo';
  const acomp = i.titular_id ? [] : (E.ACOMPANANTES || []).filter(a => a.salida_id === i.salida_id);
  const saldoNeg = Number(i.saldo) < 0;
  const cuenta = faltanDias(i.fecha_inicio, hoy);

  return '<div class="grupo miviaje' + (i.estado_mostrado === 'lista' ? ' mio' : '') + '">' +
    '<h3>' + esc(i.plan_nombre) + '</h3>' +
    '<div class="cuando">' + mesLargo(i.fecha_inicio) + (cuenta && activa ? ' <em>· ' + cuenta + '</em>' : '') +
      (i.codigo_reserva ? ' · Reserva ' + esc(i.codigo_reserva) : '') + '</div>' +
    '<div class="faltan e-' + esc(i.estado_mostrado) + (i.estado_mostrado === 'lista' || i.estado_mostrado === 'confirmada' ? ' completo' : '') + '">' +
      esc(estado) + (i.titular_id ? ' · vas como acompañante' : '') + '</div>' +
    '<div class="cifras-m">' +
      cifra('Valor', fmtDinero(i.valor_acordado, m)) +
      cifra('Pagado', fmtDinero(i.pagado, m)) +
      cifra(saldoNeg ? 'A tu favor' : 'Saldo', fmtDinero(saldoNeg ? -i.saldo : i.saldo, m), 'saldo') +
    '</div>' +
    (activa ? rechazos(i, acomp) : '') +
    (Number(i.por_validar) > 0
      ? '<p class="pista por-validar">Por validar: <b>' + fmtDinero(i.por_validar, m) +
        '</b>. Cuando lo validemos, baja tu saldo.</p>' : '') +
    (activa ? requisitos(i) : '') +
    (acomp.length
      ? '<div class="acomps-m"><div class="cejilla">Tus acompañantes</div>' + acomp.map(filaAcompanante).join('') + '</div>' : '') +
    (activa ? '<button class="btn" onclick="abrirComprobante(&quot;' + esc(i.inscripcion_id) + '&quot;)">Subir comprobante</button>' : '') +
    (CON_VOUCHER.includes(i.estado_mostrado) && !(supa && supa.demo)
      ? '<a class="btn secundario" href="voucher.html?i=' + encodeURIComponent(i.inscripcion_id) + '">Ver mi voucher</a>' : '') +
    '</div>';
}

export function pintarMiViaje(){
  const caja = document.getElementById('listaMiViaje');
  const ins = ordenadas(E.INSCRIPCIONES || []);
  if(!ins.length){
    caja.innerHTML = '<div class="vacio"><p>Todavía no estás inscrito a ninguna salida.</p></div>';
    return;
  }
  const hoy = hoyBogota();
  caja.innerHTML = ins.map(i => tarjeta(i, hoy)).join('');
}

/* ══════════════════ SUBIR COMPROBANTE ══════════════════ */
let objetivo = null;     // inscripcion_id desde el que se abrió

/* A quién puede ir el abono: mi inscripción de esa salida y la de mis acompañantes. */
function destinosPosibles(inscripcionId){
  const mia = (E.INSCRIPCIONES || []).find(i => i.inscripcion_id === inscripcionId);
  if(!mia) return [];
  const lista = [{id: mia.inscripcion_id, texto: 'Mi inscripción · ' + mia.plan_nombre, moneda: mia.moneda, plan_id: mia.plan_id}];
  if(!mia.titular_id){
    (E.ACOMPANANTES || []).filter(a => a.salida_id === mia.salida_id && a.estado !== 'cancelada').forEach(a =>
      lista.push({id: a.inscripcion_id, texto: 'Para ' + a.nombre, moneda: a.moneda, plan_id: mia.plan_id}));
  }
  return lista;
}

export function abrirComprobante(inscripcionId){
  objetivo = inscripcionId;
  ir('pComprobante');
}

export function pintarComprobante(){
  const destinos = destinosPosibles(objetivo);
  if(!destinos.length){ ir('pMiViaje'); return; }
  const sel = document.getElementById('cDestino');
  sel.innerHTML = destinos.map(d =>
    '<option value="' + esc(d.id) + '"' + (d.id === objetivo ? ' selected' : '') + '>' + esc(d.texto) + '</option>').join('');
  sel.onchange = actualizarDestino;

  const cs = document.getElementById('cCuenta');
  cs.innerHTML = '<option value="">Escoge</option>' +
    (E.CUENTAS || []).map(c => '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('');
  cs.onchange = mostrarCuenta;
  document.getElementById('cMonto').value = '';
  document.getElementById('cArchivo').value = '';
  document.getElementById('cError').innerHTML = '';
  marcarCampos([]);
  document.getElementById('btnComprobante').disabled = false;
  mostrarCuenta();
  actualizarDestino();
}

function destinoElegido(){
  const id = document.getElementById('cDestino').value;
  return destinosPosibles(objetivo).find(d => d.id === id) || null;
}

function actualizarDestino(){
  const d = destinoElegido();
  if(!d) return;
  document.getElementById('cSimbolo').textContent = d.moneda === 'USD' ? 'USD' : '$';
  const p = PLANES[d.plan_id];
  const sugerido = abonoUno(p);
  document.getElementById('cPista').textContent =
    (sugerido ? 'Abono mínimo sugerido: ' + fmtMoneda(sugerido, p.m) + ' por persona (' +
      Math.round(pctAbono(p) * 100) + ' % del valor del viaje). Escribe lo que de verdad pagaste, ' : 'Escribe lo que de verdad pagaste, ') +
    'en ' + (d.moneda === 'USD' ? 'dólares (puedes poner centavos: 850,50)' : 'pesos, solo números') + '.' +
    (d.moneda === 'USD' ? ' Si pagaste en pesos, escríbenos por WhatsApp y lo registramos con la TRM.' : '');
}

function mostrarCuenta(){
  const c = (E.CUENTAS || []).find(x => x.id === document.getElementById('cCuenta').value);
  const caja = document.getElementById('datosPagoComp');
  if(c && c.detalle_publico){
    caja.style.display = 'block';
    caja.innerHTML = c.detalle_publico;      // lo escribe la oficina (Tarea 9): <b>, <br>
  }else caja.style.display = 'none';
}

/* Todo lo que falla en el comprobante, en el orden de la pantalla (regla común de formularios). Pura. */
export function validarComprobante({destino, cuenta, monto, archivo}){
  const fallas = [];
  if(!destino) fallas.push({id: 'cDestino', msg: 'Escoge a qué inscripción va el abono.'});
  if(!cuenta)  fallas.push({id: 'cCuenta', msg: 'Dinos a qué cuenta pagaste.'});
  if(!monto)   fallas.push({id: 'cMonto', msg: 'Escribe cuánto abonaste.'});
  const motivo = validarArchivo(archivo);
  if(motivo)   fallas.push({id: 'cArchivo', msg: motivo});
  return fallas;
}

export async function enviarComprobante(){
  const d = destinoElegido();
  const cuenta = (E.CUENTAS || []).find(x => x.id === document.getElementById('cCuenta').value);
  const monto = parsearMonto(document.getElementById('cMonto').value, d ? d.moneda : 'COP');
  const archivos = document.getElementById('cArchivo').files;
  const archivo = (archivos && archivos[0]) || null;

  const fallas = validarComprobante({destino: d, cuenta, monto, archivo});
  if(fallas.length) return mostrarError('cError', fallas.map(f => esc(f.msg)).join('<br>'), fallas.map(f => f.id));
  marcarCampos([]);

  const boton = document.getElementById('btnComprobante');
  boton.disabled = true;
  cargando(true, 'cError');
  try{
    await subirComprobante(archivo, [{inscripcion_id: d.id, monto}],
      {pagador: E.YO, monto, moneda: d.moneda, medio: cuenta.medio || cuenta.nombre, cuenta: cuenta.id});
  }catch(e){
    boton.disabled = false;
    return mostrarError('cError', esc(mensajeDeError(e, 'registrar tu comprobante')));
  }
  try{ await recargarMiViaje(); }catch(e){ console.warn('No se pudo recargar tu viaje: ' + e.message); }
  boton.disabled = false;
  document.getElementById('cError').innerHTML = '';
  // A la base va el medio de la cuenta; la persona ve el nombre de la cuenta que escogió («Nequi»).
  E.ULTIMO_ENVIO = {monto, moneda: d.moneda, medio: cuenta.nombre || cuenta.medio};
  ir('pEnviado');
}

/* ══════════════════ COMPROBANTE ENVIADO ══════════════════ */
/** Lo que se muestra del último envío. El monto es lo que escribió el viajero, no un saldo. */
export function resumenDeEnvio({monto, moneda, medio}){
  return {
    monto: fmtMoneda(monto, moneda) + (moneda === 'USD' ? '' : ' ' + moneda),
    medio,
    estado: 'Por validar'
  };
}

export function pintarEnviado(envio){
  if(!envio){ ir('pMiViaje'); return; }
  const r = resumenDeEnvio(envio);
  document.getElementById('eMonto').textContent = r.monto;
  document.getElementById('eMedio').textContent = r.medio;
  document.getElementById('eEstado').textContent = r.estado;
}
