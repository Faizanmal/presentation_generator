import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient, Prisma } from '@prisma/client';

export type ShardKey = string | number;

export interface ShardConfig {
  /**
   * Shard identifier
   */
  id: string;
  /**
   * Database connection string
   */
  url: string;
  /**
   * Shard range (for range-based sharding)
   */
  range?: {
    min: number;
    max: number;
  };
  /**
   * Is this shard read-only?
   */
  readOnly?: boolean;
  /**
   * Shard weight for weighted distribution
   */
  weight?: number;
}

export interface ShardingStrategy {
  /**
   * Determine which shard to use for a given key
   */
  getShard(key: ShardKey): string;
  /**
   * Get all shards for operations that need to query multiple shards
   */
  getAllShards(): string[];
  /**
   * Get shards by user ID or other criteria
   */
  getShardsByUser?(userId: string): string[];
}

/**
 * Database Sharding Service
 * Distributes data across multiple database instances for horizontal scalability
 */
@Injectable()
export class ShardingService implements OnModuleInit {
  private readonly logger = new Logger(ShardingService.name);
  private readonly shardingEnabled: boolean;
  private readonly shards: Map<string, PrismaClient> = new Map();
  private readonly shardConfigs: Map<string, ShardConfig> = new Map();
  private strategy!: ShardingStrategy; // will be initialized in onModuleInit

  constructor(private readonly configService: ConfigService) {
    this.shardingEnabled = this.configService.get<boolean>(
      'ENABLE_DB_SHARDING',
      false,
    );
  }

  async onModuleInit() {
    if (!this.shardingEnabled) {
      this.logger.log('DB Sharding is DISABLED');
      return;
    }

    this.logger.log('Initializing DB Sharding...');
    await this.initializeShards();
    this.initializeStrategy();
    this.logger.log(`DB Sharding initialized with ${this.shards.size} shards`);
  }

  /**
   * Initialize database shards
   */
  private async initializeShards() {
    const shardConfigJson = this.configService.get<string>(
      'DB_SHARD_CONFIG',
      '[]',
    );
    const configs: ShardConfig[] = JSON.parse(shardConfigJson);

    if (configs.length === 0) {
      // Default configuration: single shard (no actual sharding)
      const defaultUrl = this.configService.get<string>('DATABASE_URL', '');
      configs.push({
        id: 'shard_0',
        url: defaultUrl,
        weight: 1,
      });
    }

    for (const config of configs) {
      // casting to any because PrismaClientOptions typing is restrictive here
      // using any here since PrismaClientOptions type isn't exported cleanly
      const client = new PrismaClient({
        datasources: {
          db: {
            url: config.url,
          },
        },
      } as unknown as Prisma.PrismaClientOptions);

      await client.$connect();
      this.shards.set(config.id, client);
      this.shardConfigs.set(config.id, config);
      this.logger.log(`Connected to shard: ${config.id}`);
    }
  }

  /**
   * Initialize sharding strategy
   */
  private initializeStrategy() {
    const strategyType = this.configService.get<string>(
      'DB_SHARD_STRATEGY',
      'hash',
    );

    switch (strategyType) {
      case 'hash':
        this.strategy = new HashShardingStrategy(
          Array.from(this.shards.keys()),
        );
        break;
      case 'range':
        this.strategy = new RangeShardingStrategy(this.shardConfigs);
        break;
      case 'consistent-hash':
        this.strategy = new ConsistentHashShardingStrategy(
          Array.from(this.shards.keys()),
        );
        break;
      default:
        this.strategy = new HashShardingStrategy(
          Array.from(this.shards.keys()),
        );
    }

    this.logger.log(`Using sharding strategy: ${strategyType}`);
  }

  /**
   * Get Prisma client for a specific shard key
   * @param shardKey The key to determine shard (usually userId)
   * @returns PrismaClient for the appropriate shard
   */
  getShard(shardKey: ShardKey): PrismaClient {
    if (!this.shardingEnabled || this.shards.size === 0) {
      // Return the first (and likely only) shard
      return (
        (this.shards.values().next().value as PrismaClient) ||
        new PrismaClient()
      );
    }

    const shardId = this.strategy.getShard(shardKey);
    const shard = this.shards.get(shardId);

    if (!shard) {
      this.logger.error(
        `Shard not found: ${shardId}, falling back to first shard`,
      );
      return this.shards.values().next().value as PrismaClient; // non-null because at least one shard exists
    }

    return shard;
  }

  /**
   * Get specific shard by ID
   */
  getShardById(shardId: string): PrismaClient | undefined {
    return this.shards.get(shardId);
  }

  /**
   * Get all shard clients (for operations that need to query all shards)
   */
  getAllShards(): PrismaClient[] {
    return Array.from(this.shards.values());
  }

