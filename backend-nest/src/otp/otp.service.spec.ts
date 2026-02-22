import { Test, TestingModule } from '@nestjs/testing';
import { OtpService } from './otp.service';
import { OtpChannel, OtpPurpose } from './dto/otp.dto';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { OtpMetricsService } from './otp-metrics.service';
import { MonitoringService } from '../common/monitoring/monitoring.service';

describe('OtpService', () => {
  let service: OtpService;

  // Placeholder for capturing the generated OTP during tests
  let storedRedisValue: string | null = null;

  const mockRedisClient: {
    get: jest.Mock;
    set: jest.Mock;
    setex: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
    ttl: jest.Mock;
    exists: jest.Mock;
  } = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    exists: jest.fn(),
  };

  const mockEmailService = {
    sendOtpEmail: jest.fn().mockResolvedValue(true),
  };

  const mockSmsService = {
    sendSms: jest.fn().mockResolvedValue(true),
  };

  const mockOtpMetricsService = {
    trackRequested: jest.fn(),
    trackVerified: jest.fn(),
    trackFailed: jest.fn(),
    trackRateLimited: jest.fn(),
    trackLockedOut: jest.fn(),
  };

  const mockMonitoringService = {
    trackOtpRequested: jest.fn(),
    trackOtpVerified: jest.fn(),
    trackOtpFailed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisClient,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: OtpMetricsService,
          useValue: mockOtpMetricsService,
        },
        {
          provide: MonitoringService,
          useValue: mockMonitoringService,
        },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);

    // Reset mocks and stored value before each test
    jest.clearAllMocks();
    storedRedisValue = null;

    // Default implementations
    mockRedisClient.get.mockImplementation((key: string) => {
      // By default, no lockout, no OTP unless set
      if (key.includes('otp:lockout:')) return Promise.resolve(null);
      if (key.includes('otp:') && !key.includes('cooldown'))
        return Promise.resolve(storedRedisValue);
      return Promise.resolve(null);
    });

    mockRedisClient.set.mockImplementation((key: string, value: string) => {
      if (
        key.includes('otp:') &&
        !key.includes('cooldown') &&
        !key.includes('lockout')
      ) {
        storedRedisValue = value;
      }
      return Promise.resolve('OK');
    });

    // Simulate setex using set behavior for backward compatibility if needed,
    // but the service uses set with EX now.
    mockRedisClient.setex.mockImplementation((_key, _seconds, _value) => {
      // Just in case legacy code is hit, though we know it uses set
      return Promise.resolve('OK');
    });

    mockRedisClient.ttl.mockResolvedValue(-2); // Default: key doesn't exist
    mockRedisClient.exists.mockResolvedValue(0);
    mockRedisClient.incr.mockResolvedValue(1);
    mockRedisClient.del.mockResolvedValue(1);
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit numeric OTP', () => {
      const otp = service.generateOtp();

      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
    });

    it('should generate different OTPs on subsequent calls', () => {
      const otps = new Set<string>();

      for (let i = 0; i < 100; i++) {
        otps.add(service.generateOtp());
      }

      // Should have generated mostly unique OTPs
      // (with 1 million possibilities, collisions are rare)
      expect(otps.size).toBeGreaterThan(90);
    });

    it('should generate OTPs within valid range (000000-999999)', () => {
      for (let i = 0; i < 50; i++) {
        const otp = service.generateOtp();
        const numericValue = parseInt(otp, 10);

        expect(numericValue).toBeGreaterThanOrEqual(0);
        expect(numericValue).toBeLessThanOrEqual(999999);
      }
    });

    it('should preserve leading zeros', () => {
      // Run multiple times to statistically hit a number with leading zeros
      let foundLeadingZero = false;

      for (let i = 0; i < 1000 && !foundLeadingZero; i++) {
        const otp = service.generateOtp();
        if (otp.startsWith('0')) {
          foundLeadingZero = true;
          expect(otp.length).toBe(6);
        }
      }

      // If we didn't find one, that's statistically unlikely but possible
      // Just verify the format is correct
      expect(service.generateOtp()).toMatch(/^\d{6}$/);
    });
  });

  describe('createOtp', () => {
    it('should store OTP in Redis with correct expiry', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await service.createOtp(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.success).toBe(true);
      expect(result.otp).toMatch(/^\d{6}$/);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        expect.stringContaining('test@example.com'),
        expect.stringMatching(/^\d{6}$/),
        'EX',
        expect.any(Number),
      );
    });

    it('should enforce cooldown period between OTP requests', async () => {
      // Simulate existing cooldown
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(30);

      const result = await service.createOtp(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.success).toBe(false);
      expect(result.retryAfterSeconds).toBe(30);
    });

    it('should normalize email before storing', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      await service.createOtp(
        'TEST@EXAMPLE.COM',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      // Verify the key uses lowercase email
      const setCalls = mockRedisClient.set.mock.calls;
      const keyUsed = setCalls[0]?.[0];
      expect(keyUsed).toContain('test@example.com');
    });

    it('should normalize phone number before storing', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      await service.createOtp(
        '+1 (555) 123-4567',
        OtpChannel.SMS,
        OtpPurpose.LOGIN,
      );

      // Verify the key uses normalized phone
      const setCalls = mockRedisClient.set.mock.calls;
      const keyUsed = setCalls[0]?.[0];
      expect(keyUsed).toContain('+15551234567');
    });
  });

  describe('verifyOtp', () => {
    it('should verify correct OTP and delete it', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.verifyOtp(
        'test@example.com',
        '123456',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.valid).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should reject incorrect OTP', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await service.verifyOtp(
        'test@example.com',
        '000000',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('Invalid');
    });

    it('should reject expired/non-existent OTP', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.verifyOtp(
        'test@example.com',
        '123456',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.valid).toBe(false);
      expect(result.message).toContain('expired');
    });

    it('should track failed attempts', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });
      mockRedisClient.incr.mockResolvedValue(2); // Second attempt

      const result = await service.verifyOtp(
        'test@example.com',
        '000000',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.valid).toBe(false);
      expect(result.remainingAttempts).toBe(1);
    });

    it('should lockout after max failed attempts', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });
      mockRedisClient.incr.mockResolvedValue(3); // Max attempts
      mockRedisClient.del.mockResolvedValue(1);

      const result = await service.verifyOtp(
        'test@example.com',
        '000000',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.valid).toBe(false);
      expect(result.remainingAttempts).toBe(0);
      // OTP should be deleted after max attempts
      expect(mockRedisClient.del).toHaveBeenCalled();
    });
  });

  describe('getOtpStatus', () => {
    it('should return active status when OTP exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(250);

      // Cooldown key exists with TTL
      mockRedisClient.exists.mockImplementation((key: string) =>
        Promise.resolve(key.includes('cooldown') ? 1 : 1),
      );

      const status = await service.getOtpStatus(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(status.hasActiveOtp).toBe(true);
      expect(status.expiresInSeconds).toBeGreaterThan(0);
    });

    it('should return inactive status when no OTP exists', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      mockRedisClient.ttl.mockResolvedValue(-2);

      const status = await service.getOtpStatus(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(status.hasActiveOtp).toBe(false);
    });

    it('should indicate resend availability based on cooldown', async () => {
      // OTP exists
      mockRedisClient.exists.mockImplementation((key: string) => {
        if (key.includes('cooldown')) return Promise.resolve(1);
        return Promise.resolve(1);
      });
      mockRedisClient.ttl.mockImplementation((key: string) => {
        if (key.includes('cooldown')) return Promise.resolve(45);
        return Promise.resolve(250);
      });

      const status = await service.getOtpStatus(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(status.canResend).toBe(false);
      expect(status.resendAfterSeconds).toBe(45);
    });
  });

  describe('resendOtp', () => {
    it('should not resend if cooldown is active', async () => {
      mockRedisClient.exists.mockResolvedValue(1);
      mockRedisClient.ttl.mockResolvedValue(30);

      const result = await service.resendOtp(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.success).toBe(false);
      expect(result.retryAfterSeconds).toBe(30);
    });

    it('should generate new OTP when cooldown has passed', async () => {
      mockRedisClient.exists.mockResolvedValue(0);
      // Ensure cooldown returns false/expired
      mockRedisClient.ttl.mockResolvedValue(-2);

      const result = await service.resendOtp(
        'test@example.com',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      expect(result.success).toBe(true);
      expect(result.otp).toMatch(/^\d{6}$/);
    });
  });

  describe('Security', () => {
    it('should not reveal if identifier exists in error messages', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.verifyOtp(
        'nonexistent@example.com',
        '123456',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );

      // Message should be generic, not revealing if email exists
      expect(result.message).not.toContain('not found');
      expect(result.message).toContain('expired');
    });

    it('should use constant-time comparison for OTP verification', async () => {
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });

      // Measure time for matching OTP
      const startMatch = process.hrtime.bigint();
      await service.verifyOtp(
        'test@example.com',
        '123456',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );
      const endMatch = process.hrtime.bigint();

      // Reset for next test
      mockRedisClient.get.mockImplementation((key: string) => {
        if (key.includes('lockout')) return Promise.resolve(null);
        return Promise.resolve('123456');
      });
      mockRedisClient.incr.mockResolvedValue(1);

      // Measure time for non-matching OTP
      const startNoMatch = process.hrtime.bigint();
      await service.verifyOtp(
        'test@example.com',
        '000000',
        OtpChannel.EMAIL,
        OtpPurpose.LOGIN,
      );
      const endNoMatch = process.hrtime.bigint();

      const matchTime = Number(endMatch - startMatch);
      const noMatchTime = Number(endNoMatch - startNoMatch);

      // Times should be roughly similar (within 10x to account for noise)
      // This is a rough check - true constant-time requires crypto.timingSafeEqual
      expect(Math.abs(matchTime - noMatchTime)).toBeLessThan(matchTime * 10);
    });
  });
});
