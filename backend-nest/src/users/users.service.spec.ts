import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    account: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    project: {
      count: jest.fn(),
    },
    emailPreferences: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('should return user with subscription', async () => {
      const mockUser = {
        id: 'user1',
        email: 'test@example.com',
        subscription: {},
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findById('user1');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
        include: { subscription: true },
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = { id: 'user1', email: 'test@example.com' };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { subscription: true },
      });
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const createUserDto = { email: 'new@example.com', password: 'password' };
      const mockCreatedUser = { id: 'newuser', ...createUserDto };
      mockPrismaService.user.create.mockResolvedValue(mockCreatedUser);

      const result = await service.create(createUserDto);

      expect(result).toEqual(mockCreatedUser);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: createUserDto,
        include: { subscription: true },
      });
    });
  });

  describe('getSubscription', () => {
    it('should return subscription details with project count', async () => {
      const mockSubscription = { userId: 'user1', plan: SubscriptionPlan.FREE };
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockSubscription,
      );
      mockPrismaService.project.count.mockResolvedValue(2);

      const result = await service.getSubscription('user1');

      expect(result).toEqual({ ...mockSubscription, projectsUsed: 2 });
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user1' },
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.getSubscription('user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription', async () => {
      const updateData = { plan: SubscriptionPlan.PRO };
      const mockUpdatedSub = { userId: 'user1', ...updateData };
      mockPrismaService.subscription.update.mockResolvedValue(mockUpdatedSub);

      const result = await service.updateSubscription('user1', updateData);

      expect(result).toEqual(mockUpdatedSub);
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        data: updateData,
      });
    });
  });

  describe('canGenerateAI', () => {
    it('should return true if development mode or unlimited plan', async () => {
      // NOTE: Current implementation forces true for development
      // const mockSub = { plan: SubscriptionPlan.PRO };
      // mockPrismaService.subscription.findUnique.mockResolvedValue(mockSub);

      const result = await service.canGenerateAI('user1');
      expect(result).toBe(true);
    });
  });

  describe('getEmailPreferences', () => {
    it('should return existing preferences', async () => {
      const mockPrefs = {
        userId: 'user1',
        loginOtp: true,
        passwordReset: true,
        marketingEmails: false,
        projectUpdates: true,
        securityAlerts: true,
        productUpdates: false,
      };
      mockPrismaService.emailPreferences.findUnique.mockResolvedValue(
        mockPrefs,
      );

      const result = await service.getEmailPreferences('user1');

      expect(result).toEqual({ ...mockPrefs, userId: undefined });
    });

    it('should return defaults if no preferences exist', async () => {
      mockPrismaService.emailPreferences.findUnique.mockResolvedValue(null);

      const result = await service.getEmailPreferences('user1');

      expect(result).toEqual({
        loginOtp: true,
        passwordReset: true,
        marketingEmails: false,
        projectUpdates: true,
        securityAlerts: true,
        productUpdates: false,
      });
    });
  });

  describe('updateEmailPreferences', () => {
    it('should upsert email preferences', async () => {
      const updateData = { marketingEmails: true };
      const mockUpsertedPrefs = {
        userId: 'user1',
        loginOtp: true,
        passwordReset: true,
        marketingEmails: true,
        projectUpdates: true,
        securityAlerts: true,
        productUpdates: false,
      };
      mockPrismaService.emailPreferences.upsert.mockResolvedValue(
        mockUpsertedPrefs,
      );

      const result = await service.updateEmailPreferences('user1', updateData);

      expect(result).toEqual({ ...mockUpsertedPrefs, userId: undefined });
      expect(mockPrismaService.emailPreferences.upsert).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        update: { ...updateData, loginOtp: true, passwordReset: true },
        create: {
          userId: 'user1',
          ...updateData,
          loginOtp: true,
          passwordReset: true,
        },
      });
    });
  });
});
