import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain' | 'update';
  position?: number;
  length?: number;
  content?: unknown;
  path?: string;
  timestamp: number;
  clientId: string;
}

interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  resolvedContent?: unknown;
  conflictingOperations?: Operation[];
}

@Injectable()
export class CrossPlatformSyncService {
  private readonly logger = new Logger(CrossPlatformSyncService.name);
  private serverVersion = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Register a device for sync
   */
  async registerDevice(
    userId: string,
    deviceInfo: {
      deviceId: string;
      platform: string;
      deviceName?: string;
      appVersion?: string;
    },
  ) {
    // Prisma schema uses `deviceId` as unique; cast to any where input shape differs
    return this.prisma.deviceSync.upsert({
      where: { deviceId: deviceInfo.deviceId } as any,
      update: {
        platform: deviceInfo.platform,
        deviceName: deviceInfo.deviceName,
        // appVersion is not a typed field in schema — store under syncVersion if needed
        lastSyncAt: new Date(),
        isOnline: true,
      } as any,
      create: {
        userId,
        deviceId: deviceInfo.deviceId,
        platform: deviceInfo.platform,
        deviceName: deviceInfo.deviceName,
        isOnline: true,
      } as any,
    });
  }

  /**
   * Update device online status
   */
  async setDeviceOnline(userId: string, deviceId: string, online: boolean) {
    return this.prisma.deviceSync.update({
      where: { deviceId } as any,
      data: {
        isOnline: online,
        lastSyncAt: new Date(),
      },
    } as any);
  }

  /**
   * Get user's devices
   */
  async getUserDevices(userId: string) {
    return this.prisma.deviceSync.findMany({
      where: { userId },
      orderBy: { lastSyncAt: 'desc' },
    });
  }

  /**
   * Store offline operation
   */
  async storeOfflineOperation(
    userId: string,
    projectId: string,
    operation: Omit<Operation, 'id' | 'timestamp'>,
    deviceId: string,
  ) {
    return this.prisma.operationalTransform.create({
      data: {
        projectId,
        userId,
        // Prisma model expects a string for `operation` — store the operation as JSON text
        operation: JSON.stringify(operation),
        serverSeq: await this.getNextVersion(projectId),
        isApplied: false,
      } as any,
    });
  }

  /**
   * Get next version number
   */
  private async getNextVersion(projectId: string): Promise<number> {
    const current = this.serverVersion.get(projectId) || 0;

    // Get from DB if not cached
    if (!this.serverVersion.has(projectId)) {
      const latest = await this.prisma.operationalTransform.findFirst({
        where: { projectId },
        orderBy: { serverSeq: 'desc' },
      });
      const version = (latest?.serverSeq || 0) + 1;
      this.serverVersion.set(projectId, version);
      return version;
    }

    const next = current + 1;
    this.serverVersion.set(projectId, next);
    return next;
  }

  /**
   * Get pending operations for sync
   */
  async getPendingOperations(projectId: string, sinceVersion: number) {
    const rows = await this.prisma.operationalTransform.findMany({
      where: {
        projectId,
        serverSeq: { gt: sinceVersion },
      },
      orderBy: { serverSeq: 'asc' },
    });

    // Parse stored operation JSON (Prisma stores `operation` as string in schema)
    return rows.map((r) => ({
      ...r,
      operation: (() => {
        try {
          return typeof r.operation === 'string' ? JSON.parse(r.operation) : r.operation;
        } catch (e) {
          return r.operation;
        }
      })(),
    } as any));
  }

  /**
   * Apply and transform operations (OT)
   */
  async applyOperations(
    projectId: string,
    userId: string,
    operations: Operation[],
    baseVersion: number,
  ): Promise<{
    applied: Operation[];
    serverVersion: number;
    conflicts?: Operation[];
  }> {
    // Get operations that happened since client's base version
    const serverOps = await this.getPendingOperations(projectId, baseVersion);
    const applied: Operation[] = [];

    if (serverOps.length === 0) {
      // No conflicts, apply directly
      for (const op of operations) {
        const stored = await this.prisma.operationalTransform.create({
          data: {
            projectId,
            userId,
            operation: JSON.stringify(op),
            serverSeq: await this.getNextVersion(projectId),
            isApplied: true,
          } as any,
        });
        applied.push({ ...op, id: stored.id });
      }

      return {
        applied,
        serverVersion:
          this.serverVersion.get(projectId) || baseVersion + operations.length,
      };
    }

    // Transform operations against concurrent changes
    const transformed = this.transformOperations(
      operations,
      serverOps.map((o) => o.operation as Operation),
    );

    const transformedOps: Operation[] = transformed;
    for (const op of transformedOps) {
      const stored = await this.prisma.operationalTransform.create({
        data: {
          projectId,
          userId,
          operation: JSON.stringify(op),
          serverSeq: await this.getNextVersion(projectId),
          isApplied: true,
        } as any,
      });
      applied.push({ ...op, id: stored.id });
    }

    return {
      applied,
      serverVersion:
        this.serverVersion.get(projectId) || baseVersion + applied.length,
      conflicts:
        serverOps.length > 0
          ? serverOps.map((o) => o.operation as Operation)
          : undefined,
    };
  }

