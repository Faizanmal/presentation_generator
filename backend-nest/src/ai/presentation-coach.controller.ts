import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresentationCoachService } from './presentation-coach.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('ai/coach')
@UseGuards(JwtAuthGuard)
export class PresentationCoachController {
  constructor(private readonly coachService: PresentationCoachService) {}

  @Post('analyze')
  async analyzePresentation(
    @Body()
    body: {
      title: string;
      slides: Array<{
        content: string;
        speakerNotes?: string;
        hasImage: boolean;
        layout: string;
      }>;
      audience?: string;
      purpose?: string;
    },
  ) {
    return this.coachService.analyzePresentation(body);
  }

  @Post('rehearsal-feedback')
  async getRehearsalFeedback(
    @Body()
    body: {
      transcript: string;
      duration: number;
      slideTimings: {
        slideIndex: number;
        startTime: number;
        endTime: number;
      }[];
      suggestedDurationPerSlide: number;
    },
  ) {
    return this.coachService.getRehearsalFeedback(body);
  }

  @Post('improve-slide')
  async suggestImprovements(
    @Body()
    body: {
      content: string;
      type: string;
      context: string;
    },
  ) {
    return this.coachService.suggestImprovements(body);
  }

  @Post('speaker-notes')
  async generateSpeakerNotes(
    @Body()
    body: {
      title: string;
      content: string;
      context: string;
      duration: number;
    },
  ) {
    return this.coachService.generateSpeakerNotes(body);
  }
}
