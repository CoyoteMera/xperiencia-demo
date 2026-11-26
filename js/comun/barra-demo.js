/* Barra del modo demo (?demo), común al viajero, la oficina y el Panel Global: sello, selector entre
   las tres demos y, si la app lo pide, botón Recorrido y una fila de pantallas.
   Al importarse no toca document ni window; solo montarBarraDemo() y marcarPildoraActiva() lo hacen. */
import { esc } from './util.js';

export const DEMOS = [
  {app: 'viajero', rotulo: 'Viajero', href: 'index.html?demo'},
  {app: 'oficina', rotulo: 'Oficina', href: 'oficina.html?demo'},
  {app: 'panel', rotulo: 'Panel', href: 'panel.html?demo'}
];

// Lucide «route», en línea como el resto de iconos de la app.
const ICONO_RECORRIDO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="19" r="3"/>' +
  '<path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>';

// El selector no usa <nav>: base.css y viajero.css dan a cualquier nav posición fija abajo.
export function htmlBarraDemo({app, pantallas = [], conRecorrido = false}){
  const demos = DEMOS.map(d => '<a href="' + d.href + '"' + (d.app === app ? ' aria-current="page"' : '') + '>' + d.rotulo + '</a>').join('');
  return '<div class="fila"><span class="sello">DEMO</span><div class="demos" role="navigation" aria-label="Demos">' + demos + '</div>' +
    '<span class="letrero">Datos ficticios. Nada se guarda.</span>' +
    (conRecorrido ? '<button type="button" class="recorrido">' + ICONO_RECORRIDO + 'Recorrido</button>' : '') + '</div>' +
    (pantallas.length
      ? '<div class="botones">' + pantallas.map((p, i) => '<button type="button" data-i="' + i + '">' + esc(p.rotulo) + '</button>').join('') + '</div>'
      : '');
}

// Estado del módulo: se fija en montarBarraDemo.
let pantallasMontadas = [], vivaIdMontado = () => undefined;
let ultima = null;      // índice del último botón pulsado (dos botones pueden ir a la misma vista)
let esperando = false;  // pulsado, pero la vista aún no llegó (irA de la oficina es asíncrono)
let marcado = null;     // botón que lleva aria-current ahora, para centrar solo al cambiar
let abiertaEn = 0;

/* Deslizamiento con ease, salvo que la persona pida menos movimiento. Los primeros segundos tras abrir
   el enlace van sin animación: la app entra sola a otra pantalla y dos deslizamientos seguidos dejaban
   la píldora activa fuera de vista. */
const suave = () => (Date.now() - abiertaEn < 3000) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) ? 'auto' : 'smooth';

/* Centra la píldora en su fila SIN mover la página (scrollIntoView arrastraba el scroll vertical hasta
   la barra cada vez que algo cambiaba una clase). */
function centrar(b, behavior){
  const caja = b.parentElement;
  const r = b.getBoundingClientRect(), rc = caja.getBoundingClientRect();
  caja.scrollTo({left: caja.scrollLeft + (r.left - rc.left) - (caja.clientWidth - r.width) / 2, behavior});
}

/* Marca la pantalla que de verdad está viva (no la que se pidió): ir() puede rebotar. */
export function marcarPildoraActiva(){
  const id = vivaIdMontado();
  if(ultima !== null){
    if(pantallasMontadas[ultima] && pantallasMontadas[ultima].id === id) esperando = false;
    else if(!esperando) ultima = null;
  }
  let activo = ultima !== null && pantallasMontadas[ultima].id === id ? ultima : pantallasMontadas.findIndex(p => p.id === id);
  let nuevo = null;
  document.querySelectorAll('#barraDemo button[data-i]').forEach(b => {
    if(+b.dataset.i === activo){ b.setAttribute('aria-current', 'page'); nuevo = b; }
    else b.removeAttribute('aria-current');
  });
  if(nuevo && nuevo !== marcado) centrar(nuevo, suave());
  marcado = nuevo;
}

export function montarBarraDemo({app, pantallas = [], conRecorrido = false, alPulsar, vivaId, alRecorrido, fija = false}){
  const c = document.getElementById('barraDemo');
  if(!c) return;
  pantallasMontadas = pantallas;
  vivaIdMontado = vivaId || (() => undefined);
  ultima = null; esperando = false; marcado = null;
  c.innerHTML = htmlBarraDemo({app, pantallas, conRecorrido});
  c.hidden = false;
  c.querySelectorAll('button[data-i]').forEach(b => b.addEventListener('click', () => {
    ultima = +b.dataset.i; esperando = true;
    if(alPulsar) alPulsar(pantallas[ultima]);
    marcarPildoraActiva();
  }));
  const r = c.querySelector('.recorrido');
  if(r && alRecorrido) r.addEventListener('click', alRecorrido);
  abiertaEn = Date.now();
  if(fija){
    // El relleno de arriba del body sale de la altura real de la barra (--alto-barra-demo, en demo.css).
    const medir = () => document.documentElement.style.setProperty('--alto-barra-demo', c.offsetHeight + 'px');
    medir();
    if(typeof ResizeObserver !== 'undefined') new ResizeObserver(medir).observe(c);
    else window.addEventListener('resize', medir);
    document.body.classList.add('con-barra-demo');
  }
  if(!pantallas.length) return;
  marcarPildoraActiva();
  // Las fuentes cambian el ancho de las píldoras: se vuelve a centrar la activa cuando llegan.
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if(marcado) centrar(marcado, 'auto'); });
  // Cualquier ir() de la app (menú inferior, entrada sola) cambia la clase «viva»: la barra la sigue.
  new MutationObserver(marcarPildoraActiva).observe(document.body,
    {subtree: true, attributes: true, attributeFilter: ['class']});
}
