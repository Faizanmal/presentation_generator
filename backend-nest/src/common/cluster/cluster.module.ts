import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClusterRedisService } from './cluster-redis.service';
import { ScalablePrismaService } from './scalable-prisma.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ClusterRedisService, ScalablePrismaService],
  exports: [ClusterRedisService, ScalablePrismaService],
})
export class ClusterModule {}
