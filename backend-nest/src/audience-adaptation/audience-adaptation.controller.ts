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
import type { AudienceType, AdaptationOptions } from './audience-adaptation.service';
import { AudienceAdaptationService } from './audience-adaptation.service';

class AdaptPresentationDto {
  targetAudience: AudienceType;
  adjustTone?: boolean = true;
  adjustLength?: boolean = true;
  adjustComplexity?: boolean = true;
  preserveKeyPoints?: boolean = true;
}

class ApplyAdaptationDto {
  adaptedSlides: Array<{
    slideId: string;
    adaptedContent: any[];
  }>;
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
    @Request() req: any,
  ) {
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
    @Request() req: any,
  ) {
    return this.adaptationService.getAudienceSuggestions(
      projectId,
      req.user.id,
      audienceType,
    );
  }
}
