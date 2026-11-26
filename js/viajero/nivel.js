/* Nivel del viajero: perfil, escalera, premios y territorio. */
import { E } from './estado.js';
import { DESTINOS, ESCALERA, nombreDe, PREMIOS, COLOMBIA, PARQUES, PARQUES_ANIO,
         PARQUES_FUENTE, POBLACION_COL } from './catalogo.js';
import { datosCompletos } from './datos.js';
import { pintarPendientes } from './pendientes.js';
import { pendientesDeNivel } from './guia.js';
import { esc } from '../comun/util.js';

/* ══════════════════ LÓGICA DE NEGOCIO ══════════════════ */

export function tipoDe(id){
  const d = DESTINOS[id];
  if(!d) return 'disfrute';
  return d.tipo === 'Nevado' ? 'nevado' : (d.tipo === 'Páramo' ? 'paramo' : 'disfrute');
}

export function cuenta(viajes){
  const m = {};
  viajes.forEach(v => m[v] = (m[v]||0)+1);
  return m;
}
export function perfilDe(viajes){
  if(!viajes.length) return 'Curioso';
  const u = [...new Set(viajes)];
  const nev = u.filter(d => tipoDe(d)==='nevado');
  const dis = u.filter(d => tipoDe(d)==='disfrute');
  if(!nev.length) return 'Explorador';
  return dis.length ? 'Todoterreno' : 'Montañista';
}
export function nevadosHechos(viajes){
  return [...new Set(viajes)].filter(d => tipoDe(d)==='nevado');
}
export function siguientePaso(viajes){
  const hechos = new Set(nevadosHechos(viajes));
  const faltan = ESCALERA.filter(d => !hechos.has(d));
  if(!faltan.length) return {texto:'Llegaste al nivel máximo. Hablemos de una cumbre nueva.', destino:null};
  if(!hechos.size){
    const tieneParamo = viajes.some(v => tipoDe(v)==='paramo');
    return tieneParamo
      ? {texto:'Ya conoces el páramo. Tu primera montaña es el Cocuy.', destino:'nevado-del-cocuy'}
      : {texto:'Empieza por un páramo para probar, o lánzate al Cocuy.', destino:'nevado-del-cocuy'};
  }
  return {texto:'Tu siguiente montaña es ' + nombreDe(faltan[0]) + '.', destino:faltan[0]};
}

/* ══════════════════ PANTALLA: MI ESCALERA ══════════════════ */

