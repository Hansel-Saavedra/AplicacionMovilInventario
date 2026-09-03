import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as carteraService from './cartera.service';

export const listarClientes = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await carteraService.listarClientes());
});

export const crearCliente = asyncHandler(async (req: Request, res: Response) => {
  const { nombre, telefono } = req.body ?? {};
  res.status(201).json(await carteraService.registrarCliente(nombre, telefono));
});

export const obtenerCliente = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await carteraService.obtenerCliente(id));
});

export const actualizarCliente = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await carteraService.actualizarCliente(id, req.body ?? {}));
});

export const eliminarCliente = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await carteraService.eliminarCliente(id);
  res.status(204).send();
});

export const carteraGeneral = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await carteraService.obtenerCarteraGeneral());
});

export const saldoCliente = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const saldoPendiente = await carteraService.saldoPendienteCliente(id);
  res.json({ saldoPendiente });
});

export const ventasCliente = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await carteraService.ventasCliente(id));
});

export const historialAbonos = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await carteraService.historialAbonosCliente(id));
});

export const registrarAbono = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { monto } = req.body ?? {};
  if (typeof monto !== 'number') throw new ErrorNegocio('El monto del abono es obligatorio y debe ser numérico');
  res.status(201).json(await carteraService.registrarAbonoCliente(id, monto));
});
