import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
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
    const pubClient = createClient({ url: `redis://${host}:${port}` });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) =>
      this.logger.error('Redis Pub Client Error', err),
    );
    subClient.on('error', (err) =>
      this.logger.error('Redis Sub Client Error', err),
    );

    await Promise.all([pubClient.connect(), subClient.connect()]);

    this.adapterConstructor = createAdapter(pubClient, subClient);
    this.logger.log('Redis Adapter connected and ready');
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
