/**
 * Fake en memoria de Prisma Client, usado para probar la lógica de negocio de
 * los servicios sin necesitar una base de datos real. No pretende ser un
 * reemplazo completo de Prisma: solo implementa el subconjunto de consultas
 * (where, orderBy, include) que los servicios de este proyecto realmente usan,
 * lo suficiente para que las pruebas de comportamiento sean fieles.
 */

export interface FakeCliente {
  id: number;
  nombre: string;
  telefono: string | null;
}

export interface FakeVenta {
  id: number;
  clienteId: number | null;
  formaPago: string;
  estado: string;
  valorTotal: number;
  fecha: Date;
}

export interface FakeAbono {
  id: number;
  ventaId: number;
  monto: number;
  fecha: Date;
}

export interface FakeProducto {
  id: number;
  nombre: string;
  costo: number;
  precioVenta: number;
  cantidadDisponible: number;
  activo: boolean;
}

export interface FakeDetalleVenta {
  id: number;
  ventaId: number;
  productoId: number;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number;
}

export interface FakeDb {
  clientes: FakeCliente[];
  ventas: FakeVenta[];
  abonos: FakeAbono[];
  productos: FakeProducto[];
  detalleVentas: FakeDetalleVenta[];
}

export function crearBaseDeDatosVacia(): FakeDb {
  return { clientes: [], ventas: [], abonos: [], productos: [], detalleVentas: [] };
}

/** Vacía (en el mismo objeto) una base de datos falsa, para reiniciar el estado entre pruebas. */
export function limpiarBaseDeDatos(db: FakeDb): void {
  db.clientes.length = 0;
  db.ventas.length = 0;
  db.abonos.length = 0;
  db.productos.length = 0;
  db.detalleVentas.length = 0;
}

function coincideFecha(fecha: Date, condicion: any): boolean {
  if (!condicion) return true;
  if (condicion.gte && fecha < condicion.gte) return false;
  if (condicion.lte && fecha > condicion.lte) return false;
  return true;
}

