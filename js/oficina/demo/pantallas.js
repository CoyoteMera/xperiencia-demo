/* Botones de la barra demo de la oficina: cada uno abre una vista con irA(id, arg).
   Los args son ids del elenco ficticio (demo/datos.js). Al importarse no toca nada. */
export const PANTALLAS_OFICINA = [
  {id: 'alertas', rotulo: 'Alertas'},
  {id: 'bandeja', rotulo: 'Bandeja'},
  {id: 'salidas', rotulo: 'Salidas'},
  {id: 'salida', rotulo: 'Salida · Cocuy', arg: 'demo-salida-cocuy'},
  {id: 'salida-form', rotulo: 'Nueva salida'},
  {id: 'enlace', rotulo: 'Enlace'},
  {id: 'ficha', rotulo: 'Viajeros'},
  {id: 'ficha', rotulo: 'Ficha · Viajera Uno', arg: 'demo-viajero-uno'},
  {id: 'cancelacion', rotulo: 'Devoluciones'},
  {id: 'cancelacion', rotulo: 'Cancelar · Viajero Cuatro', arg: {inscripcion: 'demo-insc-4'}}
];
