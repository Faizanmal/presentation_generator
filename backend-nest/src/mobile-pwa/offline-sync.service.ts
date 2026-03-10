import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export interface SyncOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;
  resourceId?: string;
  data: Record<string, any>;
  timestamp: number;
  clientId: string;
}

export interface SyncConflict {
  clientOperation: SyncOperation;
  serverState: Record<string, any>;
  serverTimestamp: number;
}

export interface SyncResult {
  synced: string[];
  conflicts: SyncConflict[];
  errors: Array<{ operationId: string; error: string }>;
}

@Injectable()
export class OfflineSyncService {
  private readonly logger = new Logger(OfflineSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('offline-sync') private syncQueue: Queue,
  ) {}

  /**
   * Process batch of offline operations
   */
  async syncOperations(
    userId: string,
    operations: SyncOperation[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: [],
      conflicts: [],
      errors: [],
    };

    // Sort operations by timestamp
    const sortedOps = [...operations].sort((a, b) => a.timestamp - b.timestamp);

    for (const op of sortedOps) {
      try {
        const syncResult = await this.processOperation(userId, op);

        if (syncResult.success) {
          result.synced.push(op.id);
        } else if (syncResult.conflict) {
          result.conflicts.push(syncResult.conflict);
        } else {
          result.errors.push({
            operationId: op.id,
            error: syncResult.error || 'Unknown error',
          });
        }
      } catch (error) {
        this.logger.error(`Sync operation failed: ${error.message}`);
        result.errors.push({ operationId: op.id, error: error.message });
      }
    }

    // Log sync session
    await this.prisma.syncSession.create({
      data: {
        userId,
        operationCount: operations.length,
        syncedCount: result.synced.length,
        conflictCount: result.conflicts.length,
        errorCount: result.errors.length,
        completedAt: new Date(),
      },
    });

    return result;
  }

  /**
   * Process individual sync operation
   */
  private async processOperation(
    userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    switch (op.resource) {
      case 'presentation':
        return this.syncPresentation(userId, op);
      case 'slide':
        return this.syncSlide(userId, op);
      case 'block':
        return this.syncBlock(userId, op);
      case 'comment':
        return this.syncComment(userId, op);
      case 'note':
        return this.syncNote(userId, op);
      default:
        return {
          success: false,
          error: `Unknown resource type: ${op.resource}`,
        };
    }
  }

