import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');

describe('PaymentsService', () => {
  let service: PaymentsService;
  let _prisma: PrismaService;
  let _configService: ConfigService;
  let _usersService: UsersService;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    subscription: {
      id: 'sub-123',
      stripeCustomerId: 'cus_test_123',
      stripeSubscriptionId: 'sub_test_123',
      plan: 'FREE',
      status: 'ACTIVE',
    },
  };

  const mockStripe = {
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
      }),
      retrieve: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/test',
        }),
      },
    },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      }),
      cancel: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'canceled',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'sub_test_123',
        status: 'active',
      }),
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          url: 'https://billing.stripe.com/session/test',
        }),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findById: jest.fn(),
    updateSubscription: jest.fn(),
  };

  beforeEach(async () => {
    // Mock Stripe constructor
    (Stripe as unknown as jest.Mock).mockImplementation(() => mockStripe);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    _prisma = module.get<PrismaService>(PrismaService);
    _configService = module.get<ConfigService>(ConfigService);
    _usersService = module.get<UsersService>(UsersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session for PRO plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockUser.subscription,
      );

      const result = await service.createCheckoutSession('user-123', 'pro');

      expect(result).toHaveProperty('url');
      expect(result.url).toBe('https://checkout.stripe.com/test');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'subscription',
          customer: 'cus_test_123',
        }),
      );
    });

    it('should create a new Stripe customer if user has none', async () => {
      const userWithoutCustomer = {
        ...mockUser,
        subscription: { ...mockUser.subscription, stripeCustomerId: null },
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutCustomer);
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        userWithoutCustomer.subscription,
      );
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.createCheckoutSession('user-123', 'pro');

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: mockUser.email,
        name: mockUser.name,
      });
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { stripeCustomerId: 'cus_test_123' },
      });
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckoutSession('nonexistent', 'pro'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.createCheckoutSession(
          'user-123',
          'invalid_plan' as unknown as import('@prisma/client').SubscriptionPlan,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockUser.subscription,
      );

      const result = await service.createPortalSession('user-123');

      expect(result).toHaveProperty('url');
      expect(result.url).toBe('https://billing.stripe.com/session/test');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test_123',
        return_url: expect.stringContaining('localhost:3000'),
      });
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.createPortalSession('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no Stripe customer ID', async () => {
      const subWithoutCustomer = {
        ...mockUser.subscription,
        stripeCustomerId: null,
      };
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        subWithoutCustomer,
      );

      await expect(service.createPortalSession('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStripeSubscription', () => {
    it('should return subscription details', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockUser.subscription,
      );

      const result = await service.getStripeSubscription('user-123');

      expect(result).toEqual(mockUser.subscription);
      expect(mockPrismaService.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should return null when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getStripeSubscription('user-123');

      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockUser.subscription,
      );
      mockPrismaService.subscription.update.mockResolvedValue({});

      const result = await service.cancelSubscription('user-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test_123',
        {
          cancel_at_period_end: true,
        },
      );
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { cancelAtPeriodEnd: true },
      });
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.cancelSubscription('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when no Stripe subscription ID', async () => {
      const subWithoutStripe = {
        ...mockUser.subscription,
        stripeSubscriptionId: null,
      };
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        subWithoutStripe,
      );

      await expect(service.cancelSubscription('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a canceled subscription', async () => {
      const canceledSub = {
        ...mockUser.subscription,
        status: 'CANCELED',
        cancelAtPeriodEnd: true,
      };
      mockPrismaService.subscription.findUnique.mockResolvedValue(canceledSub);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.resumeSubscription('user-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test_123',
        {
          cancel_at_period_end: false,
        },
      );
      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { status: 'ACTIVE', cancelAtPeriodEnd: false },
      });
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);

      await expect(service.resumeSubscription('user-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleWebhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            subscription: 'sub_test_123',
            customer: 'cus_test_123',
            metadata: { userId: 'user-123', plan: 'PRO' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        Buffer.from('payload'),
        'signature',
        'whsec_test',
      );
      expect(mockPrismaService.subscription.update).toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated event', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            status: 'active',
            metadata: { userId: 'user-123' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrismaService.subscription.findUnique.mockResolvedValue(
        mockUser.subscription,
      );
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockPrismaService.subscription.update).toHaveBeenCalled();
    });

    it('should handle customer.subscription.deleted event', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_123',
            metadata: { userId: 'user-123' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrismaService.subscription.update.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockPrismaService.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELED' }),
        }),
      );
    });
  });
});
