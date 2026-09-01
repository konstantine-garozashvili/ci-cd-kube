import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { DatabaseService } from '../database/database.service';

@Controller()
export class HealthController {
  constructor(
    private readonly config: ConfigService,
    private readonly database: DatabaseService
  ) {}

  /**
   * Liveness probe — process-only, no dependency checks. A liveness probe that
   * fails on a database blip makes Kubernetes restart a healthy container.
   */
  @Get('healthz')
  liveness() {
    return {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: this.config.get<string>('appName'),
      version: this.config.get<string>('appVersion'),
    };
  }

  /**
   * Readiness probe — checks dependencies and answers 503 when the instance
   * cannot serve traffic, so the load balancer drains it instead of failing
   * live requests.
   */
  @Get('ready')
  async readiness(@Res({ passthrough: true }) res: Response) {
    const database = await this.database.checkHealth();
    const isReady = database.status === 'UP' || database.status === 'NOT_CONFIGURED';
    const memory = process.memoryUsage();

    res.status(isReady ? 200 : 503);
    return {
      status: isReady ? 'READY' : 'NOT_READY',
      checks: {
        database,
        memory: {
          usedMb: Math.round(memory.heapUsed / 1024 / 1024),
          totalMb: Math.round(memory.heapTotal / 1024 / 1024),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  ping(@Res() res: Response) {
    res.status(200).send('OK');
  }
}
