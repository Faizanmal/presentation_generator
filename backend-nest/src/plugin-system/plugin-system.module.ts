import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PluginSystemService } from './plugin-system.service';
import { PluginSystemController } from './plugin-system.controller';
import { PluginRegistryService } from './plugin-registry.service';
import { PluginSandboxService } from './plugin-sandbox.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [PluginSystemController],
  providers: [PluginSystemService, PluginRegistryService, PluginSandboxService],
  exports: [PluginSystemService, PluginRegistryService],
})
export class PluginSystemModule {}
