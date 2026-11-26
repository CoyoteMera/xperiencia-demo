/* Elenco ficticio del demo del Panel Global (?demo). Puro: no toca document, window ni red.
   Las vistas se derivan de las inscripciones, como las reales, para que las cifras cuadren. */
import { sumarDias } from '../../comun/util.js';

const NOMBRES = {uno: 'Viajera Uno', dos: 'Viajera Dos', tres: 'Viajero Tres', cuatro: 'Viajero Cuatro',
  cinco: 'Viajera Cinco', seis: 'Viajero Seis'};

/* [salida, viajero, estado, valor, pagado, por_validar, req_total, req_pendientes, req_bloqueantes] */
const INSC = [
  ['oceta', 'uno', 'lista', 1000000, 1000000, 0, 2, 0, 0],
  ['oceta', 'tres', 'lista', 1000000, 1000000, 0, 2, 0, 0],
  ['cocuy', 'uno', 'confirmada', 6000000, 3500000, 780000, 2, 1, 1],
  ['cocuy', 'dos', 'lista', 2000000, 2000000, 0, 2, 0, 0],
  ['cocuy', 'cuatro', 'pendiente', 2000000, 0, 0, 2, 2, 0],
  ['cafe', 'cinco', 'confirmada', 2000000, 1000000, 0, 2, 1, 0],
  ['paine', 'seis', 'confirmada', 2500, 1500, 0, 2, 1, 0]
];

const mesMenos1 = m => { const [a, n] = m.split('-').map(Number); return new Date(Date.UTC(a, n - 2, 1)).toISOString().slice(0, 10); };

export function datosPanelDemo(hoy){
  const d = n => sumarDias(hoy, n);
  const salidas = [
    {k: 'oceta', plan_nombre: 'Páramo de Ocetá', moneda: 'COP', n: 6, fin: 6, semaforo: 'verde'},
    {k: 'cocuy', plan_nombre: 'Nevado del Cocuy', moneda: 'COP', n: 10, fin: 13, semaforo: 'rojo'},
    {k: 'cafe', plan_nombre: 'Ruta del Café', moneda: 'COP', n: 25, fin: 27, semaforo: 'amarillo'},
    {k: 'paine', plan_nombre: 'Torres del Paine', moneda: 'USD', n: 40, fin: 46, semaforo: 'amarillo'}
  ];
  const insc = INSC.map((r, i) => {
    const [s, v, estado, valor, pagado, por_validar, req_total, req_pendientes, req_bloq] = r;
    return {inscripcion_id: 'demo-insc-' + (i + 1), salida_id: 'demo-salida-' + s, viajero_id: 'demo-viajero-' + v,
      titular_id: null, moneda: salidas.find(x => x.k === s).moneda, valor_acordado: valor, pagado, por_validar,
      saldo: valor - pagado, req_total, req_pendientes, req_bloqueantes_pendientes: req_bloq,
      listo_para_ir: estado === 'lista', estado_mostrado: estado};
  });
  insc[3].titular_id = insc[2].inscripcion_id;   // Viajera Dos acompaña a Viajera Uno en el Cocuy

  const v_salida_resumen = salidas.map(s => {
    const mias = insc.filter(i => i.salida_id === 'demo-salida-' + s.k);
    return {salida_id: 'demo-salida-' + s.k, plan_nombre: s.plan_nombre, moneda: s.moneda,
      fecha_inicio: d(s.n), fecha_fin: d(s.fin), dias_para_salida: s.n, semaforo: s.semaforo,
      inscritos: mias.length, listos: mias.filter(i => i.listo_para_ir).length,
      recaudado: mias.reduce((t, i) => t + i.pagado, 0),
      por_cobrar: mias.reduce((t, i) => t + Math.max(i.saldo, 0), 0)};
  });
  const v_panel_totales = ['COP', 'USD'].map(moneda => {
    const f = v_salida_resumen.filter(s => s.moneda === moneda);
    const suma = c => f.reduce((t, s) => t + s[c], 0);
    return {moneda, recaudado: suma('recaudado'), por_cobrar: suma('por_cobrar'), inscritos: suma('inscritos'), listos: suma('listos')};
  }).filter(t => t.inscritos);

  const M = hoy.slice(0, 7) + '-01', P = mesMenos1(M);
  const v_panel_mes = [
    {mes: M, moneda: 'COP', recaudado: 4280000, pendiente: 5500000, devoluciones: 0},
    {mes: M, moneda: 'USD', recaudado: 1500, pendiente: 1000, devoluciones: 0},
    {mes: P, moneda: 'COP', recaudado: 6200000, pendiente: 0, devoluciones: 350000}];
  const v_panel_cuentas = [
    {mes: M, moneda: 'COP', cuenta_nombre: 'Cuenta de ahorros Demo', recibido: 3000000},
    {mes: M, moneda: 'COP', cuenta_nombre: 'Nequi Demo', recibido: 1280000},
    {mes: M, moneda: 'USD', cuenta_nombre: 'Cuenta en dólares Demo', recibido: 1500},
    {mes: P, moneda: 'COP', cuenta_nombre: 'Cuenta de ahorros Demo', recibido: 6200000}];

  return {
    usuario: {id: 'demo-dueno', email: 'dueno@prueba.invalid'},
    tablas: {
      perfil: [{user_id: 'demo-dueno', rol: 'dueno'}],
      viajero: Object.entries(NOMBRES).map(([k, nombre]) => ({id: 'demo-viajero-' + k, nombre})),
      v_inscripcion_saldo: insc, v_salida_resumen, v_panel_totales, v_panel_mes, v_panel_cuentas
    }
  };
}
