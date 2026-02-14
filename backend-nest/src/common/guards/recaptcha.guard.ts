import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import axios from 'axios';
import { SetMetadata } from '@nestjs/common';

// Decorator to mark endpoints requiring reCAPTCHA
export const RECAPTCHA_KEY = 'recaptcha';
export const RequireRecaptcha = () => SetMetadata(RECAPTCHA_KEY, true);

export interface RecaptchaVerifyResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  score?: number;
  action?: string;
  'error-codes'?: string[];
}

@Injectable()
export class RecaptchaGuard implements CanActivate {
  private readonly logger = new Logger(RecaptchaGuard.name);
  private readonly VERIFY_URL =
    'https://www.google.com/recaptcha/api/siteverify';

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if reCAPTCHA is enabled
    const recaptchaEnabled =
      this.configService.get<string>('RECAPTCHA_ENABLED') === 'true';
    if (!recaptchaEnabled) {
      return true; // Skip in dev/when disabled
    }

    // Check if this endpoint has @RequireRecaptcha()
    const requiresRecaptcha = this.reflector.get<boolean>(
      RECAPTCHA_KEY,
      context.getHandler(),
    );
    if (!requiresRecaptcha) {
      return true; // Skip endpoints without the decorator
    }

    const request = context.switchToHttp().getRequest();
    const recaptchaToken =
      request.body?.recaptchaToken || request.headers['x-recaptcha-token'];

    if (!recaptchaToken) {
      throw new BadRequestException('reCAPTCHA token is required');
    }

    const secretKey = this.configService.get<string>('RECAPTCHA_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('RECAPTCHA_SECRET_KEY not configured, allowing request');
      return true;
    }

    try {
      const response = await axios.post<RecaptchaVerifyResponse>(
        this.VERIFY_URL,
        null,
        {
          params: {
            secret: secretKey,
            response: recaptchaToken,
            remoteip: request.ip,
          },
        },
      );

      const { success, score } = response.data;

      if (!success) {
        this.logger.warn(
          `reCAPTCHA verification failed: ${response.data['error-codes']?.join(', ')}`,
        );
        throw new BadRequestException('reCAPTCHA verification failed');
      }

      // For reCAPTCHA v3, check score (0.0 = bot, 1.0 = human)
      const minScore = parseFloat(
        this.configService.get<string>('RECAPTCHA_MIN_SCORE') || '0.5',
      );

      if (score !== undefined && score < minScore) {
        this.logger.warn(
          `reCAPTCHA score too low: ${score} (min: ${minScore})`,
        );
        throw new BadRequestException(
          'Suspicious activity detected. Please try again.',
        );
      }

      this.logger.debug(`reCAPTCHA verified: score=${score}`);
      return true;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;

      this.logger.error(`reCAPTCHA verification error: ${error.message}`);
      // Fail open in case of API errors (configurable)
      const failOpen =
        this.configService.get<string>('RECAPTCHA_FAIL_OPEN') === 'true';
      if (failOpen) {
        this.logger.warn('reCAPTCHA API error - failing open');
        return true;
      }
      throw new BadRequestException('reCAPTCHA verification failed');
    }
  }
}
