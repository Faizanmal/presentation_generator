import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface HolographicConfig {
  displayType: 'looking_glass' | 'pepper_ghost' | 'webgl_3d';
  depth: number;
  viewAngle: number;
  quiltColumns?: number;
  quiltRows?: number;
  views?: number;
}

interface LookingGlassQuilt {
  columns: number;
  rows: number;
  views: number;
  viewCone: number;
  aspect: number;
}

@Injectable()
export class HolographicService {
  private readonly logger = new Logger(HolographicService.name);

  // Looking Glass display presets
  private readonly lookingGlassPresets = {
    portrait: { columns: 5, rows: 9, views: 45, viewCone: 40, aspect: 0.75 },
    '15.6': { columns: 8, rows: 6, views: 48, viewCone: 50, aspect: 1.77 },
    '32': { columns: 8, rows: 6, views: 48, viewCone: 50, aspect: 1.77 },
    '65': { columns: 8, rows: 6, views: 48, viewCone: 50, aspect: 1.77 },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create holographic preview for a presentation
   */
  async createHolographicPreview(
    userId: string,
    projectId: string,
    config: Partial<HolographicConfig>,
  ) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { orderBy: { order: 'asc' } } },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    const holoConfig: HolographicConfig = {
      displayType: config.displayType || 'looking_glass',
      depth: config.depth ?? 1.0,
      viewAngle: config.viewAngle ?? 45,
      quiltColumns: config.quiltColumns,
      quiltRows: config.quiltRows,
      views: config.views,
    };

    // Create preview record
    const preview = await this.prisma.holographicPreview.create({
      data: {
        userId,
        projectId,
        displayType: holoConfig.displayType,
        status: 'pending',
        config: holoConfig as object,
        depth: holoConfig.depth,
        viewAngle: holoConfig.viewAngle,
      },
    });

    // Start processing (in production, this would be a background job)
    await this.processHolographicPreview(preview.id, project.slides);

