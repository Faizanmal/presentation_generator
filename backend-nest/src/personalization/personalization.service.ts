import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { AIService } from '../ai/ai.service';

interface BrandProfileDto {
  companyName?: string;
  brandVoice?: string;
  industry?: string;
  targetAudience?: string;
  keywords?: string[];
  colorPalette?: { primary: string; secondary: string; accent: string };
  logoUrl?: string;
}

export interface PersonalizationPreferences {
  defaultTone?: string;
  defaultAudience?: string;
  preferredLength?: number;
  stylePreferences?: {
    useEmoji?: boolean;
    formalLevel?: 'casual' | 'professional' | 'formal';
    bulletStyle?: 'short' | 'detailed';
  };
}

interface TrainingExample {
  input: string;
  output: string;
}

@Injectable()
export class PersonalizationService {
  private readonly logger = new Logger(PersonalizationService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly aiService: AIService,
  ) {}

  // ============================================
  // BRAND PROFILE
  // ============================================

  /**
   * Create or update user's brand profile
   */
  async upsertBrandProfile(userId: string, dto: BrandProfileDto) {
    return this.prisma.brandProfile.upsert({
      where: { userId },
      update: {
        ...dto,
        colorPalette: dto.colorPalette || undefined,
      },
      create: {
        userId,
        ...dto,
        colorPalette: dto.colorPalette || undefined,
      },
    });
  }

  /**
   * Get user's brand profile
   */
  async getBrandProfile(userId: string) {
    return this.prisma.brandProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Upload brand logo
   */
  async uploadBrandLogo(userId: string, file: Express.Multer.File) {
    const uploadResult = await this.uploadService.uploadFile(
      file,
      userId,
      'brand',
    );

    await this.prisma.brandProfile.upsert({
      where: { userId },
      update: { logoUrl: uploadResult.url },
      create: { userId, logoUrl: uploadResult.url },
    });

    return { logoUrl: uploadResult.url };
  }

  // ============================================
  // TRAINING DOCUMENTS
  // ============================================

  /**
   * Upload a training document for AI personalization
   */
  async uploadTrainingDocument(userId: string, file: Express.Multer.File) {
    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid document type');
    }

    // Upload to S3
    const uploadResult = await this.uploadService.uploadFile(
      file,
      userId,
      'training',
    );

    // Create document record
    const document = await this.prisma.trainingDocument.create({
      data: {
        userId,
        filename: file.originalname,
        url: uploadResult.url,
        status: 'UPLOADING',
      },
    });

    // Process document asynchronously
    void this.processDocument(document.id, file).catch((error) => {
      this.logger.error(`Failed to process document ${document.id}`, error);
      void this.updateDocumentStatus(document.id, 'FAILED');
    });

    return document;
  }

