/* ALMACENAMIENTO — todo lo que habla con Supabase vive aquí (y en comun/supa.js) y en ningún otro
   módulo de la app del viajero. Sin UI: no toca document. Nada se ejecuta al importar: main.js
   llama a iniciarSupa() e iniciarCola().
   El dinero (valor, pagado, saldo…) se lee ya calculado de v_inscripcion_saldo: aquí no se suma. */
import { supa, rpc } from '../comun/supa.js';

export const hayConexion = () => !!supa;

/* ══════════════════ CUENTA ══════════════════ */

const MENSAJES_AUTH = {
  'credenciales': 'El correo o la contraseña no coinciden.',
  'correo-existe': 'Ese correo ya tiene cuenta. Entra con tu contraseña, o usa “Olvidé mi contraseña” para poner una nueva.',
  'correo-sin-confirmar': 'Falta confirmar tu correo. Abre el enlace que te mandamos (mira también el correo no deseado).',
  'clave-debil': 'La contraseña es muy corta. Usa al menos 6 caracteres.',
  'demasiados-intentos': 'Demasiados intentos. Espera unos minutos.',
  'correo-invalido': 'Ese correo no parece válido.',
  'sin-conexion': 'Sin conexión. Revisa tu internet.'
};

/* Los errores de Supabase Auth, a {codigo, mensaje} en español (los mismos textos que daba el
   demo con los códigos de su proveedor anterior). `contexto` ('entrar' | 'crear') solo cambia el texto de lo
   que no reconocemos. Pura: la usan las pruebas. */
export function normalizarErrorAuth(e, contexto = 'entrar'){
  const code = e && e.code ? String(e.code) : '';
  const msg = e && e.message ? String(e.message) : '';
  const nombre = e && e.name ? String(e.name) : '';
  let codigo = 'otro';
  if(code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(msg))
    codigo = 'correo-existe';
  else if(code === 'invalid_credentials' || /invalid login credentials/i.test(msg))
    codigo = 'credenciales';
  else if(code === 'email_not_confirmed')
    codigo = 'correo-sin-confirmar';
  else if(code === 'weak_password')
    codigo = 'clave-debil';
  else if(['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'].includes(code)
          || (e && e.status === 429))
    codigo = 'demasiados-intentos';
  else if(code === 'email_address_invalid' || code === 'validation_failed')
    codigo = 'correo-invalido';
  else if(nombre === 'AuthRetryableFetchError' || /failed to fetch|networkerror|network request failed|load failed/i.test(msg))
    codigo = 'sin-conexion';
  const mensaje = MENSAJES_AUTH[codigo] ||
    ((contexto === 'crear' ? 'No pudimos crear la cuenta: ' : 'No pudimos entrar: ') + msg);
  return {codigo, mensaje};
}

/* Lanza un Error con el mensaje en español y e.code = el código normalizado. */
function lanzarAuth(e, contexto){
  const n = normalizarErrorAuth(e, contexto);
  const err = new Error(n.mensaje);
  err.code = n.codigo;
  throw err;
}

let UID = null, CORREO = null;   // de la sesión abierta (para no preguntarle a Auth cada vez)

export const uidActual = () => UID;
export const correoDeSesion = () => CORREO;

const urlDeLaApp = () => (typeof location !== 'undefined') ? location.origin + location.pathname : undefined;

/* Devuelve el id de la cuenta. */
export async function iniciarSesion(correo, clave){
  let r;
  try{ r = await supa.auth.signInWithPassword({email: correo, password: clave}); }
  catch(e){ lanzarAuth(e, 'entrar'); }
  if(r.error) lanzarAuth(r.error, 'entrar');
  UID = r.data.user.id; CORREO = r.data.user.email;
  return UID;
}

/* Devuelve {uid, conSesion}. Sin sesión (si algún día se activa «Confirm email») la persona
   confirma por correo y su primer entrar() cae en «completar perfil». */
export async function crearCuenta(correo, clave){
  let r;
  try{ r = await supa.auth.signUp({email: correo, password: clave, options: {emailRedirectTo: urlDeLaApp()}}); }
  catch(e){ lanzarAuth(e, 'crear'); }
  if(r.error) lanzarAuth(r.error, 'crear');
  const u = r.data.user;
  // Con confirmación de correo activa, un correo ya registrado no da error: devuelve un usuario sin identidades.
  if(u && Array.isArray(u.identities) && u.identities.length === 0) lanzarAuth({code: 'user_already_exists'}, 'crear');
  const conSesion = !!r.data.session;
  if(conSesion){ UID = u.id; CORREO = u.email; }
  return {uid: u ? u.id : null, conSesion};
}

