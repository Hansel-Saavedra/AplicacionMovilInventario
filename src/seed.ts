import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { TipoMovimiento } from '@prisma/client';
import { prisma } from './config/prisma';

/**
 * Carga datos de prueba, equivalentes a los del SeedCallback de la app Android:
 * un usuario propietario y tres productos de ejemplo. Es seguro ejecutarlo
 * varias veces: no duplica el usuario ni los productos ya existentes.
 */
async function main() {
  const contrasenaHash = await bcrypt.hash('1234abcd', 10);
  await prisma.usuario.upsert({
    where: { usuario: 'tienda.ropa' },
    update: {},
    create: { usuario: 'tienda.ropa', contrasenaHash, nombreNegocio: 'Mi tienda de ropa' },
  });

  const productosIniciales = [
    { nombre: 'Camiseta básica', referencia: 'CB-01', talla: 'M', color: 'Azul', categoria: 'Camisetas', costo: 28000, precioVenta: 45000, cantidadDisponible: 12 },
    { nombre: 'Jean recto', referencia: 'JR-14', talla: '32', color: 'Negro', categoria: 'Pantalones', costo: 60000, precioVenta: 98000, cantidadDisponible: 2 },
    { nombre: 'Chaqueta liviana', referencia: 'CH-07', talla: 'S', color: 'Gris', categoria: 'Chaquetas', costo: 80000, precioVenta: 130000, cantidadDisponible: 7 },
  ];

  for (const datos of productosIniciales) {
    const existente = await prisma.producto.findFirst({ where: { referencia: datos.referencia } });
    if (existente) continue;

    const producto = await prisma.producto.create({ data: datos });
    await prisma.movimientoInventario.create({
      data: {
        productoId: producto.id,
        tipo: TipoMovimiento.ENTRADA,
        cantidad: datos.cantidadDisponible,
        motivo: 'Carga inicial de inventario',
      },
    });
  }

  console.log('Datos semilla creados: usuario "tienda.ropa" / contraseña "1234abcd", y 3 productos de ejemplo.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
