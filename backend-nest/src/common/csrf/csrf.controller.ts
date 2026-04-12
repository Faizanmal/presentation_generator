import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { generateCsrfToken } from './double-csrf.config';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
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
      const token = generateCsrfToken(req, res);

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
