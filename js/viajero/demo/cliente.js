/* Cliente de Supabase en memoria para el demo: responde exactamente lo que piden almacen.js,
   comprobantes.js y comun/sesion.js, sin red. Nada se ejecuta al importar. */
import { hoyBogota } from '../../comun/util.js';
import { datosDemo } from './datos.js';

const copia = x => JSON.parse(JSON.stringify(x));

/* Consulta encadenable y «thenable» sobre las filas de una tabla. Ignora la lista de columnas
   (las filas ya traen el `plan` anidado que piden los select con plan:plan_id(...)). */
function consulta(filas){
  let modo = 'select', cambios = null, clave = null, un = null, orden = null;
  const filtros = [];
  const q = {
    select(){ return q; },
    eq(col, v){ filtros.push(f => f[col] === v); return q; },
    in(col, vs){ filtros.push(f => vs.includes(f[col])); return q; },
    order(col, o){ orden = [col, o && o.ascending === false ? -1 : 1]; return q; },
    maybeSingle(){ un = 'maybe'; return q; },
    single(){ un = 'single'; return q; },
    update(c){ modo = 'update'; cambios = c; return q; },
    insert(c){ modo = 'insert'; cambios = c; return q; },
    upsert(c, o){ modo = 'upsert'; cambios = c; clave = o && o.onConflict; return q; },
    then(res, rej){ return Promise.resolve().then(ejecutar).then(res, rej); }
  };
  function ejecutar(){
    let sel;
    if(modo === 'update'){
      sel = filas.filter(f => filtros.every(p => p(f)));
      sel.forEach(f => Object.assign(f, copia(cambios)));
    }else if(modo === 'insert'){
      const f = {id: 'demo-' + Math.random().toString(36).slice(2, 10), ...copia(cambios)};
      filas.push(f); sel = [f];
    }else if(modo === 'upsert'){
      const ex = clave ? filas.find(f => f[clave] === cambios[clave]) : null;
      if(ex) Object.assign(ex, copia(cambios)); else filas.push(copia(cambios));
      sel = [ex || filas[filas.length - 1]];
    }else{
      sel = filas.filter(f => filtros.every(p => p(f)));
    }
    sel = sel.map(copia);
    if(orden) sel.sort((a, b) =>
      (a[orden[0]] > b[orden[0]] ? 1 : a[orden[0]] < b[orden[0]] ? -1 : 0) * orden[1]);
    if(un){
      if(!sel.length && un === 'single')
        return {data: null, error: {message: 'No se encontró la fila', code: 'PGRST116'}};
      return {data: sel[0] || null, error: null};
    }
    return {data: sel, error: null};
  }
  return q;
}

export function crearClienteDemo(hoy = hoyBogota()){
  const {tablas, acompanantes, usuario} = datosDemo(hoy);
  const user = {id: usuario.id, email: usuario.email};
  const session = {user};
  const abierta = {data: {user, session}, error: null};
  return {
    demo: true,   // marca para la app: en demo no hay páginas reales (voucher.html) a las que ir
    auth: {
      getSession: async () => ({data: {session}, error: null}),
      getUser: async () => ({data: {user}, error: null}),
      signInWithPassword: async () => abierta,
      signUp: async () => abierta,
      signOut: async () => ({error: null}),
      resetPasswordForEmail: async () => ({data: {}, error: null}),
      updateUser: async () => ({data: {user}, error: null}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe(){}}}})
    },
    from: tabla => consulta(tablas[tabla] || (tablas[tabla] = [])),
    rpc: async nombre => ({data: nombre === 'mis_acompanantes' ? copia(acompanantes) : null, error: null}),
    storage: {from: () => ({upload: async ruta => ({data: {path: ruta}, error: null})})}
  };
}
