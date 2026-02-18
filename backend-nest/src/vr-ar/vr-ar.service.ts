import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface VRConfig {
  environment: string;
  quality: 'low' | 'medium' | 'high' | 'ultra';
  interactionMode: 'gaze' | 'controller' | 'hand';
  spatialAudio: boolean;
  autoProgress: boolean;
  transitionDuration: number;
}

interface VRSceneConfig {
  environment: string;
  background360?: string;
  objects3d?: Array<{
    type: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
    content?: string;
  }>;
  hotspots?: Array<{
    position: { x: number; y: number; z: number };
    action: string;
    label: string;
  }>;
  lighting: {
    ambient: number;
    directional: { intensity: number; color: string };
  };
}

interface AROverlayConfig {
  type: 'marker' | 'surface' | 'face' | 'image_tracking';
  markerUrl?: string;
  content3d: {
    model?: string;
    primitives?: Array<{
      type: 'box' | 'sphere' | 'cylinder' | 'plane';
      position: { x: number; y: number; z: number };
      dimensions: Record<string, number>;
      material: { color: string; opacity: number };
    }>;
    text?: {
      content: string;
      position: { x: number; y: number; z: number };
      fontSize: number;
      color: string;
    };
  };
  animations?: Array<{
    property: string;
    from: number;
    to: number;
    duration: number;
    loop: boolean;
  }>;
}

@Injectable()
export class VRARService {
  private readonly logger = new Logger(VRARService.name);

