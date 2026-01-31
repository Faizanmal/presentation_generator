import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Response } from 'express';

/**
 * Guard that adds security headers to all responses
 */
@Injectable()
export class SecurityHeadersGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const response = context.switchToHttp().getResponse<Response>();

    // Prevent clickjacking
    response.setHeader('X-Frame-Options', 'SAMEORIGIN');

    // Prevent MIME type sniffing
    response.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter
    response.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer policy
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
    );

    // Content Security Policy (adjust based on your needs)
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "connect-src 'self' https://api.openai.com https://api.stripe.com wss:; " +
        "frame-src 'self' https://js.stripe.com https://www.youtube.com https://player.vimeo.com; " +
        "object-src 'none';",
    );

    // Strict Transport Security (HTTPS only)
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );

    return true;
  }
}
