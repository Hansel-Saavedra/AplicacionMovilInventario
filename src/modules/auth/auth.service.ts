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
