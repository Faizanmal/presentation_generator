import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * TestMail Service
 * Integration with TestMail (https://testmail.app/) for email testing
 *
 * Usage:
 * - Development: Capture all emails in TestMail instead of sending
 * - Testing: Assert that emails were sent with correct content
 * - Webhooks: Get notified when emails are delivered
 */

interface TestMailEmail {
  id: string;
  to: Array<{ address: string; name: string }>;
  from: { address: string; name: string };
  subject: string;
  html: string;
  text: string;
  timestamp: number;
}

interface TestMailResponse {
  ok: boolean;
  result?: {
    emails: TestMailEmail[];
  };
  error?: string;
}

@Injectable()
export class TestMailService {
  private readonly logger = new Logger(TestMailService.name);
  private readonly httpClient: AxiosInstance;
  private readonly apiKey: string;
  private readonly namespace: string;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('TESTMAIL_ENABLED', false);
    this.apiKey = this.configService.get<string>('TESTMAIL_API_KEY', '');
    this.namespace = this.configService.get<string>(
      'TESTMAIL_NAMESPACE',
      'presentation-designer',
    );

    this.httpClient = axios.create({
      baseURL: 'https://api.testmail.app/api',
      timeout: 10000,
    });
  }

  /**
   * Get TestMail inbox address for a given tag
   * Pattern: {namespace}.{tag}@inbox.testmail.app
   */
  getInboxAddress(tag: string = 'default'): string {
    return `${this.namespace}.${tag}@inbox.testmail.app`;
  }

  /**
   * Fetch emails from TestMail inbox
   */
  async fetchEmails(
    tag: string = 'default',
    limit: number = 50,
  ): Promise<TestMailEmail[]> {
    if (!this.enabled) {
      this.logger.warn('TestMail is not enabled');
      return [];
    }

    try {
      const response = await this.httpClient.post<TestMailResponse>('/json', {
        apikey: this.apiKey,
        namespace: this.namespace,
        tag,
        limit,
      });

      if (response.data.ok && response.data.result) {
        return response.data.result.emails;
      } else {
        this.logger.error('TestMail API error:', response.data.error);
        return [];
      }
    } catch (error) {
      this.logger.error('Error fetching TestMail emails:', error);
      return [];
    }
  }

  /**
   * Get last email sent to a specific address
   */
  async getLastEmail(tag: string = 'default'): Promise<TestMailEmail | null> {
    const emails = await this.fetchEmails(tag, 1);
    return emails.length > 0 ? emails[0] : null;
  }

  /**
   * Search for email by subject
   */
  async findEmailBySubject(
    subject: string,
    tag: string = 'default',
  ): Promise<TestMailEmail | null> {
    const emails = await this.fetchEmails(tag, 50);
    return emails.find((email) => email.subject.includes(subject)) || null;
  }

  /**
   * Search for email by sender
   */
  async findEmailBySender(
    sender: string,
    tag: string = 'default',
  ): Promise<TestMailEmail[]> {
    const emails = await this.fetchEmails(tag, 50);
    return emails.filter((email) => email.from.address === sender);
  }

  /**
   * Verify email was sent with specific content
   */
  async verifyEmailSent(
    subject: string,
    options: {
      tag?: string;
      htmlContent?: string;
      textContent?: string;
    } = {},
  ): Promise<boolean> {
    const email = await this.findEmailBySubject(
      subject,
      options.tag || 'default',
    );

    if (!email) {
      return false;
    }

    if (options.htmlContent && !email.html.includes(options.htmlContent)) {
      return false;
    }

    if (options.textContent && !email.text.includes(options.textContent)) {
      return false;
    }

    return true;
  }

  /**
   * Clear all emails in a namespace (requires TestMail API support)
   */
  clearNamespace(): boolean {
    if (!this.enabled) {
      return false;
    }

    try {
      // Note: TestMail API doesn't have a native delete endpoint
      // This is a placeholder for future enhancement
      this.logger.log('Clearing emails would require TestMail premium');
      return false;
    } catch (error) {
      this.logger.error('Error clearing TestMail namespace:', error);
      return false;
    }
  }

  /**
   * Health check for TestMail connectivity
   */
  async healthCheck(): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.httpClient.post<TestMailResponse>('/json', {
        apikey: this.apiKey,
        namespace: this.namespace,
        tag: 'health-check',
        limit: 1,
      });

      return response.data.ok;
    } catch (error) {
      this.logger.error('TestMail health check failed:', error);
      return false;
    }
  }
}
