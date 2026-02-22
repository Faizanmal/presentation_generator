import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { doubleCsrf } from 'csrf-csrf';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
  private generateToken: (
    req: Request,
    res: Response,
  ) => string | { token: string };

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Create new instance of doubleCsrf with required configuration
    const { generateCsrfToken } = doubleCsrf({
      getSecret: () =>
        process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
      getSessionIdentifier: (req) =>
        (req.headers['authorization'] as string) || req.ip || '',
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
      getCsrfTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'] as string;
      },
    });

    this.generateToken = (req, res) => generateCsrfToken(req, res);
  }

  @Get('token')
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiResponse({
    status: 200,
    description: 'Returns a CSRF token',
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'CSRF token to include in subsequent requests',
        },
      },
    },
  })
  getCsrfToken(@Req() req: Request, @Res() res: Response) {
    try {
      const generateTokenResult = this.generateToken(req, res);
      // doubleCsrf generateToken returns the token string directly in some versions/configs
      // or an object with token property. Let's handle both.
      const token =
        typeof generateTokenResult === 'string'
          ? generateTokenResult
          : (generateTokenResult as Record<string, string>).token;

      console.log('[CsrfController] Generated token:', {
        token: token ? token.substring(0, 10) + '...' : 'null',
        cookies: req.cookies,
      });

      return res.json({ token });
    } catch (err) {
      console.error('[CsrfController] Error generating token:', err);
      return res.status(500).json({ message: 'Failed to generate CSRF token' });
    }
  }
}
