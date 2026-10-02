import { FakeDb, limpiarBaseDeDatos } from '../../test-utils/fakePrisma';

jest.mock('../../config/prisma', () => {
  const { crearBaseDeDatosVacia, crearFakePrisma } = require('../../test-utils/fakePrisma');
  const db = crearBaseDeDatosVacia();
  return { prisma: crearFakePrisma(db), __fakeDb: db };
});

import * as ventasService from './ventas.service';

const { __fakeDb } = jest.requireMock('../../config/prisma') as { __fakeDb: FakeDb };
const db = __fakeDb;

beforeEach(() => {
  limpiarBaseDeDatos(db);
  db.productos.push(
    { id: 1, nombre: 'Camiseta básica', costo: 28000, precioVenta: 45000, cantidadDisponible: 10, activo: true },
    { id: 2, nombre: 'Jean recto', costo: 60000, precioVenta: 98000, cantidadDisponible: 2, activo: true }
  );
  db.clientes.push({ id: 1, nombre: 'María Pérez', telefono: null });
});

describe('registrarVenta', () => {
  it('rechaza una venta sin productos', async () => {
    await expect(ventasService.registrarVenta([], 'CONTADO' as any, null)).rejects.toThrow('al menos un producto');
  });

  it('rechaza una venta a crédito sin cliente asociado', async () => {
    await expect(
      ventasService.registrarVenta([{ productoId: 1, cantidad: 1 }], 'CREDITO' as any, null)
    ).rejects.toThrow('Selecciona un cliente');
  });

  it('rechaza la venta si no hay stock suficiente, sin modificar el inventario', async () => {
    await expect(
      ventasService.registrarVenta([{ productoId: 2, cantidad: 5 }], 'CONTADO' as any, null)
    ).rejects.toThrow('No hay stock suficiente');

    // El stock del producto no debe haberse tocado, ya que la venta se rechazó.
    expect(db.productos.find((p) => p.id === 2)?.cantidadDisponible).toBe(2);
    expect(db.ventas).toHaveLength(0);
  });

  it('registra una venta de contado: calcula el total, descuenta el stock y queda como PAGADA', async () => {
    const venta = await ventasService.registrarVenta(
      [{ productoId: 1, cantidad: 2 }],
      'CONTADO' as any,
      null
    );

    expect(venta?.estado).toBe('PAGADA');
    expect(venta?.valorTotal).toBe(90000); // 2 * 45000
    expect(venta?.clienteId).toBeNull();

    expect(db.productos.find((p) => p.id === 1)?.cantidadDisponible).toBe(8); // 10 - 2
    expect(db.detalleVentas).toHaveLength(1);
    expect(db.detalleVentas[0]).toMatchObject({ productoId: 1, cantidad: 2, precioUnitario: 45000, costoUnitario: 28000 });
  });

  it('registra una venta a crédito asociada al cliente y queda como PENDIENTE', async () => {
    const venta = await ventasService.registrarVenta(
      [{ productoId: 1, cantidad: 1 }],
      'CREDITO' as any,
      1
    );

    expect(venta?.estado).toBe('PENDIENTE');
    expect(venta?.clienteId).toBe(1);
    expect(venta?.valorTotal).toBe(45000);
  });

  it('descuenta correctamente el stock cuando la venta incluye varios productos', async () => {
    await ventasService.registrarVenta(
      [
        { productoId: 1, cantidad: 3 },
        { productoId: 2, cantidad: 1 },
      ],
      'CONTADO' as any,
      null
    );

    expect(db.productos.find((p) => p.id === 1)?.cantidadDisponible).toBe(7); // 10 - 3
    expect(db.productos.find((p) => p.id === 2)?.cantidadDisponible).toBe(1); // 2 - 1
    expect(db.detalleVentas).toHaveLength(2);
  });

  it('congela el costo y el precio del producto en el detalle de la venta', async () => {
    await ventasService.registrarVenta([{ productoId: 1, cantidad: 1 }], 'CONTADO' as any, null);

    // Si el precio del producto cambia después, el detalle ya registrado no debe verse afectado.
    const producto = db.productos.find((p) => p.id === 1)!;
    producto.precioVenta = 99999;
    producto.costo = 1;

    expect(db.detalleVentas[0].precioUnitario).toBe(45000);
    expect(db.detalleVentas[0].costoUnitario).toBe(28000);
  });
});

describe('anularVenta', () => {
  it('revierte el inventario descontado y marca la venta como ANULADA', async () => {
    const venta = await ventasService.registrarVenta([{ productoId: 1, cantidad: 4 }], 'CONTADO' as any, null);
    expect(db.productos.find((p) => p.id === 1)?.cantidadDisponible).toBe(6); // 10 - 4

    const anulada = await ventasService.anularVenta(venta!.id);

    expect(anulada.estado).toBe('ANULADA');
    expect(db.productos.find((p) => p.id === 1)?.cantidadDisponible).toBe(10); // se restablece
  });

  it('rechaza anular una venta que ya estaba anulada', async () => {
    const venta = await ventasService.registrarVenta([{ productoId: 1, cantidad: 1 }], 'CONTADO' as any, null);
    await ventasService.anularVenta(venta!.id);

    await expect(ventasService.anularVenta(venta!.id)).rejects.toThrow('ya estaba anulada');
  });

  it('rechaza anular una venta que no existe', async () => {
    await expect(ventasService.anularVenta(99999)).rejects.toThrow('no encontrada');
  });
});
