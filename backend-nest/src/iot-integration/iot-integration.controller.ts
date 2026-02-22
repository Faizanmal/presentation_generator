import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IoTIntegrationService } from './iot-integration.service';

class RegisterDeviceDto {
  name: string;
  type:
    | 'presenter-remote'
    | 'smart-display'
    | 'smart-watch'
    | 'smart-speaker'
    | 'custom';
  capabilities: {
    display?: boolean;
    slideNavigation?: boolean;
    pointerControl?: boolean;
    voiceCommands?: boolean;
    gestureInput?: boolean;
    timer?: boolean;
    laserPointer?: boolean;
    annotations?: boolean;
  };
  manufacturer?: string;
  model?: string;
}

class SendCommandDto {
  action: string;
  payload?: object;
}

@ApiTags('IoT Integration')
@Controller('iot')
export class IoTIntegrationController {
  constructor(private readonly iotService: IoTIntegrationService) {}

  @Get('device-types')
  @ApiOperation({ summary: 'Get supported device types' })
  getSupportedDeviceTypes() {
    return this.iotService.getSupportedDeviceTypes();
  }

  @Get('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List user devices' })
  async listDevices(
    @Request() req: { user: { id: string } },
  ): Promise<unknown> {
    return this.iotService.listDevices(req.user.id);
  }

  @Post('devices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register new device' })
  async registerDevice(
    @Request() req: { user: { id: string } },
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.iotService.registerDevice(req.user.id, dto);
  }

  @Get('devices/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get device details' })
  async getDevice(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ): Promise<unknown> {
    return this.iotService.getDevice(id, req.user.id);
  }

  @Post('devices/:id/command')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send command to device' })
  async sendCommand(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() dto: SendCommandDto,
  ) {
    return this.iotService.sendCommand(id, req.user.id, dto);
  }

  @Post('devices/:id/link/:sessionId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Link device to session' })
  async linkToSession(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.iotService.linkToSession(id, req.user.id, sessionId);
  }

  @Get('devices/:id/commands')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get command history' })
  async getCommandHistory(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.iotService.getCommandHistory(id, req.user.id);
  }

  @Delete('devices/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke device' })
  async revokeDevice(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    return this.iotService.revokeDevice(id, req.user.id);
  }
}
