/* ══════════════════ ENTRAR / REGISTRAR ══════════════════ */
import { E, bdVacia } from './estado.js';
import { ir } from './nav.js';
import { recuperarIntencion, olvidarIntencion, recuperarInvitacion, olvidarInvitacion,
         pasoAlEntrar, esUuid, recuperarPantalla, olvidarPantalla } from './link.js';
import { limpiarBorrador } from './inscribir.js';
import { hayConexion, iniciarSesion, crearCuenta, cerrarSesion, recuperarClave,
         correoDeSesion, leerSesion, reenviarConfirmacion, cambiarClave, guardarMiFicha, cargarMiFicha, usarInvitacion, purgarCola } from './almacen.js';
import { cargarTodo } from './sync.js';
import { mensajeDeError, falloDe } from '../comun/supa.js';
import { mostrarError, cargando, avisar, esc, marcarCampos } from '../comun/util.js';
import { rutaPorRol, leerRol } from '../comun/sesion.js';
import { REGLAS_CLAVE, claveFloja } from '../comun/clave.js';
export { claveFloja };

function exigeConexion(caja){
  if(hayConexion()) return false;
  mostrarError(caja, 'La app no está conectada al servidor. Ábrela desde <b>xperiencia.com.co/app/</b>.');
  return true;
}

/* `restaurar`: al recargar la página con la sesión abierta, vuelve a la pantalla donde estaba
   (y al paso del registro, si lo estaba haciendo). Al entrar con correo y contraseña, no. */
export function entrarApp(restaurar){
  document.getElementById('btnSalir').style.display = 'block';
  const guardada = restaurar ? recuperarPantalla(E.UID) : null;
  E.onboarding = !!(guardada && guardada.onb);
  // Si venía con un link preparado, lo llevamos derecho a ese viaje.
  ir(guardada ? guardada.id : (recuperarIntencion() ? 'pInscribir' : 'pEscalera'));
}

/* ─── Después de abrir sesión: la invitación va PRIMERO ───────
   Una invitación une la cuenta a una ficha que ya existe (la que creó quien te inscribió). Solo
   funciona si la cuenta todavía no tiene ficha propia: por eso se usa antes de pedir los datos
   personales o de crear nada. Una cuenta sin ficha (recién confirmada, o que cerró la app sin
   llenarlos) cae en la pantalla de datos personales, entre por el enlace del correo, con correo y
   contraseña o recargando. Devuelve true si entró a la app. */
async function resolverEntrada(mail, restaurar){
  // El personal no usa esta app: ve un aviso con el camino a su entrada (acceso.html) y nunca se le
  // pide ficha, para que una cuenta de staff no termine con datos de viajero.
  const rol = await leerRol();
  if(rol.error){
    // Sin saber el rol no se sigue: una cuenta de staff no debe caer en «completa tus datos».
    mostrarError('eError', 'No pudimos comprobar tu cuenta. Revisa tu internet y vuelve a intentarlo.');
    return true;
  }
  if(rutaPorRol(rol.rol)){
    document.getElementById('btnSalir').style.display = 'none';
    ir('pStaff');
    return true;
  }
  let ficha = await cargarMiFicha();
  const token = recuperarInvitacion();
  const paso = pasoAlEntrar({tieneFicha: !!ficha, invitacion: token});
  let aviso = null;

  if(paso === 'usar-invitacion' && !esUuid(token)){
    // Un enlace mal copiado: se explica en español sin llegar a la base.
    olvidarInvitacion();
    aviso = 'El enlace de invitación no es válido. Pide uno nuevo a Xperiencia.';
    ficha = await cargarMiFicha();
  }else if(paso === 'usar-invitacion'){
    try{
      await usarInvitacion(token);
      olvidarInvitacion();
      avisar('Listo: tu cuenta quedó unida a tu inscripción.');
    }catch(e){
      // Sin señal el token se conserva y se reintenta al volver a entrar. Cualquier otro fallo
      // (venció, ya se usó…) lo explica la base tal cual y se sigue con los datos propios.
      if(e.sinRed) throw e;
      olvidarInvitacion();
      aviso = falloDe(e, 'usar tu invitación');
    }
    ficha = await cargarMiFicha();
  }else if(paso === 'descartar-invitacion'){
    olvidarInvitacion();
    avisar('Tu cuenta ya tiene ficha, así que esa invitación no se usó. Si te hace falta, pide otra a Xperiencia.', true);
  }

  if(ficha){
    await cargarTodo();
    entrarApp(restaurar);
    return true;
  }
  // La cuenta existe pero no tiene ficha: se piden sus datos personales, una sola vez.
  modoCompletarPerfil(mail, aviso);
  return false;
}

