import { FakeDb, limpiarBaseDeDatos } from '../../test-utils/fakePrisma';

// El factory de jest.mock debe ser autocontenido (no puede referenciar variables
// externas por el orden de "hoisting" de Jest), así que crea su propia base de
// datos falsa y la expone como __fakeDb para que las pruebas puedan sembrarla.
jest.mock('../../config/prisma', () => {
  const { crearBaseDeDatosVacia, crearFakePrisma } = require('../../test-utils/fakePrisma');
  const db = crearBaseDeDatosVacia();
  return { prisma: crearFakePrisma(db), __fakeDb: db };
});

import * as carteraService from './cartera.service';

const { __fakeDb } = jest.requireMock('../../config/prisma') as { __fakeDb: FakeDb };
const db = __fakeDb;

const HOY = new Date('2026-09-01T12:00:00Z');
const AYER = new Date('2026-08-31T12:00:00Z');

beforeEach(() => {
  limpiarBaseDeDatos(db);
  db.clientes.push({ id: 1, nombre: 'María Pérez', telefono: '3001234567' });
});

describe('registrarAbonoCliente (FIFO)', () => {
  it('rechaza un abono de monto cero o negativo', async () => {
    await expect(carteraService.registrarAbonoCliente(1, 0)).rejects.toThrow('mayor a cero');
    await expect(carteraService.registrarAbonoCliente(1, -1000)).rejects.toThrow('mayor a cero');
  });

  it('rechaza el abono si el cliente no tiene ventas pendientes', async () => {
    await expect(carteraService.registrarAbonoCliente(1, 10000)).rejects.toThrow('no tiene ventas pendientes');
  });

  it('rechaza el abono si supera el saldo total pendiente del cliente', async () => {
    db.ventas.push({ id: 10, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 30000, fecha: AYER });

    await expect(carteraService.registrarAbonoCliente(1, 50000)).rejects.toThrow('no puede ser mayor al saldo total pendiente');
  });

  it('aplica el abono completo a una única venta pendiente y la marca como pagada', async () => {
    db.ventas.push({ id: 10, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 30000, fecha: AYER });

    const resultado = await carteraService.registrarAbonoCliente(1, 30000);

    expect(resultado.saldoPendiente).toBe(0);
    expect(db.ventas.find((v) => v.id === 10)?.estado).toBe('PAGADA');
    expect(db.abonos).toHaveLength(1);
    expect(db.abonos[0]).toMatchObject({ ventaId: 10, monto: 30000 });
  });

  it('aplica el abono a la venta más antigua primero (FIFO) cuando hay varias pendientes', async () => {
    // venta1 es más antigua (AYER) que venta2 (HOY); el abono debe aplicarse primero a venta1.
    db.ventas.push(
      { id: 10, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 30000, fecha: AYER },
      { id: 11, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 20000, fecha: HOY }
    );

    const resultado = await carteraService.registrarAbonoCliente(1, 40000);

    // La venta más antigua (10) debe quedar completamente saldada...
    const venta1 = db.ventas.find((v) => v.id === 10)!;
    expect(venta1.estado).toBe('PAGADA');

    // ...y el resto del abono (10.000) debe haberse aplicado a la segunda venta,
    // que por lo tanto sigue pendiente con un saldo de 10.000.
    const venta2 = db.ventas.find((v) => v.id === 11)!;
    expect(venta2.estado).toBe('PENDIENTE');

    expect(resultado.saldoPendiente).toBe(10000);

    const abonoVenta1 = db.abonos.find((a) => a.ventaId === 10);
    const abonoVenta2 = db.abonos.find((a) => a.ventaId === 11);
    expect(abonoVenta1?.monto).toBe(30000);
    expect(abonoVenta2?.monto).toBe(10000);
  });

  it('no aplica ningún abono a ventas de contado ni a ventas ya anuladas', async () => {
    db.ventas.push(
      { id: 20, clienteId: 1, formaPago: 'CONTADO', estado: 'PAGADA', valorTotal: 50000, fecha: AYER },
      { id: 21, clienteId: 1, formaPago: 'CREDITO', estado: 'ANULADA', valorTotal: 40000, fecha: AYER },
      { id: 22, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 15000, fecha: HOY }
    );

    const resultado = await carteraService.registrarAbonoCliente(1, 15000);

    expect(resultado.saldoPendiente).toBe(0);
    // Solo debe existir un abono, y debe ser sobre la única venta a crédito pendiente (22).
    expect(db.abonos).toHaveLength(1);
    expect(db.abonos[0].ventaId).toBe(22);
  });
});

describe('saldoPendienteCliente', () => {
  it('suma el saldo pendiente de todas las ventas a crédito activas del cliente', async () => {
    db.ventas.push(
      { id: 30, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 20000, fecha: AYER },
      { id: 31, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 10000, fecha: HOY }
    );
    db.abonos.push({ id: 500, ventaId: 30, monto: 5000, fecha: HOY });

    const saldo = await carteraService.saldoPendienteCliente(1);

    // (20000 - 5000) + 10000 = 25000
    expect(saldo).toBe(25000);
  });

  it('retorna cero si el cliente no tiene ventas a crédito', async () => {
    const saldo = await carteraService.saldoPendienteCliente(1);
    expect(saldo).toBe(0);
  });
});

describe('eliminarCliente', () => {
  it('rechaza eliminar un cliente que tiene saldo pendiente', async () => {
    db.ventas.push({ id: 40, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 10000, fecha: HOY });

    await expect(carteraService.eliminarCliente(1)).rejects.toThrow('saldo pendiente');
    expect(db.clientes).toHaveLength(1);
  });

  it('elimina un cliente sin saldo pendiente', async () => {
    await carteraService.eliminarCliente(1);
    expect(db.clientes).toHaveLength(0);
  });
});

describe('obtenerCarteraGeneral', () => {
  it('incluye solo a los clientes con saldo pendiente mayor a cero, ordenados de mayor a menor deuda', async () => {
    db.clientes.push({ id: 2, nombre: 'Juan Gómez', telefono: null });
    db.clientes.push({ id: 3, nombre: 'Cliente al día', telefono: null });
    db.ventas.push(
      { id: 50, clienteId: 1, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 10000, fecha: HOY },
      { id: 51, clienteId: 2, formaPago: 'CREDITO', estado: 'PENDIENTE', valorTotal: 50000, fecha: HOY },
      { id: 52, clienteId: 3, formaPago: 'CREDITO', estado: 'PAGADA', valorTotal: 20000, fecha: HOY }
    );
    db.abonos.push({ id: 600, ventaId: 52, monto: 20000, fecha: HOY });

    const cartera = await carteraService.obtenerCarteraGeneral();

    expect(cartera).toHaveLength(2);
    expect(cartera[0].cliente.id).toBe(2); // mayor deuda primero
    expect(cartera[0].saldoPendiente).toBe(50000);
    expect(cartera[1].cliente.id).toBe(1);
    expect(cartera[1].saldoPendiente).toBe(10000);
  });
});
