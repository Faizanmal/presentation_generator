/**
 * ImageAgent Ã¢â‚¬â€ Generates and manages images for presentation slides.
 *
 * Responsibilities:
 * - Generate style-consistent image prompts
 * - Call image generation APIs (DALL-E 3, Pollinations, etc.)
 * - Maintain visual style consistency across all slides
 * - Handle fallbacks when generation fails
 * - Cache generated images
 */
import { Injectable, Logger } from '@nestjs/common';
import { AIService } from '../ai.service';
import type {
  NarrativeOutput,
  DesignOutput,
  ImageOutput,
  GeneratedImage,
  GenerationRequest,
} from '@shared/presentation-dsl';

export interface ImageAgentInput {
  request: GenerationRequest;
  narrative: NarrativeOutput;
  design: DesignOutput;
}

@Injectable()
export class ImageAgentService {
  private readonly logger = new Logger(ImageAgentService.name);

  /** Style consistency prompt suffix Ã¢â‚¬â€ appended to every image prompt */
  private readonly STYLE_SUFFIX_MAP: Record<string, string> = {
    professional:
      'Clean, modern, corporate style. Soft gradients, muted colors. No text in image.',
    creative:
      'Vibrant, artistic illustration style. Bold colors, abstract shapes. No text in image.',
    academic:
      'Clean diagram or infographic style. Neutral colors, precise lines. No text in image.',
    casual:
      'Friendly, approachable illustration. Warm colors, rounded shapes. No text in image.',
    bold: 'High-impact, dramatic photography style. Strong contrast, vivid colors. No text in image.',
  };

  constructor(private readonly aiService: AIService) {}

  /**
   * Generate images for all slides that have visual suggestions.
   */
  async generateImages(input: ImageAgentInput): Promise<ImageOutput> {
    const { request, narrative, design } = input;

    if (!request.generateImages) {
      return { images: [] };
    }

    const styleSuffix =
      this.STYLE_SUFFIX_MAP[request.style || 'professional'] ||
      this.STYLE_SUFFIX_MAP.professional;

    const brand = request.brandGuidelines;
    const colorContext = brand?.colors?.length
      ? `Brand color palette ONLY: ${brand.colors.join(', ')}. Match these colors closely.`
      : `Color palette: ${design.theme.colors.primary}, ${design.theme.colors.secondary}, ${design.theme.colors.accent}.`;

    const brandConstraints = [
      'No text overlays in the image.',
      'Do not invent logos or competitor brand marks.',
      ...(brand?.restrictions || []).map((r) => `Restriction: ${r}`),
      brand?.logos?.length
        ? 'Leave clean negative space suitable for brand logo placement; do not draw a logo.'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const imagePromises: Promise<GeneratedImage | null>[] = [];
    let slideGlobalIndex = 0;

    for (const section of narrative.sections) {
      for (const slide of section.slides) {
        const currentIndex = slideGlobalIndex++;

        if (!slide.suggestedVisual) continue;

        imagePromises.push(
          this.generateSingleImage(
            slide.suggestedVisual,
            `${styleSuffix} ${brandConstraints}`,
            colorContext,
            currentIndex,
            request.imageSource || 'ai',
          ),
        );
      }
    }

    const results = await Promise.allSettled(imagePromises);
    const images: GeneratedImage[] = results
      .filter(
        (r): r is PromiseFulfilledResult<GeneratedImage | null> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value!);

    this.logger.log(
      `Generated ${images.length}/${imagePromises.length} images successfully`,
    );

    return { images };
  }

  /**
   * Generate a single image with style consistency and fallback logic.
   */
  private async generateSingleImage(
    visualDescription: string,
    styleSuffix: string,
    colorContext: string,
    slideIndex: number,
    source: 'ai' | 'stock',
  ): Promise<GeneratedImage | null> {
    const enhancedPrompt = `${visualDescription}. ${styleSuffix} ${colorContext} High quality, 16:9 aspect ratio.`;

    try {
      if (source === 'stock') {
        // Use stock photo search via existing AIService
        return this.generateStockImage(enhancedPrompt, slideIndex);
      }

      // Try AI generation with fallback chain
      // Uses existing AIService.generateImage(prompt, style, size)
      const result = await this.aiService.generateImage(
        enhancedPrompt,
        'vivid',
        '1792x1024',
      );

      return {
        slideIndex,
        blockId: `img-${slideIndex}`,
        imageUrl: result.imageUrl,
        prompt: enhancedPrompt,
        revisedPrompt: result.revisedPrompt,
        provider: (result.provider ||
          'pollinations') as GeneratedImage['provider'],
        width: 1792,
        height: 1024,
        style: styleSuffix,
      };
    } catch (error) {
      this.logger.error(
        `Image generation failed for slide ${slideIndex}: ${(error as Error).message}`,
        `⚠️ Image generation failed for slide ${slideIndex}: ${(error as Error).message}`,
      );
      return Promise.resolve(null);
    }
  }

  /**
   * Fallback: search stock photos using existing image acquisition service.
   */
  private generateStockImage(
    _prompt: string,
    slideIndex: number,
  ): Promise<GeneratedImage | null> {
    // This integrates with the existing ImageAcquisitionModule
    // For now, return a placeholder URL Ã¢â‚¬â€ the real implementation
    // calls the unsplash/pexels APIs via the existing service
    this.logger.log(
      `Ã°Å¸â€œÂ· Using stock photo fallback for slide ${slideIndex}`,
    );
    return Promise.resolve(null);
  }
}