/* ─── Datos personales (tras confirmar la cuenta) ────────────
   «Crear cuenta» pide solo correo y contraseña. La primera vez que la cuenta entra (por el enlace
   del correo o con su contraseña) y aún no tiene ficha, se piden documento, nombre, celular y la
   autorización de datos. La sesión queda ABIERTA: nunca se le manda a "crear cuenta" otra vez
   (ahí es donde se formaba el bucle). Al guardar sigue Tu viaje → Tus datos → Tu historial.
   ──────────────────────────────────────────────────────────── */
let MODO_COMPLETAR = false;
let MODO_INVITADO = false;      // registro con invitación: la casilla de autorización está a la vista
let MODO_CORREGIR = false;      // corrigiendo documento, nombre o celular de una ficha que ya existe
let ORIGEN_CORREGIR = 'pDatos'; // a qué pantalla se vuelve al terminar o cancelar
let CORREO_PENDIENTE = '';      // correo de la cuenta que espera confirmación (lo usa «Reenviar el correo»)

const BOTON_REENVIAR = '<br><button type="button" class="enlace" onclick="reenviarCorreo()">Reenviar el correo</button>' +
  '<div id="eReenvio" aria-live="polite"></div>';

const notaLegal = visible => { document.getElementById('notaLegal').style.display = visible ? '' : 'none'; };

export function modoCompletarPerfil(mail, aviso){
  MODO_COMPLETAR = true;
  MODO_INVITADO = false;
  MODO_CORREGIR = false;
  document.getElementById('chkDatos').style.display = '';
  notaLegal(false);
  document.getElementById('camposCuenta').style.display = 'none';
  document.getElementById('camposPersona').style.display = '';
  document.getElementById('cejillaRegistro').textContent = 'Cuenta confirmada';
  document.getElementById('tituloRegistro').innerHTML = 'Ahora cuéntanos quién eres.';
  const sub = document.getElementById('subtituloRegistro');
  sub.textContent = 'Tu cuenta (' + (mail||'') + ') ya está activa. Te pedimos estos datos una sola vez.';
  sub.style.display = 'block';
  document.getElementById('btnRegistrar').textContent = 'Guardar y seguir';
  document.getElementById('btnYaTengo').textContent = 'Salir';
  document.getElementById('rError').innerHTML = aviso
    ? '<div class="error">' + esc(aviso) + '</div>' : '';
  document.getElementById('eError').innerHTML = '';
  marcarCampos([]);
  ir('pRegistro');
}

/* «Crear cuenta»: solo correo y contraseña (dos veces cada uno). Los datos personales se piden
   después de confirmar el correo (modoCompletarPerfil). */
export function modoCrearCuenta(){
  MODO_COMPLETAR = false;
  MODO_INVITADO = false;
  MODO_CORREGIR = false;
  document.getElementById('chkDatos').style.display = 'none';
  notaLegal(true);
  document.getElementById('camposCuenta').style.display = '';
  document.getElementById('camposPersona').style.display = 'none';
  document.getElementById('cejillaRegistro').textContent = 'Crear cuenta';
  document.getElementById('tituloRegistro').innerHTML = 'Empecemos.';
  document.getElementById('subtituloRegistro').style.display = 'none';
  document.getElementById('btnRegistrar').textContent = 'Crear mi cuenta';
  document.getElementById('btnYaTengo').textContent = 'Ya tengo cuenta';
  document.getElementById('rError').innerHTML = '';
}

/* Con una invitación guardada, el registro solo pide correo, clave y la autorización de datos: la
   ficha ya existe (la dejó quien la inscribió) y nunca pasa por la pantalla de datos personales. */
export function modoInvitado(){
  modoCrearCuenta();
  MODO_INVITADO = true;
  document.getElementById('chkDatos').style.display = '';
  document.getElementById('cejillaRegistro').textContent = 'Te invitaron a un viaje';
  document.getElementById('tituloRegistro').innerHTML = 'Crea tu cuenta.';
  const sub = document.getElementById('subtituloRegistro');
  sub.textContent = 'Quien te inscribió ya dejó tus datos. Crea tu cuenta con tu correo y quedan unidos.';
  sub.style.display = 'block';
}

/* ─── Contraseña ─────────────────────────────────────────── */
export function verClave(id, btn){
  const c = document.getElementById(id);
  const oculta = c.type === 'password';
  c.type = oculta ? 'text' : 'password';
  btn.textContent = oculta ? 'OCULTAR' : 'VER';
}
/* Marca las reglas cumplidas de un campo de contraseña: id del campo y prefijo de sus <li>
   (registro: 'rClave' y 'rg'; contraseña nueva: 'nClave' y 'cn'). */
