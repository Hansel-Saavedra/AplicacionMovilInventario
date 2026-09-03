import { EstadoVenta, FormaPago, TipoMovimiento } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ErrorNegocio } from '../../middleware/error.middleware';

interface ItemVenta {
  productoId: number;
  cantidad: number;
}

/**
 * RF-VEN-01, RF-VEN-02, RF-VEN-03, RF-VEN-04, RF-INV-07: registra una venta de forma
 * transaccional. Es la traducción directa de VentaRepository.registrarVenta() de la
 * app Android: valida stock disponible para cada línea, calcula el total, crea la
 * venta y su detalle, descuenta el inventario y registra el movimiento de salida.
 * Si cualquier paso falla, la transacción completa se revierte (no se guarda nada).
 */
export async function registrarVenta(items: ItemVenta[], formaPago: FormaPago, clienteId?: number | null) {
  if (!items || items.length === 0) {
    throw new ErrorNegocio('La venta debe tener al menos un producto');
  }
  if (formaPago === FormaPago.CREDITO && !clienteId) {
    throw new ErrorNegocio('Selecciona un cliente para una venta a crédito');
  }

  return prisma.$transaction(async (tx) => {
    const productos = await Promise.all(
      items.map((item) => tx.producto.findUnique({ where: { id: item.productoId } }))
    );

    let total = 0;
    productos.forEach((producto, indice) => {
      const item = items[indice];
      if (!producto) {
        throw new ErrorNegocio(`El producto con id ${item.productoId} no existe`);
      }
      if (producto.cantidadDisponible < item.cantidad) {
        throw new ErrorNegocio(
          `No hay stock suficiente de "${producto.nombre}": disponible ${producto.cantidadDisponible}, solicitado ${item.cantidad}`
        );
      }
      total += producto.precioVenta * item.cantidad;
    });

    const estadoInicial = formaPago === FormaPago.CONTADO ? EstadoVenta.PAGADA : EstadoVenta.PENDIENTE;

    const venta = await tx.venta.create({
      data: {
        formaPago,
        clienteId: clienteId ?? null,
        valorTotal: total,
        estado: estadoInicial,
      },
    });

    for (let indice = 0; indice < items.length; indice++) {
      const producto = productos[indice]!;
      const item = items[indice];

      await tx.detalleVenta.create({
        data: {
          ventaId: venta.id,
          productoId: producto.id,
          cantidad: item.cantidad,
          precioUnitario: producto.precioVenta,
          costoUnitario: producto.costo,
        },
      });

      await tx.producto.update({
        where: { id: producto.id },
        data: { cantidadDisponible: { decrement: item.cantidad } },
      });

      await tx.movimientoInventario.create({
        data: {
          productoId: producto.id,
          tipo: TipoMovimiento.SALIDA,
          cantidad: item.cantidad,
          motivo: `Venta #${venta.id}`,
        },
      });
    }

    return tx.venta.findUnique({
      where: { id: venta.id },
      include: { detalles: true },
    });
  });
}

// RF-VEN-05: historial de ventas.
export async function listarVentas() {
  return prisma.venta.findMany({
    orderBy: { fecha: 'desc' },
    include: { detalles: true },
  });
}

// RF-VEN-06: anular una venta, revirtiendo el inventario que había descontado.
export async function anularVenta(id: number) {
  return prisma.$transaction(async (tx) => {
    const venta = await tx.venta.findUnique({ where: { id }, include: { detalles: true } });
    if (!venta) throw new ErrorNegocio('Venta no encontrada', 404);
    if (venta.estado === EstadoVenta.ANULADA) throw new ErrorNegocio('Esta venta ya estaba anulada');

    for (const detalle of venta.detalles) {
      await tx.producto.update({
        where: { id: detalle.productoId },
        data: { cantidadDisponible: { increment: detalle.cantidad } },
      });
      await tx.movimientoInventario.create({
        data: {
          productoId: detalle.productoId,
          tipo: TipoMovimiento.ENTRADA,
          cantidad: detalle.cantidad,
          motivo: `Anulación de venta #${venta.id}`,
        },
      });
    }

    return tx.venta.update({ where: { id }, data: { estado: EstadoVenta.ANULADA } });
  });
}
