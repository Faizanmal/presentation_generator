import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type {
  AudienceType,
  AdaptationResult,
} from './audience-adaptation.service';
import { AudienceAdaptationService } from './audience-adaptation.service';

class AdaptPresentationDto {
  targetAudience: AudienceType;
  adjustTone?: boolean = true;
  adjustLength?: boolean = true;
  adjustComplexity?: boolean = true;
  preserveKeyPoints?: boolean = true;
}

@Controller('audience-adaptation')
@UseGuards(JwtAuthGuard)
export class AudienceAdaptationController {
  constructor(private readonly adaptationService: AudienceAdaptationService) {}

  @Get('audience-types')
  getAudienceTypes() {
    return this.adaptationService.getAudienceTypes();
  }

  @Post(':projectId/preview')
  async previewAdaptation(
    @Param('projectId') projectId: string,
    @Body() dto: AdaptPresentationDto,
    @Request() req: { user: { id: string } },
  ): Promise<AdaptationResult> {
    return this.adaptationService.adaptPresentation(projectId, req.user.id, {
      targetAudience: dto.targetAudience,
      adjustTone: dto.adjustTone ?? true,
      adjustLength: dto.adjustLength ?? true,
      adjustComplexity: dto.adjustComplexity ?? true,
      preserveKeyPoints: dto.preserveKeyPoints ?? true,
    });
  }

  @Get(':projectId/suggestions/:audienceType')
  async getSuggestions(
    @Param('projectId') projectId: string,
    @Param('audienceType') audienceType: AudienceType,
    @Request() req: { user: { id: string } },
  ): Promise<{
    suggestions: Array<{
      slideId: string;
      suggestion: string;
      priority: 'high' | 'medium' | 'low';
    }>;
  }> {
    return this.adaptationService.getAudienceSuggestions(
      projectId,
      req.user.id,
      audienceType,
    );
  }
}
