import { offlineDB } from './indexed-db';

const CACHE_VERSION = 'v1';
const ASSET_CACHE_NAME = `assets-${CACHE_VERSION}`;
const API_CACHE_NAME = `api-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `static-${CACHE_VERSION}`;

// Asset types to cache
const CACHEABLE_ASSET_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.woff', '.woff2', '.ttf'];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = ['/api/themes', '/api/templates', '/api/fonts'];

class CacheManager {
  private cacheReady = false;

  async init(): Promise<void> {
    if (typeof caches === 'undefined') {
      console.warn('Cache API not available');
      return;
    }

    this.cacheReady = true;
    await this.cleanupOldCaches();
  }

  // Check if caching is available
  isAvailable(): boolean {
    return this.cacheReady && typeof caches !== 'undefined';
  }

  // Cache static assets (images, fonts, etc.)
  async cacheAsset(url: string, response?: Response): Promise<void> {
    if (!this.isAvailable()) {return;}

    try {
      const cache = await caches.open(ASSET_CACHE_NAME);

      if (response) {
        await cache.put(url, response.clone());
      } else {
        await cache.add(url);
      }

      // Also store in IndexedDB for more control
      const res = response || (await fetch(url));
      const blob = await res.clone().blob();
      await offlineDB.saveAsset({
        id: this.generateAssetId(url),
        url,
        blob,
        mimeType: blob.type,
        lastAccessed: Date.now(),
      });
    } catch (error) {
      console.error('Failed to cache asset:', url, error);
    }
  }

  // Get cached asset
  async getAsset(url: string): Promise<Response | undefined> {
    if (!this.isAvailable()) {return undefined;}

    try {
      const cache = await caches.open(ASSET_CACHE_NAME);
      const response = await cache.match(url);

      if (response) {
        return response;
      }

      // Try IndexedDB
      const asset = await offlineDB.getAssetByUrl(url);
      if (asset) {
        return new Response(asset.blob, {
          headers: { 'Content-Type': asset.mimeType },
        });
      }
    } catch (error) {
      console.error('Failed to get cached asset:', url, error);
    }

    return undefined;
  }

  // Cache API response
  async cacheApiResponse(url: string, response: Response): Promise<void> {
    if (!this.isAvailable()) {return;}

    // Only cache GET requests for specific endpoints
    if (!this.isCacheableApiUrl(url)) {return;}

    try {
      const cache = await caches.open(API_CACHE_NAME);
      await cache.put(url, response.clone());
    } catch (error) {
      console.error('Failed to cache API response:', url, error);
    }
  }

  // Get cached API response
  async getApiResponse(url: string): Promise<Response | undefined> {
    if (!this.isAvailable()) {return undefined;}

    try {
      const cache = await caches.open(API_CACHE_NAME);
      return await cache.match(url);
    } catch (error) {
      console.error('Failed to get cached API response:', url, error);
    }

    return undefined;
  }

  // Cache static files
  async cacheStaticFiles(urls: string[]): Promise<void> {
    if (!this.isAvailable()) {return;}

    try {
      const cache = await caches.open(STATIC_CACHE_NAME);
      await cache.addAll(urls);
    } catch (error) {
      console.error('Failed to cache static files:', error);
    }
  }

  // Get static file from cache
  async getStaticFile(url: string): Promise<Response | undefined> {
    if (!this.isAvailable()) {return undefined;}

    try {
      const cache = await caches.open(STATIC_CACHE_NAME);
      return await cache.match(url);
    } catch (error) {
      console.error('Failed to get static file:', url, error);
    }

    return undefined;
  }

  // Preload presentation assets
  async preloadPresentationAssets(presentationData: {
    slides?: Array<{
      blocks?: Array<{
        type: string;
        content?: { url?: string; src?: string };
      }>;
    }>;
  }): Promise<void> {
    if (!this.isAvailable() || !presentationData.slides) {return;}

    const assetUrls: string[] = [];

    // Extract image URLs from slides
    for (const slide of presentationData.slides) {
      if (slide.blocks) {
        for (const block of slide.blocks) {
          if (block.type === 'image' && block.content?.url) {
            assetUrls.push(block.content.url);
          }
          if (block.type === 'video' && block.content?.src) {
            // Don't cache videos - too large
          }
        }
      }
    }

    // Cache all assets in parallel
    await Promise.all(assetUrls.map((url) => this.cacheAsset(url)));
  }

  // Clean up old caches
  private async cleanupOldCaches(): Promise<void> {
    const cacheKeys = await caches.keys();
    const currentCaches = [ASSET_CACHE_NAME, API_CACHE_NAME, STATIC_CACHE_NAME];

    await Promise.all(
      cacheKeys.map(async (key) => {
        if (!currentCaches.includes(key)) {
          await caches.delete(key);
        }
      })
    );

    // Clean up old IndexedDB assets
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    await offlineDB.deleteOldAssets(ONE_WEEK);
  }

  // Check if URL should be cached
  private isCacheableAssetUrl(url: string): boolean {
    return CACHEABLE_ASSET_EXTENSIONS.some((ext) => url.toLowerCase().includes(ext));
  }

  private isCacheableApiUrl(url: string): boolean {
    return CACHEABLE_API_PATTERNS.some((pattern) => url.includes(pattern));
  }

  // Generate consistent asset ID
  private generateAssetId(url: string): string {
    return btoa(url).replace(/[/+=]/g, '_');
  }

  // Get cache size
  async getCacheSize(): Promise<{
    assets: number;
    api: number;
    static: number;
    total: number;
  }> {
    if (!this.isAvailable()) {
      return { assets: 0, api: 0, static: 0, total: 0 };
    }

    const sizes = {
      assets: 0,
      api: 0,
      static: 0,
      total: 0,
    };

    try {
      // This is an approximation - actual size calculation is complex
      const assetCache = await caches.open(ASSET_CACHE_NAME);
      const assetKeys = await assetCache.keys();
      sizes.assets = assetKeys.length;

      const apiCache = await caches.open(API_CACHE_NAME);
      const apiKeys = await apiCache.keys();
      sizes.api = apiKeys.length;

      const staticCache = await caches.open(STATIC_CACHE_NAME);
      const staticKeys = await staticCache.keys();
      sizes.static = staticKeys.length;

      sizes.total = sizes.assets + sizes.api + sizes.static;
    } catch (error) {
      console.error('Failed to get cache size:', error);
    }

    return sizes;
  }

  // Clear all caches
  async clearAll(): Promise<void> {
    if (!this.isAvailable()) {return;}

    await Promise.all([
      caches.delete(ASSET_CACHE_NAME),
      caches.delete(API_CACHE_NAME),
      caches.delete(STATIC_CACHE_NAME),
      offlineDB.clearAll(),
    ]);
  }

  // Clear specific cache
  async clearCache(cacheType: 'assets' | 'api' | 'static'): Promise<void> {
    if (!this.isAvailable()) {return;}

    const cacheNames: Record<string, string> = {
      assets: ASSET_CACHE_NAME,
      api: API_CACHE_NAME,
      static: STATIC_CACHE_NAME,
    };

    await caches.delete(cacheNames[cacheType]);
  }
}

export const cacheManager = new CacheManager();
