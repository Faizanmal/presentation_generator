import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [AIController],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
