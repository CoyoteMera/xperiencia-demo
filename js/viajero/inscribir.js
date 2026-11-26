/* Inscripción a una salida: la salida (del calendario real), los acompañantes, y la aceptación
   de la política de cancelación y del tratamiento de datos. El dinero lo calcula la base. */
import { E } from './estado.js';
import { PLANES, ABONO_PCT, ABONO_ESPECIAL, waXperiencia } from './catalogo.js';
import { siguientePaso } from './nivel.js';
import { TIPOS_DOC, nombreDoc } from './ficha.js';
import { recuperarIntencion, olvidarIntencion, gastarIntencion } from './link.js';
import { datosCompletos } from './datos.js';
import { encolarInscripcion } from './almacen.js';
import { recargarMiViaje } from './sync.js';
import { salidasParaIntencion } from './salidas.js';
import { ir } from './nav.js';
import { mensajeDeError } from '../comun/supa.js';
import { avisar, mostrarError, cargando, esc, fmtDinero, mesLargo, uuid } from '../comun/util.js';

const MAX_ACOMPANANTES = 20;          // el mismo tope que inscribirme() en la base

/* Lo que se pidió desde «Quiero ir» o desde el calendario: {plan} o {salida}. Pesa más que el enlace. */
let pedido = null;
let acomps = [];                      // acompañantes ya agregados (borrador de la inscripción)
let editando = null;                  // el formulario abierto de un acompañante que aún no se agrega
let idBorrador = null;                // p_id de este intento: reintentar no duplica
let seguirSinInscribirse = false;     // en el registro y sin salidas abiertas: el botón lleva a Tus datos

/* ─── Borrador (H15): acompañantes agregados y formulario abierto, por cuenta y en esta pestaña.
   Sobrevive a recargar; otra cuenta que entre en la misma pestaña no lo ve. Se borra al salir y
   al quedar inscrito. Sin almacenamiento (ventana privada estricta) simplemente no se guarda. */
const LLAVE_BORRADOR = 'xpe_borrador_inscripcion';
const almacen = () => { try{ return globalThis.sessionStorage || null; }catch(e){ return null; } };

function guardarBorrador(){
  const s = almacen();
  if(!s || !E.UID) return;
  try{
    if(!acomps.length && !editando) s.removeItem(LLAVE_BORRADOR);
    else s.setItem(LLAVE_BORRADOR, JSON.stringify({uid: E.UID, acomps, editando}));
  }catch(e){}
}
function borrarBorrador(){
  const s = almacen();
  if(s) try{ s.removeItem(LLAVE_BORRADOR); }catch(e){}
}
/* Trae el borrador si es de esta cuenta y no hay nada en memoria; el de otra cuenta se descarta. */
function restaurarBorrador(){
  const s = almacen();
  if(!s || !E.UID || acomps.length || editando) return;
  let b = null;
  try{ b = JSON.parse(s.getItem(LLAVE_BORRADOR)); }catch(e){ b = null; }
  if(!b) return;
  if(b.uid !== E.UID || !Array.isArray(b.acomps)) return borrarBorrador();
  acomps = b.acomps.filter(a => a && typeof a === 'object').slice(0, MAX_ACOMPANANTES)
    .map(a => ({...VACIO_ACOMP(), ...a}));
  editando = b.editando && typeof b.editando === 'object' ? {...VACIO_ACOMP(), ...b.editando} : null;
}
/* Al escribir en el formulario del acompañante: se guarda lo escrito (sin repintar). */
function alEscribirAcompanante(){
  leerFormularioAcompanante();
  guardarBorrador();
}

/* El documento del acompañante sin puntos, comas ni espacios (H8): así la oficina reconoce el mismo
   número escrito de dos maneras. Las letras se conservan (pasaportes). */
export function limpiarDocumento(t){
  return String(t ?? '').replace(/[.,\s]/g, '');
}

