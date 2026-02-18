import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    const utilities: any = doubleCsrf({
      getSecret: () =>
        process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
      cookieName: isProduction
        ? '__Host-psifi.x-csrf-token'
        : 'psifi.x-csrf-token',
      cookieOptions: {
        sameSite: 'strict',
        path: '/',
        secure: isProduction,
        httpOnly: true,
      },
      size: 64,
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      getSessionIdentifier: (req: any) => String(req.cookies?.sessionId || req.headers['x-session-id'] || req.ip || ''),
      getCsrfTokenFromRequest: (req: any) => req.headers['x-csrf-token'] as string,
    });

    this.csrfProtection = utilities.doubleCsrfProtection || utilities.protect;
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Skip CSRF for health checks, metrics, and webhooks
    const skipPaths = ['/health', '/metrics', '/api/payments/webhook'];
    if (skipPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Debug logging for CSRF issues
    if (
      req.method !== 'GET' &&
      req.method !== 'HEAD' &&
      req.method !== 'OPTIONS'
    ) {
      console.log(`[CSRF Debug] ${req.method} ${req.path}`, {
        tokenHeader: req.headers['x-csrf-token'],
        cookies: req.cookies,
        isProduction: process.env.NODE_ENV === 'production',
      });
    }

    this.csrfProtection(req, res, next);
  }
}
