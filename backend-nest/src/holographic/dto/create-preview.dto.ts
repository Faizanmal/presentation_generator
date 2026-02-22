import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class CreatePreviewDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsIn(['looking_glass', 'pepper_ghost', 'webgl_3d'])
  displayType?: 'looking_glass' | 'pepper_ghost' | 'webgl_3d';

  @IsOptional()
  @IsNumber()
  @Min(0)
  depth?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  viewAngle?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quiltColumns?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  quiltRows?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  views?: number;
}
