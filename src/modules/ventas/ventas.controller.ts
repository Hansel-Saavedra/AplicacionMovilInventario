import { FormaPago } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as ventasService from './ventas.service';

export const listar = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await ventasService.listarVentas());
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const { items, formaPago, clienteId } = req.body ?? {};

  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorNegocio('La venta debe incluir al menos un producto');
  }
  if (formaPago !== FormaPago.CONTADO && formaPago !== FormaPago.CREDITO) {
    throw new ErrorNegocio('La forma de pago debe ser CONTADO o CREDITO');
  }

  const venta = await ventasService.registrarVenta(items, formaPago, clienteId ?? null);
  res.status(201).json(venta);
});

export const anular = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await ventasService.anularVenta(id));
});
