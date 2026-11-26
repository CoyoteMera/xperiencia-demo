/* Historial de viajes (validar) y datos de montaña. */
import { E } from './estado.js';
import { ESCALERA, PARAMOS, DISFRUTE, nombreDe } from './catalogo.js';
import { cuenta } from './nivel.js';
import { guardarFichaPropia } from './sync.js';
import { ir } from './nav.js';
import { recuperarIntencion } from './link.js';
import { nombreDoc } from './ficha.js';
import { falloDe } from '../comun/supa.js';
import { faltaComprobante } from './guia.js';
import { mostrarError, marcarCampos, avisar, esc, hoyBogota, sumarAnios } from '../comun/util.js';

/* ══════════════════ PANTALLA: VALIDAR ══════════════════ */
export function pintarValidar(){
  document.getElementById('pasosValidar').style.display = E.onboarding ? 'flex' : 'none';
  document.getElementById('btnVolverHist').style.display = E.onboarding ? 'none' : 'block';
  document.getElementById('btnAtrasHist').style.display = E.onboarding ? 'block' : 'none';
  document.getElementById('cejillaValidar').textContent = E.onboarding ? 'Paso 4 de 4' : 'Tu historial';
  document.getElementById('btnGuardarHist').textContent =
    E.onboarding ? 'Terminar mi registro' : 'Guardar mi historial';
  const v = E.BD.usuarios[E.YO].viajes;
  const m = cuenta(v);
  const grupo = (titulo, lista) =>
    '<div class="tarjeta"><div class="cejilla">' + titulo + '</div>' +
    lista.map(d => {
      const on = m[d] > 0;
      return '<label class="check' + (on?' on':'') + '">' +
        '<input type="checkbox" value="' + esc(d) + '"' + (on?' checked':'') + '>' +
        '<span>' + esc(nombreDe(d)) + (m[d]>1 ? '<em>' + m[d] + ' veces</em>' : '') + '</span></label>';
    }).join('') + '</div>';

  document.getElementById('cajaValidar').innerHTML =
    grupo('Nevados', ESCALERA) + grupo('Páramos', PARAMOS) + grupo('Otros destinos', DISFRUTE);

  document.querySelectorAll('#cajaValidar .check').forEach(l => {
    l.querySelector('input').addEventListener('change', e =>
      l.classList.toggle('on', e.target.checked));
  });
}
export async function guardarValidacion(){
  const marcados = [...document.querySelectorAll('#cajaValidar input:checked')].map(i => i.value);
  const viejos = E.BD.usuarios[E.YO].viajes;
  const m = cuenta(viejos);
  // conserva las repeticiones que ya teníamos; agrega los nuevos una vez
  const nuevos = [];
  marcados.forEach(d => {
    const veces = m[d] || 1;
    for(let i=0;i<veces;i++) nuevos.push(d);
  });
  E.BD.usuarios[E.YO].viajes = nuevos;
  try{
    await guardarFichaPropia();
  }catch(e){
    E.BD.usuarios[E.YO].viajes = viejos;
    return avisar(falloDe(e, 'guardar tu historial'), true);
  }
  const veniaDelRegistro = E.onboarding;
  E.onboarding = false;
  if(veniaDelRegistro && faltaComprobante(E.INSCRIPCIONES)){
    avisar('Registro listo. Ahora sube el comprobante de tu abono.');
    return ir('pMiViaje');
  }
  avisar('Listo, guardamos tu historial.');
  ir(recuperarIntencion() ? 'pInscribir' : 'pEscalera');
}

/* ══════════════════ PANTALLA: MIS DATOS ══════════════════ */
const CAMPOS_DATOS = ['dNac','dCiudad','dIg','dEps','dRh','dCondicion','dAlergia',
  'dMedicamento','dDieta','dEmerg','dTelEmerg','dParentesco','dTalla','dComo'];
const OBLIGATORIOS = {dNac:'tu fecha de nacimiento', dCiudad:'tu ciudad',
  dEps:'tu EPS', dEmerg:'tu contacto de emergencia', dTelEmerg:'el celular de tu contacto'};

export function pintarDatos(){
  const u = E.BD.usuarios[E.YO];
  const d = u.datos || {};
  CAMPOS_DATOS.forEach(k => {
    const el = document.getElementById(k);
    if(d[k]) el.value = d[k];
    else if(el.tagName === 'SELECT') el.selectedIndex = 0;   // sin dato: la opción por defecto
    else el.value = '';
  });
  document.getElementById('docRegistrado').textContent =
    nombreDoc(u.tipoDoc || 'CC') + (u.numDoc ? ' N.º ' + u.numDoc : '') +
    '';
  document.getElementById('pasosDatos').style.display = E.onboarding ? 'flex' : 'none';
  document.getElementById('btnVolverDatos').style.display = E.onboarding ? 'none' : 'block';
  document.getElementById('cejillaDatos').textContent =
    E.onboarding ? 'Paso 3 de 4' : 'Datos para viajar';
  document.getElementById('btnGuardarDatos').textContent =
    E.onboarding ? 'Guardar y continuar' : 'Guardar mis datos';
}
/* Todo lo que falla en Tus datos, en el orden de la pantalla. La edad se compara como texto
   AAAA-MM-DD (sin Date local): entre 5 y 100 años cumplidos hoy. */
export function validarDatos(d, hoy = hoyBogota()){
  const fallas = [];
  for(const k in OBLIGATORIOS){
    const v = (d[k] || '').trim();
    if(!v){ fallas.push({id: k, msg: 'Nos falta ' + OBLIGATORIOS[k] + '.'}); continue; }
    if(k === 'dNac'){
      const bien = /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= hoy &&
        v <= sumarAnios(hoy, -5) && v >= sumarAnios(hoy, -100);
      if(!bien) fallas.push({id: k, msg: 'Revisa tu fecha de nacimiento.'});
    }
    if(k === 'dTelEmerg' && v.replace(/\D/g, '').length < 10)
      fallas.push({id: k, msg: 'El celular de tu contacto debe tener 10 dígitos.'});
  }
  return fallas;
}
export async function guardarDatos(){
  const d = {};
  CAMPOS_DATOS.forEach(k => d[k] = document.getElementById(k).value.trim());
  const fallas = validarDatos(d);
  if(fallas.length) return mostrarError('dError', fallas.map(f => esc(f.msg)).join('<br>'), fallas.map(f => f.id));
  const antes = E.BD.usuarios[E.YO].datos;
  E.BD.usuarios[E.YO].datos = d;
  try{
    await guardarFichaPropia();
  }catch(e){
    E.BD.usuarios[E.YO].datos = antes;
    return mostrarError('dError', esc(falloDe(e, 'guardar tus datos')));
  }
  document.getElementById('dError').innerHTML = '';
  marcarCampos([]);
  avisar('Listo, guardamos tus datos.');
  if(E.onboarding) return ir('pValidar');
  ir('pEscalera');
}
export function datosCompletos(){
  const d = E.BD.usuarios[E.YO].datos;
  if(!d) return false;
  return Object.keys(OBLIGATORIOS).every(k => d[k]);
}
