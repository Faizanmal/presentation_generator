import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long!',
                IP_BLOCKLIST: '192.168.1.100,10.0.0.50',
                FRONTEND_URL: 'http://localhost:3000',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SecurityService>(SecurityService);
  });

  describe('sanitizeInput', () => {
    it('should escape HTML characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = service.sanitizeInput(input);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');
    });

    it('should escape quotes', () => {
      const input = 'He said "hello" and \'goodbye\'';
      const sanitized = service.sanitizeInput(input);

      expect(sanitized).toContain('&quot;');
      expect(sanitized).toContain('&#x27;');
    });

    it('should handle null/undefined input', () => {
      expect(service.sanitizeInput(null as any)).toBeNull();
      expect(service.sanitizeInput(undefined as any)).toBeUndefined();
    });
  });

  describe('detectSQLInjection', () => {
    it('should detect SELECT statements', () => {
      expect(service.detectSQLInjection('SELECT * FROM users')).toBe(true);
    });

    it('should detect UNION injection', () => {
      expect(
        service.detectSQLInjection("' UNION SELECT * FROM passwords--"),
      ).toBe(true);
    });

    it('should detect comment injection', () => {
      expect(service.detectSQLInjection("admin'--")).toBe(true);
    });

    it('should detect OR injection', () => {
      expect(service.detectSQLInjection("' OR '1'='1")).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(service.detectSQLInjection('Hello, my name is John')).toBe(false);
    });
  });

  describe('detectXSS', () => {
    it('should detect script tags', () => {
      expect(service.detectXSS('<script>alert("xss")</script>')).toBe(true);
    });

    it('should detect javascript: URLs', () => {
      expect(service.detectXSS('javascript:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(service.detectXSS('<img onerror=alert(1)>')).toBe(true);
    });

    it('should detect iframe injection', () => {
      expect(service.detectXSS('<iframe src="evil.com">')).toBe(true);
    });

    it('should not flag normal text', () => {
      expect(service.detectXSS('Hello, this is normal text')).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize nested objects', () => {
      const input = {
        name: '<script>alert("xss")</script>',
        nested: {
          value: '<img onerror=alert(1)>',
        },
        array: ['<script>bad</script>', 'normal'],
      };

      const sanitized = service.sanitizeObject(input);

      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.nested.value).not.toContain('<img');
      expect(sanitized.array[0]).not.toContain('<script>');
      expect(sanitized.array[1]).toBe('normal');
    });
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalText = 'This is sensitive data';
      const encrypted = service.encrypt(originalText);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const text = 'Same text';
      const encrypted1 = service.encrypt(text);
      const encrypted2 = service.encrypt(text);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('hash and verifyHash', () => {
    it('should hash and verify correctly', () => {
      const data = 'password123';
      const hashed = service.hash(data);

      expect(hashed).not.toBe(data);
      expect(service.verifyHash(data, hashed)).toBe(true);
    });

    it('should reject incorrect data', () => {
      const hashed = service.hash('correct-password');
      expect(service.verifyHash('wrong-password', hashed)).toBe(false);
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of specified length', () => {
      const token = service.generateSecureToken(16);
      expect(token).toHaveLength(32); // hex encoding doubles length
    });

    it('should generate unique tokens', () => {
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result1 = service.checkRateLimit('user1', 5, 60);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(4);

      const result2 = service.checkRateLimit('user1', 5, 60);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(3);
    });

    it('should block requests exceeding limit', () => {
      for (let i = 0; i < 5; i++) {
        service.checkRateLimit('user-limit', 5, 60);
      }

      const blocked = service.checkRateLimit('user-limit', 5, 60);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      service.checkRateLimit('user-reset', 2, 1); // 1 second window
      service.checkRateLimit('user-reset', 2, 1);

      const blocked = service.checkRateLimit('user-reset', 2, 1);
      expect(blocked.allowed).toBe(false);

      // Wait for window to reset
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const allowed = service.checkRateLimit('user-reset', 2, 1);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong passwords', () => {
      const result = service.validatePasswordStrength('SecureP@ss123');

      expect(result.valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject short passwords', () => {
      const result = service.validatePasswordStrength('Short1!');

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain(
        'Password must be at least 8 characters',
      );
    });

    it('should require mixed case', () => {
      const result = service.validatePasswordStrength('alllowercase123!');

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain(
        'Password must contain uppercase letters',
      );
    });

    it('should detect common patterns', () => {
      const result = service.validatePasswordStrength('Password123!');

      expect(result.feedback).toContain('Password contains common patterns');
    });
  });

  describe('isValidIP', () => {
    it('should validate IPv4 addresses', () => {
      expect(service.isValidIP('192.168.1.1')).toBe(true);
      expect(service.isValidIP('10.0.0.1')).toBe(true);
      expect(service.isValidIP('256.1.1.1')).toBe(false);
      expect(service.isValidIP('not-an-ip')).toBe(false);
    });
  });

  describe('isBlockedIP', () => {
    it('should detect blocked IPs', () => {
      expect(service.isBlockedIP('192.168.1.100')).toBe(true);
      expect(service.isBlockedIP('10.0.0.50')).toBe(true);
      expect(service.isBlockedIP('192.168.1.1')).toBe(false);
    });
  });

  describe('isValidOrigin', () => {
    it('should validate allowed origins', () => {
      expect(service.isValidOrigin('http://localhost:3000')).toBe(true);
      expect(service.isValidOrigin('http://localhost:3000/path')).toBe(true);
      expect(service.isValidOrigin('http://evil.com')).toBe(false);
    });
  });

  describe('audit logging', () => {
    it('should log audit entries', () => {
      service.logAudit({
        userId: 'user-123',
        action: 'LOGIN',
        resource: 'auth',
        success: true,
      });

      const logs = service.getAuditLogs({ userId: 'user-123' });
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe('LOGIN');
    });

    it('should filter audit logs', () => {
      service.logAudit({
        userId: 'user-a',
        action: 'CREATE',
        resource: 'project',
        success: true,
      });

      service.logAudit({
        userId: 'user-b',
        action: 'DELETE',
        resource: 'project',
        success: false,
      });

      const userALogs = service.getAuditLogs({ userId: 'user-a' });
      expect(userALogs).toHaveLength(1);

      const createLogs = service.getAuditLogs({ action: 'CREATE' });
      expect(createLogs).toHaveLength(1);
    });
  });
});
