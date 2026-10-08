import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { ErrorNegocio } from '../../middleware/error.middleware';
import { generarTokenAcceso, generarTokenRefresco, verificarToken } from '../../utils/jwt';

/**
 * RF-USR-01: valida usuario y contraseña, y retorna un token de acceso y uno
 * de refresco si son correctos. Equivalente al AuthRepository.iniciarSesion()
 * de la app Android, pero usando bcrypt (con salt) en vez de un hash simple,
 * ya que aquí sí tiene sentido invertir en un algoritmo más robusto (el
 * servidor puede ser el objetivo de ataques externos).
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

  const datosToken = { usuarioId: encontrado.id, usuario: encontrado.usuario, tokenVersion: encontrado.tokenVersion };
  return {
    token: generarTokenAcceso(datosToken),
    refreshToken: generarTokenRefresco(datosToken),
    usuario: encontrado.usuario,
    nombreNegocio: encontrado.nombreNegocio,
  };
}

// Seguridad: renueva el token de acceso a partir de un token de refresco
// válido, sin pedir usuario y contraseña de nuevo. La app Android llama esto
// automáticamente cuando el token de acceso expira (cada 15 minutos).
export async function refrescarToken(refreshToken: string) {
  let payload;
  try {
    payload = verificarToken(refreshToken);
  } catch {
    throw new ErrorNegocio('El token de refresco es inválido o expiró; inicia sesión de nuevo', 401);
  }
  if (payload.tipo !== 'refresco') {
    throw new ErrorNegocio('Este no es un token de refresco válido', 401);
  }

  const encontrado = await prisma.usuario.findUnique({ where: { id: payload.usuarioId } });
  if (!encontrado || encontrado.tokenVersion !== payload.tokenVersion) {
    throw new ErrorNegocio('La sesión ya no es válida; inicia sesión de nuevo', 401);
  }

  const datosToken = { usuarioId: encontrado.id, usuario: encontrado.usuario, tokenVersion: encontrado.tokenVersion };
  return { token: generarTokenAcceso(datosToken) };
}

// US-USR-04: registrar/actualizar el nombre del negocio, para personalizar
// la aplicación (se refleja en el panel principal y en los reportes exportados).
export async function actualizarNombreNegocio(usuarioId: number, nombreNegocio: string) {
  const nombreLimpio = nombreNegocio.trim();
  if (!nombreLimpio) {
    throw new ErrorNegocio('El nombre del negocio no puede estar vacío');
  }
  if (nombreLimpio.length > 100) {
    throw new ErrorNegocio('El nombre del negocio no puede superar los 100 caracteres');
  }
  const actualizado = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { nombreNegocio: nombreLimpio },
  });
  return { nombreNegocio: actualizado.nombreNegocio };
}

// Seguridad: invalida TODOS los tokens (de acceso y de refresco) emitidos
// hasta ahora para este usuario, incrementando el contador que el middleware
// de autenticación compara en cada petición. Útil si se pierde o roba el
// dispositivo: basta con volver a iniciar sesión en un dispositivo de
// confianza y llamar a esta función para cerrar cualquier otra sesión activa.
export async function cerrarOtrasSesiones(usuarioId: number) {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { tokenVersion: { increment: 1 } },
  });
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
  // Cambiar la contraseña invalida cualquier sesión existente (por ejemplo, si
  // alguien más la cambió sin ser el propietario), igual que cerrarOtrasSesiones.
  await prisma.usuario.update({
    where: { usuario },
    data: { contrasenaHash: nuevoHash, tokenVersion: { increment: 1 } },
  });
}