  /**
   * Execute a query across all shards and aggregate results
   */
  async executeAcrossShards<T>(
    query: (client: PrismaClient) => Promise<T[]>,
  ): Promise<T[]> {
    const results = await Promise.all(
      Array.from(this.shards.values()).map((client) => query(client)),
    );

    return results.flat();
  }

  /**
   * Execute a query on multiple shards in parallel
   */
  async executeOnShards<T>(
    shardKeys: ShardKey[],
    query: (client: PrismaClient, key: ShardKey) => Promise<T>,
  ): Promise<T[]> {
    const shardQueries = shardKeys.map((key) => {
      const shard = this.getShard(key);
      return query(shard, key);
    });

    return Promise.all(shardQueries);
  }

  /**
   * Get sharding statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    totalShards: number;
    strategy: string;
    shards: Array<{
      id: string;
      status: 'connected' | 'disconnected';
      readOnly: boolean;
    }>;
  }> {
    const shardStats = await Promise.all(
      Array.from(this.shardConfigs.entries()).map(async ([id, config]) => {
        const client = this.shards.get(id);
        let status: 'connected' | 'disconnected' = 'disconnected';

        if (client) {
          try {
            await client.$queryRaw`SELECT 1`;
            status = 'connected';
          } catch (_error) {
            // Connection failed
          }
        }

        return {
          id,
          status,
          readOnly: config.readOnly || false,
        };
      }),
    );

    return {
      enabled: this.shardingEnabled,
      totalShards: this.shards.size,
      strategy: this.configService.get<string>('DB_SHARD_STRATEGY', 'hash'),
      shards: shardStats,
    };
  }

  /**
   * Health check for all shards
   */
  async healthCheck(): Promise<boolean> {
    try {
      await Promise.all(
        Array.from(this.shards.values()).map(
          (client) => client.$queryRaw`SELECT 1`,
        ),
      );
      return true;
    } catch (error) {
      this.logger.error('Shard health check failed', error);
      return false;
    }
  }

  /**
   * Disconnect all shards
   */
  async disconnect(): Promise<void> {
    await Promise.all(
      Array.from(this.shards.values()).map((client) => client.$disconnect()),
    );
    this.shards.clear();
  }
}

/**
 * Hash-based sharding strategy (modulo)
 */
class HashShardingStrategy implements ShardingStrategy {
  constructor(private readonly shardIds: string[]) {}

  getShard(key: ShardKey): string {
    const hash = this.hashCode(String(key));
    const index = Math.abs(hash) % this.shardIds.length;
    return this.shardIds[index];
  }

  getAllShards(): string[] {
    return this.shardIds;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }
}

/**
 * Range-based sharding strategy
 */
class RangeShardingStrategy implements ShardingStrategy {
  private shardIds: string[];

  constructor(private readonly shardConfigs: Map<string, ShardConfig>) {
    this.shardIds = Array.from(shardConfigs.keys());
  }

  getShard(key: ShardKey): string {
    const numKey = typeof key === 'number' ? key : parseInt(String(key), 10);

    if (isNaN(numKey)) {
      // Fallback to hash for non-numeric keys
      return this.shardIds[0];
    }

    for (const [id, config] of this.shardConfigs.entries()) {
      if (
        config.range &&
        numKey >= config.range.min &&
        numKey <= config.range.max
      ) {
        return id;
      }
    }

    // Default to first shard
    return this.shardIds[0];
  }

  getAllShards(): string[] {
    return this.shardIds;
  }
}

/**
 * Consistent hashing strategy
 * Distributes keys more evenly and minimizes data movement when shards are added/removed
 */
class ConsistentHashShardingStrategy implements ShardingStrategy {
  private ring: Map<number, string> = new Map();
  private virtualNodes = 150; // Virtual nodes per shard

  constructor(private readonly shardIds: string[]) {
    this.buildRing();
  }

  private buildRing() {
    for (const shardId of this.shardIds) {
      for (let i = 0; i < this.virtualNodes; i++) {
        const virtualKey = `${shardId}:${i}`;
        const hash = this.hashCode(virtualKey);
        this.ring.set(hash, shardId);
      }
    }
  }

  getShard(key: ShardKey): string {
    const hash = this.hashCode(String(key));

    // Find the first node in the ring with hash >= key hash
    const sortedHashes = Array.from(this.ring.keys()).sort((a, b) => a - b);

    for (const nodeHash of sortedHashes) {
      if (nodeHash >= hash) {
        return this.ring.get(nodeHash)!;
      }
    }

    // Wrap around to the first node
    return this.ring.get(sortedHashes[0])!;
  }

  getAllShards(): string[] {
    return this.shardIds;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
