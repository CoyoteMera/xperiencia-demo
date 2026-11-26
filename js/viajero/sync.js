/* Sincroniza el estado de la app (E) con la base: carga todo al entrar y guarda mi ficha.
   Es el puente entre almacen.js (red, sin estado) y las pantallas. No toca el DOM. */
import { E } from './estado.js';
import { cargarMiFicha, guardarMiFicha, cargarMisInscripciones, cargarMisAcompanantes,
         cargarSalidas, cargarPoliticas, cargarCuentas, cargarMisAbonos, cargarMisRequisitos } from './almacen.js';
import { fichaADatos, datosAFicha, historialDe, soloHistoricos } from './ficha.js';
import { rechazosVigentes } from './guia.js';

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
  const [ins, acomp, sal, pol, cuentas, abonos, requisitos] = await Promise.all([
    seguro(cargarMisInscripciones(E.YO), [], 'tus inscripciones'),
    seguro(cargarMisAcompanantes(), [], 'tus acompañantes'),
    seguro(cargarSalidas(), [], 'las salidas'),
    seguro(cargarPoliticas(), {}, 'las políticas'),
    seguro(cargarCuentas(), [], 'las cuentas de pago'),
    seguro(cargarMisAbonos(E.YO), [], 'tus comprobantes'),
    seguro(cargarMisRequisitos(), [], 'tus requisitos')
  ]);
  E.POLITICAS = pol;
  E.CUENTAS = cuentas;
  E.BD.salidas = sal;
  aplicarInscripciones(ins, acomp, abonos, requisitos);
  const u = fichaADatos(ficha.viajero, ficha.privado);
  u.viajes = historialDe(ficha.viajero, ins);
  E.BD.usuarios = {};
  E.BD.usuarios[E.YO] = u;
  return true;
}

function aplicarInscripciones(ins, acomp, abonos, requisitos){
  E.INSCRIPCIONES = ins;
  E.ACOMPANANTES = acomp;
  E.RECHAZOS = rechazosVigentes(abonos, {inscripciones: ins, acompanantes: acomp});   // los mismos que pinta «Mi viaje»
  E.REQUISITOS = requisitos || [];
  E.DERIVADOS = ins.filter(i => i.estado_mostrado === 'viajo' && i.destino_id).map(i => i.destino_id);
  E.BD.misViajes = ins.filter(i => i.estado_mostrado !== 'cancelada').map(i => ({salida_id: i.salida_id, estado: i.estado_mostrado}));
}

/* Vuelve a leer inscripciones, acompañantes, comprobantes, requisitos y cupos (después de inscribirme
   o de subir un comprobante). */
export async function recargarMiViaje(){
  const [ins, acomp, sal, abonos, requisitos] = await Promise.all([
    cargarMisInscripciones(E.YO), cargarMisAcompanantes(), seguro(cargarSalidas(), E.BD.salidas, 'las salidas'),
    seguro(cargarMisAbonos(E.YO), [], 'tus comprobantes'), seguro(cargarMisRequisitos(), [], 'tus requisitos')]);
  E.BD.salidas = sal;
  const u = E.BD.usuarios[E.YO];
  const aparte = u ? soloHistoricos(u.viajes, E.DERIVADOS) : null;   // lo que no viene de inscripciones
  aplicarInscripciones(ins, acomp, abonos, requisitos);
  if(u) u.viajes = historialDe({viajes_historicos: aparte}, ins);
}

/* Guarda mis datos de montaña y mi historial (lo que hay en E.BD.usuarios[YO]). Después vuelve a leer
   mi viaje: los requisitos que son datos (contacto de emergencia, talla…) pueden haber quedado
   cumplidos, y «Mi viaje» no debe seguir pidiéndolos. Si esa lectura falla, lo guardado vale igual. */
export async function guardarFichaPropia(){
  const u = E.BD.usuarios[E.YO];
  if(!E.YO || !u) return;
  const {viajero, privado} = datosAFicha(u.datos);
  const fila = await guardarMiFicha(
    Object.assign({id: E.YO}, viajero, {viajes_historicos: soloHistoricos(u.viajes, E.DERIVADOS)}), privado);
  E.MI = fila;
  try{ await recargarMiViaje(); }catch(e){ console.warn('No se pudo recargar tu viaje: ' + e.message); }
}
