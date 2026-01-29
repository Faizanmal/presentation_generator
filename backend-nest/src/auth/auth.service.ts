import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
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

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new user with email/password
   */
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

    return this.generateAuthResponse(user);
  }

  /**
   * Login with email/password
   */
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

  /**
   * Handle Google OAuth login/registration
   */
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

  /**
   * Validate JWT payload and return user
   */
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Generate JWT token and auth response
   */
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

  /**
   * Refresh access token
   */
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
