import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

export interface ModerationResult {
  approved: boolean;
  spam: boolean;
  toxicity: number;
  relevance: number;
  category?: string;
  reason?: string;
}

@Injectable()
export class LiveQAService {
  private readonly logger = new Logger(LiveQAService.name);

  // Spam detection patterns
  private readonly spamPatterns = [
    /\b(buy now|click here|free money|visit my|subscribe to)\b/i,
    /(https?:\/\/[^\s]+){2,}/i, // Multiple URLs
    /(.)\1{5,}/i, // Repeated characters
    /[A-Z]{10,}/i, // Excessive caps
  ];

  // Profanity patterns (simplified)
  private readonly toxicPatterns = [/\b(hate|stupid|idiot|terrible)\b/i];

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Create a new Q&A session
   */
  async createSession(
    hostId: string,
    projectId: string,
    options?: {
      title?: string;
      allowAnonymous?: boolean;
      moderationLevel?: 'off' | 'basic' | 'strict';
      maxQuestions?: number;
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== hostId) {
      throw new BadRequestException('Project not found or not owned by user');
    }

    return this.prisma.liveQASession.create({
      data: {
        hostUserId: hostId,
        projectId,
        title: options?.title || `Q&A for ${project.title}`,
        moderationLevel: options?.moderationLevel || 'medium',
        anonymousAllowed: options?.allowAnonymous ?? true,
        maxQuestions: options?.maxQuestions || 100,
        status: 'pending',
      },
    });
  }

  /**
   * Submit a question
   */
  async submitQuestion(
    sessionId: string,
    content: string,
    submitterId?: string,
    isAnonymous: boolean = false,
  ): Promise<{ question?: object; moderation: ModerationResult }> {
    const session = await this.getSession(sessionId);

    if (session.status !== 'active') {
      throw new BadRequestException('Session is not active');
    }

    // Check anonymous permission
    if (isAnonymous && !session.anonymousAllowed) {
      throw new BadRequestException('Anonymous questions not allowed');
    }

    // Check question limit
    const questionCount = await this.prisma.liveQuestion.count({
      where: { sessionId },
    });

    if (session.maxQuestions && questionCount >= session.maxQuestions) {
      throw new BadRequestException('Question limit reached');
    }

    // Run moderation
    const moderation = await this.moderateQuestion(
      content,
      session.moderationLevel,
    );

    if (!moderation.approved) {
      return { moderation };
    }

    // Create question
    const question = await this.prisma.liveQuestion.create({
      data: {
        sessionId,
        userId: isAnonymous ? null : submitterId,
        content,
        isAnonymous,
        status: moderation.spam ? 'flagged' : 'pending',
        aiAnalysis: moderation as object,
      },
    });

    return { question, moderation };
  }