  /**
   * Process a training document - extract text and generate embeddings
   */
  private async processDocument(documentId: string, file: Express.Multer.File) {
    await this.updateDocumentStatus(documentId, 'PROCESSING');

    try {
      // Extract text based on file type
      let content = '';

      if (file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
        content = file.buffer.toString('utf-8');
      } else if (file.mimetype === 'application/pdf') {
        // For PDF, we'd use a library like pdf-parse
        // Simplified here - in production use proper PDF parsing
        content = file.buffer.toString('utf-8');
      } else {
        // For Word docs, use mammoth or similar
        content = file.buffer.toString('utf-8');
      }

      // Generate embeddings using OpenAI
      const embeddings = await this.aiService.generateEmbedding(
        content.slice(0, 8000), // Limit input length
      );

      // Update document with content and embeddings
      await this.prisma.trainingDocument.update({
        where: { id: documentId },
        data: {
          content,
          embeddings: embeddings,
          status: 'READY',
          processedAt: new Date(),
        },
      });

      this.logger.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing document ${documentId}`, error);
      await this.updateDocumentStatus(documentId, 'FAILED');
      throw error;
    }
  }

  /**
   * Get user's training documents
   */
  async getTrainingDocuments(userId: string) {
    return this.prisma.trainingDocument.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        status: true,
        createdAt: true,
        processedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete a training document
   */
  async deleteTrainingDocument(documentId: string, userId: string) {
    const document = await this.prisma.trainingDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.userId !== userId) {
      throw new NotFoundException('Document not found');
    }

    // Delete from S3
    await this.uploadService.deleteFile(document.url);

    // Delete from database
    return this.prisma.trainingDocument.delete({
      where: { id: documentId },
    });
  }

  private async updateDocumentStatus(
    documentId: string,
    status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED',
  ) {
    return this.prisma.trainingDocument.update({
      where: { id: documentId },
      data: { status },
    });
  }

  // ============================================
  // AI PERSONALIZATION SETTINGS
  // ============================================

  /**
   * Save AI personalization settings
   */
  /**
   * Save AI personalization settings
   */
  async savePersonalizationSettings(
    userId: string,
    preferences: PersonalizationPreferences,
    promptTemplate?: string,
    examples?: TrainingExample[],
  ) {
    const existing = await this.prisma.aIPersonalization.findFirst({
      where: { userId, projectId: null },
    });

    if (existing) {
      return this.prisma.aIPersonalization.update({
        where: { id: existing.id },
        data: {
          preferences: preferences as unknown as Prisma.InputJsonValue,
          promptTemplate,
          examples: examples as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return this.prisma.aIPersonalization.create({
      data: {
        userId,
        preferences: preferences as unknown as Prisma.InputJsonValue,
        promptTemplate,
        examples: examples as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Get AI personalization settings
   */
  async getPersonalizationSettings(userId: string) {
    return this.prisma.aIPersonalization.findFirst({
      where: { userId, projectId: null },
    });
  }

  /**
   * Save project-specific AI settings
   */
  async saveProjectPersonalization(
    userId: string,
    projectId: string,
    preferences: PersonalizationPreferences,
    promptTemplate?: string,
  ) {
    const existing = await this.prisma.aIPersonalization.findFirst({
      where: { userId, projectId },
    });

    if (existing) {
      return this.prisma.aIPersonalization.update({
        where: { id: existing.id },
        data: {
          preferences: preferences as unknown as Prisma.InputJsonValue,
          promptTemplate,
        },
      });
    }

    return this.prisma.aIPersonalization.create({
      data: {
        userId,
        projectId,

        preferences: preferences as unknown as Prisma.InputJsonValue,
        promptTemplate,
      },
    });
  }

  // ============================================
  // PERSONALIZED AI GENERATION
  // ============================================

  /**
   * Build a personalized system prompt based on user's brand and preferences
   */
  async buildPersonalizedPrompt(userId: string): Promise<string> {
    const [brandProfile, personalization, documents] = await Promise.all([
      this.getBrandProfile(userId),
      this.getPersonalizationSettings(userId),
      this.prisma.trainingDocument.findMany({
        where: { userId, status: 'READY' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let prompt = '';

    // Add brand context
    if (brandProfile) {
      prompt += `\n## BRAND CONTEXT\n`;
      if (brandProfile.companyName) {
        prompt += `Company: ${brandProfile.companyName}\n`;
      }
      if (brandProfile.industry) {
        prompt += `Industry: ${brandProfile.industry}\n`;
      }
      if (brandProfile.brandVoice) {
        prompt += `Brand Voice: ${brandProfile.brandVoice}\n`;
      }
      if (brandProfile.targetAudience) {
        prompt += `Target Audience: ${brandProfile.targetAudience}\n`;
      }
      if (brandProfile.keywords && brandProfile.keywords.length > 0) {
        prompt += `Key Terms to Use: ${brandProfile.keywords.join(', ')}\n`;
      }
    }

    // Add style preferences
    const prefs =
      personalization?.preferences as PersonalizationPreferences | null;
    if (prefs?.stylePreferences) {
      prompt += `\n## STYLE PREFERENCES\n`;
      if (prefs.stylePreferences.formalLevel) {
        prompt += `Tone: ${prefs.stylePreferences.formalLevel}\n`;
      }
      if (prefs.stylePreferences.bulletStyle) {
        prompt += `Bullet Style: ${prefs.stylePreferences.bulletStyle === 'short' ? 'Keep bullet points concise' : 'Provide detailed bullet points'}\n`;
      }
      if (prefs.stylePreferences.useEmoji !== undefined) {
        prompt += `Emoji Usage: ${prefs.stylePreferences.useEmoji ? 'Include relevant emojis' : 'Do not use emojis'}\n`;
      }
    }

    // Add custom prompt template
    if (personalization?.promptTemplate) {
      prompt += `\n## CUSTOM INSTRUCTIONS\n${personalization.promptTemplate}\n`;
    }

    // Add few-shot examples
    const examples = personalization?.examples as TrainingExample[] | null;
    if (examples && examples.length > 0) {
      prompt += `\n## EXAMPLES OF PREFERRED OUTPUT STYLE\n`;
      examples.slice(0, 3).forEach((example, i) => {
        prompt += `Example ${i + 1}:\nInput: ${example.input}\nOutput: ${example.output}\n\n`;
      });
    }

    // Add context from training documents (RAG-style)
    if (documents.length > 0) {
      prompt += `\n## REFERENCE CONTENT\nUse the following content as reference for style and terminology:\n`;
      documents.forEach((doc) => {
        if (doc.content) {
          prompt += `\n--- From ${doc.filename} ---\n${doc.content.slice(0, 1000)}...\n`;
        }
      });
    }

    return prompt;
  }

