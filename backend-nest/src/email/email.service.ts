import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface EmailJobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
}

const DEFAULT_JOB_OPTIONS: EmailJobOptions = {
  attempts: 3,
  removeOnComplete: 100, // Keep last 100 completed jobs
  removeOnFail: 200, // Keep last 200 failed jobs
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailEnabled: boolean;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.mailEnabled =
      this.configService.get<string>('MAIL_ENABLED') !== 'false' &&
      Boolean(
        this.configService.get<string>('SENDGRID_API_KEY') ||
          this.configService.get<string>('MAIL_HOST'),
      );
  }

  private async enqueue(
    name: string,
    data: unknown,
    options: EmailJobOptions & {
      backoff?: { type: string; delay: number };
    } = {},
  ): Promise<string> {
    if (!this.mailEnabled) {
      this.logger.debug(`Skipping ${name} — mail is disabled`);
      return 'skipped';
    }
    const job = await this.emailQueue.add(name, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });
    this.logger.log(`Queued ${name} job ${job.id}`);
    return job.id!;
  }

  // ─── Generic Email ─────────────────────────────────────────
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    options?: EmailJobOptions,
  ): Promise<string> {
    return this.enqueue(
      'send-email',
      { to, subject, template, context },
      {
        ...options,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  // ─── OTP Email (High Priority) ─────────────────────────────
  async sendOtpEmail(
    email: string,
    otp: string,
    expiresInMinutes: number = 5,
  ): Promise<string> {
    return this.enqueue(
      'send-otp',
      { to: email, otp, expiresInMinutes },
      {
        priority: 1,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  // ─── Welcome Email ─────────────────────────────────────────
  async sendWelcomeEmail(
    email: string,
    name: string,
    loginUrl: string,
  ): Promise<string> {
    return this.enqueue(
      'send-welcome',
      { to: email, name, loginUrl },
      {
        priority: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  // ─── Password Reset Email (High Priority) ──────────────────
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string,
    expiresInMinutes: number = 30,
  ): Promise<string> {
    return this.enqueue(
      'send-password-reset',
      { to: email, name, resetUrl, expiresInMinutes },
      {
        priority: 1,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
  }

  // ─── Email Verification ────────────────────────────────────
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ): Promise<string> {
    return this.enqueue(
      'send-verification',
      { to: email, name, verificationUrl },
      {
        priority: 2,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  // ─── General Notification ──────────────────────────────────
  async sendNotificationEmail(
    email: string,
    name: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionLabel?: string,
  ): Promise<string> {
    return this.enqueue(
      'send-notification',
      { to: email, name, title, message, actionUrl, actionLabel },
      {
        priority: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  // ─── Project Shared ────────────────────────────────────────
  async sendProjectSharedEmail(
    email: string,
    sharedBy: string,
    projectName: string,
    projectUrl: string,
    role: string,
  ): Promise<string> {
    return this.enqueue(
      'send-project-shared',
      { to: email, sharedBy, projectName, projectUrl, role },
      {
        priority: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  // ─── Team Invite ───────────────────────────────────────────
  async sendTeamInviteEmail(
    email: string,
    inviterName: string,
    teamName: string,
    inviteUrl: string,
  ): Promise<string> {
    return this.enqueue(
      'send-team-invite',
      { to: email, inviterName, teamName, inviteUrl },
      {
        priority: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
  }

  // ─── Bulk Email (Low Priority) ─────────────────────────────
  async sendBulkEmail(
    recipients: Array<{ to: string; context?: Record<string, unknown> }>,
    subject: string,
    template: string,
    baseContext?: Record<string, unknown>,
  ): Promise<string> {
    return this.enqueue(
      'send-bulk',
      { recipients, subject, template, baseContext },
      {
        priority: 10,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
  }

  // ─── Queue Health ──────────────────────────────────────────
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async getJobStatus(jobId: string) {
    const job = await this.emailQueue.getJob(jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      state: await job.getState(),
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }
}
