import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IoTIntegrationService } from './iot-integration.service';
import { IoTIntegrationController } from './iot-integration.controller';
import { IoTIntegrationGateway } from './iot-integration.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [IoTIntegrationController],
  providers: [IoTIntegrationService, IoTIntegrationGateway],
  exports: [IoTIntegrationService],
})
export class IoTIntegrationModule {}
