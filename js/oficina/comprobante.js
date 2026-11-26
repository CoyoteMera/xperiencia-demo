/* Abrir un comprobante guardado: la URL se firma al hacer clic (10 minutos) y no se guarda en ningún
   lado. La ventana se abre antes del await para que el navegador no la tome por una ventana emergente.
   Solo toca window y Supabase cuando se la llama, no al importarse. */
import { supa } from '../comun/supa.js';
import { avisar } from '../comun/util.js';

export async function abrirComprobanteFirmado(path){
  if(!path) return avisar('Este abono no tiene comprobante.', true);
  const w = window.open('', '_blank');
  try{
    const u = await supa.storage.from('comprobantes').createSignedUrl(path, 600);
    if(u.error || !u.data) throw new Error(u.error ? String(u.error.message) : 'sin URL');
    if(w){ w.opener = null; w.location.href = u.data.signedUrl; }
    else avisar('Tu navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo otra vez.', true);
  }catch(e){
    if(w) w.close();
    console.warn('Error al firmar el comprobante:', e);
    avisar('No pudimos abrir el comprobante. Intenta de nuevo o escríbenos.', true);
  }
}
