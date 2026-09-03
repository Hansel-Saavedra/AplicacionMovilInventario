import { EstadoVenta, FormaPago } from '@prisma/client';
import type { Abono, Cliente, Venta } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ErrorNegocio } from '../../middleware/error.middleware';

// RF-CAR-01: registrar cliente.
export async function registrarCliente(nombre: string, telefono?: string | null) {
  if (!nombre?.trim()) throw new ErrorNegocio('El nombre del cliente es obligatorio');
  return prisma.cliente.create({
    data: { nombre: nombre.trim(), telefono: telefono?.trim() || null },
  });
}

export async function listarClientes() {
  return prisma.cliente.findMany({ orderBy: { nombre: 'asc' } });
}

export async function obtenerCliente(id: number) {
  const cliente = await prisma.cliente.findUnique({ where: { id } });
  if (!cliente) throw new ErrorNegocio('Cliente no encontrado', 404);
  return cliente;
}

// RF-CAR-02: editar cliente.
export async function actualizarCliente(id: number, datos: { nombre?: string; telefono?: string | null }) {
  await obtenerCliente(id);
  if (datos.nombre !== undefined && !datos.nombre.trim()) {
    throw new ErrorNegocio('El nombre del cliente es obligatorio');
  }
  return prisma.cliente.update({ where: { id }, data: datos });
}

// Saldo pendiente de una venta puntual (0 si es de contado, anulada o ya saldada).
async function saldoPendienteVenta(ventaId: number): Promise<number> {
  const venta = await prisma.venta.findUnique({ where: { id: ventaId }, include: { abonos: true } });
  if (!venta || venta.formaPago !== FormaPago.CREDITO || venta.estado === EstadoVenta.ANULADA) return 0;
  const abonado = venta.abonos.reduce((suma: number, abono: Abono) => suma + abono.monto, 0);
  return Math.max(venta.valorTotal - abonado, 0);
}

// RF-CAR-05: saldo pendiente total de un cliente (suma de todas sus ventas a crédito).
export async function saldoPendienteCliente(clienteId: number): Promise<number> {
  const ventas = await prisma.venta.findMany({ where: { clienteId } });
  const saldos = await Promise.all(ventas.map((v: Venta) => saldoPendienteVenta(v.id)));
  return saldos.reduce((a: number, b: number) => a + b, 0);
}

// RF-CAR-02: eliminar cliente, siempre que no tenga saldo pendiente.
export async function eliminarCliente(id: number) {
  await obtenerCliente(id);
  const saldo = await saldoPendienteCliente(id);
  if (saldo > 0) throw new ErrorNegocio('No puedes eliminar un cliente con saldo pendiente');
  return prisma.cliente.delete({ where: { id } });
}

// RF-CAR-07: listado general de cartera (solo clientes con saldo pendiente mayor a cero).
export async function obtenerCarteraGeneral() {
  const clientes = await prisma.cliente.findMany();
  const resumen = await Promise.all(
    clientes.map(async (cliente: Cliente) => ({
      cliente,
      saldoPendiente: await saldoPendienteCliente(cliente.id),
    }))
  );
  return resumen.filter((r) => r.saldoPendiente > 0).sort((a, b) => b.saldoPendiente - a.saldoPendiente);
}

// RF-CAR-03, RF-CAR-05: ventas a crédito de un cliente.
export async function ventasCliente(clienteId: number) {
  return prisma.venta.findMany({ where: { clienteId }, orderBy: { fecha: 'desc' } });
}

// RF-CAR-06: historial de abonos consolidado de un cliente.
export async function historialAbonosCliente(clienteId: number) {
  const ventas = await prisma.venta.findMany({ where: { clienteId }, select: { id: true } });
  const ventaIds = ventas.map((v: { id: number }) => v.id);
  if (ventaIds.length === 0) return [];
  return prisma.abono.findMany({
    where: { ventaId: { in: ventaIds } },
    orderBy: { fecha: 'desc' },
  });
}

/**
 * RF-CAR-04, RF-CAR-08: registra un abono de un cliente y lo aplica automáticamente
 * a sus ventas a crédito pendientes, de la más antigua a la más reciente (FIFO),
 * marcando cada venta como "pagada" en cuanto su saldo llega a cero. Es la misma
 * decisión de diseño documentada en CarteraRepository.kt de la app Android.
 */
export async function registrarAbonoCliente(clienteId: number, monto: number) {
  if (monto <= 0) throw new ErrorNegocio('El monto del abono debe ser mayor a cero');

  const ventasPendientes = await prisma.venta.findMany({
    where: { clienteId, formaPago: FormaPago.CREDITO, estado: EstadoVenta.PENDIENTE },
    orderBy: { fecha: 'asc' },
  });

  if (ventasPendientes.length === 0) {
    throw new ErrorNegocio('Este cliente no tiene ventas pendientes por abonar');
  }

  const saldos = await Promise.all(ventasPendientes.map((v: Venta) => saldoPendienteVenta(v.id)));
  const saldoTotal = saldos.reduce((a: number, b: number) => a + b, 0);
  if (monto > saldoTotal) {
    throw new ErrorNegocio(`El abono no puede ser mayor al saldo total pendiente (${saldoTotal})`);
  }

  await prisma.$transaction(async (tx) => {
    let restante = monto;
    for (let i = 0; i < ventasPendientes.length; i++) {
      if (restante <= 0) break;
      const venta = ventasPendientes[i];
      const saldoVenta = saldos[i];
      if (saldoVenta <= 0) continue;

      const aplicado = Math.min(saldoVenta, restante);
      await tx.abono.create({ data: { ventaId: venta.id, monto: aplicado } });
      restante -= aplicado;

      if (saldoVenta - aplicado <= 0) {
        await tx.venta.update({ where: { id: venta.id }, data: { estado: EstadoVenta.PAGADA } });
      }
    }
  });

  return { saldoPendiente: await saldoPendienteCliente(clienteId) };
}
