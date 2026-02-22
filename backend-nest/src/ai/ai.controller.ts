import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import { AIService, GeneratedPresentation, GeneratedBlock } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ForbiddenException } from '@nestjs/common';
import { BackgroundLibraryService } from './background-library.service';
import { AutoLayoutService } from './auto-layout.service';
import { AIChatService, SlideContext } from './ai-chat.service';
import { URLImportService } from './url-import.service';
import { RealTimeDataService } from './realtime-data.service';
import { ImageRecognitionService } from './image-recognition.service';
import {
  ThrottleAIGeneration,
  ThrottleImageGeneration,
} from '../common/decorators/throttle.decorator';

class EnhanceContentDto {
  content: string;
  instruction: string;
}

class SpeakerNotesDto {
  slideContent: string;
  context?: string;
}

class TransformTextDto {
  text: string;
  action:
    | 'shorten'
    | 'expand'
    | 'simplify'
    | 'professional'
    | 'casual'
    | 'academic'
    | 'persuasive'
    | 'fix-grammar';
}

class BatchEnhanceDto {
  items: { id: string; content: string }[];
  instruction: string;
}

class SlideSuggestionsDto {
  currentContent: string;
  slideType?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly usersService: UsersService,
    private readonly backgroundLibrary: BackgroundLibraryService,
    private readonly autoLayoutService: AutoLayoutService,
    private readonly aiChatService: AIChatService,
    private readonly urlImportService: URLImportService,
    private readonly realTimeDataService: RealTimeDataService,
    private readonly imageRecognitionService: ImageRecognitionService,
  ) {}

  /**
   * Enhance content using AI
   */
  @Post('enhance')
  @HttpCode(HttpStatus.OK)
  @ThrottleAIGeneration()
  async enhanceContent(
    @CurrentUser() user: { id: string },
    @Body() body: EnhanceContentDto,
  ) {
    // Check AI usage limit
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const enhanced = await this.aiService.enhanceContent(
      body.content,
      body.instruction,
    );

    await this.usersService.incrementAIGenerations(user.id);

    return { content: enhanced };
  }

  /**
   * Generate speaker notes for a slide
   */
  @Post('speaker-notes')
  @HttpCode(HttpStatus.OK)
  @ThrottleAIGeneration()
  async generateSpeakerNotes(
    @CurrentUser() user: { id: string },
    @Body() body: SpeakerNotesDto,
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const instruction = `Generate speaker notes for this slide content. The notes should:
1. Help the presenter explain the key points naturally
2. Include talking points and what to emphasize
3. Suggest transitions to the next topic
4. Be conversational but professional
${body.context ? `Context: ${body.context}` : ''}`;

    const notes = await this.aiService.enhanceContent(
      body.slideContent,
      instruction,
    );
    await this.usersService.incrementAIGenerations(user.id);

    return { speakerNotes: notes };
  }

  /**
   * Transform text with predefined actions
   */
  @Post('transform')
  @HttpCode(HttpStatus.OK)
  async transformText(
    @CurrentUser() user: { id: string },
    @Body() body: TransformTextDto,
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const instructions: Record<string, string> = {
      shorten:
        'Make this text shorter and more concise while keeping the key message intact. Remove unnecessary words.',
      expand:
        'Expand this text with more details, examples, and explanations while maintaining the original message.',
      simplify:
        'Simplify this text to make it easier to understand for a general audience. Use simpler words and shorter sentences.',
      professional:
        'Rewrite this text in a professional, business-appropriate tone suitable for corporate presentations.',
      casual: 'Rewrite this text in a casual, friendly, and approachable tone.',
      academic:
        'Rewrite this text in an academic, scholarly tone with formal language.',
      persuasive:
        'Rewrite this text to be more persuasive, compelling, and action-oriented.',
      'fix-grammar':
        'Fix any grammar, spelling, punctuation, and syntax errors in this text while preserving the original meaning.',
    };

    const instruction = instructions[body.action] || 'Improve this text';
    const transformed = await this.aiService.enhanceContent(
      body.text,
      instruction,
    );
    await this.usersService.incrementAIGenerations(user.id);

    return { text: transformed, action: body.action };
  }

  /**
   * Batch enhance multiple content items
   */
  @Post('batch-enhance')
  @HttpCode(HttpStatus.OK)
  async batchEnhance(
    @CurrentUser() user: { id: string },
    @Body() body: BatchEnhanceDto,
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    if (body.items.length > 10) {
      throw new ForbiddenException('Maximum 10 items per batch');
    }

    const results = await Promise.all(
      body.items.map(async (item) => {
        try {
          const enhanced = await this.aiService.enhanceContent(
            item.content,
            body.instruction,
          );
          return { id: item.id, content: enhanced, success: true };
        } catch {
          return { id: item.id, content: item.content, success: false };
        }
      }),
    );

    await this.usersService.incrementAIGenerations(user.id, body.items.length);

    return { results };
  }

  /**
   * Get AI suggestions for slide content
   */
  @Post('slide-suggestions')
  @HttpCode(HttpStatus.OK)
  async getSlideSuggestions(
    @CurrentUser() user: { id: string },
    @Body() body: SlideSuggestionsDto,
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const instruction = `Analyze this slide content and provide 3-5 specific suggestions to improve it. Consider:
1. Clarity and conciseness of the message
2. Visual appeal and structure
3. Engagement and impact
4. Missing information or context
${body.slideType ? `This is a ${body.slideType} slide.` : ''}
Return suggestions as a numbered list.`;

    const suggestions = await this.aiService.enhanceContent(
      body.currentContent,
      instruction,
    );
    await this.usersService.incrementAIGenerations(user.id);

    return { suggestions };
  }

  /**
   * Generate content ideas for a slide
   */
  @Post('content-ideas')
  @HttpCode(HttpStatus.OK)
  async generateContentIdeas(
    @CurrentUser() user: { id: string },
    @Body() body: { topic: string; slideType?: string; count?: number },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const count = body.count || 5;
    const instruction = `Generate ${count} creative content ideas for a presentation slide about "${body.topic}".
${body.slideType ? `Slide type: ${body.slideType}` : ''}
For each idea, provide:
1. A compelling headline
2. 2-3 bullet points or key messages
3. Suggested visual element (icon, image concept, or chart type)

Format as a numbered list with clear structure.`;

    const ideas = await this.aiService.enhanceContent(body.topic, instruction);
    await this.usersService.incrementAIGenerations(user.id);

    return { ideas };
  }

  // ============================================
  // ADVANCED AI ENDPOINTS - GAMMA LEVEL
  // ============================================

  /**
   * Generate AI image using DALL-E 3
   */
  @Post('generate-image')
  @HttpCode(HttpStatus.OK)
  @ThrottleImageGeneration()
  async generateImage(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      prompt: string;
      style?: 'vivid' | 'natural';
      size?: '1024x1024' | '1792x1024' | '1024x1792';
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.aiService.generateImage(
      body.prompt,
      body.style || 'vivid',
      body.size || '1792x1024',
    );

    await this.usersService.incrementAIGenerations(user.id, 5); // Image generation costs more

    return result;
  }

  /**
   * Generate text-to-speech narration
   */
  @Post('generate-narration')
  @HttpCode(HttpStatus.OK)
  async generateNarration(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      text: string;
      voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
      speed?: number;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.aiService.generateNarration(
      body.text,
      body.voice || 'nova',
      body.speed || 1.0,
    );

    await this.usersService.incrementAIGenerations(user.id, 3);

    return {
      audio: result.audioBuffer.toString('base64'),
      duration: result.duration,
      mimeType: 'audio/mpeg',
    };
  }

  /**
   * Generate chart data from natural language
   */
  @Post('generate-chart')
  @HttpCode(HttpStatus.OK)
  async generateChart(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      description: string;
      chartType?: 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const chartData = await this.aiService.generateChartData(
      body.description,
      body.chartType || 'bar',
    );

    await this.usersService.incrementAIGenerations(user.id);

    return { chartData };
  }

  /**
   * Generate chart data with real-time information
   */
  @Post('generate-chart-data')
  @HttpCode(HttpStatus.OK)
  async generateChartWithRealData(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      title: string;
      topic: string;
      chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
      useRealTimeData?: boolean;
      projectId?: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    let chartData;
    if (body.useRealTimeData) {
      chartData = await this.aiService.generateChartWithRealData(
        body.title,
        body.topic,
        body.chartType || 'bar',
      );
    } else {
      chartData = await this.aiService.generateChartData(
        body.topic,
        body.chartType || 'bar',
      );
    }

    await this.usersService.incrementAIGenerations(user.id);

    return chartData;
  }

  /**
   * Advanced presentation generation with smart layouts
   */
  @Post('generate-advanced')
  @HttpCode(HttpStatus.OK)
  async generateAdvancedPresentation(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      topic: string;
      tone?: string;
      audience?: string;
      length?: number;
      type?: string;
      generateImages?: boolean;
      imageSource?: 'ai' | 'stock';
      smartLayout?: boolean;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const presentation =
      await this.aiService.generateAdvancedPresentation(body);

    // Advanced generation costs more
    const cost = body.generateImages ? 10 : 2;
    await this.usersService.incrementAIGenerations(user.id, cost);

    return presentation;
  }

  /**
   * Generate speaker notes for all slides
   */
  @Post('generate-all-notes')
  @HttpCode(HttpStatus.OK)
  async generateAllSpeakerNotes(
    @CurrentUser() user: { id: string },
    @Body() body: { presentation: GeneratedPresentation },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const notes = await this.aiService.generateAllSpeakerNotes(
      body.presentation,
    );
    await this.usersService.incrementAIGenerations(user.id, 2);

    return { notes };
  }

  /**
   * Translate presentation content
   */
  @Post('translate')
  @HttpCode(HttpStatus.OK)
  async translateContent(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      content: string;
      targetLanguage: string;
      preserveFormatting?: boolean;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const translated = await this.aiService.translateContent(
      body.content,
      body.targetLanguage,
      body.preserveFormatting ?? true,
    );

    await this.usersService.incrementAIGenerations(user.id);

    return { translated, targetLanguage: body.targetLanguage };
  }

  /**
   * Extract and structure document into presentation
   */
  @Post('document-to-slides')
  @HttpCode(HttpStatus.OK)
  async documentToSlides(
    @CurrentUser() user: { id: string },
    @Body() body: { documentText: string; targetSlides?: number },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const presentation = await this.aiService.extractAndStructureDocument(
      body.documentText,
      body.targetSlides || 10,
    );

    await this.usersService.incrementAIGenerations(user.id, 3);

    return presentation;
  }

  /**
   * Recommend layout for slide content
   */
  @Post('recommend-layout')
  @HttpCode(HttpStatus.OK)
  recommendLayout(
    @CurrentUser() _user: { id: string },
    @Body() body: { blocks: GeneratedBlock[]; heading: string },
  ) {
    const layout = this.aiService.recommendLayout(body.blocks, body.heading);
    return { layout };
  }

  /**
   * Generate custom presentation background from prompt
   */
  @Post('generate-background')
  @HttpCode(HttpStatus.OK)
  async generateBackground(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      prompt: string;
      style?:
        | 'abstract'
        | 'gradient'
        | 'geometric'
        | 'minimal'
        | 'nature'
        | 'professional'
        | 'creative';
      colorScheme?: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    // Enhance the prompt for background generation
    const styleDescriptions = {
      abstract: 'abstract artistic patterns',
      gradient: 'smooth flowing gradients',
      geometric: 'geometric shapes and patterns',
      minimal: 'minimal clean design',
      nature: 'natural organic elements',
      professional: 'professional corporate style',
      creative: 'creative and imaginative',
    };

    const styleDesc = styleDescriptions[body.style || 'professional'];
    const enhancedPrompt = `Create a presentation background with ${styleDesc}. ${body.prompt}. ${body.colorScheme ? `Color scheme: ${body.colorScheme}.` : ''} The image should be suitable as a slide background - not too busy, with good contrast for text overlay. Wide aspect ratio.`;

    const result = await this.aiService.generateImage(
      enhancedPrompt,
      'vivid',
      '1792x1024', // Wide format perfect for presentations
    );

    await this.usersService.incrementAIGenerations(user.id, 5); // Premium feature

    return {
      ...result,
      originalPrompt: body.prompt,
      enhancedPrompt,
      style: body.style || 'professional',
    };
  }

  /**
   * Batch generate multiple background variations
   */
  @Post('generate-backgrounds-batch')
  @HttpCode(HttpStatus.OK)
  async generateBackgroundsBatch(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      prompts: string[];
      style?: string;
      colorScheme?: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    if (body.prompts.length > 4) {
      throw new ForbiddenException('Maximum 4 backgrounds per batch');
    }

    const results = await Promise.all(
      body.prompts.map(async (prompt) => {
        try {
          const styleDesc = body.style || 'professional';
          const enhancedPrompt = `Create a presentation background with ${styleDesc} style. ${prompt}. ${body.colorScheme ? `Color scheme: ${body.colorScheme}.` : ''} Suitable for text overlay, not too busy.`;

          const result = await this.aiService.generateImage(
            enhancedPrompt,
            'vivid',
            '1792x1024',
          );

          return { success: true, ...result, prompt };
        } catch {
          return { success: false, prompt, error: 'Generation failed' };
        }
      }),
    );

    await this.usersService.incrementAIGenerations(
      user.id,
      body.prompts.length * 5,
    );

    return { results };
  }

  /**
   * Get background presets for quick generation
   */
  @Post('background-presets')
  @HttpCode(HttpStatus.OK)
  getBackgroundPresets(@Body() body: { industry?: string; style?: string }) {
    const presets = this.backgroundLibrary.getPresetPrompts(
      body.industry || 'business',
      body.style || 'professional',
    );
    return { presets };
  }

  /**
   * Save background to user library
   */
  @Post('background-library/save')
  @HttpCode(HttpStatus.OK)
  async saveBackgroundToLibrary(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      url: string;
      prompt: string;
      style: string;
      colorScheme?: string;
    },
  ) {
    const saved = await this.backgroundLibrary.saveBackground(
      user.id,
      body.url,
      body.prompt,
      body.style,
      body.colorScheme,
    );
    return saved;
  }

  /**
   * Get user's background library
   */
  @Get('background-library')
  @HttpCode(HttpStatus.OK)
  async getBackgroundLibrary(@CurrentUser() user: { id: string }) {
    const backgrounds = await this.backgroundLibrary.getUserBackgrounds(
      user.id,
    );
    return { backgrounds };
  }

  /**
   * Delete background from library
   */
  @Delete('background-library/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBackgroundFromLibrary(
    @CurrentUser() user: { id: string },
    @Param('id') backgroundId: string,
  ) {
    await this.backgroundLibrary.deleteBackground(user.id, backgroundId);
    return { success: true };
  }

  /**
   * Get layout suggestions for a slide
   */
  @Post('layout-suggestions')
  @HttpCode(HttpStatus.OK)
  getLayoutSuggestions(
    @Body()
    body: {
      blocks: { id: string; type: string; content: unknown }[];
      heading?: string;
    },
  ) {
    const suggestions = this.autoLayoutService.suggestLayouts({
      blocks: body.blocks,
      heading: body.heading,
    });
    return { suggestions };
  }

  /**
   * Auto-layout a slide using AI
   */
  @Post('auto-layout')
  @HttpCode(HttpStatus.OK)
  async autoLayout(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      blocks: { id: string; type: string; content: unknown }[];
      heading?: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const layout = await this.autoLayoutService.autoLayout({
      blocks: body.blocks,
      heading: body.heading,
    });

    await this.usersService.incrementAIGenerations(user.id);
    return { layout };
  }

  /**
   * Get layout recommendations based on block types
   */
  @Post('layout-recommendations')
  @HttpCode(HttpStatus.OK)
  getLayoutRecommendations(@Body() body: { blockTypes: string[] }) {
    const recommendations = this.autoLayoutService.getRecommendations(
      body.blockTypes,
    );
    return { recommendations };
  }

  // ============================================
  // AI CHAT ASSISTANT ENDPOINTS (GAMMA AGENT)
  // ============================================

  /**
   * AI Chat - Process chat message in slide context
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async processChat(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      projectId: string;
      slideContext: SlideContext;
      message: string;
      conversationHistory?: Array<{
        role: 'user' | 'assistant';
        content: string;
      }>;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const response = await this.aiChatService.processChat(
      user.id,
      body.projectId,
      body.slideContext,
      body.message,
      body.conversationHistory || [],
    );

    await this.usersService.incrementAIGenerations(user.id);
    return response;
  }

  /**
   * AI Chat - Quick action on content
   */
  @Post('chat/quick-action')
  @HttpCode(HttpStatus.OK)
  async chatQuickAction(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      action:
        | 'improve'
        | 'shorten'
        | 'expand'
        | 'fix_grammar'
        | 'make_professional'
        | 'add_examples'
        | 'simplify';
      content: string;
      context?: SlideContext;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.aiChatService.quickAction(
      user.id,
      body.action,
      body.content,
      body.context,
    );

    await this.usersService.incrementAIGenerations(user.id);
    return result;
  }

  /**
   * AI Chat - Generate suggestions for slide
   */
  @Post('chat/suggestions')
  @HttpCode(HttpStatus.OK)
  async getChatSuggestions(
    @CurrentUser() _user: { id: string },
    @Body()
    body: {
      slideContext: SlideContext;
      type: 'next_slide' | 'improve_current' | 'add_visuals' | 'transitions';
    },
  ) {
    const suggestions = await this.aiChatService.generateSuggestions(
      body.slideContext,
      body.type,
    );
    return { suggestions };
  }

  /**
   * AI Chat - Rewrite entire slide
   */
  @Post('chat/rewrite-slide')
  @HttpCode(HttpStatus.OK)
  async rewriteSlide(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      slideContext: SlideContext;
      instruction: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.aiChatService.rewriteSlide(
      body.slideContext,
      body.instruction,
    );

    await this.usersService.incrementAIGenerations(user.id, 2);
    return result;
  }

  // ============================================
  // URL IMPORT ENDPOINTS
  // ============================================

  /**
   * Import presentation from URL
   */
  @Post('import-url')
  @HttpCode(HttpStatus.OK)
  async importFromURL(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      url: string;
      targetSlides?: number;
      style?: 'detailed' | 'summary' | 'bullet-points';
      includeImages?: boolean;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.urlImportService.importFromURL(body.url, {
      targetSlides: body.targetSlides,
      style: body.style,
      includeImages: body.includeImages,
    });

    await this.usersService.incrementAIGenerations(user.id, 5);
    return result;
  }

  /**
   * Import presentation from YouTube URL
   */
  @Post('import-youtube')
  @HttpCode(HttpStatus.OK)
  async importFromYouTube(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      url: string;
      targetSlides?: number;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const result = await this.urlImportService.importFromYouTube(body.url, {
      targetSlides: body.targetSlides,
    });

    await this.usersService.incrementAIGenerations(user.id, 5);
    return result;
  }

  // ============================================
  // ENHANCED FEATURES: CHARTS, EMOJIS, REAL-TIME DATA
  // ============================================

  /**
   * Generate enhanced presentation with charts, emojis, and rich content
   */
  @Post('generate-enhanced')
  @HttpCode(HttpStatus.OK)
  async generateEnhancedPresentation(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      topic: string;
      tone?: string;
      audience?: string;
      length?: number;
      includeCharts?: boolean;
      includeRealTimeData?: boolean;
      includeEmojis?: boolean;
      generateImages?: boolean;
      imageSource?: 'ai' | 'stock';
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const presentation = await this.aiService.generateEnhancedPresentation({
      topic: body.topic,
      tone: body.tone || 'professional',
      audience: body.audience || 'general',
      length: body.length || 5,
      includeCharts: body.includeCharts !== false,
      includeRealTimeData: body.includeRealTimeData !== false,
      includeEmojis: body.includeEmojis !== false,
      generateImages: body.generateImages || false,
      imageSource: body.imageSource || 'stock',
    });

    await this.usersService.incrementAIGenerations(user.id, body.length || 5);

    return {
      success: true,
      presentation,
      message:
        'Enhanced presentation generated with charts, emojis, and rich formatting',
    };
  }

  /**
   * Generate chart with real-time data
   */
  @Post('generate-chart-realtime')
  @HttpCode(HttpStatus.OK)
  async generateChartRealtime(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      title: string;
      topic: string;
      chartType?: 'bar' | 'line' | 'pie' | 'doughnut';
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const chartData = await this.aiService.generateChartWithRealData(
      body.title,
      body.topic,
      body.chartType || 'bar',
    );

    await this.usersService.incrementAIGenerations(user.id);

    return {
      success: true,
      chartData,
      message: 'Chart generated with real-time data',
    };
  }

  /**
   * Search real-time data for presentation content
   */
  @Post('search-realtime-data')
  @HttpCode(HttpStatus.OK)
  async searchRealTimeData(
    @CurrentUser() _user: { id: string },
    @Body()
    body: {
      query: string;
      limit?: number;
    },
  ) {
    const result = await this.realTimeDataService.search(
      body.query,
      body.limit || 5,
    );

    return {
      success: true,
      data: result,
      message: 'Real-time data retrieved',
    };
  }

  /**
   * Extract chart data from search results
   */
  @Post('extract-chart-data')
  @HttpCode(HttpStatus.OK)
  async extractChartData(
    @CurrentUser() _user: { id: string },
    @Body()
    body: {
      query: string;
      dataPoints?: number;
    },
  ) {
    const chartData = await this.aiService[
      'realTimeDataService'
    ].extractChartData(body.query, body.dataPoints || 5);

    return {
      success: true,
      chartData,
      message: 'Chart data extracted from real-time search',
    };
  }

  /**
   * Add emojis to text content
   */
  @Post('add-emojis')
  @HttpCode(HttpStatus.OK)
  async addEmojis(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      text: string;
      context?: string;
    },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation limit reached');
    }

    const enhancedText = await this.aiService.addEmojisToContent(
      body.text,
      body.context || '',
    );

    await this.usersService.incrementAIGenerations(user.id);

    return {
      success: true,
      text: enhancedText,
      original: body.text,
    };
  }

  /**
   * Get topic statistics from real-time search
   */
  @Post('topic-statistics')
  @HttpCode(HttpStatus.OK)
  async getTopicStatistics(
    @CurrentUser() _user: { id: string },
    @Body()
    body: {
      topic: string;
    },
  ) {
    const statistics = await this.realTimeDataService.getTopicStatistics(
      body.topic,
    );

    return {
      success: true,
      statistics,
      message: 'Topic statistics retrieved',
    };
  }
  // ============================================
  // IMAGE RECOGNITION ENDPOINTS
  // ============================================

  /**
   * Analyze image for presentation suitability and context
   */
  @Post('analyze-image')
  @HttpCode(HttpStatus.OK)
  async analyzeImage(
    @CurrentUser() user: { id: string },
    @Body() body: { imageUrl: string },
  ) {
    const canGenerate = await this.usersService.canGenerateAI(user.id);
    if (!canGenerate) {
      throw new ForbiddenException('AI generation usage limit reached');
    }

    const analysis = await this.imageRecognitionService.analyzeImage(
      body.imageUrl,
    );

    // Analysis cost
    await this.usersService.incrementAIGenerations(user.id, 2);
    return { analysis };
  }
}