export function crearFakePrisma(db: FakeDb) {
  let siguienteVentaId = 100;
  let siguienteAbonoId = 1000;
  let siguienteDetalleId = 5000;
  let siguienteClienteId = 1;

  function detalleConVenta(d: FakeDetalleVenta) {
    return { ...d, venta: db.ventas.find((v) => v.id === d.ventaId) };
  }

  const fake: any = {
    cliente: {
      findMany: jest.fn(async () => [...db.clientes]),
      findUnique: jest.fn(async (args: any) => db.clientes.find((c) => c.id === args.where.id) ?? null),
      create: jest.fn(async (args: any) => {
        const nuevo: FakeCliente = { id: siguienteClienteId++, telefono: null, ...args.data };
        db.clientes.push(nuevo);
        return nuevo;
      }),
      update: jest.fn(async (args: any) => {
        const cliente = db.clientes.find((c) => c.id === args.where.id);
        if (!cliente) throw new Error('Cliente no encontrado en el fake');
        Object.assign(cliente, args.data);
        return cliente;
      }),
      delete: jest.fn(async (args: any) => {
        db.clientes = db.clientes.filter((c) => c.id !== args.where.id);
        return {};
      }),
    },

    venta: {
      findMany: jest.fn(async (args: any = {}) => {
        const where = args?.where ?? {};
        let resultado = db.ventas.filter((v) => {
          if (where.clienteId !== undefined && v.clienteId !== where.clienteId) return false;
          if (where.formaPago !== undefined && v.formaPago !== where.formaPago) return false;
          if (where.estado !== undefined) {
            if (typeof where.estado === 'string' && v.estado !== where.estado) return false;
            if (where.estado?.not !== undefined && v.estado === where.estado.not) return false;
          }
          if (!coincideFecha(v.fecha, where.fecha)) return false;
          return true;
        });
        if (args?.orderBy?.fecha === 'asc') resultado = [...resultado].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
        if (args?.orderBy?.fecha === 'desc') resultado = [...resultado].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
        if (args?.include?.detalles) {
          return resultado.map((v) => ({ ...v, detalles: db.detalleVentas.filter((d) => d.ventaId === v.id) }));
        }
        return resultado.map((v) => ({ ...v }));
      }),
      findUnique: jest.fn(async (args: any) => {
        const venta = db.ventas.find((v) => v.id === args.where.id);
        if (!venta) return null;
        const extra: any = {};
        if (args.include?.abonos) extra.abonos = db.abonos.filter((a) => a.ventaId === venta.id);
        if (args.include?.detalles) extra.detalles = db.detalleVentas.filter((d) => d.ventaId === venta.id);
        return { ...venta, ...extra };
      }),
      create: jest.fn(async (args: any) => {
        const nueva: FakeVenta = { id: siguienteVentaId++, fecha: new Date(), ...args.data };
        db.ventas.push(nueva);
        return { ...nueva };
      }),
      update: jest.fn(async (args: any) => {
        const venta = db.ventas.find((v) => v.id === args.where.id);
        if (!venta) throw new Error('Venta no encontrada en el fake');
        Object.assign(venta, args.data);
        return { ...venta };
      }),
    },

    abono: {
      create: jest.fn(async (args: any) => {
        const nuevo: FakeAbono = { id: siguienteAbonoId++, fecha: new Date(), ...args.data };
        db.abonos.push(nuevo);
        return nuevo;
      }),
      findMany: jest.fn(async (args: any = {}) => {
        const where = args?.where ?? {};
        let resultado = [...db.abonos];
        if (where.ventaId?.in) resultado = resultado.filter((a) => where.ventaId.in.includes(a.ventaId));
        else if (typeof where.ventaId === 'number') resultado = resultado.filter((a) => a.ventaId === where.ventaId);
        return resultado;
      }),
    },

    producto: {
      findMany: jest.fn(async (args: any = {}) => {
        const where = args?.where ?? {};
        return db.productos.filter((p) => (where.activo === undefined ? true : p.activo === where.activo)).map((p) => ({ ...p }));
      }),
      findUnique: jest.fn(async (args: any) => {
        const producto = db.productos.find((p) => p.id === args.where.id);
        return producto ? { ...producto } : null;
      }),
      update: jest.fn(async (args: any) => {
        const producto = db.productos.find((p) => p.id === args.where.id);
        if (!producto) throw new Error('Producto no encontrado en el fake');
        if (args.data.cantidadDisponible?.decrement !== undefined) {
          producto.cantidadDisponible -= args.data.cantidadDisponible.decrement;
        } else if (args.data.cantidadDisponible?.increment !== undefined) {
          producto.cantidadDisponible += args.data.cantidadDisponible.increment;
        } else {
          Object.assign(producto, args.data);
        }
        return { ...producto };
      }),
    },

    detalleVenta: {
      create: jest.fn(async (args: any) => {
        const nuevo: FakeDetalleVenta = { id: siguienteDetalleId++, ...args.data };
        db.detalleVentas.push(nuevo);
        return nuevo;
      }),
      findMany: jest.fn(async (args: any = {}) => {
        const whereVenta = args?.where?.venta;
        let resultado = db.detalleVentas.filter((d) => {
          if (!whereVenta) return true;
          const venta = db.ventas.find((v) => v.id === d.ventaId);
          if (!venta) return false;
          if (whereVenta.estado?.not !== undefined && venta.estado === whereVenta.estado.not) return false;
          if (!coincideFecha(venta.fecha, whereVenta.fecha)) return false;
          return true;
        });
        if (args?.include?.producto) {
          return resultado.map((d) => ({ ...d, producto: db.productos.find((p) => p.id === d.productoId) }));
        }
        return resultado.map((d) => ({ ...d }));
      }),
    },

    movimientoInventario: {
      create: jest.fn(async (args: any) => ({ id: 1, fecha: new Date(), ...args.data })),
    },

    $transaction: jest.fn(async (callback: any) => callback(fake)),
  };

  return fake;
}
