import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from './ai.service';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface SlideContext {
  slideId: string;
  heading?: string;
  blocks?: Array<{
    type: string;
    content: string;
  }>;
  speakerNotes?: string;
}

export interface ChatResponse {
  message: string;
  suggestedActions?: Array<{
    type:
      | 'edit_text'
      | 'add_block'
      | 'remove_block'
      | 'change_layout'
      | 'add_image'
      | 'restyle';
    target?: string;
    payload: Record<string, unknown>;
    description: string;
  }>;
  updatedContent?: {
    heading?: string;
    blocks?: Array<{
      type: string;
      content: string;
    }>;
  };
}

@Injectable()
export class AIChatService {
  private readonly logger = new Logger(AIChatService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
  ) {}

  /**
   * Process a chat message in the context of a slide
   * This is the core "Gamma Agent" feature
   */
  async processChat(
    userId: string,
    projectId: string,
    slideContext: SlideContext,
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
  ): Promise<ChatResponse> {
    this.logger.log(`Processing chat for user ${userId}, project ${projectId}`);

    const systemPrompt = this.buildSystemPrompt(slideContext);

    const messages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage },
    ];

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new BadRequestException('No response from AI');
      }

      const parsed = JSON.parse(content) as {
        message: string;
        suggestedActions?: ChatResponse['suggestedActions'];
        updatedContent?: ChatResponse['updatedContent'];
      };

      // Log the chat interaction
      this.logChatInteraction(userId, projectId, userMessage, parsed.message);

      return {
        message: parsed.message,
        suggestedActions: parsed.suggestedActions,
        updatedContent: parsed.updatedContent,
      };
    } catch (error) {
      this.logger.error('AI Chat error:', error);
      throw new BadRequestException('Failed to process chat message');
    }
  }

  /**
   * Quick actions - predefined AI operations
   */
  async quickAction(
    _userId: string,
    action:
      | 'improve'
      | 'shorten'
      | 'expand'
      | 'fix_grammar'
      | 'make_professional'
      | 'add_examples'
      | 'simplify',
    content: string,
    context?: SlideContext,
  ): Promise<{ result: string; explanation: string }> {
    const actionPrompts: Record<string, string> = {
      improve:
        'Make this content more engaging, clear, and impactful while keeping the core message.',
      shorten:
        'Condense this content to be more concise while preserving key information.',
      expand: 'Add more detail, examples, and depth to this content.',
      fix_grammar: 'Fix any grammar, spelling, or punctuation errors.',
      make_professional:
        'Rewrite this in a more professional, business-appropriate tone.',
      add_examples:
        'Add relevant examples or analogies to illustrate the points.',
      simplify:
        'Simplify this content for a general audience, avoiding jargon.',
    };

    const prompt = actionPrompts[action] || actionPrompts.improve;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a presentation content editor. ${prompt}
            
Context: ${context ? `This is for a slide titled "${context.heading}"` : 'This is presentation content.'}

Respond in JSON format:
{
  "result": "the improved content",
  "explanation": "brief explanation of changes made"
}`,
          },
          { role: 'user', content },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const parsed = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      ) as {
        result: string;
        explanation: string;
      };
      return {
        result: parsed.result || content,
        explanation: parsed.explanation || 'Content updated',
      };
    } catch (error) {
      this.logger.error('Quick action error:', error);
      throw new BadRequestException('Failed to process quick action');
    }
  }

  /**
   * Generate content suggestions based on current slide
   */
  async generateSuggestions(
    slideContext: SlideContext,
    type: 'next_slide' | 'improve_current' | 'add_visuals' | 'transitions',
  ): Promise<Array<{ title: string; description: string; preview?: string }>> {
    const typePrompts: Record<string, string> = {
      next_slide:
        'Suggest what the next slide should be about based on the current slide content.',
      improve_current:
        'Suggest improvements for the current slide content and layout.',
      add_visuals:
        'Suggest visuals, charts, or images that would enhance this slide.',
      transitions:
        'Suggest transition text or bridge content to connect with the next slide.',
    };

    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a presentation design expert. ${typePrompts[type]}

Current slide context:
- Heading: ${slideContext.heading || 'No heading'}
- Content blocks: ${slideContext.blocks?.map((b) => `[${b.type}] ${b.content.substring(0, 100)}`).join(', ') || 'No content'}

Respond with JSON array of 3 suggestions:
[
  { "title": "suggestion title", "description": "detailed description", "preview": "optional preview text" }
]`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content;
      const parsed = JSON.parse(content || '{"suggestions":[]}') as {
        suggestions?: Array<{
          title: string;
          description: string;
          preview?: string;
        }>;
      };
      return parsed.suggestions || [];
    } catch (error) {
      this.logger.error('Generate suggestions error:', error);
      return [];
    }
  }

  /**
   * Rewrite entire slide based on instruction
   */
  async rewriteSlide(
    slideContext: SlideContext,
    instruction: string,
  ): Promise<{
    heading: string;
    blocks: Array<{ type: string; content: string }>;
  }> {
    try {
      const response = await this.aiService.chatCompletion({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a presentation content expert. Rewrite the slide content based on the user's instruction.

Current slide:
- Heading: ${slideContext.heading}
- Blocks: ${JSON.stringify(slideContext.blocks)}

Respond with JSON:
{
  "heading": "new heading",
  "blocks": [
    { "type": "paragraph|bullet|heading|subheading|quote", "content": "content" }
  ]
}`,
          },
          { role: 'user', content: instruction },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const parsed = JSON.parse(
        response.choices[0]?.message?.content || '{}',
      ) as {
        heading: string;
        blocks: Array<{ type: string; content: string }>;
      };
      return {
        heading: parsed.heading || slideContext.heading || '',
        blocks: parsed.blocks || slideContext.blocks || [],
      };
    } catch (error) {
      this.logger.error('Rewrite slide error:', error);
      throw new BadRequestException('Failed to rewrite slide');
    }
  }

  private buildSystemPrompt(slideContext: SlideContext): string {
    return `You are an AI presentation assistant embedded in a slide editor. You help users create and improve their presentations through natural conversation.

CURRENT SLIDE CONTEXT:
- Slide ID: ${slideContext.slideId}
- Heading: ${slideContext.heading || 'No heading yet'}
- Content Blocks: ${JSON.stringify(slideContext.blocks || [])}
- Speaker Notes: ${slideContext.speakerNotes || 'None'}

YOUR CAPABILITIES:
1. Edit text content (headings, paragraphs, bullet points)
2. Suggest and add new content blocks
3. Recommend layout changes
4. Generate or suggest images
5. Improve writing quality
6. Restructure content

RESPONSE FORMAT (JSON):
{
  "message": "Your conversational response to the user",
  "suggestedActions": [
    {
      "type": "edit_text | add_block | remove_block | change_layout | add_image | restyle",
      "target": "optional block ID or selector",
      "payload": { /* action-specific data */ },
      "description": "Human-readable description of the action"
    }
  ],
  "updatedContent": {
    "heading": "optional new heading if changed",
    "blocks": [/* optional array of updated/new blocks */]
  }
}

GUIDELINES:
- Be helpful and proactive in suggesting improvements
- When user asks to change something, provide the updated content directly
- Keep responses concise but informative
- If unsure what user wants, ask clarifying questions
- Always explain what changes you're making`;
  }

  private logChatInteraction(
    userId: string,
    projectId: string,
    userMessage: string,
    assistantResponse: string,
  ): void {
    try {
      // Log to analytics or a chat history table if needed
      this.logger.log(
        `Chat interaction logged for user ${userId}, project ${projectId}: "${userMessage.substring(0, 50)}..." -> "${assistantResponse.substring(0, 50)}..."`,
      );
      // Future: Store in database for conversation history
    } catch (error) {
      this.logger.warn('Failed to log chat interaction:', error);
    }
  }
}
