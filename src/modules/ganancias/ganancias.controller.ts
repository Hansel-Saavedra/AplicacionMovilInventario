import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as gananciasService from './ganancias.service';

/**
 * Lee "desde" y "hasta" como query params en formato ISO (ej. ?desde=2026-08-01&hasta=2026-08-27).
 * Si no se especifican, se usa por defecto el día actual completo.
 */
function leerRangoFechas(req: Request): { desde: Date; hasta: Date } {
  const { desde, hasta } = req.query;

  if (desde && hasta) {
    const desdeFecha = new Date(String(desde));
    const hastaFecha = new Date(String(hasta));
    if (isNaN(desdeFecha.getTime()) || isNaN(hastaFecha.getTime())) {
      throw new ErrorNegocio('Los parámetros "desde" y "hasta" deben ser fechas válidas (ISO 8601)');
    }
    return { desde: desdeFecha, hasta: hastaFecha };
  }

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  return { desde: inicioHoy, hasta: new Date() };
}

export const resumen = asyncHandler(async (req: Request, res: Response) => {
  const { desde, hasta } = leerRangoFechas(req);
  res.json(await gananciasService.obtenerResumenNegocio(desde, hasta));
});

export const porProducto = asyncHandler(async (req: Request, res: Response) => {
  const { desde, hasta } = leerRangoFechas(req);
  res.json(await gananciasService.calcularGananciaPorProducto(desde, hasta));
});

export const proyeccionInventario = asyncHandler(async (_req: Request, res: Response) => {
  const gananciaPotencialInventario = await gananciasService.proyectarGananciaInventario();
  res.json({ gananciaPotencialInventario });
});
