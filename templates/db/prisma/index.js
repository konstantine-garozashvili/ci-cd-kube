/**
 * Database adapter — PostgreSQL via Prisma.
 *
 * `prisma` is a module-scoped singleton: Node caches this module, so repeated
 * requires reuse one connection pool instead of exhausting Postgres.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function connectDatabase() {
  await prisma.$connect();
  return prisma;
}

async function disconnectDatabase() {
  await prisma.$disconnect();
}

async function checkDatabaseHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'UP', latencyMs: Date.now() - startedAt };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}

module.exports = { prisma, connectDatabase, disconnectDatabase, checkDatabaseHealth };
