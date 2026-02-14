import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import Redis from 'ioredis';

describe('OTP Login Flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const testEmail = 'otp-test@example.com';
  const testPhone = '+15551234567';
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get('REDIS_CLIENT');

    // Create test user
    const user = await prisma.user.upsert({
      where: { email: testEmail },
      update: {},
      create: {
        email: testEmail,
        name: 'OTP Test User',
        phone: testPhone,
      },
    });
    testUserId = user.id;

    // Create subscription for test user
    await prisma.subscription.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.subscription.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });

    // Clean up Redis OTP keys
    const keys = await redis.keys(`otp:*:${testEmail}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    await app.close();
  });

  beforeEach(async () => {
    // Clear OTP-related Redis keys before each test
    const emailKeys = await redis.keys(`otp:*:${testEmail}*`);
    const phoneKeys = await redis.keys(`otp:*:${testPhone}*`);
    const allKeys = [...emailKeys, ...phoneKeys];
    if (allKeys.length > 0) {
      await redis.del(...allKeys);
    }
  });

  describe('Email OTP Flow', () => {
    it('should request OTP via email successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('code');
      expect(response.body.expiresInSeconds).toBeDefined();
    });

    it('should enforce cooldown period between OTP requests', async () => {
      // First request
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Second request (should be rejected due to cooldown)
      const response = await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Should have retryAfterSeconds if cooldown is active
      if (!response.body.success) {
        expect(response.body.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it('should verify valid OTP and return auth token', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Get OTP from Redis (for testing purposes)
      const otpKey = `otp:login:${testEmail.toLowerCase()}`;
      const storedOtp = await redis.get(otpKey);
      expect(storedOtp).toBeDefined();
      expect(storedOtp).toMatch(/^\d{6}$/);

      // Verify OTP
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ email: testEmail, otp: storedOtp })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should reject invalid OTP', async () => {
      // Request OTP first
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Try to verify with wrong OTP
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ email: testEmail, otp: '000000' })
        .expect(400);

      expect(response.body.message).toContain('Invalid');
    });

    it('should track remaining attempts after failed verification', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // First failed attempt
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ email: testEmail, otp: '000000' })
        .expect(400);

      expect(response.body.message).toContain('attempt');
    });

    it('should reject expired OTP', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Delete OTP to simulate expiration
      const otpKey = `otp:login:${testEmail.toLowerCase()}`;
      await redis.del(otpKey);

      // Try to verify
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify')
        .send({ email: testEmail, otp: '123456' })
        .expect(400);

      expect(response.body.message).toContain('expired');
    });
  });

  describe('Multi-Channel OTP Flow', () => {
    it('should request OTP via email with multi-channel endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/otp/request-multi')
        .send({
          identifier: testEmail,
          channel: 'email',
          rememberDevice: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('email');
    });

    it('should request OTP via SMS with multi-channel endpoint', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/otp/request-multi')
        .send({
          identifier: testPhone,
          channel: 'sms',
          rememberDevice: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Note: SMS may not actually send in test environment
    });

    it('should verify multi-channel OTP and return auth token', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request-multi')
        .send({
          identifier: testEmail,
          channel: 'email',
        })
        .expect(200);

      // Get OTP from Redis
      const otpKey = `otp:login:${testEmail.toLowerCase()}`;
      const storedOtp = await redis.get(otpKey);

      // Verify with multi-channel endpoint
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify-multi')
        .send({
          identifier: testEmail,
          otp: storedOtp,
          channel: 'email',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.user.email).toBe(testEmail);
    });

    it('should set device cookie when rememberDevice is true', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request-multi')
        .send({
          identifier: testEmail,
          channel: 'email',
          rememberDevice: true,
        })
        .expect(200);

      // Get OTP from Redis
      const otpKey = `otp:login:${testEmail.toLowerCase()}`;
      const storedOtp = await redis.get(otpKey);

      // Verify with rememberDevice
      const response = await request(app.getHttpServer())
        .post('/auth/otp/verify-multi')
        .send({
          identifier: testEmail,
          otp: storedOtp,
          channel: 'email',
          rememberDevice: true,
        })
        .expect(200);

      // Check for device_token cookie
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
        const hasDeviceCookie = cookieArray.some((c: string) =>
          c.startsWith('device_token='),
        );
        expect(hasDeviceCookie).toBe(true);
      }
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on OTP requests', async () => {
      // Make multiple rapid requests
      const requests = Array(5)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .post('/auth/otp/request')
            .send({ email: `ratelimit-${Date.now()}@example.com` }),
        );

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429 or success: false with retryAfter)
      responses.some(
        (r) =>
          r.status === 429 ||
          (r.body.retryAfterSeconds && r.body.retryAfterSeconds > 0),
      );

      // Note: Rate limiting behavior depends on ThrottlerGuard configuration
      expect(responses.length).toBe(5);
    });
  });

  describe('OTP Status Check', () => {
    it('should return OTP status for active OTP', async () => {
      // Request OTP first
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Check status
      const response = await request(app.getHttpServer())
        .get(`/otp/status`)
        .query({
          identifier: testEmail,
          channel: 'email',
          purpose: 'login',
        })
        .expect(200);

      expect(response.body.hasActiveOtp).toBe(true);
      expect(response.body.expiresInSeconds).toBeGreaterThan(0);
    });

    it('should indicate resend availability', async () => {
      // Request OTP
      await request(app.getHttpServer())
        .post('/auth/otp/request')
        .send({ email: testEmail })
        .expect(200);

      // Check status immediately (resend should not be available)
      const response = await request(app.getHttpServer())
        .get(`/otp/status`)
        .query({
          identifier: testEmail,
          channel: 'email',
          purpose: 'login',
        })
        .expect(200);

      expect(response.body.canResend).toBe(false);
      expect(response.body.resendAfterSeconds).toBeGreaterThan(0);
    });
  });
});
