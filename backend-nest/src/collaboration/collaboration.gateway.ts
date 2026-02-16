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
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CollaborationService } from './collaboration.service';
import { WebSocketConfig } from '../common/config/concurrency.config';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userName: string;
    projectId?: string;
    color: string;
  };
}

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
  pingInterval: WebSocketConfig.pingInterval,
  pingTimeout: WebSocketConfig.pingTimeout,
  maxHttpBufferSize: 1e6, // 1MB max message size
  transports: WebSocketConfig.transports,
  perMessageDeflate: WebSocketConfig.perMessageDeflate,
  upgradeTimeout: WebSocketConfig.upgradeTimeout,
  // Enable adapter for horizontal scaling
  adapter: process.env.REDIS_HOST ? undefined : undefined, // Redis adapter configured separately
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
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  afterInit() {
    this.logger.log('Collaboration WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    const authClient = client as unknown as AuthenticatedSocket;
    try {
      const token =
        (client.handshake.auth.token as string) ||
        (client.handshake.headers.authorization &&
          client.handshake.headers.authorization.split(' ')[1]);

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected - no token`);
        client.disconnect();
        return;
      }

      interface JwtPayload {
        sub: string;
        name: string;
      }
      const payload = this.jwtService.verify(token) as unknown as JwtPayload;
      authClient.data.userId = payload.sub;
      authClient.data.userName = payload.name;
      authClient.data.color =
        this.userColors[Math.floor(Math.random() * this.userColors.length)];

      this.logger.log(
        `Client connected: ${client.id} (User: ${authClient.data.userId})`,
      );
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.warn(
          `Client ${client.id} connection rejected - invalid token: ${error.message}`,
        );
      } else {
        this.logger.warn(
          `Client ${client.id} connection rejected - invalid token`,
        );
      }
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
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
        userId: userId,
        userName: client.data.userName,
        socketId: client.id,
      });
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('project:join')
  async handleJoinProject(
    @ConnectedSocket() client: AuthenticatedSocket,
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
    @ConnectedSocket() client: AuthenticatedSocket,
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

    client.data.projectId = undefined;

    return { success: true };
  }

  @SubscribeMessage('cursor:move')
  async handleCursorMove(
    @ConnectedSocket() client: AuthenticatedSocket,
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
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: BlockUpdate,
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized block:update attempt by ${userId} on project ${projectId}`);
      return;
    }

    // Broadcast block update to others
    client.to(projectId).emit('block:updated', {
      ...data,
      userId,
      userName: client.data.userName,
    });

    // Persist audit/log
    this.collaborationService.logBlockChange(data);
  }

  @SubscribeMessage('slide:update')
  async handleSlideUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SlideUpdate,
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized slide:update attempt by ${userId} on ${projectId}`);
      return;
    }

    // Broadcast slide update to others
    client.to(projectId).emit('slide:updated', {
      ...data,
      userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:add')
  async handleSlideAdd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; slide: unknown },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized slide:add by ${userId} on ${projectId}`);
      return;
    }

    client.to(projectId).emit('slide:added', {
      slide: data.slide as Record<string, unknown>,
      userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:delete')
  async handleSlideDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; slideId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized slide:delete by ${userId} on ${projectId}`);
      return;
    }

    client.to(projectId).emit('slide:deleted', {
      slideId: data.slideId,
      userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('slide:reorder')
  async handleSlideReorder(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { projectId: string; fromIndex: number; toIndex: number },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized slide:reorder by ${userId} on ${projectId}`);
      return;
    }

    client.to(projectId).emit('slide:reordered', {
      fromIndex: data.fromIndex,
      toIndex: data.toIndex,
      userId,
      userName: client.data.userName,
    });
  }

  @SubscribeMessage('comment:add')
  async handleCommentAdd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      projectId: string;
      slideId?: string;
      blockId?: string;
      content: string;
    },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId)
      return { success: false, error: 'User not in project' };

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'COMMENTER' && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized comment:add by ${userId} on project ${projectId}`);
      return { success: false, error: 'Not allowed' };
    }

    const comment = await this.collaborationService.createComment({
      projectId,
      slideId: data.slideId,
      blockId: data.blockId,
      userId,
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
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; commentId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized comment:resolve by ${userId} on ${projectId}`);
      return { success: false, error: 'Not allowed' };
    }

    await this.collaborationService.resolveComment(data.commentId);

    this.server.to(projectId).emit('comment:resolved', {
      commentId: data.commentId,
      userId,
    });

    return { success: true };
  }

  @SubscribeMessage('version:save')
  async handleVersionSave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { projectId: string; snapshot: unknown; message?: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const userId = client.data.userId;
    const isOwner = await this.collaborationService.isProjectOwner(projectId, userId);
    const role = await this.collaborationService.getUserRole(projectId, userId);
    if (!isOwner && role !== 'EDITOR') {
      this.logger.warn(`Unauthorized version:save by ${userId} on ${projectId}`);
      return { success: false, error: 'Not allowed' };
    }

    const version = await this.collaborationService.createVersion({
      projectId,
      snapshot: data.snapshot as Record<string, unknown>,
      message: data.message,
      createdBy: userId,
    });

    this.server.to(projectId).emit('version:saved', {
      version,
      userName: client.data.userName,
    });

    return { success: true, version };
  }

  // ============================================
  // LIVE Q&A AND POLLS - GAMMA LEVEL FEATURES
  // ============================================

  // Store for active Q&A sessions and polls (in production, use Redis)
  private qaQuestions: Map<
    string,
    Array<{
      id: string;
      question: string;
      askedBy: string;
      askedByName: string;
      upvotes: number;
      upvotedBy: string[];
      answered: boolean;
      timestamp: Date;
    }>
  > = new Map();

  private activePolls: Map<
    string,
    {
      id: string;
      projectId: string;
      question: string;
      options: Array<{ id: string; text: string; votes: number }>;
      voters: string[];
      createdBy: string;
      isActive: boolean;
      createdAt: Date;
      endsAt?: Date;
    }
  > = new Map();

  @SubscribeMessage('qa:start')
  handleQAStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    // Initialize Q&A for this project (Redis check not strictly needed as we push to list)
    // if (!this.qaQuestions.has(projectId)) {
    //   this.qaQuestions.set(projectId, []);
    // }

    this.server.to(projectId).emit('qa:started', {
      startedBy: client.data.userName,
      timestamp: new Date(),
    });

    this.logger.log(
      `Q&A started for project ${projectId} by ${client.data.userName}`,
    );
    return { success: true };
  }

  @SubscribeMessage('qa:askQuestion')
  async handleAskQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; question: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const key = `qa:${projectId}`;

    const newQuestion = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question: data.question,
      askedBy: client.data.userId,
      askedByName: client.data.userName || 'Anonymous',
      upvotes: 0,
      upvotedBy: [],
      answered: false,
      timestamp: new Date(),
    };

    await this.redis.rpush(key, JSON.stringify(newQuestion));
    // Set 24h expiry for clean up
    await this.redis.expire(key, 86400);

    this.server.to(projectId).emit('qa:newQuestion', {
      question: newQuestion,
    });

    this.logger.log(
      `New question in ${projectId}: ${data.question.substring(0, 50)}...`,
    );
    return { success: true, questionId: newQuestion.id };
  }

  @SubscribeMessage('qa:upvoteQuestion')
  async handleUpvoteQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; questionId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    // Retrieve questions from Redis
    const key = `qa:${projectId}`;
    const rawQuestions = await this.redis.lrange(key, 0, -1);
    const questions = rawQuestions.map((q) => JSON.parse(q));

    // Find and update
    const questionIndex = questions.findIndex(
      (q: unknown) => (q as any).id === data.questionId,
    );

    if (
      questionIndex !== -1 &&
      !questions[questionIndex].upvotedBy.includes(client.data.userId)
    ) {
      questions[questionIndex].upvotes++;
      questions[questionIndex].upvotedBy.push(client.data.userId);

      // Update in Redis
      await this.redis.lset(
        key,
        questionIndex,
        JSON.stringify(questions[questionIndex]),
      );

      this.server.to(projectId).emit('qa:questionUpvoted', {
        questionId: data.questionId,
        upvotes: questions[questionIndex].upvotes,
        upvotedBy: client.data.userName,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('qa:answerQuestion')
  async handleAnswerQuestion(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; questionId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    // Retrieve questions from Redis
    const key = `qa:${projectId}`;
    const rawQuestions = await this.redis.lrange(key, 0, -1);
    const questions = rawQuestions.map((q) => JSON.parse(q));

    // Find and update
    const questionIndex = questions.findIndex(
      (q: unknown) => (q as any).id === (data as any).questionId,
    );

    if (questionIndex !== -1) {
      questions[questionIndex].answered = true;

      // Update in Redis
      await this.redis.lset(
        key,
        questionIndex,
        JSON.stringify(questions[questionIndex]),
      );

      this.server.to(projectId).emit('qa:questionAnswered', {
        questionId: data.questionId,
        answeredBy: client.data.userName,
      });
    }

    return { success: true };
  }

  @SubscribeMessage('qa:getQuestions')
  async handleGetQuestions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const key = `qa:${projectId}`;
    const rawQuestions = await this.redis.lrange(key, 0, -1);
    const questions = rawQuestions
      .map((q) => JSON.parse(q))
      .sort((a: unknown, b: unknown) => {
        const aTyped = a as any;
        const bTyped = b as any;
        if (bTyped.upvotes !== aTyped.upvotes)
          return bTyped.upvotes - aTyped.upvotes;
        return (
          new Date(bTyped.timestamp).getTime() -
          new Date(aTyped.timestamp).getTime()
        );
      });

    return { success: true, questions };
  }

  @SubscribeMessage('qa:end')
  async handleQAEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const key = `qa:${projectId}`;
    // const rawQuestions = await this.redis.lrange(key, 0, -1); // Not needed for clearing

    // Clear functionality
    await this.redis.del(key);

    return { success: true };
  }

  // Poll functionality
  @SubscribeMessage('poll:create')
  async handlePollCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      projectId: string;
      question: string;
      options: string[];
      durationMinutes?: number;
    },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const pollId = `poll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const poll = {
      id: pollId,
      projectId,
      question: data.question,
      options: data.options.map((text, index) => ({
        id: `opt_${index}`,
        text,
        votes: 0,
      })),
      voters: [],
      createdBy: client.data.userId,
      isActive: true,
      createdAt: new Date(),
      endsAt: data.durationMinutes
        ? new Date(Date.now() + data.durationMinutes * 60 * 1000)
        : undefined,
    };

    const activePollsKey = `polls:${projectId}`;
    const pollKey = `poll:${pollId}`;

    await this.redis.hset(pollKey, 'data', JSON.stringify(poll));
    await this.redis.expire(pollKey, 86400); // 24h
    await this.redis.sadd(activePollsKey, pollId);

    // this.activePolls.set(pollId, poll);

    this.server.to(projectId).emit('poll:created', {
      poll: {
        ...poll,
        options: poll.options.map((o) => ({ ...o, votes: 0 })), // Don't send vote counts initially
      },
      createdBy: client.data.userName,
    });

    // Auto-end poll after duration
    if (data.durationMinutes) {
      setTimeout(
        () => {
          void this.endPoll(pollId, projectId);
        },
        data.durationMinutes * 60 * 1000,
      );
    }

    this.logger.log(`Poll created in ${projectId}: ${data.question}`);
    return { success: true, pollId };
  }

  @SubscribeMessage('poll:vote')
  async handlePollVote(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { projectId: string; pollId: string; optionId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const pollKey = `poll:${data.pollId}`;
    const rawPoll = await this.redis.hget(pollKey, 'data');
    if (!rawPoll) return { success: false, error: 'Poll not found' };

    const poll = JSON.parse(rawPoll);

    if (!poll || !poll.isActive) {
      return { success: false, error: 'Poll not found or inactive' };
    }

    if (poll.voters.includes(client.data.userId)) {
      return { success: false, error: 'Already voted' };
    }

    const option = poll.options.find((o) => o.id === data.optionId);
    if (!option) {
      return { success: false, error: 'Invalid option' };
    }

    poll.voters.push(client.data.userId);

    // Save back to Redis
    await this.redis.hset(pollKey, 'data', JSON.stringify(poll));

    // Broadcast updated vote counts
    this.server.to(projectId).emit('poll:voteReceived', {
      pollId: data.pollId,
      totalVotes: poll.voters.length,
      // Only send percentage for live updates
      results: poll.options.map((o) => ({
        id: o.id,
        percentage:
          poll.voters.length > 0
            ? Math.round((o.votes / poll.voters.length) * 100)
            : 0,
      })),
    });

    return { success: true };
  }

  @SubscribeMessage('poll:end')
  async handlePollEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; pollId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    await this.endPoll(data.pollId, projectId);
    return { success: true };
  }

  private async endPoll(pollId: string, projectId: string) {
    const pollKey = `poll:${pollId}`;
    const rawPoll = await this.redis.hget(pollKey, 'data');
    if (!rawPoll) return;

    const poll = JSON.parse(rawPoll);

    poll.isActive = false;
    await this.redis.hset(pollKey, 'data', JSON.stringify(poll));

    // Remove from active polls list
    const activePollsKey = `polls:${projectId}`;
    await this.redis.srem(activePollsKey, pollId);

    // Send final results
    this.server.to(projectId).emit('poll:ended', {
      pollId,
      question: poll.question,
      totalVotes: poll.voters.length,
      results: poll.options.map((o) => ({
        id: o.id,
        text: o.text,
        votes: o.votes,
        percentage:
          poll.voters.length > 0
            ? Math.round((o.votes / poll.voters.length) * 100)
            : 0,
      })),
    });

    this.logger.log(
      `Poll ended: ${poll.question} - ${poll.voters.length} votes`,
    );
  }

  @SubscribeMessage('poll:getActive')
  async handleGetActivePolls(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const activePollsKey = `polls:${projectId}`;
    const activePollIds = await this.redis.smembers(activePollsKey);
    const activePolls: unknown[] = [];

    for (const pollId of activePollIds) {
      const rawPoll = await this.redis.hget(`poll:${pollId}`, 'data');
      if (rawPoll) {
        const poll = JSON.parse(rawPoll);
        if (poll.isActive) {
          activePolls.push({
            id: poll.id,
            question: poll.question,
            options: poll.options.map((o: any) => ({
              id: o.id,
              text: o.text,
            })),
            hasVoted: poll.voters.includes(client.data.userId),
            totalVotes: poll.voters.length,
            createdAt: poll.createdAt,
            endsAt: poll.endsAt,
          });
        }
      }
    }

    return { success: true, polls: activePolls };
  }

  // Presentation mode controls
  @SubscribeMessage('presentation:start')
  handlePresentationStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    this.server.to(projectId).emit('presentation:started', {
      presenterId: client.data.userId,
      presenterName: client.data.userName,
      currentSlide: 0,
    });

    return { success: true };
  }

  @SubscribeMessage('presentation:navigate')
  handlePresentationNavigate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; slideIndex: number },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    this.server.to(projectId).emit('presentation:slideChanged', {
      slideIndex: data.slideIndex,
      changedBy: client.data.userName,
    });

    return { success: true };
  }

  @SubscribeMessage('presentation:end')
  handlePresentationEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    this.server.to(projectId).emit('presentation:ended', {
      endedBy: client.data.userName,
    });

    return { success: true };
  }

  @SubscribeMessage('reaction:send')
  handleReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; reaction: string },
  ) {
    const projectId = client.data.projectId;
    if (!projectId || projectId !== data.projectId) return;

    const allowedReactions = ['👍', '❤️', '🎉', '👏', '🔥', '💡', '❓', '✅'];
    if (!allowedReactions.includes(data.reaction)) {
      return { success: false, error: 'Invalid reaction' };
    }

    this.server.to(projectId).emit('reaction:received', {
      reaction: data.reaction,
      userName: client.data.userName,
      userId: client.data.userId,
    });

    return { success: true };
  }
}
