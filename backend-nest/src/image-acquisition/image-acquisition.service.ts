import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as crypto from 'crypto';
import OpenAI from 'openai';

export type ImageSource = 'ai' | 'unsplash' | 'pexels' | 'pixabay' | 'url';

export interface ImageAcquisitionOptions {
  source: ImageSource;
  query?: string;
  prompt?: string;
  url?: string;
  width?: number;
  height?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  color?: string;
  count?: number;
}

export interface AcquiredImage {
  id: string;
  source: ImageSource;
  url: string;
  localPath: string;
  width: number;
  height: number;
  description?: string;
  author?: string;
  authorUrl?: string;
  license: string;
  downloadedAt: Date;
  metadata: Record<string, unknown>;
}

// Permissive Allowlist for Image Import
const ALLOWED_IMAGE_DOMAINS = [
  'unsplash.com',
  'images.unsplash.com',
  'pexels.com',
  'images.pexels.com',
  'pixabay.com',
  'wikimedia.org',
  'upload.wikimedia.org',
  'publicdomainvectors.org',
  'raw.githubusercontent.com',
  'googleusercontent.com',
  'picsum.photos',
  'fastly.picsum.photos',
];

@Injectable()
export class ImageAcquisitionService {
  private readonly logger = new Logger(ImageAcquisitionService.name);
  private readonly uploadDir: string;
  private openai: OpenAI | null = null;
  /** In-memory cache: query+source -> local file path (avoids re-downloading same image) */
  private readonly imageCache = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get('UPLOAD_DIR') || './uploads/acquired-images';
    this.ensureUploadDir();

