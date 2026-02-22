import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BlockType } from '@prisma/client';

import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateBlockDto {
  @IsString()
  projectId: string;

  @IsString()
  @IsOptional()
  slideId?: string;

  @IsEnum(BlockType)
  blockType: BlockType;

  @IsObject()
  content: Record<string, unknown>;

  @IsNumber()
  order: number;

  @IsObject()
  @IsOptional()
  style?: Record<string, unknown>;
}

class UpdateBlockDto {
  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsObject()
  @IsOptional()
  style?: Record<string, unknown>;

  @IsEnum(BlockType)
  @IsOptional()
  blockType?: BlockType;
}

class ReorderBlockItem {
  @IsString()
  id: string;

  @IsNumber()
  order: number;
}

class ReorderBlocksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderBlockItem)
  blocks: Array<{ id: string; order: number }>;
}

class BatchUpdateBlockItem {
  @IsString()
  id: string;

  @IsObject()
  @IsOptional()
  content?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  style?: Record<string, unknown>;
}

class BatchUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchUpdateBlockItem)
  blocks: Array<{
    id: string;
    content?: Record<string, unknown>;
    style?: Record<string, unknown>;
  }>;
}

@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  /**
   * Create a new block
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string },
    @Body() createBlockDto: CreateBlockDto,
  ) {
    return this.blocksService.create(user.id, createBlockDto);
  }

  /**
   * Get all blocks for a slide
   */
  @Get('slide/:slideId')
  async findBySlide(@Param('slideId') slideId: string) {
    return this.blocksService.findBySlide(slideId);
  }

  /**
   * Update a block
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateBlockDto: UpdateBlockDto,
  ) {
    return this.blocksService.update(user.id, id, updateBlockDto);
  }

  /**
   * Delete a block
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.blocksService.remove(user.id, id);
  }

  /**
   * Reorder blocks
   */
  @Post('reorder/:projectId')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Body() reorderDto: ReorderBlocksDto,
  ) {
    return this.blocksService.reorder(user.id, projectId, reorderDto);
  }

  /**
   * Batch update blocks (for auto-save)
   */
  @Post('batch/:projectId')
  @HttpCode(HttpStatus.OK)
  async batchUpdate(
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Body() batchUpdateDto: BatchUpdateDto,
  ) {
    return this.blocksService.batchUpdate(
      user.id,
      projectId,
      batchUpdateDto.blocks,
    );
  }
}