export function revisarClave(idCampo = 'rClave', prefijo = 'rg'){
  const v = document.getElementById(idCampo).value;
  REGLAS_CLAVE.forEach(r => {
    const li = document.getElementById(prefijo + '-' + r.sufijo);
    if(li) li.className = (v && r.ok(v)) ? 'ok' : '';
  });
}

/* Enter en un campo de las pantallas de acceso pulsa su botón principal (el primero que no es
   secundario, fantasma ni de WhatsApp). Una tecla sostenida o una composición de teclado no cuentan. */
export function alPulsarEnter(e, doc = document){
  if(e.key !== 'Enter' || e.repeat || e.isComposing) return;
  const t = e.target;
  if(!t || t.tagName !== 'INPUT' || t.type === 'checkbox') return;
  if(!t.closest('.pantalla.acceso.viva')) return;
  const boton = doc.querySelector('.pantalla.acceso.viva .pie-fijo .btn:not(.secundario):not(.fantasma):not(.whatsapp)');
  if(!boton) return;
  e.preventDefault();
  boton.click();
}

/* «Es mi primera vez aquí»: con una invitación guardada, el registro es el corto. */
export function primeraVez(){
  if(recuperarInvitacion()) modoInvitado(); else modoCrearCuenta();
  ir('pRegistro');
}

/* «Atrás» durante el registro: reabre la pantalla de datos personales con lo ya guardado, para
   corregir documento, nombre o celular. `origen` es la pantalla a la que se vuelve. */
export function corregirRegistro(origen){
  if(!E.MI) return;
  MODO_CORREGIR = true; MODO_COMPLETAR = false; MODO_INVITADO = false;
  ORIGEN_CORREGIR = origen || 'pDatos';
  document.getElementById('camposCuenta').style.display = 'none';
  document.getElementById('camposPersona').style.display = '';
  document.getElementById('chkDatos').style.display = 'none';
  notaLegal(false);
  document.getElementById('cejillaRegistro').textContent = 'Tus datos';
  document.getElementById('tituloRegistro').innerHTML = 'Corrígelos.';
  const sub = document.getElementById('subtituloRegistro');
  sub.textContent = 'Cambia lo que esté mal. Tu cuenta y tu inscripción siguen igual.';
  sub.style.display = 'block';
  document.getElementById('btnRegistrar').textContent = 'Guardar y volver';
  document.getElementById('btnYaTengo').textContent = 'Cancelar';
  document.getElementById('rTipoDoc').value = E.MI.tipo_doc || 'CC';
  document.getElementById('rDoc').value = E.MI.num_doc || '';
  document.getElementById('rNombre').value = E.MI.nombre || '';
  document.getElementById('rCel').value = E.MI.celular || '';
  document.getElementById('rError').innerHTML = '';
  marcarCampos([]);
  ir('pRegistro');
}

export async function volverAEntrada(){
  if(MODO_CORREGIR){ const a = ORIGEN_CORREGIR; modoCrearCuenta(); ir(a); return; }
  if(MODO_COMPLETAR){ await salir(); modoCrearCuenta(); return; }
  ir('pEntrada');
}

export async function entrar(){
  const mail = document.getElementById('eMail').value.trim();
  const cl   = document.getElementById('eClave').value;
  if(exigeConexion('eError')) return;
  if(!mail || !cl) return mostrarError('eError','Escribe tu correo y tu contraseña.', [!mail && 'eMail', !cl && 'eClave'].filter(Boolean));
  cargando(true,'eError');
  try{
    E.UID = await iniciarSesion(mail, cl);
    document.getElementById('eError').innerHTML = '';
    await resolverEntrada(mail);
  }catch(e){
    // Los de Auth ya vienen en español (normalizados en almacen.js); los de la base, también.
    mostrarError('eError', esc(mensajeDeError(e, 'entrar')));
    if(e && e.code === 'correo-sin-confirmar'){
      CORREO_PENDIENTE = mail;
      document.getElementById('eError').innerHTML += BOTON_REENVIAR;
    }
  }
}

