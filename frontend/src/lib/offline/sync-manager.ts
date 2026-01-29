import { offlineDB, PendingChange } from './indexed-db';

const MAX_RETRY_COUNT = 5;
const SYNC_INTERVAL = 30000; // 30 seconds

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
type SyncListener = (status: SyncStatus, progress?: SyncProgress) => void;

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem?: string;
}

interface ConflictResolution {
  strategy: 'local' | 'remote' | 'merge';
  resolvedData?: unknown;
}

class SyncManager {
  private status: SyncStatus = 'idle';
  private listeners: Set<SyncListener> = new Set();
  private syncInterval: NodeJS.Timeout | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));

      // Start background sync
      this.startBackgroundSync();
    }
  }

  // Status management
  private setStatus(status: SyncStatus, progress?: SyncProgress): void {
    this.status = status;
    this.notifyListeners(status, progress);
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(status: SyncStatus, progress?: SyncProgress): void {
    this.listeners.forEach((listener) => listener(status, progress));
  }

  // Online/Offline handlers
  private handleOnline(): void {
    this.isOnline = true;
    this.setStatus('idle');
    this.sync();
  }

  private handleOffline(): void {
    this.isOnline = false;
    this.setStatus('offline');
  }

  // Background sync
  private startBackgroundSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (this.isOnline && this.status !== 'syncing') {
        this.sync();
      }
    }, SYNC_INTERVAL);
  }

  stopBackgroundSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Main sync method
  async sync(): Promise<SyncProgress> {
    if (!this.isOnline) {
      return { total: 0, completed: 0, failed: 0 };
    }

    this.setStatus('syncing');
    const progress: SyncProgress = { total: 0, completed: 0, failed: 0 };

    try {
      // Get all pending changes
      const pendingChanges = await offlineDB.getPendingChanges();
      progress.total = pendingChanges.length;

      // Process each change
      for (const change of pendingChanges) {
        try {
          progress.currentItem = `${change.entityType} ${change.entityId}`;
          this.notifyListeners('syncing', progress);

          await this.processChange(change);
          await offlineDB.deletePendingChange(change.id);
          progress.completed++;
        } catch (error) {
          console.error('Failed to sync change:', change.id, error);
          progress.failed++;

          // Update retry count
          if (change.retryCount < MAX_RETRY_COUNT) {
            await offlineDB.updatePendingChangeRetry(change.id);
          } else {
            // Max retries reached, remove the change
            await offlineDB.deletePendingChange(change.id);
          }
        }
      }

      // Sync unsynced presentations
      await this.syncPresentations();

      this.setStatus('idle', progress);
    } catch (error) {
      console.error('Sync failed:', error);
      this.setStatus('error', progress);
    }

    return progress;
  }

  private async processChange(change: PendingChange): Promise<void> {
    const { type, entityType, entityId, data } = change;

    switch (type) {
      case 'create':
        await this.createEntity(entityType, data);
        break;
      case 'update':
        await this.updateEntity(entityType, entityId, data);
        break;
      case 'delete':
        await this.deleteEntity(entityType, entityId);
        break;
    }
  }

  private async createEntity(entityType: string, data: unknown): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/${entityType}s`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create ${entityType}: ${response.statusText}`);
    }
  }

  private async updateEntity(entityType: string, entityId: string, data: unknown): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/${entityType}s/${entityId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update ${entityType}: ${response.statusText}`);
    }
  }

  private async deleteEntity(entityType: string, entityId: string): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/${entityType}s/${entityId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete ${entityType}: ${response.statusText}`);
    }
  }

  private async syncPresentations(): Promise<void> {
    const unsyncedPresentations = await offlineDB.getUnsyncedPresentations();

    for (const presentation of unsyncedPresentations) {
      try {
        // Check for conflicts
        const serverVersion = await this.fetchServerPresentation(presentation.projectId);

        if (serverVersion && serverVersion.lastModified > presentation.lastModified) {
          // Server has newer version - potential conflict
          const resolution = await this.resolveConflict(presentation, serverVersion);
          await this.applyConflictResolution(presentation.id, resolution);
        } else {
          // Local is newer or same - push to server
          await this.pushPresentation(presentation);
        }

        // Mark as synced
        await offlineDB.savePresentation({
          ...presentation,
          synced: true,
        });
      } catch (error) {
        console.error('Failed to sync presentation:', presentation.id, error);
      }
    }
  }

  private async fetchServerPresentation(projectId: string): Promise<{ lastModified: number; data: unknown } | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/projects/${projectId}`, {
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Server unavailable
    }

    return null;
  }

  private async pushPresentation(presentation: { projectId: string; data: unknown }): Promise<void> {
    const response = await fetch(`${this.apiBaseUrl}/projects/${presentation.projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify(presentation.data),
    });

    if (!response.ok) {
      throw new Error(`Failed to push presentation: ${response.statusText}`);
    }
  }

  // Conflict resolution
  private async resolveConflict(
    local: { data: unknown; lastModified: number },
    remote: { data: unknown; lastModified: number }
  ): Promise<ConflictResolution> {
    // Default strategy: prefer newer
    if (local.lastModified > remote.lastModified) {
      return { strategy: 'local' };
    }

    // You could implement more sophisticated conflict resolution here
    // For now, we prefer remote if it's newer
    return { strategy: 'remote' };
  }

  private async applyConflictResolution(presentationId: string, resolution: ConflictResolution): Promise<void> {
    switch (resolution.strategy) {
      case 'local':
        // Keep local version, it will be pushed on next sync
        break;
      case 'remote':
        // Fetch and save remote version
        const presentation = await offlineDB.getPresentation(presentationId);
        if (presentation) {
          const serverData = await this.fetchServerPresentation(presentation.projectId);
          if (serverData) {
            await offlineDB.savePresentation({
              ...presentation,
              data: serverData.data,
              lastModified: serverData.lastModified,
              synced: true,
            });
          }
        }
        break;
      case 'merge':
        // Apply merged data
        if (resolution.resolvedData) {
          const pres = await offlineDB.getPresentation(presentationId);
          if (pres) {
            await offlineDB.savePresentation({
              ...pres,
              data: resolution.resolvedData,
              lastModified: Date.now(),
              synced: false,
            });
          }
        }
        break;
    }
  }

  // Queue changes for sync
  async queueChange(
    type: 'create' | 'update' | 'delete',
    entityType: 'presentation' | 'slide' | 'block',
    entityId: string,
    data?: unknown
  ): Promise<void> {
    await offlineDB.addPendingChange({
      type,
      entityType,
      entityId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // Try to sync immediately if online
    if (this.isOnline) {
      this.sync();
    }
  }

  // Helpers
  private getAuthToken(): string {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('auth_token') || '';
    }
    return '';
  }

  // Force sync
  async forceSync(): Promise<SyncProgress> {
    return this.sync();
  }

  // Get pending changes count
  async getPendingCount(): Promise<number> {
    const changes = await offlineDB.getPendingChanges();
    return changes.length;
  }

  // Check if online
  checkOnline(): boolean {
    return this.isOnline;
  }
}

export const syncManager = new SyncManager();
export type { SyncStatus, SyncProgress, ConflictResolution };
