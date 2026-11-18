/* Recorrido guiado de la oficina (?demo): ocho pasos, cada uno abre su vista, enmarca con un recuadro
   que late lo que explica y lo cuenta en una tarjeta fija abajo. Al importarse no toca document,
   window ni localStorage; solo iniciarRecorrido() y cerrarRecorrido() lo hacen. */
import { generacion } from '../../comun/guardia.js';
import { esc } from '../../comun/util.js';

const CLAVE = 'xp-demo-recorrido-oficina';

export const PASOS = [
  {vista: 'alertas', objetivo: '#cajaAlertas .item', titulo: 'Lo urgente, primero',
    texto: 'Al abrir la oficina ves las salidas de los próximos días que todavía tienen plata o papeles pendientes. Nadie tiene que revisar una hoja de cálculo para saberlo.'},
  {vista: 'bandeja', objetivo: '#cajaBandeja .item', titulo: 'Pagos por validar',
    texto: 'Cuando un viajero sube su comprobante, llega aquí. No cuenta en el saldo hasta que la oficina lo revisa y lo valida.'},
  {vista: 'salidas', objetivo: '#cajaSalidas .item', titulo: 'Todas las salidas',
    texto: 'El calendario de salidas, con cupos y semáforo de pagos. Desde aquí se crea una salida nueva.'},
  // El recuadro va en los botones de copiar y exportar: la tabla queda justo debajo, a la vista.
  {vista: 'salida', arg: 'demo-salida-cocuy', objetivo: '#cajaSalida .acciones', titulo: 'Cada salida, con su gente',
    texto: 'Quién va, cuánto ha pagado, cuánto falta y qué requisitos le faltan. La lista se copia o se exporta a Excel con un clic.'},
  {vista: 'enlace', objetivo: '#cajaEnlace button[onclick="enlaceWhatsApp()"]', titulo: 'Inscripciones por enlace',
    texto: 'La oficina arma un enlace a una salida y lo manda por WhatsApp. El cliente se inscribe solo desde su celular.'},
  {vista: 'ficha', arg: 'demo-viajero-uno', objetivo: '#cajaFicha .reqs', titulo: 'La ficha de cada viajero',
    texto: 'Todo lo de una persona en un lugar: sus viajes, abonos, requisitos y descuentos.'},
  {vista: 'cancelacion', arg: {inscripcion: 'demo-insc-4'}, objetivo: '#cc-calculo', titulo: 'Cancelaciones sin cuentas a mano',
    texto: 'El sistema calcula la devolución según la política de Xperiencia y deja constancia de cuándo se pagó.'},
  {vista: 'alertas', objetivo: '#barraDemo .demos', titulo: 'Y el resto del sistema',
    texto: 'Desde aquí ves la app que usa el viajero y el Panel Global con las cifras del negocio.'}
];

export function htmlTarjeta(i, total, paso){
  return '<p class="paso">PASO ' + (i + 1) + ' DE ' + total + '</p>' +
    '<button type="button" class="salir" aria-label="Salir del recorrido">✕</button>' +
    '<h2 id="recorridoTitulo" tabindex="-1">' + esc(paso.titulo) + '</h2>' +
    '<p class="texto">' + esc(paso.texto) + '</p>' +
    '<div class="acciones">' + (i > 0 ? '<button type="button" class="anterior">Anterior</button>' : '') +
    '<button type="button" class="siguiente">' + (i === total - 1 ? 'Terminar' : 'Siguiente') + '</button></div>';
}

/* Quita el recuadro de lo que lo tenga y se lo pone al objetivo. Si no está (vista vacía o que falló
   al cargar) devuelve null: el paso se ve sin recuadro y sin error. Nunca lanza. */
export function enmarcar(raiz, selector){
  try{
    raiz.querySelectorAll('.guia-foco').forEach(e => e.classList.remove('guia-foco'));
    const el = selector ? raiz.querySelector(selector) : null;
    if(!el) return null;
    el.classList.add('guia-foco');
    return el;
  }catch(e){ return null; }
}

/* Memoria de «ya lo vio»: en un almacén tipo localStorage; si no hay o falla (ventana privada), no se recuerda. */
export function yaVisto(almacen){
  try{ return !!almacen && almacen.getItem(CLAVE) === 'visto'; }catch(e){ return false; }
}
export function marcarVisto(almacen){
  try{ if(almacen) almacen.setItem(CLAVE, 'visto'); }catch(e){ /* sin memoria: arranca cada vez */ }
}

