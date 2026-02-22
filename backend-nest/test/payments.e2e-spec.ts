import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import Stripe from 'stripe';

// Mock Stripe
jest.mock('stripe');

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;
  let _testSubscriptionId: string;

  // Mock Stripe methods
  const mockStripe = {
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
    },
    customers: {
      create: jest.fn().mockResolvedValue({
        id: 'cus_test_123',
      }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
      }),
    },
  };

  beforeAll(async () => {
    // Mock Stripe constructor
    (Stripe as unknown as jest.Mock).mockImplementation(() => mockStripe);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: '@payment-test.com' } },
    });

    // Create test user
    const registerResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/register')
      .send({
        email: 'payment-user@payment-test.com',
        password: 'SecurePassword123!',
        name: 'Payment Test User',
      });

    authToken = registerResponse.body.access_token;
    testUserId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.subscription.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/payments/create-checkout-session', () => {
    it('should create a checkout session for PRO plan', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/payments/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priceId: 'price_pro_monthly',
          plan: 'PRO',
        })
        .expect(201);

      expect(response.body).toHaveProperty('sessionUrl');
      expect(response.body.sessionUrl).toContain('checkout.stripe.com');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it('should create a checkout session for ENTERPRISE plan', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/payments/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priceId: 'price_enterprise_monthly',
          plan: 'ENTERPRISE',
        })
        .expect(201);

      expect(response.body).toHaveProperty('sessionUrl');
      expect(mockStripe.checkout.sessions.create).toHaveBeenCalled();
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/payments/create-checkout-session')
        .send({
          priceId: 'price_pro_monthly',
          plan: 'PRO',
        })
        .expect(401);
    });

    it('should reject invalid plan type', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/payments/create-checkout-session')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          priceId: 'price_invalid',
          plan: 'INVALID_PLAN',
        })
        .expect(400);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should handle checkout.session.completed event', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            customer: 'cus_test_123',
            subscription: 'sub_test_123',
            metadata: {
              userId: testUserId,
              plan: 'PRO',
            },
          },
        },
      };

      await request(app.getHttpServer() as Server)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(mockEvent)
        .expect(200);

      // Verify subscription was created (if webhook handler creates it)
      // This depends on your webhook implementation
    });

    it('should handle customer.subscription.updated event', async () => {
      const mockEvent = {
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            status: 'active',
            current_period_end:
              Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            metadata: {
              userId: testUserId,
              plan: 'PRO',
            },
          },
        },
      };

      await request(app.getHttpServer() as Server)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(mockEvent)
        .expect(200);
    });

    it('should handle customer.subscription.deleted event', async () => {
      const mockEvent = {
        type: 'customer.subscription.deleted',
        data: {
          object: {
            id: 'sub_test_123',
            customer: 'cus_test_123',
            metadata: {
              userId: testUserId,
            },
          },
        },
      };

      await request(app.getHttpServer() as Server)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'test_signature')
        .send(mockEvent)
        .expect(200);
    });

    it('should reject requests without stripe signature', async () => {
      const mockEvent = {
        type: 'checkout.session.completed',
        data: { object: {} },
      };

      await request(app.getHttpServer() as Server)
        .post('/api/payments/webhook')
        .send(mockEvent)
        .expect(400);
    });
  });

  describe('GET /api/payments/subscription', () => {
    beforeEach(async () => {
      // Create a test subscription
      const subscription = await prisma.subscription.create({
        data: {
          userId: testUserId,
          stripeSubscriptionId: 'sub_test_123',
          stripePriceId: 'price_pro_monthly',
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      _testSubscriptionId = subscription.id;
    });

    it('should return user subscription', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/payments/subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('stripeSubscriptionId');
      expect(response.body.stripeSubscriptionId).toBe('sub_test_123');
      expect(response.body.status).toBe('ACTIVE');
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/payments/subscription')
        .expect(401);
    });
  });

  describe('POST /api/payments/cancel-subscription', () => {
    it('should cancel user subscription', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/payments/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('cancel');
      expect(mockStripe.subscriptions.cancel).toHaveBeenCalledWith(
        'sub_test_123',
      );
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/payments/cancel-subscription')
        .expect(401);
    });

    it('should handle user with no active subscription', async () => {
      // Delete the test subscription
      await prisma.subscription.deleteMany({ where: { userId: testUserId } });

      await request(app.getHttpServer() as Server)
        .post('/api/payments/cancel-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/payments/plans', () => {
    it('should return available subscription plans', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/payments/plans')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify plan structure
      const plan = response.body[0];
      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('name');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('features');
    });
  });

  describe('POST /api/payments/update-subscription', () => {
    it('should upgrade subscription from PRO to ENTERPRISE', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/payments/update-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newPriceId: 'price_enterprise_monthly',
          newPlan: 'ENTERPRISE',
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('updated');
    });

    it('should reject downgrade without confirmation', async () => {
      // This test depends on your business logic
      await request(app.getHttpServer() as Server)
        .post('/api/payments/update-subscription')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          newPriceId: 'price_basic_monthly',
          newPlan: 'BASIC',
        })
        .expect(400);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/payments/update-subscription')
        .send({
          newPriceId: 'price_enterprise_monthly',
          newPlan: 'ENTERPRISE',
        })
        .expect(401);
    });
  });

  describe('GET /api/payments/invoices', () => {
    it('should return user invoices', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/payments/invoices')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/payments/invoices')
        .expect(401);
    });
  });

  describe('Rate limiting', () => {
    it('should rate limit excessive checkout session requests', async () => {
      // Make multiple rapid requests
      const requests = Array(20)
        .fill(null)
        .map(() =>
          request(app.getHttpServer() as Server)
            .post('/api/payments/create-checkout-session')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              priceId: 'price_pro_monthly',
              plan: 'PRO',
            }),
        );

      const responses = await Promise.all(requests);

      // At least one should be rate limited
      const rateLimited = responses.some((res) => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });
});
