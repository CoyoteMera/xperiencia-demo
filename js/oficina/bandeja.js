/* Bandeja: abonos «por validar» con su comprobante. La oficina valida (validar_abono) o rechaza
   (rechazar_abono con motivo); tras cada acción la lista se recarga desde la base.
   Funciones puras arriba (normalizar, ordenar, pintar a string: se prueban en Node) y, al final,
   las que tocan DOM y red, que solo corren cuando se las llama. NO se calcula dinero aquí: los
   montos se muestran tal cual los entrega la base. */
import { supa, rpc, mensajeDeError } from '../comun/supa.js';
import { generacion } from '../comun/guardia.js';
import { esc, idSeguro, fmtDinero, mesLargo, avisar, etiquetaPausa } from '../comun/util.js';

/* ───────────── lógica pura ───────────── */

/* Una fila de abono con sus embeds de PostgREST -> objeto plano. `requiereTRM`: alguna
   asignación va a un plan en otra moneda que el abono (la base exige entonces la TRM al validar). */
export function normalizarAbono(f){
  const asignaciones = (f.asignaciones || []).map(a => {
    const i = a.inscripcion || {};
    const s = i.salida || {};
    const p = s.plan || {};
    return {
      inscripcionId: i.id, salidaId: i.salida_id,
      viajero: (i.viajero && i.viajero.nombre) || '',
      plan: p.nombre || '', fechaSalida: s.fecha_inicio || null,
      planMoneda: p.moneda || null, monto: a.monto,
      // PostgREST devuelve el embed uno-a-uno como objeto o como arreglo de un elemento.
      pausa: ([].concat(i.pausa || [])[0] || {}).razon || null
    };
  });
  return {
    id: f.id, pagador: (f.pagador && f.pagador.nombre) || '',
    monto: f.monto, moneda: f.moneda, trm: f.trm == null ? null : f.trm,
    fecha: f.fecha || null, medio: f.medio || '', cuenta: f.cuenta_id || '',
    path: f.comprobante_path || null,
    asignaciones,
    requiereTRM: asignaciones.some(a => a.planMoneda && a.planMoneda !== f.moneda)
  };
}

/* Más recientes arriba. abono no tiene fecha de creación: se ordena por la fecha del pago
   (la que escribió quien subió el comprobante); sin fecha va al final; desempata el id. */
export function ordenarAbonos(lista){
  return lista.slice().sort((a, b) => {
    if(a.fecha !== b.fecha){
      if(!a.fecha) return 1;
      if(!b.fecha) return -1;
      return a.fecha < b.fecha ? 1 : -1;
    }
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  });
}

const TRM_MIN = 1000, TRM_MAX = 10000;
export const MENSAJE_TRM = 'La TRM debe estar entre 1.000 y 10.000 pesos por dólar; revisa el separador de miles.';

/* TRM escrita por la oficina -> número entre 1.000 y 10.000, o null. Acepta «4120», «4.120» (miles), «4.120,50»,
   «4120,5» y «4120.50». Una TRM es de miles de pesos por dólar: «4.120» es 4120, no 4,12. */
export function parsearTRM(texto){
  const t = String(texto == null ? '' : texto).replace(/\s/g, '');
  let n;
  if(/^\d+$/.test(t)) n = Number(t);
  else if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if(/^\d+,\d+$/.test(t)) n = Number(t.replace(',', '.'));
  else if(/^\d+\.\d+$/.test(t)) n = Number(t);
  else return null;
  // Plausibilidad: la TRM COP/USD vale entre 1.000 y 10.000. Fuera de ahí (p. ej. «4,120» leído
  // como 4,12) no se manda ni se intenta adivinar el separador.
  return isFinite(n) && n >= TRM_MIN && n <= TRM_MAX ? n : null;
}

