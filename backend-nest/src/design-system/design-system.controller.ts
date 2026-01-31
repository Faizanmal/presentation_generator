import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { 
  DesignSystemService, 
  ColorToken, 
  TypographyToken,
  SpacingToken,
  ShadowToken,
  BorderToken,
} from './design-system.service';

// DTOs
class CreateDesignSystemDto {
  name: string;
  description?: string;
  organizationId?: string;
  presetId?: string;
}

class UpdateTokensDto {
  colors?: ColorToken[];
  typography?: TypographyToken[];
  spacing?: SpacingToken[];
  shadows?: ShadowToken[];
  borders?: BorderToken[];
}

class UpdateColorDto {
  colorName: string;
  newValue: string;
}

class GeneratePaletteDto {
  baseColor: string;
  name: string;
}

@Controller('design-system')
@UseGuards(JwtAuthGuard)
export class DesignSystemController {
  constructor(private readonly designSystemService: DesignSystemService) {}

  @Post()
  async createDesignSystem(
    @Body() dto: CreateDesignSystemDto,
    @Request() req: any,
  ) {
    return this.designSystemService.createDesignSystem(req.user.id, dto);
  }

  @Get('presets')
  getPresets() {
    return this.designSystemService.getPresets();
  }

  @Get('my-systems')
  async getUserDesignSystems(@Request() req: any) {
    return this.designSystemService.getUserDesignSystems(req.user.id);
  }

  @Get(':systemId')
  async getDesignSystem(@Param('systemId') systemId: string) {
    return this.designSystemService.getDesignSystem(systemId);
  }

  @Patch(':systemId/tokens')
  async updateTokens(
    @Param('systemId') systemId: string,
    @Body() dto: UpdateTokensDto,
    @Request() req: any,
  ) {
    return this.designSystemService.updateTokens(systemId, req.user.id, dto);
  }

  @Patch(':systemId/color')
  async updateColor(
    @Param('systemId') systemId: string,
    @Body() dto: UpdateColorDto,
    @Request() req: any,
  ) {
    return this.designSystemService.updateColor(
      systemId,
      req.user.id,
      dto.colorName,
      dto.newValue,
    );
  }

  @Post(':systemId/apply/:projectId')
  async applyToProject(
    @Param('systemId') systemId: string,
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    return this.designSystemService.applyToProject(systemId, projectId, req.user.id);
  }

  @Post('generate-palette')
  generateColorPalette(@Body() dto: GeneratePaletteDto) {
    return this.designSystemService.generateColorPalette(dto.baseColor, dto.name);
  }

  @Get(':systemId/export/css')
  async exportAsCSS(@Param('systemId') systemId: string) {
    const system = await this.designSystemService.getDesignSystem(systemId);
    const css = this.designSystemService.exportAsCSS(system);
    return { css };
  }

  @Get(':systemId/export/tailwind')
  async exportAsTailwind(@Param('systemId') systemId: string) {
    const system = await this.designSystemService.getDesignSystem(systemId);
    return this.designSystemService.exportAsTailwindConfig(system);
  }
}