/* scope 'local': borra la sesión de ESTE navegador aunque no haya red. El cierre global (todos los
   dispositivos) dejaba el token en localStorage si /logout fallaba, y al recargar se reentraba. */
export async function cerrarSesion(){
  try{ await supa.auth.signOut({scope: 'local'}); }catch(e){}
  UID = null; CORREO = null;
}

/* Siempre «funciona»: no revela si el correo existe. */
export async function recuperarClave(correo){
  try{ await supa.auth.resetPasswordForEmail(correo, {redirectTo: urlDeLaApp()}); }catch(e){}
}

/* Pone la contraseña nueva a la cuenta con sesión abierta (la que abrió el enlace de recuperación). */
export async function cambiarClave(clave){
  let r;
  try{ r = await supa.auth.updateUser({password: clave}); }
  catch(e){ lanzarAuth(e, 'entrar'); }
  if(r.error) lanzarAuth(r.error, 'entrar');
}

/* La sesión que ya había al abrir la app: {uid, email} o null. */
export async function leerSesion(){
  if(!supa) return null;
  try{
    const {data} = await supa.auth.getSession();
    const u = data && data.session && data.session.user;
    if(!u) return null;
    UID = u.id; CORREO = u.email;
    return {uid: u.id, email: u.email};
  }catch(e){ return null; }
}

/* ══════════════════ FICHA ══════════════════ */

function ok(r){
  if(r.error){ const e = new Error(r.error.message); e.code = r.error.code || ''; throw e; }
  return r.data;
}

/* Mi ficha: {viajero, privado} o null si todavía no tengo (RLS: solo veo la mía). */
export async function cargarMiFicha(){
  if(!UID) return null;
  const viajero = ok(await supa.from('viajero').select('*').eq('user_id', UID).maybeSingle());
  if(!viajero) return null;
  const privado = ok(await supa.from('viajero_privado').select('*').eq('viajero_id', viajero.id).maybeSingle());
  return {viajero, privado: privado || null};
}

/* Guarda mi ficha. Con viajero.id actualiza; sin id la crea con user_id = mi cuenta.
   `privado` (datos de salud y emergencia) se crea o se actualiza si viene. Devuelve el viajero. */
export async function guardarMiFicha(viajero, privado){
  if(!UID) throw new Error('Inicia sesión para guardar tus datos');
  const {id, ...campos} = viajero;
  let fila;
  if(id) fila = ok(await supa.from('viajero').update(campos).eq('id', id).select().single());
  else   fila = ok(await supa.from('viajero').insert({...campos, user_id: UID}).select().single());
  if(privado && Object.keys(privado).length){
    ok(await supa.from('viajero_privado').upsert({...privado, viajero_id: fila.id}, {onConflict: 'viajero_id'}));
  }
  return fila;
}

/* ══════════════════ SALIDAS, POLÍTICAS, CUENTAS ══════════════════ */

/* Salidas que se pueden ver: v_salidas_publicas (solo cupos, nunca nombres ni dinero ajeno) más el
   valor por persona y la política del plan. Forma que usa la app: {id, plan_id, plan, destino_id,
   fecha, fecha_fin, cupos_total, cupos_ocupados, estado, nota, valor, moneda, duracion, politica_id}. */
export async function cargarSalidas(){
  const filas = ok(await supa.from('v_salidas_publicas').select('*').order('fecha_inicio'));
  if(!filas.length) return [];
  const extra = ok(await supa.from('salida')
    .select('id, precio, plan:plan_id(precio_base, moneda, duracion, politica_id)')
    .in('id', filas.map(f => f.salida_id)));
  const porId = {};
  extra.forEach(x => { porId[x.id] = x; });
  return filas.map(f => {
    const x = porId[f.salida_id] || {}, p = x.plan || {};
    return {
      id: f.salida_id, plan_id: f.plan_id, plan: f.plan_nombre, destino_id: f.destino_id,
      fecha: f.fecha_inicio, fecha_fin: f.fecha_fin,
      cupos_total: f.cupos_total, cupos_ocupados: f.cupos_ocupados,
      estado: f.estado, nota: f.nota,
      valor: x.precio !== null && x.precio !== undefined ? x.precio : (p.precio_base ?? null),
      moneda: p.moneda || 'COP', duracion: p.duracion || '', politica_id: p.politica_id || 'general'
    };
  });
}

