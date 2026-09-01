import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './http-exception.filter';
import { DatabaseService } from './database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet({ crossOriginEmbedderPolicy: false, frameguard: { action: 'deny' } }));
  app.enableCors({ origin: config.get('corsOrigin') });

  // Health probes stay outside the limiter so a burst of traffic can never make
  // the orchestrator think the pod is unhealthy.
  app.use(
    '/api',
    rateLimit({
      windowMs: config.get<number>('rateLimit.windowMs') ?? 900_000,
      max: config.get<number>('rateLimit.max') ?? 100,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const database = app.get(DatabaseService);
  try {
    await database.connect();
  } catch (err) {
    // Fail fast in production; keep serving in development so you can work on
    // routes without Docker running. /ready reports DOWN either way.
    const message = err instanceof Error ? err.message : String(err);
    if (config.get('env') === 'production') {
      console.error(`❌ Database connection failed: ${message}`);
      process.exit(1);
    }
    console.warn(`⚠️  Database unavailable: ${message}`);
    console.warn('   Continuing anyway — /ready will report DOWN until it is up.');
  }

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  console.log(`🚀 [${config.get('appName')}] listening on port ${port} (${config.get('env')})`);
  console.log(`🩺 Liveness:  http://localhost:${port}/healthz`);
  console.log(`✅ Readiness: http://localhost:${port}/ready`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
