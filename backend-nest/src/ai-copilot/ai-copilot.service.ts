import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';

interface ChatContext {
  projectId?: string;
  slideId?: string;
  currentSlideContent?: object;
  projectTitle?: string;
  recentBlocks?: Array<{ type: string; content: string }>;
}

export interface CopilotAction {
  type: 'suggestion' | 'edit' | 'generate' | 'explain' | 'summarize';
  target?: string;
  data?: object;
}

@Injectable()
export class AICopilotService {
  private readonly logger = new Logger(AICopilotService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Start a new chat session
   */
  async createSession(
    userId: string,
    options?: { projectId?: string; slideId?: string },
  ) {
    const context: ChatContext = {};

    if (options?.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: options.projectId },
        include: {
          slides: {
            take: 5,
            orderBy: { order: 'asc' },
          },
        },
      });

      if (project && project.ownerId === userId) {
        context.projectId = project.id;
        context.projectTitle = project.title;
        context.recentBlocks = project.slides.map((s) => ({
          type: 'slide',
          content: s.title || 'Untitled',
        }));
      }
    }

    if (options?.slideId) {
      context.slideId = options.slideId;
    }

    return this.prisma.aIChatSession.create({
      data: {
        userId,
        projectId: options?.projectId,
        slideId: options?.slideId,
        context: context as object,
        status: 'active',
      },
    });
  }

  /**
   * Send a message to the AI copilot
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    content: string,
  ): Promise<{
    userMessage: object;
    assistantMessage: object;
    action?: CopilotAction;
  }> {
    const session = await this.getSession(sessionId, userId);

    // Save user message
    const userMessage = await this.prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
        tokens: Math.ceil(content.length / 4),
      },
    });

    // Get context
    const context = await this.buildContext(session);

    // Detect intent and generate response
    const { response, action, tokens } = await this.processMessage(
      content,
      context,
    );

    // Save assistant message
    const assistantMessage = await this.prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: response,
        tokens,
        metadata: action ? ({ action } as any) : undefined,
      },
    });

    // Update session token count
    await this.prisma.aIChatSession.update({
      where: { id: sessionId },
      data: {
        totalTokens: { increment: userMessage.tokens + tokens },
      },
    });

    return {
      userMessage,
      assistantMessage,
      action,
    };
  }

  /**
   * Build context for AI from session
   */
  private async buildContext(session: {
    projectId?: string | null;
    slideId?: string | null;
    context: unknown;
  }): Promise<string> {
    const parts: string[] = [];
    const context = (session.context as ChatContext) || {};

    parts.push(
      'You are an AI copilot assistant for a presentation editor. Help users create, edit, and improve their presentations.',
    );

    if (session.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: session.projectId },
        include: {
          slides: {
            take: 10,
            orderBy: { order: 'asc' },
            include: { blocks: true },
          },
        },
      });

      if (project) {
        parts.push(`\nCurrent Project: "${project.title}"`);
        parts.push(`Total Slides: ${project.slides.length}`);

        if (project.slides.length > 0) {
          parts.push('\nSlide Overview:');
          project.slides.forEach((slide, i) => {
            parts.push(
              `  ${i + 1}. ${slide.title || 'Untitled'} (${slide.blocks.length} blocks)`,
            );
          });
        }
      }
    }

    if (session.slideId) {
      const slide = await this.prisma.slide.findUnique({
        where: { id: session.slideId },
        include: { blocks: true },
      });

      if (slide) {
        parts.push(`\nCurrent Slide: "${slide.title || 'Untitled'}"`);
        if (slide.blocks.length > 0) {
          parts.push('Slide Content:');
          slide.blocks.forEach((block) => {
            const content = (block.content as { text?: string }) || {};
            parts.push(
              `  - ${block.blockType}: ${content.text?.substring(0, 100) || '...'}`,
            );
          });
        }
      }
    }

    parts.push('\nYou can help with:');
    parts.push('- Summarizing slides or the entire presentation');
    parts.push('- Suggesting better titles and content');
    parts.push('- Generating meeting agendas or follow-up emails');
    parts.push('- Improving slide layouts and structure');
    parts.push('- Creating speaker notes');
    parts.push('- Answering questions about the content');

    return parts.join('\n');
  }

  /**
   * Process user message and generate response
   */
  private async processMessage(
    message: string,
    context: string,
  ): Promise<{ response: string; action?: CopilotAction; tokens: number }> {
    const lowerMessage = message.toLowerCase();

    // Detect specific intents
    let systemPrompt = context;
    let action: CopilotAction | undefined;

    if (
      lowerMessage.includes('summarize') ||
      lowerMessage.includes('summary')
    ) {
      action = { type: 'summarize' };
      systemPrompt += '\n\nProvide a clear, concise summary.';
    } else if (
      lowerMessage.includes('suggest') ||
      lowerMessage.includes('improve')
    ) {
      action = { type: 'suggestion' };
      systemPrompt += '\n\nProvide specific, actionable suggestions.';
    } else if (
      lowerMessage.includes('generate') ||
      lowerMessage.includes('create')
    ) {
      action = { type: 'generate' };
      systemPrompt +=
        '\n\nGenerate the requested content in a ready-to-use format.';
    } else if (
      lowerMessage.includes('explain') ||
      lowerMessage.includes('what is')
    ) {
      action = { type: 'explain' };
      systemPrompt += '\n\nProvide a clear, educational explanation.';
    } else if (
      lowerMessage.includes('meeting agenda') ||
      lowerMessage.includes('follow-up email')
    ) {
      action = { type: 'generate', target: 'document' };
    }

    try {
      const response = await this.aiService.generateText(
        `${systemPrompt}\n\nUser: ${message}`,
        { maxTokens: 1000 },
      );

      return {
        response,
        action,
        tokens: Math.ceil(response.length / 4),
      };
    } catch (error) {
      this.logger.error('AI response generation failed', error);
      return {
        response:
          "I'm sorry, I couldn't process your request. Please try again.",
        tokens: 15,
      };
    }
  }

  /**
   * Quick actions that don't require full conversation
   */
  async quickAction(
    userId: string,
    action: string,
    options: { projectId?: string; slideId?: string; blockId?: string },
  ): Promise<{ result: string; metadata?: object }> {
    switch (action) {
      case 'summarize_slide': {
        if (!options.slideId)
          throw new BadRequestException('Slide ID required');
        const slide = await this.prisma.slide.findUnique({
          where: { id: options.slideId },
          include: { blocks: true },
        });
        if (!slide) throw new BadRequestException('Slide not found');

        const content = slide.blocks
          .map((b) => {
            const c = (b.content as { text?: string }) || {};
            return c.text || '';
          })
          .join(' ');

        const summary = await this.aiService.generateText(
          `Summarize this slide content in 2-3 sentences:\n\n${content}`,
          { maxTokens: 150 },
        );

        return { result: summary };
      }

      case 'suggest_title': {
        if (!options.slideId)
          throw new BadRequestException('Slide ID required');
        const slide = await this.prisma.slide.findUnique({
          where: { id: options.slideId },
          include: { blocks: true },
        });
        if (!slide) throw new BadRequestException('Slide not found');

        const content = slide.blocks
          .map((b) => {
            const c = (b.content as { text?: string }) || {};
            return c.text || '';
          })
          .join(' ');

        const titles = await this.aiService.generateText(
          `Suggest 3 compelling titles for a slide with this content. Return as a numbered list:\n\n${content.substring(0, 500)}`,
          { maxTokens: 100 },
        );

        return { result: titles, metadata: { type: 'title_suggestions' } };
      }

      case 'generate_speaker_notes': {
        if (!options.slideId)
          throw new BadRequestException('Slide ID required');
        const slide = await this.prisma.slide.findUnique({
          where: { id: options.slideId },
          include: { blocks: true },
        });
        if (!slide) throw new BadRequestException('Slide not found');

        const content = slide.blocks
          .map((b) => {
            const c = (b.content as { text?: string }) || {};
            return c.text || '';
          })
          .join(' ');

        const notes = await this.aiService.generateText(
          `Generate natural, conversational speaker notes for presenting this slide. Include timing cues and key talking points:\n\nSlide Title: ${slide.title || 'Untitled'}\nContent: ${content.substring(0, 500)}`,
          { maxTokens: 300 },
        );

        return { result: notes, metadata: { type: 'speaker_notes' } };
      }

      case 'generate_meeting_agenda': {
        if (!options.projectId)
          throw new BadRequestException('Project ID required');
        const project = await this.prisma.project.findUnique({
          where: { id: options.projectId },
          include: { slides: { orderBy: { order: 'asc' } } },
        });
        if (!project) throw new BadRequestException('Project not found');

        const slidesList = project.slides
          .map((s, i) => `${i + 1}. ${s.title || 'Slide ' + (i + 1)}`)
          .join('\n');

        const agenda = await this.aiService.generateText(
          `Generate a professional meeting agenda based on this presentation:

Title: ${project.title}
Slides:
${slidesList}

Format with time allocations and discussion points.`,
          { maxTokens: 400 },
        );

        return { result: agenda, metadata: { type: 'meeting_agenda' } };
      }

      case 'generate_followup_email': {
        if (!options.projectId)
          throw new BadRequestException('Project ID required');
        const project = await this.prisma.project.findUnique({
          where: { id: options.projectId },
          include: { slides: { take: 5, orderBy: { order: 'asc' } } },
        });
        if (!project) throw new BadRequestException('Project not found');

        const email = await this.aiService.generateText(
          `Generate a professional follow-up email after presenting "${project.title}". Include:
- Thank attendees
- Key takeaways
- Next steps
- Offer to answer questions

Presentation topics: ${project.slides.map((s) => s.title).join(', ')}`,
          { maxTokens: 350 },
        );

        return { result: email, metadata: { type: 'followup_email' } };
      }

      default:
        throw new BadRequestException('Unknown action');
    }
  }

  /**
   * Provide feedback on a message
   */
  async provideFeedback(
    messageId: string,
    userId: string,
    feedback: 'thumbs_up' | 'thumbs_down',
  ) {
    const message = await this.prisma.aIChatMessage.findUnique({
      where: { id: messageId },
      include: { session: true },
    });

    if (!message || message.session.userId !== userId) {
      throw new BadRequestException('Message not found');
    }

    return this.prisma.aIChatMessage.update({
      where: { id: messageId },
      data: { feedback },
    });
  }

  /**
   * Get session by ID
   */
  async getSession(id: string, userId: string) {
    const session = await this.prisma.aIChatSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    return session;
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(userId: string, limit: number = 10) {
    return this.prisma.aIChatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get user's chat sessions with pagination
   */
  async getUserSessionsPaginated(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [sessions, total] = await Promise.all([
      this.prisma.aIChatSession.findMany({
        where: { userId, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.aIChatSession.count({
        where: { userId, status: { not: 'archived' } },
      }),
    ]);
    return {
      data: sessions,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Rename a session
   */
  async renameSession(id: string, userId: string, title: string) {
    const session = await this.getSession(id, userId);
    return this.prisma.aIChatSession.update({
      where: { id: session.id },
      data: { title },
    });
  }

  /**
   * Get token usage summary for a user
   */
  async getTokenUsage(userId: string): Promise<{
    totalTokens: number;
    sessionCount: number;
    avgTokensPerSession: number;
  }> {
    const sessions = await this.prisma.aIChatSession.findMany({
      where: { userId },
      select: { totalTokens: true },
    });
    const totalTokens = sessions.reduce(
      (s, sess) => s + (sess.totalTokens || 0),
      0,
    );
    const sessionCount = sessions.length;
    const avgTokensPerSession =
      sessionCount > 0 ? Math.round(totalTokens / sessionCount) : 0;
    return { totalTokens, sessionCount, avgTokensPerSession };
  }

  /**
   * Archive session
   */
  async archiveSession(id: string, userId: string) {
    const session = await this.getSession(id, userId);
    return this.prisma.aIChatSession.update({
      where: { id: session.id },
      data: { status: 'archived' },
    });
  }

  /**
   * Delete session
   */
  async deleteSession(id: string, userId: string) {
    const session = await this.getSession(id, userId);
    return this.prisma.aIChatSession.delete({ where: { id: session.id } });
  }
}
