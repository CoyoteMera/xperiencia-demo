/* Punto de entrada del Panel Global. Es el único módulo del panel que arranca cosas: render.js
   solo exporta funciones y no toca document ni Supabase al importarse. Solo lectura: ningún botón
   escribe en la base. El bloqueo por rol es de interfaz (la oficina ve todo de todos modos). */
import { iniciarSupa, supa, errorDeBase, falloDe } from '../comun/supa.js';
import { exigirRol } from '../comun/sesion.js';
import { esc, hoyBogota } from '../comun/util.js';
import { unaSolaVez, generacion } from '../comun/guardia.js';
import { filasInscritos } from '../oficina/salidas.js';
import { crearClientePanelDemo } from './demo/cliente.js';
import { montarBarraDemo } from '../comun/barra-demo.js';
import { tarjetasTotales, renderSalidasProximas, renderTablaSalida, opcionesMes, renderSelectorMes, renderMes, rotuloVerViajeros }
  from './render.js';

const el = id => document.getElementById(id);
const fallo = (caja, e) => { el(caja).innerHTML = '<div class="error">' + esc(falloDe(e, 'cargar')) + '</div>'; };

/* ── Salidas ─────────────────────────────────────────────── */
const vSalidas = generacion();   // una recarga lenta no pisa a una más nueva

const cargarSalidas = unaSolaVez(async function(){
  const mia = vSalidas.nueva();
  try{
    const [tot, sal] = await Promise.all([
      supa.from('v_panel_totales').select('*'),
      supa.from('v_salida_resumen').select('*').gte('fecha_inicio', hoyBogota()).order('fecha_inicio')
    ]);
    if(tot.error) throw errorDeBase(tot.error);
    if(sal.error) throw errorDeBase(sal.error);
    if(!vSalidas.vigente(mia)) return;
    el('cajaTotales').innerHTML = tarjetasTotales(tot.data || []);
    el('cajaSalidas').innerHTML = renderSalidasProximas(sal.data || []);
  }catch(e){ if(vSalidas.vigente(mia)) fallo('cajaTotales', e); }
});

/* Abre o cierra la tabla de viajeros de una salida (mismas vistas que la oficina). Una guarda por
   salida: un doble clic no la carga dos veces y abrir otra mientras carga no estorba. */
const guardas = new Map();
const vTabla = new Map();

async function abrirTabla(id){
  const caja = el('tabla-' + id);
  if(!caja) return;
  const boton = document.querySelector('[aria-controls="tabla-' + id + '"]');
  const abierto = abierta => {
    if(!boton) return;
    boton.setAttribute('aria-expanded', abierta ? 'true' : 'false');
    const rot = boton.querySelector('.rot');
    if(rot) rot.textContent = rotuloVerViajeros(abierta);
  };
  if(!caja.hidden){ caja.hidden = true; abierto(false); return; }
  if(!vTabla.has(id)) vTabla.set(id, generacion());
  const g = vTabla.get(id), mia = g.nueva();
  caja.hidden = false;
  abierto(true);
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const sal = await supa.from('v_inscripcion_saldo').select('*').eq('salida_id', id);
    if(sal.error) throw errorDeBase(sal.error);
    const viajeros = [...new Set((sal.data || []).map(s => s.viajero_id))];
    const nombres = {};
    if(viajeros.length){
      const v = await supa.from('viajero').select('id, nombre').in('id', viajeros);
      if(v.error) throw errorDeBase(v.error);
      for(const x of v.data || []) nombres[x.id] = x.nombre;
    }
    if(!g.vigente(mia)) return;
    caja.innerHTML = renderTablaSalida(filasInscritos(sal.data || [], nombres), demo);
  }catch(e){
    if(g.vigente(mia)) caja.innerHTML = '<div class="error">' + esc(falloDe(e, 'cargar')) + '</div>';
  }
}

function alternarSalida(id){
  if(!guardas.has(id)) guardas.set(id, unaSolaVez(() => abrirTabla(id)));
  return guardas.get(id)();
}

/* ── Mes ─────────────────────────────────────────────────── */
const vMes = generacion();
let datosMes = null;    // {mes: filas de v_panel_mes, cuentas: filas de v_panel_cuentas}
let mesElegido = null;

function pintarMes(){
  const opciones = opcionesMes(datosMes.mes.map(f => f.mes), hoyBogota());
  if(!opciones.some(o => o.valor === mesElegido)) mesElegido = opciones.find(o => o.valor === hoyBogota().slice(0, 7) + '-01').valor;
  el('cajaSelectorMes').innerHTML = renderSelectorMes(opciones, mesElegido);
  el('cajaMes').innerHTML = renderMes(datosMes.mes, datosMes.cuentas, mesElegido);
}

const cargarMes = unaSolaVez(async function(){
  const mia = vMes.nueva();
  try{
    const [m, c] = await Promise.all([supa.from('v_panel_mes').select('*'), supa.from('v_panel_cuentas').select('*')]);
    if(m.error) throw errorDeBase(m.error);
    if(c.error) throw errorDeBase(c.error);
    if(!vMes.vigente(mia)) return;
    datosMes = {mes: m.data || [], cuentas: c.data || []};
    pintarMes();
  }catch(e){ if(vMes.vigente(mia)) fallo('cajaMes', e); }
});

function cambiarMes(valor){
  if(!datosMes) return;
  mesElegido = valor;
  pintarMes();
}

/* ── Navegación ──────────────────────────────────────────── */
async function irPanel(id){
  document.querySelectorAll('main > .pantalla').forEach(s => s.classList.remove('viva'));
  const seccion = el('v-' + id);
  if(seccion) seccion.classList.add('viva');
  document.querySelectorAll('#tabsPanel [data-tab]').forEach(b => {
    const on = b.dataset.tab === id;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  window.scrollTo(0, 0);
  if(id === 'mes') await cargarMes(); else await cargarSalidas();
}

const demo = new URLSearchParams(location.search).has('demo');

const salirPanel = unaSolaVez(async function(){
  try{ if(supa) await supa.auth.signOut(); }catch(e){}
  location.replace(demo ? 'index.html?demo' : 'acceso.html');
});

/* Los onclick/onchange del HTML buscan estas funciones en window. */
Object.assign(window, {irPanel, salirPanel, alternarSalida, cambiarMes});

async function arrancar(){
  const errorDeConexion = iniciarSupa(demo ? {cliente: crearClientePanelDemo()} : undefined);
  if(errorDeConexion){
    const c = el('avisoSinRed');
    el('appPanel').hidden = false;
    c.style.display = 'block';
    c.innerHTML = errorDeConexion.message === 'sdk-bloqueado'
      ? '<b>Esta vista no puede conectarse.</b> Abre el Panel Global desde tu navegador.'
      : '<b>No pudimos conectar con el servidor.</b> Revisa tu internet y vuelve a entrar.';
    return;
  }
  // Sin sesión o sin rol de dueño: exigirRol redirige a acceso.html y no se muestra nada.
  const acceso = await exigirRol(['dueno']);
  if(!acceso) return;
  el('appPanel').hidden = false;
  if(demo){
    el('enlaceOficina').href = 'oficina.html?demo';
    montarBarraDemo({app: 'panel'});
  }
  await irPanel('salidas');
}

arrancar();
