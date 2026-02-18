import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

export interface ImageEmbeddingResult {
  uploadId: string;
  embedding: number[];
  dimension: number;
  model: string;
}

export interface SimilarImage {
  uploadId: string;
  url: string;
  thumbnailUrl?: string;
  filename: string;
  description?: string;
  tags: string[];
  similarityScore: number;
  metadata: Record<string, unknown>;
}

export interface ImageUsageAnalytics {
  totalImages: number;
  totalPresentations: number;
  mostUsedImages: Array<{
    uploadId: string;
    url: string;
    filename: string;
    usageCount: number;
  }>;
  averageImagesPerPresentation: number;
  preferredSources: Record<string, number>;
  popularTags: Record<string, number>;
}

export interface PredictionResult {
  recommendedImages: SimilarImage[];
  confidence: number;
  reasoning: string;
  basedOnPatterns: {
    industryTags: string[];
    commonTags: string[];
    preferredSources: string[];
  };
}

@Injectable()
export class ImageRecognitionService {
  private readonly logger = new Logger(ImageRecognitionService.name);
  private readonly openai: OpenAI | null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const openaiKey = this.configService.get('OPENAI_API_KEY');
    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    } else {
      this.openai = null;
      this.logger.warn('OpenAI API key not configured');
    }
  }

  /**
   * Generate embedding for an image using OpenAI Vision API
   */
  async generateImageEmbedding(
    uploadId: string,
    imageUrl: string,
  ): Promise<ImageEmbeddingResult> {
    this.logger.log(`Generating embedding for upload ${uploadId}`);

    if (!this.openai) {
      throw new BadRequestException('OpenAI API key not configured');
    }

    try {
      // Use OpenAI's embeddings endpoint with image description
      // First, get image description using vision API
      const description = await this.describeImage(imageUrl);

      // Generate text embedding from description
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: description,
        dimensions: 512,
      });

      const embedding = response.data[0].embedding;

      // Save to database
      await this.prisma.imageEmbedding.upsert({
        where: { uploadId },
        create: {
          uploadId,
          embedding,
          embeddingModel: 'openai-text-embedding-3-small',
          dimension: 512,
        },
        update: {
          embedding,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Embedding generated for upload ${uploadId}`);

      return {
        uploadId,
        embedding,
        dimension: 512,
        model: 'openai-text-embedding-3-small',
      };
    } catch (error) {
      this.logger.error(`Failed to generate embedding for ${uploadId}:`, error);
      throw new BadRequestException('Failed to generate image embedding');
    }
  }

  /**
   * Describe an image using OpenAI Vision API
   */
  async describeImage(imageUrl: string): Promise<string> {
    if (!this.openai) {
      throw new BadRequestException('OpenAI API key not configured');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe this image in detail, focusing on: main subjects, colors, style, mood, composition, and potential use cases for presentations. Keep it concise but comprehensive.',
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      return (
        response.choices[0].message.content || 'Image description unavailable'
      );
    } catch (error) {
      this.logger.error('Failed to describe image:', error);
      return 'Image description unavailable';
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Find similar images based on embedding similarity
   */
  async findSimilarImages(
    uploadId: string,
    limit: number = 10,
    minSimilarity: number = 0.7,
  ): Promise<SimilarImage[]> {
    this.logger.log(`Finding similar images for upload ${uploadId}`);

    // Get source embedding
    const sourceEmbedding = await this.prisma.imageEmbedding.findUnique({
      where: { uploadId },
    });

    if (!sourceEmbedding) {
      throw new BadRequestException('Source image embedding not found');
    }

    // Get all other embeddings (optimize this with vector DB in production)
    const allEmbeddings = await this.prisma.imageEmbedding.findMany({
      where: {
        uploadId: { not: uploadId },
      },
      include: {
        upload: true,
      },
    });

    // Calculate similarities
    const similarities = allEmbeddings
      .map((emb) => ({
        upload: emb.upload,
        score: this.cosineSimilarity(sourceEmbedding.embedding, emb.embedding),
      }))
      .filter((item) => item.score >= minSimilarity)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Cache similarities for future use
    await Promise.all(
      similarities.map((sim) =>
        this.prisma.imageSimilarityCache.upsert({
          where: {
            sourceUploadId_targetUploadId: {
              sourceUploadId: uploadId,
              targetUploadId: sim.upload.id,
            },
          },
          create: {
            sourceUploadId: uploadId,
            targetUploadId: sim.upload.id,
            similarityScore: sim.score,
          },
          update: {
            similarityScore: sim.score,
            calculatedAt: new Date(),
          },
        }),
      ),
    );

    return similarities.map((sim) => ({
      uploadId: sim.upload.id,
      url: sim.upload.url,
      thumbnailUrl: sim.upload.thumbnailUrl || undefined,
      filename: sim.upload.filename,
      description: sim.upload.description || undefined,
      tags: sim.upload.tags,
      similarityScore: sim.score,
      metadata: sim.upload.metadata,
    }));
  }

  /**
   * Track image usage in a presentation
   */
  async trackImageUsage(
    uploadId: string,
    projectId: string,
    slideId?: string,
    blockId?: string,
    usageType: 'content' | 'background' | 'thumbnail' = 'content',
  ): Promise<void> {
    this.logger.log(
      `Tracking image usage: ${uploadId} in project ${projectId}`,
    );

    await this.prisma.imageUsage.create({
      data: {
        uploadId,
        projectId,
        slideId,
        blockId,
        usageType,
      },
    });

    // Update user's image patterns
    await this.updateUserImagePatterns(uploadId, projectId);
  }

  /**
   * Remove/mark image usage as removed
   */
  async removeImageUsage(usageId: string): Promise<void> {
    await this.prisma.imageUsage.update({
      where: { id: usageId },
      data: { removedAt: new Date() },
    });
  }

  /**
   * Get images used in a specific presentation
   */
  async getImagesInPresentation(projectId: string): Promise<SimilarImage[]> {
    const usages = await this.prisma.imageUsage.findMany({
      where: {
        projectId,
        removedAt: null,
      },
      include: {
        upload: true,
      },
      orderBy: {
        addedAt: 'asc',
      },
    });

    return usages.map((usage) => ({
      uploadId: usage.upload.id,
      url: usage.upload.url,
      thumbnailUrl: usage.upload.thumbnailUrl || undefined,
      filename: usage.upload.filename,
      description: usage.upload.description || undefined,
      tags: usage.upload.tags,
      similarityScore: 1.0, // Not applicable here
      metadata: { ...usage.upload.metadata, usageType: usage.usageType },
    }));
  }

  /**
   * Find which presentations use a specific image
   */
  async findPresentationsUsingImage(uploadId: string): Promise<
    Array<{
      projectId: string;
      projectTitle: string;
      usageCount: number;
      firstUsed: Date;
      lastUsed: Date;
    }>
  > {
    const usages = await this.prisma.imageUsage.findMany({
      where: {
        uploadId,
        removedAt: null,
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    // Group by project
    const projectMap = new Map();
    usages.forEach((usage) => {
      const projId = usage.project.id;
      if (!projectMap.has(projId)) {
        projectMap.set(projId, {
          projectId: projId,
          projectTitle: usage.project.title,
          usageCount: 0,
          firstUsed: usage.addedAt,
          lastUsed: usage.addedAt,
        });
      }

      const proj = projectMap.get(projId);
      proj.usageCount++;
      if (usage.addedAt < proj.firstUsed) proj.firstUsed = usage.addedAt;
      if (usage.addedAt > proj.lastUsed) proj.lastUsed = usage.addedAt;
    });

    return Array.from(projectMap.values());
  }

  /**
   * Get usage analytics for a user
   */
  async getUserImageAnalytics(userId: string): Promise<ImageUsageAnalytics> {
    // Get all user's uploads
    const uploads = await this.prisma.upload.findMany({
      where: { userId },
      include: {
        usages: {
          where: { removedAt: null },
        },
      },
    });

    // Get all user's projects
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      include: {
        imageUsages: {
          where: { removedAt: null },
        },
      },
    });

    // Calculate most used images
    const imageCounts = new Map<
      string,
      {
        upload: (typeof uploads)[number];
        count: number;
      }
    >();
    uploads.forEach((upload) => {
      imageCounts.set(upload.id, { upload, count: upload.usages.length });
    });

    const mostUsedImages = Array.from(imageCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((item) => ({
        uploadId: item.upload.id,
        url: item.upload.url,
        filename: item.upload.filename,
        usageCount: item.count,
      }));

    // Calculate preferred sources
    const sourceCounts: Record<string, number> = {};
    uploads.forEach((upload) => {
      sourceCounts[upload.source] = (sourceCounts[upload.source] || 0) + 1;
    });

    // Calculate popular tags
    const tagCounts: Record<string, number> = {};
    uploads.forEach((upload) => {
      upload.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const totalPresentations = projects.length;
    const totalImageUsages = projects.reduce(
      (sum, proj) => sum + proj.imageUsages.length,
      0,
    );

    return {
      totalImages: uploads.length,
      totalPresentations,
      mostUsedImages,
      averageImagesPerPresentation:
        totalPresentations > 0 ? totalImageUsages / totalPresentations : 0,
      preferredSources: sourceCounts,
      popularTags: tagCounts,
    };
  }

  /**
   * Update user's image usage patterns (for ML predictions)
   */
  private async updateUserImagePatterns(
    uploadId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        owner: true,
        imageUsages: {
          where: { removedAt: null },
          include: { upload: true },
        },
      },
    });

    if (!project) return;

    const analytics = await this.getUserImageAnalytics(project.ownerId);

    // Extract common tags
    const topTags = Object.entries(analytics.popularTags)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    // Extract preferred sources
    const topSources = Object.entries(analytics.preferredSources)
      .sort(([, a], [, b]) => b - a)
      .map(([source]) => source);

    // Infer industry tags (simplified - would use ML in production)
    const industryTags = this.inferIndustryTags(topTags);

    await this.prisma.presentationImagePattern.upsert({
      where: { userId: project.ownerId },
      create: {
        userId: project.ownerId,
        avgImagesPerSlide: analytics.averageImagesPerPresentation,
        commonImageTags: topTags,
        preferredSources: topSources,
        industryTags,
      },
      update: {
        avgImagesPerSlide: analytics.averageImagesPerPresentation,
        commonImageTags: topTags,
        preferredSources: topSources,
        industryTags,
        lastUpdated: new Date(),
      },
    });
  }

  /**
   * Infer industry/presentation type from common tags
   */
  private inferIndustryTags(tags: string[]): string[] {
    const industryMapping: Record<string, string[]> = {
      business: ['office', 'meeting', 'corporate', 'professional', 'team'],
      creative: ['design', 'art', 'colorful', 'abstract', 'modern'],
      educational: ['learning', 'school', 'student', 'book', 'classroom'],
      technology: ['computer', 'tech', 'digital', 'innovation', 'software'],
      healthcare: ['medical', 'health', 'doctor', 'hospital', 'care'],
    };

    const scores: Record<string, number> = {};

    tags.forEach((tag) => {
      Object.entries(industryMapping).forEach(([industry, keywords]) => {
        if (keywords.some((keyword) => tag.toLowerCase().includes(keyword))) {
          scores[industry] = (scores[industry] || 0) + 1;
        }
      });
    });

    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([industry]) => industry);
  }

  /**
   * Predict/recommend images for a presentation based on context
   */
  async predictImagesForPresentation(
    userId: string,
    projectContext: {
      title?: string;
      description?: string;
      tone?: string;
      audience?: string;
      existingTags?: string[];
    },
    limit: number = 10,
  ): Promise<PredictionResult> {
    this.logger.log(`Predicting images for user ${userId}`);

    // Get user's patterns
    const patterns = await this.prisma.presentationImagePattern.findUnique({
      where: { userId },
    });

    // Build search query based on context and patterns
    const searchTags: string[] = [];

    if (patterns) {
      searchTags.push(...patterns.commonImageTags.slice(0, 5));
    }

    if (projectContext.existingTags) {
      searchTags.push(...projectContext.existingTags);
    }

    // Query images with matching tags
    const candidateImages = await this.prisma.upload.findMany({
      where: {
        OR: [
          { userId }, // User's own images
          { userId: { not: userId } }, // Other users' public images (if implemented)
        ],
        tags: {
          hasSome: searchTags.length > 0 ? searchTags : undefined,
        },
      },
      include: {
        embedding: true,
      },
      take: limit * 2, // Get more candidates to filter
    });

    // If we have context description, use semantic search
    let scoredImages = candidateImages.map((img) => ({
      upload: img,
      score: 0.5, // Base score
    }));

    if (
      this.openai &&
      projectContext.description &&
      candidateImages.length > 0
    ) {
      // Generate embedding for description
      const descEmbedding = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: projectContext.description,
        dimensions: 512,
      });

      const descVector = descEmbedding.data[0].embedding;

      // Calculate similarity scores
      scoredImages = candidateImages
        .filter((img) => img.embedding)
        .map((img) => ({
          upload: img,
          score: this.cosineSimilarity(descVector, img.embedding!.embedding),
        }))
        .sort((a, b) => b.score - a.score);
    } else {
      // Fallback: prioritize images from preferred sources
      const preferredSources = Array.isArray(patterns?.preferredSources)
        ? patterns.preferredSources
        : [];

      scoredImages.sort((a, b) => {
        const sourceA = preferredSources.indexOf(a.upload.source);
        const sourceB = preferredSources.indexOf(b.upload.source);
        if (sourceA >= 0 && sourceB >= 0) return sourceA - sourceB;
        if (sourceA >= 0) return -1;
        if (sourceB >= 0) return 1;
        return 0;
      });
    }

    const recommendedImages: SimilarImage[] = scoredImages
      .slice(0, limit)
      .map((item) => ({
        uploadId: item.upload.id,
        url: item.upload.url,
        thumbnailUrl: item.upload.thumbnailUrl || undefined,
        filename: item.upload.filename,
        description: item.upload.description || undefined,
        tags: item.upload.tags,
        similarityScore: item.score,
        metadata: item.upload.metadata,
      }));

    const avgScore =
      recommendedImages.reduce((sum, img) => sum + img.similarityScore, 0) /
      (recommendedImages.length || 1);

    return {
      recommendedImages,
      confidence: avgScore,
      reasoning: this.buildReasoningExplanation(
        projectContext,
        patterns,
        searchTags,
      ),
      basedOnPatterns: {
        industryTags: patterns?.industryTags || [],
        commonTags: patterns?.commonImageTags || [],
        preferredSources: patterns?.preferredSources || [],
      },
    };
  }

  /**
   * Build human-readable explanation for recommendations
   */
  private buildReasoningExplanation(
    context: {
      tone?: string;
      audience?: string;
    },
    patterns: {
      commonImageTags?: string[];
      preferredSources?: string[];
      industryTags?: string[];
    } | null,
    searchTags: string[],
  ): string {
    const reasons: string[] = [];

    if (patterns?.commonImageTags && patterns.commonImageTags.length > 0) {
      reasons.push(
        `Based on your frequently used tags: ${patterns.commonImageTags.slice(0, 3).join(', ')}`,
      );
    }

    if (patterns?.preferredSources && patterns.preferredSources.length > 0) {
      reasons.push(
        `Prioritizing ${patterns.preferredSources[0]} images from your preferred sources`,
      );
    }

    if (context.tone) {
      reasons.push(`Matching tone: ${context.tone}`);
    }

    if (context.audience) {
      reasons.push(`Suitable for audience: ${context.audience}`);
    }

    if (searchTags.length > 0) {
      reasons.push(
        `Using tags: ${searchTags.slice(0, 5).join(', ')} to match relevant imagery`,
      );
    }

    return reasons.length > 0
      ? reasons.join('. ')
      : 'Recommendations based on general image library';
  }

  /**
   * Batch generate embeddings for multiple images
   */
  async batchGenerateEmbeddings(uploadIds: string[]): Promise<void> {
    this.logger.log(
      `Batch generating embeddings for ${uploadIds.length} images`,
    );

    const uploads = await this.prisma.upload.findMany({
      where: {
        id: { in: uploadIds },
      },
    });

    for (const upload of uploads) {
      try {
        await this.generateImageEmbedding(upload.id, upload.url);
      } catch (err) {
        this.logger.error(
          `Failed to generate embedding for ${upload.id}:`,
          err,
        );
        // Continue with next image
      }
    }

    this.logger.log(`Batch embedding generation completed`);
  }
}
