import { EstadoVenta, FormaPago, TipoMovimiento } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ErrorNegocio } from '../../middleware/error.middleware';

interface ItemVenta {
  productoId: number;
  cantidad: number;
}

/**
 * RF-VEN-01, RF-VEN-02, RF-VEN-03, RF-VEN-04, RF-INV-07, RF-CAR-03: registra
 * una venta de forma transaccional. Es la traducción directa de
 * VentaRepository.registrarVenta() de la app Android: valida stock disponible
 * para cada línea, calcula el total, crea la venta y su detalle, descuenta el
 * inventario y registra el movimiento de salida. Si cualquier paso falla, la
 * transacción completa se revierte (no se guarda nada).
 *
 * Si la venta es a crédito y se recibe un adelanto inicial (RF-CAR-03), se
 * registra automáticamente como el primer abono de esa venta, en la misma
 * transacción; si el adelanto cubre el valor total, la venta queda marcada
 * como pagada desde su creación (misma regla que aplica cartera.service.ts
 * cuando un abono posterior hace que el saldo llegue a cero).
 */
export async function registrarVenta(
  items: ItemVenta[],
  formaPago: FormaPago,
  clienteId?: number | null,
  adelantoInicial?: number
) {
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

    // RF-CAR-03: el adelanto inicial solo tiene sentido en ventas a crédito.
    const adelanto = formaPago === FormaPago.CREDITO ? adelantoInicial : undefined;
    if (adelanto !== undefined) {
      if (adelanto < 0) throw new ErrorNegocio('El adelanto no puede ser negativo');
      if (adelanto > total) throw new ErrorNegocio('El adelanto no puede ser mayor al valor total de la venta');
    }

    const estadoInicial =
      formaPago === FormaPago.CONTADO || (adelanto !== undefined && adelanto >= total)
        ? EstadoVenta.PAGADA
        : EstadoVenta.PENDIENTE;

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

    if (adelanto !== undefined && adelanto > 0) {
      await tx.abono.create({
        data: { ventaId: venta.id, monto: adelanto },
      });
    }

    return tx.venta.findUnique({
      where: { id: venta.id },
      include: { detalles: true },
    });
  });
}

export interface FiltrosVentas {
  desde?: Date;
  hasta?: Date;
  clienteId?: number;
  productoId?: number;
}

// RF-VEN-05: historial de ventas, con filtros opcionales por fecha, cliente y
// producto (el criterio de aceptación exige que los filtros aplicados
// devuelvan únicamente las ventas que cumplen el criterio seleccionado).
export async function listarVentas(filtros: FiltrosVentas = {}) {
  const where: Record<string, unknown> = {};

  if (filtros.desde || filtros.hasta) {
    const fecha: Record<string, Date> = {};
    if (filtros.desde) fecha.gte = filtros.desde;
    if (filtros.hasta) fecha.lte = filtros.hasta;
    where.fecha = fecha;
  }
  if (filtros.clienteId !== undefined) {
    where.clienteId = filtros.clienteId;
  }
  if (filtros.productoId !== undefined) {
    where.detalles = { some: { productoId: filtros.productoId } };
  }

  return prisma.venta.findMany({
    where,
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
