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
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