/* Qué decir cuando no hay salida que escoger (H1, D18). Pura: {html, boton}|null. */
export function avisoSinSalidas({hayAbiertas, planPedido, hayDelPlan, onboarding}){
  const plan = planPedido && PLANES[planPedido] ? PLANES[planPedido].p : null;
  const enlace = texto => '<a class="enlace" href="' + waXperiencia('Hola, vengo de la app Mi Xperiencia. ' +
    (plan ? 'Quiero saber cuándo hay salidas de ' + plan + '.' : 'Quiero saber cuándo hay salidas.')) +
    '" target="_blank" rel="noopener">' + texto + '</a>';
  if(!hayAbiertas && onboarding)
    return {html: 'Ahora no hay salidas abiertas. Puedes terminar tu registro y volver cuando publiquemos fechas, o ' +
      enlace('escribirnos') + '.', boton: 'Seguir sin inscribirme'};
  if(!hayAbiertas && planPedido)
    return {html: 'Ese plan no tiene salidas abiertas ahora. ' + enlace('Escríbenos') + ' y te avisamos cuando haya fecha.', boton: null};
  if(!hayAbiertas)
    return {html: 'Ahora no hay salidas abiertas. ' + enlace('Escríbenos') + ' y te avisamos cuando haya fecha.', boton: null};
  if(planPedido && !hayDelPlan)
    return {html: 'Ese plan no tiene salidas abiertas ahora. Mira las que sí, o escríbenos.', boton: null};
  return null;
}

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
  editando = null;
  idBorrador = null;
  pedido = null;
  seguirSinInscribirse = false;
  borrarBorrador();
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
  document.getElementById('btnAtrasInscribir').style.display = E.onboarding ? 'inline-flex' : 'none';
  document.getElementById('cejillaInscribir').textContent =
    E.onboarding ? 'Paso 2 de 4' : 'Tu inscripción';
  document.getElementById('btnInscribir').textContent =
    E.onboarding ? 'Confirmar y seguir' : 'Confirmar mi inscripción';
  document.getElementById('sugerencia').textContent = E.onboarding
    ? 'Escoge la salida a la que te inscribes. Lo de tu abono lo registras después, con el comprobante.'
    : sig.texto;
  // El número de WhatsApp vive en un solo sitio (catalogo.waXperiencia), no escrito en el HTML.
  document.getElementById('waSumar').href =
    waXperiencia('Hola, ya me inscribí en la app Mi Xperiencia y quiero sumar a alguien a mi viaje');

  // Un «Quiero ir» o un clic en el calendario manda sobre el enlace preparado.
  const delEnlace = !pedido && !!recuperarIntencion();
  const inten = pedido || recuperarIntencion();
  if(delEnlace && E.UID) gastarIntencion();   // ya se mostró con sesión: recargar no vuelve aquí
  const r = salidasParaIntencion(E.BD.salidas, inten);

  const sel = document.getElementById('iSalida');
  const boton = document.getElementById('btnInscribir');
  const cajaInt = document.getElementById('avisoIntencion');
  const planPedido = inten && inten.plan ? inten.plan : null;
  const aviso = avisoSinSalidas({hayAbiertas: r.lista.length > 0, planPedido,
    hayDelPlan: !!planPedido && r.lista.some(x => x.plan_id === planPedido), onboarding: !!E.onboarding});
  seguirSinInscribirse = !!(aviso && aviso.boton);
  if(!r.lista.length){
    sel.innerHTML = '<option value="">No hay salidas abiertas ahora</option>';
    boton.disabled = !seguirSinInscribirse;
    if(seguirSinInscribirse) boton.textContent = aviso.boton;
  }else{
    sel.innerHTML = '<option value="">Escoge la salida</option>' + r.lista.map(x => {
      const lleno = (parseInt(x.cupos_total, 10) || 0) > 0 &&
        (parseInt(x.cupos_ocupados, 10) || 0) >= (parseInt(x.cupos_total, 10) || 0);
      return '<option value="' + esc(x.id) + '"' + (lleno ? ' disabled' : '') +
        (x.id === r.preseleccionada ? ' selected' : '') + '>' + esc(etiquetaSalida(x)) + '</option>';
    }).join('');
    boton.disabled = false;
  }

  if(!r.lista.length){
    cajaInt.innerHTML = aviso.html;
    cajaInt.style.display = 'block';
  }else if(r.filtradaPorPlan){
    const p = PLANES[r.filtradaPorPlan];
    cajaInt.innerHTML = 'Estas son las salidas de <b>' + esc(p ? p.p : 'ese plan') + '</b>. ' +
      '<button class="enlace" style="display:inline;width:auto;padding:0;margin-left:4px" ' +
      'onclick="verTodasLasSalidas()">Ver todas</button>';
    cajaInt.style.display = 'block';
  }else if(r.preseleccionada && (inten && (inten.plan || inten.salida))){
    cajaInt.innerHTML = '<b>Esto te lo preparó Xperiencia.</b> Ya está escogida la salida abajo — ' +
      'si quieres cambiarla, puedes.';
    cajaInt.style.display = 'block';
  }else if(aviso){
    cajaInt.innerHTML = aviso.html;
    cajaInt.style.display = 'block';
  }else{
    cajaInt.style.display = 'none';
  }
  pedido = null;

  sel.onchange = actualizarSalida;
  document.getElementById('listaAcompanantes').oninput = alEscribirAcompanante;
  restaurarBorrador();
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

