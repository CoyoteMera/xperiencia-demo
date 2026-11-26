/* Reglas de contraseña: las mismas en la app del viajero y en acceso.html. Puro. */

export const REGLAS_CLAVE = [
  {sufijo:'largo', ok: v => v.length >= 8,        falta:'al menos 8 caracteres'},
  {sufijo:'mayus', ok: v => /[A-ZÁÉÍÓÚÑ]/.test(v), falta:'una mayúscula'},
  {sufijo:'num',   ok: v => /[0-9]/.test(v),       falta:'un número'}
];

export function claveFloja(v){
  const faltan = REGLAS_CLAVE.filter(r => !r.ok(v)).map(r => r.falta);
  if(!faltan.length) return null;
  return 'Tu contraseña necesita: ' +
    (faltan.length === 1 ? faltan[0]
      : faltan.slice(0,-1).join(', ') + ' y ' + faltan[faltan.length-1]) + '.';
}
