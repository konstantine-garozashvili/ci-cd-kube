import { Injectable, OnModuleDestroy } from '@nestjs/common';
import mongoose from 'mongoose';

export type DatabaseHealth = {
  status: 'UP' | 'DOWN' | 'NOT_CONFIGURED';
  latencyMs?: number;
  error?: string;
};

/** Database adapter — MongoDB via Mongoose. */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  async connect(uri = process.env.MONGODB_URI): Promise<void> {
    if (!uri) {
      throw new Error('MONGODB_URI is not set. Copy .env.example to .env and configure it.');
    }
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  }

  async disconnect(): Promise<void> {
    await mongoose.disconnect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async checkHealth(): Promise<DatabaseHealth> {
    const startedAt = Date.now();
    try {
      if (mongoose.connection.readyState !== 1) {
        return { status: 'DOWN', error: 'Not connected' };
      }
      await mongoose.connection.db.admin().ping();
      return { status: 'UP', latencyMs: Date.now() - startedAt };
    } catch (err) {
      return { status: 'DOWN', error: err instanceof Error ? err.message : String(err) };
    }
  }
}
