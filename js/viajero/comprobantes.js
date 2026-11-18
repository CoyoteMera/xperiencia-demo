/* Comprobantes de pago: valida el archivo, lo sube a Storage y registra el abono "por validar".
   La oficina lo valida o lo rechaza; hasta entonces el abono no cuenta en el saldo. */
import { supa, rpc } from '../comun/supa.js';
import { uidActual } from './almacen.js';
import { uuid } from '../comun/util.js';

export const MAX_BYTES = 10 * 1024 * 1024;

/* Lista blanca de tipos (sin SVG: puede llevar scripts). Es la MISMA que allowed_mime_types del
   bucket «comprobantes» (migración 20261109000200_storage_comprobantes.sql): si cambia una, cambia la otra. */
const EXT_POR_TIPO = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'image/heif': 'heif', 'image/gif': 'gif', 'application/pdf': 'pdf'};
export const TIPOS_PERMITIDOS = Object.keys(EXT_POR_TIPO);

/* null si el archivo sirve; si no, el mensaje para la persona. Fotos (lista blanca) y PDF, hasta 10 MB. */
export function validarArchivo(archivo){
  if(!archivo) return 'Escoge el archivo del comprobante.';
  if(!TIPOS_PERMITIDOS.includes(String(archivo.type || ''))) return 'Sube una foto o un PDF del comprobante.';
  if(archivo.size > MAX_BYTES) return 'El archivo pesa más de 10 MB. Mándalo por WhatsApp.';
  return null;
}

/* Monto escrito por la persona -> número, o null si no sirve. COP: enteros (los puntos de miles
   se ignoran). USD: entero o hasta 2 decimales, con punto o coma. No suma nada. */
export function parsearMonto(texto, moneda){
  const t = String(texto || '').trim().replace(/\s/g, '');
  if(moneda === 'USD'){
    if(!/^\d+([.,]\d{1,2})?$/.test(t)) return null;
    const n = Number(t.replace(',', '.'));
    return n > 0 ? n : null;
  }
  if(!/^\d+(\.\d{3})*$/.test(t)) return null;
  const n = parseInt(t.replace(/\./g, ''), 10);
  return n > 0 ? n : null;
}

/* <uid>/<uuid>.<ext> dentro del bucket «comprobantes»: es la ruta que permiten las políticas de
   Storage (la carpeta es mi auth.uid()) y la que registrar_abono exige empezar por mi uid. La
   extensión sale SOLO del tipo del archivo, nunca de su nombre. */
export function rutaComprobante(uid, uuid, archivo){
  const ext = EXT_POR_TIPO[archivo.type];
  if(!ext) throw new Error('Sube una foto o un PDF del comprobante.');
  return uid + '/' + uuid + '.' + ext;
}

/* Sube el comprobante y registra el abono con p_validar = false (solo la oficina valida).
   asignaciones = [{inscripcion_id, monto}] (en la moneda del plan). opciones: {pagador (mi
   viajero), monto, moneda, medio, cuenta, fecha}. `monto` se pide aparte: el navegador no suma
   asignaciones; si falta y hay una sola asignación, vale el de esa. Devuelve el id del abono. */
export async function subirComprobante(archivo, asignaciones, opciones = {}){
  const motivo = validarArchivo(archivo);
  if(motivo) throw new Error(motivo);
  if(!Array.isArray(asignaciones) || !asignaciones.length) throw new Error('Indica a qué inscripción va el abono.');
  const monto = opciones.monto !== undefined ? opciones.monto
    : (asignaciones.length === 1 ? asignaciones[0].monto : null);
  if(!(Number(monto) > 0)) throw new Error('Escribe cuánto abonaste.');
  const uid = uidActual();
  if(!uid) throw new Error('Inicia sesión para subir el comprobante.');

  const ruta = rutaComprobante(uid, uuid(), archivo);
  const {error} = await supa.storage.from('comprobantes').upload(ruta, archivo,
    {contentType: archivo.type || 'application/octet-stream', upsert: false});
  if(error) throw new Error('No pudimos subir el archivo: ' + error.message);

  return rpc('registrar_abono', {
    p_pagador: opciones.pagador, p_monto: monto, p_moneda: opciones.moneda || 'COP', p_trm: null,
    p_fecha: opciones.fecha || null, p_medio: opciones.medio || null, p_cuenta: opciones.cuenta || null,
    p_comprobante_path: ruta, p_asignaciones: asignaciones, p_validar: false
  });
}
