import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Partial<AuthService>;

  beforeEach(async () => {
    authService = {
      googleAuth: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://example.com') },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('googleAuthCallback', () => {
    it('should throw BadRequestException if email is missing from profile', async () => {
      const req = {
        user: { name: 'Test', picture: '', googleId: 'id' },
      } as unknown as Express.Request;
      const res = { redirect: jest.fn() } as unknown as Express.Response;

      await expect(
        controller.googleAuthCallback(req, res),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should call authService.googleAuth when email present and redirect', async () => {
      const req = {
        user: {
          email: 'test@example.com',
          name: 'Test',
          picture: '',
          googleId: 'id',
        },
      } as unknown as Express.Request;
      const token = 'token123';
      (authService.googleAuth as jest.Mock).mockResolvedValue({
        accessToken: token,
      });
      const res = { redirect: jest.fn() } as unknown as Express.Response;
      const reqWithUser = req as unknown as {
        user: {
          email: string;
          name: string;
          picture: string;
          googleId: string;
        };
      };

      await controller.googleAuthCallback(req, res);

      expect(authService.googleAuth).toHaveBeenCalledWith({
        email: reqWithUser.user.email,
        name: reqWithUser.user.name,
        picture: reqWithUser.user.picture,
        googleId: reqWithUser.user.googleId,
      });
      expect(
        (res as unknown as { redirect: jest.Mock }).redirect,
      ).toHaveBeenCalledWith(expect.stringContaining(token));
    });
  });
});
