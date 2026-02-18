import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CrossPlatformSyncService } from './cross-platform-sync.service';

class RegisterDeviceDto {
  deviceId: string;
  platform: string;
  deviceName?: string;
  appVersion?: string;
}

class ResolveConflictDto {
  strategy: 'last-write-wins' | 'merge' | 'manual';
  resolvedContent?: object;
}

@ApiTags('Cross-Platform Sync')
@Controller('sync')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CrossPlatformSyncController {
  constructor(private readonly syncService: CrossPlatformSyncService) {}

  @Post('devices')
  @ApiOperation({ summary: 'Register device for sync' })
  async registerDevice(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.syncService.registerDevice(req.user.id, dto);
  }

  @Get('devices')
  @ApiOperation({ summary: 'Get user devices' })
  async getUserDevices(@Request() req: { user: { id: string } }) {
    return this.syncService.getUserDevices(req.user.id);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Sync project state' })
  async syncProject(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() body: { deviceId: string },
  ) {
    return this.syncService.syncProject(req.user.id, projectId, body.deviceId);
  }

  @Get('projects/:projectId/status')
  @ApiOperation({ summary: 'Get sync status' })
  async getSyncStatus(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
  ) {
    return this.syncService.getSyncStatus(req.user.id, projectId);
  }

  @Post('projects/:projectId/resolve')
  @ApiOperation({ summary: 'Resolve sync conflict' })
  async resolveConflict(
    @Request() req: { user: { id: string } },
    @Param('projectId') projectId: string,
    @Body() dto: ResolveConflictDto,
  ) {
    return this.syncService.resolveConflict(req.user.id, projectId, dto);
  }
}