export function tipoComprobante(path){
  if(!path) return null;
  const m = String(path).toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m ? m[1] : '';
  if(ext === 'pdf') return 'pdf';
  if(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif'].includes(ext)) return 'imagen';
  return 'otro';
}

/* El cupo de la salida (de v_salida_resumen): la confirmación por validación no mira cupo, así
   que la oficina lo ve aquí antes de validar. `llena`: ya no queda lugar. */
export function textoCupo(res){
  if(!res) return {texto: 'No pudimos leer el cupo de esta salida', llena: false};
  const llena = Number(res.cupos_ocupados) >= Number(res.cupos_total);
  const partes = ['Cupos ' + res.cupos_ocupados + ' de ' + res.cupos_total];
  if(llena) partes.push('salida llena');
  if(Number(res.cupos_pendientes) > 0) partes.push(res.cupos_pendientes + ' sin confirmar');
  return {texto: partes.join(' · '), llena};
}

function pintarComprobante(a, url){
  const tipo = tipoComprobante(a.path);
  if(!tipo) return '<div class="comprobante tenue-s">Sin comprobante (se registró sin archivo).</div>';
  if(!url) return '<div class="comprobante tenue-s">No pudimos abrir el comprobante. Recarga la bandeja.</div>';
  if(tipo === 'imagen')
    return '<div class="comprobante"><a href="' + esc(url) + '" target="_blank" rel="noopener">' +
      '<img src="' + esc(url) + '" alt="Comprobante de ' + esc(a.pagador) + '" loading="lazy"></a></div>';
  return '<div class="comprobante"><a href="' + esc(url) + '" target="_blank" rel="noopener">Abrir el comprobante</a></div>';
}

/* Una tarjeta de la bandeja. extras = {cupos: {salida_id: fila de v_salida_resumen},
   urls: {abono_id: URL firmada}}. */
export function renderAbono(a, extras){
  const cupos = (extras && extras.cupos) || {};
  const urls = (extras && extras.urls) || {};
  const id = esc(a.id);
  const cuando = [a.fecha ? mesLargo(a.fecha) : 'Sin fecha', a.medio, a.cuenta].filter(Boolean).map(esc).join(' · ');

  const lineas = a.asignaciones.map(x =>
    '<div class="linea">Para <b>' + esc(x.viajero) + '</b> · ' + esc(x.plan) +
    (x.fechaSalida ? ' · sale el ' + esc(mesLargo(x.fechaSalida)) : '') +
    ' · ' + esc(fmtDinero(x.monto, x.planMoneda)) + (x.pausa ? ' ' + etiquetaPausa(x.pausa) : '') + '</div>').join('') ||
    '<div class="linea tenue-s">Este abono no tiene inscripción asignada.</div>';

  const vistas = new Set();
  const notasCupo = a.asignaciones.filter(x => x.salidaId && !vistas.has(x.salidaId) && vistas.add(x.salidaId))
    .map(x => {
      const c = textoCupo(cupos[x.salidaId]);
      return '<div class="nota-cupo' + (c.llena ? ' roja' : '') + '"><b>' + esc(x.plan) + ':</b> ' +
        esc(c.texto) + (c.llena ? '. Si validas, la salida quedará con más gente que cupos.' : '.') + '</div>';
    }).join('');

  const trm = a.requiereTRM
    ? '<div class="control"><label for="trm-' + id + '">TRM del abono (pesos por dólar)</label>' +
      '<div class="fila"><input type="text" inputmode="decimal" id="trm-' + id + '" value="' +
      esc(a.trm == null ? '' : a.trm) + '" placeholder="Ej. 4120"></div>' +
      '<p class="pista">' + (a.trm == null
        ? 'El viajero no propuso TRM: escríbela antes de validar.'
        : 'El viajero propuso ' + esc(a.trm) + '. Confírmala o corrígela antes de validar.') +
      ' El abono es en ' + esc(a.moneda) + ' y se asigna a un plan en otra moneda.</p></div>'
    : '';

  // Solo con un id de caracteres seguros se arma el onclick; si no, los botones quedan deshabilitados.
  const seguro = idSeguro(a.id);
  const accion = fn => (seguro ? 'onclick="' + fn + '(\'' + seguro + '\')"' : 'disabled');

  return '<div class="item" id="ab-' + id + '">' +
    '<h3>' + esc(a.pagador || 'Sin nombre') + ' · ' + esc(fmtDinero(a.monto, a.moneda)) + '</h3>' +
    '<div class="cuando">' + cuando + '</div>' +
    '<div class="abono-cuerpo"><div class="abono-datos">' + lineas + notasCupo + trm +
    '<div class="control"><label for="motivo-' + id + '">Motivo (solo si lo rechazas)</label>' +
    '<div class="fila"><input type="text" id="motivo-' + id + '" placeholder="Ej. El comprobante no se lee"></div></div>' +
    '<div class="acciones">' +
    '<button type="button" class="btn chico verde" ' + accion('validarAbono') + '>Validar</button>' +
    '<button type="button" class="btn chico fantasma" ' + accion('rechazarAbono') + '>Rechazar</button></div>' +
    '<div class="errl" id="err-' + id + '" role="alert"></div></div>' +
    pintarComprobante(a, urls[a.id]) + '</div></div>';
}

export function renderBandeja(abonos, extras){
  if(!abonos.length)
    return '<div class="vacio"><p>No hay comprobantes por validar.</p></div>';
  return '<p class="tenue-s" style="margin-bottom:12px">' + abonos.length + ' por validar</p>' +
    ordenarAbonos(abonos).map(a => renderAbono(a, extras)).join('');
}

/* ───────────── pantalla (DOM y red; solo corre cuando se llama) ───────────── */

const SEL_ABONO = 'id, monto, moneda, trm, fecha, medio, cuenta_id, comprobante_path, ' +
  'pagador:viajero!pagador_viajero_id(nombre), ' +
  'asignaciones:abono_asignacion(monto, inscripcion:inscripcion(id, salida_id, viajero:viajero(nombre), pausa:inscripcion_pausa(razon), ' +
  'salida:salida(fecha_inicio, plan:plan(nombre, moneda))))';

/* Lee los abonos por validar, el cupo de sus salidas y las URL firmadas (600 s) de los
   comprobantes, y pinta la bandeja. Se llama al entrar y después de cada acción. */
const cargas = generacion();   // una recarga lenta no pisa a otra más nueva

export async function cargarBandeja(){
  const caja = document.getElementById('cajaBandeja');
  const mia = cargas.nueva();
  caja.innerHTML = '<div class="aviso">Un momento…</div>';
  try{
    const r = await supa.from('abono').select(SEL_ABONO).eq('estado', 'por_validar');
    if(r.error) throw new Error(r.error.message);
    const abonos = (r.data || []).map(normalizarAbono);

    const salidas = [...new Set(abonos.flatMap(a => a.asignaciones.map(x => x.salidaId)).filter(Boolean))];
    const cupos = {};
    if(salidas.length){
      const c = await supa.from('v_salida_resumen')
        .select('salida_id, cupos_total, cupos_ocupados, cupos_pendientes').in('salida_id', salidas);
      if(c.error) throw new Error(c.error.message);
      for(const s of c.data || []) cupos[s.salida_id] = s;
    }

    const urls = {};
    await Promise.all(abonos.filter(a => a.path).map(async a => {
      const u = await supa.storage.from('comprobantes').createSignedUrl(a.path, 600);
      if(!u.error && u.data) urls[a.id] = u.data.signedUrl;
    }));

    if(!cargas.vigente(mia)) return;
    caja.innerHTML = renderBandeja(abonos, {cupos, urls});
  }catch(e){
    if(!cargas.vigente(mia)) return;
    caja.innerHTML = '<div class="error">No pudimos cargar la bandeja: ' + esc(mensajeDeError(e)) + '</div>';
  }
}

function errorDe(id, msg){
  const c = document.getElementById('err-' + id);
  if(c) c.textContent = msg;
}
function bloquear(id, on){
  document.querySelectorAll('#ab-' + CSS.escape(id) + ' button').forEach(b => { b.disabled = on; });
}

/* «Validar». Si el abono necesita TRM, se manda la del campo (la base rechaza si falta, con
   «Confirma la TRM del abono antes de validarlo», y ese texto se muestra tal cual). */
export async function validarAbono(id){
  errorDe(id, '');
  const campo = document.getElementById('trm-' + id);
  let trm = null;
  if(campo && campo.value.trim() !== ''){
    trm = parsearTRM(campo.value);
    if(trm === null) return errorDe(id, MENSAJE_TRM);
  }
  bloquear(id, true);
  try{
    await rpc('validar_abono', {p_abono: id, p_trm: trm});
    avisar('Abono validado.');
    await cargarBandeja();
  }catch(e){
    bloquear(id, false);
    errorDe(id, mensajeDeError(e));
  }
}

/* «Rechazar»: el motivo es obligatorio. */
export async function rechazarAbono(id){
  errorDe(id, '');
  const campo = document.getElementById('motivo-' + id);
  const motivo = campo ? campo.value.trim() : '';
  if(!motivo) return errorDe(id, 'Escribe el motivo del rechazo');
  bloquear(id, true);
  try{
    await rpc('rechazar_abono', {p_abono: id, p_motivo: motivo});
    avisar('Abono rechazado.');
    await cargarBandeja();
  }catch(e){
    bloquear(id, false);
    errorDe(id, mensajeDeError(e));
  }
}
