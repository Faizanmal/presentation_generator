import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

jest.mock('stripe');

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockSubscription = {
    id: 'sub-123',
    userId: 'user-123',
    stripeCustomerId: 'cus_test_123',
    stripeSubscriptionId: 'sub_test_123',
    plan: 'FREE',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockStripe = {
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_test_123' }),
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
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        items: { data: [{ price: { id: 'price_test' } }] },
      }),
      update: jest.fn().mockResolvedValue({ id: 'sub_test_123' }),
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
    subscription: {
      findFirst: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string): string | undefined => {
      const config: Record<string, string> = {
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
        FRONTEND_URL: 'http://localhost:3000',
        STRIPE_PRO_PRICE_ID: 'price_pro',
        STRIPE_ENTERPRISE_PRICE_ID: 'price_enterprise',
      };
      return config[key];
    }),
  };

  const mockUsersService = {
    findById: jest.fn(),
    getSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    resetAIGenerations: jest.fn(),
  };

  beforeEach(async () => {
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

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session for PRO plan', async () => {
      mockUsersService.getSubscription.mockResolvedValue(mockSubscription);

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
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: null,
      });
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockUsersService.updateSubscription.mockResolvedValue({});

      await service.createCheckoutSession('user-123', 'pro');

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockUser.email,
          name: mockUser.name,
        }),
      );
      expect(mockUsersService.updateSubscription).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ stripeCustomerId: 'cus_test_123' }),
      );
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockUsersService.getSubscription.mockRejectedValue(
        new NotFoundException('Subscription not found'),
      );

      await expect(
        service.createCheckoutSession('nonexistent', 'pro'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when price is not configured', async () => {
      mockUsersService.getSubscription.mockResolvedValue(mockSubscription);
      const defaultImpl = mockConfigService.get.getMockImplementation();
      mockConfigService.get.mockImplementation((key: string) => {
        if (
          key === 'STRIPE_PRO_PRICE_ID' ||
          key === 'STRIPE_ENTERPRISE_PRICE_ID'
        ) {
          return undefined;
        }
        return defaultImpl ? defaultImpl(key) : undefined;
      });

      await expect(
        service.createCheckoutSession('user-123', 'pro'),
      ).rejects.toThrow(BadRequestException);

      mockConfigService.get.mockImplementation(defaultImpl);
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      mockUsersService.getSubscription.mockResolvedValue(mockSubscription);

      const result = await service.createPortalSession('user-123');

      expect(result).toHaveProperty('url');
      expect(result.url).toBe('https://billing.stripe.com/session/test');
      expect(mockStripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_test_123',
        return_url: expect.stringContaining('localhost:3000'),
      });
    });

    it('should throw BadRequestException when no Stripe customer ID', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeCustomerId: null,
      });

      await expect(service.createPortalSession('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStripeSubscription', () => {
    it('should return subscription details', async () => {
      mockUsersService.getSubscription.mockResolvedValue(mockSubscription);

      const result = await service.getStripeSubscription('user-123');

      expect(result).toEqual(expect.objectContaining({ id: 'sub_test_123' }));
      expect(mockStripe.subscriptions.retrieve).toHaveBeenCalledWith(
        'sub_test_123',
      );
    });

    it('should return null when no Stripe subscription ID', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      const result = await service.getStripeSubscription('user-123');

      expect(result).toBeNull();
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      mockUsersService.getSubscription.mockResolvedValue(mockSubscription);
      mockUsersService.updateSubscription.mockResolvedValue({});

      const result = await service.cancelSubscription('user-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test_123',
        { cancel_at_period_end: true },
      );
      expect(mockUsersService.updateSubscription).toHaveBeenCalledWith(
        'user-123',
        { cancelAtPeriodEnd: true },
      );
      expect(result.success).toBe(true);
    });

    it('should throw BadRequestException when no Stripe subscription ID', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      await expect(service.cancelSubscription('user-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a canceled subscription', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
        cancelAtPeriodEnd: true,
      });
      mockUsersService.updateSubscription.mockResolvedValue({});

      await service.resumeSubscription('user-123');

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith(
        'sub_test_123',
        { cancel_at_period_end: false },
      );
      expect(mockUsersService.updateSubscription).toHaveBeenCalledWith(
        'user-123',
        { cancelAtPeriodEnd: false },
      );
    });

    it('should throw BadRequestException when no Stripe subscription ID', async () => {
      mockUsersService.getSubscription.mockResolvedValue({
        ...mockSubscription,
        stripeSubscriptionId: null,
      });

      await expect(service.resumeSubscription('user-123')).rejects.toThrow(
        BadRequestException,
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
            metadata: { userId: 'user-123', plan: 'pro' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockUsersService.updateSubscription.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        Buffer.from('payload'),
        'signature',
        'whsec_test_123',
      );
      expect(mockUsersService.updateSubscription).toHaveBeenCalled();
    });

    it('should handle customer.subscription.updated event', async () => {
      const event = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            status: 'active',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end:
              Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            cancel_at_period_end: false,
            metadata: { userId: 'user-123' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrismaService.subscription.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockUsersService.updateSubscription.mockResolvedValue({});
      mockUsersService.resetAIGenerations.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockUsersService.updateSubscription).toHaveBeenCalled();
    });

    it('should handle customer.subscription.deleted event', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            metadata: { userId: 'user-123' },
          },
        },
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockPrismaService.subscription.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockUsersService.updateSubscription.mockResolvedValue({});

      await service.handleWebhook('signature', Buffer.from('payload'));

      expect(mockUsersService.updateSubscription).toHaveBeenCalledWith(
        mockSubscription.userId,
        expect.objectContaining({ plan: 'FREE' }),
      );
    });
  });
});
