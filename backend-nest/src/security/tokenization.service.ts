import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import * as crypto from 'crypto';

export interface TokenMetadata {
  originalValue: string;
  tokenType: string;
  createdAt: Date;
  expiresAt?: Date;
}

/**
 * Tokenization Service
 * Replaces sensitive data with non-sensitive tokens
 * Useful for PCI-DSS compliance (credit cards), PII protection
 */
@Injectable()
export class TokenizationService {
  private readonly logger = new Logger(TokenizationService.name);
  private readonly tokenPrefix = 'tok_';
  private readonly vaultPrefix = 'vault:';

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.logger.log('✓ Tokenization service initialized');
  }

  /**
   * Tokenize sensitive data
   */
  async tokenize(
    value: string,
    tokenType: string,
    expirySeconds?: number,
  ): Promise<string> {
    // Generate secure random token
    const token = this.generateToken();

    // Store original value in vault (Redis)
    const metadata: TokenMetadata = {
      originalValue: value,
      tokenType,
      createdAt: new Date(),
      expiresAt: expirySeconds
        ? new Date(Date.now() + expirySeconds * 1000)
        : undefined,
    };

    const key = `${this.vaultPrefix}${token}`;

    if (expirySeconds) {
      await this.redis.setex(key, expirySeconds, JSON.stringify(metadata));
    } else {
      await this.redis.set(key, JSON.stringify(metadata));
    }

    this.logger.log(`Tokenized ${tokenType} data`);

    return token;
  }

  /**
   * Detokenize - Retrieve original value
   */
  async detokenize(token: string): Promise<string | null> {
    const key = `${this.vaultPrefix}${token}`;
    const data = await this.redis.get(key);

    if (!data) {
      this.logger.warn(`Token not found: ${token}`);
      return null;
    }

    try {
      const metadata: TokenMetadata = JSON.parse(data);

      // Check expiry
      if (metadata.expiresAt && new Date() > new Date(metadata.expiresAt)) {
        await this.redis.del(key);
        this.logger.warn(`Token expired: ${token}`);
        return null;
      }

      return metadata.originalValue;
    } catch (error) {
      this.logger.error(`Failed to parse token metadata: ${token}`, error);
      return null;
    }
  }

  /**
   * Generate secure token
   */
  private generateToken(): string {
    const randomBytes = crypto.randomBytes(16);
    return `${this.tokenPrefix}${randomBytes.toString('hex')}`;
  }

  /**
   * Delete token
   */
  async deleteToken(token: string): Promise<void> {
    const key = `${this.vaultPrefix}${token}`;
    await this.redis.del(key);
    this.logger.log(`Token deleted: ${token}`);
  }

  /**
   * Check if token exists and is valid
   */
  async isValidToken(token: string): Promise<boolean> {
    const key = `${this.vaultPrefix}${token}`;
    const exists = await this.redis.exists(key);

    if (!exists) {
      return false;
    }

    const data = await this.redis.get(key);
    if (!data) {
      return false;
    }

    try {
      const metadata: TokenMetadata = JSON.parse(data);

      // Check expiry
      if (metadata.expiresAt && new Date() > new Date(metadata.expiresAt)) {
        await this.redis.del(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tokenize credit card (PCI-DSS compliance)
   */
  async tokenizeCreditCard(cardNumber: string): Promise<string> {
    return this.tokenize(cardNumber, 'credit_card');
  }

  /**
   * Tokenize email
   */
  async tokenizeEmail(email: string): Promise<string> {
    return this.tokenize(email, 'email');
  }

  /**
   * Tokenize phone number
   */
  async tokenizePhone(phone: string): Promise<string> {
    return this.tokenize(phone, 'phone');
  }

  /**
   * Batch tokenize
   */
  async tokenizeBatch(values: string[], tokenType: string): Promise<string[]> {
    const tokens = await Promise.all(
      values.map((value) => this.tokenize(value, tokenType)),
    );
    return tokens;
  }

  /**
   * Batch detokenize
   */
  async detokenizeBatch(tokens: string[]): Promise<(string | null)[]> {
    const values = await Promise.all(
      tokens.map((token) => this.detokenize(token)),
    );
    return values;
  }

  /**
   * Get token metadata
   */
  async getTokenMetadata(
    token: string,
  ): Promise<Omit<TokenMetadata, 'originalValue'> | null> {
    const key = `${this.vaultPrefix}${token}`;
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      const metadata: TokenMetadata = JSON.parse(data);

      // Return metadata without original value
      return {
        tokenType: metadata.tokenType,
        createdAt: metadata.createdAt,
        expiresAt: metadata.expiresAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Rotate token (generate new token for same value)
   */
  async rotateToken(oldToken: string): Promise<string | null> {
    const originalValue = await this.detokenize(oldToken);

    if (!originalValue) {
      return null;
    }

    const metadata = await this.getTokenMetadata(oldToken);
    if (!metadata) {
      return null;
    }

    // Create new token
    const newToken = await this.tokenize(originalValue, metadata.tokenType);

    // Delete old token
    await this.deleteToken(oldToken);

    this.logger.log(`Token rotated: ${oldToken} -> ${newToken}`);

    return newToken;
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const pattern = `${this.vaultPrefix}*`;
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [newCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = newCursor;

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (!data) continue;

        try {
          const metadata: TokenMetadata = JSON.parse(data);

          if (metadata.expiresAt && new Date() > new Date(metadata.expiresAt)) {
            await this.redis.del(key);
            deletedCount++;
          }
        } catch {
          // Invalid data, delete it
          await this.redis.del(key);
          deletedCount++;
        }
      }
    } while (cursor !== '0');

    this.logger.log(`✓ Cleaned up ${deletedCount} expired tokens`);

    return deletedCount;
  }
}
