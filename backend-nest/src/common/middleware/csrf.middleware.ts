import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { doubleCsrfProtection } from '../csrf/double-csrf.config';

function allowedOrigins(): string[] {
  const raw = process.env.FRONTEND_URL || '';
  return raw
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function shouldSkipCsrf(req: Request): boolean {
  const skipPaths = [
    '/health',
    '/metrics',
    '/api/payments/webhook',
    '/api/auth/refresh',
    '/auth/refresh',
  ];
  if (skipPaths.some((path) => req.path.startsWith(path))) {
    return true;
  }

  // JWT in Authorization is not auto-attached by the browser, so CSRF
  // does not apply. This is the Vercel → Render production path.
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^Bearer\s+\S+/i.test(auth)) {
    return true;
  }

  // Browsers send Origin on cross-site fetches. CORS already rejects
  // unknown origins; a matching Origin is the SPA, not a CSRF attacker.
  const originHeader = req.headers.origin;
  if (typeof originHeader === 'string') {
    const origin = originHeader.replace(/\/$/, '');
    if (allowedOrigins().includes(origin)) {
      return true;
    }
  }

  return false;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (shouldSkipCsrf(req)) {
      return next();
    }

    doubleCsrfProtection(req, res, next);
  }
}
