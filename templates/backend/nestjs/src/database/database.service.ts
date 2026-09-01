import { Injectable } from '@nestjs/common';

export type DatabaseHealth = {
  status: 'UP' | 'DOWN' | 'NOT_CONFIGURED';
  latencyMs?: number;
  error?: string;
};

/**
 * Database adapter — no database configured.
 *
 * The scaffolder swaps this file for a Prisma or Mongoose implementation when
 * a database is selected. The shape stays identical so the readiness probe and
 * bootstrap sequence never change.
 */
@Injectable()
export class DatabaseService {
  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async checkHealth(): Promise<DatabaseHealth> {
    return { status: 'NOT_CONFIGURED' };
  }
}
