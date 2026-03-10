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
import { JwtService } from '@nestjs/jwt';
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

  constructor(
    private readonly copilotService: AICopilotService,
    private readonly jwtService: JwtService,
  ) {}

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
  async handleAuthenticate(
    @ConnectedSocket() client: UserSocket,
    @MessageBody() data: { userId: string; token: string },
  ) {
    // Validate JWT token
    try {
      const payload = await this.jwtService.verifyAsync(data.token);
      if (payload.sub !== data.userId) {
        client.emit('error', { message: 'Token does not match userId' });
        client.disconnect();
        return;
      }
      client.userId = payload.sub;
      this.activeConnections.set(payload.sub, client);
      client.emit('authenticated', { success: true });
      this.logger.log(`User authenticated: ${payload.sub}`);
    } catch {
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect();
    }
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
      await client.join(`session:${session.id}`);

      client.emit('sessionStarted', { session });
    } catch {
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
      await client.join(`session:${session.id}`);

      client.emit('sessionJoined', { session });
    } catch {
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
    } catch {
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
    } catch (error) {
      client.emit('error', {
        message: `Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
    } catch {
      client.emit('error', { message: 'Failed to save feedback' });
    }
  }
}
