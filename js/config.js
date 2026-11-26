/* Configuración de la app. Es el ÚNICO archivo que cambia entre la base local y la de producción.

   Aquí solo va la URL del proyecto y la anon key (la clave pública: está pensada para ir en el
   navegador; lo que protege los datos es RLS en la base, no esconder esta clave).
   NUNCA pongas aquí la service role ni la cadena de conexión: esas viven en .env (fuera de git).

   Valores de ahora: la base LOCAL (`npx supabase start`), con la anon key de demostración
   que trae el CLI y que es la misma en cualquier instalación local.

   Para producción (cuando exista el proyecto de Supabase de Xperiencia, hilo R0):
     1. Supabase → Project Settings → API: copia «Project URL» y la clave «anon / public».
     2. Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY de abajo y haz commit de este archivo.
     3. En Authentication → URL Configuration: pon la dirección de la app como Site URL y en
        Redirect URLs (para el enlace de recuperar contraseña). */
export const SUPABASE_URL = 'http://127.0.0.1:54321';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
