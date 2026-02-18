import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WhiteLabelSdkService } from './white-label-sdk.service';

class CreateConfigDto {
  name: string;
  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    fontFamily?: string;
    customCss?: string;
    appName: string;
    hidePoweredBy?: boolean;
  };
  features: {
    aiGeneration: boolean;
    collaboration: boolean;
    templates: boolean;
    export: boolean;
    analytics: boolean;
    customDomain: boolean;
  };
  allowedDomains: string[];
  plan?: 'starter' | 'professional' | 'enterprise';
}

class CreateInstanceDto {
  domain: string;
  clientName: string;
  customBranding?: {
    primaryColor?: string;
    logo?: string;
  };
}

@ApiTags('White-Label SDK')
@Controller('sdk')
export class WhiteLabelSdkController {
  constructor(private readonly sdkService: WhiteLabelSdkService) {}

  @Get('docs')
  @ApiOperation({ summary: 'Get SDK documentation' })
  getDocumentation() {
    return this.sdkService.getDocumentation();
  }

  @Get('configurations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List SDK configurations' })
  async listConfigurations(
    @Request() req: { user: { organizationId: string } },
  ) {
    return this.sdkService.listConfigurations(req.user.organizationId);
  }

  @Post('configurations')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create SDK configuration' })
  async createConfiguration(
    @Request() req: { user: { organizationId: string } },
    @Body() dto: CreateConfigDto,
  ) {
    return this.sdkService.createSdkConfiguration(req.user.organizationId, dto);
  }

  @Put('configurations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update SDK configuration' })
  async updateConfiguration(
    @Request() req: { user: { organizationId: string } },
    @Param('id') id: string,
    @Body() dto: Partial<CreateConfigDto>,
  ) {
    return this.sdkService.updateConfiguration(
      id,
      req.user.organizationId,
      dto,
    );
  }

  @Delete('configurations/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke SDK configuration' })
  async revokeConfiguration(
    @Request() req: { user: { organizationId: string } },
    @Param('id') id: string,
  ) {
    return this.sdkService.revokeConfiguration(id, req.user.organizationId);
  }

  @Get('configurations/:id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get usage statistics' })
  async getUsageStats(@Param('id') id: string) {
    return this.sdkService.getUsageStats(id);
  }

  @Post('configurations/:id/instances')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create SDK instance' })
  async createInstance(
    @Param('id') id: string,
    @Body() dto: CreateInstanceDto,
  ) {
    return this.sdkService.createInstance(id, dto);
  }

  @Get('embed-code/:sdkKey')
  @ApiOperation({ summary: 'Get embed code' })
  getEmbedCode(
    @Param('sdkKey') sdkKey: string,
    @Query('theme') theme?: 'light' | 'dark',
    @Query('locale') locale?: string,
  ) {
    return this.sdkService.getEmbedCode(sdkKey, { theme, locale });
  }

  @Get('react-component/:sdkKey')
  @ApiOperation({ summary: 'Get React component code' })
  getReactComponent(@Param('sdkKey') sdkKey: string) {
    return { code: this.sdkService.getReactComponent(sdkKey) };
  }
}
