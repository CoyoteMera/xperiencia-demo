/* Elenco ficticio del demo de la oficina (?demo). Puro: no toca document, window ni red.
   Las vistas (resumen de salidas, saldos, alertas) se derivan de las inscripciones, como las
   reales, para que las cifras cuadren con diseno/oficina.md (c). */
import { sumarDias } from '../../comun/util.js';

const PERSONAS = [
  ['uno', 'Viajera Uno'], ['dos', 'Viajera Dos'], ['tres', 'Viajero Tres'], ['cuatro', 'Viajero Cuatro'],
  ['cinco', 'Viajera Cinco'], ['seis', 'Viajero Seis'], ['siete', 'Viajera Siete'], ['ocho', 'Viajero Ocho'],
  ['nueve', 'Viajera Nueve'], ['diez', 'Viajero Diez'], ['once', 'Viajero Once'], ['doce', 'Viajera Doce'],
  ['trece', 'Viajera Trece'], ['catorce', 'Viajero Catorce'], ['quince', 'Viajera Quince'],
  ['dieciseis', 'Viajero Dieciséis'], ['diecisiete', 'Viajera Diecisiete'], ['dieciocho', 'Viajero Dieciocho'],
  ['diecinueve', 'Viajera Diecinueve'], ['veinte', 'Viajero Veinte'], ['veintiuno', 'Viajera Veintiuno'],
  ['veintidos', 'Viajero Veintidós'], ['veintitres', 'Viajera Veintitrés'], ['veinticuatro', 'Viajero Veinticuatro'],
  ['veinticinco', 'Viajera Veinticinco'], ['veintiseis', 'Viajero Veintiséis'], ['veintisiete', 'Viajera Veintisiete']
];
const SIN_TALLA = ['dos', 'tres'];   // sus requisitos: Talla y Seguro pendientes (2 de 4)
const TALLAS = {uno: 'M', cuatro: 'L'};

const PLANES = {
  oceta: ['Páramo de Ocetá', 'Páramo', 'COP'], guatavita: ['Laguna de Guatavita', 'Disfrute', 'COP'],
  cafe: ['Ruta del Café', 'Disfrute', 'COP'], cocuy: ['Nevado del Cocuy', 'Nevado', 'COP'],
  santamarta: ['Santa Marta Trek', 'Nevado', 'USD']
};
/* [clave, días hasta el inicio, días hasta el fin, cupos, semáforo] */
const SALIDAS = [
  ['oceta', 6, 6, 10, 'rojo'], ['guatavita', 7, 7, 8, 'verde'], ['cafe', 12, 12, 10, 'rojo'],
  ['cocuy', 19, 22, 12, 'amarillo'], ['santamarta', 42, 42, 10, 'amarillo']
];

/* [salida, persona, estado, valor, pagado, por validar, requisitos pendientes, que bloquean, titular, código] */
const lista = (s, valor, personas) => personas.map(p => [s, p, 'lista', valor, valor, 0, 0, 0, null, null]);
const INSC = [
  ['cocuy', 'uno', 'confirmada', 6000000, 3500000, 780000, 1, 1, null, 'XPE-0001'],
  ['cocuy', 'dos', 'confirmada', 0, 0, 0, 2, 1, 'uno', 'XPE-0001'],
  ['cocuy', 'tres', 'pendiente', 0, 0, 0, 2, 1, 'uno', 'XPE-0001'],
  ['cocuy', 'cuatro', 'confirmada', 2000000, 2000000, 200000, 1, 1, null, 'XPE-0002'],
  ['oceta', 'cinco', 'confirmada', 400000, 200000, 0, 1, 1, null, null],
  ['oceta', 'seis', 'confirmada', 400000, 200000, 0, 1, 1, null, null],
  ['oceta', 'siete', 'confirmada', 400000, 400000, 0, 1, 1, null, null],
  ...lista('oceta', 400000, ['trece', 'catorce', 'quince', 'dieciseis', 'diecisiete']),
  ...lista('guatavita', 300000, ['dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres']),
  ['cafe', 'ocho', 'confirmada', 1200000, 600000, 0, 0, 0, null, null],
  ['cafe', 'nueve', 'confirmada', 1200000, 600000, 0, 0, 0, null, null],
  ['cafe', 'diez', 'confirmada', 1200000, 600000, 0, 0, 0, null, null],
  ...lista('cafe', 1200000, ['once', 'veinticuatro']),
  ['cafe', 'doce', 'cancelada', 1200000, 600000, 0, 0, 0, null, null],
  ...lista('santamarta', 300, ['veinticinco', 'veintiseis']),
  ['santamarta', 'veintisiete', 'confirmada', 600, 250, 0, 0, 0, null, null]
];

