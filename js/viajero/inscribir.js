/* Inscripción a una salida: la salida (del calendario real), los acompañantes, y la aceptación
   de la política de cancelación y del tratamiento de datos. El dinero lo calcula la base. */
import { E } from './estado.js';
import { PLANES, ABONO_PCT, ABONO_ESPECIAL } from './catalogo.js';
import { siguientePaso } from './nivel.js';
import { TIPOS_DOC } from './ficha.js';
import { recuperarIntencion, olvidarIntencion } from './link.js';
import { datosCompletos } from './datos.js';
import { encolarInscripcion } from './almacen.js';
import { recargarMiViaje } from './sync.js';
import { salidasParaIntencion } from './salidas.js';
import { ir } from './nav.js';
import { avisar, mostrarError, cargando, esc, fmtDinero, mesLargo, uuid } from '../comun/util.js';

const MAX_ACOMPANANTES = 20;          // el mismo tope que inscribirme() en la base

/* Lo que se pidió desde «Quiero ir» o desde el calendario: {plan} o {salida}. Pesa más que el enlace. */
let pedido = null;
let acomps = [];                      // acompañantes escritos (borrador)
let idBorrador = null;                // p_id de este intento: reintentar no duplica

export function quieroEstePlan(planId){
  pedido = planId ? {plan: planId} : null;
  ir('pInscribir');
}
export function quieroEstaSalida(salidaId){
  pedido = {salida: salidaId};
  ir('pInscribir');
}
/* Al salir: no queda en memoria lo que escribió la persona (acompañantes) ni el id del intento. */
export function limpiarBorrador(){
  acomps = [];
  idBorrador = null;
  pedido = null;
}
export function verTodasLasSalidas(){
  pedido = {};
  olvidarIntencion();
  pintarInscribir();
}

const salidaDe = id => (E.BD.salidas || []).find(s => s.id === id);

function etiquetaSalida(x){
  const libres = Math.max(0, (parseInt(x.cupos_total, 10) || 0) - (parseInt(x.cupos_ocupados, 10) || 0));
  return x.plan + ' · ' + mesLargo(x.fecha) + ' · ' +
    (libres === 0 ? 'sin cupos' : libres === 1 ? 'queda 1 cupo' : 'quedan ' + libres + ' cupos');
}

export function pintarInscribir(){
  const u = E.BD.usuarios[E.YO];
  const sig = siguientePaso(u ? u.viajes : []);

  document.getElementById('pasosInscribir').style.display = E.onboarding ? 'flex' : 'none';
  document.getElementById('cejillaInscribir').textContent =
    E.onboarding ? 'Paso 2 de 4' : 'Tu inscripción';
  document.getElementById('btnInscribir').textContent =
    E.onboarding ? 'Confirmar y seguir' : 'Confirmar mi inscripción';
  document.getElementById('sugerencia').textContent = E.onboarding
    ? 'Escoge la salida a la que te inscribes. Lo de tu abono lo registras después, con el comprobante.'
    : sig.texto;

  // Un «Quiero ir» o un clic en el calendario manda sobre el enlace preparado.
  const inten = pedido || recuperarIntencion();
  const r = salidasParaIntencion(E.BD.salidas, inten);

  const sel = document.getElementById('iSalida');
  const boton = document.getElementById('btnInscribir');
  const cajaInt = document.getElementById('avisoIntencion');
  if(!r.lista.length){
    sel.innerHTML = '<option value="">No hay salidas abiertas ahora</option>';
    boton.disabled = true;
  }else{
    sel.innerHTML = '<option value="">Escoge la salida</option>' + r.lista.map(x => {
      const lleno = (parseInt(x.cupos_total, 10) || 0) > 0 &&
        (parseInt(x.cupos_ocupados, 10) || 0) >= (parseInt(x.cupos_total, 10) || 0);
      return '<option value="' + esc(x.id) + '"' + (lleno ? ' disabled' : '') +
        (x.id === r.preseleccionada ? ' selected' : '') + '>' + esc(etiquetaSalida(x)) + '</option>';
    }).join('');
    boton.disabled = false;
  }

  if(r.filtradaPorPlan){
    const p = PLANES[r.filtradaPorPlan];
    cajaInt.innerHTML = 'Estas son las salidas de <b>' + esc(p ? p.p : 'ese plan') + '</b>. ' +
      '<button class="enlace" style="display:inline;width:auto;padding:0;margin-left:4px" ' +
      'onclick="verTodasLasSalidas()">Ver todas</button>';
    cajaInt.style.display = 'block';
  }else if(r.preseleccionada && (inten && (inten.plan || inten.salida))){
    cajaInt.innerHTML = '<b>Esto te lo preparó Xperiencia.</b> Ya está escogida la salida abajo — ' +
      'si quieres cambiarla, puedes.';
    cajaInt.style.display = 'block';
  }else if(inten && inten.plan && !r.lista.some(x => x.plan_id === inten.plan)){
    cajaInt.innerHTML = 'Ese plan no tiene salidas abiertas ahora. Mira las que sí, o escríbenos.';
    cajaInt.style.display = 'block';
  }else{
    cajaInt.style.display = 'none';
  }
  pedido = null;

  sel.onchange = actualizarSalida;
  pintarAcompanantes();
  actualizarSalida();
}

