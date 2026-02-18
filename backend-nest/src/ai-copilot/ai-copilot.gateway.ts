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
import { AICopilotService } from './ai-copilot.service';

interface UserSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

@WebSocketGateway({
  namespace: '/ai-copilot',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class AICopilotGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(AICopilotGateway.name);
  private activeConnections = new Map<string, UserSocket>();

  constructor(private readonly copilotService: AICopilotService) {}

  handleConnection(client: UserSocket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: UserSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (client.userId) {
      this.activeConnections.delete(client.userId);
    }
  }

  @SubscribeMessage('authenticate')
  handleAuthenticate(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { userId: string; token: string },
  ) {
    // In production, validate the token
    client.userId = data.userId;
    this.activeConnections.set(data.userId, client);

    client.emit('authenticated', { success: true });
    this.logger.log(`User authenticated: ${data.userId}`);
  }

  @SubscribeMessage('startSession')
  async handleStartSession(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { projectId?: string; slideId?: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const session = await this.copilotService.createSession(
        client.userId,
        data,
      );
      client.sessionId = session.id;
      client.join(`session:${session.id}`);

      client.emit('sessionStarted', { session });
    } catch (err) {
      client.emit('error', { message: 'Failed to start session' });
    }
  }

  @SubscribeMessage('joinSession')
  async handleJoinSession(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { sessionId: string },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const session = await this.copilotService.getSession(
        data.sessionId,
        client.userId,
      );
      client.sessionId = session.id;
      client.join(`session:${session.id}`);

      client.emit('sessionJoined', { session });
    } catch (err) {
      client.emit('error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { message: string },
  ) {
    if (!client.userId || !client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    try {
      // Emit typing indicator
      client.emit('assistantTyping', { typing: true });

      const result = await this.copilotService.sendMessage(
        client.sessionId,
        client.userId,
        data.message,
      );

      // Stop typing indicator and send response
      client.emit('assistantTyping', { typing: false });
      client.emit('messageReceived', result);
    } catch (err) {
      client.emit('assistantTyping', { typing: false });
      client.emit('error', { message: 'Failed to process message' });
    }
  }

  @SubscribeMessage('quickAction')
  async handleQuickAction(
    @ConnectedSocket() client: UserSocket,
    @MessageBody()
    data: {
      action: string;
      projectId?: string;
      slideId?: string;
      blockId?: string;
    },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      client.emit('processingAction', { action: data.action });

      const result = await this.copilotService.quickAction(
        client.userId,
        data.action,
        data,
      );

      client.emit('actionCompleted', { action: data.action, result });
    } catch (err) {
      client.emit('error', {
        message: `Action failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }
  }

  @SubscribeMessage('feedback')
  async handleFeedback(
    @ConnectedSocket() client: UserSocket,
    @MessageBody()
    data: { messageId: string; feedback: 'thumbs_up' | 'thumbs_down' },
  ) {
    if (!client.userId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      await this.copilotService.provideFeedback(
        data.messageId,
        client.userId,
        data.feedback,
      );
      client.emit('feedbackReceived', { success: true });
    } catch (error) {
      client.emit('error', { message: 'Failed to save feedback' });
    }
  }
}