export async function registrar(){
  const doc = document.getElementById('rDoc').value.replace(/\D/g,'');
  const nom = document.getElementById('rNombre').value.trim();
  const cel = document.getElementById('rCel').value.replace(/\D/g,'');
  const mail= document.getElementById('rMail').value.trim();
  const mail2 = document.getElementById('rMail2').value.trim();
  const cl  = document.getElementById('rClave').value;
  const cl2 = document.getElementById('rClave2').value;
  const pideDatos = MODO_COMPLETAR || MODO_CORREGIR;   // pantalla de datos personales, no la de la cuenta
  if(exigeConexion('rError')) return;

  // Se revisa todo junto: cada campo que falta se sombrea en rojo y el letrero dice qué es.
  const falta = [];
  const exige = (bien, id, msg) => { if(!bien) falta.push({id, msg}); };
  if(pideDatos){
    exige(doc.length >= 5, 'rDoc', 'Revisa tu número de documento.');
    exige(!!nom, 'rNombre', 'Escribe tu nombre completo.');
    exige(cel.length >= 10, 'rCel', 'El celular debe tener 10 dígitos.');
  }else{
    exige(mail.includes('@'), 'rMail', 'Escribe un correo válido. Es con el que vas a entrar.');
    exige(!!mail2 && mail2.toLowerCase() === mail.toLowerCase(), 'rMail2', 'Los dos correos tienen que ser iguales.');
    const floja = claveFloja(cl);
    exige(!floja, 'rClave', floja);
    exige(!!cl2 && cl2 === cl, 'rClave2', 'Las dos contraseñas tienen que ser iguales.');
  }
  // Se exige solo si la casilla está a la vista: lo decide la pantalla que se mostró, no el localStorage
  // (otra pestaña puede dejar una invitación guardada después de abrir «Crear cuenta»).
  if(MODO_COMPLETAR || MODO_INVITADO)
    exige(document.getElementById('rDatos').checked, 'rDatos', 'Necesitamos tu autorización de datos para poder cuidarte en montaña.');
  if(falta.length)
    return mostrarError('rError', falta.map(f => f.msg).join('<br>'), falta.map(f => f.id));
  marcarCampos([]);

  /* Caso 0 — corregir documento, nombre o celular de la ficha que ya existe */
  if(MODO_CORREGIR){
    cargando(true,'rError');
    try{
      await guardarMiFicha({id: E.YO, nombre: nom, tipo_doc: document.getElementById('rTipoDoc').value, num_doc: doc, celular: cel});
      await cargarTodo();
    }catch(e){
      return mostrarError('rError', esc(falloDe(e, 'guardar los cambios')));
    }
    const destino = ORIGEN_CORREGIR;
    modoCrearCuenta();
    avisar('Listo, corregimos tus datos.');
    ir(destino);
    return;
  }

  cargando(true,'rError');

  /* Caso A — cuenta confirmada, con sesión y sin ficha: se crea con sus datos personales */
  if(MODO_COMPLETAR){
    try{
      await guardarFichaNueva(doc, nom, cel, correoDeSesion());
    }catch(e){
      mostrarError('rError',esc(falloDe(e, 'guardar tus datos')));
    }
    return;
  }

  /* Caso B — cuenta nueva: solo correo y contraseña. Los datos se piden al entrar por primera vez
     (con invitación no se piden: se une a la ficha que dejó quien la inscribió). */
  let creada;
  try{
    creada = await crearCuenta(mail, cl);
  }catch(e){
    if(e.code === 'correo-existe'){
      // El correo ya existe. En vez de dejarlo en un bucle, intentamos
      // entrar con la contraseña que acaba de escribir.
      try{
        E.UID = await iniciarSesion(mail, cl);
      }catch(e2){
        return mostrarError('rError',
          'Ese correo ya tiene cuenta y la contraseña que escribiste no coincide. ' +
          'Entra con tu contraseña, o usa «Olvidé mi contraseña» para poner una nueva.');
      }
      return seguirConSesion(mail);
    }
    return mostrarError('rError', esc(mensajeDeError(e, 'crear tu cuenta')));
  }
  vaciarCuenta(mail);
  if(!creada.conSesion){
    // «Confirm email» activo: confirma desde el correo y, al entrar, se le piden sus datos.
    modoCrearCuenta();
    ir('pEntrada');
    document.getElementById('eError').innerHTML = '<div class="aviso" style="margin-top:14px">Te mandamos un correo ' +
      'para confirmar tu cuenta. Ábrelo, confirma y entra aquí con tu correo y tu contraseña.' + BOTON_REENVIAR + '</div>';
    return;
  }
  E.UID = creada.uid;          // solo con sesión: sin ella, entrarSiHaySesion() no debe creer que ya entró
  return seguirConSesion(mail);
}

/* La cuenta ya se creó: el formulario queda vacío (la clave no se queda en pantalla) y se apagan las
   reglas de la contraseña. El correo se guarda para poder reenviar la confirmación. */
