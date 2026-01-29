import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CollaborationService } from './collaboration.service';

interface CursorPosition {
  x: number;
  y: number;
  slideIndex: number;
}

interface BlockUpdate {
  projectId: string;
  slideId: string;
  blockId: string;
  data: any;
  userId: string;
}

interface SlideUpdate {
  projectId: string;
  slideId: string;
  data: any;
  userId: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: 'collaboration',
})
export class CollaborationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CollaborationGateway.name);
  private readonly userColors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#F8B500',
    '#00CED1',
  ];

  constructor(
    private readonly collaborationService: CollaborationService,
    private readonly jwtService: JwtService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Collaboration WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected - no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.userName = payload.name;
      client.data.color =
        this.userColors[Math.floor(Math.random() * this.userColors.length)];

      this.logger.log(`Client connected: ${client.id} (User: ${payload.sub})`);
    } catch (error) {
      this.logger.warn(
        `Client ${client.id} connection rejected - invalid token`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    const projectId = client.data.projectId;

    if (projectId && userId) {
      await this.collaborationService.removeSession(
        projectId,
        userId,
        client.id,
      );

      // Notify other users in the room
      client.to(projectId).emit('user:left', {
        userId,
        userName: client.data.userName,
        socketId: client.id,
      });
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    const userId = client.data.userId;
    const userName = client.data.userName;
    const color = client.data.color;

    // Store project ID on socket
    client.data.projectId = projectId;

    // Join the room
    await client.join(projectId);

    // Create collaboration session
    await this.collaborationService.createSession({
      projectId,
      userId,
      socketId: client.id,
      color,
    });

    // Get all active collaborators in this project
    const collaborators =
      await this.collaborationService.getActiveCollaborators(projectId);

    // Notify others
    client.to(projectId).emit('user:joined', {
      userId,
      userName,
      color,
      socketId: client.id,
    });

    // Send current collaborators to the joining user
    client.emit('collaborators:list', collaborators);

    this.logger.log(`User ${userId} joined project ${projectId}`);

    return { success: true, collaborators };
  }

  @SubscribeMessage('project:leave')
  async handleLeaveProject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string },
  ) {
    const { projectId } = data;
    const userId = client.data.userId;

    await client.leave(projectId);
    await this.collaborationService.removeSession(projectId, userId, client.id);

    client.to(projectId).emit('user:left', {
      userId,
      userName: client.data.userName,
      socketId: client.id,
    });

    client.data.projectId = null;

    return { success: true };
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CursorPosition,
  ) {
    const projectId = client.data.projectId;
    if (!projectId) return;

    // Broadcast cursor position to others
    client.to(projectId).emit('cursor:update', {
      userId: client.data.userId,
      userName: client.data.userName,
      color: client.data.color,
      ...data,
    });

    // Update session cursor position
    await this.collaborationService.updateCursorPosition(
      client.id,
      data.x,
      data.y,
      data.slideIndex,
    );
  }

  @SubscribeMessage('block:update')
  async handleBlockUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: BlockUpdate,
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    // Broadcast block update to others
    client.to(projectId).emit('block:updated', {
      ...data,
      userId: client.data.userId,
      userName: client.data.userName,
    });

    // Optionally persist to database
    await this.collaborationService.logBlockChange(data);
  }

  @SubscribeMessage('slide:update')
  async handleSlideUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SlideUpdate,
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    // Broadcast slide update to others
    client.to(projectId).emit('slide:updated', {
      ...data,
      userId: client.data.userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:add')
  async handleSlideAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; slide: any },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    client.to(projectId).emit('slide:added', {
      slide: data.slide,
      userId: client.data.userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:delete')
  async handleSlideDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; slideId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    client.to(projectId).emit('slide:deleted', {
      slideId: data.slideId,
      userId: client.data.userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:reorder')
  async handleSlideReorder(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { projectId: string; fromIndex: number; toIndex: number },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    client.to(projectId).emit('slide:reordered', {
      fromIndex: data.fromIndex,
      toIndex: data.toIndex,
      userId: client.data.userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('comment:add')
  async handleCommentAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      projectId: string;
      slideId?: string;
      blockId?: string;
      content: string;
    },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const comment = await this.collaborationService.createComment({
      projectId,
      slideId: data.slideId,
      blockId: data.blockId,
      userId: client.data.userId,
      content: data.content,
    });

    // Broadcast to all users in the project (including sender)
    this.server.to(projectId).emit('comment:added', {
      comment,
      userName: client.data.userName,
    });

    return { success: true, comment };
  }

  @SubscribeMessage('comment:resolve')
  async handleCommentResolve(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; commentId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    await this.collaborationService.resolveComment(data.commentId);

    this.server.to(projectId).emit('comment:resolved', {
      commentId: data.commentId,
      userId: client.data.userId,
    });

    return { success: true };
  }

  @SubscribeMessage('version:save')
  async handleVersionSave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { projectId: string; snapshot: any; message?: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const version = await this.collaborationService.createVersion({
      projectId,
      snapshot: data.snapshot,
      message: data.message,
      createdBy: client.data.userId,
    });

    this.server.to(projectId).emit('version:saved', {
      version,
      userName: client.data.userName,
    });

    return { success: true, version };
  }
}
