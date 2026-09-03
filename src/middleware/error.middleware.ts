import { NextFunction, Request, Response } from 'express';

/**
 * Error de negocio controlado (equivalente a los `require(...)` usados en los
 * repositorios de Kotlin de la app Android). Se lanza con un mensaje claro y
 * un código de estado HTTP apropiado (400 por defecto).
 */
export class ErrorNegocio extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
  }
}

/** Middleware final: convierte cualquier error lanzado en una respuesta JSON consistente. */
export function manejadorErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErrorNegocio) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

/** Envuelve un controlador async para que sus errores lleguen automáticamente al manejador de errores. */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
