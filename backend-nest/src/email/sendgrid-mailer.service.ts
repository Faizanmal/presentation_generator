import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sendgrid from '@sendgrid/mail';
import { EmailTemplateCacheService } from './email-template-cache.service';

@Injectable()
export class SendgridMailerService {
  private readonly logger = new Logger(SendgridMailerService.name);
  private fromAddress: string;
  private fromName: string;
  private readonly sg: typeof sendgrid;

  constructor(
    private readonly config: ConfigService,
    private readonly templateCache: EmailTemplateCacheService,
  ) {
    // Use the typed SendGrid client directly
    this.sg = sendgrid;

    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'SENDGRID_API_KEY not configured — email sending will fail',
      );
    }

    if (this.sg && typeof this.sg.setApiKey === 'function') {
      this.sg.setApiKey(apiKey || '');
    } else {
      this.logger.warn(
        'SendGrid client does not expose setApiKey(); email may fail',
      );
    }

    this.fromAddress = this.config.get('MAIL_FROM') || 'no-reply@example.com';
    this.fromName =
      this.config.get('MAIL_FROM_NAME') || 'Presentation Designer';
  }

  /**
   * Accepts same basic shape used by the old MailerService in this repo.
   * - { to, subject, template, context } — renders template using cached Handlebars
   * - or accept html/text in the payload as passthrough
   */
  async sendMail(opts: {
    to: string | Array<string>;
    subject: string;
    template?: string;
    context?: Record<string, unknown>;
    html?: string;
    text?: string;
  }): Promise<void> {
    const { to, subject, template, context, html, text } = opts;

    let finalHtml = html || null;
    let finalText = text || null;

    if (template) {
      const rendered = this.templateCache.render(template, context || {});
      if (rendered) finalHtml = rendered;
      // crude text fallback
      if (!finalText && finalHtml) {
        finalText = finalHtml
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    }

    const msg: sendgrid.MailDataRequired = {
      to,
      from: { email: this.fromAddress, name: this.fromName },
      subject,
      html: finalHtml || undefined,
      text: finalText || undefined,
    };

    try {
      // use guarded runtime client
      if (!this.sg || typeof this.sg.send !== 'function') {
        throw new Error('SendGrid client not available');
      }

      await this.sg.send(msg);
      this.logger.log(
        `Sent email → ${Array.isArray(to) ? to.join(',') : to} [${subject}]`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`SendGrid send failed: ${message}`);
      throw err;
    }
  }
}
