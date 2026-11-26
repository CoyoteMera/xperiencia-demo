/* Navegación entre pantallas. Importa los pintar*: los ciclos de import solo se usan al llamar a ir(). */
import { E } from './estado.js';
import { pintarEscalera } from './nivel.js';
import { pintarValidar, pintarDatos } from './datos.js';
import { pintarInscribir } from './inscribir.js';
import { pintarMiViaje, pintarComprobante, pintarEnviado } from './miviaje.js';
import { pintarSalidas } from './salidas.js';
import { pintarTours } from './tours.js';
import { guardarPantalla } from './link.js';

export function ir(id){
  document.getElementById('navegador').style.display =
    (E.YO && !E.onboarding) ? 'flex' : 'none';
  document.querySelectorAll('.pantalla').forEach(s => s.classList.remove('viva'));
  document.getElementById(id).classList.add('viva');
  // «Inscribirme», «Comprobante» y «Comprobante enviado» cuelgan de «Mi viaje»: ese botón del menú queda encendido
  const enMenu = (id === 'pInscribir' || id === 'pComprobante' || id === 'pEnviado') ? 'pMiViaje' : id;
  document.querySelectorAll('nav button').forEach(b =>
    b.classList.toggle('on', b.dataset.p === enMenu));
  window.scrollTo(0,0);
  guardarPantalla(E.UID, id, E.onboarding);
  if(id==='pEscalera') pintarEscalera();
  if(id==='pValidar') pintarValidar();
  if(id==='pInscribir') pintarInscribir();
  if(id==='pMiViaje') pintarMiViaje();
  if(id==='pComprobante') pintarComprobante();
  if(id==='pEnviado') pintarEnviado(E.ULTIMO_ENVIO);
  if(id==='pSalidas') pintarSalidas();
  if(id==='pDatos') pintarDatos();
  if(id==='pTours') pintarTours();
}
