import { Test, TestingModule } from '@nestjs/testing';
import { BlocksService } from './blocks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdvancedCacheService } from '../common/cache/advanced-cache.service';
import { CollaborationService } from '../collaboration/collaboration.service';
import { ForbiddenException } from '@nestjs/common';
import { BlockType } from '@prisma/client';

describe('BlocksService (permissions)', () => {
  let service: BlocksService;

  const mockPrisma = {
    project: { update: jest.fn(), findUnique: jest.fn() },
    block: { create: jest.fn(), update: jest.fn() },
  };

  const mockCache = {};
  const mockCollab = { getUserRole: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlocksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AdvancedCacheService, useValue: mockCache },
        { provide: CollaborationService, useValue: mockCollab },
      ],
    }).compile();

    service = module.get<BlocksService>(BlocksService);
    jest.clearAllMocks();
  });

  it('allows an EDITOR to create a block', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      ownerId: 'owner',
    });
    mockCollab.getUserRole.mockResolvedValue('EDITOR');
    mockPrisma.block.create.mockResolvedValue({ id: 'block-1' });
    mockPrisma.project.update.mockResolvedValue({});

    const result = await service.create('editor-1', {
      projectId: 'proj-1',
      blockType: 'PARAGRAPH' as BlockType,
      content: { text: 'hi' },
      order: 1,
    });

    expect(result).toHaveProperty('id');
    expect(mockPrisma.block.create).toHaveBeenCalled();
  });

  it('forbids non-EDITOR from creating a block', async () => {
    mockPrisma.project.findUnique.mockResolvedValue({
      id: 'proj-1',
      ownerId: 'owner',
    });
    mockCollab.getUserRole.mockResolvedValue('VIEWER');

    await expect(
      service.create('viewer-1', {
        projectId: 'proj-1',
        blockType: 'PARAGRAPH' as BlockType,
        content: { text: 'nope' },
        order: 1,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
