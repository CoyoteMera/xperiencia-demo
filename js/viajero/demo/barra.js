/* Barra del modo demo (?demo): salta a cualquier pantalla del viajero con datos ficticios.
   Al importarse no toca document ni window; solo pintarBarraDemo() e irDemo() lo hacen. */
import { E } from '../estado.js';
import { ir } from '../nav.js';
import { modoCrearCuenta } from '../sesion.js';
import { abrirComprobante } from '../miviaje.js';
import { montarBarraDemo, marcarPildoraActiva } from '../../comun/barra-demo.js';

const ONBOARDING = ['pEntrada', 'pRegistro', 'pOlvide', 'pClaveNueva', 'pInscribir', 'pDatos', 'pValidar'];

export const PANTALLAS_DEMO = [
  {id: 'pEntrada', rotulo: 'Entrada'},
  {id: 'pRegistro', rotulo: 'Crear cuenta', preparar: () => modoCrearCuenta()},
  {id: 'pOlvide', rotulo: 'Olvidé mi contraseña'},
  {id: 'pClaveNueva', rotulo: 'Contraseña nueva'},
  {id: 'pInscribir', rotulo: 'Tu viaje (paso 2)'},
  {id: 'pDatos', rotulo: 'Tus datos (paso 3)'},
  {id: 'pValidar', rotulo: 'Tu historial (paso 4)'},
  {id: 'pEscalera', rotulo: 'Mi nivel'},
  {id: 'pTours', rotulo: 'Destinos'},
  {id: 'pSalidas', rotulo: 'Próximas salidas'},
  {id: 'pMiViaje', rotulo: 'Mi viaje'},
  // El comprobante necesita saber a qué inscripción va: se abre con la primera de Viajera Uno.
  {id: 'pComprobante', rotulo: 'Subir comprobante', preparar: () => {
    const i = (E.INSCRIPCIONES || [])[0];
    if(i) abrirComprobante(i.inscripcion_id);
  }},
  // Sin envío real, la pantalla enseña el de la inscripción del elenco: $780.000 · Transferencia.
  {id: 'pEnviado', rotulo: 'Comprobante enviado', preparar: () => {
    E.ULTIMO_ENVIO = {monto: 780000, moneda: 'COP', medio: 'Transferencia'};
  }}
];

/** ¿La URL trae el parámetro demo? (`?demo`, `?demo=1`, `?plan=x&demo`; no `?demonio`). */
export function esDemo(search){
  return new URLSearchParams(search).has('demo');
}

export function pintarBarraDemo(){
  montarBarraDemo({app: 'viajero', pantallas: PANTALLAS_DEMO, alPulsar: p => irDemo(p.id),
    vivaId: () => (document.querySelector('.pantalla.viva') || {}).id, fija: true});
}

export function irDemo(id){
  const p = PANTALLAS_DEMO.find(x => x.id === id);
  if(!p) return;
  E.onboarding = ONBOARDING.includes(id);
  if(p.preparar) p.preparar();
  ir(id);
  marcarPildoraActiva();
}
