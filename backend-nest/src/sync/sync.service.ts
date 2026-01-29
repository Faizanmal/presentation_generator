import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';
type SyncStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface SyncData {
  operation: SyncOperation;
  resource: string;
  resourceId?: string;
  data: any;
  timestamp: number;
}

export interface ConflictResolution {
  strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
  serverVersion?: any;
  clientVersion?: any;
  mergedVersion?: any;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // OFFLINE CACHE MANAGEMENT
  // ============================================

  /**
   * Get cached project data for offline use
   */
  async getCachedProject(userId: string, projectId: string) {
    return this.prisma.offlineCache.findUnique({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
  }

  /**
   * Cache project data for offline use
   */
  async cacheProject(
    userId: string,
    projectId: string,
    data: any,
    version: number,
  ) {
    return this.prisma.offlineCache.upsert({
      where: {
        userId_projectId: { userId, projectId },
      },
      update: {
        data,
        version,
        lastSynced: new Date(),
        pendingSync: false,
      },
      create: {
        userId,
        projectId,
        data,
        version,
      },
    });
  }

  /**
   * Get all cached projects for a user
   */
  async getUserCachedProjects(userId: string) {
    return this.prisma.offlineCache.findMany({
      where: { userId },
      select: {
        projectId: true,
        version: true,
        lastSynced: true,
        pendingSync: true,
      },
    });
  }

  /**
   * Mark a project as having pending changes
   */
  async markPendingSync(userId: string, projectId: string) {
    return this.prisma.offlineCache.update({
      where: {
        userId_projectId: { userId, projectId },
      },
      data: { pendingSync: true },
    });
  }

  /**
   * Clear offline cache for a project
   */
  async clearCache(userId: string, projectId: string) {
    return this.prisma.offlineCache.delete({
      where: {
        userId_projectId: { userId, projectId },
      },
    });
  }

  // ============================================
  // SYNC QUEUE MANAGEMENT
  // ============================================

  /**
   * Queue a sync operation
   */
  async queueSyncOperation(
    userId: string,
    projectId: string,
    operation: SyncOperation,
    data: any,
  ) {
    return this.prisma.syncQueue.create({
      data: {
        userId,
        projectId,
        operation,
        data,
        priority: this.getOperationPriority(operation),
      },
    });
  }

  /**
   * Queue multiple sync operations (batch)
   */
  async queueBatchSync(userId: string, operations: SyncData[]) {
    const createMany = operations.map((op, index) => ({
      userId,
      projectId: op.data.projectId,
      operation: op.operation,
      data: op.data,
      priority: this.getOperationPriority(op.operation) + index,
    }));

    return this.prisma.syncQueue.createMany({
      data: createMany,
    });
  }

  /**
   * Get pending sync operations for a user
   */
  async getPendingOperations(userId: string, projectId?: string) {
    return this.prisma.syncQueue.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
        status: 'PENDING',
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Process sync queue for a user
   */
  async processSyncQueue(userId: string, projectId?: string) {
    const operations = await this.getPendingOperations(userId, projectId);

    if (operations.length === 0) {
      return { processed: 0, failed: 0, results: [] };
    }

    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    let processed = 0;
    let failed = 0;

    for (const op of operations) {
      try {
        await this.prisma.syncQueue.update({
          where: { id: op.id },
          data: { status: 'PROCESSING' },
        });

        await this.executeSyncOperation(op);

        await this.prisma.syncQueue.update({
          where: { id: op.id },
          data: { status: 'COMPLETED', processedAt: new Date() },
        });

        processed++;
        results.push({ id: op.id, success: true });
      } catch (error: any) {
        const attempts = op.attempts + 1;
        const status = attempts >= 3 ? 'FAILED' : 'PENDING';

        await this.prisma.syncQueue.update({
          where: { id: op.id },
          data: {
            status,
            attempts,
            error: error.message,
          },
        });

        if (status === 'FAILED') {
          failed++;
        }

        results.push({ id: op.id, success: false, error: error.message });
      }
    }

    // Update cache sync status if all operations completed
    if (projectId && failed === 0) {
      await this.prisma.offlineCache.update({
        where: {
          userId_projectId: { userId, projectId },
        },
        data: { pendingSync: false, lastSynced: new Date() },
      });
    }

    return { processed, failed, results };
  }

  /**
   * Execute a single sync operation
   */
  private async executeSyncOperation(op: any) {
    const { operation, data } = op;

    switch (data.resource) {
      case 'project':
        return this.syncProject(operation, data);
      case 'slide':
        return this.syncSlide(operation, data);
      case 'block':
        return this.syncBlock(operation, data);
      default:
        throw new BadRequestException(`Unknown resource: ${data.resource}`);
    }
  }

  private async syncProject(operation: SyncOperation, data: any) {
    switch (operation) {
      case 'UPDATE':
        return this.prisma.project.update({
          where: { id: data.id },
          data: {
            title: data.title,
            description: data.description,
            status: data.status,
            isPublic: data.isPublic,
          },
        });
      // CREATE and DELETE handled differently
      default:
        break;
    }
  }

  private async syncSlide(operation: SyncOperation, data: any) {
    switch (operation) {
      case 'CREATE':
        return this.prisma.slide.create({
          data: {
            id: data.id,
            projectId: data.projectId,
            order: data.order,
            layout: data.layout,
          },
        });
      case 'UPDATE':
        return this.prisma.slide.update({
          where: { id: data.id },
          data: {
            order: data.order,
            layout: data.layout,
          },
        });
      case 'DELETE':
        return this.prisma.slide.delete({
          where: { id: data.id },
        });
    }
  }

  private async syncBlock(operation: SyncOperation, data: any) {
    switch (operation) {
      case 'CREATE':
        return this.prisma.block.create({
          data: {
            id: data.id,
            projectId: data.projectId,
            slideId: data.slideId,
            blockType: data.blockType,
            content: data.content,
            order: data.order,
          },
        });
      case 'UPDATE':
        return this.prisma.block.update({
          where: { id: data.id },
          data: {
            content: data.content,
            order: data.order,
          },
        });
      case 'DELETE':
        return this.prisma.block.delete({
          where: { id: data.id },
        });
    }
  }

  private getOperationPriority(operation: SyncOperation): number {
    switch (operation) {
      case 'DELETE':
        return 0; // Process deletes first
      case 'CREATE':
        return 1;
      case 'UPDATE':
        return 2;
      default:
        return 3;
    }
  }

  // ============================================
  // CONFLICT RESOLUTION
  // ============================================

  /**
   * Detect and resolve conflicts between server and client versions
   */
  async detectConflicts(
    userId: string,
    projectId: string,
    clientVersion: number,
    clientData: any,
  ): Promise<ConflictResolution | null> {
    const cache = await this.getCachedProject(userId, projectId);
    const serverProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { include: { blocks: true } } },
    });

    if (!serverProject) {
      throw new BadRequestException('Project not found');
    }

    // Get server version (using updatedAt timestamp as version proxy)
    const serverVersion = serverProject.updatedAt.getTime();
    const cachedVersion = cache?.version || 0;

    // No conflict if client is up to date
    if (clientVersion >= serverVersion) {
      return null;
    }

    // Check if the same fields were modified
    const conflictingFields = this.findConflictingFields(
      serverProject,
      clientData,
      cache?.data || {},
    );

    if (conflictingFields.length === 0) {
      // No actual conflicts, can merge
      return {
        strategy: 'merge',
        serverVersion: serverProject,
        clientVersion: clientData,
        mergedVersion: this.mergeVersions(serverProject, clientData),
      };
    }

    // Return conflict info for manual resolution
    return {
      strategy: 'manual',
      serverVersion: serverProject,
      clientVersion: clientData,
    };
  }

