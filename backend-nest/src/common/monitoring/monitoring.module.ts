import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { SentryService } from './sentry.service';
import { PerformanceMonitoringService } from './performance-monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { OtpModule } from '../../otp/otp.module';
import { EmailModule } from '../../email/email.module';
import { RedisModule } from '../redis/redis.module';
import { CacheModule } from '../cache/cache.module';

@Global()
@Module({
  imports: [ConfigModule, OtpModule, EmailModule, RedisModule, CacheModule],
  controllers: [MonitoringController, AdminMonitoringController],
  providers: [
    MonitoringService,
    MetricsService,
    SentryService,
    PerformanceMonitoringService,
  ],
  exports: [
    MonitoringService,
    MetricsService,
    SentryService,
    PerformanceMonitoringService,
  ],
})
export class MonitoringModule {}
