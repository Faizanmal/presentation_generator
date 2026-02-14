import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  async findAll(@CurrentUser() user: { id: string }) {
    return this.tagsService.findAll(user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tagsService.findOne(id, user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string },
    @Body() createTagDto: CreateTagDto,
  ) {
    return this.tagsService.create(user.id, createTagDto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() updateTagDto: UpdateTagDto,
  ) {
    return this.tagsService.update(id, user.id, updateTagDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.tagsService.remove(id, user.id);
  }

  @Post(':tagId/projects/:projectId')
  @HttpCode(HttpStatus.OK)
  async addToProject(
    @Param('tagId') tagId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tagsService.addToProject(tagId, projectId, user.id);
  }

  @Delete(':tagId/projects/:projectId')
  @HttpCode(HttpStatus.OK)
  async removeFromProject(
    @Param('tagId') tagId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.tagsService.removeFromProject(tagId, projectId, user.id);
  }
}
