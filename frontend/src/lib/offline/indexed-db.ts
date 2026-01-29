// IndexedDB wrapper for offline storage
const DB_NAME = 'presentation_generator_offline';
const DB_VERSION = 1;

interface PresentationCache {
  id: string;
  projectId: string;
  data: unknown;
  lastModified: number;
  synced: boolean;
}

interface AssetCache {
  id: string;
  url: string;
  blob: Blob;
  mimeType: string;
  lastAccessed: number;
}

interface PendingChange {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'presentation' | 'slide' | 'block';
  entityId: string;
  data: unknown;
  timestamp: number;
  retryCount: number;
}

class OfflineDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Presentations store
        if (!db.objectStoreNames.contains('presentations')) {
          const presentationsStore = db.createObjectStore('presentations', { keyPath: 'id' });
          presentationsStore.createIndex('projectId', 'projectId', { unique: false });
          presentationsStore.createIndex('synced', 'synced', { unique: false });
        }

        // Slides store
        if (!db.objectStoreNames.contains('slides')) {
          const slidesStore = db.createObjectStore('slides', { keyPath: 'id' });
          slidesStore.createIndex('presentationId', 'presentationId', { unique: false });
        }

        // Blocks store
        if (!db.objectStoreNames.contains('blocks')) {
          const blocksStore = db.createObjectStore('blocks', { keyPath: 'id' });
          blocksStore.createIndex('slideId', 'slideId', { unique: false });
        }

        // Assets store for images, fonts, etc.
        if (!db.objectStoreNames.contains('assets')) {
          const assetsStore = db.createObjectStore('assets', { keyPath: 'id' });
          assetsStore.createIndex('url', 'url', { unique: true });
        }

        // Pending changes for sync
        if (!db.objectStoreNames.contains('pendingChanges')) {
          const changesStore = db.createObjectStore('pendingChanges', { keyPath: 'id' });
          changesStore.createIndex('timestamp', 'timestamp', { unique: false });
          changesStore.createIndex('entityType', 'entityType', { unique: false });
        }

        // User preferences
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }

        // Templates cache
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }

        // Themes cache
        if (!db.objectStoreNames.contains('themes')) {
          db.createObjectStore('themes', { keyPath: 'id' });
        }
      };
    });

    return this.initPromise;
  }

  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Presentations
  async savePresentation(presentation: PresentationCache): Promise<void> {
    const store = await this.getStore('presentations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(presentation);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPresentation(id: string): Promise<PresentationCache | undefined> {
    const store = await this.getStore('presentations');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPresentations(): Promise<PresentationCache[]> {
    const store = await this.getStore('presentations');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedPresentations(): Promise<PresentationCache[]> {
    const store = await this.getStore('presentations');
    const index = store.index('synced');
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePresentation(id: string): Promise<void> {
    const store = await this.getStore('presentations', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Slides
  async saveSlide(slide: { id: string; presentationId: string; data: unknown }): Promise<void> {
    const store = await this.getStore('slides', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(slide);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSlidesByPresentation(presentationId: string): Promise<unknown[]> {
    const store = await this.getStore('slides');
    const index = store.index('presentationId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(presentationId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Blocks
  async saveBlock(block: { id: string; slideId: string; data: unknown }): Promise<void> {
    const store = await this.getStore('blocks', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(block);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBlocksBySlide(slideId: string): Promise<unknown[]> {
    const store = await this.getStore('blocks');
    const index = store.index('slideId');
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(slideId));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Assets
  async saveAsset(asset: AssetCache): Promise<void> {
    const store = await this.getStore('assets', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(asset);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAssetByUrl(url: string): Promise<AssetCache | undefined> {
    const store = await this.getStore('assets');
    const index = store.index('url');
    return new Promise((resolve, reject) => {
      const request = index.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteOldAssets(maxAge: number): Promise<void> {
    const store = await this.getStore('assets', 'readwrite');
    const cutoff = Date.now() - maxAge;

    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const asset = cursor.value as AssetCache;
          if (asset.lastAccessed < cutoff) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Pending Changes
  async addPendingChange(change: Omit<PendingChange, 'id'>): Promise<string> {
    const store = await this.getStore('pendingChanges', 'readwrite');
    const id = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullChange: PendingChange = { ...change, id };

    return new Promise((resolve, reject) => {
      const request = store.put(fullChange);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingChanges(): Promise<PendingChange[]> {
    const store = await this.getStore('pendingChanges');
    const index = store.index('timestamp');
    return new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePendingChange(id: string): Promise<void> {
    const store = await this.getStore('pendingChanges', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updatePendingChangeRetry(id: string): Promise<void> {
    const store = await this.getStore('pendingChanges', 'readwrite');
    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const change = getRequest.result;
        if (change) {
          change.retryCount++;
          const putRequest = store.put(change);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Preferences
  async setPreference(key: string, value: unknown): Promise<void> {
    const store = await this.getStore('preferences', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPreference<T>(key: string): Promise<T | undefined> {
    const store = await this.getStore('preferences');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // Templates
  async saveTemplate(template: { id: string; [key: string]: unknown }): Promise<void> {
    const store = await this.getStore('templates', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(template);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTemplates(): Promise<unknown[]> {
    const store = await this.getStore('templates');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Themes
  async saveTheme(theme: { id: string; [key: string]: unknown }): Promise<void> {
    const store = await this.getStore('themes', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(theme);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllThemes(): Promise<unknown[]> {
    const store = await this.getStore('themes');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear all data
  async clearAll(): Promise<void> {
    const db = await this.init();
    const stores = Array.from(db.objectStoreNames);
    const transaction = db.transaction(stores, 'readwrite');

    const promises = stores.map(
      (storeName) =>
        new Promise<void>((resolve, reject) => {
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        })
    );

    await Promise.all(promises);
  }

  // Get storage usage
  async getStorageUsage(): Promise<{
    presentations: number;
    slides: number;
    blocks: number;
    assets: number;
    pendingChanges: number;
  }> {
    const [presentations, slides, blocks, assets, pendingChanges] = await Promise.all([
      this.countStore('presentations'),
      this.countStore('slides'),
      this.countStore('blocks'),
      this.countStore('assets'),
      this.countStore('pendingChanges'),
    ]);

    return { presentations, slides, blocks, assets, pendingChanges };
  }

  private async countStore(storeName: string): Promise<number> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineDB = new OfflineDB();
export type { PresentationCache, AssetCache, PendingChange };