    return this.getPreview(preview.id, userId);
  }

  /**
   * Process holographic preview generation
   */
  private async processHolographicPreview(
    previewId: string,
    slides: Array<{ id: string; content: unknown; order: number }>,
  ) {
    try {
      await this.prisma.holographicPreview.update({
        where: { id: previewId },
        data: { status: 'rendering' },
      });

      const preview = await this.prisma.holographicPreview.findUnique({
        where: { id: previewId },
      });

      if (!preview) return;

      const config = preview.config as unknown as HolographicConfig;

      // Generate quilts based on display type
      let quilts: LookingGlassQuilt[] | object[] = [];

      if (config.displayType === 'looking_glass') {
        quilts = this.generateLookingGlassQuilts(slides, config);
      } else if (config.displayType === 'pepper_ghost') {
        quilts = this.generatePepperGhostViews(slides, config);
      } else {
        quilts = this.generateWebGL3DViews(slides, config);
      }

      // Generate output URLs
      const outputUrl = `/api/holographic/previews/${previewId}/view`;
      const previewUrl = `/api/holographic/previews/${previewId}/thumbnail`;

      await this.prisma.holographicPreview.update({
        where: { id: previewId },
        data: {
          status: 'completed',
          quilts: quilts as object,
          outputUrl,
          previewUrl,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Holographic preview failed: ${previewId}`, error);
      await this.prisma.holographicPreview.update({
        where: { id: previewId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Processing failed',
        },
      });
    }
  }

  /**
   * Generate Looking Glass quilt images
   */
  private generateLookingGlassQuilts(
    slides: Array<{ id: string; content: unknown; order: number }>,
    config: HolographicConfig,
  ): LookingGlassQuilt[] {
    const preset = this.lookingGlassPresets.portrait;
    const quilts: LookingGlassQuilt[] = [];

    for (const _slide of slides) {
      // In production, you would:
      // 1. Render slide from multiple angles
      // 2. Compose views into quilt image
      // 3. Upload to storage

      const quilt: LookingGlassQuilt = {
        columns: config.quiltColumns || preset.columns,
        rows: config.quiltRows || preset.rows,
        views: config.views || preset.views,
        viewCone: config.viewAngle || preset.viewCone,
        aspect: preset.aspect,
      };

      quilts.push(quilt);
    }

    return quilts;
  }

  /**
   * Generate Pepper's Ghost projection views
   */
  private generatePepperGhostViews(
    slides: Array<{ id: string; content: unknown; order: number }>,
    config: HolographicConfig,
  ): object[] {
    const views: object[] = [];

    for (const slide of slides) {
      // Pepper's Ghost requires 4 views (top, bottom, left, right)
      // or a single view with blackout borders
      views.push({
        slideId: slide.id,
        order: slide.order,
        projectionType: '4-sided',
        views: ['top', 'bottom', 'left', 'right'].map((side) => ({
          side,
          rotation: this.getRotationForSide(side),
          url: `/api/holographic/render/${slide.id}/${side}`,
        })),
        depth: config.depth,
      });
    }

    return views;
  }

  /**
   * Generate WebGL 3D views
   */
  private generateWebGL3DViews(
    slides: Array<{ id: string; content: unknown; order: number }>,
    config: HolographicConfig,
  ): object[] {
    return slides.map((slide) => ({
      slideId: slide.id,
      order: slide.order,
      threejsScene: this.generateThreeJSScene(slide.content, config),
      depth: config.depth,
      viewAngle: config.viewAngle,
    }));
  }

  /**
   * Get rotation angle for Pepper's Ghost side
   */
  private getRotationForSide(side: string): number {
    const rotations: Record<string, number> = {
      top: 0,
      bottom: 180,
      left: 270,
      right: 90,
    };
    return rotations[side] || 0;
  }

  /**
   * Generate Three.js scene configuration
   */
  private generateThreeJSScene(
    slideContent: unknown,
    config: HolographicConfig,
  ): object {
    const content = (slideContent as Record<string, unknown>) || {};

    return {
      camera: {
        type: 'PerspectiveCamera',
        fov: config.viewAngle,
        position: { x: 0, y: 0, z: 5 },
      },
      lights: [
        { type: 'AmbientLight', color: '#ffffff', intensity: 0.5 },
        {
          type: 'DirectionalLight',
          color: '#ffffff',
          intensity: 0.8,
          position: { x: 5, y: 5, z: 5 },
        },
      ],
      objects: [
        {
          type: 'Plane',
          geometry: { width: 16, height: 9 },
          material: { type: 'MeshStandardMaterial', color: '#1a1a2e' },
          position: { x: 0, y: 0, z: -config.depth },
          content: content,
        },
      ],
      controls: {
        type: 'OrbitControls',
        enableZoom: true,
        enablePan: false,
        maxPolarAngle: Math.PI / 2,
      },
    };
  }

  /**
   * Generate WebGL viewer HTML
   */
  async generateViewerHTML(previewId: string, userId: string): Promise<string> {
    const preview = await this.getPreview(previewId, userId);
    const config = preview.config as unknown as HolographicConfig;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Holographic Preview</title>
  <style>
    body { margin: 0; overflow: hidden; background: #000; }
    #container { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="container"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
  <script>
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(${config.viewAngle}, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);
    
    // Slide plane with depth
    const geometry = new THREE.PlaneGeometry(16, 9);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x1a1a2e,
      metalness: 0.1,
      roughness: 0.8
    });
    const plane = new THREE.Mesh(geometry, material);
    plane.position.z = -${config.depth};
    scene.add(plane);
    
    // Add depth layers
    for (let i = 1; i <= 3; i++) {
      const layerGeometry = new THREE.PlaneGeometry(14 - i * 2, 7 - i);
      const layerMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d2d44,
        transparent: true,
        opacity: 0.8 - i * 0.2
      });
      const layer = new THREE.Mesh(layerGeometry, layerMaterial);
      layer.position.z = -${config.depth} + i * 0.5;
      scene.add(layer);
    }
    
    camera.position.z = 10;
    
    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 2;
    
    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    
    animate();
    
    // Resize handler
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get preview by ID
   */
  async getPreview(id: string, userId: string) {
    const preview = await this.prisma.holographicPreview.findUnique({
      where: { id },
    });

    if (!preview || preview.userId !== userId) {
      throw new BadRequestException('Preview not found');
    }

    return preview;
  }

  /**
   * Get user's holographic previews
   */
  async getUserPreviews(userId: string, projectId?: string) {
    return this.prisma.holographicPreview.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete preview
   */
  async deletePreview(id: string, userId: string) {
    const preview = await this.getPreview(id, userId);
    return this.prisma.holographicPreview.delete({ where: { id: preview.id } });
  }
}
