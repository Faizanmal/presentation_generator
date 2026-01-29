import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';

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

export class GenerateProjectDto {
  @IsString()
  topic: string;

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
  length?: number = 5;

  @IsEnum(GenerationType)
  @IsOptional()
  type?: GenerationType = GenerationType.PRESENTATION;
}