export function pintarEscalera(){
  const u = E.BD.usuarios[E.YO];
  const v = u.viajes;
  const m = cuenta(v);
  const perfil = perfilDe(v);
  const nev = nevadosHechos(v);

  document.getElementById('saludoNombre').textContent =
    'Hola, ' + (u.nombre||'').trim().split(/\s+/)[0] + '.';
  const chip = document.getElementById('chipPerfil');
  chip.textContent = 'Nivel ' + perfil;
  chip.className = 'perfil-chip ' + perfil.toLowerCase().replace('ñ','n');
  document.getElementById('cifraViajes').textContent = v.length;
  document.getElementById('cifraNevados').textContent = nev.length;

  const sig = siguientePaso(v);
  const caja = document.getElementById('laEscalera');
  const hechos = new Set(nev);
  const tieneParamo = v.some(x => tipoDe(x)==='paramo');

  let html = '<div class="peldano fase0' + (tieneParamo ? ' hecho' : '') + '">' +
    '<div class="cota">0</div><div class="nombre-peldano">Páramos — para tomar confianza</div></div>';

  ESCALERA.forEach((d,i) => {
    const hecho = hechos.has(d);
    const sigue = (!hecho && sig.destino === d);
    html += '<div class="peldano' + (hecho?' hecho':'') + (sigue?' sigue':'') + '">' +
      '<div class="cota">' + (i+1) + '</div>' +
      '<div class="nombre-peldano">' + esc(nombreDe(d)) + '</div>' +
      (m[d] > 1 ? '<span class="veces">×' + m[d] + '</span>' : '') +
      (sigue ? '<span class="etiq-sigue">Te lo recomendamos</span>' : '') +
      '</div>';
  });
  caja.innerHTML = html;
  const pct = ESCALERA.length ? Math.round(nev.length / ESCALERA.length * 100) : 0;
  caja.style.setProperty('--avance', pct + '%');

  const otros = Object.keys(m).filter(d => tipoDe(d)==='disfrute');
  const cajaOtros = document.getElementById('cajaOtros');
  if(otros.length){
    cajaOtros.style.display = 'block';
    document.getElementById('listaOtros').innerHTML = otros.map(d =>
      '<span class="pastilla">' + esc(nombreDe(d)) + (m[d]>1 ? '<b>×'+m[d]+'</b>' : '') + '</span>').join('');
  } else cajaOtros.style.display = 'none';

  document.getElementById('recoTexto').textContent = sig.destino
    ? 'Te recomendamos ' + nombreDe(sig.destino) + ' como tu siguiente aventura, teniendo en cuenta tus habilidades y lo que ya has hecho.'
    : 'Llegaste al nivel máximo. Hablemos de una cumbre nueva.';

  const EXPLICA = {
    'Montañista':'Vas por las cumbres. Cada nevado que subes te abre el siguiente.',
    'Todoterreno':'Subes montaña, pero también te gustan las ballenas, los cañones y los pasadías. El mejor de los dos mundos.',
    'Explorador':'Todavía no has pisado un nevado. Conoces Colombia por otros caminos, y la montaña te está esperando.',
    'Curioso':'Ya estás con nosotros, pero todavía no has viajado. Tu primera Xperiencia te espera.'
  };
  document.getElementById('explicaPerfil').textContent = EXPLICA[perfil] || '';
  const bd = document.getElementById('btnMisDatos');
  bd.textContent = datosCompletos() ? 'Mis datos de montaña' : '⚠ Completa tus datos de montaña';
  bd.classList.toggle('pendiente', !datosCompletos());

  pintarPremios(nev.length);
  pintarTerritorio(v);
  pintarPendientes();
  pintarBloquePendientes();

  document.getElementById('avisoValidar').textContent = v.length
    ? '¿Te falta algún viaje? Nuestros registros más viejos están incompletos. Agrégalo tú.'
    : 'Todavía no tenemos viajes tuyos registrados. Si ya fuiste con nosotros, cuéntanos cuáles.';
}

/* «Te falta» de Mi nivel: rechazos, datos de montaña y comprobante, cada uno con su botón. */
function pintarBloquePendientes(){
  const caja = document.getElementById('bloquePendientes');
  if(!caja) return;
  const lista = pendientesDeNivel({rechazos: E.RECHAZOS, datosCompletos: datosCompletos(), inscripciones: E.INSCRIPCIONES});
  if(!lista.length){ caja.innerHTML = ''; caja.style.display = 'none'; return; }
  caja.innerHTML = '<div class="cejilla">Te falta</div>' + lista.map(p =>
    '<div class="pendiente-fila"><p class="explica">' + esc(p.texto) + '</p>' +
    '<button class="btn secundario" onclick="ir(\'' + p.destino + '\')">' + esc(p.boton) + '</button></div>').join('');
  caja.style.display = 'block';
}

/* La insignia de territorio y las cifras de los parques donde ha estado.
   Las cifras solo se muestran de los parques que la persona YA visitó:
   ahí son un reconocimiento, no un argumento de venta. */
