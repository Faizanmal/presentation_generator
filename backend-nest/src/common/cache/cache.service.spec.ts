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

  afterEach(() => {
    service.clear();
    service.onModuleDestroy();
  });

  describe('set and get', () => {
    it('should store and retrieve a value', () => {
      service.set('test-key', { value: 'test-data' });
      const result = service.get('test-key');

      expect(result).toEqual({ value: 'test-data' });
    });

    it('should return null for non-existent key', () => {
      const result = service.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect TTL', async () => {
      service.set('short-ttl', 'value', 1); // 1 second TTL

      const immediate = service.get('short-ttl');
      expect(immediate).toBe('value');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const expired = service.get('short-ttl');
      expect(expired).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a key', () => {
      service.set('to-delete', 'value');
      const deleted = service.delete('to-delete');

      expect(deleted).toBe(true);
      expect(service.get('to-delete')).toBeNull();
    });

    it('should return false for non-existent key', () => {
      const deleted = service.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deletePattern', () => {
    it('should delete keys matching pattern', () => {
      service.set('user:1:data', 'data1');
      service.set('user:2:data', 'data2');
      service.set('project:1:data', 'data3');

      const count = service.deletePattern('user:*');

      expect(count).toBe(2);
      expect(service.get('user:1:data')).toBeNull();
      expect(service.get('user:2:data')).toBeNull();
      expect(service.get('project:1:data')).toBe('data3');
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if exists', async () => {
      service.set('cached', 'existing-value');

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
      const cached = service.get('not-cached');
      expect(cached).toBe('new-value');
    });
  });

  describe('has', () => {
    it('should return true for existing key', () => {
      service.set('exists', 'value');
      expect(service.has('exists')).toBe(true);
    });

    it('should return false for non-existent key', () => {
      expect(service.has('not-exists')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all keys', () => {
      service.set('key1', 'value1');
      service.set('key2', 'value2');

      const keys = service.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('should filter keys by pattern', () => {
      service.set('user:1', 'value1');
      service.set('user:2', 'value2');
      service.set('project:1', 'value3');

      const keys = service.keys('user:*');
      expect(keys).toContain('user:1');
      expect(keys).toContain('user:2');
      expect(keys).not.toContain('project:1');
    });
  });

  describe('stats', () => {
    it('should track cache statistics', () => {
      service.set('key', 'value');

      service.get('key'); // hit
      service.get('key'); // hit
      service.get('missing'); // miss

      const stats = service.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used when at capacity', () => {
      // Create a service with small max size
      const smallService = new CacheService({
        defaultTTL: 3600,
        maxSize: 3,
      });

      smallService.set('key1', 'value1');
      smallService.set('key2', 'value2');
      smallService.set('key3', 'value3');

      // Access key1 to make it recently used
      smallService.get('key1');

      // Add a fourth key, should evict key2 (least recently used)
      smallService.set('key4', 'value4');

      expect(smallService.has('key1')).toBe(true);
      expect(smallService.has('key2')).toBe(false); // evicted
      expect(smallService.has('key3')).toBe(true);
      expect(smallService.has('key4')).toBe(true);

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
