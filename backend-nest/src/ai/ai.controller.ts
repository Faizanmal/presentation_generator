import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { ForbiddenException } from '@nestjs/common';

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
  action: 'shorten' | 'expand' | 'simplify' | 'professional' | 'casual' | 'academic' | 'persuasive' | 'fix-grammar';
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
  ) { }

  /**
   * Enhance content using AI
   */
  @Post('enhance')
  @HttpCode(HttpStatus.OK)
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

    const notes = await this.aiService.enhanceContent(body.slideContent, instruction);
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
      shorten: 'Make this text shorter and more concise while keeping the key message intact. Remove unnecessary words.',
      expand: 'Expand this text with more details, examples, and explanations while maintaining the original message.',
      simplify: 'Simplify this text to make it easier to understand for a general audience. Use simpler words and shorter sentences.',
      professional: 'Rewrite this text in a professional, business-appropriate tone suitable for corporate presentations.',
      casual: 'Rewrite this text in a casual, friendly, and approachable tone.',
      academic: 'Rewrite this text in an academic, scholarly tone with formal language.',
      persuasive: 'Rewrite this text to be more persuasive, compelling, and action-oriented.',
      'fix-grammar': 'Fix any grammar, spelling, punctuation, and syntax errors in this text while preserving the original meaning.',
    };

    const instruction = instructions[body.action] || 'Improve this text';
    const transformed = await this.aiService.enhanceContent(body.text, instruction);
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
          const enhanced = await this.aiService.enhanceContent(item.content, body.instruction);
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

    const suggestions = await this.aiService.enhanceContent(body.currentContent, instruction);
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
}
