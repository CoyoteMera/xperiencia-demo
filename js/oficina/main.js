/* Punto de entrada de la oficina. Es el único módulo que arranca cosas: los demás solo exportan
   funciones y no tocan document, window ni Supabase al importarse (tests/app/supabase.test.mjs lo
   comprueba importándolos todos en Node, sin document). */
import { iniciarSupa, supa } from '../comun/supa.js';
import { exigirRol, rutaPanel } from '../comun/sesion.js';
import { crearClienteOficinaDemo } from './demo/cliente.js';
import { PANTALLAS_OFICINA } from './demo/pantallas.js';
import { montarBarraDemo } from '../comun/barra-demo.js';
import { iniciarRecorrido, yaVisto } from './demo/recorrido.js';
import { ROLES_OFICINA, irA, registrarVista } from './nav.js';
import { cargarAlertas } from './alertas.js';
import { cargarBandeja, validarAbono, rechazarAbono } from './bandeja.js';
import { cargarSalidas, mostrarSalida, abrirFormulario, abrirEnlace, abrirSalida, nuevaSalida, editarSalida,
         guardarSalida, copiarTabla, exportarExcel, exportarTodo, cambiarEnlace, copiarEnlace, enlaceWhatsApp } from './salidas.js';
import { entrarCancelacion, calcularCancelacion, pedirConfirmacion, descartarConfirmacion, confirmarCancelacion, marcarPagada }
  from './cancelacion.js';
import { entrarAbono, irAbonoSalida, elegirPagador, buscarPagador, cambiarAbono, guardarAbono, cancelarAbono } from './abono.js';
import { entrarFicha, abrirFicha, buscarViajeros, marcarRequisito, verComprobante, avisarVoucher, mandarInvitacion,
         copiarInvitacion, invitacionWhatsApp, irAbono, irCancelacion, aplicarDescuento, quitarDescuento, pausarInscripcion, quitarPausa } from './ficha.js';

/* Los onclick/onchange/oninput del HTML buscan estas funciones en window. Cada módulo agrega
   las suyas aquí al montarse. */
Object.assign(window, {
  irOficina: irA, salirOficina,
  validarAbono, rechazarAbono,
  abrirSalida, nuevaSalida, editarSalida, guardarSalida, copiarTabla, exportarExcel, exportarTodo,
  cambiarEnlace, copiarEnlace, enlaceWhatsApp
});
// Tarea 9c: cancelación y devoluciones.
Object.assign(window, {
  calcularCancelacion, pedirConfirmacion, descartarConfirmacion, confirmarCancelacion, marcarPagada
});
// Tarea 9c: abono a mano.
Object.assign(window, {
  irAbonoSalida, elegirPagador, buscarPagador, cambiarAbono, guardarAbono, cancelarAbono
});
// Tarea 9c: ficha del viajero.
Object.assign(window, {
  abrirFicha, buscarViajeros, marcarRequisito, verComprobante, avisarVoucher, mandarInvitacion,
  copiarInvitacion, invitacionWhatsApp, irAbono, irCancelacion, aplicarDescuento, quitarDescuento, pausarInscripcion, quitarPausa
});

const demo = new URLSearchParams(location.search).has('demo');

async function salirOficina(){
  try{ if(supa) await supa.auth.signOut(); }catch(e){}
  location.replace(demo ? 'index.html?demo' : 'index.html');
}

/* ── Vistas ──────────────────────────────────────────────── */
// (cada pieza registra la suya con registrarVista; 9c añade Ficha, Abono y Cancelación aquí)
registrarVista('alertas', {alEntrar: cargarAlertas});
registrarVista('bandeja', {alEntrar: cargarBandeja});
registrarVista('salidas', {alEntrar: cargarSalidas});
registrarVista('salida', {tab: 'salidas', alEntrar: mostrarSalida});
registrarVista('salida-form', {tab: 'salidas', alEntrar: abrirFormulario});
registrarVista('enlace', {tab: 'salidas', alEntrar: abrirEnlace});
registrarVista('ficha', {alEntrar: entrarFicha});
registrarVista('abono', {tab: 'ficha', alEntrar: entrarAbono});
registrarVista('cancelacion', {alEntrar: entrarCancelacion});

async function arrancar(){
  const errorDeConexion = iniciarSupa(demo ? {cliente: crearClienteOficinaDemo()} : undefined);
  // Para mirar la base desde la consola del navegador (por ejemplo `supa.from('salida').select()`).
  window.supa = supa;
  if(errorDeConexion){
    const c = document.getElementById('avisoSinRed');
    document.getElementById('appOficina').hidden = false;
    c.style.display = 'block';
    c.innerHTML = errorDeConexion.message === 'sdk-bloqueado'
      ? '<b>Esta vista no puede conectarse.</b> Abre la oficina desde tu navegador.'
      : '<b>No pudimos conectar con el servidor.</b> Revisa tu internet y vuelve a entrar.';
    return;
  }
  // Sin sesión o sin rol de oficina: exigirRol redirige a index.html y no se muestra nada.
  const acceso = await exigirRol(ROLES_OFICINA);
  if(!acceso) return;
  document.getElementById('appOficina').hidden = false;
  // Dónde se recuerda que el recorrido ya se vio; en una ventana privada puede no haber.
  const almacen = (() => { try{ return window.localStorage; }catch(e){ return null; } })();
  if(demo){
    montarBarraDemo({app: 'oficina', pantallas: PANTALLAS_OFICINA, alPulsar: p => irA(p.id, p.arg),
      vivaId: () => ((document.querySelector('main > .pantalla.viva') || {}).id || '').slice(2),
      conRecorrido: true, alRecorrido: () => iniciarRecorrido({irA, almacen})});
  }
  // El enlace al panel es solo para el dueño (el rol de oficina no lo ve).
  const panel = rutaPanel(acceso.rol);
  if(panel){
    const enlace = document.getElementById('enlacePanel');
    enlace.href = panel;
    enlace.hidden = false;
  }
  await irA('alertas');
  if(demo && !yaVisto(almacen)) iniciarRecorrido({irA, almacen});
}

arrancar();
