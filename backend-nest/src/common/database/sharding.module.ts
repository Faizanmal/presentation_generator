import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ShardingService } from './sharding.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ShardingService],
  exports: [ShardingService],
})
export class ShardingModule {}
