import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MobileApiService } from './mobile-api.service';

@Controller('mobile')
export class MobileApiController {
  constructor(private readonly mobileApiService: MobileApiService) {}

  /**
   * Get mobile app configuration
   */
  @Get('config')
  getAppConfig(
    @Headers('x-app-platform') platform: string = 'web',
    @Headers('x-app-version') version: string = '1.0.0',
  ) {
    return this.mobileApiService.getAppConfig(platform, version);
  }

  /**
   * Get mobile dashboard data
   */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  async getDashboard(@CurrentUser() user: { id: string }) {
    return this.mobileApiService.getMobileDashboard(user.id);
  }

  /**
   * Get mobile user profile
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.mobileApiService.getMobileUserProfile(user.id);
  }

  /**
   * Get presentations list for mobile
   */
  @Get('presentations')
  @UseGuards(JwtAuthGuard)
  async getPresentations(
    @CurrentUser() user: { id: string },
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: 'recent' | 'name' | 'created',
    @Query('filter') filter?: 'all' | 'owned' | 'shared' | 'favorites',
  ) {
    return this.mobileApiService.getMobilePresentations(user.id, {
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      sortBy,
      filter,
    });
  }

  /**
   * Get single presentation for mobile
   */
  @Get('presentations/:id')
  @UseGuards(JwtAuthGuard)
  async getPresentation(
    @CurrentUser() user: { id: string },
    @Param('id') presentationId: string,
    @Query('includeContent') includeContent?: boolean,
    @Query('quality') quality?: 'low' | 'medium' | 'high',
  ) {
    return this.mobileApiService.getMobilePresentation(
      presentationId,
      user.id,
      {
        includeSlideContent: includeContent === true,
        quality,
      },
    );
  }

  /**
   * Get slide content for mobile
   */
  @Get('slides/:id')
  @UseGuards(JwtAuthGuard)
  async getSlide(
    @CurrentUser() user: { id: string },
    @Param('id') slideId: string,
    @Query('quality') quality?: 'low' | 'medium' | 'high',
    @Query('includeAssets') includeAssets?: boolean,
  ) {
    return this.mobileApiService.getMobileSlide(slideId, user.id, {
      quality,
      includeAssets: includeAssets !== false,
    });
  }

  /**
   * Batch fetch slides for offline caching
   */
  @Post('presentations/:id/batch-slides')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async batchFetchSlides(
    @CurrentUser() user: { id: string },
    @Param('id') presentationId: string,
    @Body() body: { slideIds?: string[]; quality?: 'low' | 'medium' | 'high' },
  ) {
    return this.mobileApiService.batchFetchSlides(presentationId, user.id, {
      slideIds: body.slideIds,
      quality: body.quality,
    });
  }

  /**
   * Register mobile device for push notifications
   */
  @Post('device/register')
  @UseGuards(JwtAuthGuard)
  async registerDevice(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      deviceId: string;
      platform: 'ios' | 'android' | 'web';
      version: string;
      screenWidth: number;
      screenHeight: number;
      networkType?: 'wifi' | '4g' | '3g' | '2g' | 'offline';
      pushToken?: string;
    },
  ) {
    return this.mobileApiService.registerDevice(
      user.id,
      {
        deviceId: body.deviceId,
        platform: body.platform,
        version: body.version,
        screenWidth: body.screenWidth,
        screenHeight: body.screenHeight,
        networkType: body.networkType,
      },
      body.pushToken,
    );
  }

  /**
   * Update notification settings
   */
  @Put('notification-settings')
  @UseGuards(JwtAuthGuard)
  async updateNotificationSettings(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      commentNotifications?: boolean;
      viewNotifications?: boolean;
      shareNotifications?: boolean;
      quietHoursEnabled?: boolean;
      quietHoursStart?: string;
      quietHoursEnd?: string;
    },
  ) {
    return this.mobileApiService.updateNotificationSettings(user.id, body);
  }

  /**
   * Get notification settings
   */
  @Get('notification-settings')
  @UseGuards(JwtAuthGuard)
  async getNotificationSettings(@CurrentUser() user: { id: string }) {
    return this.mobileApiService.updateNotificationSettings(user.id, {});
  }

  /**
   * Sync changes from mobile
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async syncChanges(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      presentationId: string;
      slideChanges: Array<{
        slideId: string;
        content: unknown;
        localTimestamp: Date;
      }>;
      deletedSlides?: string[];
      newSlides?: Array<{
        tempId: string;
        order: number;
        content: unknown;
      }>;
    },
  ) {
    return this.mobileApiService.syncChanges(user.id, {
      presentationId: body.presentationId,
      slideChanges: body.slideChanges.map((c) => ({
        ...c,
        localTimestamp: new Date(c.localTimestamp),
      })),
      deletedSlides: body.deletedSlides,
      newSlides: body.newSlides,
    });
  }

  /**
   * Mobile search
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @CurrentUser() user: { id: string },
    @Query('q') query: string,
    @Query('type') type?: 'all' | 'presentations' | 'slides' | 'templates',
    @Query('limit') limit?: number,
  ) {
    return this.mobileApiService.mobileSearch(user.id, query, {
      type,
      limit: limit ? parseInt(String(limit), 10) : 20,
    });
  }

  /**
   * Track mobile analytics event
   */
  @Post('analytics/event')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackEvent(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      eventType: string;
      eventData?: Record<string, unknown>;
      deviceInfo?: {
        deviceId: string;
        platform: 'ios' | 'android' | 'web';
        version: string;
        screenWidth: number;
        screenHeight: number;
      };
      timestamp?: string;
    },
  ) {
    await this.mobileApiService.trackMobileEvent(user.id, {
      eventType: body.eventType,
      eventData: body.eventData,
      deviceInfo: body.deviceInfo,
      timestamp: body.timestamp ? new Date(body.timestamp) : undefined,
    });
  }

  /**
   * Batch analytics events
   */
  @Post('analytics/batch')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async trackBatchEvents(
    @CurrentUser() user: { id: string },
    @Body()
    body: {
      events: Array<{
        eventType: string;
        eventData?: Record<string, unknown>;
        timestamp?: string;
      }>;
      deviceInfo?: {
        deviceId: string;
        platform: 'ios' | 'android' | 'web';
        version: string;
        screenWidth: number;
        screenHeight: number;
      };
    },
  ) {
    for (const event of body.events) {
      await this.mobileApiService.trackMobileEvent(user.id, {
        eventType: event.eventType,
        eventData: event.eventData,
        deviceInfo: body.deviceInfo,
        timestamp: event.timestamp ? new Date(event.timestamp) : undefined,
      });
    }
  }

  /**
   * Health check for mobile
   */
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0.0',
    };
  }
}
