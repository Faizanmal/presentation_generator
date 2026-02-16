import { Test, TestingModule } from '@nestjs/testing';
import { SlidesService } from './slides.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import { ForbiddenException } from '@nestjs/common';

describe('SlidesService (permissions)', () => {
  let service: SlidesService;

  const mockPrisma: any = {
    project: { findUnique: jest.fn() },
    slide: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), updateMany: jest.fn() },
  };
  const mockCollab: any = { getUserRole: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlidesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CollaborationService, useValue: mockCollab },
      ],
    }).compile();

    service = module.get<SlidesService>(SlidesService);
    jest.clearAllMocks();
  });

  it('allows an EDITOR to create a slide', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', ownerId: 'owner' });
    mockCollab.getUserRole.mockResolvedValue('EDITOR');
    mockPrisma.slide.create.mockResolvedValue({ id: 'slide-1', blocks: [] });
    mockPrisma.slide.updateMany.mockResolvedValue({});

    const slide = await service.create('editor-1', { projectId: 'proj-1', order: 1 });
    expect(slide).toHaveProperty('blocks');
  });

  it('forbids non-EDITOR from creating a slide', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'proj-1', ownerId: 'owner' });
    mockCollab.getUserRole.mockResolvedValue('VIEWER');

    await expect(service.create('viewer-1', { projectId: 'proj-1', order: 1 })).rejects.toThrow(ForbiddenException);
  });
});
