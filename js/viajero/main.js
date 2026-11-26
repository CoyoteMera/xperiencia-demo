/* Punto de entrada de la app del viajero. Es el único módulo que arranca cosas:
   los demás solo exportan funciones y no tocan document, window ni Supabase al importarse
   (tests/app/supabase.test.mjs lo comprueba importándolos todos en Node, sin document). */
import { iniciarSupa, supa } from '../comun/supa.js';
import { esDemo, pintarBarraDemo, irDemo } from './demo/barra.js';
import { crearClienteDemo } from './demo/cliente.js';
import { iniciarCola, alCambiarCola } from './almacen.js';
import { pintarPendientes } from './pendientes.js';
import { ir } from './nav.js';
import { salir, entrar, registrar, verClave, revisarClave, volverAEntrada, recuperar,
         primeraVez, entrarSiHaySesion, guardarClaveNueva, corregirRegistro, alPulsarEnter,
         reenviarCorreo, abrirConEnlaceMalo } from './sesion.js';
import { verPerfiles } from './nivel.js';
import { guardarValidacion, guardarDatos } from './datos.js';
import { inscribirme, quieroEstaSalida, verTodasLasSalidas,
         agregarAcompanante, guardarAcompanante, cancelarAcompanante, quitarAcompanante } from './inscribir.js';
import { quieroEste } from './tours.js';
import { abrirComprobante, enviarComprobante } from './miviaje.js';
import { quitarMarcaAlEscribir } from '../comun/util.js';
import { tomarIntencionDeUrl, recuperarIntencion, anuncioDeIntencion,
         recuperarInvitacion, leerHashDeRecuperacion } from './link.js';

document.addEventListener('keydown', alPulsarEnter);   // Enter envía la pantalla de acceso

/* Los onclick/onchange/oninput del HTML buscan estas funciones en window. */
Object.assign(window, {
  ir, salir, entrar, registrar, verClave, revisarClave, volverAEntrada, recuperar, primeraVez,
  verPerfiles, guardarValidacion, guardarDatos, inscribirme, quieroEste, quieroEstaSalida,
  verTodasLasSalidas, agregarAcompanante, guardarAcompanante, cancelarAcompanante, quitarAcompanante,
  abrirComprobante, enviarComprobante, irDemo, guardarClaveNueva, corregirRegistro, reenviarCorreo
});

/* La clase js-ok y el capturador de errores (window.__pintarError) los pone un <script> en línea
   de index.html, para que no dependan de que este módulo y sus imports terminen de cargar. */

quitarMarcaAlEscribir();

/* ── Conexión ── */
// Con ?demo: cliente en memoria con datos ficticios, barra para saltar de pantalla y nada de cola real.
const demo = esDemo(location.search);
// El hash del correo de recuperación se lee ANTES de crear el cliente: el SDK lo borra al procesarlo.
const recuperacion = demo ? null : leerHashDeRecuperacion(location.hash);
const errorDeConexion = demo ? iniciarSupa({cliente: crearClienteDemo()}) : iniciarSupa({detectarEnUrl: true});
// Para mirar la base desde la consola del navegador (por ejemplo `supa.from('viajero').select()`).
window.supa = supa;
if(errorDeConexion){
  const mostrarAviso = function(){
    const c = document.getElementById('avisoSinRed');
    if(c){
      c.style.display = 'block';
      c.innerHTML = errorDeConexion.message === 'sdk-bloqueado'
        ? '<b>Esta vista no puede conectarse.</b> Abre la app desde ' +
          '<b>xperiencia.com.co/app/</b> en tu navegador. Aquí los botones no van a responder.'
        : '<b>No pudimos conectar con el servidor.</b> Revisa tu internet y vuelve a entrar.';
    }
  };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarAviso);
  else mostrarAviso();
}

/* ── Link preparado: lo que trae la URL queda guardado para cuando termine el registro.
      Una invitación se guarda aparte y se usa al abrir sesión, antes de crear ninguna ficha. ── */
// Ya guardado, el enlace se quita de la barra de direcciones: el token no queda en el historial ni en
// capturas, y recargar no vuelve a activar un enlace ya gastado (ni reinicia sus 7 días).
try{
  const limpia = tomarIntencionDeUrl(location.href);
  if(limpia) history.replaceState(null, '', limpia);
}catch(e){}
{
  const texto = anuncioDeIntencion(recuperarIntencion());
  const c = document.getElementById('avisoLlegada');
  if(texto && c){ c.textContent = texto; c.style.display = 'block'; }
}
if(recuperarInvitacion()){
  const c = document.getElementById('avisoInvitacion');
  if(c) c.style.display = 'block';
}

/* ── Envíos pendientes: el aviso se repinta cuando cambia la cola ── */
alCambiarCola(pintarPendientes);

/* ── Enlace del correo de «Olvidé mi contraseña» ── */
if(recuperacion){
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
}
if(recuperacion && recuperacion.tipo === 'recuperar' && supa){
  // La sesión que abre el enlace NO entra a la app: primero se pone la contraseña nueva.
  supa.auth.onAuthStateChange(function(evento){
    if(evento === 'PASSWORD_RECOVERY') ir('pClaveNueva');
  });
}else{
  /* ── Si ya había sesión abierta, entra solo ── */
  // En demo la persona ficticia ya "tiene sesión" y entra sola a Mi nivel; luego se vuelve a Entrada,
  // que es por donde empieza quien abre el enlace.
  // Un enlace gastado solo se explica si de verdad no hay sesión: si la hay, la persona entra y ya.
  const abrir = recuperacion && recuperacion.tipo === 'error' ? abrirConEnlaceMalo(recuperacion.mensaje) : entrarSiHaySesion();
  Promise.resolve(abrir).then(() => { if(demo) irDemo('pEntrada'); });
}

/* ── Envíos pendientes: reintenta al recuperar señal y al reabrir ── */
// En demo no hay cola real: nada se reintenta ni se guarda.
if(demo) pintarBarraDemo();
else iniciarCola();
