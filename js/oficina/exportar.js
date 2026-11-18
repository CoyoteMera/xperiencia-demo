/* Exportar una tabla: para pegar en Excel/Sheets (TSV) o para descargar (CSV).
   Funciones puras: no tocan el DOM ni se ejecuta nada al importar. `filas` es una lista de
   objetos con las mismas claves; las claves de la primera fila son los encabezados. */

const BOM = '﻿';

/* Objetos y arreglos (p. ej. el jsonb de requisitos) se escriben como JSON: String() daría
   «[object Object]». Si no se pueden serializar (ciclos), la celda queda vacía. */
function texto(v){
  if(v == null) return '';
  if(typeof v === 'object' && !(v instanceof Date)){
    try { return JSON.stringify(v) ?? ''; } catch { return ''; }
  }
  return String(v);
}

/* Evita que Excel lea una celda de texto como fórmula (= + - @ o un tab/CR al inicio): se le
   antepone una comilla simple. Solo afecta a TEXTO: un número JS (-5) se escribe tal cual, y una
   fecha ISO o «123» (que no empiezan por esos signos) no se tocan. La clase va con el guion
   escapado: sin escapar, [=+-@] sería un rango que incluye dígitos. */
const INICIO_FORMULA = /^[=+\-@\t\r]/;

/* export_inscritos devuelve `requisitos` como jsonb {nombre: 'OK' | ''}. Para la hoja hace falta UNA
   columna por requisito (con el nombre del requisito de encabezado): esta función pura lo expande
   en el mismo lugar donde estaba `requisitos`, antes de aTSV/aCSV. No muta las filas.
   - Todas las filas salen con las mismas columnas (la unión de los requisitos de todas); el que a
     una fila no le aplica queda vacío.
   - El jsonb de Postgres no conserva el orden de las claves, así que el orden lo da `orden`: la
     lista de nombres de requisito por `requisito.orden` (la pantalla la pide a la tabla
     `requisito`). Los nombres que no estén en `orden` van después, en el orden en que aparecen.
   - Sin `requisitos` en las filas (o todos vacíos) no agrega columnas y quita la columna.
   - Un requisito que se llame como otra columna (p. ej. «Saldo») no la pisa: sale como
     «Requisito: Saldo». */
export function aplanarRequisitos(filas, orden){
  if(!filas || !filas.length) return [];
  const nombres = [];
  for(const f of filas){
    const r = f && f.requisitos;
    if(r && typeof r === 'object') for(const n of Object.keys(r)) if(!nombres.includes(n)) nombres.push(n);
  }
  const pos = n => { const i = (orden || []).indexOf(n); return i < 0 ? Infinity : i; };
  // sort estable: los de `orden` primero según su lugar; el resto conserva el orden de aparición
  nombres.sort((a, b) => pos(a) - pos(b));
  return filas.map(f => {
    const otras = Object.keys(f).filter(k => k !== 'requisitos');
    const enc = n => (otras.includes(n) ? 'Requisito: ' + n : n);
    const r = (f.requisitos && typeof f.requisitos === 'object') ? f.requisitos : {};
    const salida = [];
    for(const k of Object.keys(f)){
      if(k !== 'requisitos') salida.push([k, f[k]]);
      else for(const n of nombres) salida.push([enc(n), r[n] == null ? '' : r[n]]);
    }
    return Object.fromEntries(salida);
  });
}

/* TSV: tabuladores y saltos de línea dentro de una celda pasan a un espacio (limpiarCelda de la
   v22), para que cada fila siga siendo una fila al pegar; después, igual que en CSV, el texto que
   empieza como fórmula lleva un apóstrofo (en celdas y encabezados). `encabezados` agrega la
   primera línea. */
export function aTSV(filas, encabezados){
  if(!filas || !filas.length) return '';
  const claves = Object.keys(filas[0]);
  const limpiar = v => {
    const t = texto(v).replace(/[\t\r\n]+/g, ' ');
    return typeof v === 'string' && INICIO_FORMULA.test(t) ? "'" + t : t;
  };
  const lineas = filas.map(f => claves.map(c => limpiar(f[c])).join('\t'));
  if(encabezados) lineas.unshift(claves.map(limpiar).join('\t'));
  return lineas.join('\n');
}

function celdaCSV(v){
  let t = texto(v);
  if(typeof v === 'string' && INICIO_FORMULA.test(t)) t = "'" + t;
  return '"' + t.replace(/"/g, '""') + '"';
}

/* CSV para Excel en español: separador «;», BOM al inicio (para las tildes), todo entre comillas
   dobles (las internas se duplican) y líneas con \r\n. */
export function aCSV(filas){
  if(!filas || !filas.length) return BOM;
  const claves = Object.keys(filas[0]);
  const lineas = [claves.map(celdaCSV).join(';')];
  for(const f of filas) lineas.push(claves.map(c => celdaCSV(f[c])).join(';'));
  return BOM + lineas.join('\r\n');
}

/* «Exportar todo a Excel»: export_inscritos_todas() devuelve las inscripciones de todas las salidas
   próximas con `salida` como primera columna. Un solo CSV: el encabezado sale una vez y las filas
   de todas las salidas van seguidas; los requisitos se aplanan sobre la unión de todas las filas. */
export function armarCSVTodo(filas, orden){
  return aCSV(aplanarRequisitos(filas || [], orden));
}

export function nombreArchivoTodo(fecha){
  return 'inscritos-todas-las-salidas-' + fecha + '.csv';
}

/* PostgREST corta las respuestas en max_rows (supabase/config.toml, api.max_rows = 1000): si una
   exportación trae justo ese número, puede haber filas que no llegaron. Único lugar del valor. */
export const LIMITE_FILAS_RPC = 1000;

/* Mensaje en pantalla tras descargar «Exportar todo»: con el límite alcanzado no se dice «listo» a secas. */
export function avisoExportarTodo(nFilas){
  if(nFilas >= LIMITE_FILAS_RPC)
    return { texto: 'Puede haber filas sin exportar (el servidor entrega como máximo 1.000). Exporta salida por salida para estar seguro.', error: true };
  return { texto: 'Archivo listo. Ábrelo con Excel.', error: false };
}
