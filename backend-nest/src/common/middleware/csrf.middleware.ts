import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection;

  constructor() {
    const { generateToken, doubleCsrfProtection } = doubleCsrf({
      getSecret: () => process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
      cookieName: '__Host-psifi.x-csrf-token',
      cookieOptions: {
        sameSite: 'strict',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
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

    this.csrfProtection(req, res, next);
  }
}
