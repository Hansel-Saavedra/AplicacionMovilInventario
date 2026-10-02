import { Request, Response } from 'express';
import { asyncHandler, ErrorNegocio } from '../../middleware/error.middleware';
import { descomponerIva } from '../../utils/iva';
import * as productosService from './productos.service';

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png'];
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5 MB

// Agrega, a la respuesta de cada producto, el desglose de IVA de su precio de
// venta (RF nuevo solicitado por el docente mediador), sin modificar el
// registro almacenado: el desglose se calcula en el momento de responder.
function conDesgloseIva<T extends { precioVenta: number }>(producto: T) {
  const desglose = descomponerIva(producto.precioVenta);
  return {
    ...producto,
    valorBaseVenta: desglose.valorBase,
    valorIvaVenta: desglose.valorIva,
  };
}

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const { texto, talla, color, categoria } = req.query;
  const productos = await productosService.listarInventario({
    texto: typeof texto === 'string' ? texto : undefined,
    talla: typeof talla === 'string' ? talla : undefined,
    color: typeof color === 'string' ? color : undefined,
    categoria: typeof categoria === 'string' ? categoria : undefined,
  });
  res.json(productos.map(conDesgloseIva));
});

export const obtenerFiltros = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await productosService.obtenerValoresFiltro());
});

export const obtenerUno = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(conDesgloseIva(await productosService.obtenerPorId(id)));
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productosService.registrarProducto(req.body);
  res.status(201).json(conDesgloseIva(producto));
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(conDesgloseIva(await productosService.actualizarProducto(id, req.body)));
});

export const desactivar = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(conDesgloseIva(await productosService.desactivarProducto(id)));
});

export const registrarEntrada = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { cantidad } = req.body ?? {};
  if (typeof cantidad !== 'number') throw new ErrorNegocio('La cantidad es obligatoria y debe ser numérica');
  res.json(conDesgloseIva(await productosService.registrarEntrada(id, cantidad)));
});

export const obtenerMovimientos = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  res.json(await productosService.obtenerMovimientos(id));
});

// RF-INV-10: subir/reemplazar la fotografía de un producto. El middleware de
// multer (definido en productos.routes.ts) deja el archivo en req.file.
export const subirFoto = asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const archivo = (req as Request & { file?: Express.Multer.File }).file;

  if (!archivo) throw new ErrorNegocio('Debes adjuntar una imagen en el campo "foto"');
  if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
    throw new ErrorNegocio('Solo se permiten imágenes JPEG o PNG');
  }
  if (archivo.size > TAMANO_MAXIMO_BYTES) {
    throw new ErrorNegocio('La imagen no puede superar los 5 MB');
  }

  res.json(conDesgloseIva(await productosService.subirFoto(id, archivo.buffer, archivo.mimetype)));
});
