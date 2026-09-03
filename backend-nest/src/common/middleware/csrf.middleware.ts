import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrfProtection } from '../csrf/double-csrf.config';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for health checks, metrics, webhooks, and token refresh
    // (refresh authenticates with the refresh token in the body, not a cookie session)
    const skipPaths = [
      '/health',
      '/metrics',
      '/api/payments/webhook',
      '/api/auth/refresh',
      '/auth/refresh',
    ];
    if (skipPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Debug logging for CSRF issues (non-GET, non-HEAD, non-OPTIONS)
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (isMutation) {
      console.log(`[CSRF Debug] ${req.method} ${req.path}`, {
        tokenHeader: req.headers['x-csrf-token']
          ? req.headers['x-csrf-token'].substring(0, 10) + '...'
          : 'null',
        cookies: req.cookies,
        isProduction: process.env.NODE_ENV === 'production',
      });
    }

    doubleCsrfProtection(req, res, next);
  }
}
