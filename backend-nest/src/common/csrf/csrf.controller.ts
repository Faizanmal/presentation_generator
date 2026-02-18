import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { doubleCsrf } from 'csrf-csrf';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
  private generateToken;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Create new instance of doubleCsrf with identical configuration
    const cookieName = isProduction
      ? '__Host-psifi.x-csrf-token'
      : 'psifi.x-csrf-token';

    const utilities: any = doubleCsrf({
      getSecret: () =>
        process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
      cookieName,
      cookieOptions: {
        sameSite: 'strict',
        path: '/',
        secure: isProduction,
        httpOnly: true,
      },
      size: 64,
      ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
      // session identifier (required by newer types)
      getSessionIdentifier: (req: any) => String(req.cookies?.sessionId || req.headers['x-session-id'] || req.ip || ''),
      // new option name in current types
      getCsrfTokenFromRequest: (req: any) => {
        return req.headers['x-csrf-token'] as string;
      },
    });

    // support multiple versions of the library API
    this.generateToken =
      utilities.generateToken || utilities.getToken ||
      ((req: any, res: any) => {
        const token = require('crypto').randomBytes(32).toString('hex');
        res.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict' });
        return token;
      });
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
      const result = this.generateToken(req, res);
      // doubleCsrf generateToken returns the token string directly in some versions/configs
      // or an object with token property. Let's handle both.
      const token = typeof result === 'string' ? result : result.token;

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
