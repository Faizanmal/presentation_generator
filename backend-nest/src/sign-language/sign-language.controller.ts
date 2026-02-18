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
import { SignLanguageService } from './sign-language.service';

type SignLanguageCode =
  | 'ASL'
  | 'BSL'
  | 'JSL'
  | 'AUSLAN'
  | 'FSL'
  | 'DGS'
  | 'ISL';

class ConfigureDto {
  enabled: boolean;
  language: SignLanguageCode;
  avatarConfig?: {
    style: 'realistic' | 'stylized' | 'minimal';
    speed: 'slow' | 'normal' | 'fast';
    size: 'small' | 'medium' | 'large';
    position: 'bottom-right' | 'bottom-left' | 'side-panel';
  };
}

class TranslateTextDto {
  text: string;
  language?: SignLanguageCode;
}

@ApiTags('Sign Language')
@Controller('sign-language')
export class SignLanguageController {
  constructor(private readonly signService: SignLanguageService) {}

  @Get('languages')
  @ApiOperation({ summary: 'Get supported sign languages' })
  getSupportedLanguages() {
    return this.signService.getSupportedLanguages();
  }

  @Post('translate')
  @ApiOperation({ summary: 'Translate text to sign language' })
  async translateText(@Body() dto: TranslateTextDto) {
    return this.signService.translateToSigns(dto.text, dto.language);
  }

  @Get('preview/:word')
  @ApiOperation({ summary: 'Preview sign for a word' })
  async previewSign(
    @Param('word') word: string,
    @Query('language') language?: SignLanguageCode,
  ) {
    return this.signService.previewSign(word, language);
  }

  @Get('projects/:projectId/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get project configuration' })
  async getConfiguration(@Param('projectId') projectId: string) {
    return this.signService.getConfiguration(projectId);
  }

  @Put('projects/:projectId/config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure sign language for project' })
  async configure(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: ConfigureDto,
  ) {
    return this.signService.configureProject(projectId, req.user.id, dto);
  }

  @Post('projects/:projectId/translate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Translate entire project' })
  async translateProject(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Query('language') language?: SignLanguageCode,
  ) {
    return this.signService.translateProject(projectId, req.user.id, language);
  }

  @Get('projects/:projectId/embed')
  @ApiOperation({ summary: 'Get avatar embed code' })
  async getAvatarEmbed(@Param('projectId') projectId: string) {
    return this.signService.getAvatarEmbed(projectId);
  }

  @Post('slides/:slideId/translate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Translate slide to sign language' })
  async translateSlide(
    @Param('slideId') slideId: string,
    @Query('language') language?: SignLanguageCode,
  ) {
    return this.signService.translateSlide(slideId, language);
  }

  @Get('slides/:slideId/translation')
  @ApiOperation({ summary: 'Get slide translation' })
  async getSlideTranslation(
    @Param('slideId') slideId: string,
    @Query('language') language?: SignLanguageCode,
  ) {
    return this.signService.getSlideTranslation(slideId, language);
  }
}
