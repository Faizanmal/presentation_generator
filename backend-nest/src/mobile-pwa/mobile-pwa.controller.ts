import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { MobilePwaService } from './mobile-pwa.service';
import type { DeviceInfo } from './mobile-pwa.service';
import { PushNotificationService } from './push-notification.service';
import type { PushSubscription } from './push-notification.service';
import { OfflineSyncService } from './offline-sync.service';
import type { SyncOperation } from './offline-sync.service';

@ApiTags('Mobile & PWA')
@Controller('api/mobile')
export class MobilePwaController {
  constructor(
    private readonly mobileService: MobilePwaService,
    private readonly pushService: PushNotificationService,
    private readonly offlineService: OfflineSyncService,
  ) {}

  // ============================================
  // PWA MANIFEST & CONFIG
  // ============================================

  @Get('manifest.json')
  @Public()
  @Header('Content-Type', 'application/manifest+json')
  @ApiOperation({ summary: 'Get PWA manifest' })
  async getManifest(@Query('orgId') organizationId?: string) {
    return this.mobileService.getManifest({ organizationId });
  }

  @Get('sw-config')
  @Public()
  @ApiOperation({ summary: 'Get service worker configuration' })
  getServiceWorkerConfig() {
    return this.mobileService.getServiceWorkerConfig();
  }

  @Get('update-check')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check for app updates' })
  @ApiQuery({
    name: 'version',
    required: true,
    description: 'Current app version',
  })
  async checkForUpdates(@Query('version') currentVersion: string) {
    return this.mobileService.getAppUpdateInfo(currentVersion);
  }

  // ============================================
  // DEVICE MANAGEMENT
  // ============================================

  @Post('devices/register')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a device' })
  async registerDevice(@Body() deviceInfo: DeviceInfo, @Request() req) {
    return this.mobileService.registerDevice(req.user.id, deviceInfo);
  }

  @Post('devices/:deviceId/heartbeat')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update device activity' })
  async deviceHeartbeat(@Param('deviceId') deviceId: string, @Request() req) {
    await this.mobileService.updateDeviceActivity(req.user.id, deviceId);
  }

  @Get('devices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user devices' })
  async getDevices(@Request() req) {
    return this.mobileService.getUserDevices(req.user.id);
  }

  @Delete('devices/:deviceId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a device' })
  async removeDevice(@Param('deviceId') deviceId: string, @Request() req) {
    await this.mobileService.removeDevice(req.user.id, deviceId);
  }

  // ============================================
  // PUSH NOTIFICATIONS
  // ============================================

  @Post('push/subscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  async subscribePush(
    @Body()
    body: {
      subscription: PushSubscription;
      deviceInfo?: {
        deviceId?: string;
        deviceName?: string;
        platform?: string;
        userAgent?: string;
      };
    },
    @Request() req,
  ) {
    return this.pushService.registerSubscription(
      req.user.id,
      body.subscription,
      body.deviceInfo,
    );
  }

  @Post('push/unsubscribe')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  async unsubscribePush(@Body() body: { endpoint: string }, @Request() req) {
    await this.pushService.unregisterSubscription(req.user.id, body.endpoint);
  }

  @Get('push/subscriptions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get push subscriptions' })
  async getPushSubscriptions(@Request() req) {
    return this.pushService.getUserSubscriptions(req.user.id);
  }

  @Get('notifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get notifications' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getNotifications(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req?,
  ) {
    return this.pushService.getNotifications(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    });
  }

  @Get('notifications/unread-count')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Request() req) {
    const count = await this.pushService.getUnreadCount(req.user.id);
    return { count };
  }

  @Post('notifications/mark-read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark notifications as read' })
  async markAsRead(
    @Body() body: { notificationIds: string[] },
    @Request() req,
  ) {
    await this.pushService.markAsRead(req.user.id, body.notificationIds);
  }

  @Post('notifications/mark-all-read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req) {
    await this.pushService.markAllAsRead(req.user.id);
  }

  @Get('notifications/preferences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get notification preferences' })
  async getNotificationPreferences(@Request() req) {
    return this.pushService.getPreferences(req.user.id);
  }

  @Put('notifications/preferences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(
    @Body()
    updates: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      collaboration?: boolean;
      comments?: boolean;
      mentions?: boolean;
      exports?: boolean;
      aiGeneration?: boolean;
      teamInvites?: boolean;
      payments?: boolean;
      marketing?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    },
    @Request() req,
  ) {
    return this.pushService.updatePreferences(req.user.id, updates);
  }

  // ============================================
  // OFFLINE SYNC
  // ============================================

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sync offline operations' })
  async syncOperations(
    @Body() body: { operations: SyncOperation[] },
    @Request() req,
  ) {
    return this.offlineService.syncOperations(req.user.id, body.operations);
  }

  @Get('sync/initial')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get initial offline data' })
  @ApiQuery({ name: 'recentCount', required: false, type: Number })
  async getInitialOfflineData(
    @Query('recentCount') recentCount?: string,
    @Request() req?,
  ) {
    return this.offlineService.getOfflineData(req.user.id, {
      includeRecentPresentations: recentCount ? parseInt(recentCount) : 10,
      includeFavorites: true,
    });
  }

  @Get('sync/delta')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get changes since last sync' })
  @ApiQuery({
    name: 'since',
    required: true,
    type: Number,
    description: 'Last sync timestamp',
  })
  async getDeltaChanges(@Query('since') since: string, @Request() req) {
    return this.offlineService.getDeltaChanges(req.user.id, parseInt(since));
  }

  @Get('sync/conflicts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get pending sync conflicts' })
  async getPendingConflicts(@Request() req) {
    return this.offlineService.getPendingConflicts(req.user.id);
  }

  @Post('sync/conflicts/:conflictId/resolve')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resolve a sync conflict' })
  async resolveConflict(
    @Param('conflictId') conflictId: string,
    @Body()
    body: {
      resolution: 'client' | 'server' | 'merge';
      mergedData?: Record<string, any>;
    },
    @Request() req,
  ) {
    return this.offlineService.resolveConflict(
      req.user.id,
      conflictId,
      body.resolution,
      body.mergedData,
    );
  }

  // ============================================
  // MOBILE-OPTIMIZED DATA
  // ============================================

  @Get('presentations/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get mobile-optimized presentation' })
  @ApiQuery({
    name: 'quality',
    required: false,
    enum: ['low', 'medium', 'high'],
  })
  async getMobilePresentation(
    @Param('id') presentationId: string,
    @Query('quality') quality?: 'low' | 'medium' | 'high',
    @Request() req?,
  ) {
    return this.mobileService.getMobilePresentation(
      req.user.id,
      presentationId,
      { quality },
    );
  }

  @Get('quick-actions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get quick actions for mobile home' })
  async getQuickActions(@Request() req) {
    return this.mobileService.getQuickActions(req.user.id);
  }

  @Get('analytics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get mobile usage analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  async getMobileAnalytics(
    @Query('period') period?: 'day' | 'week' | 'month',
    @Request() req?,
  ) {
    return this.mobileService.getMobileAnalytics(req.user.id, period);
  }
}
