import { Request, Response } from 'express';
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
