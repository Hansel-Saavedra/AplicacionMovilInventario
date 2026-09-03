import { EstadoVenta } from '@prisma/client';
import type { DetalleVenta, Producto, Venta } from '@prisma/client';
import { prisma } from '../../config/prisma';

/**
 * La ganancia se calcula siempre a partir de precioUnitario y costoUnitario,
 * capturados en cada DetalleVenta al momento de la venta, y no del costo o
 * precio actual del producto (ver diseño de arquitectura, sección 7), para que
 * la ganancia histórica no cambie si esos valores se editan después.
 */

// RF-GAN-02, RF-GAN-03: ganancia acumulada en un periodo.
export async function calcularGananciaPeriodo(desde: Date, hasta: Date): Promise<number> {
  const detalles = await prisma.detalleVenta.findMany({
    where: {
      venta: {
        estado: { not: EstadoVenta.ANULADA },
        fecha: { gte: desde, lte: hasta },
      },
    },
  });
  return detalles.reduce((suma: number, d: DetalleVenta) => suma + (d.precioUnitario - d.costoUnitario) * d.cantidad, 0);
}

// RF-GAN-04: ganancia por producto en un periodo, de mayor a menor.
export async function calcularGananciaPorProducto(desde: Date, hasta: Date) {
  const detalles = await prisma.detalleVenta.findMany({
    where: {
      venta: {
        estado: { not: EstadoVenta.ANULADA },
        fecha: { gte: desde, lte: hasta },
      },
    },
    include: { producto: true },
  });

  const agrupado = new Map<number, { nombreProducto: string; cantidadVendida: number; gananciaTotal: number }>();
  for (const detalle of detalles) {
    const actual = agrupado.get(detalle.productoId) ?? {
      nombreProducto: detalle.producto.nombre,
      cantidadVendida: 0,
      gananciaTotal: 0,
    };
    actual.cantidadVendida += detalle.cantidad;
    actual.gananciaTotal += (detalle.precioUnitario - detalle.costoUnitario) * detalle.cantidad;
    agrupado.set(detalle.productoId, actual);
  }

  return Array.from(agrupado.entries())
    .map(([productoId, valores]) => ({ productoId, ...valores }))
    .sort((a, b) => b.gananciaTotal - a.gananciaTotal);
}

// RF-GAN-05: ganancia potencial si se vendiera todo el inventario disponible.
export async function proyectarGananciaInventario(): Promise<number> {
  const productos = await prisma.producto.findMany({ where: { activo: true } });
  return productos.reduce((suma: number, p: Producto) => suma + (p.precioVenta - p.costo) * p.cantidadDisponible, 0);
}

// RF-GAN-06 / RF-REP-02: resumen general del negocio para el panel principal.
export async function obtenerResumenNegocio(desde: Date, hasta: Date) {
  const ventas = await prisma.venta.findMany({
    where: { estado: { not: EstadoVenta.ANULADA }, fecha: { gte: desde, lte: hasta } },
  });
  const [gananciaPeriodo, gananciaPotencialInventario] = await Promise.all([
    calcularGananciaPeriodo(desde, hasta),
    proyectarGananciaInventario(),
  ]);

  return {
    numeroVentas: ventas.length,
    totalVentas: ventas.reduce((suma: number, v: Venta) => suma + v.valorTotal, 0),
    gananciaPeriodo,
    gananciaPotencialInventario,
  };
}