  /**
   * Transform operations (simplified OT algorithm)
   */
  private transformOperations(
    clientOps: Operation[],
    serverOps: Operation[],
  ): Operation[] {
    return clientOps.map((clientOp) => {
      const transformed = { ...clientOp };

      for (const serverOp of serverOps) {
        // Skip if same client
        if (serverOp.clientId === clientOp.clientId) continue;

        // Transform based on operation types
        if (clientOp.type === 'insert' && serverOp.type === 'insert') {
          // If server inserted before our position, shift our position
          if (
            serverOp.position !== undefined &&
            transformed.position !== undefined
          ) {
            if (serverOp.position <= transformed.position) {
              transformed.position += serverOp.length || 1;
            }
          }
        } else if (clientOp.type === 'delete' && serverOp.type === 'insert') {
          if (
            serverOp.position !== undefined &&
            transformed.position !== undefined
          ) {
            if (serverOp.position <= transformed.position) {
              transformed.position += serverOp.length || 1;
            }
          }
        } else if (clientOp.type === 'insert' && serverOp.type === 'delete') {
          if (
            serverOp.position !== undefined &&
            transformed.position !== undefined
          ) {
            if (serverOp.position < transformed.position) {
              transformed.position = Math.max(
                serverOp.position,
                transformed.position - (serverOp.length || 1),
              );
            }
          }
        }
        // For update operations on same path, use last-write-wins
        else if (clientOp.type === 'update' && serverOp.type === 'update') {
          if (clientOp.path === serverOp.path) {
            // Client's operation wins if it's newer
            if (clientOp.timestamp > serverOp.timestamp) {
              // Keep client's operation
            } else {
              // Server's operation already applied, merge or skip
              transformed.content = this.mergeContent(
                serverOp.content,
                clientOp.content,
              );
            }
          }
        }
      }

      return transformed;
    });
  }

  /**
   * Merge content (for concurrent updates)
   */
  private mergeContent(
    serverContent: unknown,
    clientContent: unknown,
  ): unknown {
    if (!serverContent || !clientContent) {
      return clientContent || serverContent;
    }

    // Simple object merge for structured content
    if (
      typeof serverContent === 'object' &&
      typeof clientContent === 'object'
    ) {
      return { ...serverContent, ...clientContent };
    }

    // For primitive values, prefer client's version
    return clientContent;
  }

  /**
   * Sync full project state (for initial load or full sync)
   */
  async syncProject(userId: string, projectId: string, deviceId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: {
          include: { blocks: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check access
    if (project.ownerId !== userId) {
      const collaborator = await this.prisma.projectCollaborator.findFirst({
        where: { projectId, userId },
      });
      if (!collaborator) {
        throw new BadRequestException('No access to project');
      }
    }

    // Update device sync state
    const currentVersion = this.serverVersion.get(projectId) || 0;

    await this.prisma.deviceSync.update({
      where: { deviceId } as any,
      data: {
        lastSyncAt: new Date(),
        // store small sync metadata in `offlineData` JSON since schema doesn't have `syncState`
        syncVersion: currentVersion,
        offlineData: { projectId, version: currentVersion, syncedAt: new Date().toISOString() },
      } as any,
    });

    return {
      project,
      version: currentVersion,
      syncedAt: new Date(),
    };
  }

  /**
   * Get sync status for a project
   */
  async getSyncStatus(userId: string, projectId: string) {
    const devices = await this.prisma.deviceSync.findMany({
      where: { userId },
    });

    const operations = await this.prisma.operationalTransform.aggregate({
      where: { projectId },
      _count: true,
      _max: { serverSeq: true },
    });

    return {
      currentVersion: operations._max.serverSeq || 0,
      totalOperations: operations._count,
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        platform: d.platform,
        isOnline: d.isOnline,
        lastSyncAt: d.lastSyncAt,
        // `syncState` isn't a Prisma field; present `offlineData` instead
        syncState: d.offlineData,
      })),
    };
  }

  /**
   * Resolve conflict manually
   */
  async resolveConflict(
    userId: string,
    projectId: string,
    resolution: ConflictResolution,
  ) {
    if (resolution.strategy === 'manual' && resolution.resolvedContent) {
      // Apply the manually resolved content
      const op: Operation = {
        id: `resolve-${Date.now()}`,
        type: 'update',
        content: resolution.resolvedContent,
        timestamp: Date.now(),
        clientId: 'server',
      };

      await this.prisma.operationalTransform.create({
        data: {
          projectId,
          userId,
          operation: JSON.stringify(op),
          serverSeq: await this.getNextVersion(projectId),
          isApplied: true,
        } as any,
      });
    }

    return { resolved: true, version: this.serverVersion.get(projectId) };
  }

  /**
   * Clean up old operations (for maintenance)
   */
  async cleanupOldOperations(projectId: string, keepVersions: number = 1000) {
    const current = this.serverVersion.get(projectId) || 0;
    const cutoff = current - keepVersions;

    if (cutoff > 0) {
      await this.prisma.operationalTransform.deleteMany({
        where: {
          projectId,
          serverSeq: { lt: cutoff },
        },
      });
    }

    return { cleaned: true, currentVersion: current };
  }
}