/* Muestra lo que cuesta cada persona (tal como lo guarda la base) y la política de ese plan. */
export function actualizarSalida(){
  const x = salidaDe(document.getElementById('iSalida').value);
  const info = document.getElementById('infoSalida');
  const pol = document.getElementById('textoPolitica');
  if(!x){
    info.textContent = '';
    pol.textContent = 'Escoge una salida para ver la política de cancelación que le aplica.';
    return;
  }
  info.textContent = (x.valor === null || x.valor === undefined
      ? 'Precio por confirmar' : 'Valor por persona: ' + fmtDinero(x.valor, x.moneda)) +
    (x.duracion ? ' · ' + x.duracion : '');
  const p = E.POLITICAS[x.politica_id];
  pol.textContent = p && p.texto ? p.texto
    : 'No pudimos cargar la política de cancelación. Recarga la app antes de inscribirte.';
  actualizarPersonas();
}

function actualizarPersonas(){
  const n = 1 + acomps.length;
  document.getElementById('resumenPersonas').textContent = n === 1
    ? 'Vas solo. El valor es por persona.'
    : 'Van ' + n + ' personas: tú y ' + acomps.length + (acomps.length === 1 ? ' acompañante' : ' acompañantes') +
      '. El valor es por persona.';
}

/* ─── Acompañantes: nombre y documento, no más. Los datos de salud los llena cada uno. ─── */
const CAMPOS_ACOMP = ['nombre', 'tipo_doc', 'num_doc', 'nacimiento', 'celular'];

function leerAcompanantes(){
  acomps = acomps.map((a, i) => {
    const o = {};
    CAMPOS_ACOMP.forEach(k => {
      const el = document.getElementById('ac_' + k + '_' + i);
      o[k] = el ? el.value.trim() : (a[k] || '');
    });
    return o;
  });
}

export function agregarAcompanante(){
  leerAcompanantes();
  if(acomps.length >= MAX_ACOMPANANTES)
    return mostrarError('iError', 'Máximo ' + MAX_ACOMPANANTES + ' acompañantes por inscripción.');
  acomps.push({nombre: '', tipo_doc: 'CC', num_doc: '', nacimiento: '', celular: ''});
  document.getElementById('iError').innerHTML = '';
  pintarAcompanantes();
}
export function quitarAcompanante(i){
  leerAcompanantes();
  acomps.splice(i, 1);
  pintarAcompanantes();
}

