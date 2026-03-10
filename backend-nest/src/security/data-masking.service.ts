import { Injectable, Logger } from '@nestjs/common';

export enum MaskingType {
  FULL = 'full',
  PARTIAL = 'partial',
  EMAIL = 'email',
  PHONE = 'phone',
  CREDIT_CARD = 'credit_card',
  SSN = 'ssn',
  CUSTOM = 'custom',
}

/**
 * Data Masking Service
 * Hides sensitive data for display purposes
 */
@Injectable()
export class DataMaskingService {
  private readonly logger = new Logger(DataMaskingService.name);

  constructor() {
    this.logger.log('✓ Data masking service initialized');
  }

  /**
   * Mask data based on type
   */
  mask(value: string, type: MaskingType = MaskingType.FULL): string {
    if (!value) return value;

    switch (type) {
      case MaskingType.FULL:
        return '*'.repeat(value.length);

      case MaskingType.PARTIAL:
        return this.maskPartial(value);

      case MaskingType.EMAIL:
        return this.maskEmail(value);

      case MaskingType.PHONE:
        return this.maskPhone(value);

      case MaskingType.CREDIT_CARD:
        return this.maskCreditCard(value);

      case MaskingType.SSN:
        return this.maskSSN(value);

      default:
        return this.maskPartial(value);
    }
  }

  /**
   * Mask email: j***@e*****.com
   */
  private maskEmail(email: string): string {
    const [username, domain] = email.split('@');
    if (!username || !domain) return email;

    const maskedUsername = username.charAt(0) + '***';
    const [domainName, tld] = domain.split('.');
    const maskedDomain =
      domainName.charAt(0) + '*'.repeat(Math.max(domainName.length - 1, 3));

    return `${maskedUsername}@${maskedDomain}.${tld}`;
  }

  /**
   * Mask phone: +1 ***-***-1234
   */
  private maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(phone.length);

    const last4 = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4);

    if (phone.includes('+')) {
      return `+${masked.charAt(0)} ***-***-${last4}`;
    }

    return `***-***-${last4}`;
  }

  /**
   * Mask credit card: **** **** **** 1234
   */
  private maskCreditCard(card: string): string {
    const cleaned = card.replace(/\D/g, '');
    if (cleaned.length < 4) return '*'.repeat(card.length);

    const last4 = cleaned.slice(-4);
    return `**** **** **** ${last4}`;
  }

  /**
   * Mask SSN: ***-**-1234
   */
  private maskSSN(ssn: string): string {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length !== 9) return '*'.repeat(ssn.length);

    const last4 = cleaned.slice(-4);
    return `***-**-${last4}`;
  }

  /**
   * Mask partial: Show first and last character
   */
  private maskPartial(value: string): string {
    if (value.length <= 2) return '*'.repeat(value.length);

    const first = value.charAt(0);
    const last = value.charAt(value.length - 1);
    const middle = '*'.repeat(Math.max(value.length - 2, 1));

    return `${first}${middle}${last}`;
  }

  /**
   * Mask JSON object fields
   */
  maskObject<T extends Record<string, unknown>>(
    obj: T,
    fieldMasks: Record<string, MaskingType>,
  ): T {
    const masked = { ...obj } as Record<string, unknown>;

    for (const [field, maskType] of Object.entries(fieldMasks)) {
      const value = masked[field];
      if (typeof value === 'string') {
        masked[field] = this.mask(value, maskType);
      }
    }

    return masked as T;
  }

  /**
   * Detect sensitive data in text
   */
  detectSensitiveData(text: string): {
    emails: string[];
    phones: string[];
    creditCards: string[];
    ssns: string[];
  } {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const phoneRegex = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/g;
    const creditCardRegex = /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g;
    const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;

    return {
      emails: text.match(emailRegex) || [],
      phones: text.match(phoneRegex) || [],
      creditCards: text.match(creditCardRegex) || [],
      ssns: text.match(ssnRegex) || [],
    };
  }

  /**
   * Auto-mask detected sensitive data in text
   */
  autoMask(text: string): string {
    let masked = text;
    const detected = this.detectSensitiveData(text);

    // Mask emails
    detected.emails.forEach((email) => {
      masked = masked.replace(email, this.maskEmail(email));
    });

    // Mask phones
    detected.phones.forEach((phone) => {
      masked = masked.replace(phone, this.maskPhone(phone));
    });

    // Mask credit cards
    detected.creditCards.forEach((card) => {
      masked = masked.replace(card, this.maskCreditCard(card));
    });

    // Mask SSNs
    detected.ssns.forEach((ssn) => {
      masked = masked.replace(ssn, this.maskSSN(ssn));
    });

    return masked;
  }
}