/* ─── Acompañantes: nombre y documento, no más. Los datos de salud los llena cada uno. ───
   Se escribe uno a la vez: «Agregar» lo guarda en la lista (con su «Quitar») y deja el botón de
   agregar otro; así no se amontonan formularios. */
const CAMPOS_ACOMP = ['nombre', 'tipo_doc', 'num_doc', 'nacimiento', 'celular'];
const VACIO_ACOMP = () => ({nombre: '', tipo_doc: 'CC', num_doc: '', nacimiento: '', celular: ''});

/* Pasa lo escrito en el formulario abierto a `editando` (antes de repintar, para no perderlo). */
function leerFormularioAcompanante(){
  if(!editando) return;
  CAMPOS_ACOMP.forEach(k => {
    const el = document.getElementById('ac_' + k);
    if(el) editando[k] = el.value.trim();
  });
}

export function agregarAcompanante(){
  if(editando) return;
  if(acomps.length >= MAX_ACOMPANANTES)
    return mostrarError('iError', 'Máximo ' + MAX_ACOMPANANTES + ' acompañantes por inscripción.');
  editando = VACIO_ACOMP();
  document.getElementById('iError').innerHTML = '';
  pintarAcompanantes();
  guardarBorrador();
  const nombre = document.getElementById('ac_nombre');
  if(nombre) nombre.focus();
}
/* «Agregar»: el acompañante pasa a la lista y se cierra el formulario. El error sale dentro del
   formulario (D11), no al final de la página. */
export function guardarAcompanante(){
  leerFormularioAcompanante();
  if(!editando) return;
  guardarBorrador();
  if(!editando.nombre)
    return mostrarError('acError', 'Escribe el nombre del acompañante.', ['ac_nombre']);
  editando.num_doc = limpiarDocumento(editando.num_doc);
  acomps.push(editando);
  editando = null;
  document.getElementById('iError').innerHTML = '';
  pintarAcompanantes();
  guardarBorrador();
}
export function cancelarAcompanante(){
  editando = null;
  document.getElementById('iError').innerHTML = '';
  pintarAcompanantes();
  guardarBorrador();
}
export function quitarAcompanante(i){
  leerFormularioAcompanante();
  acomps.splice(i, 1);
  pintarAcompanantes();
  guardarBorrador();
}

