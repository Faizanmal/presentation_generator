import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { createClient } from 'redis';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  // private adapterConstructor: ReturnType<typeof createAdapter>;
  private readonly logger = new Logger(RedisIoAdapter.name);

  constructor(
    private app: import('@nestjs/common').INestApplicationContext,
    private configService: ConfigService,
  ) {
    super(app);
  }

  connectToRedis(): Promise<void> {
    // Redis adapter temporarily disabled due to missing dependencies
    this.logger.log('Redis Adapter disabled - using default adapter');
    return Promise.resolve();
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    // server.adapter(this.adapterConstructor);
    return server;
  }
}
