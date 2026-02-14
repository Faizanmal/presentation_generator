import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { doubleCsrf } from 'csrf-csrf';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
  private generateToken;

  constructor() {
    const { generateToken } = doubleCsrf({
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

    this.generateToken = generateToken;
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
    const { token } = this.generateToken(req, res);
    return res.json({ token });
  }
}
