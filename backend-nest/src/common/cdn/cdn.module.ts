import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CDNService } from './cdn.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [CDNService],
  exports: [CDNService],
})
export class CDNModule {}
