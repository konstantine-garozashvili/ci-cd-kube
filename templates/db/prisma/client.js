const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'UP', latencyMs: 1 };
  } catch (err) {
    return { status: 'DOWN', error: err.message };
  }
}

module.exports = {
  prisma,
  checkDatabaseHealth,
};
