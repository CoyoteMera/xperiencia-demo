/* ══════════════════ ENTRAR / REGISTRAR ══════════════════ */
import { E, bdVacia } from './estado.js';
import { ir } from './nav.js';
import { recuperarIntencion, olvidarIntencion, recuperarInvitacion, olvidarInvitacion,
         pasoAlEntrar, esUuid } from './link.js';
import { limpiarBorrador } from './inscribir.js';
import { hayConexion, iniciarSesion, crearCuenta, cerrarSesion, recuperarClave,
         correoDeSesion, leerSesion, cambiarClave, guardarMiFicha, cargarMiFicha, usarInvitacion, purgarCola } from './almacen.js';
import { cargarTodo } from './sync.js';
import { mostrarError, cargando, avisar, esc } from '../comun/util.js';
import { rutaPorRol, rolActual } from '../comun/sesion.js';

function exigeConexion(caja){
  if(hayConexion()) return false;
  mostrarError(caja, 'La app no está conectada al servidor. Ábrela desde <b>xperiencia.com.co/app/</b>.');
  return true;
}

export function entrarApp(){
  document.getElementById('btnSalir').style.display = 'block';
  E.onboarding = false;
  // Si venía con un link preparado, lo llevamos derecho a ese viaje.
  ir(recuperarIntencion() ? 'pInscribir' : 'pEscalera');
}

/* ─── Después de abrir sesión: la invitación va PRIMERO ───────
   Una invitación une la cuenta a una ficha que ya existe (la que creó quien te inscribió). Solo
   funciona si la cuenta todavía no tiene ficha propia: por eso se usa antes de completar el
   perfil o de crear nada. `nuevo` = {doc, nom, cel} cuando la persona acaba de llenar el
   registro (y no hay invitación). Devuelve true si entró a la app. */
async function resolverEntrada(mail, nuevo){
  // El personal de la oficina no usa esta app: va derecho a oficina.html (sin pedirle ficha).
  const oficina = rutaPorRol(await rolActual());
  if(oficina){ location.replace(oficina); return true; }
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
      aviso = e.message;
    }
    ficha = await cargarMiFicha();
  }else if(paso === 'descartar-invitacion'){
    olvidarInvitacion();
    avisar('Tu cuenta ya tiene ficha, así que esa invitación no se usó. Si te hace falta, pide otra a Xperiencia.', true);
  }

  if(ficha){
    await cargarTodo();
    entrarApp();
    return true;
  }
  if(nuevo && !aviso){
    await guardarFichaNueva(nuevo.doc, nuevo.nom, nuevo.cel, mail);
    return true;
  }
  // La cuenta existe pero no tiene ficha: solo faltan sus datos.
  modoCompletarPerfil(mail, aviso);
  return false;
}

/* ─── Completar perfil ───────────────────────────────────────
   La cuenta de correo ya existe (la creamos nosotros, o el cliente
   la creó y se cayó la conexión antes de guardar).
   La sesión queda ABIERTA y solo faltan sus datos. Nunca se le
   manda a "crear cuenta" otra vez: ahí es donde se formaba el bucle.
   ──────────────────────────────────────────────────────────── */
let MODO_COMPLETAR = false;

export function modoCompletarPerfil(mail, aviso){
  MODO_COMPLETAR = true;
  document.getElementById('camposCuenta').style.display = 'none';
  document.getElementById('camposPersona').style.display = '';
  document.getElementById('cejillaRegistro').textContent = 'Casi listo';
  document.getElementById('tituloRegistro').innerHTML = 'Faltan tus datos.';
  const sub = document.getElementById('subtituloRegistro');
  sub.textContent = 'Tu cuenta (' + (mail||'') + ') ya está activa. Completa estos datos una sola vez y entras.';
  sub.style.display = 'block';
  document.getElementById('btnRegistrar').textContent = 'Guardar y entrar';
  document.getElementById('btnYaTengo').textContent = 'Cancelar';
  document.getElementById('rError').innerHTML = aviso
    ? '<div class="error">No pudimos usar tu invitación: ' + esc(aviso) + '</div>' : '';
  document.getElementById('eError').innerHTML = '';
  ir('pRegistro');
}

export function modoCrearCuenta(){
  MODO_COMPLETAR = false;
  document.getElementById('camposCuenta').style.display = '';
  document.getElementById('camposPersona').style.display = '';
  document.getElementById('cejillaRegistro').textContent = 'Crear cuenta';
  document.getElementById('tituloRegistro').innerHTML = 'Empecemos.';
  document.getElementById('subtituloRegistro').style.display = 'none';
  document.getElementById('btnRegistrar').textContent = 'Crear mi cuenta';
  document.getElementById('btnYaTengo').textContent = 'Ya tengo cuenta';
  document.getElementById('rError').innerHTML = '';
}

