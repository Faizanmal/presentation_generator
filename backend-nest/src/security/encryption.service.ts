import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
  algorithm: string;
}

/**
 * Enterprise-grade Encryption Service
 * Provides AES-256-GCM encryption for data at rest and in transit
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly masterKey: Buffer;
  private readonly keyRotationKeys: Map<string, Buffer> = new Map();

  constructor(private readonly configService: ConfigService) {
    const encryptionKey =
      this.configService.get<string>('ENCRYPTION_MASTER_KEY') ||
      crypto.randomBytes(this.keyLength).toString('hex');

    this.masterKey = Buffer.from(encryptionKey, 'hex');

    if (this.masterKey.length !== this.keyLength) {
      throw new Error(
        `Encryption key must be ${this.keyLength} bytes (${this.keyLength * 2} hex characters)`,
      );
    }

    this.logger.log('✓ Encryption service initialized with AES-256-GCM');
  }

  /**
   * Encrypt data with AES-256-GCM
   * @param plaintext - Data to encrypt
   * @param keyId - Optional key ID for key rotation
   */
  encrypt(plaintext: string, keyId?: string): EncryptionResult {
    const key = keyId
      ? this.keyRotationKeys.get(keyId) || this.masterKey
      : this.masterKey;
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  /**
   * Decrypt AES-256-GCM encrypted data
   */
  decrypt(encryptionResult: EncryptionResult, keyId?: string): string {
    const key = keyId
      ? this.keyRotationKeys.get(keyId) || this.masterKey
      : this.masterKey;
    const iv = Buffer.from(encryptionResult.iv, 'hex');
    const tag = Buffer.from(encryptionResult.tag, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptionResult.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Encrypt data (simple format - for backward compatibility)
   */
  encryptSimple(text: string): string {
    const result = this.encrypt(text);
    return `${result.iv}:${result.tag}:${result.encrypted}`;
  }

  /**
   * Decrypt simple format
   */
  decryptSimple(encryptedText: string): string {
    const [iv, tag, encrypted] = encryptedText.split(':');
    return this.decrypt({ encrypted, iv, tag, algorithm: this.algorithm });
  }

  /**
   * End-to-End Encryption (E2EE) - Generate key pair
   */
  generateE2EEKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { publicKey, privateKey };
  }

  /**
   * Encrypt with public key (E2EE)
   */
  encryptWithPublicKey(data: string, publicKey: string): string {
    const buffer = Buffer.from(data, 'utf8');
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer,
    );
    return encrypted.toString('base64');
  }

  /**
   * Decrypt with private key (E2EE)
   */
  decryptWithPrivateKey(encryptedData: string, privateKey: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer,
    );
    return decrypted.toString('utf8');
  }

  /**
   * Hash data (one-way encryption)
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto
      .pbkdf2Sync(data, actualSalt, 100000, 64, 'sha512')
      .toString('hex');
    return { hash, salt: actualSalt };
  }

  /**
   * Verify hash
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    const { hash: newHash } = this.hash(data, salt);
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
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
   * Key rotation - Add new encryption key
   */
  addRotationKey(keyId: string, key: string): void {
    const keyBuffer = Buffer.from(key, 'hex');
    if (keyBuffer.length !== this.keyLength) {
      throw new Error('Invalid key length for rotation key');
    }
    this.keyRotationKeys.set(keyId, keyBuffer);
    this.logger.log(`✓ Added rotation key: ${keyId}`);
  }

  /**
   * Remove rotation key
   */
  removeRotationKey(keyId: string): void {
    this.keyRotationKeys.delete(keyId);
    this.logger.log(`✓ Removed rotation key: ${keyId}`);
  }

  /**
   * Encrypt field in object
   */
  encryptField<T>(obj: T, fieldPath: string): T {
    const keys = fieldPath.split('.');
    let current: unknown = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      current = (current as Record<string, unknown>)[keys[i]];
      if (!current) return obj;
    }

    const lastKey = keys[keys.length - 1];
    const value = (current as Record<string, unknown>)[lastKey];

    if (typeof value === 'string') {
      (current as Record<string, unknown>)[lastKey] = this.encryptSimple(value);
    }

    return obj;
  }

  /**
   * Decrypt field in object
   */
  decryptField<T>(obj: T, fieldPath: string): T {
    const keys = fieldPath.split('.');
    let current: unknown = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      current = (current as Record<string, unknown>)[keys[i]];
      if (!current) return obj;
    }

    const lastKey = keys[keys.length - 1];
    const value = (current as Record<string, unknown>)[lastKey];

    if (typeof value === 'string') {
      try {
        (current as Record<string, unknown>)[lastKey] =
          this.decryptSimple(value);
      } catch (error) {
        this.logger.error(`Failed to decrypt field ${fieldPath}:`, error);
      }
    }

    return obj;
  }
}
