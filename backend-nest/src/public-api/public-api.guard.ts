import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PublicApiService } from './public-api.service';

@Injectable()
export class PublicApiGuard implements CanActivate {
  constructor(
    private readonly apiService: PublicApiService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Get API key from header
    const apiKey = request.headers['x-api-key'] || request.headers['authorization']?.replace('Bearer ', '');

    if (!apiKey) {
      throw new UnauthorizedException('API key required');
    }

    // Validate API key
    const validation = await this.apiService.validateApiKey(apiKey);

    if (!validation.valid) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Check rate limit
    const rateLimit = await this.apiService.checkRateLimit(validation.keyId!);

    if (!rateLimit.allowed) {
      throw new UnauthorizedException('Rate limit exceeded');
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    response.setHeader('X-RateLimit-Reset', rateLimit.resetAt);

    // Check required scope
    const requiredScope = this.reflector.get<string>('apiScope', context.getHandler());
    
    if (requiredScope && !this.apiService.hasScope(validation.scopes!, requiredScope)) {
      throw new UnauthorizedException(`Missing required scope: ${requiredScope}`);
    }

    // Attach user info to request
    request.apiUser = {
      userId: validation.userId,
      keyId: validation.keyId,
      scopes: validation.scopes,
    };

    // Log usage (async, don't wait)
    const startTime = Date.now();
    response.on('finish', () => {
      this.apiService.logUsage(
        validation.keyId!,
        request.path,
        request.method,
        response.statusCode,
        Date.now() - startTime,
      ).catch(() => {});
    });

    return true;
  }
}
