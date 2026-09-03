import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import * as productosService from './productos.service';

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const { texto, talla, color, categoria } = req.query;
  const productos = await productosService.listarInventario({
    texto: typeof texto === 'string' ? texto : undefined,
    talla: typeof talla === 'string' ? talla : undefined,
    color: typeof color === 'string' ? color : undefined,
    categoria: typeof categoria === 'string' ? categoria : undefined,
  });
  res.json(productos);
});

export const obtenerFiltros = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await productosService.obtenerValoresFiltro());
});

export const obtenerUno = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await productosService.obtenerPorId(id));
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.registrarProducto(req.body);
  res.status(201).json(producto);
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await productosService.actualizarProducto(id, req.body));
});

export const desactivar = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await productosService.desactivarProducto(id));
});

export const registrarEntrada = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { cantidad } = req.body ?? {};
  if (typeof cantidad !== 'number') throw new ErrorNegocio('La cantidad es obligatoria y debe ser numérica');
  res.json(await productosService.registrarEntrada(id, cantidad));
});

export const obtenerMovimientos = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await productosService.obtenerMovimientos(id));
});
