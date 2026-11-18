/* Copiar al portapapeles y descargar un archivo de texto. Nada toca document al importarse. */

/* Copia `texto`. Primero la API moderna (solo en https o localhost); si no hay o la rechazan,
   el truco del textarea oculto + execCommand. Devuelve true si copió; false si el navegador no
   dejó (la pantalla entonces muestra el texto para copiarlo a mano). */
export async function copiarTexto(texto){
  try{
    if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText){
      await navigator.clipboard.writeText(texto);
      return true;
    }
  }catch(e){ /* cae al plan B */ }
  try{
    const t = document.createElement('textarea');
    t.value = texto;
    t.setAttribute('readonly', '');
    t.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(t);
    t.select();
    t.setSelectionRange(0, texto.length);
    const ok = document.execCommand('copy');
    t.remove();
    return !!ok;
  }catch(e){
    return false;
  }
}

/* Descarga `texto` como archivo `nombre`. `tipo` es el tipo MIME (con charset). */
export function descargarTexto(nombre, texto, tipo){
  const blob = new Blob([texto], {type: tipo});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
