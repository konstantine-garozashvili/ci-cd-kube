/**
 * Database adapter — PostgreSQL via Prisma.
 *
 * `prisma` is a module-scoped singleton so repeated imports reuse one
 * connection pool instead of exhausting Postgres.
 */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export async function connectDatabase() {
  await prisma.$connect();
  return prisma;
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

export async function checkDatabaseHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'UP', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}
