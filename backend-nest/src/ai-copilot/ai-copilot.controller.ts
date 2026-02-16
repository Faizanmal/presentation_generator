import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AICopilotService } from './ai-copilot.service';

class CreateSessionDto {
  projectId?: string;
  slideId?: string;
}

class SendMessageDto {
  message: string;
}

class QuickActionDto {
  action: string;
  projectId?: string;
  slideId?: string;
  blockId?: string;
}

class FeedbackDto {
  feedback: 'thumbs_up' | 'thumbs_down';
}

@ApiTags('AI Copilot')
@Controller('ai-copilot')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AICopilotController {
  constructor(private readonly copilotService: AICopilotService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create new chat session' })
  async createSession(
    @Request() req: { user: { id: string } },
    @Body() dto: CreateSessionDto,
  ) {
    return this.copilotService.createSession(req.user.id, dto);
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Get user chat sessions' })
  async getUserSessions(
    @Request() req: { user: { id: string } },
    @Query('limit') limit?: string,
  ) {
    return this.copilotService.getUserSessions(
      req.user.id,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get session by ID' })
  async getSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.copilotService.getSession(id, req.user.id);
  }

  @Post('sessions/:id/messages')
  @ApiOperation({ summary: 'Send message to copilot' })
  async sendMessage(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.copilotService.sendMessage(id, req.user.id, dto.message);
  }

  @Post('sessions/:id/archive')
  @ApiOperation({ summary: 'Archive session' })
  async archiveSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.copilotService.archiveSession(id, req.user.id);
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Delete session' })
  async deleteSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.copilotService.deleteSession(id, req.user.id);
  }

  @Post('quick-action')
  @ApiOperation({ summary: 'Execute quick action' })
  async quickAction(
    @Request() req: { user: { id: string } },
    @Body() dto: QuickActionDto,
  ) {
    return this.copilotService.quickAction(req.user.id, dto.action, dto);
  }

  @Post('messages/:id/feedback')
  @ApiOperation({ summary: 'Provide feedback on message' })
  async provideFeedback(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: FeedbackDto,
  ) {
    return this.copilotService.provideFeedback(id, req.user.id, dto.feedback);
  }
}
