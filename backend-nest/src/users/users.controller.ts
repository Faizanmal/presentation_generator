import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.findById(user.id);
  }

  /**
   * Update current user profile
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.update(user.id, updateProfileDto);
  }

  /**
   * Get current user subscription
   */
  @Get('subscription')
  async getSubscription(@CurrentUser() user: any) {
    return this.usersService.getSubscription(user.id);
  }
}
