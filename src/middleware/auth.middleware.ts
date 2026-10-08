import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { JwtPayload, verificarToken } from '../utils/jwt';

export interface AuthRequest extends Request {
  usuario?: JwtPayload;
}

/**
 * Middleware de autenticación (RF-USR-01, RF-USR-02): exige un token de
 * ACCESO válido en el encabezado "Authorization: Bearer <token>" para acceder
 * a las rutas protegidas.
 *
 * Además de verificar la firma y la expiración del token, confirma que su
 * tokenVersion coincida con el valor vigente del usuario en la base de datos.
 * Esto permite invalidar sesiones activas (por ejemplo, tras perder el
 * teléfono o cambiar la contraseña) sin tener que mantener una lista aparte
 * de tokens revocados: basta con incrementar tokenVersion una vez.
 */
export async function autenticar(req: AuthRequest, res: Response, next: NextFunction) {
  const encabezado = req.headers.authorization;
  if (!encabezado || !encabezado.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = encabezado.substring('Bearer '.length);
  try {
    const payload = verificarToken(token);

    if (payload.tipo !== 'acceso') {
      return res.status(401).json({ error: 'Este token no es un token de acceso válido' });
    }

    const usuarioActual = await prisma.usuario.findUnique({ where: { id: payload.usuarioId } });
    if (!usuarioActual || usuarioActual.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ error: 'La sesión ya no es válida; inicia sesión de nuevo' });
    }

    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}