  // Default VR environments
  private readonly environments = {
    default: {
      skybox: 'gradient',
      colors: ['#1a1a2e', '#16213e', '#0f3460'],
      floor: { color: '#2d2d44', reflectivity: 0.3 },
    },
    office: {
      skybox: 'hdri_office',
      lighting: 'indoor',
      floor: { texture: 'wood', reflectivity: 0.5 },
    },
    nature: {
      skybox: 'hdri_forest',
      lighting: 'outdoor',
      floor: { texture: 'grass', reflectivity: 0.1 },
    },
    space: {
      skybox: 'stars',
      colors: ['#000000', '#0a0a20'],
      floor: { color: '#111122', reflectivity: 0.8 },
    },
    auditorium: {
      skybox: 'hdri_auditorium',
      lighting: 'stage',
      floor: { texture: 'carpet', reflectivity: 0.2 },
    },
    minimalist: {
      skybox: 'solid',
      colors: ['#ffffff'],
      floor: { color: '#f0f0f0', reflectivity: 0.6 },
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Create VR export for a presentation
   */
  async createVRExport(
    userId: string,
    projectId: string,
    config: Partial<VRConfig>,
  ) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { slides: { orderBy: { order: 'asc' } } },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    const vrConfig: VRConfig = {
      environment: config.environment || 'default',
      quality: config.quality || 'high',
      interactionMode: config.interactionMode || 'controller',
      spatialAudio: config.spatialAudio ?? true,
      autoProgress: config.autoProgress ?? false,
      transitionDuration: config.transitionDuration || 1000,
    };

    // Create VR export record
    const vrExport = await this.prisma.vRExport.create({
      data: {
        userId,
        projectId,
        format: 'webxr',
        status: 'pending',
        config: vrConfig as object,
        optimizedFor: ['browser_vr', 'oculus'],
      },
    });

    // Generate VR scenes for each slide
    await this.generateVRScenes(vrExport.id, project.slides, vrConfig);

    // Start export processing (in production, this would be a background job)
    await this.processVRExport(vrExport.id);

    return this.getVRExport(vrExport.id, userId);
  }

  /**
   * Generate VR scenes from slides
   */
  private async generateVRScenes(
    vrExportId: string,
    slides: Array<{
      id: string;
      title?: string | null;
      content: unknown;
      order: number;
    }>,
    config: VRConfig,
  ) {
    const environment =
      this.environments[config.environment as keyof typeof this.environments] ||
      this.environments.default;

    for (const slide of slides) {
      const content = (slide.content || {}) as Record<string, unknown>;
      const sceneConfig: VRSceneConfig = {
        environment: config.environment,
        objects3d: this.convertSlideToVR3D(content),
        hotspots: this.generateHotspots(content),
        lighting: {
          ambient: 0.4,
          directional: { intensity: 0.8, color: '#ffffff' },
        },
      };

      await this.prisma.vRScene.create({
        data: {
          vrExportId,
          slideId: slide.id,
          order: slide.order,
          environment: config.environment,
          objects3d: sceneConfig.objects3d as object,
          hotspots: sceneConfig.hotspots,
          transitions: {
            type: 'fade',
            duration: config.transitionDuration,
          },
          spatialAudio: config.spatialAudio
            ? {
                enabled: true,
                position: { x: 0, y: 1.6, z: -2 },
              }
            : (null as any),
        },
      });
    }
  }

  /**
   * Convert slide content to 3D objects
   */
  private convertSlideToVR3D(content: Record<string, unknown>) {
    const objects: VRSceneConfig['objects3d'] = [];

    // Main content panel
    objects.push({
      type: 'panel',
      position: { x: 0, y: 1.6, z: -3 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      content: JSON.stringify(content),
    });

    // Title
    const title = content.title as string | undefined;
    if (title) {
      objects.push({
        type: 'text3d',
        position: { x: 0, y: 2.5, z: -3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: 0.5,
        content: title,
      });
    }

    // Images as floating panels
    const images = content.images as Array<{ url: string }> | undefined;
    if (images && Array.isArray(images)) {
      images.forEach((img, index) => {
        objects.push({
          type: 'image_panel',
          position: { x: -2 + index * 1.5, y: 1.4, z: -2.5 },
          rotation: { x: 0, y: 15 - index * 10, z: 0 },
          scale: 0.8,
          content: img.url,
        });
      });
    }

    return objects;
  }

  /**
   * Generate interactive hotspots
   */
  private generateHotspots(content: Record<string, unknown>) {
    const hotspots: VRSceneConfig['hotspots'] = [];

    // Navigation hotspots
    hotspots.push(
      {
        position: { x: -2, y: 1, z: -2 },
        action: 'previous_slide',
        label: 'Previous',
      },
      {
        position: { x: 2, y: 1, z: -2 },
        action: 'next_slide',
        label: 'Next',
      },
    );

    // Content interaction hotspots
    const links = content.links as
      | Array<{ url: string; label: string }>
      | undefined;
    if (links && Array.isArray(links)) {
      links.forEach((link, index) => {
        hotspots.push({
          position: { x: 0, y: 0.8 - index * 0.3, z: -2 },
          action: `open_link:${link.url}`,
          label: link.label,
        });
      });
    }

    return hotspots;
  }

  /**
   * Process VR export (generate WebXR output)
   */
  private async processVRExport(vrExportId: string) {
    try {
      await this.prisma.vRExport.update({
        where: { id: vrExportId },
        data: { status: 'processing' },
      });

      const vrExport = await this.prisma.vRExport.findUnique({
        where: { id: vrExportId },
        include: { scenes: true },
      });

      if (!vrExport) return;

      // Generate A-Frame HTML template
      const aframeHtml = this.generateAFrameTemplate(vrExport);

      // In production, you would:
      // 1. Save this to S3/storage
      // 2. Generate optional compiled WebXR bundle
      // 3. Create preview thumbnails

      // For now, we'll store the template reference
      const outputUrl = `/api/vr-ar/exports/${vrExportId}/webxr`;
      const previewUrl = `/api/vr-ar/exports/${vrExportId}/preview`;

      await this.prisma.vRExport.update({
        where: { id: vrExportId },
        data: {
          status: 'completed',
          outputUrl,
          previewUrl,
          completedAt: new Date(),
          fileSize: aframeHtml.length,
        },
      });
    } catch (error) {
      this.logger.error(`VR export failed: ${vrExportId}`, error);
      await this.prisma.vRExport.update({
        where: { id: vrExportId },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Export failed',
        },
      });
    }
  }

  /**
   * Generate A-Frame template for WebXR
   */
  private generateAFrameTemplate(vrExport: {
    config: unknown;
    scenes: Array<{
      order: number;
      environment: string;
      objects3d: unknown;
      hotspots: unknown;
    }>;
  }): string {
    const config = vrExport.config as VRConfig;
    const scenes = vrExport.scenes.sort((a, b) => a.order - b.order);

    const sceneElements = scenes
      .map((scene, index) => {
        const objects = (scene.objects3d as VRSceneConfig['objects3d']) || [];
        const hotspots = (scene.hotspots as VRSceneConfig['hotspots']) || [];

        const objectsHtml = objects
          .map((obj) => {
            if (obj.type === 'text3d') {
              return `<a-text value="${obj.content}" position="${obj.position.x} ${obj.position.y} ${obj.position.z}" scale="${obj.scale} ${obj.scale} ${obj.scale}" color="#ffffff" align="center"></a-text>`;
            }
            if (obj.type === 'panel') {
              return `<a-plane position="${obj.position.x} ${obj.position.y} ${obj.position.z}" width="4" height="2.5" color="#1a1a2e" class="slide-panel" data-content='${obj.content}'></a-plane>`;
            }
            if (obj.type === 'image_panel') {
              return `<a-image src="${obj.content}" position="${obj.position.x} ${obj.position.y} ${obj.position.z}" width="1.5" height="1" rotation="0 ${obj.rotation.y} 0"></a-image>`;
            }
            return '';
          })
          .join('\n        ');

        const hotspotsHtml = hotspots
          .map(
            (h) =>
              `<a-sphere position="${h.position.x} ${h.position.y} ${h.position.z}" radius="0.1" color="#4CAF50" class="hotspot" data-action="${h.action}">
          <a-text value="${h.label}" position="0 0.2 0" align="center" scale="0.3 0.3 0.3"></a-text>
        </a-sphere>`,
          )
          .join('\n        ');

        return `
      <!-- Scene ${index + 1} -->
      <a-entity id="scene-${index}" class="vr-scene" visible="${index === 0}">
        ${objectsHtml}
        ${hotspotsHtml}
      </a-entity>`;
      })
      .join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>VR Presentation</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://unpkg.com/aframe-environment-component@1.3.2/dist/aframe-environment-component.min.js"></script>
  <style>
    .a-enter-vr-button { background-color: #4CAF50 !important; }
  </style>
</head>
<body>
  <a-scene 
    vr-mode-ui="enabled: true"
    renderer="antialias: true; colorManagement: true"
    loading-screen="dotsColor: #4CAF50; backgroundColor: #1a1a2e">
    
    <!-- Environment -->
    <a-entity environment="preset: ${config.environment === 'space' ? 'starry' : config.environment === 'nature' ? 'forest' : 'default'}; groundColor: #1a1a2e; dressingColor: #4CAF50"></a-entity>
    
    <!-- Camera with cursor for interaction -->
    <a-entity id="rig" position="0 0 0">
      <a-camera position="0 1.6 0">
        <a-cursor color="#4CAF50" fuse="true" fuse-timeout="1500"></a-cursor>
      </a-camera>
    </a-entity>
    
    <!-- Ambient lighting -->
    <a-light type="ambient" color="#ffffff" intensity="0.5"></a-light>
    <a-light type="directional" position="1 2 1" intensity="0.7"></a-light>
    
    <!-- Scenes Container -->
    <a-entity id="scenes-container">
      ${sceneElements}
    </a-entity>
    
    <!-- Navigation Controls -->
    <a-entity id="nav-controls" position="0 0.1 -1.5">
      <a-box id="prev-btn" position="-0.4 0 0" width="0.3" height="0.15" depth="0.05" color="#2196F3" class="nav-button" data-action="prev"></a-box>
      <a-box id="next-btn" position="0.4 0 0" width="0.3" height="0.15" depth="0.05" color="#2196F3" class="nav-button" data-action="next"></a-box>
      <a-text value="< Prev" position="-0.4 0 0.03" align="center" scale="0.15 0.15 0.15"></a-text>
      <a-text value="Next >" position="0.4 0 0.03" align="center" scale="0.15 0.15 0.15"></a-text>
    </a-entity>
  </a-scene>
  
  <script>
    let currentScene = 0;
    const totalScenes = ${scenes.length};
    
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'prev' && currentScene > 0) {
          navigateToScene(currentScene - 1);
        } else if (action === 'next' && currentScene < totalScenes - 1) {
          navigateToScene(currentScene + 1);
        }
      });
    });
    
    document.querySelectorAll('.hotspot').forEach(hotspot => {
      hotspot.addEventListener('click', () => {
        const action = hotspot.dataset.action;
        if (action === 'next_slide') navigateToScene(currentScene + 1);
        else if (action === 'previous_slide') navigateToScene(currentScene - 1);
        else if (action.startsWith('open_link:')) {
          window.open(action.replace('open_link:', ''), '_blank');
        }
      });
    });
    
    function navigateToScene(index) {
      if (index < 0 || index >= totalScenes) return;
      
      document.querySelectorAll('.vr-scene').forEach((scene, i) => {
        scene.setAttribute('visible', i === index);
      });
      
      currentScene = index;
    }
  </script>
