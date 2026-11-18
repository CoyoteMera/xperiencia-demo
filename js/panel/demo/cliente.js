/* Cliente de Supabase en memoria para el demo del Panel Global: solo lectura, sin red.
   Nada se ejecuta al importar. */
import { hoyBogota } from '../../comun/util.js';
import { datosPanelDemo } from './datos.js';

const copia = x => JSON.parse(JSON.stringify(x));

/* Consulta encadenable y «thenable». Ignora la lista de columnas. */
function consulta(filas){
  let orden = null, un = null;
  const filtros = [];
  const q = {
    select(){ return q; },
    eq(col, v){ filtros.push(f => f[col] === v); return q; },
    in(col, vs){ filtros.push(f => vs.includes(f[col])); return q; },
    gte(col, v){ filtros.push(f => f[col] >= v); return q; },
    order(col, o){ orden = [col, o && o.ascending === false ? -1 : 1]; return q; },
    maybeSingle(){ un = 'maybe'; return q; },
    single(){ un = 'single'; return q; },
    then(res, rej){ return Promise.resolve().then(ejecutar).then(res, rej); }
  };
  function ejecutar(){
    const sel = filas.filter(f => filtros.every(p => p(f))).map(copia);
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

export function crearClientePanelDemo(hoy = hoyBogota()){
  const {tablas, usuario} = datosPanelDemo(hoy);
  const user = {id: usuario.id, email: usuario.email};
  const session = {user};
  return {
    demo: true,
    auth: {
      getSession: async () => ({data: {session}, error: null}),
      getUser: async () => ({data: {user}, error: null}),
      signOut: async () => ({error: null}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe(){}}}})
    },
    from: tabla => consulta(tablas[tabla] || [])
  };
}
