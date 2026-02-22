import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import type { ParsedQs } from 'qs';
import helmet from 'helmet';

/**
 * Security middleware applying various HTTP security headers
 */
@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  private helmetMiddleware: ReturnType<typeof helmet>;

  constructor() {
    this.helmetMiddleware = helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust based on needs
          connectSrc: ["'self'", 'https://api.openai.com', 'wss:'],
          frameSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      // Cross-Origin-Embedder-Policy
      crossOriginEmbedderPolicy: false, // Disable if embedding external content
      // Cross-Origin-Opener-Policy
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      // Cross-Origin-Resource-Policy
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      // Note: 'expectCt' removed because current Helmet typings don't include it. If you need Expect-CT,
      // add it via a small middleware setting the header manually.
      // Frameguard (X-Frame-Options)
      frameguard: { action: 'deny' },
      // Hide Powered By
      hidePoweredBy: true,
      // HTTP Strict Transport Security
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      // IE No Open
      ieNoOpen: true,
      // No Sniff (X-Content-Type-Options)
      noSniff: true,
      // Permitted Cross-Domain Policies
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // XSS Filter
      xssFilter: true,
    });
  }

  use(req: Request, res: Response, next: NextFunction) {
    this.helmetMiddleware(req, res, next);
  }
}

/**
 * Request sanitization middleware
 */
@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Sanitize request body
    if (req.body) {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      const sanitizedQuery = this.sanitizeObject(req.query) as ParsedQs;
      try {
        req.query = sanitizedQuery;
      } catch {
        // If req.query is read-only (getter only), mutate the object properties
        if (typeof req.query === 'object' && req.query !== null) {
          Object.keys(req.query).forEach((key) => delete req.query[key]);
          Object.assign(
            req.query,
            sanitizedQuery as unknown as Record<string, unknown>,
          );
        }
      }
    }

    next();
  }

  private sanitizeObject(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    const input = obj as Record<string, unknown> | unknown[];
    const sanitized: Record<string, unknown> | unknown[] = Array.isArray(input)
      ? []
      : {};

    for (const key in input as Record<string, unknown>) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        // Remove potentially dangerous keys
        if (this.isDangerousKey(key)) {
          continue;
        }

        (sanitized as Record<string, unknown>)[key] = this.sanitizeObject(
          (input as Record<string, unknown>)[key],
        );
      }
    }

    return sanitized;
  }

  private sanitizeString(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }

    // Remove potential XSS patterns
    const str = value;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  private isDangerousKey(key: string): boolean {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    return dangerousKeys.includes(key);
  }
}
