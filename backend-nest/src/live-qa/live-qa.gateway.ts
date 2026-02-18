import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { LiveQAService } from './live-qa.service';

interface QASocket extends Socket {
  userId?: string;
  sessionId?: string;
  isHost?: boolean;
}

@WebSocketGateway({
  namespace: '/live-qa',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class LiveQAGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveQAGateway.name);

  constructor(private readonly qaService: LiveQAService) {}

  handleConnection(client: QASocket) {
    this.logger.log(`Client connected to Q&A: ${client.id}`);
  }

  handleDisconnect(client: QASocket) {
    this.logger.log(`Client disconnected from Q&A: ${client.id}`);
    if (client.sessionId) {
      this.server.to(`qa:${client.sessionId}`).emit('participantLeft', {
        participantId: client.id,
      });
    }
  }

  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @ConnectedSocket() client: QASocket,
    @MessageBody()
    data: { sessionId: string; userId?: string; isHost?: boolean },
  ) {
    try {
      const session = await this.qaService.getSession(data.sessionId);

      client.sessionId = session.id;
      client.userId = data.userId;
      client.isHost = data.isHost && session.hostUserId === data.userId;

      client.join(`qa:${session.id}`);

      if (client.isHost) {
        client.join(`qa:${session.id}:host`);
      }

      // Get existing questions
      const questions = await this.qaService.getQuestions(session.id);

      client.emit('sessionJoined', {
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
        },
        questions,
        isHost: client.isHost,
      });

      // Notify others
      client.to(`qa:${session.id}`).emit('participantJoined', {
        participantId: client.id,
        isHost: client.isHost,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('submitQuestion')
  async handleSubmitQuestion(
    @ConnectedSocket() client: QASocket,
    @MessageBody() data: { content: string; isAnonymous?: boolean },
  ) {
    if (!client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    try {
      const result = await this.qaService.submitQuestion(
        client.sessionId,
        data.content,
        client.userId,
        data.isAnonymous,
      );

      if (result.question) {
        // Notify submitter
        client.emit('questionSubmitted', { question: result.question });

        // Notify host
        this.server.to(`qa:${client.sessionId}:host`).emit('newQuestion', {
          question: result.question,
        });

        // If not flagged, show to all participants
        if (result.moderation.approved && !result.moderation.spam) {
          client.to(`qa:${client.sessionId}`).emit('newQuestion', {
            question: result.question,
          });
        }
      } else {
        // Moderation blocked the question
        client.emit('questionRejected', {
          reason:
            result.moderation.reason || 'Question did not pass moderation',
        });
      }
    } catch (error) {
      client.emit('error', {
        message:
          error instanceof Error ? error.message : 'Failed to submit question',
      });
    }
  }

  @SubscribeMessage('upvote')
  async handleUpvote(
    @ConnectedSocket() client: QASocket,
    @MessageBody() data: { questionId: string },
  ) {
    if (!client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    try {
      const question = await this.qaService.upvoteQuestion(
        data.questionId,
        client.userId,
      );

      // Broadcast to all in session
      this.server.to(`qa:${client.sessionId}`).emit('questionUpvoted', {
        questionId: data.questionId,
        upvotes: question.upvotes,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to upvote' });
    }
  }

  @SubscribeMessage('markAnswered')
  async handleMarkAnswered(
    @ConnectedSocket() client: QASocket,
    @MessageBody() data: { questionId: string; answer?: string },
  ) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const question = await this.qaService.markAnswered(
        data.questionId,
        client.userId!,
        data.answer,
      );

      this.server.to(`qa:${client.sessionId}`).emit('questionAnswered', {
        question,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to mark as answered' });
    }
  }

  @SubscribeMessage('dismissQuestion')
  async handleDismiss(
    @ConnectedSocket() client: QASocket,
    @MessageBody() data: { questionId: string },
  ) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      await this.qaService.dismissQuestion(data.questionId, client.userId!);

      this.server.to(`qa:${client.sessionId}`).emit('questionDismissed', {
        questionId: data.questionId,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to dismiss question' });
    }
  }

  @SubscribeMessage('pinQuestion')
  async handlePin(
    @ConnectedSocket() client: QASocket,
    @MessageBody() data: { questionId: string },
  ) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const question = await this.qaService.pinQuestion(
        data.questionId,
        client.userId!,
      );

      this.server.to(`qa:${client.sessionId}`).emit('questionPinned', {
        question,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to pin question' });
    }
  }

  @SubscribeMessage('getSummary')
  async handleGetSummary(@ConnectedSocket() client: QASocket) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const summary = await this.qaService.summarizeQuestions(
        client.sessionId,
        client.userId!,
      );

      client.emit('questionsSummary', summary);
    } catch (error) {
      client.emit('error', { message: 'Failed to generate summary' });
    }
  }

  @SubscribeMessage('endSession')
  async handleEndSession(@ConnectedSocket() client: QASocket) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      await this.qaService.endSession(client.sessionId, client.userId!);

      this.server.to(`qa:${client.sessionId}`).emit('sessionEnded', {
        message: 'Q&A session has ended',
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to end session' });
    }
  }
}
