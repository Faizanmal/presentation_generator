import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProjectStatus)
  @IsOptional()
  status?: ProjectStatus;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsOptional()
  themeId?: string;

  /** Canonical AI PresentationDocument (includes editMemory) */
  @IsObject()
  @IsOptional()
  dslDocument?: Record<string, unknown>;
}
