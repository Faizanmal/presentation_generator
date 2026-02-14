import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  RequestOtpLoginDto,
  VerifyOtpLoginDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  RequestOtpMultiChannelDto,
  VerifyOtpMultiChannelDto,
} from './dto/otp-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  RecaptchaGuard,
  RequireRecaptcha,
} from '../common/guards/recaptcha.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard, RecaptchaGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  Email/Password Auth
  // ═══════════════════════════════════════════════════════════

  /**
   * Register a new user with email/password
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login with email/password
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ═══════════════════════════════════════════════════════════
  //  OTP-Based Login (Passwordless)
  // ═══════════════════════════════════════════════════════════

  /**
   * Request an OTP code for passwordless login
   * POST /auth/otp/request
   */
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @RequireRecaptcha()
  async requestOtpLogin(@Body() dto: RequestOtpLoginDto) {
    return this.authService.requestOtpLogin(dto.email);
  }

  /**
   * Verify OTP and login
   * POST /auth/otp/verify
   */
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyOtpLogin(@Body() dto: VerifyOtpLoginDto) {
    return this.authService.verifyOtpLogin(dto.email, dto.otp);
  }

  /**
   * Request OTP via multiple channels (email/SMS)
   * POST /auth/otp/request-multi
   */
  @Post('otp/request-multi')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @RequireRecaptcha()
  async requestOtpMultiChannel(@Body() dto: RequestOtpMultiChannelDto) {
    return this.authService.requestOtpMultiChannel(
      dto.identifier,
      dto.channel || 'email',
    );
  }

  /**
   * Verify OTP from multiple channels and login
   * POST /auth/otp/verify-multi
   */
  @Post('otp/verify-multi')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async verifyOtpMultiChannel(
    @Body() dto: VerifyOtpMultiChannelDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyOtpMultiChannel(
      dto.identifier,
      dto.otp,
      dto.channel || 'email',
      dto.rememberDevice || false,
      res,
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Password Reset (OTP-Based)
  // ═══════════════════════════════════════════════════════════

  /**
   * Request a password reset code
   * POST /auth/password/reset-request
   */
  @Post('password/reset-request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @RequireRecaptcha()
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  /**
   * Verify OTP and reset password
   * POST /auth/password/reset
   */
  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  // ═══════════════════════════════════════════════════════════
  //  Google OAuth
  // ═══════════════════════════════════════════════════════════

  /**
   * Initiate Google OAuth flow
   */
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth() {
    // Guard redirects to Google
  }

  /**
   * Google OAuth callback
   */
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req()
    req: {
      user: { email: string; name: string; picture: string; googleId: string };
    },
    @Res() res: Response,
  ) {
    const result = await this.authService.googleAuth(req.user);

    // Redirect to frontend with token
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    res.redirect(
      `${frontendUrl}/auth/google-callback?token=${result.accessToken}`,
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  User Profile & Token Refresh
  // ═══════════════════════════════════════════════════════════

  /**
   * Get current user profile
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(
    @CurrentUser()
    user: {
      id: string;
      email: string;
      name: string;
      image: string;
    },
  ) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  }

  /**
   * Refresh access token
   */
  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  async refreshToken(@CurrentUser() user: { id: string }) {
    return this.authService.refreshToken(user.id);
  }
}