const REQUISITOS = [
  {id: 'demo-req-doc', nombre: 'Documento', orden: 1, tipo: 'dato', campo: 'num_doc', bloquea: true},
  {id: 'demo-req-emergencia', nombre: 'Contacto de emergencia', orden: 2, tipo: 'dato', campo: 'emergencia_nombre', bloquea: true},
  {id: 'demo-req-talla', nombre: 'Talla', orden: 3, tipo: 'dato', campo: 'talla', bloquea: false},
  {id: 'demo-req-seguro', nombre: 'Seguro de viaje', orden: 4, tipo: 'manual', campo: null, bloquea: true}
].map(r => ({...r, plan_id: null, aplica_tipo: null}));

const CUENTAS = ['Cuenta de prueba 1', 'Cuenta de prueba 2'];

/* [clave, pagador, monto, día relativo, medio, cuenta, estado, comprobante, inscripción de la persona] */
const ABONOS = [
  ['1', 'uno', 2000000, -36, 'Transferencia', CUENTAS[0], 'validado', 'demo/abono-1.png', 'uno'],
  ['2', 'uno', 1500000, -18, 'Efectivo', null, 'validado', null, 'uno'],
  ['3', 'uno', 780000, -4, 'Transferencia', CUENTAS[0], 'por_validar', 'demo/abono-3.png', 'uno'],
  ['4', 'cuatro', 2000000, -30, 'Transferencia', CUENTAS[1], 'validado', 'demo/abono-4.png', 'cuatro'],
  ['5', 'cuatro', 200000, -2, 'Transferencia', CUENTAS[1], 'por_validar', 'demo/abono-5.png', 'cuatro'],
  ['6', 'doce', 600000, -24, 'Transferencia', CUENTAS[0], 'validado', 'demo/abono-6.png', 'doce']
];

const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const SALIDA_ID = k => 'demo-salida-' + k;
const VIAJERO_ID = k => 'demo-viajero-' + k;