  /**
   * Find relevant content from training documents using semantic search
  /**
   * Find relevant content from training documents using semantic search
   */
  async findRelevantContent(
    userId: string,
    query: string,
    limit = 3,
  ): Promise<string[]> {
    // Generate embedding for the query
    const queryVector = await this.aiService.generateEmbedding(query);

    // Get all user's ready documents
    const documents = await this.prisma.trainingDocument.findMany({
      where: { userId, status: 'READY' },
    });

    // Calculate cosine similarity for each document
    const similarities = documents.map((doc) => {
      const docEmbedding = doc.embeddings as number[] | null;
      if (!docEmbedding) return { doc, similarity: 0 };

      const similarity = this.cosineSimilarity(queryVector, docEmbedding);
      return { doc, similarity };
    });

    // Sort by similarity and return top results
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities
      .slice(0, limit)
      .filter((s) => s.similarity > 0.3) // Only include relevant content
      .map((s) => s.doc.content || '')
      .filter(Boolean);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // ============================================
  // BRAND THEME GENERATION
  // ============================================

  /**
   * Generate a custom theme based on brand profile
   */
  async generateBrandTheme(userId: string) {
    const brandProfile = await this.getBrandProfile(userId);

    if (!brandProfile) {
      throw new BadRequestException('Brand profile not found');
    }

    const colors = brandProfile.colorPalette as {
      primary?: string;
      secondary?: string;
      accent?: string;
    } | null;

    const theme = {
      name: `${brandProfile.companyName || 'Custom'} Brand Theme`,
      description: `Custom theme for ${brandProfile.companyName}`,
      colors: {
        primary: colors?.primary || '#3B82F6',
        secondary: colors?.secondary || '#1E40AF',
        background: '#FFFFFF',
        text: '#1F2937',
        accent: colors?.accent || '#F59E0B',
      },
      fonts: {
        heading: 'Inter',
        body: 'Inter',
      },
      spacing: {
        base: 16,
        scale: 1.5,
      },
    };

    // If the user has a custom color palette, generate complementary colors using AI
    if (colors?.primary) {
      const complementaryColors = await this.generateComplementaryColors(
        colors.primary,
      );

      theme.colors = { ...theme.colors, ...complementaryColors };
    }

    return theme;
  }

  private async generateComplementaryColors(primaryColor: string) {
    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Given the primary brand color ${primaryColor}, suggest complementary colors for a professional presentation theme. Return JSON only: {"background": "#...", "text": "#...", "accent": "#..."}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content || '{}';

      const result = JSON.parse(content) as Record<string, string>;

      return result;
    } catch (error) {
      this.logger.error('Failed to generate complementary colors', error);
      return {};
    }
  }
}
