import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpController } from './otp.controller';
import { OtpMetricsService } from './otp-metrics.service';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [EmailModule, SmsModule, RedisModule],
  controllers: [OtpController],
  providers: [OtpService, OtpMetricsService],
  exports: [OtpService, OtpMetricsService],
})
export class OtpModule {}
