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
import { SlidesService } from './slides.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class CreateSlideDto {
  projectId: string;
  order: number;
  layout?: string;
}

class UpdateSlideDto {
  layout?: string;
  order?: number;
}

class ReorderSlidesDto {
  slides: Array<{ id: string; order: number }>;
}

@Controller('slides')
@UseGuards(JwtAuthGuard)
export class SlidesController {
  constructor(private readonly slidesService: SlidesService) {}

  /**
   * Create a new slide
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string },
    @Body() createSlideDto: CreateSlideDto,
  ) {
    return this.slidesService.create(user.id, createSlideDto);
  }

  /**
   * Get a single slide
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.slidesService.findOne(id);
  }

  /**
   * Get all slides for a project
   */
  @Get('project/:projectId')
  async findByProject(@Param('projectId') projectId: string) {
    return this.slidesService.findByProject(projectId);
  }

  /**
   * Update a slide
   */
  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() updateSlideDto: UpdateSlideDto,
  ) {
    return this.slidesService.update(user.id, id, updateSlideDto);
  }

  /**
   * Delete a slide
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.slidesService.remove(user.id, id);
  }

  /**
   * Reorder slides
   */
  @Post('reorder/:projectId')
  @HttpCode(HttpStatus.OK)
  async reorder(
    @CurrentUser() user: { id: string },
    @Param('projectId') projectId: string,
    @Body() reorderDto: ReorderSlidesDto,
  ) {
    return this.slidesService.reorder(user.id, projectId, reorderDto);
  }

  /**
   * Duplicate a slide
   */
  @Post(':id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.slidesService.duplicate(user.id, id);
  }
}
