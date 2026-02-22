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
import { CrossPlatformSyncService } from './cross-platform-sync.service';

interface SyncSocket extends Socket {
  userId?: string;
  deviceId?: string;
  projectId?: string;
  currentVersion?: number;
}

@WebSocketGateway({
  namespace: '/sync',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class CrossPlatformSyncGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrossPlatformSyncGateway.name);

  constructor(private readonly syncService: CrossPlatformSyncService) {}

  handleConnection(client: SyncSocket) {
    this.logger.log(`Sync client connected: ${client.id}`);
  }

  async handleDisconnect(client: SyncSocket) {
    this.logger.log(`Sync client disconnected: ${client.id}`);

    if (client.userId && client.deviceId) {
      await this.syncService.setDeviceOnline(
        client.userId,
        client.deviceId,
        false,
      );
    }

    if (client.projectId) {
      client.to(`sync:${client.projectId}`).emit('deviceOffline', {
        deviceId: client.deviceId,
      });
    }
  }

  @SubscribeMessage('register')
  async handleRegister(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody()
    data: {
      userId: string;
      deviceId: string;
      platform: string;
      deviceName?: string;
    },
  ) {
    try {
      const device = await this.syncService.registerDevice(data.userId, {
        deviceId: data.deviceId,
        platform: data.platform,
        deviceName: data.deviceName,
      });

      client.userId = data.userId;
      client.deviceId = data.deviceId;

      client.join(`user:${data.userId}`);

      client.emit('registered', { device });
    } catch {
      client.emit('error', { message: 'Failed to register device' });
    }
  }

  @SubscribeMessage('joinProject')
  async handleJoinProject(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody() data: { projectId: string; currentVersion?: number },
  ) {
    if (!client.userId || !client.deviceId) {
      client.emit('error', { message: 'Not registered' });
      return;
    }

    try {
      const sync = await this.syncService.syncProject(
        client.userId,
        data.projectId,
        client.deviceId,
      );

      client.projectId = data.projectId;
      client.currentVersion = sync.version;

      client.join(`sync:${data.projectId}`);

      // If client is behind, send pending operations
      if (
        data.currentVersion !== undefined &&
        data.currentVersion < sync.version
      ) {
        const pending = await this.syncService.getPendingOperations(
          data.projectId,
          data.currentVersion,
        );

        client.emit('syncUpdate', {
          operations: pending.map((o) => o.operation),
          serverVersion: sync.version,
        });
      } else {
        client.emit('joined', {
          project: sync.project,
          version: sync.version,
        });
      }

      // Notify other devices
      client.to(`sync:${data.projectId}`).emit('deviceJoined', {
        deviceId: client.deviceId,
        platform: data.projectId,
      });
    } catch (error) {
      client.emit('error', {
        message:
          error instanceof Error ? error.message : 'Failed to join project',
      });
    }
  }

  @SubscribeMessage('operations')
  async handleOperations(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody()
    data: {
      operations: Array<{
        type: 'insert' | 'delete' | 'retain' | 'update';
        position?: number;
        length?: number;
        content?: unknown;
        path?: string;
      }>;
      baseVersion: number;
    },
  ) {
    if (!client.userId || !client.projectId) {
      client.emit('error', { message: 'Not in a project' });
      return;
    }

    try {
      const opsWithMeta = data.operations.map((op) => ({
        ...op,
        id: `${client.deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        clientId: client.deviceId!,
      }));

      const result = await this.syncService.applyOperations(
        client.projectId,
        client.userId,
        opsWithMeta,
        data.baseVersion,
      );

      // Update client's version
      client.currentVersion = result.serverVersion;

      // Confirm to sender
      client.emit('operationsAck', {
        applied: result.applied,
        serverVersion: result.serverVersion,
      });

      // Broadcast to other clients
      client.to(`sync:${client.projectId}`).emit('remoteOperations', {
        operations: result.applied,
        fromDevice: client.deviceId,
        serverVersion: result.serverVersion,
      });

      // If there were conflicts
      if (result.conflicts) {
        client.emit('conflicts', {
          conflicting: result.conflicts,
          applied: result.applied,
        });
      }
    } catch {
      client.emit('error', { message: 'Failed to apply operations' });
    }
  }

  @SubscribeMessage('requestSync')
  async handleRequestSync(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody() data: { sinceVersion: number },
  ) {
    if (!client.projectId) {
      client.emit('error', { message: 'Not in a project' });
      return;
    }

    try {
      const pending = await this.syncService.getPendingOperations(
        client.projectId,
        data.sinceVersion,
      );

      client.emit('syncUpdate', {
        operations: pending.map((o) => o.operation),
        serverVersion:
          pending.length > 0
            ? pending[pending.length - 1].version
            : data.sinceVersion,
      });
    } catch {
      client.emit('error', { message: 'Failed to get sync updates' });
    }
  }

  @SubscribeMessage('resolveConflict')
  async handleResolveConflict(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody()
    data: {
      strategy: 'last-write-wins' | 'merge' | 'manual';
      resolvedContent?: unknown;
    },
  ) {
    if (!client.userId || !client.projectId) {
      client.emit('error', { message: 'Not in a project' });
      return;
    }

    try {
      const result = await this.syncService.resolveConflict(
        client.userId,
        client.projectId,
        data,
      );

      // Broadcast resolution to all clients
      this.server.to(`sync:${client.projectId}`).emit('conflictResolved', {
        resolvedBy: client.deviceId,
        version: result.version,
        content: data.resolvedContent,
      });
    } catch {
      client.emit('error', { message: 'Failed to resolve conflict' });
    }
  }

  @SubscribeMessage('presence')
  handlePresence(
    @ConnectedSocket() client: SyncSocket,
    @MessageBody()
    data: { cursor?: { x: number; y: number }; selection?: unknown },
  ) {
    if (!client.projectId || !client.deviceId) return;

    // Broadcast cursor/selection to others
    client.to(`sync:${client.projectId}`).emit('presence', {
      deviceId: client.deviceId,
      ...data,
    });
  }
}
