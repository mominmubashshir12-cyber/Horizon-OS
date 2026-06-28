// Prisma client singleton — prevents multiple instances during hot-reloading in development.

import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// PostgreSQL-ready: change schema.prisma provider + DATABASE_URL to migrate.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: config.isProduction ? ['error'] : ['query', 'error', 'warn'],
  });

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
