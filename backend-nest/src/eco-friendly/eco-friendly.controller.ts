import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EcoFriendlyService } from './eco-friendly.service';

class UpdateEcoSettingsDto {
  lowPowerMode?: boolean;
  reducedAnimations?: boolean;
  compressImages?: boolean;
  darkModePreferred?: boolean;
  offlineFirst?: boolean;
  streamQuality?: 'low' | 'medium' | 'high' | 'auto';
  cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
}

class OptimizePresentationDto {
  compressImages?: boolean;
  removeUnusedAssets?: boolean;
  optimizeAnimations?: boolean;
  generateOfflineBundle?: boolean;
}

class TrackMetricsDto {
  sessionDuration: number;
  dataTransferred: number;
  animationsReduced: boolean;
  darkModeUsed: boolean;
  offlineViewTime: number;
}

@ApiTags('Eco-Friendly Mode')
@Controller('eco')
export class EcoFriendlyController {
  constructor(private readonly ecoService: EcoFriendlyService) {}

  @Get('tips')
  @ApiOperation({ summary: 'Get eco-friendly tips' })
  getEcoTips() {
    return this.ecoService.getEcoTips();
  }

  @Get('presets/:preset')
  @ApiOperation({ summary: 'Get eco preset settings' })
  getPreset(
    @Param('preset') preset: 'maximum-savings' | 'balanced' | 'quality-first',
  ) {
    return this.ecoService.applyPreset(preset);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user eco settings' })
  async getSettings(@Request() req: { user: { id: string } }) {
    return this.ecoService.getEcoSettings(req.user.id);
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update eco settings' })
  async updateSettings(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateEcoSettingsDto,
  ) {
    return this.ecoService.updateEcoSettings(req.user.id, dto);
  }

  @Post('optimize/:presentationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Optimize presentation for eco-friendly delivery' })
  async optimizePresentation(
    @Param('presentationId') presentationId: string,
    @Body() dto: OptimizePresentationDto,
  ) {
    return this.ecoService.optimizePresentation(presentationId, dto);
  }

  @Get('streaming-recommendations')
  @ApiOperation({ summary: 'Get streaming optimization recommendations' })
  getStreamingRecommendations(
    @Query('networkType') networkType?: string,
    @Query('batteryLevel') batteryLevel?: string,
    @Query('deviceType') deviceType?: string,
  ) {
    return this.ecoService.getStreamingRecommendations({
      networkType,
      batteryLevel: batteryLevel ? parseInt(batteryLevel) : undefined,
      deviceType,
    });
  }

  @Post('track')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Track eco metrics' })
  async trackMetrics(
    @Request() req: { user: { id: string } },
    @Body() dto: TrackMetricsDto,
  ) {
    return this.ecoService.trackEcoMetrics(req.user.id, dto);
  }
}
