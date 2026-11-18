/* Datos del demo: el elenco ficticio. Todo es inventado (correos @prueba.invalid, teléfonos
   +57 300 000 000x). Las fechas salen de `hoy` para que el demo nunca quede vencido. Pura. */
import { sumarDias } from '../../comun/util.js';

const UID = 'demo-viajera-uno';
const VIAJERO = 'demo-viajero-uno';

export function datosDemo(hoy){
  const d = n => sumarDias(hoy, n);
  const plan = (id, nombre, destino_id, duracion) =>
    ({id, nombre, destino_id, precio_base: 2000000, moneda: 'COP', duracion, politica_id: 'general'});
  const planes = [
    plan('demo-plan-oceta', 'Páramo de Ocetá', 'boyaca', '1 día'),
    plan('demo-plan-guatavita', 'Laguna de Guatavita', 'cundinamarca', '1 día'),
    plan('demo-plan-cafe', 'Ruta del Café', 'quindio', '3 días'),
    plan('demo-plan-cocuy', 'Nevado del Cocuy', 'boyaca', '4 días')
  ];
  // [id, plan, inicio, fin, cupos_total, ocupados]
  const defs = [
    ['demo-salida-oceta', planes[0], d(6), d(6), 12, 10],
    ['demo-salida-guatavita', planes[1], d(7), d(7), 12, 10],
    ['demo-salida-cafe', planes[2], d(12), d(14), 8, 3],
    ['demo-salida-cocuy', planes[3], d(19), d(22), 14, 4]
  ];
  const salida = defs.map(([id, p, ini, fin, total]) => ({
    id, plan_id: p.id, fecha_inicio: ini, fecha_fin: fin, cupos_total: total,
    precio: 2000000, estado: 'abierta', fecha_limite_pago: d(9), plan: p
  }));
  const v_salidas_publicas = defs.map(([id, p, ini, fin, total, ocu]) => ({
    salida_id: id, plan_id: p.id, plan_nombre: p.nombre, destino_id: p.destino_id,
    fecha_inicio: ini, fecha_fin: fin, cupos_total: total, cupos_ocupados: ocu,
    estado: 'abierta', nota: null
  }));

  const viajero = [{
    id: VIAJERO, user_id: UID, nombre: 'Viajera Uno', tipo_doc: 'CC', num_doc: '····1234',
    nacimiento: '1990-03-12', celular: '+57 300 000 0001', correo: 'viajera.uno@prueba.invalid',
    ciudad: 'Bogotá', instagram: null, talla: 'M', dieta: null, como_nos_conocio: null,
    viajes_historicos: ['nevado-santa-isabel', 'paramillo-del-quindio', 'sumapaz', 'chingaza'],
    origen: 'app', editado_en_app: false
  }];
  const viajero_privado = [{
    viajero_id: VIAJERO, talla: 'M', eps: 'EPS de prueba', rh: 'O+', condicion: null, alergias: null,
    medicamentos: null, emergencia_nombre: 'Contacto de prueba', emergencia_tel: '+57 300 000 0002',
    emergencia_parentesco: null
  }];

  const inscripcion = [{
    id: 'demo-insc-1', salida_id: 'demo-salida-cocuy', viajero_id: VIAJERO, titular_id: null,
    cupos_reservados: 3, valor_acordado: 6000000, codigo_reserva: 'XPE-0001', estado: 'confirmada'
  }];
  const v_inscripcion_saldo = [{
    inscripcion_id: 'demo-insc-1', salida_id: 'demo-salida-cocuy', viajero_id: VIAJERO, titular_id: null,
    moneda: 'COP', valor_acordado: 6000000, pagado: 3500000, por_validar: 780000, saldo: 2500000,
    req_total: 0, req_pendientes: 0, req_bloqueantes_pendientes: 0, listo_para_ir: false,
    estado_mostrado: 'confirmada'
  }];
  const acompanantes = [{
    inscripcion_id: 'demo-insc-2', nombre: 'Viajera Dos', salida_id: 'demo-salida-cocuy',
    plan_nombre: 'Nevado del Cocuy', valor_acordado: 2000000, saldo: 0, moneda: 'COP'
  }];

  const cuenta = [
    {id: 'demo-cuenta-1', nombre: 'Cuenta de ahorros Demo', medio: 'Transferencia', activa: true,
     detalle_publico: 'Banco Ficticio · cuenta 000-000000-00 · a nombre de Xperiencia Demo'},
    {id: 'demo-cuenta-2', nombre: 'Nequi Demo', medio: 'Nequi', activa: true,
     detalle_publico: '+57 300 000 0003 · Xperiencia Demo'}
  ];
  const politica_cancelacion = [{
    id: 'general', nombre: 'General',
    texto_voucher: 'Política de cancelación de prueba: este es un demo con datos ficticios.'
  }];

  return {
    tablas: {viajero, viajero_privado, salida, v_salidas_publicas, politica_cancelacion,
      cuenta, inscripcion, v_inscripcion_saldo, perfil: []},
    acompanantes,
    usuario: {id: UID, email: 'viajera.uno@prueba.invalid'}
  };
}
