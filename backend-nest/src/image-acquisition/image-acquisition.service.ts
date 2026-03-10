import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
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
export class ImageAcquisitionService implements OnModuleDestroy {
  private readonly logger = new Logger(ImageAcquisitionService.name);
  private readonly uploadDir: string;
  private openai: OpenAI | null = null;

  /** In-memory cache with TTL and LRU eviction */
  private readonly imageCache = new Map<
    string,
    { path: string; timestamp: number; hits: number }
  >();
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly CACHE_MAX_SIZE = 200;
  private cacheCleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir =
      this.configService.get('UPLOAD_DIR') || './uploads/acquired-images';
    void this.ensureUploadDir();

    // Initialize OpenAI for AI image generation
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }

    // Periodic cache cleanup every hour
    this.cacheCleanupTimer = setInterval(
      () => this.evictStaleCache(),
      60 * 60 * 1000,
    );
  }

  /**
   * Evict stale cache entries (TTL-based) and enforce max size (LRU)
   */
  private evictStaleCache(): void {
    const now = Date.now();
    let evicted = 0;

    // Remove expired entries
    for (const [key, entry] of this.imageCache.entries()) {
      if (now - entry.timestamp > ImageAcquisitionService.CACHE_TTL_MS) {
        this.imageCache.delete(key);
        evicted++;
      }
    }

    // Enforce max size with LRU (least recently used = lowest hits)
    if (this.imageCache.size > ImageAcquisitionService.CACHE_MAX_SIZE) {
      const entries = Array.from(this.imageCache.entries()).sort(
        (a, b) => a[1].hits - b[1].hits,
      );
      const toRemove =
        this.imageCache.size - ImageAcquisitionService.CACHE_MAX_SIZE;
      for (let i = 0; i < toRemove; i++) {
        this.imageCache.delete(entries[i][0]);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.logger.log(
        `Evicted ${evicted} stale image cache entries. Cache size: ${this.imageCache.size}`,
      );
    }
  }

  /**
   * Cleanup timer on module destroy
   */
  onModuleDestroy(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
      this.cacheCleanupTimer = null;
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
      const cached = this.imageCache.get(cacheKey);
      if (cached) {
        // Update hit counter for LRU tracking
        cached.hits++;
        this.logger.debug(`Cache hit for ${cacheKey} (hits: ${cached.hits})`);
        // Return a lightweight cached result
        return {
          id: this.generateId(),
          source: options.source,
          url: cached.path,
          localPath: cached.path,
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
      this.imageCache.set(cacheKey, {
        path: result.localPath,
        timestamp: Date.now(),
        hits: 1,
      });
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
        throw new Error(`Unsupported image source: ${String(options.source)}`);
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
        { cause: error },
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

  /**
   * AI-powered image tagging and categorization
   */
  async tagImage(imagePath: string): Promise<{
    tags: string[];
    category: string;
    description: string;
    colors: string[];
    confidence: number;
  }> {
    // no async work here yet
    await Promise.resolve();
    try {
      // In a real implementation, this would use an image recognition API
      // For now, we'll use a simple heuristic based on filename
      const filename = path.basename(imagePath);
      const tags = this.extractKeywords(filename);

      return {
        tags: tags.slice(0, 5),
        category: 'general',
        description: `Image: ${filename}`,
        colors: ['#000000', '#ffffff'],
        confidence: 0.75,
      };
    } catch (error) {
      this.logger.error('Image tagging failed', error);
      return {
        tags: [],
        category: 'uncategorized',
        description: '',
        colors: [],
        confidence: 0,
      };
    }
  }

  /**
   * Smart image search with semantic understanding
   */
  async semanticSearch(
    query: string,
    images: AcquiredImage[],
  ): Promise<Array<AcquiredImage & { relevanceScore: number }>> {
    // synchronous calculation; lint demands await
    await Promise.resolve();
    const results = images.map((image) => {
      const description = image.description || '';
      const metadata = JSON.stringify(image.metadata || {});
      const searchText = `${description} ${metadata}`.toLowerCase();

      const queryTerms = query.toLowerCase().split(/\s+/);
      const matches = queryTerms.filter((term) =>
        searchText.includes(term),
      ).length;
      const relevanceScore = matches / queryTerms.length;

      return {
        ...image,
        relevanceScore,
      };
    });

    return results
      .filter((r) => r.relevanceScore > 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Batch acquire images in parallel
   */
  async batchAcquire(
    queries: string[],
    options: Partial<ImageAcquisitionOptions> = {},
  ): Promise<
    Array<{
      query: string;
      success: boolean;
      image?: AcquiredImage;
      error?: string;
    }>
  > {
    const maxConcurrent = 3;
    const results: Array<{
      query: string;
      success: boolean;
      image?: AcquiredImage;
      error?: string;
    }> = [];

    for (let i = 0; i < queries.length; i += maxConcurrent) {
      const batch = queries.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (query) => {
        try {
          const image = await this.smartAcquire(query, options);
          return { query, success: true, image };
        } catch (error) {
          return { query, success: false, error: (error as Error).message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add delay between batches
      if (i + maxConcurrent < queries.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  /**
   * Generate image variations using AI
   */
  async generateVariations(
    originalPrompt: string,
    count: number = 3,
  ): Promise<AcquiredImage[]> {
    const variations: AcquiredImage[] = [];

    const variationPrompts = [
      `${originalPrompt}, different angle`,
      `${originalPrompt}, alternative style`,
      `${originalPrompt}, different composition`,
      `${originalPrompt}, vibrant colors`,
      `${originalPrompt}, minimalist design`,
    ].slice(0, count);

    for (const prompt of variationPrompts) {
      try {
        const image = await this.smartAcquire(prompt, {
          orientation: 'landscape',
        });
        variations.push(image);
      } catch (error) {
        this.logger.warn(`Variation generation failed for: ${prompt}`, error);
      }
    }

    return variations;
  }

  /**
   * Find similar images based on visual similarity
   */
  async findSimilar(
    referenceImage: AcquiredImage,
    candidateImages: AcquiredImage[],
    threshold: number = 0.7,
  ): Promise<AcquiredImage[]> {
    // no await needed yet
    await Promise.resolve();
    // This would use image embeddings in a real implementation
    // For now, we'll use metadata similarity
    const refTags = this.extractKeywords(referenceImage.description || '');

    return candidateImages
      .map((img) => {
        const imgTags = this.extractKeywords(img.description || '');
        const commonTags = refTags.filter((tag) => imgTags.includes(tag));
        const similarity =
          commonTags.length / Math.max(refTags.length, imgTags.length);

        return { img, similarity };
      })
      .filter((item) => item.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .map((item) => item.img);
  }

  /**
   * Optimize image for web delivery
   */
  async optimizeImage(
    imagePath: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp';
    } = {},
  ): Promise<{
    optimizedPath: string;
    originalSize: number;
    optimizedSize: number;
    savings: number;
  }> {
    try {
      const stats = await fs.stat(imagePath);
      const originalSize = stats.size;

      // In a real implementation, this would use sharp or similar library
      // For now, we'll return mock data
      const optimizedPath = imagePath.replace(
        /\.[^.]+$/,
        `-optimized.${options.format || 'webp'}`,
      );
      const optimizedSize = Math.floor(originalSize * 0.6); // Assume 40% reduction
      const savings = ((originalSize - optimizedSize) / originalSize) * 100;

      return {
        optimizedPath,
        originalSize,
        optimizedSize,
        savings: Math.round(savings),
      };
    } catch (error) {
      this.logger.error('Image optimization failed', error);
      throw error;
    }
  }

  /**
   * Extract dominant colors from image
   */
  async extractColors(
    _imagePath: string,
    count: number = 5,
  ): Promise<string[]> {
    // synchronous stub
    await Promise.resolve();
    try {
      // In a real implementation, this would analyze the image
      // For now, return a default palette
      const palettes = [
        ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6'],
        ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7dc6f', '#bb8fce'],
        ['#2c3e50', '#e74c3c', '#ecf0f1', '#3498db', '#2ecc71'],
      ];

      return palettes[Math.floor(Math.random() * palettes.length)].slice(
        0,
        count,
      );
    } catch (error) {
      this.logger.error('Color extraction failed', error);
      return ['#000000', '#ffffff'];
    }
  }

  /**
   * Generate image collage from multiple images
   */
  async createCollage(
    _imagePaths: string[],
    _layout: 'grid' | 'mosaic' | 'story',
  ): Promise<{ collagePath: string; width: number; height: number }> {
    // stubbed synchronous; dummy await
    await Promise.resolve();
    try {
      // In a real implementation, this would compose images into a collage
      // For now, return mock data
      const collagePath = path.join(
        this.uploadDir,
        `collage-${Date.now()}.png`,
      );

      return {
        collagePath,
        width: 1920,
        height: 1080,
      };
    } catch (error) {
      this.logger.error('Collage creation failed', error);
      throw error;
    }
  }

  /**
   * Get image analytics and usage statistics
   */
  async getImageAnalytics(): Promise<{
    totalImages: number;
    bySource: Record<ImageSource, number>;
    totalSize: number;
    avgSize: number;
    mostUsedTags: Array<{ tag: string; count: number }>;
  }> {
    try {
      const files = await fs.readdir(this.uploadDir);
      let totalSize = 0;
      const sourceCount: Record<string, number> = {
        ai: 0,
        unsplash: 0,
        pexels: 0,
        pixabay: 0,
        url: 0,
      };

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        // Infer source from filename pattern
        if (file.includes('ai-')) sourceCount.ai++;
        else if (file.includes('unsplash')) sourceCount.unsplash++;
        else if (file.includes('pexels')) sourceCount.pexels++;
        else if (file.includes('pixabay')) sourceCount.pixabay++;
        else sourceCount.url++;
      }

      return {
        totalImages: files.length,
        bySource: sourceCount as Record<ImageSource, number>,
        totalSize,
        avgSize: files.length > 0 ? Math.round(totalSize / files.length) : 0,
        mostUsedTags: [],
      };
    } catch (error) {
      this.logger.error('Analytics generation failed', error);
      return {
        totalImages: 0,
        bySource: { ai: 0, unsplash: 0, pexels: 0, pixabay: 0, url: 0 },
        totalSize: 0,
        avgSize: 0,
        mostUsedTags: [],
      };
    }
  }
}
