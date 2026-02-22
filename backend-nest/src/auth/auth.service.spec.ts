import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../email/email.service';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$10$hashedpassword',
    name: 'Test User',
    image: 'https://example.com/image.jpg',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePassword: jest.fn(),
    createAccount: jest.fn(),
    findAccount: jest.fn(),
    createSubscription: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockOtpService = {
    generateOtp: jest.fn(),
    verifyOtp: jest.fn(),
    getOtpStatus: jest.fn(),
  };

  const mockEmailService = {
    sendWelcomeEmail: jest.fn(),
    sendNotificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    exists: jest.fn(),
    scan: jest.fn(),
    mget: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '1h',
        BCRYPT_ROUNDS: 10,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OtpService, useValue: mockOtpService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
    });

    it('should return null when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      expect(result).toBeNull();
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        'nonexistent@example.com',
      );
    });

    it('should return null when password is incorrect', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrongpassword',
        mockUser.password,
      );
    });

    it('should return null when user has no password (OAuth user)', async () => {
      const oauthUser = { ...mockUser, password: null };
      mockUsersService.findByEmail.mockResolvedValue(oauthUser);

      const result = await service.validateUser(
        'oauth@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loginDto = {
        email: mockUser.email,
        password: 'password123',
      };

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          image: mockUser.image,
        },
      });
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(mockUser.email);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        mockUser.password,
      );
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      name: 'New User',
    };

    it('should create a new user and return access token', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$10$hashedpassword');

      const newUser = {
        id: 'new-user-123',
        email: registerDto.email,
        name: registerDto.name,
      };
      mockUsersService.create.mockResolvedValue(newUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        access_token: 'mock-jwt-token',
        user: newUser,
      });
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: '$2a$10$hashedpassword',
        name: registerDto.name,
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(mockUsersService.create).not.toHaveBeenCalled();
    });
  });

  describe('googleAuth', () => {
    const googleProfile = {
      email: 'oauth@example.com',
      name: 'OAuth User',
      picture: 'https://example.com/avatar.png',
      googleId: 'google-id-123',
    };

    it('should throw when profile has no email or invalid email value', async () => {
      await expect(
        service.googleAuth({
          ...googleProfile,
          email: '' as string,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.googleAuth({
          ...googleProfile,
          email: {} as unknown as string,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a new user when none exists and return auth response', async () => {
      const newUser = {
        id: 'new-user-1',
        email: googleProfile.email,
        name: googleProfile.name,
        image: googleProfile.picture,
      };
      mockUsersService.findByEmail.mockResolvedValue(null);
      mockUsersService.create.mockResolvedValue(newUser);
      mockUsersService.createAccount.mockResolvedValue({});
      mockUsersService.createSubscription.mockResolvedValue({});

      const response = await service.googleAuth(googleProfile);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        googleProfile.email,
      );
      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: googleProfile.email,
        name: googleProfile.name,
        image: googleProfile.picture,
      });
      expect(mockUsersService.createAccount).toHaveBeenCalledWith({
        userId: newUser.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: googleProfile.googleId,
      });
      expect(mockUsersService.createSubscription).toHaveBeenCalledWith(
        newUser.id,
      );
      expect(response).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: undefined,
        expiresIn: expect.any(Number),
        user: expect.objectContaining({ id: newUser.id }),
      });
    });

    it('should log in existing user and link account if necessary', async () => {
      const existingUser = { ...mockUser };
      mockUsersService.findByEmail.mockResolvedValue(existingUser);
      mockUsersService.findAccount.mockResolvedValue(null);
      mockUsersService.createAccount.mockResolvedValue({});

      const response = await service.googleAuth(googleProfile);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
        googleProfile.email,
      );
      expect(mockUsersService.findAccount).toHaveBeenCalledWith(
        existingUser.id,
        'google',
      );
      expect(mockUsersService.createAccount).toHaveBeenCalledWith({
        userId: existingUser.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: googleProfile.googleId,
      });
      expect(response).toEqual({
        accessToken: 'mock-jwt-token',
        refreshToken: undefined,
        expiresIn: expect.any(Number),
        user: expect.objectContaining({ id: existingUser.id }),
      });
    });

    it('should not create account link when one already exists', async () => {
      const existingUser = { ...mockUser };
      mockUsersService.findByEmail.mockResolvedValue(existingUser);
      mockUsersService.findAccount.mockResolvedValue({ provider: 'google' });

      const response = await service.googleAuth(googleProfile);

      expect(mockUsersService.createAccount).not.toHaveBeenCalled();
      expect(response.user.id).toEqual(existingUser.id);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const oldPassword = 'OldPassword123!';
    const newPassword = 'NewPassword456!';

    it('should change password when old password is correct', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2a$10$newhashedpassword');
      mockUsersService.update.mockResolvedValue(undefined);

      const result = await service.changePassword(
        userId,
        oldPassword,
        newPassword,
      );

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully',
      });
      expect(mockUsersService.findById).toHaveBeenCalledWith(userId);
      expect(bcrypt.compare).toHaveBeenCalledWith(
        oldPassword,
        mockUser.password,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(mockUsersService.update).toHaveBeenCalledWith(mockUser.id, {
        password: '$2a$10$newhashedpassword',
      });
    });

    it('should throw BadRequestException when old password is incorrect', async () => {
      mockUsersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, 'wrongpassword', newPassword),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw BadRequestException when user not found', async () => {
      mockUsersService.findById.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, oldPassword, newPassword),
      ).rejects.toThrow('User not found or no password set');
    });
  });

  describe('verifyToken', () => {
    it('should return user data when token is valid', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await service.verifyToken('valid-token');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(mockUsersService.findById).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      const payload = { sub: 'deleted-user-id', email: 'deleted@example.com' };
      mockJwtService.verify.mockReturnValue(payload);
      mockUsersService.findById.mockResolvedValue(null);

      await expect(service.verifyToken('valid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken', () => {
    it('should return new access token for valid refresh token', async () => {
      const payload = { sub: mockUser.id, email: mockUser.email };
      mockJwtService.verify.mockReturnValue(payload);
      mockRedis.get.mockResolvedValue(mockUser.id);
      const result = await service.refreshToken(
        mockUser.id,
        'valid-refresh-token',
      );

      expect(result).toEqual({
        accessToken: 'mock-jwt-token',
        expiresIn: expect.any(Number),
      });
      expect(mockRedis.get).toHaveBeenCalled();
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });
  });
});