// Estado del recorrido abierto (solo existe entre iniciarRecorrido y cerrarRecorrido).
let tarjeta = null, opciones = null, paso = 0, alTeclado = null, medidor = null;
const g = generacion();

const quitarMarco = () => enmarcar(document, null);

/* Alto fijo de arriba (cabecera sticky o barra fija), para que el objetivo no quede debajo. */
function altoFijoArriba(){
  let a = 0;
  ['header', '#barraDemo'].forEach(q => {
    const e = document.querySelector(q);
    if(e && ['sticky', 'fixed'].includes(getComputedStyle(e).position)) a = Math.max(a, e.offsetHeight);
  });
  return a;
}

/* El main deja sitio a la tarjeta (se suma a su relleno de siempre, que ya cubre el menú de abajo) y
   --alto-tabs le dice a la tarjeta dónde apoyarse a 390. */
function medir(){
  if(!tarjeta) return;
  const main = document.querySelector('main'), tabs = document.querySelector('.tabs');
  document.documentElement.style.setProperty('--alto-tabs', (tabs ? tabs.offsetHeight : 72) + 'px');
  if(!main) return;
  main.style.paddingBottom = '';
  main.style.paddingBottom = (parseFloat(getComputedStyle(main).paddingBottom) + tarjeta.offsetHeight + 12) + 'px';
}

async function mostrar(i){
  const mia = g.nueva();
  paso = i;
  const p = PASOS[i];
  quitarMarco();
  // La tarjeta cambia al instante: un segundo Siguiente, mientras la vista carga, sigue desde el paso nuevo.
  tarjeta.innerHTML = htmlTarjeta(i, PASOS.length, p);
  tarjeta.querySelector('#recorridoTitulo').focus({preventScroll: true});
  try{ await opciones.irA(p.vista, p.arg); }catch(e){ /* la vista se enseña como esté */ }
  if(!g.vigente(mia) || !tarjeta) return;   // otro paso o el cierre se adelantó
  const el = enmarcar(document, p.objetivo);
  medir();
  if(!el) return;
  // Sin animación si se pide menos movimiento y en los primeros 3 s de la página: el navegador descarta un
  // desplazamiento suave pedido mientras la página recién carga (el recorrido arranca solo en la primera visita).
  const sinAnimar = performance.now() < 3000 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - altoFijoArriba() - 12, behavior: sinAnimar ? 'auto' : 'smooth'});
}

export async function iniciarRecorrido({irA, almacen}){
  opciones = {irA, almacen};
  // Al terminar de cargar, el navegador restaura el scroll de la visita anterior y deshacía el primer desplazamiento.
  if('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if(!tarjeta){
    tarjeta = document.createElement('section');
    tarjeta.id = 'recorrido';
    tarjeta.setAttribute('role', 'dialog');
    tarjeta.setAttribute('aria-modal', 'false');
    tarjeta.setAttribute('aria-labelledby', 'recorridoTitulo');
    tarjeta.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button');
      if(!b) return;
      if(b.classList.contains('salir')) cerrarRecorrido();
      else if(b.classList.contains('anterior')) mostrar(paso - 1);
      else if(b.classList.contains('siguiente')){ if(paso === PASOS.length - 1) cerrarRecorrido(); else mostrar(paso + 1); }
    });
    document.body.appendChild(tarjeta);
    alTeclado = e => { if(e.key === 'Escape') cerrarRecorrido(); };
    document.addEventListener('keydown', alTeclado);
    if(typeof ResizeObserver !== 'undefined'){
      medidor = new ResizeObserver(medir);
      medidor.observe(tarjeta);
      const tabs = document.querySelector('.tabs');
      if(tabs) medidor.observe(tabs);
    }
  }
  await mostrar(0);
}

export function cerrarRecorrido(){
  if(!tarjeta) return;
  g.nueva();   // lo que esté cargando ya no enmarca
  quitarMarco();
  tarjeta.remove();
  tarjeta = null;
  document.removeEventListener('keydown', alTeclado);
  if(medidor){ medidor.disconnect(); medidor = null; }
  const main = document.querySelector('main');
  if(main) main.style.paddingBottom = '';
  document.documentElement.style.removeProperty('--alto-tabs');
  marcarVisto(opciones && opciones.almacen);
  const b = document.querySelector('#barraDemo .recorrido');
  if(b) b.focus();
}
