import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: 'CACHE_CONFIG',
          useValue: {
            defaultTTL: 3600,
            maxSize: 100,
          },
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(async () => {
    await service.clear();
    service.onModuleDestroy();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', async () => {
      await service.set('test-key', { value: 'test-data' });
      const result = await service.get('test-key');

      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for non-existent key', async () => {
      const result = await service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      await service.set('short-ttl', 'value', 1); // 1 second TTL

      const immediate = await service.get('short-ttl');
      expect(immediate).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const expired = await service.get('short-ttl');
      expect(expired).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', async () => {
      await service.set('to-delete', 'value');
      const deleted = await service.delete('to-delete');

      expect(deleted).toBe(true);
      expect(await service.get('to-delete')).toBeNull();
    });

    it('should return false for non-existent key', async () => {
      const deleted = await service.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', async () => {
      await service.set('user:1:data', 'data1');
      await service.set('user:2:data', 'data2');
      await service.set('project:1:data', 'data3');

      const count = await service.deletePattern('user:*');

      expect(count).toBe(2);
      expect(await service.get('user:1:data')).toBeNull();
      expect(await service.get('user:2:data')).toBeNull();
      expect(await service.get('project:1:data')).toBe('data3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      await service.set('cached', 'existing-value');

      const factoryCalled = jest.fn().mockResolvedValue('new-value');
      const result = await service.getOrSet('cached', factoryCalled);

      expect(result).toBe('existing-value');
      expect(factoryCalled).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not exists', async () => {
      const factoryCalled = jest.fn().mockResolvedValue('new-value');
      const result = await service.getOrSet('not-cached', factoryCalled);

      expect(result).toBe('new-value');
      expect(factoryCalled).toHaveBeenCalledTimes(1);

      // Should be cached now
      const cached = await service.get('not-cached');
      expect(cached).toBe('new-value');
    });
  });

  describe('has', () => {
    it('should return true for existing key', async () => {
      await service.set('exists', 'value');
      expect(await service.has('exists')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await service.has('not-exists')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');

      const keys = await service.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter keys by pattern', async () => {
      await service.set('user:1', 'value1');
      await service.set('user:2', 'value2');
      await service.set('project:1', 'value3');

      const keys = await service.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('project:1');
    });
  });

  describe('stats', () => {
    it('should track cache statistics', async () => {
      await service.set('key', 'value');

      await service.get('key'); // hit
      await service.get('key'); // hit
      await service.get('missing'); // miss

      const stats = service.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', async () => {
      // Create a service with small max size
      const smallService = new CacheService({
        defaultTTL: 3600,
        maxSize: 3,
      });

      await smallService.set('key1', 'value1');
      await smallService.set('key2', 'value2');
      await smallService.set('key3', 'value3');

      // Access key1 to make it recently used
      await smallService.get('key1');

      // Add a fourth key, should evict key2 (least recently used)
      await smallService.set('key4', 'value4');

      expect(await smallService.has('key1')).toBe(true);
      expect(await smallService.has('key2')).toBe(false); // evicted
      expect(await smallService.has('key3')).toBe(true);
      expect(await smallService.has('key4')).toBe(true);

      smallService.onModuleDestroy();
    });
  });

  describe('cache key helpers', () => {
    it('should generate correct project key', () => {
      expect(service.projectKey('proj-123')).toBe('project:proj-123');
    });

    it('should generate correct user projects key', () => {
      expect(service.userProjectsKey('user-456')).toBe(
        'user:user-456:projects',
      );
    });

    it('should generate correct themes key', () => {
      expect(service.themesKey()).toBe('themes:all');
    });

    it('should generate correct subscription key', () => {
      expect(service.subscriptionKey('user-789')).toBe('subscription:user-789');
    });

    it('should generate correct analytics key', () => {
      expect(service.analyticsKey('proj-123', '30d')).toBe(
        'analytics:proj-123:30d',
      );
    });
  });
});