export function pintarTerritorio(viajes){
  const caja = document.getElementById('cajaTerritorio');
  if(!caja) return;
  const hechos = new Set(viajes);
  const listos = COLOMBIA.filter(d => hechos.has(d));
  const faltan = COLOMBIA.filter(d => !hechos.has(d));
  const completo = faltan.length === 0;
  const pct = Math.round(listos.length / COLOMBIA.length * 100);

  const mil = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g,'.');

  // un renglón por parque visitado, sin repetir parque
  const vistos = [];
  viajes.forEach(function(d){
    const p = PARQUES[d];
    if(p && vistos.indexOf(p.parque) === -1) vistos.push(p.parque);
  });
  // Tres golpes en orden: cuántos entraron, que tú fuiste uno,
  // y qué parte de Colombia representa eso. El tercero es el que pesa.
  const cifras = vistos.map(function(nombre){
    const p = Object.keys(PARQUES).map(k => PARQUES[k]).find(x => x.parque === nombre);
    const pct = p.visitas / POBLACION_COL * 100;
    const txtPct = pct >= 0.01
      ? pct.toFixed(2).replace('.', ',') + '%'
      : 'menos del 0,01%';
    return '<div class="premio"><div class="medalla cifra">' + txtPct + '</div>' +
      '<div class="premio-txt"><b>' + nombre + '</b><span>' +
      'En ' + PARQUES_ANIO + ' entraron ' + mil(p.visitas) + ' personas. Tú fuiste una de ellas. ' +
      'Haces parte del <b>' + txtPct +
      ' de los colombianos</b> que conoció ese territorio ese año.' +
      '</span></div></div>';
  }).join('');

  let html = '<div class="cejilla">Tu territorio</div>';

  if(completo){
    html += '<div class="premio ganado"><div class="medalla">' + COLOMBIA.length + '</div>' +
      '<div class="premio-txt"><b>Territorio propio</b><span>✓ Hiciste los ' + COLOMBIA.length +
      ' nevados de Colombia. Hay gente que viaja el mundo entero y no conoce el hielo de su casa.' +
      '</span></div></div>';
  }else{
    html += '<div class="premio"><div class="medalla">' + COLOMBIA.length + '</div>' +
      '<div class="premio-txt"><b>Territorio propio</b><span>Los ' + COLOMBIA.length +
      ' nevados de Colombia. Llevas ' + listos.length + '.</span></div></div>' +
      '<div class="barra"><i style="width:'+pct+'%"></i><span style="width:'+pct+'%"></span></div>' +
      '<div class="faltan">Te ' + (faltan.length===1 ? 'falta ' : 'faltan ') +
      faltan.map(nombreDe).join(', ') + '</div>';
  }

  if(cifras){
    html += '<p class="pista" style="margin:18px 0 10px">Cuántos colombianos conocen lo que tú conoces:</p>' + cifras +
      '<p class="pista" style="margin-top:12px">Visitantes a los parques en ' + PARQUES_ANIO +
      ', de ' + PARQUES_FUENTE + ', sobre una población de unos 52 millones. ' +
      'Son personas que entraron al parque — solo una parte llegó a la cumbre.</p>';
  }

  // A quien no ha pisado ninguno no le mostramos una lista de seis pendientes:
  // la escalera de arriba ya le enseña el camino, y esto sonaría a reproche.
  if(!listos.length && !cifras){ caja.style.display = 'none'; caja.innerHTML = ''; return; }
  caja.innerHTML = html;
  caja.style.display = 'block';
}

export function pintarPremios(nHechos){
  const sig = PREMIOS.find(p => nHechos < p.nevados);
  document.getElementById('listaPremios').innerHTML = PREMIOS.map(p => {
    const ganado = nHechos >= p.nevados;
    const esSig  = sig && sig.nevados === p.nevados;
    const faltan = p.nevados - nHechos;
    return '<div class="premio' + (ganado?' ganado':'') + (esSig?' siguiente':'') + '">' +
      '<div class="medalla" title="nevados necesarios">' + p.nevados + '</div>' +
      '<div class="premio-txt"><b>' + p.titulo + '</b><span>' +
        (ganado
          ? '✓ Conseguido · ' + p.detalle
          : 'Se consigue con ' + p.nevados + (p.nevados === 1 ? ' nevado' : ' nevados') + ' · ' +
            (faltan===1 ? 'te falta 1' : 'te faltan ' + faltan)) +
      '</span></div></div>';
  }).join('');
}

export function verPerfiles(){
  const c = document.getElementById('cajaPerfiles');
  const b = document.getElementById('btnPerfiles');
  const abierto = c.style.display !== 'none';
  c.style.display = abierto ? 'none' : 'block';
  b.textContent = abierto ? 'Ver todos los niveles' : 'Ocultar';
}