</body>
</html>`;
  }

  /**
   * Create AR overlay for a slide
   */
  async createAROverlay(
    userId: string,
    projectId: string,
    slideId: string,
    config: Partial<AROverlayConfig> & { name: string },
  ) {
    // Verify project ownership
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    const overlayConfig: AROverlayConfig = {
      type: config.type || 'surface',
      markerUrl: config.markerUrl,
      content3d: config.content3d || {
        primitives: [
          {
            type: 'plane',
            position: { x: 0, y: 0, z: 0 },
            dimensions: { width: 1, height: 0.75 },
            material: { color: '#ffffff', opacity: 1 },
          },
        ],
      },
      animations: config.animations || [],
    };

    return this.prisma.aROverlay.create({
      data: {
        userId,
        projectId,
        slideId,
        name: config.name,
        type: overlayConfig.type,
        markerUrl: overlayConfig.markerUrl,
        content3d: overlayConfig.content3d as object,
        animations: overlayConfig.animations,
        interactions: {
          tap: 'next_element',
          pinch: 'zoom',
          rotate: 'rotate_model',
        },
      },
    });
  }

  /**
   * Generate AR.js marker HTML
   */
  async generateARMarkerHTML(
    overlayId: string,
    userId: string,
  ): Promise<string> {
    const overlay = await this.prisma.aROverlay.findUnique({
      where: { id: overlayId },
    });

    if (!overlay || overlay.userId !== userId) {
      throw new BadRequestException('Overlay not found');
    }

    const content3d = overlay.content3d as AROverlayConfig['content3d'];
    const animations = (overlay.animations ||
      []) as AROverlayConfig['animations'];

    const primitives = content3d.primitives || [];
    const primitivesHtml = primitives
      .map((p) => {
        const animHtml =
          animations && animations.length > 0
            ? `animation="${animations.map((a) => `property: ${a.property}; from: ${a.from}; to: ${a.to}; dur: ${a.duration}; loop: ${a.loop}`).join('; ')}"`
            : '';

        return `<a-${p.type} position="${p.position.x} ${p.position.y} ${p.position.z}" color="${p.material.color}" opacity="${p.material.opacity}" ${animHtml}></a-${p.type}>`;
      })
      .join('\n        ');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AR Presentation Overlay</title>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
</head>
<body style="margin: 0; overflow: hidden;">
  <a-scene embedded arjs="sourceType: webcam; debugUIEnabled: false;">
    <a-marker preset="hiro">
      ${primitivesHtml}
    </a-marker>
    <a-entity camera></a-entity>
  </a-scene>
</body>
</html>`;
  }

  /**
   * Get VR export by ID
   */
  async getVRExport(id: string, userId: string) {
    const vrExport = await this.prisma.vRExport.findUnique({
      where: { id },
      include: { scenes: { orderBy: { order: 'asc' } } },
    });

    if (!vrExport || vrExport.userId !== userId) {
      throw new BadRequestException('VR export not found');
    }

    return vrExport;
  }

  /**
   * Get user's VR exports
   */
  async getUserVRExports(userId: string, projectId?: string) {
    return this.prisma.vRExport.findMany({
      where: {
        userId,
        ...(projectId && { projectId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        scenes: {
          select: { id: true, order: true, environment: true },
        },
      },
    });
  }

  /**
   * Get AR overlays for a project
   */
  async getProjectAROverlays(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.ownerId !== userId) {
      throw new BadRequestException('Project not found');
    }

    return this.prisma.aROverlay.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete VR export
   */
  async deleteVRExport(id: string, userId: string) {
    const vrExport = await this.getVRExport(id, userId);
    return this.prisma.vRExport.delete({ where: { id: vrExport.id } });
  }

  /**
   * Delete AR overlay
   */
  async deleteAROverlay(id: string, userId: string) {
    const overlay = await this.prisma.aROverlay.findUnique({
      where: { id },
    });

    if (!overlay || overlay.userId !== userId) {
      throw new BadRequestException('Overlay not found');
    }

    return this.prisma.aROverlay.delete({ where: { id } });
  }
}