/* {id: {nombre, texto}} de las políticas de cancelación (texto que se muestra al aceptar). */
export async function cargarPoliticas(){
  const filas = ok(await supa.from('politica_cancelacion').select('id, nombre, texto_voucher'));
  const m = {};
  filas.forEach(f => { m[f.id] = {nombre: f.nombre, texto: f.texto_voucher || ''}; });
  return m;
}

/* Cuentas donde se puede pagar (las activas). detalle_publico lo escribe la oficina. */
export async function cargarCuentas(){
  return ok(await supa.from('cuenta').select('id, nombre, medio, detalle_publico').eq('activa', true));
}

/* ══════════════════ MIS INSCRIPCIONES ══════════════════ */

/* Mis inscripciones con saldo: columnas de v_inscripcion_saldo (ya calculadas en la base) más
   el código de reserva, las fechas y el plan. Solo las mías: los acompañantes van aparte. */
export async function cargarMisInscripciones(viajeroId){
  if(!viajeroId) return [];
  const saldos = ok(await supa.from('v_inscripcion_saldo').select('*').eq('viajero_id', viajeroId));
  if(!saldos.length) return [];
  const [insc, sal] = await Promise.all([
    supa.from('inscripcion').select('id, codigo_reserva').in('id', saldos.map(s => s.inscripcion_id)),
    supa.from('salida')
      .select('id, fecha_inicio, fecha_fin, plan:plan_id(id, nombre, destino_id)')
      .in('id', [...new Set(saldos.map(s => s.salida_id))])
  ]);
  const codigos = {}, salidas = {};
  ok(insc).forEach(i => { codigos[i.id] = i.codigo_reserva; });
  ok(sal).forEach(s => { salidas[s.id] = s; });
  return saldos.map(s => {
    const sa = salidas[s.salida_id] || {}, p = sa.plan || {};
    return Object.assign({}, s, {
      codigo_reserva: codigos[s.inscripcion_id] || null,
      fecha_inicio: sa.fecha_inicio || null, fecha_fin: sa.fecha_fin || null,
      plan_id: p.id || null, plan_nombre: p.nombre || '', destino_id: p.destino_id || null
    });
  });
}

/* Acompañantes que yo inscribí: solo nombre y dinero (la base no entrega más). */
export async function cargarMisAcompanantes(){
  return (await rpc('mis_acompanantes')) || [];
}

/* Une mi cuenta a la ficha de una invitación (la oficina me mandó el enlace). Devuelve el id
   del viajero. Si falla, el mensaje de la base sale tal cual. */
export async function usarInvitacion(token){
  return rpc('usar_invitacion', {p_token: token});
}

/* ══════════════════════════════════════════════════════════
   COLA DE ENVÍOS — ninguna inscripción se pierde
   1. se guarda en el teléfono ANTES de intentar enviar
   2. se intenta enviar a la base (rpc inscribirme, con un p_id hecho aquí: reintentar es seguro)
   3. si no hay señal, reintenta al recuperarla y al reabrir la app
   Un error de la base («No quedan cupos…») no se reintenta: queda rechazado con su mensaje.
   Cada envío es de una cuenta: en un teléfono compartido no se manda con la cuenta de otro.
   ══════════════════════════════════════════════════════════ */
const COLA_KEY = 'xpe_cola_v2';
const BITACORA_KEY = 'xpe_bitacora_v2';
const ESPERAS = [2000, 8000, 30000, 120000];
export const esperaDeReintento = intentos => ESPERAS[Math.min(Math.max(intentos, 1) - 1, ESPERAS.length - 1)];

function leerCola(){
  try{ return JSON.parse(localStorage.getItem(COLA_KEY)) || []; }catch(e){ return []; }
}
function escribirCola(c){
  try{ localStorage.setItem(COLA_KEY, JSON.stringify(c)); }catch(e){}
}
function bitacora(evento, args, detalle){
  // append-only: queda el envío crudo aunque falle todo lo demás
  try{
    const b = JSON.parse(localStorage.getItem(BITACORA_KEY)) || [];
    // Sin datos de personas: ni acompañantes (documento, celular, nacimiento) ni nada que identifique.
    b.push({t: new Date().toISOString(), evento, p_id: args.p_id, p_salida: args.p_salida,
            personas: 1 + (Array.isArray(args.p_acompanantes) ? args.p_acompanantes.length : 0),
            detalle: detalle || ''});
    localStorage.setItem(BITACORA_KEY, JSON.stringify(b.slice(-100)));
  }catch(e){}
}

