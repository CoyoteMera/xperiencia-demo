/* «Mi viaje»: mis inscripciones con su saldo, mis acompañantes y la subida de comprobantes.
   Todos los montos vienen de Postgres (v_inscripcion_saldo, mis_acompanantes): aquí solo se
   les da formato. El navegador no suma abonos ni resta saldos. */
import { E } from './estado.js';
import { PLANES } from './catalogo.js';
import { abonoUno, pctAbono } from './inscribir.js';
import { subirComprobante, validarArchivo, parsearMonto } from './comprobantes.js';
import { recargarMiViaje } from './sync.js';
import { ir } from './nav.js';
import { supa } from '../comun/supa.js';
import { mostrarError, cargando, esc, fmtDinero, fmtMoneda, mesLargo, faltanDias, hoyBogota } from '../comun/util.js';

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

function tarjeta(i, hoy){
  const m = i.moneda;
  const estado = ESTADOS[i.estado_mostrado] || i.estado_mostrado;
  const activa = i.estado_mostrado !== 'cancelada' && i.estado_mostrado !== 'viajo';
  const acomp = i.titular_id ? [] : E.ACOMPANANTES.filter(a => a.salida_id === i.salida_id);
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
    (Number(i.por_validar) > 0
      ? '<p class="pista por-validar">Por validar: <b>' + fmtDinero(i.por_validar, m) +
        '</b>. Revisamos tu comprobante y lo sumamos al saldo.</p>' : '') +
    (i.req_pendientes > 0 && activa
      ? '<p class="pista">Te ' + (i.req_pendientes === 1 ? 'falta 1 requisito' : 'faltan ' + i.req_pendientes + ' requisitos') +
        (i.req_bloqueantes_pendientes > 0
          ? ' (' + (i.req_bloqueantes_pendientes === 1 ? '1 es obligatorio' : i.req_bloqueantes_pendientes + ' son obligatorios') + ')'
          : '') + ' para quedar listo.</p>' : '') +
    (acomp.length
      ? '<div class="acomps-m"><div class="cejilla">Tus acompañantes</div>' + acomp.map(a =>
          '<div class="acomp-m"><b>' + esc(a.nombre) + '</b><span>Valor ' + fmtDinero(a.valor_acordado, a.moneda) +
          ' · Saldo ' + fmtDinero(a.saldo, a.moneda) + '</span></div>').join('') + '</div>' : '') +
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
    E.ACOMPANANTES.filter(a => a.salida_id === mia.salida_id).forEach(a =>
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
      Math.round(pctAbono(p) * 100) + ' % del precio de grupo). Escribe lo que de verdad pagaste, ' : 'Escribe lo que de verdad pagaste, ') +
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

export async function enviarComprobante(){
  const d = destinoElegido();
  const cuenta = (E.CUENTAS || []).find(x => x.id === document.getElementById('cCuenta').value);
  const monto = parsearMonto(document.getElementById('cMonto').value, d ? d.moneda : 'COP');
  const archivo = document.getElementById('cArchivo').files[0] || null;

  if(!d)      return mostrarError('cError', 'Escoge a qué inscripción va el abono.');
  if(!cuenta) return mostrarError('cError', 'Dinos a qué cuenta pagaste.');
  if(!monto)  return mostrarError('cError', 'Escribe cuánto abonaste.');
  const motivo = validarArchivo(archivo);
  if(motivo)  return mostrarError('cError', esc(motivo));

  const boton = document.getElementById('btnComprobante');
  boton.disabled = true;
  cargando(true, 'cError');
  try{
    await subirComprobante(archivo, [{inscripcion_id: d.id, monto}],
      {pagador: E.YO, monto, moneda: d.moneda, medio: cuenta.medio || cuenta.nombre, cuenta: cuenta.id});
  }catch(e){
    boton.disabled = false;
    return mostrarError('cError', esc(e.message));
  }
  try{ await recargarMiViaje(); }catch(e){ console.warn('No se pudo recargar tu viaje: ' + e.message); }
  boton.disabled = false;
  document.getElementById('cError').innerHTML = '';
  E.ULTIMO_ENVIO = {monto, moneda: d.moneda, medio: cuenta.medio || cuenta.nombre};
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