  /**
   * Moderate a question using rules and AI
   */
  private async moderateQuestion(
    content: string,
    level: string,
  ): Promise<ModerationResult> {
    const result: ModerationResult = {
      approved: true,
      spam: false,
      toxicity: 0,
      relevance: 1,
    };

    if (level === 'off') {
      return result;
    }

    // Check for spam patterns
    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        result.spam = true;
        result.approved = level === 'basic' ? true : false;
        result.reason = 'Potential spam detected';
        break;
      }
    }

    // Check for toxicity
    let toxicMatches = 0;
    for (const pattern of this.toxicPatterns) {
      if (pattern.test(content)) {
        toxicMatches++;
      }
    }
    result.toxicity = Math.min(toxicMatches / 3, 1);

    if (result.toxicity > 0.5 && level === 'strict') {
      result.approved = false;
      result.reason = 'Content may be inappropriate';
    }

    // For strict mode, use AI for deeper analysis
    if (level === 'strict' && result.approved) {
      try {
        const aiAnalysis = await this.aiService.generateText(
          `Analyze this question for a Q&A session. Is it:
1. Relevant to a presentation Q&A? (yes/no)
2. Appropriate and respectful? (yes/no)
3. A genuine question vs spam? (question/spam)

Question: "${content}"

Respond in JSON format: {"relevant": true/false, "appropriate": true/false, "type": "question"/"spam"}`,
          { maxTokens: 100 },
        );

        try {
          const parsed = JSON.parse(aiAnalysis);
          result.relevance = parsed.relevant ? 1 : 0.3;
          if (!parsed.appropriate || parsed.type === 'spam') {
            result.approved = false;
            result.reason = 'AI moderation flagged this content';
          }
        } catch {
          // If parsing fails, let it through with basic checks passed
        }
      } catch (_error) {
        this.logger.warn('AI moderation failed, using rule-based only');
      }
    }

    return result;
  }

  /**
   * Upvote a question
   */
  async upvoteQuestion(questionId: string, _voterId?: string) {
    const question = await this.prisma.liveQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    // Simple upvote (in production, track voters to prevent duplicates)
    return this.prisma.liveQuestion.update({
      where: { id: questionId },
      data: { upvotes: { increment: 1 } },
    });
  }

  /**
   * Mark question as answered
   */
  async markAnswered(questionId: string, hostId: string, answer?: string) {
    const question = await this.prisma.liveQuestion.findUnique({
      where: { id: questionId },
      include: { session: true },
    });

    if (!question || question.session.hostUserId !== hostId) {
      throw new BadRequestException('Question not found or unauthorized');
    }

    return this.prisma.liveQuestion.update({
      where: { id: questionId },
      data: {
        status: 'answered',
        answeredAt: new Date(),
        answer,
      },
    });
  }

  /**
   * Dismiss/hide a question
   */
  async dismissQuestion(questionId: string, hostId: string) {
    const question = await this.prisma.liveQuestion.findUnique({
      where: { id: questionId },
      include: { session: true },
    });

    if (!question || question.session.hostUserId !== hostId) {
      throw new BadRequestException('Question not found or unauthorized');
    }

    return this.prisma.liveQuestion.update({
      where: { id: questionId },
      data: { status: 'dismissed' },
    });
  }

  /**
   * Pin a question to top
   */
  async pinQuestion(questionId: string, hostId: string) {
    const question = await this.prisma.liveQuestion.findUnique({
      where: { id: questionId },
      include: { session: true },
    });

    if (!question || question.session.hostUserId !== hostId) {
      throw new BadRequestException('Question not found or unauthorized');
    }

    return this.prisma.liveQuestion.update({
      where: { id: questionId },
      data: { isPinned: true },
    });
  }

  /**
   * Get questions for session
   */
  async getQuestions(
    sessionId: string,
    options?: {
      status?: string;
      sortBy?: 'recent' | 'popular';
      limit?: number;
    },
  ) {
    const where: { sessionId: string; status?: string } = { sessionId };
    if (options?.status) {
      where.status = options.status;
    }

    const orderBy =
      options?.sortBy === 'popular'
        ? { upvotes: 'desc' as const }
        : { createdAt: 'desc' as const };

    return this.prisma.liveQuestion.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, orderBy],
      take: options?.limit || 50,
    });
  }

  /**
   * Generate AI summary of questions
   */
  async summarizeQuestions(sessionId: string, hostId: string) {
    const session = await this.getSession(sessionId);

    if (session.hostUserId !== hostId) {
      throw new BadRequestException('Unauthorized');
    }

    const questions = await this.prisma.liveQuestion.findMany({
      where: { sessionId, status: { not: 'dismissed' } },
      orderBy: { upvotes: 'desc' },
    });

    if (questions.length === 0) {
      return { summary: 'No questions submitted yet.', themes: [] };
    }

    const questionList = questions
      .map((q, i) => `${i + 1}. ${q.content}`)
      .join('\n');

    try {
      const analysis = await this.aiService.generateText(
        `Analyze these Q&A questions from a presentation audience:

${questionList}

Provide:
1. A brief summary (2-3 sentences)
2. Top 3 themes/topics people are asking about
3. Suggested order to answer (by importance/popularity)

Format as JSON: {"summary": "...", "themes": ["theme1", "theme2", "theme3"], "suggestedOrder": [1, 5, 3]}`,
        { maxTokens: 300 },
      );

      try {
        return JSON.parse(analysis);
      } catch {
        return { summary: analysis, themes: [] };
      }
    } catch (error) {
      this.logger.error('Failed to summarize questions', error);
      return {
        summary: `${questions.length} questions received. Most popular topics need manual review.`,
        themes: [],
      };
    }
  }

  /**
   * End Q&A session
   */
  async endSession(sessionId: string, hostId: string) {
    const session = await this.getSession(sessionId);

    if (session.hostUserId !== hostId) {
      throw new BadRequestException('Unauthorized');
    }

    return this.prisma.liveQASession.update({
      where: { id: sessionId },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });
  }

  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string) {
    const [session, questions] = await Promise.all([
      this.prisma.liveQASession.findUnique({
        where: { id: sessionId },
      }),
      this.prisma.liveQuestion.groupBy({
        by: ['status'],
        where: { sessionId },
        _count: true,
      }),
    ]);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const stats: { [key: string]: number } = {
      total: 0,
      pending: 0,
      answered: 0,
      dismissed: 0,
      flagged: 0,
    };

    questions.forEach((q) => {
      stats[q.status] = q._count;
      stats.total += q._count;
    });

    return {
      session: {
        id: session.id,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
      questions: stats,
    };
  }

  /**
   * Get session by ID
   */
  async getSession(id: string) {
    const session = await this.prisma.liveQASession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }
}
