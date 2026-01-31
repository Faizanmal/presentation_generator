/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncedAt: Date | null;
  conflicts: SyncConflict[];
}

interface SyncConflict {
  id: string;
  type: 'project' | 'slide' | 'block';
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  createdAt: Date;
}

interface CachedItem {
  key: string;
  data: Record<string, unknown>;
  timestamp: number;
  expiry?: number;
}

const SYNC_QUEUE_KEY = 'pd_sync_queue';
const CACHE_PREFIX = 'pd_cache_';
const SYNC_INTERVAL = 30000; // 30 seconds

export function useOffline() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingChanges: 0,
    lastSyncedAt: null,
    conflicts: [],
  });

  const queryClient = useQueryClient();
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get sync queue from localStorage - defined first so it can be used in useEffect
  const getSyncQueue = useCallback((): any[] => {
    try {
      const queue = localStorage.getItem(SYNC_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  }, []);

  // Save to sync queue
  const addToSyncQueue = useCallback(
    (operation: {
      type: 'create' | 'update' | 'delete';
      entity: 'project' | 'slide' | 'block';
      entityId: string;
      data: any;
      timestamp: number;
    }) => {
      const queue = getSyncQueue();
      queue.push(operation);
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      setStatus((prev) => ({
        ...prev,
        pendingChanges: queue.length,
      }));
    },
    [getSyncQueue]
  );

  // Cache data locally
  const cacheData = useCallback(
    (key: string, data: any, expiryMs?: number) => {
      const cacheItem: CachedItem = {
        key,
        data,
        timestamp: Date.now(),
        expiry: expiryMs ? Date.now() + expiryMs : undefined,
      };

      try {
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheItem));
      } catch (error) {
        console.error('Cache storage error:', error);
        // Try to clear old cache items
        clearExpiredCache();
      }
    },
    []
  );

  // Get cached data
  const getCachedData = useCallback(<T>(key: string): T | null => {
    try {
      const item = localStorage.getItem(CACHE_PREFIX + key);
      if (!item) return null;

      const cached: CachedItem = JSON.parse(item);
      
      // Check expiry
      if (cached.expiry && Date.now() > cached.expiry) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }

      return cached.data as T;
    } catch {
      return null;
    }
  }, []);

  // Clear expired cache
  const clearExpiredCache = useCallback(() => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
    
    keys.forEach((key) => {
      try {
        const item = JSON.parse(localStorage.getItem(key) || '');
        if (item.expiry && Date.now() > item.expiry) {
          localStorage.removeItem(key);
        }
      } catch {
        localStorage.removeItem(key);
      }
    });
  }, []);

  // Sync changes to server  
  const syncChanges = useCallback(async () => {
    if (!navigator.onLine) return;

    const queue = getSyncQueue();
    if (queue.length === 0) return;

    setStatus((prev) => ({ ...prev, isSyncing: true }));

    const conflicts: SyncConflict[] = [];
    const synced: number[] = [];

    for (let i = 0; i < queue.length; i++) {
      const operation = queue[i];

      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation),
        });

        if (response.ok) {
          synced.push(i);
        } else if (response.status === 409) {
          // Conflict
          const serverData = await response.json();
          conflicts.push({
            id: crypto.randomUUID(),
            type: operation.entity,
            entityId: operation.entityId,
            localVersion: operation.data,
            serverVersion: serverData.serverVersion,
            createdAt: new Date(),
          });
        } else {
          console.error('Sync failed for operation:', operation);
        }
      } catch (error) {
        console.error('Sync error:', error);
        break; // Stop syncing on network error
      }
    }

    // Remove synced items from queue
    const remainingQueue = queue.filter((_, i) => !synced.includes(i));
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));

    setStatus((prev) => ({
      ...prev,
      isSyncing: false,
      pendingChanges: remainingQueue.length,
      lastSyncedAt: new Date(),
      conflicts: [...prev.conflicts, ...conflicts],
    }));

    // Invalidate queries to refresh data
    if (synced.length > 0) {
      queryClient.invalidateQueries();
    }

    if (conflicts.length > 0) {
      toast.warning(`${conflicts.length} sync conflict(s) detected`);
    }
  }, [getSyncQueue, queryClient]);

  // Start periodic sync
  const startPeriodicSync = useCallback(() => {
    const runSync = async () => {
      await syncChanges();
      syncTimeoutRef.current = setTimeout(runSync, SYNC_INTERVAL);
    };

    syncTimeoutRef.current = setTimeout(runSync, SYNC_INTERVAL);
  }, [syncChanges]);

  // Initialize and load sync queue - now after all callbacks are defined
  useEffect(() => {
    const queue = getSyncQueue();
    setStatus((prev) => ({
      ...prev,
      pendingChanges: queue.length,
    }));

    // Set up online/offline listeners
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      toast.success('Back online');
      syncChanges();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
      toast.warning('You are offline. Changes will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start periodic sync
    startPeriodicSync();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [getSyncQueue, syncChanges, startPeriodicSync]);

  // Resolve conflict
  const resolveConflict = useCallback(
    async (
      conflictId: string,
      resolution: 'local' | 'server' | 'merge',
      mergedData?: any
    ) => {
      const conflict = status.conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      let dataToSync: any;

      switch (resolution) {
        case 'local':
          dataToSync = conflict.localVersion;
          break;
        case 'server':
          dataToSync = conflict.serverVersion;
          break;
        case 'merge':
          dataToSync = mergedData;
          break;
      }

      try {
        await fetch(`/api/sync/resolve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entityType: conflict.type,
            entityId: conflict.entityId,
            data: dataToSync,
            resolution,
          }),
        });

        // Remove resolved conflict
        setStatus((prev) => ({
          ...prev,
          conflicts: prev.conflicts.filter((c) => c.id !== conflictId),
        }));

        toast.success('Conflict resolved');
      } catch (error) {
        console.error('Error resolving conflict:', error);
        toast.error('Failed to resolve conflict');
      }
    },
    [status.conflicts]
  );

  // Force sync
  const forceSync = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('Cannot sync while offline');
      return;
    }

    await syncChanges();
    toast.success('Sync complete');
  }, [syncChanges]);

  // Cache project for offline use
  const cacheProjectForOffline = useCallback(
    async (projectId: string) => {
      try {
        const response = await fetch(`/api/projects/${projectId}/full`);
        const project = await response.json();

        // Cache project data
        cacheData(`project_${projectId}`, project, 7 * 24 * 60 * 60 * 1000); // 7 days

        // Cache associated assets
        if (project.slides) {
          for (const slide of project.slides) {
            if (slide.blocks) {
              for (const block of slide.blocks) {
                if (block.content?.url && block.type === 'image') {
                  await cacheAsset(block.content.url);
                }
              }
            }
          }
        }

        toast.success('Project cached for offline use');
      } catch (error) {
        console.error('Error caching project:', error);
        toast.error('Failed to cache project');
      }
    },
    [cacheData]
  );

  // Cache an asset (image, etc.)
  const cacheAsset = async (url: string) => {
    if ('caches' in window) {
      try {
        const cache = await caches.open('pd-assets');
        await cache.add(url);
      } catch (error) {
        console.error('Error caching asset:', error);
      }
    }
  };

  // Get offline-available projects
  const getOfflineProjects = useCallback((): string[] => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith(CACHE_PREFIX + 'project_')
    );
    return keys.map((k) => k.replace(CACHE_PREFIX + 'project_', ''));
  }, []);

  // Remove project from offline cache
  const removeOfflineProject = useCallback((projectId: string) => {
    localStorage.removeItem(CACHE_PREFIX + `project_${projectId}`);
    toast.success('Project removed from offline cache');
  }, []);

  return {
    status,
    addToSyncQueue,
    cacheData,
    getCachedData,
    syncChanges: forceSync,
    resolveConflict,
    cacheProjectForOffline,
    getOfflineProjects,
    removeOfflineProject,
  };
}
