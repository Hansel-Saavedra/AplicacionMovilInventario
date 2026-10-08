import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// El token de acceso dura poco porque viaja en cada petición (si se filtrara,
// la ventana de uso indebido es corta). El token de refresco dura mucho, pero
// solo sirve para pedir un nuevo token de acceso: nunca se acepta directamente
// en las rutas protegidas (ver auth.middleware.ts, que exige tipo "acceso").
const DURACION_TOKEN_ACCESO = '15m';
const DURACION_TOKEN_REFRESCO = '30d';

export type TipoToken = 'acceso' | 'refresco';

export interface JwtPayload {
  usuarioId: number;
  usuario: string;
  // Debe coincidir con el tokenVersion vigente del usuario en la base de datos;
  // si no coincide, el token se considera revocado aunque no haya expirado.
  tokenVersion: number;
  tipo: TipoToken;
}

type DatosToken = Omit<JwtPayload, 'tipo'>;

/** Genera un token de acceso (RF-USR-01), de corta duración. */
export function generarTokenAcceso(datos: DatosToken): string {
  return jwt.sign({ ...datos, tipo: 'acceso' } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: DURACION_TOKEN_ACCESO,
  });
}

/** Genera un token de refresco, de larga duración, usado solo para renovar el de acceso. */
export function generarTokenRefresco(datos: DatosToken): string {
  return jwt.sign({ ...datos, tipo: 'refresco' } satisfies JwtPayload, JWT_SECRET, {
    expiresIn: DURACION_TOKEN_REFRESCO,
  });
}

/** Verifica y decodifica cualquiera de los dos tipos de token. */
export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
