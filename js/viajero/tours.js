/* Catálogo de destinos. */
import { E } from './estado.js';
import { TOURS } from './catalogo.js';
import { siguientePaso } from './nivel.js';
import { quieroEstePlan } from './inscribir.js';

/* ══════════════════ PANTALLA: TOURS ══════════════════ */
/* Cada tour trae `di` (destino_id, el mismo de la escalera) y `pi` (plan_id): con eso salen
   «Te lo recomendamos» y «Ya estuviste», y «Quiero ir» deja escogido ese plan. */
export function pintarTours(){
  const v = E.BD.usuarios[E.YO] ? E.BD.usuarios[E.YO].viajes : [];
  const hechos = new Set(v);
  const sig = siguientePaso(v);
  document.getElementById('listaTours').innerHTML = TOURS.map(t =>
    '<div class="tour' + (sig.destino === t.di ? ' reco' : '') + '">' +
      (sig.destino === t.di ? '<div class="sello reco-sello">Te lo recomendamos</div>' : '') +
      (hechos.has(t.di) ? '<div class="sello hecho-sello">✓ Ya estuviste</div>' : '') +
      '<h3>' + t.n + '</h3>' +
      '<div class="tour-meta">' + t.p + ' · ' + t.t + '</div>' +
      '<div class="tour-btns">' +
        '<button class="mini" onclick="quieroEste(\'' + t.pi + '\')">Quiero ir</button>' +
        '<a class="mini gris" href="https://xperiencia.com.co/tours/' + t.u +
          '/" target="_blank" rel="noopener">Ver detalles ↗</a>' +
      '</div></div>').join('');
}

/* «Quiero ir»: abre la inscripción con las salidas de ese plan. */
export function quieroEste(planId){
  quieroEstePlan(planId);
}
