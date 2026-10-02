import { PrismaClient } from '@prisma/client';

// Instancia única del cliente de Prisma, compartida por todos los módulos.
export const prisma = new PrismaClient();
