import { Module } from '@nestjs/common';
import {
  OrganizationsController,
  InvitationsController,
} from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController, InvitationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
