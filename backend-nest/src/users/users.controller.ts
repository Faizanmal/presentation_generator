import { Controller, Get, Patch, Put, Body, UseGuards, Res, Headers, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateEmailPreferencesDto } from './dto/update-email-preferences.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id);
  }

  /**
   * Update current user profile
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.update(user.id, updateProfileDto);
  }

  /**
   * Get current user subscription
   */
  @Get('subscription')
  async getSubscription(
    @CurrentUser() user: { id: string },
    @Res({ passthrough: true }) res: Response,
    @Headers('if-none-match') ifNoneMatch?: string,
  ) {
    const subscription = await this.usersService.getSubscription(user.id);
    const subRecord = subscription as { id?: string; plan?: string; updatedAt?: string | Date } | null;
    const stamp = subRecord?.updatedAt ? new Date(subRecord.updatedAt).getTime() : 0;
    const etag = `W/"sub-${user.id}-${subRecord?.plan || 'none'}-${stamp}"`;

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache, stale-while-revalidate=60');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(HttpStatus.NOT_MODIFIED);
      return;
    }

    return subscription;
  }

  /**
   * Get current user email preferences
   */
  @Get('me/email-preferences')
  async getEmailPreferences(@CurrentUser() user: { id: string }) {
    return this.usersService.getEmailPreferences(user.id);
  }

  /**
   * Update current user email preferences
   */
  @Put('me/email-preferences')
  async updateEmailPreferences(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateEmailPreferencesDto,
  ) {
    return this.usersService.updateEmailPreferences(user.id, dto);
  }
}
