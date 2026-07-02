import {
  Injectable,
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    id: string;
    userId: string;
    email: string;
    name: string;
    role: string;
    iat: number;
    exp: number;
  };
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  // Demo mode: set to true to bypass auth
  private readonly DEMO_MODE = process.env.DEMO_MODE === 'true' || true;

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const url = request.url;

    // DEMO MODE: Skip auth and attach mock user
    if (this.DEMO_MODE) {
      const mockUser = {
        sub: 'demo-user-123',
        id: 'demo-user-123',
        userId: 'demo-user-123',
        email: 'demo@example.com',
        name: 'Demo User',
        role: 'ADMIN',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      request.user = mockUser;
      this.logger.debug(
        `[JwtAuthGuard] DEMO MODE ACTIVE - User attached: ${mockUser.email}`,
      );
      return true;
    }

    if (!authHeader) {
      this.logger.warn(
        `[JwtAuthGuard] No Authorization header for ${request.method} ${url}`,
      );
    } else {
      const tokenPreview = authHeader.substring(0, 30);
      this.logger.debug(
        `[JwtAuthGuard] Authorization header present (${tokenPreview}...) for ${request.method} ${url}`,
      );
    }

    return super.canActivate(context) as boolean | Promise<boolean>;
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    _context?: ExecutionContext,
  ): TUser {
    if (err) {
      this.logger.warn(
        `[JwtAuthGuard] Authentication error: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Authentication failed');
    }

    if (!user) {
      this.logger.warn(
        '[JwtAuthGuard] JWT validation failed - no user extracted',
      );
      throw new UnauthorizedException('Invalid or missing JWT token');
    }

    this.logger.debug('[JwtAuthGuard] JWT validation successful');
    return user;
  }
}