let alCambiar = () => {};
/* main.js registra aquí quien repinta el aviso de pendientes (la UI no vive en este módulo). */
export function alCambiarCola(fn){ alCambiar = typeof fn === 'function' ? fn : () => {}; }

/* Cuántos envíos míos siguen esperando. */
export function pendientesEnCola(){
  return leerCola().filter(x => x.uid === UID && x.estado === 'pendiente').length;
}

/* Guarda la inscripción y la intenta enviar ya. args = los de inscribirme (p_id, p_salida,
   p_cupos, p_acompanantes, p_acepta_politica, p_acepta_datos). Devuelve
   {estado: 'confirmado' | 'pendiente' | 'rechazado', error?}. */
export async function encolarInscripcion(args){
  const c = leerCola();
  if(!c.some(x => x.args.p_id === args.p_id && x.uid === UID)){
    c.push({args, uid: UID, estado: 'pendiente', intentos: 0, creado: new Date().toISOString()});
    escribirCola(c);
    bitacora('encolado', args);
  }
  alCambiar();
  esperados.add(args.p_id);
  try{
    await procesarCola();
    const item = leerCola().find(x => x.args.p_id === args.p_id && x.uid === UID);
    if(!item) return {estado: 'pendiente'};
    // Confirmado o rechazado: ya se le contó a la persona; no se guardan sus datos más tiempo.
    if(item.estado !== 'pendiente') quitarItem(item);
    return {estado: item.estado, error: item.ultimo_error || null};
  }finally{
    esperados.delete(args.p_id);
  }
}

const esperados = new Set();   // p_id que encolarInscripcion está esperando (lee su resultado y lo borra)

function quitarItem(item){
  escribirCola(leerCola().filter(x => !(x.args.p_id === item.args.p_id && x.uid === item.uid)));
}

/* Al salir: borra de este teléfono lo ya resuelto (confirmado o rechazado) de la cuenta. Lo
   pendiente se queda para enviarse cuando esa cuenta vuelva a entrar. */
export function purgarCola(uid = UID){
  escribirCola(leerCola().filter(x => !(x.uid === uid && x.estado !== 'pendiente')));
}

let cadena = Promise.resolve(), temporizador = null;
/* Las corridas se hacen una tras otra: dos a la vez enviarían lo mismo dos veces. */
export function procesarCola(){
  cadena = cadena.then(corrida, corrida);
  return cadena;
}

/* Cambia un solo envío leyendo la cola de nuevo: otro envío pudo entrar mientras este viajaba. */
function actualizarItem(item, cambios){
  const c = leerCola();
  const i = c.find(x => x.args.p_id === item.args.p_id && x.uid === item.uid);
  if(i){ Object.assign(i, cambios); escribirCola(c); }
}

const reintentable = e => !!(e && (e.sinRed || e.status === 401 || e.code === 'PGRST301'));

async function corrida(){
  if(!UID) return;                       // sin sesión todavía: espera, no es un fallo
  const uid = UID;
  let reintentarEn = 0;
  const pendientes = leerCola().filter(x => x.uid === uid && x.estado === 'pendiente');
  for(const item of pendientes){
    try{
      await rpc('inscribirme', item.args);
      if(esperados.has(item.args.p_id)) actualizarItem(item, {estado: 'confirmado', ultimo_error: null});
      else quitarItem(item);
      bitacora('confirmado', item.args);
    }catch(e){
      if(reintentable(e)){
        const intentos = item.intentos + 1;
        actualizarItem(item, {intentos, ultimo_error: e.message});
        bitacora('sin-red', item.args, e.message);
        reintentarEn = Math.max(reintentarEn, esperaDeReintento(intentos));
      }else{
        actualizarItem(item, {estado: 'rechazado', ultimo_error: e.message});
        bitacora('rechazado', item.args, e.message);
      }
    }
  }
  if(reintentarEn){
    clearTimeout(temporizador);
    temporizador = setTimeout(procesarCola, reintentarEn);
  }
  alCambiar();
}

/* Arranca los reintentos: al recuperar señal y 1,5 s después de abrir la app. */
export function iniciarCola(){
  window.addEventListener('online', procesarCola);
  setTimeout(procesarCola, 1500);
}
