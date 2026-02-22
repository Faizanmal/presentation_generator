import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { IoTIntegrationService } from './iot-integration.service';

interface IoTSocket extends Socket {
  deviceId?: string;
  deviceToken?: string;
  sessionId?: string;
}

@WebSocketGateway({
  namespace: '/iot',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class IoTIntegrationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(IoTIntegrationGateway.name);

  constructor(private readonly iotService: IoTIntegrationService) {}

  handleConnection(client: IoTSocket) {
    this.logger.log(`IoT device connecting: ${client.id}`);
  }

  async handleDisconnect(client: IoTSocket) {
    this.logger.log(`IoT device disconnected: ${client.id}`);

    if (client.deviceId) {
      await this.iotService.handleDeviceEvent(client.deviceId, {
        type: 'disconnected',
      });
    }
  }

  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: IoTSocket,
    @MessageBody() data: { deviceToken: string },
  ) {
    try {
      const result = await this.iotService.authenticateDevice(data.deviceToken);

      if (!result.authenticated) {
        client.emit('error', { message: 'Authentication failed' });
        client.disconnect();
        return;
      }

      client.deviceToken = data.deviceToken;
      client.deviceId = (result.device as { id: string }).id;
      client.join(`device:${client.deviceId}`);

      client.emit('authenticated', { device: result.device });
    } catch {
      client.emit('error', { message: 'Authentication error' });
    }
  }

  @SubscribeMessage('linkSession')
  async handleLinkSession(
    @ConnectedSocket() client: IoTSocket,
    @MessageBody() data: { sessionId: string; userId: string },
  ) {
    if (!client.deviceId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      const result = await this.iotService.linkToSession(
        client.deviceId,
        data.userId,
        data.sessionId,
      );

      client.sessionId = data.sessionId;
      client.join(`session:${data.sessionId}`);

      client.emit('sessionLinked', result);
    } catch {
      client.emit('error', { message: 'Failed to link session' });
    }
  }

  @SubscribeMessage('command')
  handleCommand(
    @ConnectedSocket() client: IoTSocket,
    @MessageBody() data: { action: string; payload?: object },
  ) {
    if (!client.deviceId || !client.sessionId) {
      client.emit('error', { message: 'Not in a session' });
      return;
    }

    // Broadcast command to session
    this.server.to(`session:${client.sessionId}`).emit('deviceCommand', {
      deviceId: client.deviceId,
      action: data.action,
      payload: data.payload,
    });
  }

  @SubscribeMessage('event')
  async handleEvent(
    @ConnectedSocket() client: IoTSocket,
    @MessageBody() data: { type: string; data?: object },
  ) {
    if (!client.deviceId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    try {
      await this.iotService.handleDeviceEvent(client.deviceId, data);
      client.emit('eventAck', { type: data.type });
    } catch {
      client.emit('error', { message: 'Event processing failed' });
    }
  }

  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: IoTSocket) {
    if (client.deviceId) {
      await this.iotService.handleDeviceEvent(client.deviceId, {
        type: 'ping',
      });
    }
    client.emit('pong', { timestamp: Date.now() });
  }

  // Send command to specific device
  sendToDevice(deviceId: string, command: object) {
    this.server.to(`device:${deviceId}`).emit('command', command);
  }
}
