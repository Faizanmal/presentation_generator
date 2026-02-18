import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ImageAcquisitionService } from '../image-acquisition/image-acquisition.service';

const TARGET_TOPICS = [
  'business meeting',
  'office teamwork',
  'technology abstract',
  'nature landscape',
  'city architecture',
  'education learning',
  'financial chart',
  'health wellness',
  'artificial intelligence',
  'remote work',
  'creative design',
  'data analytics',
  'cloud computing',
  'cyber security',
  'innovation',
];

@Injectable()
export class StockImageAcquisitionWorker {
  private readonly logger = new Logger(StockImageAcquisitionWorker.name);
  private isProcessing = false;

  constructor(
    private readonly imageAcquisitionService: ImageAcquisitionService,
  ) {}

  /**
   * Run every 30 minutes to fetch new stock images
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleScheduledAcquisition() {
    if (this.isProcessing) {
      this.logger.warn(
        'Previous acquisition job is still running, skipping...',
      );
      return;
    }

    this.isProcessing = true;
    try {
      // Pick a random topic
      const topic =
        TARGET_TOPICS[Math.floor(Math.random() * TARGET_TOPICS.length)];
      this.logger.log(`Starting scheduled image acquisition for: "${topic}"`);

      // Fetch 3-5 images for this topic
      const count = Math.floor(Math.random() * 3) + 3;
      const images = await this.imageAcquisitionService.acquireForTopic(
        topic,
        count,
      );

      this.logger.log(
        `Successfully acquired ${images.length} images for topic: "${topic}"`,
      );

      // Log image details (or could save to a specific "Stock Library" DB table here if desired)
      images.forEach((img) =>
        this.logger.debug(`Saved image: ${img.id} (${img.source})`),
      );
    } catch (error) {
      this.logger.error('Scheduled image acquisition failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Run cleanup once a day at midnight
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.log('Running daily image cleanup...');
    // Clean up images older than 30 days (assuming we want to rotate stock or keep disk usage low)
    // Adjust days as needed for a permanent library
    const deletedCount =
      await this.imageAcquisitionService.cleanupOldImages(30);
    this.logger.log(`Cleaned up ${deletedCount} old images`);
  }
}
