import { Module } from '@nestjs/common';
import { ContentLibraryService } from './content-library.service';
import { ContentLibraryController } from './content-library.controller';

@Module({
  controllers: [ContentLibraryController],
  providers: [ContentLibraryService],
  exports: [ContentLibraryService],
})
export class ContentLibraryModule {}
