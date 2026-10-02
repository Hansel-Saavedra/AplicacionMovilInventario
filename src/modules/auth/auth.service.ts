import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { ErrorNegocio } from '../../middleware/error.middleware';
import { generarToken } from '../../utils/jwt';

/**
 * RF-USR-01: valida usuario y contraseña, y retorna un token JWT si son correctos.
 * Equivalente al AuthRepository.iniciarSesion() de la app Android, pero usando
 * bcrypt (con salt) en vez de un hash simple, ya que aquí sí tiene sentido invertir
 * en un algoritmo más robusto (el servidor puede ser el objetivo de ataques externos).
 */
export async function iniciarSesion(usuario: string, contrasena: string) {
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  if (!encontrado) {
    throw new ErrorNegocio('Usuario o contraseña incorrectos', 401);
  }

  const esValida = await bcrypt.compare(contrasena, encontrado.contrasenaHash);
  if (!esValida) {
    throw new ErrorNegocio('Usuario o contraseña incorrectos', 401);
  }

  const token = generarToken({ usuarioId: encontrado.id, usuario: encontrado.usuario });
  return {
    token,
    usuario: encontrado.usuario,
    nombreNegocio: encontrado.nombreNegocio,
  };
}

// Normaliza la respuesta de seguridad (sin mayúsculas ni espacios extremos) para que
// la verificación no sea sensible a cómo el usuario escribió la respuesta.
function normalizarRespuesta(texto: string): string {
  return texto.trim().toLowerCase();
}

// RF-USR-03: primer paso de la recuperación de contraseña; devuelve la pregunta de
// seguridad configurada para el usuario, sin revelar si existe o no de forma distinta
// a un error genérico (para no filtrar qué usuarios existen en el sistema).
export async function obtenerPreguntaSeguridad(usuario: string) {
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  if (!encontrado || !encontrado.preguntaSeguridad) {
    throw new ErrorNegocio('No se encontró una pregunta de seguridad configurada para este usuario', 404);
  }
  return { preguntaSeguridad: encontrado.preguntaSeguridad };
}

// RF-USR-03: segundo paso; valida la respuesta de seguridad y, si es correcta,
// establece la nueva contraseña.
export async function restablecerContrasena(usuario: string, respuestaSeguridad: string, nuevaContrasena: string) {
  const encontrado = await prisma.usuario.findUnique({ where: { usuario } });
  if (!encontrado || !encontrado.respuestaSeguridadHash) {
    throw new ErrorNegocio('No se encontró una pregunta de seguridad configurada para este usuario', 404);
  }

  const respuestaValida = await bcrypt.compare(
    normalizarRespuesta(respuestaSeguridad),
    encontrado.respuestaSeguridadHash
  );
  if (!respuestaValida) {
    throw new ErrorNegocio('La respuesta de seguridad no es correcta', 401);
  }

  if (nuevaContrasena.length < 6) {
    throw new ErrorNegocio('La nueva contraseña debe tener al menos 6 caracteres');
  }

  const nuevoHash = await bcrypt.hash(nuevaContrasena, 10);
  await prisma.usuario.update({ where: { usuario }, data: { contrasenaHash: nuevoHash } });
}
