import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { SentryService } from './sentry.service';
import { MonitoringController } from './monitoring.controller';
import { AdminMonitoringController } from './admin-monitoring.controller';
import { OtpModule } from '../../otp/otp.module';
import { EmailModule } from '../../email/email.module';

@Global()
@Module({
  imports: [ConfigModule, OtpModule, EmailModule],
  controllers: [MonitoringController, AdminMonitoringController],
  providers: [MonitoringService, MetricsService, SentryService],
  exports: [MonitoringService, MetricsService, SentryService],
})
export class MonitoringModule {}
