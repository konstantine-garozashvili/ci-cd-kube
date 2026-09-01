import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('api')
export class ApiController {
  constructor(private readonly config: ConfigService) {}

  @Get('info')
  info() {
    return {
      name: this.config.get<string>('appName'),
      version: this.config.get<string>('appVersion'),
      environment: this.config.get<string>('env'),
      nodeVersion: process.version,
      platform: process.platform,
      startedAt: this.config.get<string>('startTime'),
    };
  }

  @Get('metrics')
  metrics() {
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
      cpuUsage: process.cpuUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  // Nest answers 201 for POST by default. Echo creates nothing, and the other
  // backend templates answer 200, so pin it for a consistent API contract.
  @Post('echo')
  @HttpCode(HttpStatus.OK)
  echo(@Body() payload: Record<string, unknown>) {
    if (!payload || Object.keys(payload).length === 0) {
      throw new HttpException(
        { status: 400, error: 'Bad Request', message: 'Request body must not be empty' },
        HttpStatus.BAD_REQUEST
      );
    }
    return { received: payload, timestamp: new Date().toISOString() };
  }
}
