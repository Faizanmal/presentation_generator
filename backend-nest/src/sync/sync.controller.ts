import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SyncService } from './sync.service';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  // ============================================
  // OFFLINE CACHE
  // ============================================

  /**
   * Get cached project data for offline use
   */
  @Get('cache/:projectId')
  async getCachedProject(
    @Request() req: any,
    @Param('projectId') projectId: string,
  ) {
    return this.syncService.getCachedProject(req.user.id, projectId);
  }

  /**
   * Save project data for offline use
   */
  @Post('cache/:projectId')
  async cacheProject(
    @Request() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { data: any; version: number },
  ) {
    return this.syncService.cacheProject(
      req.user.id,
      projectId,
      body.data,
      body.version,
    );
  }

  /**
   * Get all cached projects
   */
  @Get('cache')
  async getUserCachedProjects(@Request() req: any) {
    return this.syncService.getUserCachedProjects(req.user.id);
  }

  /**
   * Clear cache for a project
   */
  @Delete('cache/:projectId')
  async clearCache(@Request() req: any, @Param('projectId') projectId: string) {
    return this.syncService.clearCache(req.user.id, projectId);
  }

  // ============================================
  // SYNC QUEUE
  // ============================================

  /**
   * Queue a single sync operation
   */
  @Post('queue')
  async queueOperation(
    @Request() req: any,
    @Body()
    body: {
      projectId: string;
      operation: 'CREATE' | 'UPDATE' | 'DELETE';
      data: any;
    },
  ) {
    return this.syncService.queueSyncOperation(
      req.user.id,
      body.projectId,
      body.operation,
      body.data,
    );
  }

  /**
   * Queue multiple sync operations (batch)
   */
  @Post('queue/batch')
  async queueBatch(
    @Request() req: any,
    @Body()
    body: {
      operations: Array<{
        operation: 'CREATE' | 'UPDATE' | 'DELETE';
        resource: string;
        resourceId?: string;
        data: any;
        timestamp: number;
      }>;
    },
  ) {
    return this.syncService.queueBatchSync(req.user.id, body.operations);
  }

  /**
   * Get pending operations
   */
  @Get('queue')
  async getPendingOperations(
    @Request() req: any,
    @Param('projectId') projectId?: string,
  ) {
    return this.syncService.getPendingOperations(req.user.id, projectId);
  }

  /**
   * Process sync queue
   */
  @Post('process')
  async processSyncQueue(
    @Request() req: any,
    @Body() body: { projectId?: string },
  ) {
    return this.syncService.processSyncQueue(req.user.id, body.projectId);
  }

  // ============================================
  // CONFLICT RESOLUTION
  // ============================================

  /**
   * Check for conflicts before syncing
   */
  @Post('conflicts/detect')
  async detectConflicts(
    @Request() req: any,
    @Body()
    body: {
      projectId: string;
      clientVersion: number;
      clientData: any;
    },
  ) {
    return this.syncService.detectConflicts(
      req.user.id,
      body.projectId,
      body.clientVersion,
      body.clientData,
    );
  }

  /**
   * Resolve a conflict
   */
  @Post('conflicts/resolve')
  async resolveConflict(
    @Request() req: any,
    @Body()
    body: {
      projectId: string;
      resolution: {
        strategy: 'server-wins' | 'client-wins' | 'merge' | 'manual';
        serverVersion?: any;
        clientVersion?: any;
        mergedVersion?: any;
      };
    },
  ) {
    return this.syncService.resolveConflict(
      req.user.id,
      body.projectId,
      body.resolution,
    );
  }
}
