import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface PresentationVersion {
  id: string;
  versionNumber: number;
  name: string;
  description?: string;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    avatar?: string;
  };
  snapshot: any;
  isAutoSave: boolean;
  isMilestone: boolean;
  changes: VersionChange[];
}

export interface VersionChange {
  type: 'slide_added' | 'slide_deleted' | 'slide_modified' | 'theme_changed' | 'settings_changed';
  slideId?: string;
  description: string;
}

export interface VersionComparison {
  versionA: PresentationVersion;
  versionB: PresentationVersion;
  differences: SlideDifference[];
  summary: {
    slidesAdded: number;
    slidesDeleted: number;
    slidesModified: number;
    totalChanges: number;
  };
}

export interface SlideDifference {
  slideId: string;
  status: 'added' | 'deleted' | 'modified' | 'unchanged';
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
}

@Injectable()
export class VersionControlService {
  private versions = new Map<string, PresentationVersion[]>();
  private autoSaveInterval = 5 * 60 * 1000; // 5 minutes

  constructor(private prisma: PrismaService) {}

  async createVersion(
    projectId: string,
    userId: string,
    options: {
      name?: string;
      description?: string;
      isAutoSave?: boolean;
      isMilestone?: boolean;
    } = {}
  ): Promise<PresentationVersion> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        slides: true,
        owner: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const projectVersions = this.versions.get(projectId) || [];
    const versionNumber = projectVersions.length + 1;

    // Detect changes from previous version
    const changes = this.detectChanges(projectVersions, project);

    const version: PresentationVersion = {
      id: `v${Date.now()}`,
      versionNumber,
      name: options.name || `Version ${versionNumber}`,
      description: options.description,
      createdAt: new Date(),
      createdBy: {
        id: project.owner.id,
        name: project.owner.name || 'Unknown',
        avatar: (project.owner as any).image || undefined,
      },
      snapshot: {
        slides: project.slides,
        settings: {
          title: project.title,
          description: project.description,
        },
      },
      isAutoSave: options.isAutoSave || false,
      isMilestone: options.isMilestone || false,
      changes,
    };

    projectVersions.push(version);
    this.versions.set(projectId, projectVersions);

    // Limit stored versions (keep last 100, all milestones)
    this.pruneVersions(projectId);

