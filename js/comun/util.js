/* Utilidades compartidas. No tocan el DOM al importarse, solo cuando se las llama. */

/* Escapa texto que se mete dentro de un atributo HTML.
   Sin esto, un id como "nevado-del-tolima__2026-11-14" entraba al onclick
   sin comillas y el navegador lo leía como una variable que no existe:
   por eso los botones de grupo no respondían. */
export function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Un id que se va a meter dentro de un onclick="f('ID')": solo letras, dígitos, «_» y «-» (los
   uuid y los ids de la app lo cumplen). Devuelve el id o null; con null la pantalla no arma el
   onclick (así un dato raro de la base no puede escapar de las comillas). */
export function idSeguro(id){
  const s = String(id == null ? '' : id);
  return /^[\w-]{1,64}$/.test(s) ? s : null;
}

/* Mensaje corto que se asoma y se va solo. No tapa el menú de abajo. */
let tToast = null;
export function avisar(msg, malo){
  let t = document.getElementById('toast');
  if(!t){ t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.className = 'toast' + (malo ? ' malo' : '');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(tToast);
  tToast = setTimeout(() => { t.style.display = 'none'; }, malo ? 6000 : 3500);
}

export function mostrarError(caja, msg){
  document.getElementById(caja).innerHTML = '<div class="error">'+msg+'</div>';
}

export function cargando(on, caja){
  const b = document.getElementById(caja);
  if(b) b.innerHTML = on ? '<div class="aviso" style="margin-top:14px">Un momento…</div>' : '';
}

export function fmtMoneda(n, moneda){
  const s = String(n).replace(/\D/g,'');
  return (moneda === 'USD' ? 'USD ' : '$') + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* Da formato a un monto que YA calculó Postgres (valor, pagado, saldo…). Aquí no se suma ni se
   resta nada. numeric llega como número o como texto ("520000.00"): la coma decimal
   solo sale si hay centavos. null = el plan aún no tiene precio. */
/* Etiqueta de una inscripción en pausa (la razón es interna de la oficina). */
export function etiquetaPausa(razon){
  return '<span class="etq alerta">En pausa · ' + esc(razon) + '</span>';
}

export function fmtDinero(n, moneda){
  if(n === null || n === undefined || n === '') return 'Por confirmar';
  const v = Number(n);
  if(!isFinite(v)) return 'Por confirmar';
  const neg = v < 0, abs = Math.abs(v);
  const enteros = Math.floor(abs + 1e-9);
  const cent = Math.round((abs - enteros) * 100);
  const cuerpo = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, '.') +
    (cent ? ',' + String(cent).padStart(2, '0') : '');
  return (neg ? '-' : '') + (moneda === 'USD' ? 'USD ' : '$') + cuerpo;
}

export function mesLargo(m){
  if(!m) return '';
  const p = m.split('-');
  const meses = ['','enero','febrero','marzo','abril','mayo','junio','julio',
    'agosto','septiembre','octubre','noviembre','diciembre'];
  if(p.length < 3) return meses[parseInt(p[1],10)] + ' de ' + p[0];
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const d = new Date(+p[0], +p[1]-1, +p[2]);
  return dias[d.getDay()] + ' ' + (+p[2]) + ' de ' + meses[+p[1]] + ' de ' + p[0];
}

/* Hoy en Bogotá (AAAA-MM-DD). toISOString() da el día de UTC, que después de las 7 p. m.
   ya es mañana: por eso todo «hoy» de la app sale de aquí. */
export function hoyBogota(d = new Date()){
  return new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bogota'}).format(d);
}

/* Suma días o años a una fecha AAAA-MM-DD, sin depender de la zona horaria del equipo. */
export function sumarDias(iso, n){
  return new Date(Date.parse(iso) + n * 86400000).toISOString().slice(0,10);
}
export function sumarAnios(iso, n){
  const p = iso.split('-');
  return new Date(Date.UTC(+p[0] + n, +p[1]-1, +p[2])).toISOString().slice(0,10);
}

/* «En 3 días», «Mañana», «Es hoy», «Ya pasó». Cuenta desde el día de Bogotá. */
export function faltanDias(m, hoy = hoyBogota()){
  const p = (m||'').split('-');
  if(p.length < 3) return '';
  const n = Math.round((Date.UTC(+p[0], +p[1]-1, +p[2]) - Date.parse(hoy)) / 86400000);
  if(n < 0)  return 'Ya pasó';
  if(n === 0) return 'Es hoy';
  if(n === 1) return 'Mañana';
  return 'En ' + n + ' días';
}

export function edadEn(nacimiento, fecha){
  if(!nacimiento || !fecha) return '';
  const n = new Date(nacimiento), f = new Date(fecha);
  let e = f.getFullYear() - n.getFullYear();
  const mm = f.getMonth() - n.getMonth();
  if(mm < 0 || (mm === 0 && f.getDate() < n.getDate())) e--;
  return e >= 0 ? e : '';
}

/* ── IDs según la especificación ── */
export const viajeId    = (planId, fecha) => planId + '__' + fecha;
export const registroId = (doc, vId) => doc + '__' + vId;

/* uuid v4. crypto.randomUUID solo existe en contextos seguros (https y localhost): en un
   teléfono que abra la app por http de red local haría falta el plan B. */
export function uuid(){
  const c = globalThis.crypto;
  if(c && c.randomUUID) return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0,8) + '-' + h.slice(8,12) + '-' + h.slice(12,16) + '-' + h.slice(16,20) + '-' + h.slice(20);
}
