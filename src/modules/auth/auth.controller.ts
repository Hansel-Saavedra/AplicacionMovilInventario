import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as authService from './auth.service';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, contrasena } = req.body ?? {};
  if (!usuario || !contrasena) {
    throw new ErrorNegocio('Usuario y contraseña son obligatorios');
  }
  const resultado = await authService.iniciarSesion(usuario, contrasena);
  res.json(resultado);
});

// RF-USR-03: primer paso de la recuperación de contraseña.
export const preguntaSeguridad = asyncHandler(async (req: Request, res: Response) => {
  const usuario = typeof req.query.usuario === 'string' ? req.query.usuario : '';
  if (!usuario) throw new ErrorNegocio('Debes indicar el usuario');
  res.json(await authService.obtenerPreguntaSeguridad(usuario));
});

// RF-USR-03: segundo paso de la recuperación de contraseña.
export const restablecerContrasena = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, respuestaSeguridad, nuevaContrasena } = req.body ?? {};
  if (!usuario || !respuestaSeguridad || !nuevaContrasena) {
    throw new ErrorNegocio('Usuario, respuesta de seguridad y nueva contraseña son obligatorios');
  }
  await authService.restablecerContrasena(usuario, respuestaSeguridad, nuevaContrasena);
  res.json({ mensaje: 'Contraseña actualizada correctamente' });
});

// Seguridad: renovar el token de acceso usando el token de refresco.
export const refrescar = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) throw new ErrorNegocio('El token de refresco es obligatorio');
  res.json(await authService.refrescarToken(refreshToken));
});

// Seguridad: cerrar cualquier otra sesión activa (requiere estar autenticado
// con un token de acceso vigente en el dispositivo desde el que se llama).
export const cerrarOtrasSesiones = asyncHandler(async (req: AuthRequest, res: Response) => {
  await authService.cerrarOtrasSesiones(req.usuario!.usuarioId);
  res.json({ mensaje: 'Se cerraron todas las demás sesiones' });
});

// US-USR-04: registrar/actualizar el nombre del negocio.
export const actualizarNombreNegocio = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { nombreNegocio } = req.body ?? {};
  if (!nombreNegocio || typeof nombreNegocio !== 'string') {
    throw new ErrorNegocio('El nombre del negocio es obligatorio');
  }
  res.json(await authService.actualizarNombreNegocio(req.usuario!.usuarioId, nombreNegocio));
});
