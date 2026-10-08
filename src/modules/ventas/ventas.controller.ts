import { FormaPago } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as ventasService from './ventas.service';

// RF-VEN-05: filtros opcionales por fecha, cliente o producto.
export const listar = asyncHandler(async (req: Request, res: Response) => {
  const { desde, hasta, clienteId, productoId } = req.query;

  const filtros: Parameters<typeof ventasService.listarVentas>[0] = {};
  if (typeof desde === 'string' && desde) filtros.desde = new Date(desde);
  if (typeof hasta === 'string' && hasta) filtros.hasta = new Date(hasta);
  if (typeof clienteId === 'string' && clienteId) filtros.clienteId = Number(clienteId);
  if (typeof productoId === 'string' && productoId) filtros.productoId = Number(productoId);

  res.json(await ventasService.listarVentas(filtros));
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const { items, formaPago, clienteId, adelantoInicial } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorNegocio('La venta debe incluir al menos un producto');
  }
  if (formaPago !== FormaPago.CONTADO && formaPago !== FormaPago.CREDITO) {
    throw new ErrorNegocio('La forma de pago debe ser CONTADO o CREDITO');
  }
  if (adelantoInicial !== undefined && typeof adelantoInicial !== 'number') {
    throw new ErrorNegocio('El adelanto inicial debe ser un valor numérico');
  }

  const venta = await ventasService.registrarVenta(items, formaPago, clienteId ?? null, adelantoInicial);
  res.status(201).json(venta);
});

export const anular = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await ventasService.anularVenta(id));
});
