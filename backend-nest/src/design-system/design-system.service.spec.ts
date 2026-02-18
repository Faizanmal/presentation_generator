import { Test, TestingModule } from '@nestjs/testing';
import {
  DesignSystemService,
  ColorToken,
  TypographyToken,
  SpacingToken,
  ShadowToken,
  BorderToken,
} from './design-system.service';
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
    ] as ColorToken[],
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
    shadows: [{ name: 'sm', value: '0 1px 2px rgba(0,0,0,0.1)', type: 'sm' }],
    borders: [{ name: 'default', width: '1px', style: 'solid', radius: '8px' }],
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
    it('should return built-in design system presets', () => {
      const presets = service.getPresets();

      expect(presets).toBeInstanceOf(Array);
      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('system');
    });
  });

  describe('createDesignSystem', () => {
    it('should create a design system', async () => {
      mockPrismaService.designSystem.create.mockResolvedValue(mockDesignSystem);

      const result = await service.createDesignSystem('user-1', {
        name: 'Modern Minimal',
        presetId: 'modern-minimal',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.designSystem.create).toHaveBeenCalled();
    });
  });

  describe('getUserDesignSystems', () => {
    it('should return all design systems for a user', async () => {
      mockPrismaService.designSystem.findMany.mockResolvedValue([
        mockDesignSystem,
      ]);

      const result = await service.getUserDesignSystems('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Modern Minimal');
    });
  });

  describe('getDesignSystem', () => {
    it('should return a design system by id', async () => {
      mockPrismaService.designSystem.findUnique.mockResolvedValue(
        mockDesignSystem,
      );

      const result = await service.getDesignSystem('design-system-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('design-system-1');
    });
  });

  describe('updateTokens', () => {
    it('should update a design system tokens', async () => {
      mockPrismaService.designSystem.findFirst.mockResolvedValue(
        mockDesignSystem,
      );
      mockPrismaService.designSystem.update.mockResolvedValue({
        ...mockDesignSystem,
        name: 'Updated System',
      });

      const result = await service.updateTokens('design-system-1', 'user-1', {
        colors: mockDesignSystem.colors,
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Modern Minimal');
    });
  });

  describe('updateColor', () => {
    it('should update a color token', async () => {
      mockPrismaService.designSystem.findFirst.mockResolvedValue(
        mockDesignSystem,
      );
      mockPrismaService.designSystem.update.mockResolvedValue({
        ...mockDesignSystem,
        colors: mockDesignSystem.colors.map((c) =>
          c.name === 'primary' ? { ...c, value: '#000000' } : c,
        ),
      });

      const result = await service.updateColor(
        'design-system-1',
        'user-1',
        'primary',
        '#000000',
      );

      expect(result).toBeDefined();
    });
  });

  describe('createDesignSystem with preset', () => {
    it('should create design system from preset', async () => {
      mockPrismaService.designSystem.create.mockResolvedValue(mockDesignSystem);

      const result = await service.createDesignSystem('user-1', {
        name: 'Modern Minimal',
        presetId: 'modern-minimal',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.designSystem.create).toHaveBeenCalled();
    });
  });

  describe('generateCSSVariables', () => {
    it('should generate CSS variables from design system', () => {
      const css = (
        service as unknown as {
          generateCSSVariables: (tokens: {
            colors: ColorToken[];
            typography: TypographyToken[];
            spacing: SpacingToken[];
            shadows: ShadowToken[];
            borders: BorderToken[];
          }) => Record<string, string>;
        }
      ).generateCSSVariables({
        colors: [{ name: 'primary', value: '#18181b', type: 'primary' }],
        typography: [
          {
            name: 'body',
            fontFamily: 'Inter',
            fontSize: '16px',
            role: 'body',
            fontWeight: 400,
            lineHeight: '1.5',
          },
        ],
        spacing: [{ name: 'md', value: '16px', scale: 4 }],
        shadows: [],
        borders: [],
      });

      expect(css).toHaveProperty('--color-primary', '#18181b');
      expect(css).toHaveProperty('--font-body-family', 'Inter');
      expect(css).toHaveProperty('--space-md', '16px');
    });
  });

  describe('color utilities', () => {
    it('should generate color palette from primary color', () => {
      const palette = service.generateColorPalette('#3b82f6', 'primary');

      expect(palette).toBeInstanceOf(Array);
      expect(palette.length).toBeGreaterThan(0);
      // Should have various shades
      expect(palette.some((c) => c.shade === 500)).toBe(true);
    });

    it('should calculate adjusted color shade', () => {
      const adjusted = (
        service as unknown as {
          adjustColorShade: (hexColor: string, shade: number) => string;
        }
      ).adjustColorShade('#3b82f6', 500);

      expect(adjusted).toBeDefined();
      expect(adjusted).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
