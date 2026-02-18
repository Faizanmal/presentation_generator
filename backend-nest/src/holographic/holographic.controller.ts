import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HolographicService } from './holographic.service';

class CreatePreviewDto {
  projectId: string;
  displayType?: 'looking_glass' | 'pepper_ghost' | 'webgl_3d';
  depth?: number;
  viewAngle?: number;
  quiltColumns?: number;
  quiltRows?: number;
  views?: number;
}

@ApiTags('Holographic')
@Controller('holographic')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HolographicController {
  constructor(private readonly holographicService: HolographicService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Create holographic preview' })
  async createPreview(
    @Request() req: { user: { id: string } },
    @Body() dto: CreatePreviewDto,
  ) {
    return this.holographicService.createHolographicPreview(
      req.user.id,
      dto.projectId,
      dto,
    );
  }

  @Get('previews')
  @ApiOperation({ summary: 'Get user holographic previews' })
  async getUserPreviews(
    @Request() req: { user: { id: string } },
    @Query('projectId') projectId?: string,
  ) {
    return this.holographicService.getUserPreviews(req.user.id, projectId);
  }

  @Get('previews/:id')
  @ApiOperation({ summary: 'Get preview by ID' })
  async getPreview(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.holographicService.getPreview(id, req.user.id);
  }

  @Get('previews/:id/view')
  @ApiOperation({ summary: 'Get holographic viewer HTML' })
  async getViewerHTML(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.holographicService.generateViewerHTML(
      id,
      req.user.id,
    );
    res.type('text/html').send(html);
  }

  @Delete('previews/:id')
  @ApiOperation({ summary: 'Delete preview' })
  async deletePreview(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.holographicService.deletePreview(id, req.user.id);
  }
}
