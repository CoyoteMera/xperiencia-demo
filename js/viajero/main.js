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
         primeraVez, entrarSiHaySesion, guardarClaveNueva } from './sesion.js';
import { verPerfiles } from './nivel.js';
import { guardarValidacion, guardarDatos } from './datos.js';
import { inscribirme, quieroEstaSalida, verTodasLasSalidas,
         agregarAcompanante, quitarAcompanante } from './inscribir.js';
import { quieroEste } from './tours.js';
import { abrirComprobante, enviarComprobante } from './miviaje.js';
import { parsearIntencion, guardarIntencion, recuperarInvitacion, leerHashDeRecuperacion } from './link.js';

/* Los onclick/onchange/oninput del HTML buscan estas funciones en window. */
Object.assign(window, {
  ir, salir, entrar, registrar, verClave, revisarClave, volverAEntrada, recuperar, primeraVez,
  verPerfiles, guardarValidacion, guardarDatos, inscribirme, quieroEste, quieroEstaSalida,
  verTodasLasSalidas, agregarAcompanante, quitarAcompanante, abrirComprobante, enviarComprobante,
  irDemo, guardarClaveNueva
});

/* La clase js-ok y el capturador de errores (window.__pintarError) los pone un <script> en línea
   de index.html, para que no dependan de que este módulo y sus imports terminen de cargar. */

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
guardarIntencion(parsearIntencion(location.search));
// El token ya está guardado: se quita de la barra de direcciones (historial, capturas, "compartir").
try{
  const u = new URL(location.href);
  if(u.searchParams.has('invitacion')){
    u.searchParams.delete('invitacion');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
}catch(e){}
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
  if(recuperacion && recuperacion.tipo === 'error'){
    const c = document.getElementById('eError');
    if(c) c.innerHTML = '<div class="error">' + recuperacion.mensaje + '</div>';
  }
  /* ── Si ya había sesión abierta, entra solo ── */
  // En demo la persona ficticia ya "tiene sesión" y entra sola a Mi nivel; luego se vuelve a Entrada,
  // que es por donde empieza quien abre el enlace.
  entrarSiHaySesion().then(() => { if(demo) irDemo('pEntrada'); });
}

/* ── Envíos pendientes: reintenta al recuperar señal y al reabrir ── */
// En demo no hay cola real: nada se reintenta ni se guarda.
if(demo) pintarBarraDemo();
else iniciarCola();
