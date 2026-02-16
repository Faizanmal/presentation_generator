import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CarbonFootprintService } from './carbon-footprint.service';

class CalculateSessionFootprintDto {
  durationMinutes: number;
  attendees: number;
  streamQuality: 'low' | 'medium' | 'high';
  dataSentMB: number;
  dataReceivedMB: number;
}

class PurchaseOffsetDto {
  provider: string;
  project: string;
  emissionsKg: number;
  costUSD: number;
}

@ApiTags('Carbon Footprint')
@Controller('carbon')
export class CarbonFootprintController {
  constructor(private readonly carbonService: CarbonFootprintService) {}

  @Get('presentation/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calculate presentation carbon footprint' })
  async getPresentationFootprint(@Param('id') id: string) {
    return this.carbonService.calculatePresentationFootprint(id);
  }

  @Post('session')
  @ApiOperation({ summary: 'Calculate session carbon footprint' })
  calculateSessionFootprint(@Body() dto: CalculateSessionFootprintDto) {
    return this.carbonService.calculateSessionFootprint(dto);
  }

  @Get('report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate eco report' })
  async generateReport(
    @Request() req: { user: { id: string } },
    @Query('period') period: 'week' | 'month' | 'year' = 'month',
  ) {
    return this.carbonService.generateEcoReport(req.user.id, period);
  }

  @Get('offset-options')
  @ApiOperation({ summary: 'Get carbon offset options' })
  getOffsetOptions(@Query('emissions') emissions: string) {
    const emissionsKg = parseFloat(emissions) || 1;
    return this.carbonService.getOffsetOptions(emissionsKg);
  }

  @Post('offset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase carbon offset' })
  async purchaseOffset(
    @Request() req: { user: { id: string } },
    @Body() dto: PurchaseOffsetDto,
  ) {
    return this.carbonService.purchaseOffset(req.user.id, dto);
  }

  @Get('offset-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get offset purchase history' })
  async getOffsetHistory(@Request() req: { user: { id: string } }) {
    return this.carbonService.getOffsetHistory(req.user.id);
  }

  @Get('badges')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get eco badges' })
  async getBadges(@Request() req: { user: { id: string } }) {
    return this.carbonService.getEcoBadges(req.user.id);
  }
}
