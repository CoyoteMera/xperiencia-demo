/* Guía del viajero: qué le falta por hacer, leído de lo que ya trae la base. Pura (sin document,
   window ni Supabase): la usan «Mi viaje» y, después, el bloque de pendientes de «Mi nivel».
   No suma ni resta dinero: los montos se muestran tal como vienen. */
import { fmtDinero } from '../comun/util.js';

const instante = t => { const n = Date.parse(t); return isFinite(n) ? n : null; };

/* De mis abonos (cargarMisAbonos), los rechazos que el viajero todavía tiene que atender: uno por
   cada inscripción a la que iba el abono rechazado, mientras no haya subido otro comprobante para
   ESA inscripción después del rechazo (creado_at del otro > validado_at del rechazado). Dos rechazos
   seguidos: el segundo es «otro comprobante subido después», así que solo queda el último.
   Las horas de Postgres se comparan como fechas, no como texto (pueden venir con zonas distintas).
   El más reciente primero. → [{abono_id, inscripcion_id, monto, moneda, motivo}]
   Con {inscripciones, acompanantes}, solo los que «Mi viaje» pinta: de mis inscripciones activas (ni
   canceladas ni ya viajadas) y, si soy el titular, de mis acompañantes no cancelados en esa salida.
   Así «Mi nivel» no avisa de un rechazo que no se puede ver ni atender. */
export function rechazosVigentes(abonos, visibles){
  const todos = vigentes(abonos);
  if(!visibles) return todos;
  const activa = i => i && i.estado_mostrado !== 'cancelada' && i.estado_mostrado !== 'viajo';
  const acomp = Array.isArray(visibles.acompanantes) ? visibles.acompanantes : [];
  const se = new Set();
  for(const i of (Array.isArray(visibles.inscripciones) ? visibles.inscripciones : []).filter(activa)){
    se.add(i.inscripcion_id);
    if(!i.titular_id) acomp.filter(a => a.salida_id === i.salida_id && a.estado !== 'cancelada')
      .forEach(a => se.add(a.inscripcion_id));
  }
  return todos.filter(r => se.has(r.inscripcion_id));
}
function vigentes(abonos){
  const lista = Array.isArray(abonos) ? abonos : [];
  const asignadas = a => (a.asignaciones || []).map(x => x.inscripcion_id);
  const salida = [];
  for(const a of lista){
    if(a.estado !== 'rechazado') continue;
    const resuelto = instante(a.validado_at) ?? instante(a.creado_at);
    for(const insc of new Set(asignadas(a))){
      const tapado = lista.some(b => b !== a && b.id !== a.id && asignadas(b).includes(insc) &&
        resuelto !== null && instante(b.creado_at) !== null && instante(b.creado_at) > resuelto);
      if(!tapado) salida.push({orden: resuelto ?? 0,
        r: {abono_id: a.id, inscripcion_id: insc, monto: a.monto, moneda: a.moneda, motivo: a.motivo_rechazo || ''}});
    }
  }
  return salida.sort((x, y) => y.orden - x.orden).map(x => x.r);
}

/* El aviso de un rechazo. Con `paraQuien`, el comprobante se subió a nombre de un acompañante. */
export function textoRechazo(r, paraQuien){
  const monto = fmtDinero(r.monto, r.moneda);
  const motivo = String(r.motivo || '').trim().replace(/[.\s]+$/, '');
  return (paraQuien
    ? 'No pudimos validar el comprobante de ' + monto + ' que subiste para ' + paraQuien
    : 'No pudimos validar tu comprobante de ' + monto) +
    (motivo ? ': ' + motivo : '') + '. Sube otro.';
}

/* ¿Alguna inscripción espera el primer comprobante? Pendiente y sin nada por validar (Number > 0,
   sin sumar ni restar). */
export function faltaComprobante(inscripciones){
  return (Array.isArray(inscripciones) ? inscripciones : [])
    .some(i => i && i.estado_mostrado === 'pendiente' && !(Number(i.por_validar) > 0));
}

/* Lo que «Mi nivel» le recuerda a la persona, en este orden y solo lo que aplique.
   → [{texto, boton, destino}] */
export function pendientesDeNivel({rechazos, datosCompletos, inscripciones}){
  const salida = [];
  if(Array.isArray(rechazos) && rechazos.length) salida.push({
    texto: 'Rechazamos un comprobante tuyo. Mira el motivo y sube otro.', boton: 'Ir a «Mi viaje»', destino: 'pMiViaje'});
  if(!datosCompletos) salida.push({
    texto: 'Faltan tus datos de montaña.', boton: 'Ir a «Tus datos»', destino: 'pDatos'});
  if(faltaComprobante(inscripciones)) salida.push({
    texto: 'Tu inscripción espera el comprobante de tu abono.', boton: 'Ir a «Mi viaje»', destino: 'pMiViaje'});
  return salida;
}
