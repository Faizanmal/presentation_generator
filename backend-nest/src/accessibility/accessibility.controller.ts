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
import { AccessibilityService } from './accessibility.service';

// DTOs
class CheckContrastDto {
  foreground: string;
  background: string;
}

class SuggestColorsDto {
  foreground: string;
  background: string;
  targetRatio?: number;
}

class GenerateAltTextDto {
  imageUrl: string;
}

class AutoFixDto {
  issueIds: string[];
}

@Controller('accessibility')
@UseGuards(JwtAuthGuard)
export class AccessibilityController {
  constructor(private readonly accessibilityService: AccessibilityService) {}

  @Post(':projectId/check')
  async checkProject(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.accessibilityService.checkProject(projectId, req.user.id);
  }

  @Get('guidelines')
  getWCAGGuidelines() {
    return this.accessibilityService.getWCAGGuidelines();
  }

  @Post('check-contrast')
  checkContrast(@Body() dto: CheckContrastDto) {
    return this.accessibilityService.checkContrast(dto.foreground, dto.background);
  }

  @Post('suggest-colors')
  async suggestAccessibleColors(@Body() dto: SuggestColorsDto) {
    return this.accessibilityService.suggestAccessibleColors(
      dto.foreground,
      dto.background,
      dto.targetRatio,
    );
  }

  @Post('generate-alt-text')
  async generateAltText(@Body() dto: GenerateAltTextDto) {
    const altText = await this.accessibilityService.generateAltText(dto.imageUrl);
    return { altText };
  }

  @Post(':projectId/auto-fix')
  async autoFixIssues(
    @Param('projectId') projectId: string,
    @Body() dto: AutoFixDto,
    @Request() req: any,
  ) {
    return this.accessibilityService.autoFixIssues(
      projectId,
      req.user.id,
      dto.issueIds,
    );
  }
}
