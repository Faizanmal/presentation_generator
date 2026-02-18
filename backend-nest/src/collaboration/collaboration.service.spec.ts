import { Test, TestingModule } from '@nestjs/testing';
import { CollaborationService } from './collaboration.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollaborationService', () => {
  let service: CollaborationService;
  // let prismaService: PrismaService;

  /* const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    userId: 'user-1',
    collaborators: [
      {
        id: 'collab-1',
        userId: 'user-2',
        role: 'EDITOR',
        user: { id: 'user-2', name: 'Collaborator', email: 'collab@test.com' },
      },
    ],
  }; */

  const mockComment = {
    id: 'comment-1',
    content: 'Great work!',
    userId: 'user-2',
    projectId: 'project-1',
    slideId: 'slide-1',
    resolved: false,
    pinned: false,
    user: { id: 'user-2', name: 'Commenter' },
  };

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    projectCollaborator: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    projectVersion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);
    // prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getCollaborators', () => {
    it('should return list of collaborators', async () => {
      mockPrismaService.projectCollaborator.findMany.mockResolvedValue([
        {
          id: 'collab-1',
          userId: 'user-2',
          role: 'EDITOR',
          user: { id: 'user-2', name: 'User 2', email: 'user2@test.com' },
        },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-2', name: 'User 2', email: 'user2@test.com', image: null },
      ]);

      const result = await service.getCollaborators('project-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('role');
    });

    it('should return empty array for project without collaborators', async () => {
      mockPrismaService.projectCollaborator.findMany.mockResolvedValue([]);
      mockPrismaService.user.findMany.mockResolvedValue([]);

      const result = await service.getCollaborators('project-1');

      expect(result).toEqual([]);
    });
  });

  describe('addCollaborator', () => {
    it('should add a new collaborator', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        ownerId: 'user-1',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'new@test.com',
      });
      mockPrismaService.projectCollaborator.findFirst.mockResolvedValue(null);
      mockPrismaService.projectCollaborator.create.mockResolvedValue({
        id: 'collab-2',
        userId: 'user-3',
        projectId: 'project-1',
        role: 'VIEWER',
      });

      const result = await service.addCollaborator(
        'project-1',
        'new@test.com',
        'VIEWER',
        'user-1',
      );

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.projectCollaborator.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if inviter is not owner', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        ownerId: 'other-user',
      });
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-4',
        email: 'u4@test.com',
      });

      await expect(
        service.addCollaborator('project-1', 'u4@test.com', 'VIEWER', 'user-1'),
      ).rejects.toThrow();
    });

    it('should throw error if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addCollaborator(
          'project-1',
          'notfound@test.com',
          'VIEWER',
          'user-1',
        ),
      ).rejects.toThrow();
    });

    it('should throw error if already a collaborator', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrismaService.projectCollaborator.findFirst.mockResolvedValue({
        id: 'existing',
      });

      await expect(
        service.addCollaborator(
          'project-1',
          'existing@test.com',
          'VIEWER',
          'user-1',
        ),
      ).rejects.toThrow();
    });
  });

  describe('updateCollaboratorRole', () => {
    it('should update collaborator role', async () => {
      mockPrismaService.projectCollaborator.update.mockResolvedValue({
        id: 'collab-1',
        role: 'EDITOR',
      });

      const result = await service.updateCollaboratorRole('collab-1', 'EDITOR');

      expect(result.role).toBe('EDITOR');
    });

    it('should throw if performedBy is not project owner', async () => {
      mockPrismaService.projectCollaborator.findUnique.mockResolvedValue({
        id: 'collab-1',
        projectId: 'project-1',
      });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-1',
        ownerId: 'owner-id',
      });

      await expect(
        service.updateCollaboratorRole('collab-1', 'EDITOR'),
      ).rejects.toThrow();
    });
  });

  describe('removeCollaborator', () => {
    it('should remove a collaborator', async () => {
      mockPrismaService.projectCollaborator.delete.mockResolvedValue({});

      await expect(
        service.removeCollaborator('project-1', 'collab-1'),
      ).resolves.not.toThrow();
    });
  });

  describe('getComments', () => {
    it('should return comments for a project', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([mockComment]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-2', name: 'Commenter', image: null },
      ]);

      const result = await service.getComments('project-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('content');
    });

    it('should filter comments by slideId', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([mockComment]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-2', name: 'Commenter', image: null },
      ]);

      await service.getComments('project-1', 'slide-1');

      expect(mockPrismaService.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            slideId: 'slide-1',
          }) as unknown,
        }),
      );
    });
  });

  describe('createComment', () => {
    it('should create a new comment', async () => {
      mockPrismaService.comment.create.mockResolvedValue({
        id: 'comment-new',
        content: 'New comment',
        userId: 'user-1',
        projectId: 'project-1',
      });

      const result = await service.createComment({
        userId: 'user-1',
        projectId: 'project-1',
        content: 'New comment',
      });

      expect(result).toHaveProperty('id');
      expect(result.content).toBe('New comment');
    });

    it('should create a reply to existing comment', async () => {
      mockPrismaService.comment.create.mockResolvedValue({
        id: 'reply-1',
        content: 'Reply',
        parentId: 'comment-1',
      });

      const result = await service.createComment({
        userId: 'user-1',
        projectId: 'project-1',
        content: 'Reply',
        parentId: 'comment-1',
      });

      expect(result.parentId).toBe('comment-1');
    });
  });

  describe('resolveComment', () => {
    it('should mark comment as resolved', async () => {
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        resolved: true,
      });

      const result = await service.resolveComment('comment-1');

      expect(result.resolved).toBe(true);
    });
  });

  describe('pinComment', () => {
    it('should pin a comment', async () => {
      mockPrismaService.comment.update.mockResolvedValue({
        ...mockComment,
        pinned: true,
      });

      const result = await service.pinComment('comment-1', true);

      expect(result.pinned).toBe(true);
    });
  });

  describe('createVersion', () => {
    it('should create a new project version', async () => {
      mockPrismaService.projectVersion.findFirst.mockResolvedValue({
        version: 1,
      });
      mockPrismaService.projectVersion.create.mockResolvedValue({
        id: 'version-2',
        version: 2,
        projectId: 'project-1',
        snapshot: {},
      });

      const result = await service.createVersion({
        projectId: 'project-1',
        createdBy: 'user-1',
        snapshot: {
          slides: [],
        },
      });

      expect(result).toHaveProperty('version');
      expect(result.version).toBe(2);
    });

    it('should start at version 1 for new project', async () => {
      mockPrismaService.projectVersion.findFirst.mockResolvedValue(null);
      mockPrismaService.projectVersion.create.mockResolvedValue({
        id: 'version-1',
        version: 1,
        projectId: 'project-1',
      });

      const result = await service.createVersion({
        projectId: 'project-1',
        createdBy: 'user-1',
        snapshot: {},
      });

      expect(result.version).toBe(1);
    });
  });

  describe('getVersions', () => {
    it('should return project versions', async () => {
      mockPrismaService.projectVersion.findMany.mockResolvedValue([
        { id: 'v1', version: 1, createdBy: 'user-1' },
        { id: 'v2', version: 2, createdBy: 'user-1' },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'User 1', image: null },
      ]);

      const result = await service.getVersions('project-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe('restoreVersion', () => {
    it('should restore project to specific version', async () => {
      mockPrismaService.projectVersion.findUnique.mockResolvedValue({
        id: 'v1',
        version: 1,
        snapshot: { title: 'Old Title', slides: [] },
      });
      mockPrismaService.project.update.mockResolvedValue({
        id: 'project-1',
        title: 'Old Title',
      });

      await service.restoreVersion('project-1', 1);

      expect(mockPrismaService.project.update).toHaveBeenCalled();
    });

    it('should throw error for non-existent version', async () => {
      mockPrismaService.projectVersion.findUnique.mockResolvedValue(null);

      await expect(service.restoreVersion('project-1', 999)).rejects.toThrow();
    });
  });
});
