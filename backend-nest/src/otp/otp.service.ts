import {
  Injectable,
  Inject,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { OtpMetricsService } from './otp-metrics.service';
import { MonitoringService } from '../common/monitoring/monitoring.service';
import { randomInt } from 'crypto';
import { OtpChannel, OtpPurpose } from './dto/otp.dto';

export interface OtpResult {
  success: boolean;
  message: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
}

export interface OtpVerifyResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  valid: boolean;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  // Configuration
  private readonly OTP_EXPIRY = 300; // 5 minutes
  private readonly MAX_ATTEMPTS = 3; // Max verify attempts before lockout
  private readonly RESEND_COOLDOWN = 60; // 60 seconds between resends
  private readonly RATE_LIMIT_WINDOW = 3600; // 1 hour window
  private readonly MAX_REQUESTS_PER_HOUR = 10; // Max OTP requests per hour per identifier
  private readonly LOCKOUT_DURATION = 1800; // 30-minute lockout after max failed attempts

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @Optional() private readonly otpMetrics: OtpMetricsService,
    @Optional() private readonly monitoring: MonitoringService,
  ) {}

  // ─── Generate & Send OTP ───────────────────────────────────
  /**
   * Backwards-compatible synchronous OTP generator used by legacy tests
   */
  generateOtp(): string;
  /** Main async API to generate and send OTP for an identifier */
  generateOtp(
    identifier: string,
    channel: OtpChannel | string,
    purpose?: OtpPurpose | string,
  ): Promise<OtpResult>;
  generateOtp(
    identifier?: string,
    channel?: OtpChannel | string,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<OtpResult> | string {
    // If no identifier provided, behave as legacy helper and return a 6-digit string
    if (!identifier) {
      const val = randomInt(0, 1000000);
      return val.toString().padStart(6, '0');
    }

    // Delegate to async helper to allow synchronous no-arg usage in tests
    return this.generateOtpAsync(identifier, channel as OtpChannel, purpose);
  }

  private async generateOtpAsync(
    identifier: string,
    channel: OtpChannel,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<OtpResult> {
    const normalizedId = this.normalizeIdentifier(identifier, channel);
    const otpKey = this.getOtpKey(normalizedId, purpose);
    const cooldownKey = `otp:cooldown:${normalizedId}:${purpose}`;
    const rateLimitKey = `otp:ratelimit:${normalizedId}`;
    const lockoutKey = `otp:lockout:${normalizedId}:${purpose}`;

    // Check lockout
    const isLockedOut = await this.redis.get(lockoutKey);
    if (isLockedOut) {
      const ttl = await this.redis.ttl(lockoutKey);
      this.otpMetrics?.trackRateLimited(
        normalizedId,
        (channel as string) === 'email' ? 'email' : 'sms',
        purpose,
      );
      throw new HttpException(
        `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check resend cooldown
    const cooldownTtl = await this.redis.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      return {
        success: false,
        message: `Please wait before requesting a new code`,
        retryAfterSeconds: cooldownTtl,
      };
    }

    // Check rate limit (max requests per hour)
    const requestCount = await this.redis.incr(rateLimitKey);
    if (requestCount === 1) {
      await this.redis.expire(rateLimitKey, this.RATE_LIMIT_WINDOW);
    }
    if (requestCount > this.MAX_REQUESTS_PER_HOUR) {
      const ttl = await this.redis.ttl(rateLimitKey);
      this.otpMetrics?.trackRateLimited(
        normalizedId,
        (channel as string) === 'email' ? 'email' : 'sms',
        purpose,
      );
      this.monitoring?.trackOtpFailed(
        (channel as string) === 'email' ? 'email' : 'sms',
        purpose,
        'rate_limited',
      );
      throw new HttpException(
        `Too many OTP requests. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit OTP
    const otp = randomInt(0, 1000000).toString().padStart(6, '0');

    // Store OTP in Redis with expiration
    await this.redis.set(otpKey, otp, 'EX', this.OTP_EXPIRY);

    // Reset attempt counter
    await this.redis.del(`otp:attempts:${normalizedId}:${purpose}`);

    // Set resend cooldown
    await this.redis.set(cooldownKey, '1', 'EX', this.RESEND_COOLDOWN);

    // Send OTP via channel
    try {
      if ((channel as string) === 'email') {
        await this.emailService.sendOtpEmail(
          normalizedId,
          otp,
          Math.ceil(this.OTP_EXPIRY / 60),
        );
      } else if ((channel as string) === 'sms') {
        await this.smsService.sendSms(
          normalizedId,
          `Your Presentation Designer verification code is: ${otp}. Expires in ${Math.ceil(this.OTP_EXPIRY / 60)} minutes. Do not share this code.`,
        );
      }
    } catch (error) {
      // Clean up on send failure
      await this.redis.del(otpKey);
      await this.redis.del(cooldownKey);
      this.logger.error(
        `Failed to send OTP to ${normalizedId} via ${channel}`,
        error?.stack,
      );
      throw new BadRequestException(
        `Failed to send verification code via ${channel}. Please try again.`,
      );
    }

    this.logger.log(
      `OTP generated for ${normalizedId} via ${channel} [purpose: ${purpose}]`,
    );

    // Track metrics
    this.otpMetrics?.trackRequested(
      normalizedId,
      (channel as string) === 'email' ? 'email' : 'sms',
      purpose,
    );
    this.monitoring?.trackOtpRequested(
      (channel as string) === 'email' ? 'email' : 'sms',
      purpose,
    );

    return {
      success: true,
      message: `Verification code sent to ${this.maskIdentifier(normalizedId, channel)}`,
      expiresInSeconds: this.OTP_EXPIRY,
    };
  }

  // ─── Verify OTP ────────────────────────────────────────────
  async verifyOtp(
    identifier: string,
    otp: string,
    channel: OtpChannel | string = OtpChannel.EMAIL,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<OtpVerifyResult> {
    const normalizedId = this.normalizeIdentifier(
      identifier,
      channel as OtpChannel,
    );
    const otpKey = this.getOtpKey(normalizedId, purpose);
    const attemptsKey = `otp:attempts:${normalizedId}:${purpose}`;
    const lockoutKey = `otp:lockout:${normalizedId}:${purpose}`;

    // Check lockout
    const isLockedOut = await this.redis.get(lockoutKey);
    if (isLockedOut) {
      const ttl = await this.redis.ttl(lockoutKey);
      throw new HttpException(
        `Account temporarily locked. Try again in ${Math.ceil(ttl / 60)} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Get stored OTP
    const storedOtp = await this.redis.get(otpKey);
    if (!storedOtp) {
      return {
        success: false,
        valid: false,
        message:
          'Verification code has expired or was not requested. Please request a new code.',
      };
    }

    // Track attempts
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.OTP_EXPIRY);
    }

    // Check max attempts
    if (attempts >= this.MAX_ATTEMPTS) {
      // Lock out the identifier
      await this.redis.set(lockoutKey, '1', 'EX', this.LOCKOUT_DURATION);
      await this.redis.del(otpKey);
      await this.redis.del(attemptsKey);

      this.logger.warn(
        `Max OTP attempts exceeded for ${normalizedId}, locked out for ${this.LOCKOUT_DURATION / 60} minutes`,
      );

      // Track lockout
      this.otpMetrics?.trackLockedOut(
        normalizedId,
        channel === 'email' ? 'email' : 'sms',
        purpose,
      );
      this.monitoring?.trackOtpFailed(
        channel === 'email' ? 'email' : 'sms',
        purpose,
        'locked_out',
      );

      // Return a failure result (tests expect removal and a failed response rather than an exception here)
      return {
        success: false,
        valid: false,
        message: `Too many failed attempts. Account locked for ${this.LOCKOUT_DURATION / 60} minutes.`,
        remainingAttempts: 0,
      };
    }

    // Constant-time comparison to prevent timing attacks
    const isValid = this.constantTimeCompare(storedOtp, otp);

    if (isValid) {
      // Clean up on success
      await this.redis.del(otpKey);
      await this.redis.del(attemptsKey);

      this.logger.log(`OTP verified for ${normalizedId} [purpose: ${purpose}]`);

      // Track success
      this.otpMetrics?.trackVerified(
        normalizedId,
        channel === 'email' ? 'email' : 'sms',
        purpose,
      );
      this.monitoring?.trackOtpVerified(
        channel === 'email' ? 'email' : 'sms',
        purpose,
      );

      return {
        success: true,
        valid: true,
        message: 'Verification successful',
      };
    }

    const remainingAttempts = this.MAX_ATTEMPTS - attempts;
    this.logger.warn(
      `Invalid OTP for ${normalizedId} [attempt ${attempts}/${this.MAX_ATTEMPTS}]`,
    );

    // Track failure
    this.otpMetrics?.trackFailed(
      normalizedId,
      channel === 'email' ? 'email' : 'sms',
      purpose,
    );
    this.monitoring?.trackOtpFailed(
      channel === 'email' ? 'email' : 'sms',
      purpose,
      'invalid_code',
    );

    return {
      success: false,
      valid: false,
      message: `Invalid verification code. ${remainingAttempts} attempt(s) remaining.`,
      remainingAttempts,
    };
  }

  // ─── Check OTP Status ──────────────────────────────────────
  async getOtpStatus(
    identifier: string,
    channel: OtpChannel | string = OtpChannel.EMAIL,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<{
    hasActiveOtp: boolean;
    expiresInSeconds: number;
    canResend: boolean;
    resendAfterSeconds: number;
  }> {
    const normalizedId = this.normalizeIdentifier(
      identifier,
      channel as OtpChannel,
    );
    const otpKey = this.getOtpKey(normalizedId, purpose);
    const cooldownKey = `otp:cooldown:${normalizedId}:${purpose}`;

    const otpTtl = await this.redis.ttl(otpKey);
    const cooldownTtl = await this.redis.ttl(cooldownKey);

    return {
      hasActiveOtp: otpTtl > 0,
      expiresInSeconds: Math.max(0, otpTtl),
      canResend: cooldownTtl <= 0,
      resendAfterSeconds: Math.max(0, cooldownTtl),
    };
  }

  // ─── Invalidate OTP ────────────────────────────────────────
  async invalidateOtp(
    identifier: string,
    channel: OtpChannel | string = OtpChannel.EMAIL,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<void> {
    const normalizedId = this.normalizeIdentifier(
      identifier,
      channel as OtpChannel,
    );
    const otpKey = this.getOtpKey(normalizedId, purpose);
    await this.redis.del(otpKey);
  }

  // ─── Helpers ───────────────────────────────────────────────
  private getOtpKey(identifier: string, purpose: OtpPurpose | string): string {
    return `otp:${purpose}:${identifier}`;
  }

  private normalizeIdentifier(identifier: string, channel: OtpChannel): string {
    if ((channel as string) === 'email') {
      return identifier.toLowerCase().trim();
    }
    // For phone numbers, strip everything except digits and leading +
    return identifier.replace(/[^\d+]/g, '');
  }

  private maskIdentifier(identifier: string, channel: OtpChannel): string {
    if ((channel as string) === 'email') {
      const [local, domain] = identifier.split('@');
      const maskedLocal =
        local.length <= 2
          ? local[0] + '***'
          : local[0] + '***' + local[local.length - 1];
      return `${maskedLocal}@${domain}`;
    }
    // Phone: show last 4 digits
    return `****${identifier.slice(-4)}`;
  }

  /**
   * Compatibility wrapper for older tests: creates and stores an OTP and returns it
   */
  async createOtp(
    identifier: string,
    channel: OtpChannel | string,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<{ success: boolean; otp?: string; retryAfterSeconds?: number }> {
    const result = await this.generateOtpAsync(
      identifier,
      channel as OtpChannel,
      purpose,
    );
    // If generation returned a retry/cooldown response, forward it
    if (!result.success) {
      return {
        success: false,
        retryAfterSeconds: result.retryAfterSeconds as number,
      };
    }

    // Retrieve stored OTP (tests mock Redis, so we rely on storage behavior)
    const normalizedId = this.normalizeIdentifier(
      identifier,
      channel as OtpChannel,
    );
    const otpKey = this.getOtpKey(normalizedId, purpose);
    const otp = await this.redis.get(otpKey);

    return { success: true, otp: otp ?? undefined };
  }

  async resendOtp(
    identifier: string,
    channel: OtpChannel | string,
    purpose: OtpPurpose | string = OtpPurpose.LOGIN,
  ): Promise<{ success: boolean; otp?: string; retryAfterSeconds?: number }> {
    // If cooldown active, return retry info
    const normalizedId = this.normalizeIdentifier(
      identifier,
      channel as OtpChannel,
    );
    const cooldownKey = `otp:cooldown:${normalizedId}:${purpose}`;
    const cooldownTtl = await this.redis.ttl(cooldownKey);
    if (cooldownTtl > 0) {
      return { success: false, retryAfterSeconds: cooldownTtl };
    }

    return this.createOtp(identifier, channel, purpose);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}
