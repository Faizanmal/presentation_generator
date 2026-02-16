import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import OpenAI from 'openai';

export interface ImageAnalysisResult {
  labels: string[];
  objects: string[];
  colors: string[];
  safeSearch: {
    adult: string;
    violence: string;
    racy: string;
  };
  sceneryType: string; // 'indoor', 'outdoor', 'people', 'nature', 'abstract'
  bestForSlideType: string[]; // 'title', 'content', 'comparison', 'team'
}

@Injectable()
export class ImageRecognitionService {
  private readonly logger = new Logger(ImageRecognitionService.name);
  private client: ImageAnnotatorClient;
  private openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    // Initialize Google Cloud Vision Client
    // Requires GOOGLE_APPLICATION_CREDENTIALS env var or key file path
    const keyFile = this.configService.get<string>(
      'GOOGLE_APPLICATION_CREDENTIALS',
    );
    if (keyFile) {
      this.client = new ImageAnnotatorClient({ keyFilename: keyFile });
    } else {
      // Fallback to constructor without config if env var is set globally or using default credentials
      this.client = new ImageAnnotatorClient();
    }

    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Analyze an image to understand its content and suitability
   */
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    try {
      // 1. Perform Label, Object, and SafeSearch Detection
      const [result] = await this.client.annotateImage({
        image: { source: { imageUri: imageUrl } },
        features: [
          { type: 'LABEL_DETECTION' },
          { type: 'OBJECT_LOCALIZATION' },
          { type: 'IMAGE_PROPERTIES' },
          { type: 'SAFE_SEARCH_DETECTION' },
        ],
      });

      // 2. Extract Data
      const labels =
        result.labelAnnotations?.map((l) => l.description || '') || [];
      const objects =
        result.localizedObjectAnnotations?.map((o) => o.name || '') || [];
      const colors =
        result.imagePropertiesAnnotation?.dominantColors?.colors
          ?.slice(0, 3)
          .map((c) =>
            this.rgbToHex(c.color?.red, c.color?.green, c.color?.blue),
          ) || [];

      const safeSearch = {
        adult: result.safeSearchAnnotation?.adult || 'UNKNOWN',
        violence: result.safeSearchAnnotation?.violence || 'UNKNOWN',
        racy: result.safeSearchAnnotation?.racy || 'UNKNOWN',
      };

      // 3. Determine Scenery Type & Best Use Case (Heuristic + Labels)
      const sceneryType = this.determineSceneryType(labels, objects);
      const bestForSlideType = this.determineSlideUsage(
        labels,
        objects,
        sceneryType,
      );

      return {
        labels,
        objects,
        colors,
        safeSearch,
        sceneryType,
        bestForSlideType,
      };
    } catch (error) {
      this.logger.error('Failed to analyze image with Google Vision', error);
      // Fallback to OpenAI Vision if Google fails or isn't configured often happens in dev
      return this.analyzeWithOpenAIVision(imageUrl);
    }
  }

  /**
   * Determine Scenery Type based on labels
   */
  private determineSceneryType(labels: string[], objects: string[]): string {
    const text = [...labels, ...objects].join(' ').toLowerCase();
    if (
      text.includes('person') ||
      text.includes('people') ||
      text.includes('human')
    )
      return 'people';
    if (
      text.includes('nature') ||
      text.includes('landscape') ||
      text.includes('sky') ||
      text.includes('tree')
    )
      return 'nature';
    if (
      text.includes('pattern') ||
      text.includes('texture') ||
      text.includes('fractal')
    )
      return 'abstract';
    if (
      text.includes('room') ||
      text.includes('interior') ||
      text.includes('indoor')
    )
      return 'indoor';
    if (
      text.includes('building') ||
      text.includes('city') ||
      text.includes('architecture')
    )
      return 'outdoor';
    return 'general';
  }

  /**
   * Determine best slide type usage
   */
  private determineSlideUsage(
    labels: string[],
    objects: string[],
    scenery: string,
  ): string[] {
    const usage = new Set<string>();
    const text = [...labels, ...objects].join(' ').toLowerCase();

    if (scenery === 'abstract' || scenery === 'nature') usage.add('title');
    if (scenery === 'people' || text.includes('team')) usage.add('team');
    if (
      text.includes('chart') ||
      text.includes('graph') ||
      text.includes('diagram')
    )
      usage.add('data');
    if (text.includes('product') || text.includes('device'))
      usage.add('product');

    // Default fallback
    if (usage.size === 0) usage.add('content');

    return Array.from(usage);
  }

  /**
   * Fallback analysis using OpenAI GPT-4o Vision
   */
  private async analyzeWithOpenAIVision(
    imageUrl: string,
  ): Promise<ImageAnalysisResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Analyze this image for presentation use. Return JSON with:
            - labels: key descriptive tags
            - objects: main objects visible
            - sceneryType: 'indoor', 'outdoor', 'people', 'nature', 'abstract'
            - bestForSlideType: ['title', 'content', 'team', etc.]
            - colors: dominant hex colors (guess 3)
            - safeSearch: assess 'adult', 'violence', 'racy' as 'VERY_UNLIKELY' to 'POSSIBLE'
            `,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this image.' },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No content');
      return JSON.parse(content) as ImageAnalysisResult;
    } catch (err) {
      this.logger.error('OpenAI Vision fallback failed', err);
      throw new InternalServerErrorException('Image analysis failed');
    }
  }

  private rgbToHex(
    r?: number | null,
    g?: number | null,
    b?: number | null,
  ): string {
    const red = r ?? 0;
    const green = g ?? 0;
    const blue = b ?? 0;

    const componentToHex = (c: number) => {
      const hex = c.toString(16);
      return hex.length == 1 ? '0' + hex : hex;
    };
    return (
      '#' +
      componentToHex(Math.round(red)) +
      componentToHex(Math.round(green)) +
      componentToHex(Math.round(blue))
    );
  }
}
