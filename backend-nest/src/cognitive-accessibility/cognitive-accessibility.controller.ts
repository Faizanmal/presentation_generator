import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CognitiveAccessibilityService } from './cognitive-accessibility.service';

class SaveProfileDto {
  reduceAnimations?: boolean;
  simplifyText?: boolean;
  highContrast?: boolean;
  focusMode?: boolean;
  readingGuide?: boolean;
  textToSpeech?: boolean;
  dyslexiaFont?: boolean;
  lineSpacing?: 'normal' | 'increased' | 'large';
  wordSpacing?: 'normal' | 'increased';
  colorOverlay?: string;
  contentChunking?: boolean;
  progressIndicator?: boolean;
}

class SimplifyTextDto {
  text: string;
  targetLevel?: 'basic' | 'intermediate';
}

class ProcessSlideDto {
  simplifyText?: boolean;
  chunk?: boolean;
}

@ApiTags('Cognitive Accessibility')
@Controller('cognitive-accessibility')
export class CognitiveAccessibilityController {
  constructor(private readonly cogService: CognitiveAccessibilityService) {}

  @Get('presets')
  @ApiOperation({ summary: 'Get available presets' })
  getPresets() {
    return this.cogService.getPresets();
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@Request() req: { user: { id: string } }) {
    return this.cogService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save user profile' })
  async saveProfile(
    @Request() req: { user: { id: string } },
    @Body() dto: SaveProfileDto,
  ) {
    return this.cogService.saveProfile(req.user.id, dto);
  }

  @Post('profile/preset/:presetName')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply preset' })
  async applyPreset(
    @Request() req: { user: { id: string } },
    @Param('presetName') presetName: string,
  ) {
    return this.cogService.applyPreset(req.user.id, presetName);
  }

  @Post('simplify')
  @ApiOperation({ summary: 'Simplify text' })
  async simplifyText(@Body() dto: SimplifyTextDto) {
    return this.cogService.simplifyText(dto.text, dto.targetLevel);
  }

  @Post('slides/:slideId/process')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Process slide for accessibility' })
  async processSlide(
    @Param('slideId') slideId: string,
    @Body() dto: ProcessSlideDto,
  ) {
    return this.cogService.processSlide(slideId, dto);
  }

  @Get('projects/:projectId/accessible')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate accessible version' })
  async generateAccessible(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.cogService.generateAccessibleVersion(projectId, req.user.id);
  }
}
