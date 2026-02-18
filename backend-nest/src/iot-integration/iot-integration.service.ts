import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface DeviceCapabilities {
  display?: boolean;
  slideNavigation?: boolean;
  pointerControl?: boolean;
  voiceCommands?: boolean;
  gestureInput?: boolean;
  timer?: boolean;
  laserPointer?: boolean;
  annotations?: boolean;
}

interface DeviceState {
  connected: boolean;
  battery?: number;
  lastPing?: Date;
  currentSlide?: number;
  mode?: string;
}

@Injectable()
export class IoTIntegrationService {
  private readonly logger = new Logger(IoTIntegrationService.name);
  private deviceStates = new Map<string, DeviceState>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Register IoT device
   */
  async registerDevice(
    userId: string,
    device: {
      name: string;
      type:
        | 'presenter-remote'
        | 'smart-display'
        | 'smart-watch'
        | 'smart-speaker'
        | 'custom';
      capabilities: DeviceCapabilities;
      manufacturer?: string;
      model?: string;
    },
  ) {
    const deviceToken = `iot_${crypto.randomBytes(24).toString('hex')}`;

    return this.prisma.ioTDevice.create({
      data: {
        userId,
        name: device.name,
        deviceType: device.type,
        capabilities: device.capabilities as object,
        manufacturer: device.manufacturer,
        model: device.model,
        deviceToken,
        status: 'registered',
      },
    });
  }

  /**
   * Authenticate device
   */
  async authenticateDevice(deviceToken: string): Promise<{
    authenticated: boolean;
    device?: object;
  }> {
    const device = await this.prisma.ioTDevice.findFirst({
      where: { deviceToken, status: { not: 'revoked' } },
    });

    if (!device) {
      return { authenticated: false };
    }

    // Update last connected
    await this.prisma.ioTDevice.update({
      where: { id: device.id },
      data: {
        lastConnectedAt: new Date(),
        status: 'connected',
      },
    });

    this.deviceStates.set(device.id, {
      connected: true,
      lastPing: new Date(),
    });

    return {
      authenticated: true,
      device: {
        id: device.id,
        name: device.name,
        type: device.deviceType,
        capabilities: device.capabilities,
      },
    };
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string, userId: string) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }

    return {
      ...device,
      state: this.deviceStates.get(deviceId) || { connected: false },
    };
  }

  /**
   * List user's devices
   */
  async listDevices(userId: string) {
    const devices = await this.prisma.ioTDevice.findMany({
      where: { userId, status: { not: 'revoked' } },
    });

    return devices.map((d) => ({
      ...d,
      state: this.deviceStates.get(d.id) || { connected: false },
    }));
  }

  /**
   * Send command to device
   */
  async sendCommand(
    deviceId: string,
    userId: string,
    command: {
      action: string;
      payload?: object;
    },
  ) {
    const device = await this.getDevice(deviceId, userId);
    const capabilities = device.capabilities as DeviceCapabilities;

    // Validate command against capabilities
    const validCommands: Record<string, keyof DeviceCapabilities> = {
      'next-slide': 'slideNavigation',
      'prev-slide': 'slideNavigation',
      'goto-slide': 'slideNavigation',
      'pointer-on': 'pointerControl',
      'pointer-off': 'pointerControl',
      'start-timer': 'timer',
      'stop-timer': 'timer',
      annotate: 'annotations',
      'laser-on': 'laserPointer',
      'laser-off': 'laserPointer',
    };

    const requiredCapability = validCommands[command.action];
    if (requiredCapability && !capabilities[requiredCapability]) {
      throw new BadRequestException(`Device doesn't support ${command.action}`);
    }

    // Store command
    const storedCommand = await this.prisma.ioTCommand.create({
      data: {
        deviceId,
        command: command.action,
        payload: command.payload as object,
        status: 'pending',
      },
    });

    // In production, this would push to device via MQTT/WebSocket
    return {
      commandId: storedCommand.id,
      status: 'sent',
      message: `Command ${command.action} sent to device`,
    };
  }

  /**
   * Link device to presentation session
   */
  async linkToSession(deviceId: string, userId: string, sessionId: string) {
    const device = await this.getDevice(deviceId, userId);

    // Update device state
    const state = this.deviceStates.get(deviceId) || { connected: false };
    this.deviceStates.set(deviceId, {
      ...state,
      mode: 'presentation',
      currentSlide: 0,
    });

    return {
      linked: true,
      deviceId,
      sessionId,
      capabilities: device.capabilities,
    };
  }

  /**
   * Handle device event
   */
  async handleDeviceEvent(
    deviceId: string,
    event: {
      type: string;
      data?: object;
    },
  ) {
    const state = this.deviceStates.get(deviceId);

    if (!state) {
      throw new BadRequestException('Device not connected');
    }

    switch (event.type) {
      case 'ping':
        this.deviceStates.set(deviceId, {
          ...state,
          lastPing: new Date(),
        });
        break;

      case 'battery-update':
        this.deviceStates.set(deviceId, {
          ...state,
          battery: (event.data as { level?: number })?.level,
        });
        break;

      case 'slide-changed':
        this.deviceStates.set(deviceId, {
          ...state,
          currentSlide: (event.data as { slide?: number })?.slide,
        });
        break;

      case 'disconnected':
        this.deviceStates.set(deviceId, {
          ...state,
          connected: false,
        });
        await this.prisma.ioTDevice.update({
          where: { id: deviceId },
          data: { status: 'disconnected' },
        });
        break;
    }

    return { processed: true, type: event.type };
  }

  /**
   * Get supported device types
   */
  getSupportedDeviceTypes() {
    return [
      {
        type: 'presenter-remote',
        name: 'Presenter Remote',
        description: 'Wireless presentation clicker',
        defaultCapabilities: {
          slideNavigation: true,
          laserPointer: true,
          timer: true,
        },
        supportedModels: ['Logitech Spotlight', 'Logitech R500', 'Generic USB'],
      },
      {
        type: 'smart-watch',
        name: 'Smart Watch',
        description: 'Wearable device for presentation control',
        defaultCapabilities: {
          slideNavigation: true,
          timer: true,
          voiceCommands: true,
        },
        supportedModels: ['Apple Watch', 'Samsung Galaxy Watch', 'Wear OS'],
      },
      {
        type: 'smart-display',
        name: 'Smart Display',
        description: 'Display device for presenter view',
        defaultCapabilities: {
          display: true,
          timer: true,
        },
        supportedModels: ['Google Nest Hub', 'Amazon Echo Show', 'Custom'],
      },
      {
        type: 'smart-speaker',
        name: 'Smart Speaker',
        description: 'Voice-controlled device',
        defaultCapabilities: {
          voiceCommands: true,
          slideNavigation: true,
        },
        supportedModels: ['Amazon Echo', 'Google Home', 'HomePod'],
      },
      {
        type: 'custom',
        name: 'Custom Device',
        description: 'Custom IoT device integration',
        defaultCapabilities: {},
        supportedModels: [],
      },
    ];
  }

  /**
   * Revoke device
   */
  async revokeDevice(deviceId: string, userId: string) {
    await this.getDevice(deviceId, userId);

    this.deviceStates.delete(deviceId);

    return this.prisma.ioTDevice.update({
      where: { id: deviceId },
      data: { status: 'revoked' },
    });
  }

  /**
   * Get device commands history
   */
  async getCommandHistory(deviceId: string, userId: string) {
    await this.getDevice(deviceId, userId);

    return this.prisma.ioTCommand.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
