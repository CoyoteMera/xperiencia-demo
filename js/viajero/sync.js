/* Sincroniza el estado de la app (E) con la base: carga todo al entrar y guarda mi ficha.
   Es el puente entre almacen.js (red, sin estado) y las pantallas. No toca el DOM. */
import { E } from './estado.js';
import { cargarMiFicha, guardarMiFicha, cargarMisInscripciones, cargarMisAcompanantes,
         cargarSalidas, cargarPoliticas, cargarCuentas } from './almacen.js';
import { fichaADatos, datosAFicha, historialDe, soloHistoricos } from './ficha.js';

/* Una carga secundaria que falla no debe dejar a la persona sin entrar: se anota y sigue vacía. */
async function seguro(promesa, porDefecto, que){
  try{ return await promesa; }
  catch(e){ console.warn('No se pudo cargar ' + que + ': ' + e.message); return porDefecto; }
}

/* Carga mi ficha y todo lo que cuelga de ella. false si todavía no tengo ficha. */
export async function cargarTodo(){
  const ficha = await cargarMiFicha();
  if(!ficha) return false;
  E.MI = ficha.viajero;
  E.PRIVADO = ficha.privado;
  E.YO = ficha.viajero.id;
  const [ins, acomp, sal, pol, cuentas] = await Promise.all([
    seguro(cargarMisInscripciones(E.YO), [], 'tus inscripciones'),
    seguro(cargarMisAcompanantes(), [], 'tus acompañantes'),
    seguro(cargarSalidas(), [], 'las salidas'),
    seguro(cargarPoliticas(), {}, 'las políticas'),
    seguro(cargarCuentas(), [], 'las cuentas de pago')
  ]);
  E.POLITICAS = pol;
  E.CUENTAS = cuentas;
  E.BD.salidas = sal;
  aplicarInscripciones(ins, acomp);
  const u = fichaADatos(ficha.viajero, ficha.privado);
  u.viajes = historialDe(ficha.viajero, ins);
  E.BD.usuarios = {};
  E.BD.usuarios[E.YO] = u;
  return true;
}

function aplicarInscripciones(ins, acomp){
  E.INSCRIPCIONES = ins;
  E.ACOMPANANTES = acomp;
  E.DERIVADOS = ins.filter(i => i.estado_mostrado === 'viajo' && i.destino_id).map(i => i.destino_id);
  E.BD.misViajes = ins.filter(i => i.estado_mostrado !== 'cancelada').map(i => ({salida_id: i.salida_id}));
}

/* Vuelve a leer inscripciones, acompañantes y cupos (después de inscribirme o de subir un comprobante). */
export async function recargarMiViaje(){
  const [ins, acomp, sal] = await Promise.all([
    cargarMisInscripciones(E.YO), cargarMisAcompanantes(), seguro(cargarSalidas(), E.BD.salidas, 'las salidas')]);
  E.BD.salidas = sal;
  const u = E.BD.usuarios[E.YO];
  const aparte = u ? soloHistoricos(u.viajes, E.DERIVADOS) : null;   // lo que no viene de inscripciones
  aplicarInscripciones(ins, acomp);
  if(u) u.viajes = historialDe({viajes_historicos: aparte}, ins);
}

/* Guarda mis datos de montaña y mi historial (lo que hay en E.BD.usuarios[YO]). */
export async function guardarFichaPropia(){
  const u = E.BD.usuarios[E.YO];
  if(!E.YO || !u) return;
  const {viajero, privado} = datosAFicha(u.datos);
  const fila = await guardarMiFicha(
    Object.assign({id: E.YO}, viajero, {viajes_historicos: soloHistoricos(u.viajes, E.DERIVADOS)}), privado);
  E.MI = fila;
}
