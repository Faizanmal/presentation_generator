import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
// dynamically require the Socket.IO Redis adapter to avoid missing type declarations
const createAdapter: any = require('@socket.io/redis-adapter').createAdapter;
import IORedis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    private app: any,
    private configService: ConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const host = this.configService.get('REDIS_HOST') || 'localhost';
    const port = this.configService.get('REDIS_PORT') || 6379;

    // Create pub and sub clients
    const pubClient = new IORedis({ host, port });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => this.logger.error('Redis Pub Client Error', err));
    subClient.on('error', (err) => this.logger.error('Redis Sub Client Error', err));

    // ioredis connects automatically but call connect() for parity with node-redis
    if (typeof pubClient.connect === 'function') await pubClient.connect();
    if (typeof subClient.connect === 'function') await subClient.connect();

    this.adapterConstructor = createAdapter(pubClient as any, subClient as any);
    this.logger.log('Redis Adapter connected and ready');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
