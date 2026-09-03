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