/* Con una invitación guardada, el registro solo pide correo y clave: la ficha ya existe. */
export function modoInvitado(){
  modoCrearCuenta();
  document.getElementById('camposPersona').style.display = 'none';
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
const REGLAS_CLAVE = [
  {sufijo:'largo', ok: v => v.length >= 8,        falta:'8 caracteres'},
  {sufijo:'mayus', ok: v => /[A-ZÁÉÍÓÚÑ]/.test(v), falta:'una mayúscula'},
  {sufijo:'num',   ok: v => /[0-9]/.test(v),       falta:'un número'}
];
/* Marca las reglas cumplidas de un campo de contraseña: id del campo y prefijo de sus <li>
   (registro: 'rClave' y 'rg'; contraseña nueva: 'nClave' y 'cn'). */
export function revisarClave(idCampo = 'rClave', prefijo = 'rg'){
  const v = document.getElementById(idCampo).value;
  REGLAS_CLAVE.forEach(r => {
    const li = document.getElementById(prefijo + '-' + r.sufijo);
    if(li) li.className = (v && r.ok(v)) ? 'ok' : '';
  });
}
export function claveFloja(v){
  const faltan = REGLAS_CLAVE.filter(r => !r.ok(v)).map(r => r.falta);
  if(!faltan.length) return null;
  return 'A tu contraseña le falta ' +
    (faltan.length === 1 ? faltan[0]
      : faltan.slice(0,-1).join(', ') + ' y ' + faltan[faltan.length-1]) + '.';
}

/* «Es mi primera vez aquí»: con una invitación guardada, el registro es el corto. */
export function primeraVez(){
  if(recuperarInvitacion()) modoInvitado(); else modoCrearCuenta();
  ir('pRegistro');
}

export async function volverAEntrada(){
  if(MODO_COMPLETAR){ await salir(); modoCrearCuenta(); return; }
  ir('pEntrada');
}

export async function entrar(){
  const mail = document.getElementById('eMail').value.trim();
  const cl   = document.getElementById('eClave').value;
  if(exigeConexion('eError')) return;
  if(!mail || !cl) return mostrarError('eError','Escribe tu correo y tu contraseña.');
  cargando(true,'eError');
  try{
    E.UID = await iniciarSesion(mail, cl);
    document.getElementById('eError').innerHTML = '';
    await resolverEntrada(mail, null);
  }catch(e){
    // Los de Auth ya vienen en español (normalizados en almacen.js); los de la base, también.
    mostrarError('eError', esc(e.message));
  }
}

export async function registrar(){
  const conInvitacion = !MODO_COMPLETAR && !!recuperarInvitacion();
  const doc = document.getElementById('rDoc').value.replace(/\D/g,'');
  const nom = document.getElementById('rNombre').value.trim();
  const cel = document.getElementById('rCel').value.replace(/\D/g,'');
  const mail= document.getElementById('rMail').value.trim();
  const cl  = document.getElementById('rClave').value;
  if(exigeConexion('rError')) return;
  if(!conInvitacion){
    if(doc.length < 5)  return mostrarError('rError','Revisa tu número de documento.');
    if(!nom)            return mostrarError('rError','Escribe tu nombre completo.');
    if(cel.length < 10) return mostrarError('rError','El celular debe tener 10 dígitos.');
  }
  if(!MODO_COMPLETAR){
    if(!mail.includes('@')) return mostrarError('rError','Escribe un correo válido. Es con el que vas a entrar.');
    const floja = claveFloja(cl);
    if(floja) return mostrarError('rError', floja);
  }
  if(!document.getElementById('rDatos').checked)
    return mostrarError('rError','Necesitamos tu autorización de datos para poder cuidarte en montaña.');

  cargando(true,'rError');

  /* Caso A — la sesión ya está abierta, solo faltan los datos */
  if(MODO_COMPLETAR){
    try{
      await resolverEntrada(correoDeSesion() || mail, {doc, nom, cel});
    }catch(e){
      mostrarError('rError','No pudimos guardar tus datos: ' + esc(e.message));
    }
    return;
  }

  /* Caso B — cuenta nueva. Con invitación no se crea ninguna ficha propia: se une a la invitada. */
  const nuevo = conInvitacion ? null : {doc, nom, cel};
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
          'Entra con tu contraseña, o usa “Olvidé mi contraseña” para poner una nueva.');
      }
      return seguirConSesion(mail, nuevo);
    }
    return mostrarError('rError', esc(e.message));
  }
  E.UID = creada.uid;
  if(!creada.conSesion){
    // Hoy «Confirm email» está apagado; si se activa, la persona confirma por correo y entra.
    modoCrearCuenta();
    ir('pEntrada');
    document.getElementById('eError').innerHTML = '<div class="aviso" style="margin-top:14px">Te mandamos un correo ' +
      'para confirmar tu cuenta. Ábrelo, confirma y entra aquí con tu correo y tu contraseña.</div>';
    return;
  }
  return seguirConSesion(mail, nuevo);
}

async function seguirConSesion(mail, nuevo){
  try{
    await resolverEntrada(mail, nuevo);
  }catch(e){
    mostrarError('rError', 'No pudimos terminar tu registro: ' + esc(e.message));
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
  await cerrarSesion();
  E.YO = null; E.UID = null; E.MI = null; E.PRIVADO = null;
  E.INSCRIPCIONES = []; E.ACOMPANANTES = []; E.DERIVADOS = []; E.CUENTAS = [];
  E.BD = bdVacia();
  document.getElementById('navegador').style.display = 'none';
  document.getElementById('btnSalir').style.display = 'none';
  document.getElementById('eMail').value = '';
  document.getElementById('eClave').value = '';
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
    return mostrarError('nError', esc(e.message));
  }
  document.getElementById('nClave').value = '';
  document.getElementById('nError').innerHTML = '';
  avisar('Listo, tu contraseña quedó cambiada.');
  await entrarSiHaySesion();
}

/* Si ya había sesión abierta, entra solo. main.js lo llama una vez al arrancar. */
export async function entrarSiHaySesion(){
  const s = await leerSesion();
  if(!s || E.UID) return;
  E.UID = s.uid;
  try{
    await resolverEntrada(s.email || '', null);
  }catch(e){
    mostrarError('eError', esc(e.message));
  }
}
