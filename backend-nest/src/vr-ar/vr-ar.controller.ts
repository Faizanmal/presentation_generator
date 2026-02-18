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
import { VRARService } from './vr-ar.service';

class CreateVRExportDto {
  projectId: string;
  environment?: string;
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  interactionMode?: 'gaze' | 'controller' | 'hand';
  spatialAudio?: boolean;
  autoProgress?: boolean;
  transitionDuration?: number;
}

class CreateAROverlayDto {
  projectId: string;
  slideId: string;
  name: string;
  type?: 'marker' | 'surface' | 'face' | 'image_tracking';
  markerUrl?: string;
  content3d?: {
    model?: string;
    primitives?: Array<{
      type: 'box' | 'sphere' | 'cylinder' | 'plane';
      position: { x: number; y: number; z: number };
      dimensions: Record<string, number>;
      material: { color: string; opacity: number };
    }>;
  };
  animations?: Array<{
    property: string;
    from: number;
    to: number;
    duration: number;
    loop: boolean;
  }>;
}

@ApiTags('VR/AR')
@Controller('vr-ar')
export class VRARController {
  constructor(private readonly vrArService: VRARService) {}

  @Post('vr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create VR export for a presentation' })
  async createVRExport(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateVRExportDto,
  ) {
    return this.vrArService.createVRExport(req.user.id, dto.projectId, dto);
  }

  @Get('vr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user VR exports' })
  async getUserVRExports(
    @Request() req: { user: { id: string } },
    @Query('projectId') projectId?: string,
  ) {
    return this.vrArService.getUserVRExports(req.user.id, projectId);
  }

  @Get('vr/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get VR export by ID' })
  async getVRExport(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.vrArService.getVRExport(id, req.user.id);
  }

  @Get('exports/:id/webxr')
  @ApiOperation({ summary: 'Get WebXR HTML for VR export (public)' })
  async getWebXRExport(@Param('id') id: string, @Res() res: Response) {
    // Note: In production, you'd verify access via share token or auth
    const vrExport = await this.vrArService.getVRExport(id, '');
    // Generate and return HTML
    res.type('text/html').send(`<!-- WebXR content for ${vrExport.id} -->`);
  }

  @Delete('vr/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete VR export' })
  async deleteVRExport(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.vrArService.deleteVRExport(id, req.user.id);
  }

  @Post('ar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create AR overlay' })
  async createAROverlay(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateAROverlayDto,
  ) {
    return this.vrArService.createAROverlay(
      req.user.id,
      dto.projectId,
      dto.slideId,
      dto,
    );
  }

  @Get('ar/project/:projectId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AR overlays for a project' })
  async getProjectAROverlays(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.vrArService.getProjectAROverlays(projectId, req.user.id);
  }

  @Get('ar/:id/html')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get AR marker HTML' })
  async getARMarkerHTML(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.vrArService.generateARMarkerHTML(id, req.user.id);
    res.type('text/html').send(html);
  }

  @Delete('ar/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete AR overlay' })
  async deleteAROverlay(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.vrArService.deleteAROverlay(id, req.user.id);
  }
}
