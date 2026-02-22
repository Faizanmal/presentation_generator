import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import { OtpChannel, OtpPurpose } from '../otp/dto/otp.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role?: string;
  };
}

export interface AuditEvent {
  userId?: string;
  email?: string;
  action: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEVICE_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
  private readonly ACCESS_TOKEN_EXPIRY = 900; // 15 minutes in seconds
  private readonly REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

  // Password must be ≥8 chars and contain at least:
  // one uppercase letter, one lowercase letter, one digit, one special character
  private static readonly PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>?`~]).{8,}$/;

  private static readonly PASSWORD_RULES =
    'Password must be at least 8 characters and include an uppercase letter, ' +
    'a lowercase letter, a number, and a special character.';

  /** Throws BadRequestException when the password does not meet complexity requirements. */
  private validatePasswordStrength(password: string): void {
    if (!password || !AuthService.PASSWORD_REGEX.test(password)) {
      throw new BadRequestException(AuthService.PASSWORD_RULES);
    }
  }

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ─── Audit Logging ────────────────────────────────────────
  private async auditLog(event: AuditEvent): Promise<void> {
    const logData = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    if (event.success) {
      this.logger.log(
        `AUDIT [${event.action}] user=${event.email ?? event.userId} ip=${event.ip ?? 'unknown'}`,
      );
    } else {
      this.logger.warn(
        `AUDIT_FAIL [${event.action}] user=${event.email ?? event.userId} ip=${event.ip ?? 'unknown'}`,
      );
    }
    // Store audit record in Redis for recent events (24h TTL)
    const auditKey = `audit:${event.userId ?? event.email}:${Date.now()}`;
    await this.redis
      .set(auditKey, JSON.stringify(logData), 'EX', 86400)
      .catch(() => {});
  }

  // ─── Brute-Force Protection ───────────────────────────────
  private async checkLoginAttempts(email: string): Promise<void> {
    const attemptsKey = `login_attempts:${email}`;
    const attempts = await this.redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= this.MAX_LOGIN_ATTEMPTS) {
      const ttl = await this.redis.ttl(attemptsKey);
      throw new UnauthorizedException(
        `Account temporarily locked due to too many failed attempts. Try again in ${Math.ceil(ttl / 60)} minute(s).`,
      );
    }
  }

  private async recordFailedLogin(email: string): Promise<void> {
    const attemptsKey = `login_attempts:${email}`;
    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, this.LOCKOUT_DURATION);
    }
  }

  private async clearLoginAttempts(email: string): Promise<void> {
    await this.redis.del(`login_attempts:${email}`);
  }

  // ─── Register (email/password) ─────────────────────────────
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Validate password strength (complexity + minimum length)
    this.validatePasswordStrength(registerDto.password);

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Create user
    const user = await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: hashedPassword,
    });

    // Create subscription with free plan
    await this.usersService.createSubscription(user.id);

    this.logger.log(`User registered: ${user.email}`);
    await this.auditLog({
      email: user.email,
      userId: user.id,
      action: 'REGISTER',
      success: true,
    });

    // Send welcome email (non-blocking)
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    this.emailService
      .sendWelcomeEmail(
        user.email,
        user.name || 'there',
        `${frontendUrl}/dashboard`,
      )
      .catch((err) =>
        this.logger.error(`Failed to queue welcome email: ${err.message}`),
      );

    return this.generateAuthResponse(user);
  }

  // ─── Login (email/password) ────────────────────────────────
  async login(
    loginDto: LoginDto,
    ip?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    // Check for account lockout before querying user
    await this.checkLoginAttempts(loginDto.email);

    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.password) {
      await this.recordFailedLogin(loginDto.email);
      await this.auditLog({
        email: loginDto.email,
        action: 'LOGIN',
        success: false,
        ip,
        userAgent,
        metadata: { reason: 'user_not_found' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      await this.recordFailedLogin(loginDto.email);
      await this.auditLog({
        email: loginDto.email,
        userId: user.id,
        action: 'LOGIN',
        success: false,
        ip,
        userAgent,
        metadata: { reason: 'invalid_password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on successful login
    await this.clearLoginAttempts(loginDto.email);

    this.logger.log(`User logged in: ${user.email}`);
    await this.auditLog({
      email: user.email,
      userId: user.id,
      action: 'LOGIN',
      success: true,
      ip,
      userAgent,
    });

    return this.generateAuthResponse(user);
  }

  // ─── OTP Login: Request ────────────────────────────────────
  async requestOtpLogin(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal whether the email exists — return neutral message
      return {
        success: true,
        message:
          'If an account exists with this email, a verification code has been sent.',
      };
    }

    const result = await this.otpService.generateOtp(
      email,
      OtpChannel.EMAIL,
      OtpPurpose.LOGIN,
    );

    return {
      success: result.success,
      message: result.success
        ? 'Verification code sent to your email.'
        : result.message,
      expiresInSeconds: result.expiresInSeconds,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  // ─── OTP Login: Verify ─────────────────────────────────────
  async verifyOtpLogin(email: string, otp: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const result = await this.otpService.verifyOtp(
      email,
      otp,
      OtpChannel.EMAIL,
      OtpPurpose.LOGIN,
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    this.logger.log(`User logged in via OTP: ${user.email}`);

    return this.generateAuthResponse(user);
  }

  // ─── Multi-Channel OTP Login: Request ──────────────────────
  async requestOtpMultiChannel(
    identifier: string,
    channel: 'email' | 'sms' = 'email',
  ) {
    const otpChannel = channel === 'sms' ? OtpChannel.SMS : OtpChannel.EMAIL;

    // For email, find user by email; for SMS, find by phone
    const user =
      channel === 'email'
        ? await this.usersService.findByEmail(identifier)
        : await this.usersService.findByPhone(identifier);

    if (!user) {
      // Don't reveal whether the identifier exists — return neutral message
      return {
        success: true,
        message: `If an account exists with this ${channel === 'email' ? 'email' : 'phone number'}, a verification code has been sent.`,
      };
    }

    const result = await this.otpService.generateOtp(
      identifier,
      otpChannel,
      OtpPurpose.LOGIN,
    );

    // Get cooldown status for resend timing
    const status = await this.otpService.getOtpStatus(
      identifier,
      otpChannel,
      OtpPurpose.LOGIN,
    );

    return {
      success: result.success,
      message: result.success
        ? `Verification code sent to your ${channel === 'email' ? 'email' : 'phone'}.`
        : result.message,
      expiresInSeconds: result.expiresInSeconds,
      retryAfterSeconds: result.retryAfterSeconds,
      resendAfterSeconds: status.resendAfterSeconds,
    };
  }

  // ─── Multi-Channel OTP Login: Verify ───────────────────────
  async verifyOtpMultiChannel(
    identifier: string,
    otp: string,
    channel: 'email' | 'sms' = 'email',
    rememberDevice: boolean = false,
    res?: Response,
  ): Promise<AuthResponse> {
    const otpChannel = channel === 'sms' ? OtpChannel.SMS : OtpChannel.EMAIL;

    // Find user by identifier
    const user =
      channel === 'email'
        ? await this.usersService.findByEmail(identifier)
        : await this.usersService.findByPhone(identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const result = await this.otpService.verifyOtp(
      identifier,
      otp,
      otpChannel,
      OtpPurpose.LOGIN,
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    this.logger.log(`User logged in via ${channel} OTP: ${user.email}`);

    // Handle "Remember This Device" feature
    if (rememberDevice && res) {
      const deviceToken = randomBytes(32).toString('hex');
      const deviceKey = `device:${user.id}:${deviceToken}`;

      // Store device token in Redis
      await this.redis.set(
        deviceKey,
        JSON.stringify({
          userId: user.id,
          channel,
          createdAt: new Date().toISOString(),
          userAgent: 'unknown', // Would be extracted from request headers in production
        }),
        'EX',
        this.DEVICE_TOKEN_EXPIRY,
      );

      // Set secure cookie
      res.cookie('device_token', deviceToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'lax',
        maxAge: this.DEVICE_TOKEN_EXPIRY * 1000, // 30 days in ms
        path: '/',
      });

      this.logger.log(`Device remembered for user: ${user.email}`);
    }

    return this.generateAuthResponse(user);
  }

  // ─── Check Trusted Device ──────────────────────────────────
  async checkTrustedDevice(
    userId: string,
    deviceToken: string,
  ): Promise<boolean> {
    if (!deviceToken) return false;

    const deviceKey = `device:${userId}:${deviceToken}`;
    const exists = await this.redis.exists(deviceKey);
    return exists === 1;
  }

  // ─── Revoke Device Token ───────────────────────────────────
  async revokeDeviceToken(userId: string, deviceToken: string): Promise<void> {
    const deviceKey = `device:${userId}:${deviceToken}`;
    await this.redis.del(deviceKey);
    this.logger.log(`Device token revoked for user: ${userId}`);
  }

  // ─── Password Reset: Request ───────────────────────────────
  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // Don't reveal whether the email exists
      return {
        success: true,
        message:
          'If an account exists with this email, a password-reset code has been sent.',
      };
    }

    const result = await this.otpService.generateOtp(
      email,
      OtpChannel.EMAIL,
      OtpPurpose.PASSWORD_RESET,
    );

    return {
      success: result.success,
      message: result.success
        ? 'Password reset code sent to your email.'
        : result.message,
      expiresInSeconds: result.expiresInSeconds,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }

  // ─── Password Reset: Verify & Reset ────────────────────────
  async resetPassword(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new BadRequestException('Invalid request');
    }

    // Validate password strength before verifying the OTP to give early feedback
    this.validatePasswordStrength(newPassword);

    // Verify OTP
    const result = await this.otpService.verifyOtp(
      email,
      otp,
      OtpChannel.EMAIL,
      OtpPurpose.PASSWORD_RESET,
    );

    if (!result.success) {
      throw new BadRequestException(result.message);
    }

    // Hash & update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(user.id, {
      password: hashedPassword,
    });

    this.logger.log(`Password reset completed for: ${user.email}`);

    // Send confirmation notification (non-blocking)
    this.emailService
      .sendNotificationEmail(
        user.email,
        user.name || 'User',
        'Password Changed Successfully',
        'Your password has been changed. If you did not make this change, please contact support immediately.',
      )
      .catch((err) =>
        this.logger.error(
          `Failed to send password-change notification: ${err.message}`,
        ),
      );

    return {
      success: true,
      message:
        'Password has been reset successfully. You can now log in with your new password.',
    };
  }

  // ─── Google OAuth ──────────────────────────────────────────
  async googleAuth(profile: {
    email: string;
    name: string;
    picture: string;
    googleId: string;
  }): Promise<AuthResponse> {
    // Google occasionally returns a profile without an email address (e.g.
    // when the user has chosen to hide their email).  We have also encountered
    // rare occasions where the value is an object/array instead of a string.
    // Both scenarios would break the Prisma query, so validate strictly.
    const email = profile?.email;
    if (!email || typeof email !== 'string') {
      this.logger.warn(
        `googleAuth called with invalid email: ${JSON.stringify(email)}`,
      );
      throw new BadRequestException(
        'Google account did not provide a valid email',
      );
    }

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      // Create new user
      user = await this.usersService.create({
        email: profile.email,
        name: profile.name,
        image: profile.picture,
      });

      if (!user) {
        throw new Error('Failed to create user');
      }

      // Create Google account link
      await this.usersService.createAccount({
        userId: user.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: profile.googleId,
      });

      // Create subscription with free plan
      await this.usersService.createSubscription(user.id);

      this.logger.log(`New Google user registered: ${user.email}`);

      // Send welcome email (non-blocking)
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
      this.emailService
        .sendWelcomeEmail(
          user.email,
          user.name || 'there',
          `${frontendUrl}/dashboard`,
        )
        .catch((err) =>
          this.logger.error(`Failed to queue welcome email: ${err.message}`),
        );
    } else {
      // Check if Google account is linked
      const account = await this.usersService.findAccount(user.id, 'google');

      if (!account) {
        // Link Google account
        await this.usersService.createAccount({
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: profile.googleId,
        });
      }

      this.logger.log(`Google user logged in: ${user.email}`);
    }

    return this.generateAuthResponse(user);
  }

  // ─── Validate User (for passport strategy) ───────────────
  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  // ─── Validate JWT Payload ──────────────────────────────────
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  // ─── Change Password ───────────────────────────────────────
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.password) {
      throw new BadRequestException('User not found or no password set');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Reject re-use of the current password
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    // Validate complexity of the new password
    this.validatePasswordStrength(newPassword);

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await this.usersService.update(user.id, {
      password: hashedNewPassword,
    });

    this.logger.log(`Password changed for user: ${user.email}`);

    return {
      success: true,
      message: 'Password changed successfully',
    };
  }

  // ─── Verify Token ──────────────────────────────────────────
  async verifyToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.validateJwtPayload(payload);
      return user;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  // ─── JWT Generation ────────────────────────────────────────
  private generateAuthResponse(user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  }): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name || '',
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    // Generate refresh token (longer-lived, stored in Redis)
    const refreshTokenRaw = randomBytes(40).toString('hex');
    const refreshKey = `refresh:${user.id}:${refreshTokenRaw}`;
    this.redis
      .set(refreshKey, user.id, 'EX', this.REFRESH_TOKEN_EXPIRY)
      .catch((err) => this.logger.error('Failed to store refresh token', err));

    return {
      accessToken,
      refreshToken: refreshTokenRaw,
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  }

  // ─── Logout & Token Blacklisting ──────────────────────────
  async logout(
    userId: string,
    accessToken?: string,
  ): Promise<{ success: boolean }> {
    if (accessToken) {
      // Blacklist the current access token until it expires
      try {
        const decoded = this.jwtService.decode(accessToken);
        if (decoded?.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await this.redis.set(`blacklist:${accessToken}`, '1', 'EX', ttl);
          }
        }
      } catch {
        // Ignore decode errors
      }
    }
    await this.auditLog({ userId, action: 'LOGOUT', success: true });
    return { success: true };
  }

  // ─── Check if Token is Blacklisted ────────────────────────
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result !== null;
  }

  // ─── Get Recent Audit Events ───────────────────────────────
  async getAuditLog(userId: string, limit = 20): Promise<AuditEvent[]> {
    const pattern = `audit:${userId}:*`;
    const keys: string[] = [];

    // Use SCAN instead of KEYS to avoid blocking Redis in production
    let cursor = '0';
    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        200,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    if (!keys.length) return [];

    // Sort keys by embedded timestamp descending
    keys.sort((a, b) => {
      const tsA = parseInt(a.split(':').pop() || '0', 10);
      const tsB = parseInt(b.split(':').pop() || '0', 10);
      return tsB - tsA;
    });

    const topKeys = keys.slice(0, limit);
    const values = await this.redis.mget(...topKeys);
    return values
      .filter((v): v is string => v !== null)
      .map((v) => JSON.parse(v) as AuditEvent);
  }

  // ─── Refresh Token ─────────────────────────────────────────
  async refreshToken(
    userId: string,
    refreshTokenRaw: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Validate the refresh token against the Redis store before issuing a new access token
    if (refreshTokenRaw) {
      const refreshKey = `refresh:${userId}:${refreshTokenRaw}`;
      const storedUserId = await this.redis.get(refreshKey);

      if (!storedUserId || storedUserId !== userId) {
        throw new UnauthorizedException(
          'Refresh token is invalid or has expired',
        );
      }
    } else {
      throw new UnauthorizedException('Refresh token is required');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name || '',
    };

    return {
      accessToken: this.jwtService.sign(payload, {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
      }),
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    };
  }
}
