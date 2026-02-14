import { Controller, Get, Patch, Put, Body, UseGuards } from '@nestjs/common';
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
  async getSubscription(@CurrentUser() user: { id: string }) {
    return this.usersService.getSubscription(user.id);
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
