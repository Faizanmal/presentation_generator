import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Optional } from '@nestjs/common';
import { EmailProviderService } from './email-provider.service';
import { EmailTrackingService } from './email-tracking.service';
import { MonitoringService } from '../common/monitoring/monitoring.service';
import { SendgridMailerService } from './sendgrid-mailer.service';

export interface SendEmailJobData {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
  priority?: number;
}

export interface BulkEmailJobData {
  recipients: Array<{ to: string; context?: Record<string, unknown> }>;
  subject: string;
  template: string;
  baseContext?: Record<string, unknown>;
}

@Processor('email', {
  concurrency: 5,
  limiter: {
    max: 30,
    duration: 60_000, // 30 emails per minute
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private useProviderFallback = false;

  constructor(
    private readonly mailerService: SendgridMailerService,
    @Optional() private readonly emailProvider: EmailProviderService,
    @Optional() private readonly emailTracking: EmailTrackingService,
    @Optional() private readonly monitoring: MonitoringService,
  ) {
    super();
    // Use multi-provider fallback if more than one provider is configured
    this.useProviderFallback =
      !!this.emailProvider && this.emailProvider.activeProviderCount > 0;
  }

  async process(job: Job<unknown, unknown, string>): Promise<unknown> {
    this.logger.log(
      `Processing email job ${job.id} | type: ${job.name} | attempt: ${job.attemptsMade + 1}`,
    );

    switch (job.name) {
      case 'send-email':
        return this.handleSendEmail(job as Job<SendEmailJobData>);
      case 'send-otp':
        return this.handleSendOtp(
          job as Job<{ to: string; otp: string; expiresInMinutes: number }>,
        );
      case 'send-welcome':
        return this.handleSendWelcome(
          job as Job<{ to: string; name: string; loginUrl: string }>,
        );
      case 'send-password-reset':
        return this.handleSendPasswordReset(
          job as Job<{
            to: string;
            name: string;
            resetUrl: string;
            expiresInMinutes: number;
          }>,
        );
      case 'send-verification':
        return this.handleSendVerification(
          job as Job<{ to: string; name: string; verificationUrl: string }>,
        );
      case 'send-notification':
        return this.handleSendNotification(
          job as Job<{
            to: string;
            name: string;
            title: string;
            message: string;
            actionUrl?: string;
            actionLabel?: string;
          }>,
        );
      case 'send-bulk':
        return this.handleSendBulk(job as Job<BulkEmailJobData>);
      case 'send-project-shared':
        return this.handleSendProjectShared(
          job as Job<{
            to: string;
            sharedBy: string;
            projectName: string;
            projectUrl: string;
            role: string;
          }>,
        );
      case 'send-team-invite':
        return this.handleSendTeamInvite(
          job as Job<{
            to: string;
            inviterName: string;
            teamName: string;
            inviteUrl: string;
          }>,
        );
      default:
        this.logger.warn(`Unknown email job name: ${job.name}`);
    }
  }

  // ─── Single Email ──────────────────────────────────────────
  private async handleSendEmail(job: Job<SendEmailJobData>) {
    const { to, subject, template, context } = job.data;
    await this.dispatchMail(to, subject, template, context, job);
    return { sent: true, to };
  }

  // ─── OTP Email ─────────────────────────────────────────────
  private async handleSendOtp(
    job: Job<{ to: string; otp: string; expiresInMinutes: number }>,
  ) {
    const { to, otp, expiresInMinutes } = job.data;
    await this.dispatchMail(
      to,
      'Your Verification Code',
      'otp',
      {
        otp,
        expiresInMinutes,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Welcome Email ─────────────────────────────────────────
  private async handleSendWelcome(
    job: Job<{ to: string; name: string; loginUrl: string }>,
  ) {
    const { to, name, loginUrl } = job.data;
    await this.dispatchMail(
      to,
      'Welcome to Presentation Designer!',
      'welcome',
      {
        name,
        loginUrl,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Password Reset Email ──────────────────────────────────
  private async handleSendPasswordReset(
    job: Job<{
      to: string;
      name: string;
      resetUrl: string;
      expiresInMinutes: number;
    }>,
  ) {
    const { to, name, resetUrl, expiresInMinutes } = job.data;
    await this.dispatchMail(
      to,
      'Reset Your Password',
      'password-reset',
      {
        name,
        resetUrl,
        expiresInMinutes,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Email Verification ────────────────────────────────────
  private async handleSendVerification(
    job: Job<{ to: string; name: string; verificationUrl: string }>,
  ) {
    const { to, name, verificationUrl } = job.data;
    await this.dispatchMail(
      to,
      'Verify Your Email Address',
      'email-verification',
      {
        name,
        verificationUrl,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Generic Notification ──────────────────────────────────
  private async handleSendNotification(
    job: Job<{
      to: string;
      name: string;
      title: string;
      message: string;
      actionUrl?: string;
      actionLabel?: string;
    }>,
  ) {
    const { to, name, title, message, actionUrl, actionLabel } = job.data;
    await this.dispatchMail(
      to,
      title,
      'notification',
      {
        name,
        title,
        message,
        actionUrl,
        actionLabel,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Project Shared ────────────────────────────────────────
  private async handleSendProjectShared(
    job: Job<{
      to: string;
      sharedBy: string;
      projectName: string;
      projectUrl: string;
      role: string;
    }>,
  ) {
    const { to, sharedBy, projectName, projectUrl, role } = job.data;
    await this.dispatchMail(
      to,
      `${sharedBy} shared a presentation with you`,
      'project-shared',
      {
        sharedBy,
        projectName,
        projectUrl,
        role,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Team Invite ───────────────────────────────────────────
  private async handleSendTeamInvite(
    job: Job<{
      to: string;
      inviterName: string;
      teamName: string;
      inviteUrl: string;
    }>,
  ) {
    const { to, inviterName, teamName, inviteUrl } = job.data;
    await this.dispatchMail(
      to,
      `${inviterName} invited you to join ${teamName}`,
      'team-invite',
      {
        inviterName,
        teamName,
        inviteUrl,
        year: new Date().getFullYear(),
      },
      job,
    );
    return { sent: true, to };
  }

  // ─── Bulk Email ────────────────────────────────────────────
  private async handleSendBulk(job: Job<BulkEmailJobData>) {
    const { recipients, subject, template, baseContext } = job.data;
    const results: Array<{ to: string; success: boolean; error?: string }> = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        await this.dispatchMail(
          recipient.to,
          subject,
          template,
          {
            ...baseContext,
            ...recipient.context,
            year: new Date().getFullYear(),
          },
          job,
        );
        results.push({ to: recipient.to, success: true });
      } catch (error) {
        results.push({
          to: recipient.to,
          success: false,
          error: error.message,
        });
      }

      // Update progress
      await job.updateProgress(Math.round(((i + 1) / recipients.length) * 100));
    }

    return { total: recipients.length, results };
  }

  // ─── Core Dispatch (with multi-provider fallback) ──────────
  private async dispatchMail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    job?: Job,
  ): Promise<void> {
    const jobId = job?.id || 'unknown';
    const jobName = job?.name || 'send-email';

    try {
      // Try primary mailer service first
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context,
      });

      this.logger.log(`✓ Email sent via primary → ${to} [${subject}]`);

      // Track successful delivery
      this.trackEmailSent(jobId, to, subject, jobName, 'primary');
    } catch (primaryError) {
      this.logger.warn(
        `✗ Primary mailer failed → ${to} [${subject}]: ${primaryError.message}`,
      );

      // Fallback to multi-provider service
      if (this.useProviderFallback) {
        this.logger.log(`Attempting fallback providers for → ${to}`);

        // Render template manually for fallback providers
        const html = await this.renderTemplate(template, context);

        const result = await this.emailProvider.sendMail({
          to,
          subject,
          html,
          text: this.stripHtml(html),
        });

        if (result.success) {
          this.logger.log(
            `✓ Email sent via fallback '${result.provider}' → ${to}`,
          );
          this.trackEmailSent(jobId, to, subject, jobName, result.provider);
          return;
        }

        // All providers failed
        this.trackEmailFailed(
          jobId,
          to,
          subject,
          jobName,
          'all-providers',
          result.error || 'All providers failed',
        );
        throw new Error(`All email providers failed: ${result.error}`, {
          cause: new Error(result.error || 'Unknown error'),
        });
      }

      // No fallback available, track failure and rethrow
      this.trackEmailFailed(
        jobId,
        to,
        subject,
        jobName,
        'primary',
        primaryError.message,
      );
      throw primaryError;
    }
  }

  // ─── Template Rendering (for fallback providers) ───────────
  private async renderTemplate(
    template: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    try {
      // Use Handlebars to render the template with context
      const Handlebars = await import('handlebars');
      const { promises: fsPromises } = await import('fs');
      const { join } = await import('path');

      const templatePath = join(__dirname, 'templates', `${template}.hbs`);
      const templateContent = await fsPromises.readFile(templatePath, 'utf-8');
      const compiled = Handlebars.compile(templateContent);
      return compiled(context);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown render error';
      this.logger.warn(`Failed to render template '${template}': ${message}`);

      const ctx = context;
      const title =
        (typeof ctx.title === 'string' && ctx.title) ||
        (typeof ctx.subject === 'string' && ctx.subject) ||
        'Notification';
      const body =
        (typeof ctx.message === 'string' && ctx.message) ||
        (typeof ctx.otp === 'string' && ctx.otp) ||
        '';

      // Fallback: create a simple HTML email
      return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>${title}</h2>
          <p>${body}</p>
        </div>
      `;
    }
  }

  // ─── Tracking Helpers ──────────────────────────────────────
  private trackEmailSent(
    jobId: string,
    to: string,
    subject: string,
    type: string,
    provider: string,
  ): void {
    if (this.emailTracking) {
      this.emailTracking
        .trackSent(jobId, to, subject, type, provider)
        .catch((err) => this.logger.debug(`Tracking error: ${err.message}`));
    }
    if (this.monitoring) {
      this.monitoring.trackEmailSent(type, provider, to);
    }
  }

  private trackEmailFailed(
    jobId: string,
    to: string,
    subject: string,
    type: string,
    provider: string,
    error: string,
  ): void {
    if (this.emailTracking) {
      this.emailTracking
        .trackFailed(jobId, to, subject, type, provider, error)
        .catch((err) => this.logger.debug(`Tracking error: ${err.message}`));
    }
    if (this.monitoring) {
      this.monitoring.trackEmailFailed(type, provider, error);
    }
  }

  // ─── Utility ───────────────────────────────────────────────
  private stripHtml(this: void, html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── Worker Events ─────────────────────────────────────────

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} (${job.name}) completed successfully`);
    if (this.monitoring) {
      this.monitoring.trackQueueJob('email', 'completed', undefined, job.name);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
    if (this.monitoring) {
      this.monitoring.trackQueueJob('email', 'failed', undefined, job.name);
      this.monitoring.reportError(error, {
        jobId: job.id,
        jobName: job.name,
        to: job.data?.to,
      });
    }
  }

  @OnWorkerEvent('stalled')
  onStalled(jobId: string) {
    this.logger.warn(`Job ${jobId} has stalled`);
  }
}
