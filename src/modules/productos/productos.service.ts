import { TipoMovimiento } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { subirFotoProducto as subirFotoAStorage } from '../../config/supabaseStorage';
import { ErrorNegocio } from '../../middleware/error.middleware';

interface FiltrosInventario {
  texto?: string;
  talla?: string;
  color?: string;
  categoria?: string;
}

// RF-INV-04, RF-INV-05: búsqueda y filtros combinables por talla, color y categoría.
export async function listarInventario(filtros: FiltrosInventario) {
  const { texto, talla, color, categoria } = filtros;
  return prisma.producto.findMany({
    where: {
      activo: true,
      ...(talla ? { talla } : {}),
      ...(color ? { color } : {}),
      ...(categoria ? { categoria } : {}),
      ...(texto
        ? {
            OR: [
              { nombre: { contains: texto, mode: 'insensitive' } },
              { referencia: { contains: texto, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { nombre: 'asc' },
  });
}

export async function obtenerPorId(id: number) {
  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) throw new ErrorNegocio('Producto no encontrado', 404);
  return producto;
}

interface DatosProducto {
  nombre: string;
  referencia: string;
  talla?: string | null;
  color?: string | null;
  categoria?: string | null;
  costo: number;
  precioVenta: number;
  cantidadDisponible: number;
  imagenUrl?: string | null;
}

// RF-INV-01 y RF-GAN-01: registrar producto, incluyendo costo y precio de venta.
export async function registrarProducto(datos: DatosProducto) {
  if (!datos.nombre?.trim()) throw new ErrorNegocio('El nombre del producto es obligatorio');
  if (!datos.referencia?.trim()) throw new ErrorNegocio('La referencia es obligatoria');
  if (datos.costo < 0) throw new ErrorNegocio('El costo no puede ser negativo');
  if (datos.precioVenta < 0) throw new ErrorNegocio('El precio de venta no puede ser negativo');
  if (datos.cantidadDisponible < 0) throw new ErrorNegocio('La cantidad inicial no puede ser negativa');

  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.create({
      data: {
        nombre: datos.nombre.trim(),
        referencia: datos.referencia.trim(),
        talla: datos.talla || null,
        color: datos.color || null,
        categoria: datos.categoria || null,
        costo: datos.costo,
        precioVenta: datos.precioVenta,
        cantidadDisponible: datos.cantidadDisponible,
      },
    });

    if (datos.cantidadDisponible > 0) {
      await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          tipo: TipoMovimiento.ENTRADA,
          cantidad: datos.cantidadDisponible,
          motivo: 'Registro inicial de producto',
        },
      });
    }

    return producto;
  });
}

// RF-INV-02: editar producto.
export async function actualizarProducto(id: number, datos: Partial<DatosProducto>) {
  await obtenerPorId(id);
  if (datos.costo !== undefined && datos.costo < 0) throw new ErrorNegocio('El costo no puede ser negativo');
  if (datos.precioVenta !== undefined && datos.precioVenta < 0) {
    throw new ErrorNegocio('El precio de venta no puede ser negativo');
  }
  return prisma.producto.update({ where: { id }, data: datos });
}

// RF-INV-03: desactivar producto (se conserva su historial).
export async function desactivarProducto(id: number) {
  await obtenerPorId(id);
  return prisma.producto.update({ where: { id }, data: { activo: false } });
}

// RF-INV-06: registrar entrada de inventario (reabastecimiento).
export async function registrarEntrada(id: number, cantidad: number) {
  if (cantidad <= 0) throw new ErrorNegocio('La cantidad a ingresar debe ser mayor a cero');
  await obtenerPorId(id);

  return prisma.$transaction(async (tx) => {
    const producto = await tx.producto.update({
      where: { id },
      data: { cantidadDisponible: { increment: cantidad } },
    });
    await tx.movimientoInventario.create({
      data: { productoId: id, tipo: TipoMovimiento.ENTRADA, cantidad, motivo: 'Reabastecimiento' },
    });
    return producto;
  });
}

// RF-INV-09: historial de movimientos de un producto.
export async function obtenerMovimientos(id: number) {
  await obtenerPorId(id);
  return prisma.movimientoInventario.findMany({
    where: { productoId: id },
    orderBy: { fecha: 'desc' },
  });
}

// RF-INV-10: subir/reemplazar la fotografía de un producto.
export async function subirFoto(id: number, archivo: Buffer, mimeType: string) {
  await obtenerPorId(id);
  const imagenUrl = await subirFotoAStorage(id, archivo, mimeType);
  return prisma.producto.update({ where: { id }, data: { imagenUrl } });
}

// Valores distintos usados para poblar los chips de filtro en la app (RF-INV-04).
export async function obtenerValoresFiltro() {
  const [tallas, colores, categorias] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true, talla: { not: null } },
      select: { talla: true },
      distinct: ['talla'],
      orderBy: { talla: 'asc' },
    }),
    prisma.producto.findMany({
      where: { activo: true, color: { not: null } },
      select: { color: true },
      distinct: ['color'],
      orderBy: { color: 'asc' },
    }),
    prisma.producto.findMany({
      where: { activo: true, categoria: { not: null } },
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    }),
  ]);

  return {
    tallas: tallas.map((t: { talla: string | null }) => t.talla),
    colores: colores.map((c: { color: string | null }) => c.color),
    categorias: categorias.map((c: { categoria: string | null }) => c.categoria),
  };
}