export function datosOficinaDemo(hoy){
  const d = n => sumarDias(hoy, n);
  const nombre = Object.fromEntries(PERSONAS);

  const plan = Object.entries(PLANES).map(([k, [n, tipo, moneda]]) =>
    ({id: 'demo-plan-' + k, nombre: n, tipo, moneda, activo: true}));
  const planDe = k => plan.find(p => p.id === 'demo-plan-' + k);
  const salida = SALIDAS.map(([k, ini, fin, cupos, sem]) => ({
    id: SALIDA_ID(k), plan_id: 'demo-plan-' + k, fecha_inicio: d(ini), fecha_fin: d(fin), cupos_total: cupos,
    estado: 'abierta', nota: null, es_piloto: false,
    coordinador: k === 'cocuy' ? 'Coordinador de prueba' : null,
    punto_encuentro: k === 'cocuy' ? 'Terminal del Salitre, Bogotá' : null,
    hora_encuentro: k === 'cocuy' ? '04:30 a. m.' : null,
    fecha_limite_pago: k === 'cocuy' ? d(9) : null, semaforo: sem
  }));
  const salidaDe = k => salida.find(s => s.id === SALIDA_ID(k));

  const viajero = PERSONAS.map(([k, n], i) => ({
    id: VIAJERO_ID(k), nombre: n, tipo_doc: 'CC', num_doc: '····' + (1234 + i * 7),
    celular: '+57 300 000 ' + String(i * 3).padStart(4, '0'),
    correo: sinTildes(n).toLowerCase().replace(' ', '.') + '@prueba.invalid',
    ciudad: 'Bogotá', talla: SIN_TALLA.includes(k) ? null : (TALLAS[k] || ['S', 'M', 'L'][i % 3]),
    user_id: k === 'uno' ? 'demo-usuario-uno' : null
  }));
  const viajero_privado = PERSONAS.map(([k]) => ({viajero_id: VIAJERO_ID(k), emergencia_nombre: 'Contacto de prueba',
    emergencia_parentesco: null, emergencia_tel: '+57 300 000 0002'}));

  const inscripcion = INSC.map((r, i) => {
    const [s, p, estado, valor, pagado, porValidar, rp, rb, titular, codigo] = r;
    const sal = salidaDe(s), pl = planDe(s);
    return {id: 'demo-insc-' + (i + 1), estado, titular_id: titular ? 'demo-insc-' + (INSC.findIndex(x => x[0] === s && x[1] === titular) + 1) : null,
      codigo_reserva: codigo, descuento_motivo: null, valor_sin_descuento: null, viajero_id: VIAJERO_ID(p), salida_id: sal.id,
      viajero: {id: VIAJERO_ID(p), nombre: nombre[p]},
      salida: {fecha_inicio: sal.fecha_inicio, fecha_fin: sal.fecha_fin, plan: {id: pl.id, nombre: pl.nombre, tipo: pl.tipo, moneda: pl.moneda}},
      pausa: [], _r: {valor, pagado, porValidar, rp, rb}};
  });
  const insc = (s, p) => inscripcion.find(i => i.salida_id === SALIDA_ID(s) && i.viajero_id === VIAJERO_ID(p));

  const v_inscripcion_saldo = inscripcion.map(i => {
    const {valor, pagado, porValidar, rp, rb} = i._r;
    const moneda = i.salida.plan.moneda;
    return {inscripcion_id: i.id, salida_id: i.salida_id, viajero_id: i.viajero_id, titular_id: i.titular_id, moneda,
      valor_acordado: valor, pagado, por_validar: porValidar, saldo: valor - pagado, req_total: 4, req_pendientes: rp,
      req_bloqueantes_pendientes: rb, listo_para_ir: i.estado === 'lista', estado_mostrado: i.estado};
  });
  for(const i of inscripcion) delete i._r;
  const vivas = v_inscripcion_saldo.filter(x => x.estado_mostrado !== 'cancelada');

  const v_salida_resumen = salida.map(s => {
    const mias = vivas.filter(x => x.salida_id === s.id);
    const suma = f => mias.reduce((t, x) => t + f(x), 0);
    return {salida_id: s.id, plan_nombre: planDe(s.id.slice(12)).nombre, moneda: planDe(s.id.slice(12)).moneda,
      fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, dias_para_salida: SALIDAS.find(x => SALIDA_ID(x[0]) === s.id)[1],
      semaforo: s.semaforo, cupos_total: s.cupos_total, cupos_ocupados: mias.length, cupos_pendientes: 0,
      inscritos: mias.length, listos: mias.filter(x => x.listo_para_ir).length,
      con_saldo: mias.filter(x => x.saldo > 0).length, con_requisitos: mias.filter(x => x.req_bloqueantes_pendientes > 0).length,
      recaudado: suma(x => x.pagado), por_cobrar: suma(x => Math.max(x.saldo, 0))};
  });

  // Como v_alertas: salidas a 0–15 días con saldo o requisitos que bloquean.
  const v_alertas = vivas.flatMap(x => {
    const r = v_salida_resumen.find(s => s.salida_id === x.salida_id);
    if(r.dias_para_salida > 15 || !(x.saldo > 0 || x.req_bloqueantes_pendientes > 0)) return [];
    return [{salida_id: r.salida_id, plan_nombre: r.plan_nombre, fecha_inicio: r.fecha_inicio, dias_para_salida: r.dias_para_salida,
      viajero_nombre: nombre[x.viajero_id.slice(13)], moneda: x.moneda, saldo: x.saldo,
      req_bloqueantes_pendientes: x.req_bloqueantes_pendientes}];
  });

  const requisito_estado = vivas.filter(x => x.req_bloqueantes_pendientes === 0).map(x =>
    ({inscripcion_id: x.inscripcion_id, requisito_id: 'demo-req-seguro', cumplido: true, nota: null}));

  const abono = ABONOS.map(([k, pag, monto, dias, medio, cuenta, estado, path, para]) => {
    const i = inscripcion.find(x => x.viajero_id === VIAJERO_ID(para));
    return {id: 'demo-abono-' + k, monto, moneda: 'COP', trm: null, fecha: d(dias), medio, cuenta_id: cuenta, estado,
      motivo_rechazo: null, comprobante_path: path, pagador_viajero_id: VIAJERO_ID(pag), pagador: {nombre: nombre[pag]},
      asignaciones: [{monto, inscripcion: {id: i.id, salida_id: i.salida_id, viajero: i.viajero, pausa: [],
        salida: {fecha_inicio: i.salida.fecha_inicio, plan: {nombre: i.salida.plan.nombre, moneda: i.salida.plan.moneda}}}}]};
  });
  const abono_asignacion = abono.map(a => ({monto: a.monto, inscripcion_id: a.asignaciones[0].inscripcion.id,
    abono: {...a, asignaciones: undefined}}));

  const doce = insc('cafe', 'doce');
  const devolucion = [{id: 'demo-devolucion-1', inscripcion_id: doce.id, cliente_texto: null, fecha_cancelacion: d(-6), dias: 13,
    pct_aplicado: 30, penalidad_calculada: 360000, penalidad_final: 360000, nota_correccion: null, monto_devolver: 240000,
    moneda: 'COP', estado: 'pendiente',
    inscripcion: {id: doce.id, viajero: doce.viajero, salida: {fecha_inicio: doce.salida.fecha_inicio, plan: {nombre: doce.salida.plan.nombre}}}}];

  const cuatro = insc('cocuy', 'cuatro').id;
  const buscar = p_texto => {
    const t = sinTildes(String(p_texto || '')).toLowerCase();
    return viajero.filter(v => sinTildes(v.nombre).toLowerCase().includes(t) || String(v.num_doc).includes(t) || String(v.celular).includes(t))
      .map(v => {
        const i = inscripcion.find(x => x.viajero_id === v.id && x.estado !== 'cancelada');
        return {viajero_id: v.id, nombre: v.nombre, num_doc: v.num_doc, celular: v.celular,
          proxima_salida: i ? i.salida.plan.nombre + ' · ' + i.salida.fecha_inicio : null};
      });
  };
  // Como export_inscritos / export_inscritos_todas: sin canceladas, solo los requisitos manuales, y la de «todas»
  // trae `salida` («plan · AAAA-MM-DD») primero y solo las salidas desde hoy.
  const ESTADO = {lista: 'Lista', confirmada: 'Confirmada', pendiente: 'Pendiente'};
  const filasDe = sid => vivas.filter(x => x.salida_id === sid).map(x => {
    const v = viajero.find(y => y.id === x.viajero_id), pr = viajero_privado.find(y => y.viajero_id === x.viajero_id);
    const i = inscripcion.find(y => y.id === x.inscripcion_id);
    return {nombre: v.nombre, tipo_doc: v.tipo_doc, num_doc: v.num_doc, nacimiento: null, celular: v.celular, instagram: null,
      talla: v.talla, dieta: null, emergencia_nombre: pr.emergencia_nombre, emergencia_tel: pr.emergencia_tel, codigo: i.codigo_reserva,
      requisitos: {'Seguro de viaje': x.req_bloqueantes_pendientes ? '' : 'OK'},
      Valor: x.valor_acordado, Pagado: x.pagado, Saldo: x.saldo, Estado: ESTADO[x.estado_mostrado]};
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const exportar = salidaId => salidaId ? filasDe(salidaId)
    : v_salida_resumen.filter(r => r.fecha_inicio >= hoy).flatMap(r =>
        filasDe(r.salida_id).map(f => ({salida: r.plan_nombre + ' · ' + r.fecha_inicio, ...f})));

  return {
    usuario: {id: 'demo-oficina', email: 'oficina@prueba.invalid'},
    tablas: {
      perfil: [{id: 'demo-oficina', user_id: 'demo-oficina', rol: 'oficina', nombre: 'Oficina de prueba'}],
      plan, salida, viajero, viajero_privado, inscripcion, requisito: REQUISITOS, requisito_estado, abono, abono_asignacion,
      devolucion, inscripcion_pausa: [], bitacora: [],
      cuenta: CUENTAS.map(n => ({id: n, nombre: n, medio: 'Transferencia', activa: true})),
      v_inscripcion_saldo, v_salida_resumen, v_alertas
    },
    rpc: {
      buscar_viajero: a => buscar(a.p_texto),
      export_inscritos: a => exportar(a.p_salida),
      export_inscritos_todas: () => exportar(null),
      calcular_penalidad: a => a.p_inscripcion === cuatro
        ? {dias: 14, pct: 30, cargo_admin_pct: 0, base: 2000000, penalidad: 600000, pagado: 2000000, devolver: 1400000} : null
    }
  };
}
