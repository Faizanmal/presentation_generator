import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
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
      getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'] as string;
      },
    });

    this.csrfProtection = doubleCsrfProtection;
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
