import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

export enum GenerationTone {
  PROFESSIONAL = 'professional',
  CASUAL = 'casual',
  ACADEMIC = 'academic',
  CREATIVE = 'creative',
  PERSUASIVE = 'persuasive',
}

export enum GenerationType {
  PRESENTATION = 'presentation',
  DOCUMENT = 'document',
}

export enum GenerationDesignStyle {
  EDITORIAL = 'editorial',
  EXECUTIVE = 'executive',
  BOLD = 'bold',
  MANIFESTO = 'manifesto',
}

export class GenerateProjectDto {
  @IsString()
  topic!: string;

  @IsEnum(GenerationTone)
  @IsOptional()
  tone?: GenerationTone = GenerationTone.PROFESSIONAL;

  @IsString()
  @IsOptional()
  audience?: string;

  @IsInt()
  @Min(3)
  @Max(20)
  @IsOptional()
  length?: number = 10;

  @IsEnum(GenerationType)
  @IsOptional()
  type?: GenerationType = GenerationType.PRESENTATION;

  @IsBoolean()
  @IsOptional()
  generateImages?: boolean = true;

  @IsString()
  @IsOptional()
  imageSource?: 'ai' | 'stock' = 'stock';

  @IsEnum(GenerationDesignStyle)
  @IsOptional()
  designStyle?: GenerationDesignStyle = GenerationDesignStyle.EDITORIAL;

  @IsBoolean()
  @IsOptional()
  qualityMode?: boolean = false;
}