    // Initialize OpenAI for AI image generation
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create upload directory:', error);
    }
  }

  /**
   * Acquire image from specified source with retry-on-failure
   */
  async acquireImage(options: ImageAcquisitionOptions): Promise<AcquiredImage> {
    this.logger.log(
      `Acquiring image from ${options.source}: ${options.query || options.prompt || options.url}`,
    );

    // Check cache for non-AI sources
    if (options.source !== 'ai' && options.query) {
      const cacheKey = `${options.source}:${options.query}:${options.orientation || 'any'}`;
      const cachedPath = this.imageCache.get(cacheKey);
      if (cachedPath) {
        this.logger.debug(`Cache hit for ${cacheKey}`);
        // Return a lightweight cached result
        return {
          id: this.generateId(),
          source: options.source,
          url: cachedPath,
          localPath: cachedPath,
          width: options.width || 1920,
          height: options.height || 1080,
          description: options.query,
          license: 'Cached',
          downloadedAt: new Date(),
          metadata: { cached: true },
        };
      }
    }

    const result = await this.withRetry(() => this.dispatchAcquire(options), 3);

    // Populate cache
    if (options.source !== 'ai' && options.query && result.localPath) {
      const cacheKey = `${options.source}:${options.query}:${options.orientation || 'any'}`;
      this.imageCache.set(cacheKey, result.localPath);
    }

    return result;
  }

  private async dispatchAcquire(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    switch (options.source) {
      case 'ai':
        return this.generateAIImage(options);
      case 'unsplash':
        return this.fetchFromUnsplash(options);
      case 'pexels':
        return this.fetchFromPexels(options);
      case 'pixabay':
        return this.fetchFromPixabay(options);
      case 'url':
        return this.downloadFromUrl(options);
      default:
        throw new Error(`Unsupported image source: ${(options as any).source}`);
    }
  }

  /**
   * Retry helper with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          const delayMs = 500 * Math.pow(2, attempt - 1);
          this.logger.warn(
            `Attempt ${attempt} failed, retrying in ${delayMs}ms... (${(err as Error).message})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    throw lastError;
  }

  /**
   * Acquire multiple images (batch) - runs in parallel with concurrency limit
   */
  async acquireImages(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage[]> {
    const count = options.count || 1;
    const CONCURRENCY = 3;
    const images: AcquiredImage[] = [];

    for (let i = 0; i < count; i += CONCURRENCY) {
      const batch = Array.from(
        { length: Math.min(CONCURRENCY, count - i) },
        (_, j) =>
          this.acquireImage({
            ...options,
            query: options.query ? `${options.query} ${i + j + 1}` : undefined,
          }),
      );
      const results = await Promise.allSettled(batch);
      for (const result of results) {
        if (result.status === 'fulfilled') {
          images.push(result.value);
        } else {
          this.logger.error(
            'Parallel image acquisition failed:',
            result.reason,
          );
        }
      }
    }

    return images;
  }

  /**
   * Generate image using AI (DALL-E)
   */
  private async generateAIImage(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    if (!options.prompt) {
      throw new Error('Prompt is required for AI image generation');
    }

    try {
      const size = this.determineSize(options);
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt: options.prompt,
        n: 1,
        size,
        quality: 'standard',
        response_format: 'url',
      });

      if (!response.data || !response.data[0]) {
        throw new Error('No image data returned from OpenAI');
      }

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error('No image URL returned from OpenAI');
      }

      // Download the generated image (AI images are safe to download as we own them via API terms usually)
      const localPath = await this.downloadImage(imageUrl, 'ai');

      return {
        id: this.generateId(),
        source: 'ai',
        url: imageUrl,
        localPath,
        width: parseInt(size.split('x')[0]),
        height: parseInt(size.split('x')[1]),
        description: options.prompt,
        author: 'DALL-E 3',
        authorUrl: 'https://openai.com',
        license: 'Generated by AI',
        downloadedAt: new Date(),
        metadata: {
          prompt: options.prompt,
          model: 'dall-e-3',
          revisedPrompt: response.data[0].revised_prompt || options.prompt,
        },
      };
    } catch (error) {
      this.logger.error('AI image generation failed:', error);
      throw new Error(
        `Failed to generate AI image: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  /**
   * Fetch image from Unsplash
   */
  private async fetchFromUnsplash(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    const apiKey = this.configService.get('UNSPLASH_ACCESS_KEY');
    if (!apiKey) {
      throw new Error('Unsplash API key not configured');
    }

    try {
      const params: Record<string, string | number | undefined> = {
        query: options.query,
        orientation: options.orientation,
        per_page: 1,
      };

      if (options.color) {
        params.color = options.color;
      }

      const response = await axios.get(
        'https://api.unsplash.com/photos/random',
        {
          headers: { Authorization: `Client-ID ${apiKey}` },
          params,
        },
      );

      const photo = response.data;
      const imageUrl = photo.urls.regular;
      const localPath = await this.downloadImage(imageUrl, 'unsplash');

      // Trigger download tracking (required by Unsplash API)
      if (photo.links?.download_location) {
        await axios.get(photo.links.download_location, {
          headers: { Authorization: `Client-ID ${apiKey}` },
        });
      }

      return {
        id: this.generateId(),
        source: 'unsplash',
        url: imageUrl,
        localPath,
        width: photo.width,
        height: photo.height,
        description: photo.description || photo.alt_description,
        author: photo.user.name,
        authorUrl: photo.user.links.html,
        license: 'Unsplash License (Free to use)',
        downloadedAt: new Date(),
        metadata: {
          unsplashId: photo.id,
          downloads: photo.downloads,
          likes: photo.likes,
        },
      };
    } catch (error) {
      this.logger.error('Unsplash fetch failed:', error);
      throw new Error(
        `Failed to fetch from Unsplash: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  /**
   * Fetch image from Pexels
   */
  private async fetchFromPexels(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    const apiKey = this.configService.get('PEXELS_API_KEY');
    if (!apiKey) {
      throw new Error('Pexels API key not configured');
    }

    try {
      const params: Record<string, string | number | undefined> = {
        query: options.query,
        per_page: 1,
        orientation: options.orientation,
      };

      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: { Authorization: apiKey },
        params,
      });

      if (!response.data.photos || response.data.photos.length === 0) {
        throw new Error('No images found on Pexels');
      }

      const photo = response.data.photos[0];
      const imageUrl = photo.src.large;
      const localPath = await this.downloadImage(imageUrl, 'pexels');

      return {
        id: this.generateId(),
        source: 'pexels',
        url: imageUrl,
        localPath,
        width: photo.width,
        height: photo.height,
        description: photo.alt,
        author: photo.photographer,
        authorUrl: photo.photographer_url,
        license: 'Pexels License (Free to use)',
        downloadedAt: new Date(),
        metadata: {
          pexelsId: photo.id,
          avgColor: photo.avg_color,
        },
      };
    } catch (error) {
      this.logger.error('Pexels fetch failed:', error);
      throw new Error(
        `Failed to fetch from Pexels: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  /**
   * Fetch image from Pixabay
   */
  private async fetchFromPixabay(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    const apiKey = this.configService.get('PIXABAY_API_KEY');
    if (!apiKey) {
      throw new Error('Pixabay API key not configured');
    }

    try {
      const params: Record<string, string | number | boolean | undefined> = {
        key: apiKey,
        q: options.query,
        image_type: 'photo',
        per_page: 3,
        safesearch: true,
      };

      if (options.orientation) {
        params.orientation =
          options.orientation === 'square' ? 'all' : options.orientation;
      }

      const response = await axios.get('https://pixabay.com/api/', { params });

      if (!response.data.hits || response.data.hits.length === 0) {
        throw new Error('No images found on Pixabay');
      }

      const photo = response.data.hits[0];
      const imageUrl = photo.largeImageURL;
      const localPath = await this.downloadImage(imageUrl, 'pixabay');

      return {
        id: this.generateId(),
        source: 'pixabay',
        url: imageUrl,
        localPath,
        width: photo.imageWidth,
        height: photo.imageHeight,
        description: photo.tags,
        author: photo.user,
        authorUrl: `https://pixabay.com/users/${photo.user}-${photo.user_id}/`,
        license: 'Pixabay License (Free to use)',
        downloadedAt: new Date(),
        metadata: {
          pixabayId: photo.id,
          downloads: photo.downloads,
          likes: photo.likes,
          views: photo.views,
        },
      };
    } catch (error) {
      this.logger.error('Pixabay fetch failed:', error);
      throw new Error(
        `Failed to fetch from Pixabay: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Download image from direct URL
   */
  private async downloadFromUrl(
    options: ImageAcquisitionOptions,
  ): Promise<AcquiredImage> {
    if (!options.url) {
      throw new Error('URL is required for direct download');
    }

    // Validate Domain
    if (!this.isDomainAllowed(options.url)) {
      throw new Error(
        'Domain not in allowlist. Please use only approved image sources (e.g., Unsplash, Pexels, Commons).',
      );
    }

    try {
      const localPath = await this.downloadImage(options.url, 'url');

      // Get image dimensions (basic estimation)
      const width = options.width || 1920;
      const height = options.height || 1080;

      return {
        id: this.generateId(),
        source: 'url',
        url: options.url,
        localPath,
        width,
        height,
        description: 'Downloaded from URL',
        license: 'Unknown - verify before use',
        downloadedAt: new Date(),
        metadata: {
          originalUrl: options.url,
        },
      };
    } catch (error) {
      this.logger.error('URL download failed:', error);
      throw new Error(
        `Failed to download from URL: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  /**
   * Check if domain is in allowlist
   */
  private isDomainAllowed(url: string): boolean {
    try {
      const hostname = new URL(url).hostname;
      return ALLOWED_IMAGE_DOMAINS.some((domain) => hostname.endsWith(domain));
    } catch {
      return false;
    }
  }

  /**
   * Download image and save locally
   */
  private async downloadImage(url: string, source: string): Promise<string> {
    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent': 'PresentationDesignerBot/1.0 (+http://your-domain.com)',
        },
      });

      const ext = this.getExtensionFromUrl(url) || 'jpg';
      const filename = `${source}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
      const localPath = path.join(this.uploadDir, filename);

      await pipeline(response.data, createWriteStream(localPath));

      this.logger.log(`Image downloaded successfully: ${filename}`);
      return localPath;
    } catch (error) {
      this.logger.error('Image download failed:', error);
      throw error;
    }
  }

  /**
   * Smart image acquisition - tries multiple sources
   */
  async smartAcquire(
    query: string,
    options?: Partial<ImageAcquisitionOptions>,
  ): Promise<AcquiredImage> {
    const sources: ImageSource[] = ['unsplash', 'pexels', 'pixabay'];

    for (const source of sources) {
      try {
        return await this.acquireImage({
          source,
          query,
          ...options,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to acquire from ${source}, trying next source... (${(error as Error).message})`,
        );
      }
    }

    // Fallback to Lorem Picsum if all else fails
    try {
      this.logger.warn(
        `All primary sources failed for "${query}". Using fallback source (Picsum).`,
      );
      // Use a consistent seed based on query to get the same image for the same term
      const seed = query.replace(/[^a-zA-Z0-9]/g, '');
      const width = options?.orientation === 'portrait' ? 1080 : 1920;
      const height = options?.orientation === 'portrait' ? 1920 : 1080;

      return await this.acquireImage({
        source: 'url',
        url: `https://picsum.photos/seed/${seed}/${width}/${height}`,
        width,
        height,
        query, // Pass query for metadata
      });
    } catch (fallbackError) {
      this.logger.error(
        `Fallback image acquisition failed for "${query}":`,
        fallbackError,
      );
    }

    throw new Error('Failed to acquire image from all sources');
  }

  /**
   * Acquire multiple images for a presentation topic
   */
  async acquireForTopic(
    topic: string,
    count: number = 5,
  ): Promise<AcquiredImage[]> {
    const images: AcquiredImage[] = [];
    const keywords = this.extractKeywords(topic);

    for (const keyword of keywords.slice(0, count)) {
      try {
        const image = await this.smartAcquire(keyword, {
          orientation: 'landscape',
        });
        images.push(image);
      } catch (error) {
        this.logger.error(
          `Failed to acquire image for keyword "${keyword}":`,
          error,
        );
      }
    }

    return images;
  }

  /**
   * Utility: Extract keywords from topic
   */
  private extractKeywords(topic: string): string[] {
    // Simple keyword extraction - can be enhanced with NLP
    const words = topic
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3);

    return [...new Set(words)];
  }

  /**
   * Utility: Determine image size for AI generation
   */
  private determineSize(
    options: ImageAcquisitionOptions,
  ): '1024x1024' | '1792x1024' | '1024x1792' {
    if (options.orientation === 'landscape') return '1792x1024';
    if (options.orientation === 'portrait') return '1024x1792';
    return '1024x1024';
  }

  /**
   * Utility: Get file extension from URL
   */
  private getExtensionFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = pathname.split('.').pop()?.toLowerCase();
      return ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
        ? ext
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Utility: Generate unique ID
   */
  private generateId(): string {
    return `img-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Clean up old acquired images
   */
  async cleanupOldImages(daysOld: number = 7): Promise<number> {
    try {
      const files = await fs.readdir(this.uploadDir);
      const cutoffDate = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtimeMs < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
        }
      }

      this.logger.log(`Cleaned up ${deletedCount} old images`);
      return deletedCount;
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
      return 0;
    }
  }
}
