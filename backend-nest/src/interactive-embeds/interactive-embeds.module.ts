import { Module } from '@nestjs/common';
import { InteractiveEmbedsService } from './interactive-embeds.service';
import { InteractiveEmbedsController } from './interactive-embeds.controller';
import { InteractiveEmbedsGateway } from './interactive-embeds.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InteractiveEmbedsController],
  providers: [InteractiveEmbedsService, InteractiveEmbedsGateway],
  exports: [InteractiveEmbedsService],
})
export class InteractiveEmbedsModule {}
