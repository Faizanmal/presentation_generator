import { Module, Global } from '@nestjs/common';
import { SubscriptionLimitsService, SubscriptionQuotaGuard } from './subscription-limits.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [SubscriptionLimitsService, SubscriptionQuotaGuard],
  exports: [SubscriptionLimitsService, SubscriptionQuotaGuard],
})
export class SubscriptionModule {}
