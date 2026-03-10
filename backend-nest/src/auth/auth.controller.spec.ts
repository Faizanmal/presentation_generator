import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';

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
      // the controller expects an object with a `user` property matching
      // the inline type rather than a full Express.Request.  Cast to the
      // precise shape to satisfy the compiler, the test runner doesn't care.
      const req = {
        user: { name: 'Test', picture: '', googleId: 'id' },
      } as {
        user: {
          email?: string;
          name: string;
          picture: string;
          googleId: string;
        };
      };
      const res = { redirect: jest.fn() } as unknown as Response<
        unknown,
        Record<string, unknown>
      >;

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
      } as {
        user: {
          email: string;
          name: string;
          picture: string;
          googleId: string;
        };
      };
      const token = 'token123';
      (authService.googleAuth as jest.Mock).mockResolvedValue({
        accessToken: token,
      });
      const res = { redirect: jest.fn() } as unknown as Response<
        unknown,
        Record<string, unknown>
      >;
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

    it('should redirect with error query when service throws', async () => {
      const req = {
        user: {
          email: 'test@example.com',
          name: 'Test',
          picture: '',
          googleId: 'id',
        },
      } as {
        user: {
          email: string;
          name: string;
          picture: string;
          googleId: string;
        };
      };
      const res = { redirect: jest.fn() } as unknown as Response<
        unknown,
        Record<string, unknown>
      >;
      (authService.googleAuth as jest.Mock).mockRejectedValue(
        new Error('oops'),
      );

      await controller.googleAuthCallback(req, res);

      expect(
        (res as unknown as { redirect: jest.Mock }).redirect,
      ).toHaveBeenCalledWith(expect.stringContaining('error=oops'));
    });
  });
});
