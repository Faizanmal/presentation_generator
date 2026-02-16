import { Test, TestingModule } from '@nestjs/testing';
import { BrandKitService, BrandKitDto } from './brand-kit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('BrandKitService', () => {
  let service: BrandKitService;
  let prisma: jest.Mocked<PrismaService>;

  const mockBrandKit = {
    id: 'brand-kit-1',
    organizationId: null,
    userId: 'user-1',
    name: 'My Brand',
    isDefault: true,
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    accentColor: '#f59e0b',
    backgroundColor: '#ffffff',
    textColor: '#1e293b',
    colorPalette: ['#3b82f6', '#64748b', '#f59e0b'],
    headingFont: 'Inter',
    bodyFont: 'Inter',
    fontSizes: { base: '16px', lg: '18px' },
    logoUrl: 'https://example.com/logo.png',
    logoLight: null,
    logoDark: null,
    favicon: null,
    coverImages: [],
    icons: null,
    patterns: null,
    watermark: null,
    watermarkOpacity: 0.3,
    voiceDescription: 'Professional and friendly',
    toneKeywords: ['professional', 'approachable'],
    doList: ['Use active voice'],
    dontList: ['Use jargon'],
    styleGuideUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    brandKit: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    organizationMember: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandKitService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<BrandKitService>(BrandKitService);
    prisma = module.get(PrismaService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a brand kit', async () => {
      const dto: BrandKitDto = {
        name: 'My Brand',
        primaryColor: '#3b82f6',
        headingFont: 'Inter',
      };

      mockPrismaService.brandKit.create.mockResolvedValue(mockBrandKit);

      const result = await service.create(dto, 'user-1');

      expect(result).toEqual(mockBrandKit);
      expect(mockPrismaService.brandKit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'My Brand',
          primaryColor: '#3b82f6',
          userId: 'user-1',
        }),
      });
    });

    it('should unset other defaults when creating a default brand kit', async () => {
      const dto: BrandKitDto = {
        name: 'My Brand',
        isDefault: true,
      };

      mockPrismaService.brandKit.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaService.brandKit.create.mockResolvedValue(mockBrandKit);

      await service.create(dto, 'user-1');

      expect(mockPrismaService.brandKit.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: 'user-1' },
            { organizationId: undefined },
          ],
          isDefault: true,
        },
        data: { isDefault: false },
      });
    });
  });

  describe('findAll', () => {
    it('should return all brand kits for a user', async () => {
      mockPrismaService.brandKit.findMany.mockResolvedValue([mockBrandKit]);

      const result = await service.findAll('user-1');

      expect(result).toEqual([mockBrandKit]);
      expect(mockPrismaService.brandKit.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: 'user-1' },
            { organizationId: undefined },
          ],
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
      });
    });
  });

  describe('findOne', () => {
    it('should return a brand kit if user owns it', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(mockBrandKit);

      const result = await service.findOne('brand-kit-1', 'user-1');

      expect(result).toEqual(mockBrandKit);
    });

    it('should throw NotFoundException if brand kit does not exist', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own the brand kit', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue({
        ...mockBrandKit,
        userId: 'other-user',
        organizationId: null,
      });

      await expect(service.findOne('brand-kit-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow access if user is org member', async () => {
      const orgBrandKit = {
        ...mockBrandKit,
        userId: null,
        organizationId: 'org-1',
      };
      
      mockPrismaService.brandKit.findUnique.mockResolvedValue(orgBrandKit);
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        id: 'member-1',
        organizationId: 'org-1',
        userId: 'user-1',
      });

      const result = await service.findOne('brand-kit-1', 'user-1');

      expect(result).toEqual(orgBrandKit);
    });
  });

  describe('getDefault', () => {
    it('should return the default brand kit', async () => {
      mockPrismaService.brandKit.findFirst.mockResolvedValue(mockBrandKit);

      const result = await service.getDefault('user-1');

      expect(result).toEqual(mockBrandKit);
    });
  });

  describe('update', () => {
    it('should update a brand kit', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(mockBrandKit);
      mockPrismaService.brandKit.update.mockResolvedValue({
        ...mockBrandKit,
        name: 'Updated Brand',
      });

      const result = await service.update(
        'brand-kit-1',
        { name: 'Updated Brand' },
        'user-1',
      );

      expect(result.name).toBe('Updated Brand');
    });
  });

  describe('delete', () => {
    it('should delete a brand kit', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(mockBrandKit);
      mockPrismaService.brandKit.delete.mockResolvedValue(mockBrandKit);

      const result = await service.delete('brand-kit-1', 'user-1');

      expect(result).toEqual(mockBrandKit);
    });
  });

  describe('duplicate', () => {
    it('should duplicate a brand kit', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(mockBrandKit);
      mockPrismaService.brandKit.create.mockResolvedValue({
        ...mockBrandKit,
        id: 'brand-kit-2',
        name: 'My Brand (Copy)',
        isDefault: false,
      });

      const result = await service.duplicate('brand-kit-1', 'user-1');

      expect(result.name).toBe('My Brand (Copy)');
      expect(result.isDefault).toBe(false);
    });
  });

  describe('toTheme', () => {
    it('should convert brand kit to theme object', async () => {
      mockPrismaService.brandKit.findUnique.mockResolvedValue(mockBrandKit);

      const result = await service.toTheme('brand-kit-1', 'user-1');

      expect(result).toEqual({
        primaryColor: '#3b82f6',
        secondaryColor: '#64748b',
        accentColor: '#f59e0b',
        backgroundColor: '#ffffff',
        textColor: '#1e293b',
        headingFont: 'Inter',
        bodyFont: 'Inter',
        logoUrl: 'https://example.com/logo.png',
      });
    });
  });
});
