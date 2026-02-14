import { Injectable, Logger } from '@nestjs/common';
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

  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  // ─── Generic Email ─────────────────────────────────────────
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
    options?: EmailJobOptions,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-email',
      { to, subject, template, context },
      {
        ...DEFAULT_JOB_OPTIONS,
        ...options,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log(`Queued email job ${job.id} → ${to}`);
    return job.id!;
  }

  // ─── OTP Email (High Priority) ─────────────────────────────
  async sendOtpEmail(
    email: string,
    otp: string,
    expiresInMinutes: number = 5,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-otp',
      { to: email, otp, expiresInMinutes },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 1, // Highest priority
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
    this.logger.log(`Queued OTP email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Welcome Email ─────────────────────────────────────────
  async sendWelcomeEmail(
    email: string,
    name: string,
    loginUrl: string,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-welcome',
      { to: email, name, loginUrl },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 3,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
    this.logger.log(`Queued welcome email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Password Reset Email (High Priority) ──────────────────
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string,
    expiresInMinutes: number = 30,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-password-reset',
      { to: email, name, resetUrl, expiresInMinutes },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 1,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
      },
    );
    this.logger.log(`Queued password-reset email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Email Verification ────────────────────────────────────
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationUrl: string,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-verification',
      { to: email, name, verificationUrl },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 2,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log(`Queued verification email job ${job.id} → ${email}`);
    return job.id!;
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
    const job = await this.emailQueue.add(
      'send-notification',
      { to: email, name, title, message, actionUrl, actionLabel },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
    this.logger.log(`Queued notification email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Project Shared ────────────────────────────────────────
  async sendProjectSharedEmail(
    email: string,
    sharedBy: string,
    projectName: string,
    projectUrl: string,
    role: string,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-project-shared',
      { to: email, sharedBy, projectName, projectUrl, role },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log(`Queued project-shared email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Team Invite ───────────────────────────────────────────
  async sendTeamInviteEmail(
    email: string,
    inviterName: string,
    teamName: string,
    inviteUrl: string,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-team-invite',
      { to: email, inviterName, teamName, inviteUrl },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log(`Queued team-invite email job ${job.id} → ${email}`);
    return job.id!;
  }

  // ─── Bulk Email (Low Priority) ─────────────────────────────
  async sendBulkEmail(
    recipients: Array<{ to: string; context?: Record<string, unknown> }>,
    subject: string,
    template: string,
    baseContext?: Record<string, unknown>,
  ): Promise<string> {
    const job = await this.emailQueue.add(
      'send-bulk',
      { recipients, subject, template, baseContext },
      {
        ...DEFAULT_JOB_OPTIONS,
        priority: 10, // Lowest priority
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );
    this.logger.log(
      `Queued bulk email job ${job.id} → ${recipients.length} recipients`,
    );
    return job.id!;
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
