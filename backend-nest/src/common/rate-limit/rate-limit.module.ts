import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RateLimitService, RateLimitMiddleware } from './rate-limit.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RateLimitService, RateLimitMiddleware],
  exports: [RateLimitService],
})
export class RateLimitModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply rate limiting to all routes
    // Can be customized per route if needed
    consumer.apply(RateLimitMiddleware).forRoutes('*path');
  }
}
