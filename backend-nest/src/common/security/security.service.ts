import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

/**
 * Production-ready security service with comprehensive protection
 */
@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly rateLimits = new Map<string, RateLimitEntry>();
  private readonly auditLog: AuditLogEntry[] = [];
  private readonly maxAuditLogSize = 10000;

  // Suspicious patterns for input validation
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(-{2}|\/\*|\*\/|;--)/,
    /(\b(OR|AND)\b.*=.*)/i,
  ];

  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
  ];

  constructor(private readonly configService: ConfigService) {
    // Cleanup old rate limit entries periodically
    setInterval(() => this.cleanupRateLimits(), 60000);
  }

  // ============================================
  // INPUT VALIDATION & SANITIZATION
  // ============================================

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string | null | undefined): string | null | undefined {
    if (input === null || input === undefined) return input;
    if (input === '') return '';

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Check for SQL injection attempts
   */
  detectSQLInjection(input: string): boolean {
    if (!input) return false;

    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(input)) {
        this.logger.warn(
          `SQL injection attempt detected: ${input.substring(0, 100)}`,
        );
        return true;
      }
    }
    return false;
  }

  /**
   * Check for XSS attempts
   */
  detectXSS(input: string): boolean {
    if (!input) return false;

    for (const pattern of this.xssPatterns) {
      if (pattern.test(input)) {
        this.logger.warn(`XSS attempt detected: ${input.substring(0, 100)}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Validate and sanitize object recursively
   */
  sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    const sanitized: Record<string, unknown> = (Array.isArray(obj)
      ? []
      : {}) as unknown as Record<string, unknown>;
    const objectEntries = Object.entries(obj);

    for (const [key, value] of objectEntries) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized as T;
  }

  // ============================================
  // ENCRYPTION & HASHING
  // ============================================

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate secure hash
   */
  hash(data: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(data, actualSalt, 10000, 64, 'sha512')
      .toString('hex');
    return `${actualSalt}:${hash}`;
  }

  /**
   * Verify hash
   */
  verifyHash(data: string, hashedData: string): boolean {
    const [salt, originalHash] = hashedData.split(':');
    const [, newHash] = this.hash(data, salt).split(':');
    return crypto.timingSafeEqual(
      Buffer.from(originalHash, 'hex'),
      Buffer.from(newHash, 'hex'),
    );
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    return this.generateSecureToken(32);
  }

  // ============================================
  // RATE LIMITING
  // ============================================

  /**
   * Check if request should be rate limited
   */
  checkRateLimit(
    identifier: string,
    limit: number,
    windowSeconds: number,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(identifier);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + windowSeconds * 1000;
      this.rateLimits.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, resetAt };
    }

    if (entry.count >= limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetAt: entry.resetAt,
    };
  }

  /**
   * Get rate limit key for user action
   */
  getRateLimitKey(userId: string, action: string): string {
    return `rate:${userId}:${action}`;
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  /**
   * Log security-related action
   */
  logAudit(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const fullEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date(),
    };

    this.auditLog.push(fullEntry);

    // Trim log if too large
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog.splice(0, this.auditLog.length - this.maxAuditLogSize);
    }

    // Also log to console for production monitoring
    const level = entry.success ? 'log' : 'warn';
    this.logger[level](
      `AUDIT: ${entry.action} on ${entry.resource}${entry.resourceId ? `:${entry.resourceId}` : ''} by ${entry.userId || 'anonymous'} - ${entry.success ? 'SUCCESS' : 'FAILED'}`,
    );
  }

  /**
   * Get audit logs for a user
   */
  getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {},
  ): AuditLogEntry[] {
    let logs = [...this.auditLog];

    if (filters.userId) {
      logs = logs.filter((l) => l.userId === filters.userId);
    }
    if (filters.action) {
      logs = logs.filter((l) => l.action === filters.action);
    }
    if (filters.resource) {
      logs = logs.filter((l) => l.resource === filters.resource);
    }
    if (filters.startDate) {
      logs = logs.filter((l) => l.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      logs = logs.filter((l) => l.timestamp <= filters.endDate!);
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filters.limit) {
      logs = logs.slice(0, filters.limit);
    }

    return logs;
  }

  // ============================================
  // IP & REQUEST VALIDATION
  // ============================================

  /**
   * Validate IP address format
   */
  isValidIP(ip: string): boolean {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Check if IP is in blocklist
   */
  isBlockedIP(ip: string): boolean {
    const blocklist =
      this.configService.get<string>('IP_BLOCKLIST')?.split(',') || [];
    return blocklist.includes(ip);
  }

  /**
   * Validate origin header
   */
  isValidOrigin(origin: string): boolean {
    const allowedOrigins = [
      this.configService.get<string>('FRONTEND_URL'),
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    return allowedOrigins.some((allowed) =>
      origin?.startsWith(allowed as string),
    );
  }

  // ============================================
  // PASSWORD VALIDATION
  // ============================================

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): {
    valid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters');

    if (password.length >= 12) score += 1;

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Password must contain lowercase letters');

    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Password must contain uppercase letters');

    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Password must contain numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    else feedback.push('Password should contain special characters');

    // Check for common patterns
    const commonPatterns = ['password', '123456', 'qwerty', 'abc123'];
    if (commonPatterns.some((p) => password.toLowerCase().includes(p))) {
      score -= 2;
      feedback.push('Password contains common patterns');
    }

    return {
      valid: score >= 4 && feedback.length === 0,
      score: Math.max(0, Math.min(6, score)),
      feedback,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private getEncryptionKey(): Buffer {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key) {
      throw new Error('ENCRYPTION_KEY not configured');
    }
    // Ensure key is 32 bytes for AES-256
    return crypto.createHash('sha256').update(key).digest();
  }

  private cleanupRateLimits(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimits.entries()) {
      if (now > entry.resetAt) {
        this.rateLimits.delete(key);
      }
    }
  }
}
