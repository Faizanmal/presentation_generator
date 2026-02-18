import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UniversalDesignService } from './universal-design.service';

class CheckProjectDto {
  targetRegions?: string[];
  checkAccessibility?: boolean;
  checkCultural?: boolean;
}

class AutoFixDto {
  issueTypes: string[];
}

@ApiTags('Universal Design')
@Controller('universal-design')
export class UniversalDesignController {
  constructor(private readonly designService: UniversalDesignService) {}

  @Post('projects/:projectId/check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run design check' })
  async checkProject(
    @Param('projectId') projectId: string,
    @Body() dto: CheckProjectDto,
  ) {
    return this.designService.checkProject(projectId, dto);
  }

  @Get('projects/:projectId/reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get report history' })
  async getReportHistory(@Param('projectId') projectId: string) {
    return this.designService.getReportHistory(projectId);
  }

  @Post('projects/:projectId/auto-fix')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auto-fix issues' })
  async autoFix(
    @Param('projectId') projectId: string,
    @Body() dto: AutoFixDto,
  ) {
    return this.designService.autoFix(projectId, dto.issueTypes);
  }

  @Get('cultural-guide/:region')
  @ApiOperation({ summary: 'Get cultural guide' })
  getCulturalGuide(@Param('region') region: string) {
    return this.designService.getCulturalGuide(region);
  }

  @Get('cultural-guide')
  @ApiOperation({ summary: 'Get all cultural guides' })
  getAllCulturalGuides() {
    const regions = ['Western', 'China', 'Middle East', 'Japan'];
    return regions.map((region) => ({
      region,
      guide: this.designService.getCulturalGuide(region),
    }));
  }
}
