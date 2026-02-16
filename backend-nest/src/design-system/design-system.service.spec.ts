import { Test, TestingModule } from '@nestjs/testing';
import { DesignSystemService } from './design-system.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DesignSystemService', () => {
  let service: DesignSystemService;

  const mockDesignSystem = {
    id: 'design-system-1',
    name: 'Modern Minimal',
    organizationId: null,
    userId: 'user-1',
    isDefault: true,
    colors: [
      { name: 'primary', value: '#18181b', type: 'primary' },
      { name: 'secondary', value: '#71717a', type: 'secondary' },
      { name: 'accent', value: '#3b82f6', type: 'accent' },
    ],
    typography: [
      {
        name: 'heading',
        fontFamily: 'Inter',
        fontSize: '32px',
        fontWeight: 700,
        lineHeight: '1.2',
        role: 'heading',
      },
      {
        name: 'body',
        fontFamily: 'Inter',
        fontSize: '16px',
        fontWeight: 400,
        lineHeight: '1.5',
        role: 'body',
      },
    ],
    spacing: [
      { name: 'sm', value: '8px', scale: 2 },
      { name: 'md', value: '16px', scale: 4 },
      { name: 'lg', value: '24px', scale: 6 },
    ],
    shadows: [
      { name: 'sm', value: '0 1px 2px rgba(0,0,0,0.1)', type: 'sm' },
    ],
    borders: [
      { name: 'default', width: '1px', style: 'solid', radius: '8px' },
    ],
    cssVariables: {
      '--color-primary': '#18181b',
      '--font-heading': 'Inter',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    designSystem: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DesignSystemService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DesignSystemService>(DesignSystemService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPresets', () => {
    it('should return built-in design system presets', async () => {
      const presets = await service.getPresets();

      expect(presets).toBeInstanceOf(Array);
      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('system');
    });
  });

  describe('create', () => {
    it('should create a design system', async () => {
      mockPrismaService.designSystem.create.mockResolvedValue(mockDesignSystem);

      const result = await service.create(
        'user-1',
        {
          name: 'Modern Minimal',
          colors: mockDesignSystem.colors,
          typography: mockDesignSystem.typography,
        },
      );

      expect(result).toBeDefined();
      expect(mockPrismaService.designSystem.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all design systems for a user', async () => {
      mockPrismaService.designSystem.findMany.mockResolvedValue([mockDesignSystem]);

      const result = await service.findAll('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Modern Minimal');
    });
  });

  describe('findOne', () => {
    it('should return a design system by id', async () => {
      mockPrismaService.designSystem.findFirst.mockResolvedValue(mockDesignSystem);

      const result = await service.findOne('design-system-1', 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('design-system-1');
    });
  });

  describe('update', () => {
    it('should update a design system', async () => {
      mockPrismaService.designSystem.findFirst.mockResolvedValue(mockDesignSystem);
      mockPrismaService.designSystem.update.mockResolvedValue({
        ...mockDesignSystem,
        name: 'Updated System',
      });

      const result = await service.update('design-system-1', 'user-1', {
        name: 'Updated System',
      });

      expect(result.name).toBe('Updated System');
    });
  });

  describe('delete', () => {
    it('should delete a design system', async () => {
      mockPrismaService.designSystem.findFirst.mockResolvedValue(mockDesignSystem);
      mockPrismaService.designSystem.delete.mockResolvedValue(mockDesignSystem);

      await service.delete('design-system-1', 'user-1');

      expect(mockPrismaService.designSystem.delete).toHaveBeenCalledWith({
        where: { id: 'design-system-1' },
      });
    });
  });

  describe('generateFromPreset', () => {
    it('should create design system from preset', async () => {
      mockPrismaService.designSystem.create.mockResolvedValue(mockDesignSystem);

      const result = await service.generateFromPreset('user-1', 'modern-minimal');

      expect(result).toBeDefined();
      expect(mockPrismaService.designSystem.create).toHaveBeenCalled();
    });
  });

  describe('generateCssVariables', () => {
    it('should generate CSS variables from design system', () => {
      const css = (service as any).generateCssVariables({
        colors: [
          { name: 'primary', value: '#18181b', type: 'primary' },
        ],
        typography: [
          { name: 'body', fontFamily: 'Inter', fontSize: '16px', role: 'body' },
        ],
        spacing: [
          { name: 'md', value: '16px', scale: 4 },
        ],
      });

      expect(css).toHaveProperty('--color-primary', '#18181b');
      expect(css).toHaveProperty('--font-body', 'Inter');
      expect(css).toHaveProperty('--spacing-md', '16px');
    });
  });

  describe('color utilities', () => {
    it('should generate color palette from primary color', async () => {
      const palette = await service.generateColorPalette('#3b82f6');

      expect(palette).toBeInstanceOf(Array);
      expect(palette.length).toBeGreaterThan(0);
      // Should have various shades
      expect(palette.some(c => c.shade === 500)).toBe(true);
    });

    it('should calculate complementary color', () => {
      const complementary = (service as any).getComplementaryColor('#3b82f6');

      expect(complementary).toBeDefined();
      expect(complementary).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