function pintarAcompanantes(){
  const guardados = acomps.map((a, i) =>
    '<div class="acomp-guardado"><div class="quien"><b>' + esc(a.nombre) + '</b><span>' +
    (a.num_doc ? esc(nombreDoc(a.tipo_doc)) + ' · ' + esc(a.num_doc) : 'Sin documento') + '</span></div>' +
    '<button type="button" class="enlace" aria-label="Quitar a ' + esc(a.nombre) + '" onclick="quitarAcompanante(' + i + ')">Quitar</button></div>'
  ).join('');
  const a = editando;
  const formulario = !a ? '' :
    '<div class="acomp"><div class="cejilla">Acompañante ' + (acomps.length + 1) + '</div>' +
    '<label for="ac_nombre">Nombre completo<span class="req">*</span></label>' +
    '<input type="text" id="ac_nombre" value="' + esc(a.nombre) + '" placeholder="Como en su documento">' +
    '<label for="ac_tipo_doc">Tipo de documento <span class="opc">opcional</span></label>' +
    '<select id="ac_tipo_doc">' + TIPOS_DOC.map(t =>
      '<option value="' + t[0] + '"' + (t[0] === a.tipo_doc ? ' selected' : '') + '>' + t[1] + '</option>').join('') + '</select>' +
    '<label for="ac_num_doc">Número de documento <span class="opc">opcional</span></label>' +
    '<input type="tel" id="ac_num_doc" inputmode="numeric" value="' + esc(a.num_doc) + '" placeholder="Sin puntos ni comas">' +
    '<label for="ac_nacimiento">Fecha de nacimiento <span class="opc">opcional</span></label>' +
    '<input type="date" id="ac_nacimiento" value="' + esc(a.nacimiento) + '">' +
    '<label for="ac_celular">Celular <span class="opc">opcional</span></label>' +
    '<input type="tel" id="ac_celular" inputmode="numeric" value="' + esc(a.celular) + '" placeholder="3001234567">' +
    '<div id="acError"></div>' +
    '<div class="acciones"><button type="button" class="btn" onclick="guardarAcompanante()">Agregar</button>' +
    '<button type="button" class="btn secundario" onclick="cancelarAcompanante()">Cancelar</button></div>' +
    '</div>';
  document.getElementById('listaAcompanantes').innerHTML = guardados + formulario;
  const boton = document.getElementById('btnAgregarAcomp');
  boton.style.display = editando ? 'none' : '';
  boton.textContent = acomps.length ? '+ Agregar otro acompañante' : '+ Agregar un acompañante';
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
  // H1: en el registro y sin ninguna salida abierta, se sigue a Tus datos sin enviar nada.
  if(seguirSinInscribirse && E.onboarding){
    document.getElementById('iError').innerHTML = '';
    return ir('pDatos');
  }
  const salidaId = document.getElementById('iSalida').value;
  const x = salidaDe(salidaId);
  if(!x) return mostrarError('iError', 'Escoge la salida a la que te inscribes.', ['iSalida']);
  leerFormularioAcompanante();
  if(editando && CAMPOS_ACOMP.some(k => k !== 'tipo_doc' && editando[k]))
    return mostrarError('acError', 'Termina de agregar a tu acompañante con el botón «Agregar», o cancélalo.', ['ac_nombre']);
  if(editando){ editando = null; pintarAcompanantes(); guardarBorrador(); }   // abierto pero vacío: se descarta
  const p = E.POLITICAS[x.politica_id];
  if(!p || !p.texto) return mostrarError('iError', 'No pudimos cargar la política de cancelación. Recarga la app e inténtalo otra vez.');
  const faltan = [];
  if(!document.getElementById('iPolitica').checked) faltan.push(['iPolitica', 'Para inscribirte debes aceptar la política de cancelación.']);
  if(!document.getElementById('iDatos').checked) faltan.push(['iDatos', 'Para inscribirte necesitamos tu autorización para tratar tus datos (Ley 1581).']);
  if(faltan.length) return mostrarError('iError', faltan.map(f => f[1]).join('<br>'), faltan.map(f => f[0]));

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
    return mostrarError('iError', esc(mensajeDeError(e, 'completar tu inscripción')));
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
  editando = null;
  borrarBorrador();
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
