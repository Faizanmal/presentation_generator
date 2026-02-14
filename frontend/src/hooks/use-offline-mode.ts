'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SyncStatus, SyncProgress, OfflinePresentation } from '@/lib/offline';
import type { Presentation } from '@/types';
import { syncManager, offlineStorage } from '@/lib/offline';

interface UseOfflineModeReturn {
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncProgress: SyncProgress | null;
  pendingChanges: number;
  offlinePresentations: OfflinePresentation[];
  triggerSync: () => Promise<void>;
  saveForOffline: (projectId: string, data: unknown) => Promise<void>;
  removeFromOffline: (id: string) => Promise<void>;
  isAvailableOffline: (id: string) => Promise<boolean>;
  storageStats: {
    presentations: number;
    pendingChanges: number;
    storageUsed: string;
    lastSync: Date | null;
  } | null;
}

export function useOfflineMode(): UseOfflineModeReturn {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [offlinePresentations, setOfflinePresentations] = useState<OfflinePresentation[]>([]);
  const [storageStats, setStorageStats] = useState<UseOfflineModeReturn['storageStats']>(null);

  // Define loadOfflineData with useCallback to stabilize it
  const loadOfflineData = useCallback(async () => {
    try {
      const [presentations, pending, stats] = await Promise.all([
        offlineStorage.getAllPresentations(),
        syncManager.getPendingCount(),
        offlineStorage.getStorageStats(),
      ]);

      setOfflinePresentations(presentations);
      setPendingChanges(pending);
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  }, []);

  // Initialize and set up listeners

  useEffect(() => {
    // Set up online/offline listeners

    // Set up online/offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Subscribe to sync manager updates
    const unsubscribe = syncManager.subscribe((status, progress) => {
      setSyncStatus(status);
      if (progress) {
        setSyncProgress(progress);
      }
    });

    // Load initial data
    // Load initial data
    setTimeout(() => {
      loadOfflineData();
    }, 0);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [loadOfflineData]);

  const triggerSync = useCallback(async () => {
    await syncManager.forceSync();
    await loadOfflineData();
  }, [loadOfflineData]);

  const saveForOffline = useCallback(async (projectId: string, data: unknown) => {

    await offlineStorage.savePresentation(projectId, data as Presentation);
    await loadOfflineData();
  }, [loadOfflineData]);

  const removeFromOffline = useCallback(async (id: string) => {
    await offlineStorage.removeFromOffline(id);
    await loadOfflineData();
  }, [loadOfflineData]);

  const isAvailableOffline = useCallback(async (id: string) => {
    return offlineStorage.isAvailableOffline(id);
  }, []);

  return {
    isOnline,
    syncStatus,
    syncProgress,
    pendingChanges,
    offlinePresentations,
    triggerSync,
    saveForOffline,
    removeFromOffline,
    isAvailableOffline,
    storageStats,
  };
}
