import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type DatabaseHealth = {
  status: 'UP' | 'DOWN' | 'NOT_CONFIGURED';
  latencyMs?: number;
  error?: string;
};

/**
 * Database adapter — PostgreSQL via Prisma.
 *
 * Extends PrismaClient so the service *is* the query client: inject
 * DatabaseService anywhere and call `.user.findMany()` directly.
 */
@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }

  async connect(): Promise<void> {
    await this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async checkHealth(): Promise<DatabaseHealth> {
    const startedAt = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'UP', latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { status: 'DOWN', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
