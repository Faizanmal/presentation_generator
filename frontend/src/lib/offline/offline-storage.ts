import type { Presentation, Slide } from '@/types';
import type { PresentationCache } from './indexed-db';
import { offlineDB } from './indexed-db';
import { syncManager } from './sync-manager';
import { cacheManager } from './cache-manager';

interface OfflinePresentation {
  id: string;
  projectId: string;
  name: string;
  thumbnailUrl?: string;
  lastModified: Date;
  synced: boolean;
  slideCount: number;
}

class OfflineStorage {
  // Save presentation for offline access
  async savePresentation(projectId: string, data: Presentation): Promise<void> {
    const presentation: PresentationCache = {
      id: data.id,
      projectId,
      data,
      lastModified: Date.now(),
      synced: false,
    };

    await offlineDB.savePresentation(presentation);

    // Save slides separately for faster access
    if (data.slides) {
      for (const slide of data.slides) {
        await offlineDB.saveSlide({
          id: slide.id,
          presentationId: data.id,
          data: slide,
        });
      }
    }

    // Cache assets
    await cacheManager.preloadPresentationAssets(data);

    // Queue for sync
    await syncManager.queueChange('update', 'presentation', data.id, data);
  }

  // Get offline presentation
  async getPresentation(id: string): Promise<Presentation | null> {
    const cached = await offlineDB.getPresentation(id);
    if (!cached) {return null;}

    // Also load slides
    const slides = await offlineDB.getSlidesByPresentation(id);

    return {
      ...(cached.data as Presentation),
      slides: slides as Slide[],
    };
  }

  // Get all offline presentations
  async getAllPresentations(): Promise<OfflinePresentation[]> {
    const cached = await offlineDB.getAllPresentations();

    return cached.map((p) => {
      const data = p.data as Presentation;
      return {
        id: p.id,
        projectId: p.projectId,
        name: (data.title as string) || 'Untitled',
        thumbnailUrl: (data as unknown as Record<string, unknown>).thumbnailUrl as string | undefined,
        lastModified: new Date(p.lastModified),
        synced: p.synced,
        slideCount: data.slides?.length || 0,
      };
    });
  }

  // Delete offline presentation
  async deletePresentation(id: string): Promise<void> {
    await offlineDB.deletePresentation(id);
    // Also queue deletion for sync
    await syncManager.queueChange('delete', 'presentation', id);
  }

  // Save slide changes
  async saveSlide(presentationId: string, slideId: string, data: unknown): Promise<void> {
    await offlineDB.saveSlide({
      id: slideId,
      presentationId,
      data,
    });

    // Update presentation last modified
    const presentation = await offlineDB.getPresentation(presentationId);
    if (presentation) {
      await offlineDB.savePresentation({
        ...presentation,
        lastModified: Date.now(),
        synced: false,
      });
    }

    await syncManager.queueChange('update', 'slide', slideId, data);
  }

  // Get slides for presentation
  async getSlides(presentationId: string): Promise<unknown[]> {
    return offlineDB.getSlidesByPresentation(presentationId);
  }

  // Save block changes
  async saveBlock(slideId: string, blockId: string, data: unknown): Promise<void> {
    await offlineDB.saveBlock({
      id: blockId,
      slideId,
      data,
    });

    await syncManager.queueChange('update', 'block', blockId, data);
  }

  // Get blocks for slide
  async getBlocks(slideId: string): Promise<unknown[]> {
    return offlineDB.getBlocksBySlide(slideId);
  }

  // Check if presentation is available offline
  async isAvailableOffline(id: string): Promise<boolean> {
    const presentation = await offlineDB.getPresentation(id);
    return !!presentation;
  }

  // Make presentation available offline
  async makeAvailableOffline(projectId: string, data: Presentation): Promise<void> {
    await this.savePresentation(projectId, data);
  }

  // Remove from offline storage
  async removeFromOffline(id: string): Promise<void> {
    await offlineDB.deletePresentation(id);
  }

  // Get storage stats
  async getStorageStats(): Promise<{
    presentations: number;
    pendingChanges: number;
    storageUsed: string;
    lastSync: Date | null;
  }> {
    const usage = await offlineDB.getStorageUsage();
    const pendingCount = await syncManager.getPendingCount();
    const lastSync = await offlineDB.getPreference<number>('lastSync');

    // Estimate storage used
    let storageEstimate = 'Unknown';
    if (typeof navigator !== 'undefined' && 'storage' in navigator) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          storageEstimate = this.formatBytes(estimate.usage);
        }
      } catch {
        // Storage API not available
      }
    }

    return {
      presentations: usage.presentations,
      pendingChanges: pendingCount,
      storageUsed: storageEstimate,
      lastSync: lastSync ? new Date(lastSync) : null,
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) {return '0 Bytes';}
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  // Clear all offline data
  async clearAll(): Promise<void> {
    await offlineDB.clearAll();
    await cacheManager.clearAll();
  }
}

export const offlineStorage = new OfflineStorage();
export type { OfflinePresentation };
