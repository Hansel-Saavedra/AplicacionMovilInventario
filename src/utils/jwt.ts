import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = '30d';

export interface JwtPayload {
  usuarioId: number;
  usuario: string;
}

/** Genera un token firmado para un usuario autenticado (RF-USR-01). */
export function generarToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/** Verifica y decodifica un token recibido en el encabezado Authorization. */
export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
