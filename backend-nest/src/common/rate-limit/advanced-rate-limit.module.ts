import { Module, Global } from '@nestjs/common';
import { AdvancedRateLimitService } from './advanced-rate-limit.service';
import { AdvancedRateLimitGuard } from './advanced-rate-limit.guard';
import { RedisModule } from '../redis/redis.module';

/**
 * Global module for advanced rate limiting
 */
@Global()
@Module({
  imports: [RedisModule],
  providers: [AdvancedRateLimitService, AdvancedRateLimitGuard],
  exports: [AdvancedRateLimitService, AdvancedRateLimitGuard],
})
export class AdvancedRateLimitModule {}