function pintarAcompanantes(){
  document.getElementById('listaAcompanantes').innerHTML = acomps.map((a, i) =>
    '<div class="acomp"><div class="cejilla">Acompañante ' + (i + 1) + '</div>' +
    '<label for="ac_nombre_' + i + '">Nombre completo<span class="req">*</span></label>' +
    '<input type="text" id="ac_nombre_' + i + '" value="' + esc(a.nombre) + '" placeholder="Como aparece en su documento">' +
    '<label for="ac_tipo_doc_' + i + '">Tipo de documento</label>' +
    '<select id="ac_tipo_doc_' + i + '">' + TIPOS_DOC.map(t =>
      '<option value="' + t[0] + '"' + (t[0] === a.tipo_doc ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select>' +
    '<label for="ac_num_doc_' + i + '">Número de documento</label>' +
    '<input type="tel" id="ac_num_doc_' + i + '" inputmode="numeric" value="' + esc(a.num_doc) + '" placeholder="Sin puntos ni comas">' +
    '<label for="ac_nacimiento_' + i + '">Fecha de nacimiento <span class="opc">opcional</span></label>' +
    '<input type="date" id="ac_nacimiento_' + i + '" value="' + esc(a.nacimiento) + '">' +
    '<label for="ac_celular_' + i + '">Celular <span class="opc">opcional</span></label>' +
    '<input type="tel" id="ac_celular_' + i + '" inputmode="numeric" value="' + esc(a.celular) + '" placeholder="3001234567">' +
    '<button type="button" class="enlace" onclick="quitarAcompanante(' + i + ')">Quitar a este acompañante</button>' +
    '</div>').join('');
  actualizarPersonas();
}

/* ─── Ayuda de captura que ya traía el demo: abono mínimo sugerido por persona (no es un saldo) ─── */
export function pctAbono(p){
  if(!p) return ABONO_PCT;
  return ABONO_ESPECIAL[p.pi] || ABONO_ESPECIAL[p.di] || ABONO_PCT;
}
export function abonoUno(p){
  if(!p || !p.pr) return 0;
  const pct = pctAbono(p);
  const bruto = parseInt(p.pr,10) * pct;
  const paso = (p.m === 'USD') ? 10 : 10000;        // redondea a cifra cómoda de pagar
  return Math.ceil(bruto / paso) * paso;
}

/* ─── Enviar ─── */
export async function inscribirme(){
  const salidaId = document.getElementById('iSalida').value;
  const x = salidaDe(salidaId);
  if(!x) return mostrarError('iError', 'Escoge la salida a la que te inscribes.');
  leerAcompanantes();
  for(const a of acomps){
    if(!a.nombre) return mostrarError('iError', 'Cada acompañante necesita nombre. Escríbelo o quita a ese acompañante.');
  }
  const p = E.POLITICAS[x.politica_id];
  if(!p || !p.texto) return mostrarError('iError', 'No pudimos cargar la política de cancelación. Recarga la app e inténtalo otra vez.');
  if(!document.getElementById('iPolitica').checked)
    return mostrarError('iError', 'Para inscribirte debes aceptar la política de cancelación.');
  if(!document.getElementById('iDatos').checked)
    return mostrarError('iError', 'Para inscribirte necesitamos tu autorización para tratar tus datos (Ley 1581).');

  const personas = 1 + acomps.length;
  if(!idBorrador) idBorrador = uuid();
  const args = {
    p_id: idBorrador,
    p_salida: salidaId,
    p_cupos: personas,          // cupos = personas inscritas: la base rechaza más
    p_acompanantes: acomps.map(a => ({nombre: a.nombre, tipo_doc: a.tipo_doc, num_doc: a.num_doc,
                                      nacimiento: a.nacimiento, celular: a.celular})),
    p_acepta_politica: true,
    p_acepta_datos: true
  };

  const boton = document.getElementById('btnInscribir');
  boton.disabled = true;
  cargando(true, 'iError');
  let r;
  try{
    r = await encolarInscripcion(args);
  }catch(e){
    boton.disabled = false;
    return mostrarError('iError', esc(e.message));
  }
  boton.disabled = false;

  if(r.estado === 'rechazado'){
    idBorrador = null;
    return mostrarError('iError', esc(r.error || 'No se pudo completar la inscripción'));
  }
  document.getElementById('iError').innerHTML = '';
  if(r.estado === 'pendiente'){
    avisar('Sin señal: guardamos tu inscripción y la enviamos apenas haya conexión.');
    return ir('pEscalera');
  }

  // confirmada en la base
  idBorrador = null;
  acomps = [];
  document.getElementById('iPolitica').checked = false;
  document.getElementById('iDatos').checked = false;
  olvidarIntencion();
  try{ await recargarMiViaje(); }catch(e){ console.warn('No se pudo recargar tu viaje: ' + e.message); }
  if(E.onboarding || !datosCompletos()){
    avisar('Inscripción registrada. Ahora sí, tus datos de montaña.');
    return ir('pDatos');
  }
  avisar('Inscripción registrada. Sube tu comprobante para que la confirmemos.');
  ir('pMiViaje');
}
