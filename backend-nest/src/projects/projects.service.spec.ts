import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AIService } from '../ai/ai.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ProjectType } from '@prisma/client';
import { GenerationTone } from './dto/generate-project.dto';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let _prismaService: PrismaService;
  let _usersService: UsersService;
  let _aiService: AIService;
  let _queue: any;

  const mockPrismaService = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    slide: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    block: {
      create: jest.fn(),
    },
    theme: {
      findFirst: jest.fn(),
    },
    projectCollaborator: {
      findUnique: jest.fn(),
    },
  };

  const mockUsersService = {
    canCreateProject: jest.fn(),
    canGenerateAI: jest.fn(),
    incrementAIGenerations: jest.fn(),
  };

  const mockAIService = {
    generatePresentation: jest.fn(),
    generatePresentationImages: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: AIService,
          useValue: mockAIService,
        },
        {
          provide: getQueueToken('generation'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    _prismaService = module.get<PrismaService>(PrismaService);
    _usersService = module.get<UsersService>(UsersService);
    _aiService = module.get<AIService>(AIService);
    _queue = module.get(getQueueToken('generation'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project successfully', async () => {
      const createDto = { title: 'My Project', description: 'Test' };
      const userId = 'user1';
      const mockProject = {
        id: 'proj1',
        ...createDto,
        ownerId: userId,
        type: ProjectType.PRESENTATION,
      };

      mockUsersService.canCreateProject.mockResolvedValue(true);
      mockPrismaService.project.create.mockResolvedValue(mockProject);
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject); // For findOne call at end of create

      const result = await service.create(userId, createDto);

      expect(result).toEqual(mockProject);
      expect(mockUsersService.canCreateProject).toHaveBeenCalledWith(userId);
      expect(mockPrismaService.project.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if project limit reached', async () => {
      mockUsersService.canCreateProject.mockResolvedValue(false);

      await expect(service.create('user1', { title: 'Test' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated projects', async () => {
      const mockProjects = [{ id: 'proj1', title: 'Test' }];
      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.project.count.mockResolvedValue(1);

      const result = await service.findAll('user1', 1, 10);

      expect(result.data).toEqual(mockProjects);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a project if owner', async () => {
      const mockProject = { id: 'proj1', ownerId: 'user1', isPublic: false };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.findOne('proj1', 'user1');
      expect(result).toEqual(mockProject);
    });

    it('should throw ForbiddenException if not owner or collaborator', async () => {
      const mockProject = {
        id: 'proj1',
        ownerId: 'otherUser',
        isPublic: false,
      };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.projectCollaborator.findUnique.mockResolvedValue(null);

      await expect(service.findOne('proj1', 'user1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne('proj1', 'user1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generate', () => {
    it('should queue a generation job', async () => {
      const generateDto = {
        topic: 'AI',
        tone: GenerationTone.PROFESSIONAL,
        audience: 'Tech',
      };
      const userId = 'user1';
      const mockJob = { id: 'job1' };

      mockUsersService.canGenerateAI.mockResolvedValue(true);
      mockUsersService.canCreateProject.mockResolvedValue(true);
      mockQueue.add.mockResolvedValue(mockJob);

      const result = await service.generate(userId, generateDto);

      expect(result.jobId).toBe('job1');
      expect(result.status).toBe('queued');
      expect(mockQueue.add).toHaveBeenCalledWith('generate', {
        userId,
        dto: generateDto,
      });
    });
  });

  describe('processGeneration', () => {
    it('should generate content and create project', async () => {
      const generateDto = {
        topic: 'AI',
        tone: GenerationTone.CREATIVE,
        audience: 'Kids',
        length: 5,
      };
      const userId = 'user1';
      const mockGeneratedContent = {
        title: 'AI Presentation',
        sections: [
          {
            heading: 'Intro',
            blocks: [{ type: 'paragraph', content: 'Hello' }],
          },
        ],
      };
      const mockProject = { id: 'proj1', title: 'AI Presentation' };

      mockAIService.generatePresentation.mockResolvedValue(
        mockGeneratedContent,
      );
      mockPrismaService.theme.findFirst.mockResolvedValue({ id: 'theme1' });
      mockPrismaService.project.create.mockResolvedValue(mockProject);
      mockPrismaService.slide.create.mockResolvedValue({ id: 'slide1' });
      mockPrismaService.block.create.mockResolvedValue({ id: 'block1' });
      // findOne is called at end of processGeneration
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.processGeneration(userId, generateDto);

      expect(result).toEqual(mockProject);
      expect(mockAIService.generatePresentation).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'AI' }),
      );
      expect(mockUsersService.incrementAIGenerations).toHaveBeenCalledWith(
        userId,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete project', async () => {
      const mockProject = { id: 'proj1', ownerId: 'user1' };
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.project.update.mockResolvedValue(mockProject);

      await service.remove('proj1', 'user1');

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: 'proj1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
