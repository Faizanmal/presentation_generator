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
import { SentimentAnalysisService } from './sentiment-analysis.service';

interface SentimentSocket extends Socket {
  userId?: string;
  sessionId?: string;
  isHost?: boolean;
}

@WebSocketGateway({
  namespace: '/sentiment',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class SentimentAnalysisGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SentimentAnalysisGateway.name);

  constructor(private readonly sentimentService: SentimentAnalysisService) {}

  handleConnection(client: SentimentSocket) {
    this.logger.log(`Sentiment client connected: ${client.id}`);
  }

  handleDisconnect(client: SentimentSocket) {
    this.logger.log(`Sentiment client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @ConnectedSocket() client: SentimentSocket,
    @MessageBody()
    data: { sessionId: string; userId?: string; isHost?: boolean },
  ) {
    try {
      client.sessionId = data.sessionId;
      client.userId = data.userId;
      client.isHost = data.isHost;

      client.join(`sentiment:${data.sessionId}`);

      if (data.isHost) {
        client.join(`sentiment:${data.sessionId}:host`);
      }

      const current = await this.sentimentService.getCurrentSentiment(
        data.sessionId,
      );

      client.emit('joined', { currentSentiment: current });
    } catch (error) {
      client.emit('error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('reaction')
  async handleReaction(
    @ConnectedSocket() client: SentimentSocket,
    @MessageBody() data: { reaction: string },
  ) {
    if (!client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    try {
      await this.sentimentService.recordReaction(
        client.sessionId,
        data.reaction,
        client.userId,
      );

      // Broadcast reaction to host
      this.server.to(`sentiment:${client.sessionId}:host`).emit('newReaction', {
        reaction: data.reaction,
        participantId: client.id,
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to record reaction' });
    }
  }

  @SubscribeMessage('engagement')
  async handleEngagement(
    @ConnectedSocket() client: SentimentSocket,
    @MessageBody() data: { level: number },
  ) {
    if (!client.sessionId) return;

    try {
      await this.sentimentService.recordEngagement(
        client.sessionId,
        data.level,
        client.userId,
      );
    } catch (error) {
      // Silent fail for engagement tracking
    }
  }

  @SubscribeMessage('expression')
  async handleExpression(
    @ConnectedSocket() client: SentimentSocket,
    @MessageBody()
    data: {
      happy: number;
      sad: number;
      angry: number;
      surprised: number;
      neutral: number;
      confused: number;
    },
  ) {
    if (!client.sessionId) return;

    try {
      await this.sentimentService.analyzeExpression(
        client.sessionId,
        data,
        client.userId,
      );
    } catch (error) {
      // Silent fail for expression tracking
    }
  }

  @SubscribeMessage('requestSnapshot')
  async handleRequestSnapshot(@ConnectedSocket() client: SentimentSocket) {
    if (!client.sessionId || !client.isHost) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const metrics = await this.sentimentService.createSnapshot(
        client.sessionId,
      );

      // Send to all hosts for this session
      this.server.to(`sentiment:${client.sessionId}:host`).emit('snapshot', {
        metrics,
        timestamp: new Date(),
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to create snapshot' });
    }
  }

  @SubscribeMessage('getCurrentSentiment')
  async handleGetCurrent(@ConnectedSocket() client: SentimentSocket) {
    if (!client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    try {
      const current = await this.sentimentService.getCurrentSentiment(
        client.sessionId,
      );
      client.emit('currentSentiment', current);
    } catch (error) {
      client.emit('error', { message: 'Failed to get sentiment' });
    }
  }

  @SubscribeMessage('endSession')
  async handleEndSession(@ConnectedSocket() client: SentimentSocket) {
    if (!client.sessionId || !client.isHost || !client.userId) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const session = await this.sentimentService.endSession(
        client.sessionId,
        client.userId,
      );

      this.server.to(`sentiment:${client.sessionId}`).emit('sessionEnded', {
        message: 'Sentiment tracking session ended',
      });
    } catch (error) {
      client.emit('error', { message: 'Failed to end session' });
    }
  }
}
