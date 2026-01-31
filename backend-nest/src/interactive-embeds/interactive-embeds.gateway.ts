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
import { InteractiveEmbedsService } from './interactive-embeds.service';

@WebSocketGateway({
  namespace: '/interactive',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class InteractiveEmbedsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(InteractiveEmbedsGateway.name);
  private embedRooms: Map<string, Set<string>> = new Map();

  constructor(private readonly embedsService: InteractiveEmbedsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Remove from all rooms
    this.embedRooms.forEach((clients, embedId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.embedRooms.delete(embedId);
      }
    });
  }

  @SubscribeMessage('join-embed')
  handleJoinEmbed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string },
  ) {
    client.join(`embed:${data.embedId}`);
    
    if (!this.embedRooms.has(data.embedId)) {
      this.embedRooms.set(data.embedId, new Set());
    }
    this.embedRooms.get(data.embedId)!.add(client.id);
    
    // Notify participants count
    this.server.to(`embed:${data.embedId}`).emit('participants-updated', {
      count: this.embedRooms.get(data.embedId)!.size,
    });
    
    return { success: true };
  }

  @SubscribeMessage('leave-embed')
  handleLeaveEmbed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string },
  ) {
    client.leave(`embed:${data.embedId}`);
    
    const room = this.embedRooms.get(data.embedId);
    if (room) {
      room.delete(client.id);
      this.server.to(`embed:${data.embedId}`).emit('participants-updated', {
        count: room.size,
      });
    }
    
    return { success: true };
  }

  @SubscribeMessage('poll-vote')
  async handlePollVote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string; optionIds: string[]; voterId?: string },
  ) {
    try {
      const poll = await this.embedsService.votePoll(
        data.embedId,
        data.optionIds,
        data.voterId,
      );
      
      // Broadcast updated poll to all participants
      this.server.to(`embed:${data.embedId}`).emit('poll-updated', poll);
      
      return { success: true, poll };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('qa-question')
  async handleQAQuestion(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      embedId: string; 
      question: string; 
      authorName?: string;
      authorId?: string;
    },
  ) {
    try {
      const question = await this.embedsService.submitQuestion(
        data.embedId,
        data.question,
        data.authorName,
        data.authorId,
      );
      
      // Broadcast new question
      this.server.to(`embed:${data.embedId}`).emit('question-added', question);
      
      return { success: true, question };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('qa-upvote')
  async handleQAUpvote(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string; questionId: string; voterId?: string },
  ) {
    try {
      const qa = await this.embedsService.upvoteQuestion(
        data.embedId,
        data.questionId,
        data.voterId,
      );
      
      // Broadcast updated Q&A
      this.server.to(`embed:${data.embedId}`).emit('qa-updated', qa);
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('wordcloud-submit')
  async handleWordCloudSubmit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string; words: string[]; responderId?: string },
  ) {
    try {
      const words = await this.embedsService.submitWords(
        data.embedId,
        data.words,
        data.responderId,
      );
      
      // Broadcast updated word cloud
      this.server.to(`embed:${data.embedId}`).emit('wordcloud-updated', { words });
      
      return { success: true, words };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @SubscribeMessage('reaction')
  handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { embedId: string; reaction: string },
  ) {
    // Broadcast reaction to all participants (ephemeral, not stored)
    this.server.to(`embed:${data.embedId}`).emit('reaction-received', {
      reaction: data.reaction,
      clientId: client.id,
    });
    
    return { success: true };
  }
}