    return version;
  }

  async getVersions(
    projectId: string,
    options: {
      limit?: number;
      offset?: number;
      includeAutoSaves?: boolean;
      milestonesOnly?: boolean;
    } = {}
  ): Promise<{ versions: PresentationVersion[]; total: number }> {
    let versions = this.versions.get(projectId) || [];

    if (!options.includeAutoSaves) {
      versions = versions.filter(v => !v.isAutoSave);
    }

    if (options.milestonesOnly) {
      versions = versions.filter(v => v.isMilestone);
    }

    const total = versions.length;
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return {
      versions: versions.slice(offset, offset + limit).reverse(),
      total,
    };
  }

  async getVersion(projectId: string, versionId: string): Promise<PresentationVersion> {
    const versions = this.versions.get(projectId) || [];
    const version = versions.find(v => v.id === versionId);

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    return version;
  }

  async restoreVersion(projectId: string, versionId: string, userId: string): Promise<void> {
    const version = await this.getVersion(projectId, versionId);

    // Create a backup of current state before restore
    await this.createVersion(projectId, userId, {
      name: 'Backup before restore',
      description: `Automatic backup before restoring to ${version.name}`,
    });

    // Restore the snapshot
    await this.prisma.slide.deleteMany({
      where: { projectId },
    });

    for (const slide of version.snapshot.slides) {
      await this.prisma.slide.create({
        data: {
          ...slide,
          projectId,
        },
      });
    }

    // Update project settings
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        title: version.snapshot.settings.title,
        description: version.snapshot.settings.description,
      },
    });
  }

  async compareVersions(
    projectId: string,
    versionAId: string,
    versionBId: string
  ): Promise<VersionComparison> {
    const versionA = await this.getVersion(projectId, versionAId);
    const versionB = await this.getVersion(projectId, versionBId);

    const slidesA = new Map((versionA.snapshot.slides as any[]).map((s: any) => [s.id, s]));
    const slidesB = new Map((versionB.snapshot.slides as any[]).map((s: any) => [s.id, s]));

    const differences: SlideDifference[] = [];
    let slidesAdded = 0;
    let slidesDeleted = 0;
    let slidesModified = 0;

    // Check for deleted and modified slides
    for (const [slideId, slideA] of slidesA) {
      const slideB = slidesB.get(slideId);
      
      if (!slideB) {
        differences.push({ slideId, status: 'deleted' });
        slidesDeleted++;
      } else {
        const changes = this.compareSlides(slideA, slideB);
        if (changes.length > 0) {
          differences.push({ slideId, status: 'modified', changes });
          slidesModified++;
        } else {
          differences.push({ slideId, status: 'unchanged' });
        }
      }
    }

    // Check for added slides
    for (const [slideId] of slidesB) {
      if (!slidesA.has(slideId)) {
        differences.push({ slideId, status: 'added' });
        slidesAdded++;
      }
    }

    return {
      versionA,
      versionB,
      differences,
      summary: {
        slidesAdded,
        slidesDeleted,
        slidesModified,
        totalChanges: slidesAdded + slidesDeleted + slidesModified,
      },
    };
  }

  async markAsMilestone(
    projectId: string,
    versionId: string,
    name: string,
    description?: string
  ): Promise<PresentationVersion> {
    const versions = this.versions.get(projectId) || [];
    const versionIndex = versions.findIndex(v => v.id === versionId);

    if (versionIndex === -1) {
      throw new NotFoundException('Version not found');
    }

    versions[versionIndex] = {
      ...versions[versionIndex],
      isMilestone: true,
      name,
      description: description || versions[versionIndex].description,
    };

    this.versions.set(projectId, versions);
    return versions[versionIndex];
  }

  async createBranch(
    projectId: string,
    versionId: string,
    userId: string,
    branchName: string
  ): Promise<{ branchId: string; projectId: string }> {
    const version = await this.getVersion(projectId, versionId);

    // Create a new project from this version
    const newProject = await this.prisma.project.create({
      data: {
        name: `${version.snapshot.settings.title} (${branchName})`,
        description: `Branch from ${version.name}`,
        ownerId: userId,
        isTemplate: false,
      },
    });

    // Copy slides
    for (const slide of version.snapshot.slides) {
      await this.prisma.slide.create({
        data: {
          ...slide,
          id: undefined,
          projectId: newProject.id,
        },
      });
    }

    return {
      branchId: `branch-${Date.now()}`,
      projectId: newProject.id,
    };
  }

  async mergeChanges(
    sourceProjectId: string,
    targetProjectId: string,
    options: {
      strategy: 'source-wins' | 'target-wins' | 'manual';
      selectedSlides?: string[];
    }
  ): Promise<{ mergedSlides: number; conflicts: number }> {
    const sourceProject = await this.prisma.project.findUnique({
      where: { id: sourceProjectId },
      include: { slides: true },
    });

    const targetProject = await this.prisma.project.findUnique({
      where: { id: targetProjectId },
      include: { slides: true },
    });

    if (!sourceProject || !targetProject) {
      throw new NotFoundException('Project not found');
    }

    let mergedSlides = 0;
    const conflicts = 0;

    // Simple merge strategy - add unique slides from source
    const targetSlideIds = new Set(targetProject.slides.map(s => s.id));
    
    for (const slide of sourceProject.slides) {
      if (options.selectedSlides && !options.selectedSlides.includes(slide.id)) {
        continue;
      }

      if (!targetSlideIds.has(slide.id)) {
        await this.prisma.slide.create({
          data: {
            ...slide,
            id: undefined,
            projectId: targetProjectId,
          },
        });
        mergedSlides++;
      }
    }

    return { mergedSlides, conflicts };
  }

  private detectChanges(
    previousVersions: PresentationVersion[],
    currentProject: any
  ): VersionChange[] {
    const changes: VersionChange[] = [];

    if (previousVersions.length === 0) {
      changes.push({
        type: 'slide_added',
        description: 'Initial version created',
      });
      return changes;
    }

    const lastVersion = previousVersions[previousVersions.length - 1];
    const previousSlides = new Map(lastVersion.snapshot.slides.map((s: any) => [s.id, s]));
    const currentSlides = new Map(currentProject.slides.map((s: any) => [s.id, s]));

    // Check for added slides
    for (const [slideId] of currentSlides) {
      if (!previousSlides.has(slideId)) {
        changes.push({
          type: 'slide_added',
          slideId,
          description: 'New slide added',
        });
      }
    }

    // Check for deleted slides
    for (const [slideId] of previousSlides) {
      if (!currentSlides.has(slideId)) {
        changes.push({
          type: 'slide_deleted',
          slideId,
          description: 'Slide removed',
        });
      }
    }

    // Check for modified slides
    for (const [slideId, currentSlide] of currentSlides) {
      const previousSlide = previousSlides.get(slideId);
      if (previousSlide && JSON.stringify(previousSlide) !== JSON.stringify(currentSlide)) {
        changes.push({
          type: 'slide_modified',
          slideId,
          description: 'Slide content modified',
        });
      }
    }

    return changes;
  }

  private compareSlides(slideA: any, slideB: any): { field: string; oldValue: any; newValue: any }[] {
    const changes: { field: string; oldValue: any; newValue: any }[] = [];
    const fields = ['content', 'layout', 'style', 'notes', 'order'];

    for (const field of fields) {
      if (JSON.stringify(slideA[field]) !== JSON.stringify(slideB[field])) {
        changes.push({
          field,
          oldValue: slideA[field],
          newValue: slideB[field],
        });
      }
    }

    return changes;
  }

  private pruneVersions(projectId: string): void {
    const versions = this.versions.get(projectId) || [];
    
    if (versions.length <= 100) {
      return;
    }

    // Keep all milestones and last 50 regular versions
    const milestones = versions.filter(v => v.isMilestone);
    const regular = versions.filter(v => !v.isMilestone).slice(-50);
    
    this.versions.set(projectId, [...milestones, ...regular].sort((a, b) => 
      a.versionNumber - b.versionNumber
    ));
  }
}
