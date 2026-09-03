import { NextFunction, Request, Response } from 'express';
import { JwtPayload, verificarToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  usuario?: JwtPayload;
}

/**
 * Middleware de autenticación (RF-USR-01, RF-USR-02): exige un token JWT válido
 * en el encabezado "Authorization: Bearer <token>" para acceder a las rutas protegidas.
 */
export function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization;
  if (!encabezado || !encabezado.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = encabezado.substring('Bearer '.length);
  try {
    req.usuario = verificarToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
