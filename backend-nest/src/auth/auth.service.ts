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
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly DEVICE_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30 days in seconds

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // ─── Register (email/password) ─────────────────────────────
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

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
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${user.email}`);

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
    let user = await this.usersService.findByEmail(profile.email);

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

  // ─── Validate JWT ──────────────────────────────────────────
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
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

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    };
  }

  // ─── Refresh Token ─────────────────────────────────────────
  async refreshToken(userId: string): Promise<{ accessToken: string }> {
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name || '',
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
