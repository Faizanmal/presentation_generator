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

class CreateBlockDto {
  projectId: string;
  slideId?: string;
  blockType: BlockType;
  content: any;
  order: number;
  style?: any;
}

class UpdateBlockDto {
  content?: any;
  order?: number;
  style?: any;
  blockType?: BlockType;
}

class ReorderBlocksDto {
  blocks: Array<{ id: string; order: number }>;
}

class BatchUpdateDto {
  blocks: Array<{ id: string; content?: any; style?: any }>;
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
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.blocksService.remove(user.id, id);
  }

  /**
   * Reorder blocks
   */
  @Post('reorder/:projectId')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser() user: any,
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
    @CurrentUser() user: any,
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
