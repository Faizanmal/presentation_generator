import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  SetMetadata,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicApiService } from './public-api.service';
import { PublicApiGuard } from './public-api.guard';

// Decorator for required API scope
export const RequireScope = (scope: string) => SetMetadata('apiScope', scope);

class CreateApiKeyDto {
  name: string;
  scopes?: string[];
  rateLimits?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  expiresInDays?: number;
}

class UpdateScopesDto {
  scopes: string[];
}

@ApiTags('Public API Management')
@Controller('api-keys')
export class PublicApiController {
  constructor(private readonly apiService: PublicApiService) {}

  @Get('scopes')
  @ApiOperation({ summary: 'Get available API scopes' })
  getAvailableScopes() {
    return this.apiService.getAvailableScopes();
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user API keys' })
  async listApiKeys(@Request() req: { user: { id: string } }) {
    return this.apiService.listApiKeys(req.user.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate new API key' })
  async generateApiKey(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateApiKeyDto,
  ) {
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    return this.apiService.generateApiKey(req.user.id, {
      name: dto.name,
      scopes: dto.scopes,
      rateLimits: dto.rateLimits,
      expiresAt,
    });
  }

  @Get(':keyId/usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get API key usage stats' })
  async getUsageStats(@Param('keyId') keyId: string) {
    return this.apiService.getUsageStats(keyId);
  }

  @Put(':keyId/scopes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update API key scopes' })
  async updateScopes(
    @Request() req: { user: { id: string } },
    @Param('keyId') keyId: string,
    @Body() dto: UpdateScopesDto,
  ) {
    return this.apiService.updateScopes(keyId, req.user.id, dto.scopes);
  }

  @Delete(':keyId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke API key' })
  async revokeApiKey(
    @Request() req: { user: { id: string } },
    @Param('keyId') keyId: string,
  ) {
    return this.apiService.revokeApiKey(keyId, req.user.id);
  }
}

// Example public API endpoints (using API key auth)
@ApiTags('Public API')
@Controller('v1')
@UseGuards(PublicApiGuard)
@ApiHeader({ name: 'X-API-Key', description: 'API Key', required: true })
export class PublicApiEndpointsController {
  constructor(private readonly prisma: any) {} // Would inject PrismaService

  @Get('projects')
  @RequireScope('read:projects')
  @ApiOperation({ summary: 'List projects (Public API)' })
  async listProjects(@Request() req: { apiUser: { userId: string } }) {
    // Return user's projects via API
    return { message: 'Projects endpoint', userId: req.apiUser.userId };
  }

  @Get('projects/:id')
  @RequireScope('read:projects')
  @ApiOperation({ summary: 'Get project (Public API)' })
  async getProject(
    @Request() req: { apiUser: { userId: string } },
    @Param('id') id: string,
  ) {
    return { message: 'Project details endpoint', projectId: id };
  }
}