function vaciarCuenta(mail){
  CORREO_PENDIENTE = mail;
  ['rMail','rMail2','rClave','rClave2'].forEach(id => { document.getElementById(id).value = ''; });
  revisarClave();
}

async function seguirConSesion(mail){
  try{
    await resolverEntrada(mail);
  }catch(e){
    mostrarError('rError', esc(falloDe(e, 'terminar tu registro')));
  }
}

/* Crea mi ficha (la cuenta ya tiene sesión) y sigue al primer viaje. */
async function guardarFichaNueva(doc, nom, cel, mail){
  await guardarMiFicha({
    nombre: nom, tipo_doc: document.getElementById('rTipoDoc').value,
    num_doc: doc, celular: cel, correo: mail
  });
  await cargarTodo();
  document.getElementById('rError').innerHTML = '';
  modoCrearCuenta();
  E.onboarding = true;
  document.getElementById('btnSalir').style.display = 'block';
  ir('pInscribir');          // primero el viaje, después sus datos
}

export async function salir(){
  try{ purgarCola(); }catch(e){}          // lo ya resuelto no queda en el teléfono
  limpiarBorrador();                       // acompañantes escritos y el id del intento
  olvidarInvitacion();
  olvidarPantalla();
  await cerrarSesion();
  E.YO = null; E.UID = null; E.MI = null; E.PRIVADO = null;
  E.INSCRIPCIONES = []; E.ACOMPANANTES = []; E.RECHAZOS = []; E.REQUISITOS = []; E.DERIVADOS = []; E.CUENTAS = [];
  E.BD = bdVacia();
  document.getElementById('navegador').style.display = 'none';
  document.getElementById('btnSalir').style.display = 'none';
  document.getElementById('eMail').value = '';
  document.getElementById('eClave').value = '';
  // En un teléfono compartido, quien entra después no ve los datos del anterior.
  ['rMail','rMail2','rClave','rClave2','rDoc','rNombre','rCel'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('rDatos').checked = false;
  modoCrearCuenta();
  olvidarIntencion();
  ir('pEntrada');
}

export async function recuperar(){
  const mail = document.getElementById('oMail').value.trim();
  if(!mail.includes('@')) return mostrarError('oError','Escribe un correo válido.');
  await recuperarClave(mail);
  document.getElementById('oError').innerHTML =
    '<div class="aviso" style="margin-top:14px">Si ese correo está registrado, te llega el enlace en unos minutos. Revisa también el correo no deseado.</div>';
}

/* «Guardar contraseña» de la pantalla Contraseña nueva (la sesión la abrió el enlace del correo). */
export async function guardarClaveNueva(){
  const cl = document.getElementById('nClave').value;
  if(exigeConexion('nError')) return;
  const floja = claveFloja(cl);
  if(floja) return mostrarError('nError', floja);
  cargando(true, 'nError');
  try{
    await cambiarClave(cl);
  }catch(e){
    return mostrarError('nError', esc(mensajeDeError(e, 'cambiar tu contraseña')));
  }
  document.getElementById('nClave').value = '';
  document.getElementById('nError').innerHTML = '';
  avisar('Listo, tu contraseña quedó cambiada.');
  await entrarSiHaySesion();
}

/* Si ya había sesión abierta, entra solo. main.js lo llama una vez al arrancar. */
export async function entrarSiHaySesion(){
  const s = await leerSesion();
  if(!s) return false;
  if(E.UID) return true;
  E.UID = s.uid;
  try{
    await resolverEntrada(s.email || '', true);
  }catch(e){
    mostrarError('eError', esc(mensajeDeError(e, 'entrar')));
  }
  return true;
}

/* El enlace del correo ya se usó o venció: si la persona tiene sesión, entra y no se le dice nada;
   si no, se le explica en la pantalla de Entrada. */
export async function abrirConEnlaceMalo(mensaje){
  if(await entrarSiHaySesion()) return;
  mostrarError('eError', esc(mensaje));
}

/* «Reenviar el correo»: vuelve a mandar la confirmación al correo de la cuenta que espera. */
export async function reenviarCorreo(){
  const caja = document.getElementById('eReenvio');
  if(!caja) return;
  if(exigeConexion('eReenvio')) return;
  try{
    await reenviarConfirmacion(CORREO_PENDIENTE);
    caja.textContent = 'Te lo mandamos otra vez. Vale el más reciente.';
  }catch(e){
    caja.textContent = e && e.code === 'demasiados-intentos'
      ? 'Espera un minuto antes de pedir otro.'
      : mensajeDeError(e, 'reenviar el correo');
  }
}