  private findConflictingFields(
    server: any,
    client: any,
    cached: any,
  ): string[] {
    const conflicts: string[] = [];

    // Compare relevant fields
    const fieldsToCheck = ['title', 'description', 'status'];

    for (const field of fieldsToCheck) {
      const serverValue = server[field];
      const clientValue = client[field];
      const cachedValue = cached[field];

      // Conflict if both changed from cached value differently
      if (
        serverValue !== cachedValue &&
        clientValue !== cachedValue &&
        serverValue !== clientValue
      ) {
        conflicts.push(field);
      }
    }

    return conflicts;
  }

  private mergeVersions(server: any, client: any): any {
    // Simple last-write-wins merge for non-conflicting changes
    return {
      ...server,
      ...client,
      id: server.id,
      createdAt: server.createdAt,
      ownerId: server.ownerId,
    };
  }

  /**
   * Resolve a conflict with chosen strategy
   */
  async resolveConflict(
    userId: string,
    projectId: string,
    resolution: ConflictResolution,
  ) {
    switch (resolution.strategy) {
      case 'server-wins':
        // Just update cache with server version
        await this.cacheProject(
          userId,
          projectId,
          resolution.serverVersion,
          Date.now(),
        );
        return resolution.serverVersion;

      case 'client-wins':
        // Apply client changes to server
        await this.prisma.project.update({
          where: { id: projectId },
          data: resolution.clientVersion,
        });
        await this.cacheProject(
          userId,
          projectId,
          resolution.clientVersion,
          Date.now(),
        );
        return resolution.clientVersion;

      case 'merge':
        // Apply merged version
        await this.prisma.project.update({
          where: { id: projectId },
          data: resolution.mergedVersion,
        });
        await this.cacheProject(
          userId,
          projectId,
          resolution.mergedVersion,
          Date.now(),
        );
        return resolution.mergedVersion;

      default:
        throw new ConflictException('Manual resolution required');
    }
  }

  // ============================================
  // SCHEDULED TASKS
  // ============================================

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldSyncOperations() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.prisma.syncQueue.deleteMany({
      where: {
        status: 'COMPLETED',
        processedAt: { lt: thirtyDaysAgo },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old sync operations`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async retryFailedOperations() {
    // Reset failed operations older than 24 hours to retry
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await this.prisma.syncQueue.updateMany({
      where: {
        status: 'FAILED',
        createdAt: { lt: oneDayAgo },
        attempts: { lt: 5 },
      },
      data: {
        status: 'PENDING',
        error: null,
      },
    });
  }
}
