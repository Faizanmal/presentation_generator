import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AICopilotService } from './ai-copilot.service';
import { AICopilotController } from './ai-copilot.controller';
import { AICopilotGateway } from './ai-copilot.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AIModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AICopilotController],
  providers: [AICopilotService, AICopilotGateway],
  exports: [AICopilotService],
})
export class AICopilotModule {}
