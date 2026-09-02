import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiController } from './api/api.controller';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ShutdownLogger } from './shutdown.logger';
import { configuration } from './config/configuration';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), DatabaseModule],
  controllers: [HealthController, ApiController],
  providers: [ShutdownLogger],
})
export class AppModule {}
