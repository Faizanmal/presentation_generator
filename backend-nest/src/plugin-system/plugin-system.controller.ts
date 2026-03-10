import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PluginSystemService } from './plugin-system.service';
import type { PluginManifest } from './plugin-system.service';
import { PluginRegistryService } from './plugin-registry.service';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string };
}

@ApiTags('plugins')
@Controller('api/plugins')
export class PluginSystemController {
  constructor(
    private readonly pluginSystemService: PluginSystemService,
    private readonly pluginRegistryService: PluginRegistryService,
  ) {}

  // ============================================
  // DEVELOPER ENDPOINTS
  // ============================================

  @Post('developer/register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register as a plugin developer' })
  @ApiBody({
    schema: {
      properties: {
        companyName: { type: 'string' },
        website: { type: 'string' },
        acceptedTerms: { type: 'boolean' },
      },
      required: ['acceptedTerms'],
    },
  })
  async registerDeveloper(
    @Body()
    body: { companyName?: string; website?: string; acceptedTerms: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pluginSystemService.registerDeveloper(req.user.id, body);
  }

  @Post('developer/plugins')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new plugin' })
  async createPlugin(
    @Body() manifest: PluginManifest,
    @Req() req: AuthenticatedRequest,
  ) {
    // Get developer ID from user
    // In production, you'd look up the developer record
    return this.pluginSystemService.createPlugin(req.user.id, manifest);
  }

  @Post('developer/plugins/:pluginId/bundle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('bundle'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload plugin bundle' })
  async uploadBundle(
    @Param('pluginId') pluginId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!file) {
      throw new Error('No bundle file uploaded');
    }
    return this.pluginSystemService.uploadPluginBundle(
      pluginId,
      req.user.id,
      file.buffer,
    );
  }

  @Post('developer/plugins/:pluginId/submit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit plugin for review' })
  async submitForReview(
    @Param('pluginId') pluginId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pluginSystemService.submitForReview(pluginId, req.user.id);
  }

  @Post('developer/plugins/:pluginId/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish approved plugin' })
  @ApiBody({
    schema: {
      properties: {
        version: { type: 'string' },
        releaseNotes: { type: 'string' },
      },
      required: ['version', 'releaseNotes'],
    },
  })
  async publishPlugin(
    @Param('pluginId') pluginId: string,
    @Body() body: { version: string; releaseNotes: string },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.pluginSystemService.publishPlugin(
      pluginId,
      req.user.id,
      body.version,
      body.releaseNotes,
    );
    return { success: true, message: 'Plugin published successfully' };
  }

  // ============================================
  // MARKETPLACE ENDPOINTS
  // ============================================

  @Get('marketplace')
  @ApiOperation({ summary: 'Search plugins in marketplace' })
  @ApiQuery({ name: 'q', required: false, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['popular', 'recent', 'rating'],
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async searchPlugins(
    @Query('q') query?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: 'popular' | 'recent' | 'rating',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.pluginSystemService.searchPlugins(query || '', {
      category,
      sort,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('marketplace/:pluginId')
  @ApiOperation({ summary: 'Get plugin details' })
  async getPluginDetails(@Param('pluginId') pluginId: string) {
    return this.pluginSystemService.getPluginDetails(pluginId);
  }

  // ============================================
  // USER PLUGIN MANAGEMENT
  // ============================================

  @Get('installed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get installed plugins' })
  async getInstalledPlugins(@Req() req: AuthenticatedRequest) {
    return this.pluginSystemService.getUserPlugins(req.user.id);
  }

  @Post('install/:pluginId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Install a plugin' })
  @ApiBody({
    schema: {
      properties: {
        organizationId: {
          type: 'string',
          description: 'Optional organization ID',
        },
      },
    },
  })
  async installPlugin(
    @Param('pluginId') pluginId: string,
    @Body() body: { organizationId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.pluginSystemService.installPlugin(
      req.user.id,
      pluginId,
      body.organizationId,
    );
  }

  @Delete('install/:installationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Uninstall a plugin' })
  async uninstallPlugin(
    @Param('installationId') installationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.pluginSystemService.uninstallPlugin(req.user.id, installationId);
    return { success: true, message: 'Plugin uninstalled' };
  }

  @Post('install/:installationId/toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle plugin enabled/disabled' })
  @ApiBody({
    schema: {
      properties: {
        enabled: { type: 'boolean' },
      },
      required: ['enabled'],
    },
  })
  async togglePlugin(
    @Param('installationId') installationId: string,
    @Body() body: { enabled: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.pluginSystemService.togglePluginEnabled(
      req.user.id,
      installationId,
      body.enabled,
    );
    return { success: true, enabled: body.enabled };
  }

  @Post('install/:installationId/settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update plugin settings' })
  async updateSettings(
    @Param('installationId') installationId: string,
    @Body() settings: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.pluginSystemService.updatePluginSettings(
      req.user.id,
      installationId,
      settings,
    );
    return { success: true, message: 'Settings updated' };
  }

  // ============================================
  // REVIEWS
  // ============================================

  @Post(':pluginId/reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a plugin review' })
  @ApiBody({
    schema: {
      properties: {
        rating: { type: 'number', minimum: 1, maximum: 5 },
        title: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['rating', 'content'],
    },
  })
  async submitReview(
    @Param('pluginId') pluginId: string,
    @Body() body: { rating: number; title?: string; content: string },
    @Req() req: AuthenticatedRequest,
  ) {
    await this.pluginSystemService.submitReview(req.user.id, pluginId, body);
    return { success: true, message: 'Review submitted' };
  }

  // ============================================
  // REGISTRY ENDPOINTS (for active plugins)
  // ============================================

  @Get('registry/blocks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get available custom blocks from installed plugins',
  })
  async getCustomBlocks(@Req() req: AuthenticatedRequest) {
    return this.pluginRegistryService.getCustomBlocksForUser(req.user.id);
  }

  @Get('registry/themes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get available custom themes from installed plugins',
  })
  async getCustomThemes(@Req() req: AuthenticatedRequest) {
    return this.pluginRegistryService.getCustomThemesForUser(req.user.id);
  }

  @Get('registry/actions')
  @ApiOperation({ summary: 'Get all registered custom actions' })
  getCustomActions() {
    return this.pluginRegistryService.getCustomActions();
  }
}
