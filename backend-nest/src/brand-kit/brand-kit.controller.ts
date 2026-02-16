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
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BrandKitService } from './brand-kit.service';
import type { BrandKitDto } from './brand-kit.service';

@ApiTags('Brand Kit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('brand-kits')
export class BrandKitController {
  constructor(private readonly brandKitService: BrandKitService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new brand kit' })
  @ApiResponse({ status: 201, description: 'Brand kit created' })
  async create(
    @Body() data: BrandKitDto,
    @CurrentUser() user: { sub: string },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.brandKitService.create(data, user.sub, organizationId);
  }

  @Get()
  @ApiOperation({ summary: 'List all brand kits' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, description: 'List of brand kits' })
  async findAll(
    @CurrentUser() user: { sub: string },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.brandKitService.findAll(user.sub, organizationId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default brand kit' })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiResponse({ status: 200, description: 'Default brand kit' })
  async getDefault(
    @CurrentUser() user: { sub: string },
    @Query('organizationId') organizationId?: string,
  ) {
    return this.brandKitService.getDefault(user.sub, organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific brand kit' })
  @ApiResponse({ status: 200, description: 'Brand kit details' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.brandKitService.findOne(id, user.sub);
  }

  @Get(':id/theme')
  @ApiOperation({ summary: 'Get brand kit as theme-compatible object' })
  @ApiResponse({ status: 200, description: 'Theme object' })
  async toTheme(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.brandKitService.toTheme(id, user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a brand kit' })
  @ApiResponse({ status: 200, description: 'Brand kit updated' })
  async update(
    @Param('id') id: string,
    @Body() data: Partial<BrandKitDto>,
    @CurrentUser() user: { sub: string },
  ) {
    return this.brandKitService.update(id, data, user.sub);
  }

  @Put(':id/default')
  @ApiOperation({ summary: 'Set brand kit as default' })
  @ApiResponse({ status: 200, description: 'Brand kit set as default' })
  async setDefault(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    return this.brandKitService.setDefault(id, user.sub);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a brand kit' })
  @ApiResponse({ status: 201, description: 'Brand kit duplicated' })
  async duplicate(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
    @Body('name') name?: string,
  ) {
    return this.brandKitService.duplicate(id, user.sub, name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a brand kit' })
  @ApiResponse({ status: 204, description: 'Brand kit deleted' })
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ) {
    await this.brandKitService.delete(id, user.sub);
  }
}
