import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { UploadService, type UploadResult } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

class GetPresignedUrlDto {
  filename: string;
  mimeType: string;
}

class ConfirmUploadDto {
  key: string;
  filename: string;
  mimeType: string;
  size: number;
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * Upload a file directly
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadFile(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadService.uploadFile(file, user.id);
  }

  /**
   * Upload a file directly (alias for frontend compatibility)
   */
  @Post('direct')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadFileDirect(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File,
  ): Promise<UploadResult> {
    return this.uploadService.uploadFile(file, user.id);
  }

  /**
   * Get presigned URL for direct client upload
   */
  @Post('presigned')
  @HttpCode(HttpStatus.OK)
  async getPresignedUrl(
    @CurrentUser() user: { id: string },
    @Body() body: GetPresignedUrlDto,
  ) {
    return this.uploadService.getPresignedUploadUrl(
      user.id,
      body.filename,
      body.mimeType,
    );
  }

  /**
   * Confirm upload after direct client upload
   */
  @Post('confirm')
  @HttpCode(HttpStatus.CREATED)
  async confirmUpload(
    @CurrentUser() user: { id: string },
    @Body() body: ConfirmUploadDto,
  ): Promise<UploadResult> {
    return this.uploadService.confirmUpload(
      user.id,
      body.key,
      body.filename,
      body.mimeType,
      body.size,
    );
  }

  /**
   * Get user's uploaded assets
   */
  @Get('assets')
  async getUserAssets(
    @CurrentUser() user: { id: string },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.uploadService.getUserAssets(
      user.id,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Delete an asset
   */
  @Delete(':assetId')
  @HttpCode(HttpStatus.OK)
  async deleteFile(
    @CurrentUser() user: { id: string },
    @Param('assetId') assetId: string,
  ) {
    await this.uploadService.deleteFile(assetId);
    return { success: true };
  }
}
