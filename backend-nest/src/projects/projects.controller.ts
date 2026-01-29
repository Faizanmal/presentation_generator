import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { GenerateProjectDto } from './dto/generate-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Create a new empty project
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: any,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, createProjectDto);
  }

  /**
   * Generate a new project using AI
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @CurrentUser() user: any,
    @Body() generateProjectDto: GenerateProjectDto,
  ) {
    return this.projectsService.generate(user.id, generateProjectDto);
  }

  /**
   * Get all projects for the current user
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectsService.findAll(
      user.id,
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
    );
  }

  /**
   * Get a project by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.findOne(id, user.id);
  }

  /**
   * Get a project by share token (public)
   */
  @Get('shared/:shareToken')
  @UseGuards(OptionalJwtAuthGuard)
  async findByShareToken(@Param('shareToken') shareToken: string) {
    return this.projectsService.findByShareToken(shareToken);
  }

  /**
   * Update a project
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, updateProjectDto);
  }

  /**
   * Delete a project
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.remove(id, user.id);
  }

  /**
   * Duplicate a project
   */
  @Post(':id/duplicate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async duplicate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.duplicate(id, user.id);
  }
}
