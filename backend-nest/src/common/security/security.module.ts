import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { SecurityService } from './security.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { SecurityHeadersGuard } from './guards/security-headers.guard';

/**
 * Global security module for production-ready security features
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    SecurityService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: SecurityHeadersGuard,
    },
  ],
  exports: [SecurityService],
})
export class SecurityModule {}
