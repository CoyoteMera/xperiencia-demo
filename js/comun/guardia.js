/* Guardia contra el doble clic: envuelve una función asíncrona para que, mientras una ejecución
   sigue en curso, las demás llamadas (aun síncronas, en el mismo instante) no hagan nada y
   devuelvan una promesa que resuelve a undefined. La guarda se suelta al terminar, también si
   la función falla (el error se propaga a quien hizo la primera llamada). Pura: no toca DOM. */
export function unaSolaVez(fn){
  let enCurso = false;
  return function(...args){
    if(enCurso) return Promise.resolve(undefined);
    enCurso = true;   // síncrono, antes de cualquier await
    let p;
    try{ p = Promise.resolve(fn.apply(this, args)); }
    catch(e){ enCurso = false; return Promise.reject(e); }
    return p.finally(() => { enCurso = false; });
  };
}

/* Debounce: agrupa una ráfaga de llamadas (el buscador al teclear) en una sola, `ms` después de
   la última, con los argumentos de esa última. */
export function retrasar(fn, ms){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => { t = null; fn.apply(this, args); }, ms);
  };
}

/* Contador de generaciones para descartar respuestas obsoletas: cada recarga pide un número con
   nueva() y, después de sus await, pinta solo si vigente(n) (nadie pidió otro entre medias).
   Evita que una carga lenta pise a una más nueva. */
export function generacion(){
  let n = 0;
  return {nueva: () => ++n, vigente: t => t === n};
}
