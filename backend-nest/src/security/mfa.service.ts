import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';

export interface MfaSetupResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MfaVerificationResult {
  valid: boolean;
  usedBackupCode?: boolean;
}

/**
 * Multi-Factor Authentication (MFA) Service
 * Supports TOTP (Time-based One-Time Password) and backup codes
 */
@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly appName: string;
  private readonly backupCodesCount = 10;

  constructor(
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.appName =
      this.configService.get<string>('APP_NAME') || 'PresentationDesigner';
    this.logger.log('✓ MFA service initialized');
  }

  /**
   * Initialize MFA for a user
   * Generate TOTP secret and backup codes
   */
  async setupMfa(userId: string, email: string): Promise<MfaSetupResult> {
    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `${this.appName} (${email})`,
      issuer: this.appName,
      length: 32,
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Store backup codes in Redis (hashed)
    await this.storeBackupCodes(userId, backupCodes);

    this.logger.log(`MFA setup initiated for user: ${userId}`);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  /**
   * Verify TOTP token
   */
  verifyTotp(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock skew
    });
  }

  /**
   * Verify MFA code (TOTP or backup code)
   */
  async verifyMfa(
    userId: string,
    mfaSecret: string,
    code: string,
  ): Promise<MfaVerificationResult> {
    // Try TOTP first
    const totpValid = this.verifyTotp(mfaSecret, code);

    if (totpValid) {
      return { valid: true };
    }

    // Try backup code
    const backupCodeValid = await this.verifyBackupCode(userId, code);

    if (backupCodeValid) {
      return { valid: true, usedBackupCode: true };
    }

    return { valid: false };
  }

  /**
   * Generate backup codes
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.backupCodesCount; i++) {
      // Generate 8-character alphanumeric code
      const code = this.generateSecureCode(8);
      codes.push(code);
    }
    return codes;
  }

  /**
   * Generate secure random code
   */
  private generateSecureCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      code += chars[randomBytes[i] % chars.length];
    }

    // Format: XXXX-XXXX
    return code.slice(0, 4) + '-' + code.slice(4);
  }

  /**
   * Store backup codes in Redis (hashed)
   */
  private async storeBackupCodes(
    userId: string,
    codes: string[],
  ): Promise<void> {
    const hashedCodes = codes.map((code) =>
      crypto.createHash('sha256').update(code).digest('hex'),
    );

    await this.redis.set(
      `mfa:backup:${userId}`,
      JSON.stringify(hashedCodes),
      'EX',
      60 * 60 * 24 * 365, // 1 year
    );
  }

  /**
   * Verify and consume backup code
   */
  private async verifyBackupCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    const storedCodesJson = await this.redis.get(`mfa:backup:${userId}`);
    if (!storedCodesJson) {
      return false;
    }

    const storedCodes: string[] = JSON.parse(storedCodesJson);
    const index = storedCodes.indexOf(hashedCode);

    if (index === -1) {
      return false;
    }

    // Remove used backup code
    storedCodes.splice(index, 1);
    await this.redis.set(
      `mfa:backup:${userId}`,
      JSON.stringify(storedCodes),
      'EX',
      60 * 60 * 24 * 365,
    );

    this.logger.warn(`Backup code used for user: ${userId}`);

    return true;
  }

  /**
   * Get remaining backup codes count
   */
  async getBackupCodesCount(userId: string): Promise<number> {
    const storedCodesJson = await this.redis.get(`mfa:backup:${userId}`);
    if (!storedCodesJson) {
      return 0;
    }

    const storedCodes: string[] = JSON.parse(storedCodesJson);
    return storedCodes.length;
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId: string): Promise<string[]> {
    const backupCodes = this.generateBackupCodes();
    await this.storeBackupCodes(userId, backupCodes);
    this.logger.log(`Backup codes regenerated for user: ${userId}`);
    return backupCodes;
  }

  /**
   * Disable MFA for user
   */
  async disableMfa(userId: string): Promise<void> {
    await this.redis.del(`mfa:backup:${userId}`);
    this.logger.log(`MFA disabled for user: ${userId}`);
  }

  /**
   * Send MFA code via SMS (for SMS-based MFA)
   */
  async sendSmsCode(phone: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in Redis (5 minutes expiry)
    await this.redis.set(`mfa:sms:${phone}`, code, 'EX', 300);

    this.logger.log(`SMS MFA code generated for: ${phone}`);

    // Send SMS via Twilio (reusing existing SMS infrastructure)
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioFrom = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (twilioSid && twilioToken && twilioFrom) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const twilio = require('twilio');
        const client = twilio(twilioSid, twilioToken);
        await client.messages.create({
          body: `Your PresentationDesigner MFA code is: ${code}. It expires in 5 minutes.`,
          from: twilioFrom,
          to: phone,
        });
        this.logger.log(`MFA SMS sent to ${phone}`);
      } catch (err) {
        this.logger.error(`Failed to send MFA SMS: ${(err as Error).message}`);
      }
    } else {
      this.logger.warn(
        'Twilio not configured — MFA SMS code not sent. Code stored in Redis for verification.',
      );
    }

    return code;
  }

  /**
   * Verify SMS code
   */
  async verifySmsCode(phone: string, code: string): Promise<boolean> {
    const storedCode = await this.redis.get(`mfa:sms:${phone}`);

    if (!storedCode || storedCode !== code) {
      return false;
    }

    // Delete code after successful verification
    await this.redis.del(`mfa:sms:${phone}`);

    return true;
  }

  /**
   * Check if user has MFA enabled
   */
  async isMfaEnabled(
    userId: string,
    mfaSecret: string | null,
  ): Promise<boolean> {
    if (!mfaSecret) {
      return false;
    }

    // Check if backup codes exist
    const backupCodesCount = await this.getBackupCodesCount(userId);

    return backupCodesCount > 0 || !!mfaSecret;
  }

  /**
   * Remember device (skip MFA for trusted devices)
   */
  async rememberDevice(userId: string, deviceId: string): Promise<void> {
    await this.redis.set(
      `mfa:trusted:${userId}:${deviceId}`,
      '1',
      'EX',
      60 * 60 * 24 * 30, // 30 days
    );
    this.logger.log(`Device trusted for user: ${userId}`);
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const trusted = await this.redis.get(`mfa:trusted:${userId}:${deviceId}`);
    return !!trusted;
  }

  /**
   * Forget device
   */
  async forgetDevice(userId: string, deviceId: string): Promise<void> {
    await this.redis.del(`mfa:trusted:${userId}:${deviceId}`);
    this.logger.log(`Device forgotten for user: ${userId}`);
  }

  /**
   * Get all trusted devices
   */
  async getTrustedDevices(userId: string): Promise<string[]> {
    const keys = await this.redis.keys(`mfa:trusted:${userId}:*`);
    return keys.map((key) => key.split(':').pop() || '');
  }
}
