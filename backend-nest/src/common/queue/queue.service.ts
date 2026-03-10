import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';

export interface QueueJob<T = unknown> {
  id?: string;
  data: T;
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: {
    type: 'exponential' | 'fixed';
    delay: number;
  };
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface JobProgress {
  percentage: number;
  message?: string;
  data?: unknown;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<string, Queue> = new Map();
  private readonly workers: Map<string, Worker> = new Map();
  private readonly queueEvents: Map<string, QueueEvents> = new Map();
  private redisConnection: Redis | null = null; // initialized in onModuleInit
  private readonly queueEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.queueEnabled = this.configService.get<boolean>('QUEUE_ENABLED', true);
  }

  onModuleInit(): void {
    if (!this.queueEnabled) {
      this.logger.log('Queue Service is DISABLED');
      return;
    }

    const redisUrl = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );

    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    this.logger.log('Queue Service initialized');
  }

  async onModuleDestroy() {
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }

    // Close all queue events
    for (const qe of this.queueEvents.values()) {
      await qe.close();
    }

    // Close all queues
    for (const queue of this.queues.values()) {
      await queue.close();
    }

    if (this.redisConnection) {
      await this.redisConnection.quit();
    }

    this.logger.log('Queue Service destroyed');
  }

  /**
   * Create or get a queue
   */
  getQueue(name: string): Queue {
    if (!this.queues.has(name)) {
      const queue = new Queue(name, {
        connection: this
          .redisConnection as unknown as import('bullmq').ConnectionOptions,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep max 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        },
      });

      this.queues.set(name, queue);
      this.logger.log(`Queue created: ${name}`);
    }

    return this.queues.get(name)!;
  }

  /**
   * Add a job to a queue
   */
  async addJob<T = unknown>(
    queueName: string,
    jobName: string,
    data: T,
    options: Partial<QueueJob> = {},
  ): Promise<string> {
    const queue = this.getQueue(queueName);

    const job = await queue.add(jobName, data, {
      priority: options.priority,
      delay: options.delay,
      attempts: options.attempts || 3,
      backoff: options.backoff,
      jobId: options.id,
    });

    this.logger.debug(`Job added to queue ${queueName}: ${job.id}`);
    return job.id!;
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulk<T = unknown>(
    queueName: string,
    jobs: Array<{ name: string; data: T; options?: Partial<QueueJob> }>,
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);

    const bulkJobs = jobs.map((job) => ({
      name: job.name,
      data: job.data,
      opts: {
        priority: job.options?.priority,
        delay: job.options?.delay,
        attempts: job.options?.attempts || 3,
        backoff: job.options?.backoff,
        jobId: job.options?.id,
      },
    }));

    const addedJobs = await queue.addBulk(bulkJobs);
    this.logger.debug(`${addedJobs.length} jobs added to queue ${queueName}`);

    return addedJobs.map((j) => j.id!);
  }

  /**
   * Register a worker for a queue
   */
  registerWorker<T = unknown>(
    queueName: string,
    processor: (job: Job<T>) => Promise<unknown>,
    options: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    } = {},
  ): Worker {
    if (this.workers.has(queueName)) {
      this.logger.warn(`Worker already exists for queue: ${queueName}`);
      return this.workers.get(queueName)!;
    }

    const worker = new Worker(queueName, processor, {
      connection: this
        .redisConnection as unknown as import('bullmq').ConnectionOptions,
      concurrency: options.concurrency || 5,
      limiter: options.limiter,
    });

    // Event listeners
    worker.on('completed', (job, result) => {
      this.logger.debug(
        `Job ${job.id} in queue ${queueName} completed with result: ${JSON.stringify(result)}`,
      );
    });

    worker.on('failed', (job, err) => {
      this.logger.error(
        `Job ${job?.id} in queue ${queueName} failed: ${err.message}`,
        err.stack,
      );
    });

    worker.on('progress', (job, progress) => {
      this.logger.debug(
        `Job ${job.id} in queue ${queueName} progress: ${JSON.stringify(progress)}`,
      );
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker registered for queue: ${queueName}`);

    return worker;
  }

  /**
   * Get job by ID
   */
  async getJob<T = unknown>(
    queueName: string,
    jobId: string,
  ): Promise<Job<T> | undefined> {
    const queue = this.getQueue(queueName);
    return await queue.getJob(jobId);
  }

  /**
   * Get job state
   */
  async getJobState(
    queueName: string,
    jobId: string,
  ): Promise<
    'completed' | 'failed' | 'delayed' | 'active' | 'waiting' | 'unknown'
  > {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return 'unknown';
    }
    const state = (await job.getState()) as
      | 'completed'
      | 'failed'
      | 'active'
      | 'delayed'
      | 'waiting'
      | 'unknown';
    return state;
  }

  /**
   * Get job progress
   */
  async getJobProgress(
    queueName: string,
    jobId: string,
  ): Promise<JobProgress | null> {
    const job = await this.getJob(queueName, jobId);
    if (!job) {
      return null;
    }

    const progress = job.progress;
    if (typeof progress === 'number') {
      return { percentage: progress };
    } else if (typeof progress === 'object') {
      return progress as JobProgress;
    }

    return null;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    job: Job,
    progress: number | JobProgress,
  ): Promise<void> {
    await job.updateProgress(progress);
  }

  /**
   * Remove a job
   */
  async removeJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.remove();
      this.logger.debug(`Job ${jobId} removed from queue ${queueName}`);
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<void> {
    const job = await this.getJob(queueName, jobId);
    if (job) {
      await job.retry();
      this.logger.debug(`Job ${jobId} retried in queue ${queueName}`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<QueueStats> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed, paused] =
      await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

    return { waiting, active, completed, failed, delayed, paused };
  }

  /**
   * Get all queue stats
   */
  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const stats: Record<string, QueueStats> = {};

    for (const [name] of this.queues) {
      stats[name] = await this.getQueueStats(name);
    }

    return stats;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    this.logger.log(`Queue paused: ${queueName}`);
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    this.logger.log(`Queue resumed: ${queueName}`);
  }

  /**
   * Clear all jobs from a queue
   */
  async clearQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.obliterate({ force: true });
    this.logger.log(`Queue cleared: ${queueName}`);
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(queueName: string, start = 0, end = 10): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    return await queue.getFailed(start, end);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(
    queueName: string,
    start = 0,
    end = 10,
  ): Promise<Job[]> {
    const queue = this.getQueue(queueName);
    return await queue.getCompleted(start, end);
  }

  /**
   * Clean old jobs (completed/failed)
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 3600 * 1000, // 24 hours
    limit = 1000,
    type: 'completed' | 'failed' = 'completed',
  ): Promise<string[]> {
    const queue = this.getQueue(queueName);
    const cleaned = await queue.clean(grace, limit, type);
    this.logger.log(
      `Cleaned ${cleaned.length} ${type} jobs from queue ${queueName}`,
    );
    return cleaned;
  }

  /**
   * Schedule a recurring job (cron-like)
   */
  async scheduleRecurringJob<T>(
    queueName: string,
    jobName: string,
    data: T,
    cronExpression: string,
  ): Promise<void> {
    const queue = this.getQueue(queueName);

    await queue.add(jobName, data, {
      repeat: {
        pattern: cronExpression,
      },
      jobId: `recurring_${jobName}`,
    });

    this.logger.log(
      `Recurring job scheduled: ${jobName} with pattern ${cronExpression}`,
    );
  }

  /**
   * Remove recurring job
   */
  async removeRecurringJob(queueName: string, jobName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const repeatableJobs = await queue.getRepeatableJobs();

    for (const job of repeatableJobs) {
      if (job.name === jobName || job.id === `recurring_${jobName}`) {
        await queue.removeRepeatableByKey(job.key);
        this.logger.log(`Recurring job removed: ${jobName}`);
      }
    }
  }

  /**
   * Listen to queue events
   */
  onQueueEvent<T = unknown>(
    queueName: string,
    eventName: 'completed' | 'failed' | 'progress' | 'active',
    callback: (job: Job<T>, result?: unknown, error?: Error) => void,
  ): void {
    if (!this.queueEvents.has(queueName)) {
      const qe = new QueueEvents(queueName, {
        connection: this
          .redisConnection as unknown as import('bullmq').ConnectionOptions,
      });
      this.queueEvents.set(queueName, qe);
    }

    const qe = this.queueEvents.get(queueName)!;

    // event callback types are complex; use any to simplify
    qe.on(eventName, (args: unknown, _id: string) => {
      const { jobId, returnvalue, failedReason } = args as {
        jobId: string;
        returnvalue?: unknown;
        failedReason?: string;
      };
      // avoid returning a Promise from the listener
      (async () => {
        const queue = this.getQueue(queueName);
        const job = await queue.getJob(jobId);

        if (job) {
          if (eventName === 'failed') {
            callback(job, undefined, new Error(failedReason));
          } else {
            callback(job, returnvalue);
          }
        }
      })().catch((err) => {
        this.logger.error('Error processing queue event', err);
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.redisConnection) {
        this.logger.warn(
          'Redis connection not initialized during health check',
        );
        return false;
      }
      await this.redisConnection.ping();
      return true;
    } catch (error) {
      this.logger.error('Queue health check failed', error);
      return false;
    }
  }
}
