/* Traducción entre la ficha de la base (viajero + viajero_privado) y las pantallas del demo
   (E.BD.usuarios[YO] con `datos` dNac, dEps…). Funciones puras: no tocan DOM ni red. */

const CAMPOS_VIAJERO = [            // columna de viajero  ←  campo de la pantalla
  ['nacimiento', 'dNac'], ['ciudad', 'dCiudad'], ['instagram', 'dIg'],
  ['talla', 'dTalla'], ['dieta', 'dDieta'], ['como_nos_conocio', 'dComo']
];
const CAMPOS_PRIVADO = [            // columna de viajero_privado  ←  campo de la pantalla
  ['eps', 'dEps'], ['rh', 'dRh'], ['condicion', 'dCondicion'], ['alergias', 'dAlergia'],
  ['medicamentos', 'dMedicamento'], ['emergencia_nombre', 'dEmerg'],
  ['emergencia_tel', 'dTelEmerg'], ['emergencia_parentesco', 'dParentesco']
];

/* La base guarda el tipo de documento como código (así lo deja también la migración). */
export const TIPOS_DOC = [['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'],
  ['TI', 'Tarjeta de identidad'], ['PASAPORTE', 'Pasaporte'], ['PPT', 'PPT']];
export const nombreDoc = codigo => (TIPOS_DOC.find(t => t[0] === codigo) || [null, codigo || ''])[1];

const texto = v => (v === null || v === undefined) ? '' : String(v);
const nulo = v => { const t = texto(v).trim(); return t === '' ? null : t; };

/* De la base a la pantalla. `datos` siempre es un objeto con todos los campos ('' si no hay). */
export function fichaADatos(viajero, privado){
  const v = viajero || {}, p = privado || {};
  const datos = {};
  CAMPOS_VIAJERO.forEach(([col, campo]) => { datos[campo] = texto(v[col]); });
  CAMPOS_PRIVADO.forEach(([col, campo]) => { datos[campo] = texto(p[col]); });
  return {
    nombre: texto(v.nombre), cel: texto(v.celular), mail: texto(v.correo),
    tipoDoc: v.tipo_doc || 'CC', numDoc: texto(v.num_doc),
    datos
  };
}

/* De la pantalla a la base. Lo vacío va como null: una fecha no puede ser "". */
export function datosAFicha(datos){
  const d = datos || {};
  const viajero = {}, privado = {};
  CAMPOS_VIAJERO.forEach(([col, campo]) => { viajero[col] = nulo(d[campo]); });
  CAMPOS_PRIVADO.forEach(([col, campo]) => { privado[col] = nulo(d[campo]); });
  return {viajero, privado};
}

/* Historial que ve la persona: lo que ella (o la migración) apuntó en viajes_historicos más los
   destinos de las salidas que ya hizo con nosotros (estado_mostrado = 'viajo'). */
export function historialDe(viajero, inscripciones){
  const base = Array.isArray(viajero && viajero.viajes_historicos) ? viajero.viajes_historicos : [];
  const hechos = (inscripciones || [])
    .filter(i => i.estado_mostrado === 'viajo' && i.destino_id)
    .map(i => i.destino_id);
  return base.concat(hechos);
}

/* Al guardar el historial editado se quita lo que ya viene de inscripciones, o cada guardado
   lo copiaría a viajes_historicos y la próxima carga lo contaría dos veces. */
export function soloHistoricos(viajes, derivados){
  const restan = {};
  (derivados || []).forEach(d => { restan[d] = (restan[d] || 0) + 1; });
  return (viajes || []).filter(d => {
    if(restan[d] > 0){ restan[d]--; return false; }
    return true;
  });
}