  private async syncPresentation(
    userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (op.type === 'CREATE') {
      // Create new presentation
      const existing = await this.prisma.presentation.findUnique({
        where: { id: op.resourceId },
      });

      if (existing) {
        return {
          success: false,
          conflict: {
            clientOperation: op,
            serverState: existing as object,
            serverTimestamp: existing.updatedAt.getTime(),
          },
        };
      }

      await this.prisma.presentation.create({
        data: {
          id: op.resourceId,
          userId,
          title: op.data.title || 'Untitled',
          content: op.data.content || {},
          isOfflineCreated: true,
          ...op.data,
        },
      });

      return { success: true };
    }

    if (op.type === 'UPDATE') {
      const existing = await this.prisma.presentation.findUnique({
        where: { id: op.resourceId },
      });

      if (!existing) {
        return { success: false, error: 'Presentation not found' };
      }

      // Check for conflicts (server modified after client's offline change)
      if (existing.updatedAt.getTime() > op.timestamp) {
        return {
          success: false,
          conflict: {
            clientOperation: op,
            serverState: existing as object,
            serverTimestamp: existing.updatedAt.getTime(),
          },
        };
      }

      await this.prisma.presentation.update({
        where: { id: op.resourceId },
        data: op.data,
      });

      return { success: true };
    }

    if (op.type === 'DELETE') {
      await this.prisma.presentation.delete({
        where: { id: op.resourceId },
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid operation type' };
  }

  private async syncSlide(
    _userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (op.type === 'CREATE') {
      await this.prisma.slide.create({
        data: {
          id: op.resourceId,
          projectId: op.data.projectId || op.data.presentationId,
          presentationId: op.data.presentationId,
          order: op.data.position || op.data.order || 0,
          content: op.data.content || {},
        },
      });
      return { success: true };
    }

    if (op.type === 'UPDATE') {
      const existing = await this.prisma.slide.findUnique({
        where: { id: op.resourceId },
      });

      if (!existing) {
        return { success: false, error: 'Slide not found' };
      }

      if (existing.updatedAt.getTime() > op.timestamp) {
        return {
          success: false,
          conflict: {
            clientOperation: op,
            serverState: existing as object,
            serverTimestamp: existing.updatedAt.getTime(),
          },
        };
      }

      await this.prisma.slide.update({
        where: { id: op.resourceId },
        data: op.data,
      });

      return { success: true };
    }

    if (op.type === 'DELETE') {
      await this.prisma.slide.delete({
        where: { id: op.resourceId },
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid operation type' };
  }

  private async syncBlock(
    _userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (op.type === 'CREATE') {
      await this.prisma.block.create({
        data: {
          id: op.resourceId,
          slideId: op.data.slideId,
          projectId: op.data.projectId || '',
          blockType: op.data.blockType || op.data.type || 'PARAGRAPH',
          type: op.data.type,
          content: op.data.content || {},
          order: op.data.position || op.data.order || 0,
        },
      });
      return { success: true };
    }

    if (op.type === 'UPDATE') {
      const existing = await this.prisma.block.findUnique({
        where: { id: op.resourceId },
      });

      if (!existing) {
        return { success: false, error: 'Block not found' };
      }

      if (existing.updatedAt.getTime() > op.timestamp) {
        return {
          success: false,
          conflict: {
            clientOperation: op,
            serverState: existing as object,
            serverTimestamp: existing.updatedAt.getTime(),
          },
        };
      }

      await this.prisma.block.update({
        where: { id: op.resourceId },
        data: op.data,
      });

      return { success: true };
    }

    if (op.type === 'DELETE') {
      await this.prisma.block.delete({
        where: { id: op.resourceId },
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid operation type' };
  }

  private async syncComment(
    userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (op.type === 'CREATE') {
      await this.prisma.comment.create({
        data: {
          id: op.resourceId,
          userId,
          projectId: op.data.projectId || op.data.presentationId || '',
          presentationId: op.data.presentationId,
          slideId: op.data.slideId,
          content: op.data.content || '',
        },
      });
      return { success: true };
    }

    if (op.type === 'UPDATE') {
      await this.prisma.comment.update({
        where: { id: op.resourceId },
        data: op.data,
      });
      return { success: true };
    }

    if (op.type === 'DELETE') {
      await this.prisma.comment.delete({
        where: { id: op.resourceId },
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid operation type' };
  }

  private async syncNote(
    _userId: string,
    op: SyncOperation,
  ): Promise<{ success: boolean; conflict?: SyncConflict; error?: string }> {
    if (op.type === 'CREATE') {
      await this.prisma.speakerNote.create({
        data: {
          id: op.resourceId,
          slideId: op.data.slideId,
          content: op.data.content,
          ...op.data,
        },
      });
      return { success: true };
    }

    if (op.type === 'UPDATE') {
      await this.prisma.speakerNote.update({
        where: { id: op.resourceId },
        data: op.data,
      });
      return { success: true };
    }

    if (op.type === 'DELETE') {
      await this.prisma.speakerNote.delete({
        where: { id: op.resourceId },
      });
      return { success: true };
    }

    return { success: false, error: 'Invalid operation type' };
  }

  /**
   * Get data for offline cache (initial sync)
   */
  async getOfflineData(
    userId: string,
    options: {
      includeRecentPresentations?: number;
      includeFavorites?: boolean;
      includeShared?: boolean;
    } = {},
  ) {
    const presentations = await this.prisma.presentation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: options.includeRecentPresentations || 10,
      include: {
        slides: {
          include: {
            blocks: true,
            speakerNotes: true,
          },
        },
      },
    });

    // Get user's brand kits
    const brandKits = await this.prisma.brandKit.findMany({
      where: { userId },
    });

    // Get user's templates
    const templates = await this.prisma.template.findMany({
      where: { OR: [{ userId }, { isPublic: true }] },
      take: 20,
    });

    return {
      presentations,
      brandKits,
      templates,
      syncTimestamp: Date.now(),
      version: '1.0',
    };
  }

  /**
   * Get delta changes since last sync
   */
  async getDeltaChanges(
    userId: string,
    lastSyncTimestamp: number,
  ): Promise<{
    created: Record<string, any[]>;
    updated: Record<string, any[]>;
    deleted: Record<string, string[]>;
  }> {
    const sinceDate = new Date(lastSyncTimestamp);

    // Get created/updated presentations
    const presentations = await this.prisma.presentation.findMany({
      where: {
        userId,
        OR: [
          { createdAt: { gte: sinceDate } },
          { updatedAt: { gte: sinceDate } },
        ],
      },
      include: {
        slides: {
          include: {
            blocks: true,
          },
        },
      },
    });

    const created: Record<string, any[]> = {
      presentations: [],
      slides: [],
      blocks: [],
    };

    const updated: Record<string, any[]> = {
      presentations: [],
      slides: [],
      blocks: [],
    };

    for (const pres of presentations) {
      if (pres.createdAt.getTime() >= lastSyncTimestamp) {
        created.presentations.push(pres);
      } else {
        updated.presentations.push(pres);
      }

      for (const slide of pres.slides) {
        if (slide.createdAt.getTime() >= lastSyncTimestamp) {
          created.slides.push(slide);
        } else if (slide.updatedAt.getTime() >= lastSyncTimestamp) {
          updated.slides.push(slide);
        }

        for (const block of slide.blocks) {
          if (block.createdAt.getTime() >= lastSyncTimestamp) {
            created.blocks.push(block);
          } else if (block.updatedAt.getTime() >= lastSyncTimestamp) {
            updated.blocks.push(block);
          }
        }
      }
    }

    // Get deleted items from deletion log
    const deletions = await this.prisma.deletionLog.findMany({
      where: {
        userId,
        deletedAt: { gte: sinceDate },
      },
    });

    const deleted: Record<string, string[]> = {
      presentations: [],
      slides: [],
      blocks: [],
    };

    for (const del of deletions) {
      const resType = del.resourceType ?? '';
      const resId = del.resourceId ?? '';
      if (deleted[resType]) {
        deleted[resType].push(resId);
      }
    }

    return { created, updated, deleted };
  }

  /**
   * Resolve a sync conflict
   */
  async resolveConflict(
    userId: string,
    conflictId: string,
    resolution: 'client' | 'server' | 'merge',
    mergedData?: Record<string, any>,
  ): Promise<{ success: boolean }> {
    const conflict = await this.prisma.syncConflict.findUnique({
      where: { id: conflictId },
    });

    if (!conflict || conflict.userId !== userId) {
      return { success: false };
    }

    if (resolution === 'client') {
      // Apply client's version
      await this.applyClientResolution(conflict);
    } else if (resolution === 'server') {
      // Keep server's version (no action needed)
    } else if (resolution === 'merge' && mergedData) {
      // Apply merged data
      await this.applyMergedResolution(conflict, mergedData);
    }

    // Mark conflict as resolved
    await this.prisma.syncConflict.update({
      where: { id: conflictId },
      data: {
        resolved: true,
        resolution,
        resolvedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async applyClientResolution(conflict: any): Promise<void> {
    const clientOp = conflict.clientOperation as SyncOperation;

    switch (clientOp.resource) {
      case 'presentation':
        await this.prisma.presentation.update({
          where: { id: clientOp.resourceId },
          data: clientOp.data,
        });
        break;
      case 'slide':
        await this.prisma.slide.update({
          where: { id: clientOp.resourceId },
          data: clientOp.data,
        });
        break;
      case 'block':
        await this.prisma.block.update({
          where: { id: clientOp.resourceId },
          data: clientOp.data,
        });
        break;
    }
  }

  private async applyMergedResolution(
    conflict: any,
    mergedData: Record<string, any>,
  ): Promise<void> {
    const clientOp = conflict.clientOperation as SyncOperation;

    switch (clientOp.resource) {
      case 'presentation':
        await this.prisma.presentation.update({
          where: { id: clientOp.resourceId },
          data: mergedData,
        });
        break;
      case 'slide':
        await this.prisma.slide.update({
          where: { id: clientOp.resourceId },
          data: mergedData,
        });
        break;
      case 'block':
        await this.prisma.block.update({
          where: { id: clientOp.resourceId },
          data: mergedData,
        });
        break;
    }
  }

  /**
   * Get pending conflicts for user
   */
  async getPendingConflicts(userId: string) {
    return this.prisma.syncConflict.findMany({
      where: { userId, resolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }
}
