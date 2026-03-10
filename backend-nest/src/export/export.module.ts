import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { WysiwygExportService } from './wysiwyg-export.service';
import { WysiwygExportController } from './wysiwyg-export.controller';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, ProjectsModule, UsersModule],
  controllers: [ExportController, WysiwygExportController],
  providers: [ExportService, WysiwygExportService],
  exports: [ExportService, WysiwygExportService],
})
export class ExportModule {}
