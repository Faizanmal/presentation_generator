import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsArray,
} from 'class-validator';

export enum BackgroundStyle {
  ABSTRACT = 'abstract',
  GRADIENT = 'gradient',
  GEOMETRIC = 'geometric',
  MINIMAL = 'minimal',
  NATURE = 'nature',
  PROFESSIONAL = 'professional',
  CREATIVE = 'creative',
  TECH = 'tech',
  ELEGANT = 'elegant',
  VIBRANT = 'vibrant',
}

export class GenerateBackgroundDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsEnum(BackgroundStyle)
  @IsOptional()
  style?: BackgroundStyle;

  @IsString()
  @IsOptional()
  colorScheme?: string;

  @IsNumber()
  @Min(1)
  @Max(4)
  @IsOptional()
  variations?: number; // Generate multiple variations at once

  @IsBoolean()
  @IsOptional()
  textOptimized?: boolean; // Extra optimization for text overlay
}

export class BatchGenerateBackgroundDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  prompts: string[];

  @IsEnum(BackgroundStyle)
  @IsOptional()
  style?: BackgroundStyle;

  @IsString()
  @IsOptional()
  colorScheme?: string;
}

export class RefineBackgroundDto {
  @IsString()
  @IsNotEmpty()
  originalUrl: string;

  @IsString()
  @IsNotEmpty()
  instruction: string; // e.g., "make it darker", "add more blue"
}

export class BackgroundPresetDto {
  @IsEnum(BackgroundStyle)
  style: BackgroundStyle;

  @IsString()
  @IsOptional()
  industry?: string; // e.g., "tech", "finance", "education"
}
