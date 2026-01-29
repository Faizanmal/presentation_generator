import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ProjectType } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProjectType)
  @IsOptional()
  type?: ProjectType;
}
