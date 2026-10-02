import { createClient } from '@supabase/supabase-js';
import { ErrorNegocio } from '../middleware/error.middleware';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NOMBRE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'productos-fotos';

/**
 * Cliente de Supabase usado únicamente para subir archivos al bucket de Storage
 * (RF-INV-10). Se reutiliza el mismo proyecto de Supabase que ya aloja la base
 * de datos, para no depender de un proveedor adicional. Usa la "service role
 * key" (no la anon key) porque el backend sube archivos en nombre del usuario,
 * sin pasar por una sesión de Supabase Auth.
 */
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

/**
 * Sube la foto de un producto al bucket de Supabase Storage y retorna su URL
 * pública. El bucket debe existir y estar configurado como público (ver
 * README.md, sección "Configurar el bucket de fotos").
 */
export async function subirFotoProducto(productoId: number, archivo: Buffer, mimeType: string): Promise<string> {
  if (!supabase) {
    throw new ErrorNegocio(
      'El almacenamiento de fotos no está configurado en el servidor (faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
      500
    );
  }

  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const rutaArchivo = `producto-${productoId}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(NOMBRE_BUCKET)
    .upload(rutaArchivo, archivo, { contentType: mimeType, upsert: true });

  if (errorSubida) {
    throw new ErrorNegocio(`No fue posible subir la foto: ${errorSubida.message}`, 502);
  }

  const { data } = supabase.storage.from(NOMBRE_BUCKET).getPublicUrl(rutaArchivo);
  // Se agrega un parámetro de version (timestamp) para evitar que la app o el
  // navegador muestren una versión cacheada de una foto reemplazada.
  return `${data.publicUrl}?v=${Date.now()}`;
}
