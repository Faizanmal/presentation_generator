import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface EmailProviderConfig {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  priority: number; // Lower = higher priority
  maxRetries: number;
  enabled: boolean;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  template?: string;
  context?: Record<string, unknown>;
}

interface ProviderHealth {
  name: string;
  healthy: boolean;
  lastError?: string;
  lastErrorAt?: Date;
  successCount: number;
  failureCount: number;
  lastSuccessAt?: Date;
  circuitOpen: boolean;
  circuitOpenUntil?: Date;
}

@Injectable()
export class EmailProviderService implements OnModuleInit {
  private readonly logger = new Logger(EmailProviderService.name);
  private providers: Map<
    string,
    { config: EmailProviderConfig; transporter: Transporter }
  > = new Map();
  private providerHealth: Map<string, ProviderHealth> = new Map();

  // Circuit breaker settings
  private readonly CIRCUIT_FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_RESET_TIMEOUT = 300_000; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeProviders();
  }

  private async initializeProviders() {
    const providerConfigs = this.getProviderConfigs();

    for (const config of providerConfigs) {
      if (!config.enabled) {
        this.logger.log(
          `Email provider '${config.name}' is disabled, skipping`,
        );
        continue;
      }

      try {
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth: config.auth,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateLimit: 14, // messages per second
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 30_000,
        }) as Transporter;

        // Verify connection
        try {
          await transporter.verify();
          this.logger.log(
            `✓ Email provider '${config.name}' connected successfully`,
          );
        } catch (verifyError) {
          this.logger.warn(
            `⚠ Email provider '${config.name}' failed verification: ${verifyError.message}. Will retry on first send.`,
          );
        }

        this.providers.set(config.name, { config, transporter });
        this.providerHealth.set(config.name, {
          name: config.name,
          healthy: true,
          successCount: 0,
          failureCount: 0,
          circuitOpen: false,
        });
      } catch (error) {
        this.logger.error(
          `✗ Failed to initialize email provider '${config.name}': ${error.message}`,
        );
      }
    }

    if (this.providers.size === 0) {
      this.logger.warn(
        '⚠ No email providers configured! Email sending will fail. Configure SMTP settings in .env',
      );
    } else {
      this.logger.log(
        `Initialized ${this.providers.size} email provider(s): ${[...this.providers.keys()].join(', ')}`,
      );
    }
  }

  private getProviderConfigs(): EmailProviderConfig[] {
    const configs: EmailProviderConfig[] = [];

    // Primary SMTP Provider
    const primaryHost = this.configService.get<string>('MAIL_HOST');
    if (primaryHost) {
      configs.push({
        name: 'primary',
        host: primaryHost,
        port: parseInt(this.configService.get<string>('MAIL_PORT') || '587'),
        secure: this.configService.get<string>('MAIL_SECURE') === 'true',
        auth: {
          user: this.configService.get<string>('MAIL_USER') || '',
          pass: this.configService.get<string>('MAIL_PASS') || '',
        },
        priority: 1,
        maxRetries: 3,
        enabled: this.configService.get<string>('MAIL_ENABLED') !== 'false',
      });
    }

    // SendGrid Provider
    const sendgridKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendgridKey) {
      configs.push({
        name: 'sendgrid',
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: {
          user: 'apikey',
          pass: sendgridKey,
        },
        priority: 2,
        maxRetries: 3,
        enabled: this.configService.get<string>('SENDGRID_ENABLED') !== 'false',
      });
    }

    // Mailgun Provider
    const mailgunUser = this.configService.get<string>('MAILGUN_SMTP_USER');
    const mailgunPass = this.configService.get<string>('MAILGUN_SMTP_PASS');
    if (mailgunUser && mailgunPass) {
      configs.push({
        name: 'mailgun',
        host:
          this.configService.get<string>('MAILGUN_SMTP_HOST') ||
          'smtp.mailgun.org',
        port: parseInt(
          this.configService.get<string>('MAILGUN_SMTP_PORT') || '587',
        ),
        secure: false,
        auth: {
          user: mailgunUser,
          pass: mailgunPass,
        },
        priority: 3,
        maxRetries: 3,
        enabled: this.configService.get<string>('MAILGUN_ENABLED') !== 'false',
      });
    }

    // AWS SES Provider
    const sesUser = this.configService.get<string>('SES_SMTP_USER');
    const sesPass = this.configService.get<string>('SES_SMTP_PASS');
    if (sesUser && sesPass) {
      configs.push({
        name: 'aws-ses',
        host:
          this.configService.get<string>('SES_SMTP_HOST') ||
          'email-smtp.us-east-1.amazonaws.com',
        port: parseInt(
          this.configService.get<string>('SES_SMTP_PORT') || '587',
        ),
        secure: false,
        auth: {
          user: sesUser,
          pass: sesPass,
        },
        priority: 4,
        maxRetries: 3,
        enabled: this.configService.get<string>('SES_ENABLED') !== 'false',
      });
    }

    // Brevo (Sendinblue) Provider
    const brevoUser = this.configService.get<string>('BREVO_SMTP_USER');
    const brevoPass = this.configService.get<string>('BREVO_SMTP_PASS');
    if (brevoUser && brevoPass) {
      configs.push({
        name: 'brevo',
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: {
          user: brevoUser,
          pass: brevoPass,
        },
        priority: 5,
        maxRetries: 3,
        enabled: this.configService.get<string>('BREVO_ENABLED') !== 'false',
      });
    }

    // Sort by priority
    return configs.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Send email with automatic provider fallback
   * Tries each provider in priority order, falling back on failure
   */
  async sendMail(options: SendMailOptions): Promise<{
    success: boolean;
    provider: string;
    messageId?: string;
    error?: string;
  }> {
    const from =
      options.from ||
      `"${this.configService.get('MAIL_FROM_NAME') || 'Presentation Designer'}" <${this.configService.get('MAIL_FROM') || 'noreply@example.com'}>`;

    const sortedProviders = this.getSortedHealthyProviders();

    if (sortedProviders.length === 0) {
      this.logger.error('No healthy email providers available');
      return {
        success: false,
        provider: 'none',
        error: 'No healthy email providers available',
      };
    }

    for (const [providerName, { transporter }] of sortedProviders) {
      const health = this.providerHealth.get(providerName)!;

      // Check circuit breaker
      if (health.circuitOpen) {
        if (health.circuitOpenUntil && new Date() > health.circuitOpenUntil) {
          // Half-open: try one request
          health.circuitOpen = false;
          this.logger.log(
            `Circuit breaker half-open for provider '${providerName}'`,
          );
        } else {
          continue; // Skip this provider
        }
      }

      try {
        const result = await transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        // Record success
        health.healthy = true;
        health.successCount++;
        health.lastSuccessAt = new Date();
        health.failureCount = 0; // Reset consecutive failures
        health.circuitOpen = false;

        this.logger.log(
          `✓ Email sent via '${providerName}' → ${options.to} [${options.subject}]`,
        );

        return {
          success: true,
          provider: providerName,
          messageId: result.messageId,
        };
      } catch (error) {
        health.failureCount++;
        health.lastError = error.message;
        health.lastErrorAt = new Date();

        this.logger.warn(
          `✗ Provider '${providerName}' failed: ${error.message}. Trying next provider...`,
        );

        // Check if circuit should open
        if (health.failureCount >= this.CIRCUIT_FAILURE_THRESHOLD) {
          health.circuitOpen = true;
          health.circuitOpenUntil = new Date(
            Date.now() + this.CIRCUIT_RESET_TIMEOUT,
          );
          health.healthy = false;
          this.logger.error(
            `Circuit breaker OPEN for provider '${providerName}' until ${health.circuitOpenUntil.toISOString()}`,
          );
        }
      }
    }

    // All providers failed
    this.logger.error(
      `All email providers failed for: ${options.to} [${options.subject}]`,
    );

    return {
      success: false,
      provider: 'none',
      error: 'All email providers failed',
    };
  }

  /**
   * Get sorted list of healthy providers
   */
  private getSortedHealthyProviders(): Array<
    [string, { config: EmailProviderConfig; transporter: Transporter }]
  > {
    return [...this.providers.entries()]
      .filter(([name]) => {
        const health = this.providerHealth.get(name);
        if (!health) return false;

        // Include if circuit is closed OR if circuit timeout has passed
        if (
          health.circuitOpen &&
          health.circuitOpenUntil &&
          new Date() < health.circuitOpenUntil
        ) {
          return false;
        }
        return true;
      })
      .sort(([, a], [, b]) => a.config.priority - b.config.priority);
  }

  /**
   * Get health status of all providers
   */
  getProviderHealthStatus(): ProviderHealth[] {
    return [...this.providerHealth.values()];
  }

  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(providerName: string): boolean {
    const health = this.providerHealth.get(providerName);
    if (!health) return false;

    health.circuitOpen = false;
    health.circuitOpenUntil = undefined;
    health.failureCount = 0;
    health.healthy = true;
    this.logger.log(`Circuit breaker reset for provider '${providerName}'`);
    return true;
  }

  /**
   * Get the count of active providers
   */
  get activeProviderCount(): number {
    return this.providers.size;
  }
}
