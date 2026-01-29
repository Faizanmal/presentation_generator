import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VoiceService } from './voice.service';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  /**
   * Upload a voice recording for transcription
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRecording(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { projectId?: string },
    @Request() req: any,
  ) {
    return this.voiceService.uploadVoiceRecording(
      req.user.id,
      file,
      body.projectId,
    );
  }

  /**
   * Get all recordings for the current user
   */
  @Get('recordings')
  async getRecordings(
    @Request() req: any,
    @Query('projectId') projectId?: string,
  ) {
    return this.voiceService.getUserRecordings(req.user.id, projectId);
  }

  /**
   * Get a specific recording
   */
  @Get('recordings/:id')
  async getRecording(@Param('id') id: string, @Request() req: any) {
    return this.voiceService.getRecording(id, req.user.id);
  }

  /**
   * Generate slides from a voice recording
   */
  @Post('recordings/:id/generate')
  async generateFromRecording(
    @Param('id') id: string,
    @Body() body: { tone?: string; audience?: string; length?: number },
    @Request() req: any,
  ) {
    return this.voiceService.generateSlidesFromVoice(id, req.user.id, body);
  }

  /**
   * Delete a recording
   */
  @Delete('recordings/:id')
  async deleteRecording(@Param('id') id: string, @Request() req: any) {
    return this.voiceService.deleteRecording(id, req.user.id);
  }

  /**
   * Direct transcribe endpoint (for quick transcription without saving)
   */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file'))
  async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
    return this.voiceService.transcribeAudio(file);
  }
}
