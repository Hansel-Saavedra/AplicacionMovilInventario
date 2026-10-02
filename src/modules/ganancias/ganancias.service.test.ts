import { FakeDb, limpiarBaseDeDatos } from '../../test-utils/fakePrisma';

jest.mock('../../config/prisma', () => {
  const { crearBaseDeDatosVacia, crearFakePrisma } = require('../../test-utils/fakePrisma');
  const db = crearBaseDeDatosVacia();
  return { prisma: crearFakePrisma(db), __fakeDb: db };
});

import * as gananciasService from './ganancias.service';

const { __fakeDb } = jest.requireMock('../../config/prisma') as { __fakeDb: FakeDb };
const db = __fakeDb;

const INICIO_PERIODO = new Date('2026-09-01T00:00:00Z');
const FIN_PERIODO = new Date('2026-09-30T23:59:59Z');
const DENTRO_DEL_PERIODO = new Date('2026-09-15T12:00:00Z');
const FUERA_DEL_PERIODO = new Date('2026-08-15T12:00:00Z');

beforeEach(() => {
  limpiarBaseDeDatos(db);
});

describe('calcularGananciaPeriodo', () => {
  it('suma (precio - costo) * cantidad de cada línea de venta dentro del periodo', async () => {
    db.ventas.push({ id: 1, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 90000, fecha: DENTRO_DEL_PERIODO });
    db.detalleVentas.push({ id: 1, ventaId: 1, productoId: 1, cantidad: 2, precioUnitario: 45000, costoUnitario: 28000 });

    const ganancia = await gananciasService.calcularGananciaPeriodo(INICIO_PERIODO, FIN_PERIODO);

    // (45000 - 28000) * 2 = 34000
    expect(ganancia).toBe(34000);
  });

  it('excluye las ventas anuladas del cálculo', async () => {
    db.ventas.push({ id: 2, clienteId: null, formaPago: 'CONTADO', estado: 'ANULADA', valorTotal: 45000, fecha: DENTRO_DEL_PERIODO });
    db.detalleVentas.push({ id: 2, ventaId: 2, productoId: 1, cantidad: 1, precioUnitario: 45000, costoUnitario: 28000 });

    const ganancia = await gananciasService.calcularGananciaPeriodo(INICIO_PERIODO, FIN_PERIODO);
    expect(ganancia).toBe(0);
  });

  it('excluye las ventas fuera del rango de fechas', async () => {
    db.ventas.push({ id: 3, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 45000, fecha: FUERA_DEL_PERIODO });
    db.detalleVentas.push({ id: 3, ventaId: 3, productoId: 1, cantidad: 1, precioUnitario: 45000, costoUnitario: 28000 });

    const ganancia = await gananciasService.calcularGananciaPeriodo(INICIO_PERIODO, FIN_PERIODO);
    expect(ganancia).toBe(0);
  });
});

describe('calcularGananciaPorProducto', () => {
  it('agrupa la ganancia y las unidades vendidas por producto, de mayor a menor ganancia', async () => {
    db.productos.push(
      { id: 1, nombre: 'Camiseta básica', costo: 28000, precioVenta: 45000, cantidadDisponible: 5, activo: true },
      { id: 2, nombre: 'Jean recto', costo: 60000, precioVenta: 98000, cantidadDisponible: 5, activo: true }
    );
    db.ventas.push({ id: 1, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 188000, fecha: DENTRO_DEL_PERIODO });
    db.detalleVentas.push(
      { id: 1, ventaId: 1, productoId: 1, cantidad: 2, precioUnitario: 45000, costoUnitario: 28000 }, // ganancia 34000
      { id: 2, ventaId: 1, productoId: 2, cantidad: 1, precioUnitario: 98000, costoUnitario: 60000 } // ganancia 38000
    );

    const porProducto = await gananciasService.calcularGananciaPorProducto(INICIO_PERIODO, FIN_PERIODO);

    expect(porProducto).toHaveLength(2);
    expect(porProducto[0]).toMatchObject({ productoId: 2, nombreProducto: 'Jean recto', cantidadVendida: 1, gananciaTotal: 38000 });
    expect(porProducto[1]).toMatchObject({ productoId: 1, nombreProducto: 'Camiseta básica', cantidadVendida: 2, gananciaTotal: 34000 });
  });
});

describe('proyectarGananciaInventario', () => {
  it('suma (precioVenta - costo) * cantidadDisponible de los productos activos', async () => {
    db.productos.push(
      { id: 1, nombre: 'A', costo: 10000, precioVenta: 20000, cantidadDisponible: 3, activo: true }, // 30000
      { id: 2, nombre: 'B', costo: 5000, precioVenta: 15000, cantidadDisponible: 2, activo: true }, // 20000
      { id: 3, nombre: 'Inactivo', costo: 1000, precioVenta: 100000, cantidadDisponible: 100, activo: false } // no cuenta
    );

    const proyeccion = await gananciasService.proyectarGananciaInventario();
    expect(proyeccion).toBe(50000);
  });
});

describe('obtenerResumenIva', () => {
  it('descompone el total de ventas del periodo (ya incluye IVA) en base e IVA', async () => {
    db.ventas.push(
      { id: 1, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 40000, fecha: DENTRO_DEL_PERIODO },
      { id: 2, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 60000, fecha: DENTRO_DEL_PERIODO }
    );

    const resumenIva = await gananciasService.obtenerResumenIva(INICIO_PERIODO, FIN_PERIODO);

    // Total de ventas del periodo: 100.000, con IVA incluido.
    expect(resumenIva.valorTotal).toBe(100000);
    expect(resumenIva.valorBase + resumenIva.valorIva).toBeCloseTo(100000, 2);
    expect(resumenIva.valorIva).toBeGreaterThan(0);
  });

  it('excluye las ventas anuladas y las que están fuera del periodo', async () => {
    db.ventas.push(
      { id: 3, clienteId: null, formaPago: 'CONTADO', estado: 'ANULADA', valorTotal: 40000, fecha: DENTRO_DEL_PERIODO },
      { id: 4, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 60000, fecha: FUERA_DEL_PERIODO }
    );

    const resumenIva = await gananciasService.obtenerResumenIva(INICIO_PERIODO, FIN_PERIODO);
    expect(resumenIva.valorTotal).toBe(0);
  });
});

describe('obtenerResumenNegocio', () => {
  it('integra el número de ventas, el total vendido y la ganancia del periodo', async () => {
    db.ventas.push({ id: 1, clienteId: null, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 45000, fecha: DENTRO_DEL_PERIODO });
    db.detalleVentas.push({ id: 1, ventaId: 1, productoId: 1, cantidad: 1, precioUnitario: 45000, costoUnitario: 28000 });

    const resumen = await gananciasService.obtenerResumenNegocio(INICIO_PERIODO, FIN_PERIODO);

    expect(resumen.numeroVentas).toBe(1);
    expect(resumen.totalVentas).toBe(45000);
    expect(resumen.gananciaPeriodo).toBe(17000);
  });
});
