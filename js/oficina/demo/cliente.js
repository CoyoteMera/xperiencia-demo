/* Cliente de Supabase en memoria para el demo de la oficina (?demo): sin red. Las lecturas
   responden con el elenco de datos.js; las escrituras NO fingen éxito: devuelven MENSAJE_DEMO y la
   pantalla lo muestra donde ya muestra sus errores. Nada se ejecuta al importar. */
import { hoyBogota } from '../../comun/util.js';
import { datosOficinaDemo } from './datos.js';

export const MENSAJE_DEMO = 'En el demo no se guarda nada.';

const copia = x => JSON.parse(JSON.stringify(x));
const falla = () => ({data: null, error: {message: MENSAJE_DEMO}});

/* Consulta encadenable y «thenable». Ignora la lista de columnas (los embebidos ya vienen en la fila). */
function consulta(filas, escribe){
  let orden = [], un = null, tope = Infinity, cuenta = false, cabeza = false;
  const filtros = [];
  const q = {
    select(_c, o){ if(o && o.count){ cuenta = true; cabeza = !!o.head; } return q; },
    eq(col, v){ filtros.push(f => f[col] === v); return q; },
    neq(col, v){ filtros.push(f => f[col] !== v); return q; },
    in(col, vs){ filtros.push(f => vs.includes(f[col])); return q; },
    gte(col, v){ filtros.push(f => f[col] >= v); return q; },
    // Solo la forma 'id.in.(a,b),titular_id.in.(a,b)' que usa abono.js; cualquier otra no filtra.
    or(texto){
      const m = String(texto).match(/^id\.in\.\(([^)]*)\),titular_id\.in\.\(([^)]*)\)$/);
      if(m){ const ids = m[1].split(','); filtros.push(f => ids.includes(f.id) || ids.includes(f.titular_id)); }
      return q;
    },
    limit(n){ tope = n; return q; },
    order(col, o){ orden.push([col, o && o.ascending === false ? -1 : 1]); return q; },
    maybeSingle(){ un = 'maybe'; return q; },
    single(){ un = 'single'; return q; },
    then(res, rej){ return Promise.resolve().then(ejecutar).then(res, rej); }
  };
  function ejecutar(){
    if(escribe) return falla();
    const sel = filas.filter(f => filtros.every(p => p(f))).map(copia);
    sel.sort((a, b) => {
      for(const [c, s] of orden){
        const r = a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0;
        if(r) return r * s;
      }
      return 0;
    });
    const filasOk = sel.slice(0, tope);
    if(cuenta) return {data: cabeza ? null : filasOk, count: sel.length, error: null};
    if(un){
      if(!filasOk.length && un === 'single')
        return {data: null, error: {message: 'No se encontró la fila', code: 'PGRST116'}};
      return {data: filasOk[0] || null, error: null};
    }
    return {data: filasOk, error: null};
  }
  return q;
}

export function crearClienteOficinaDemo(hoy = hoyBogota()){
  const {tablas, rpc, usuario} = datosOficinaDemo(hoy);
  const user = {id: usuario.id, email: usuario.email};
  const session = {user};
  const escritura = () => consulta([], true);
  return {
    demo: true,
    auth: {
      getSession: async () => ({data: {session}, error: null}),
      getUser: async () => ({data: {user}, error: null}),
      signOut: async () => ({error: null}),
      onAuthStateChange: () => ({data: {subscription: {unsubscribe(){}}}})
    },
    from: tabla => {
      const q = consulta(tablas[tabla] || []);
      // insert/update/upsert/delete: la consulta resuelve el error del demo.
      for(const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => escritura();
      return q;
    },
    // status 400: rpc() de supa.js distingue «la base respondió con error» de «sin red».
    rpc: async (nombre, args) => {
      const f = rpc[nombre];
      if(!f) return {data: null, error: {message: MENSAJE_DEMO}, status: 400};
      const data = f(args || {});
      return data === null
        ? {data: null, error: {message: 'En el demo solo se calcula la cancelación de Viajero Cuatro.'}, status: 400}
        : {data, error: null, status: 200};
    },
    storage: {
      from: () => ({
        createSignedUrl: async () => ({data: {signedUrl: 'img/demo-comprobante.svg'}, error: null}),
        upload: async () => falla()
      })
    }
  };
}
