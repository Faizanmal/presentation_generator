/**
 * Concurrency Configuration for Queue Processing
 * Optimized for handling maximum concurrent users
 */

import { isRedisLowLoad, redisAwareConcurrency } from './redis-load.config';

const lowLoad = isRedisLowLoad();

export const ConcurrencyConfig = {
  // AI Generation Queue
  aiGeneration: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.AI_GENERATION_CONCURRENCY || '10', 10),
    ),
    maxJobsPerWorker: lowLoad ? 20 : 100,
    limiter: {
      max: lowLoad ? 5 : 50,
      duration: 60000,
    },
  },

  // Thinking Agent Queue (Most resource-intensive)
  thinkingGeneration: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.THINKING_QUEUE_CONCURRENCY || '5', 10),
    ),
    maxJobsPerWorker: lowLoad ? 10 : 50,
    limiter: {
      max: lowLoad ? 3 : 20,
      duration: 60000,
    },
  },

  // Image Generation Queue (External API limited)
  imageGeneration: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.IMAGE_GENERATION_CONCURRENCY || '3', 10),
    ),
    maxJobsPerWorker: lowLoad ? 10 : 30,
    limiter: {
      max: lowLoad ? 3 : 10,
      duration: 60000,
    },
  },

  // Export Queue (CPU intensive)
  export: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.EXPORT_CONCURRENCY || '8', 10),
    ),
    maxJobsPerWorker: lowLoad ? 20 : 100,
    limiter: {
      max: lowLoad ? 5 : 40,
      duration: 60000,
    },
  },

  // Email Queue (External service)
  email: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.EMAIL_CONCURRENCY || '20', 10),
    ),
    maxJobsPerWorker: lowLoad ? 20 : 200,
    limiter: {
      max: lowLoad ? 10 : 100,
      duration: 60000,
    },
  },

  // Collaboration Update Queue (High throughput)
  collaboration: {
    concurrency: redisAwareConcurrency(
      Number.parseInt(process.env.COLLABORATION_CONCURRENCY || '50', 10),
    ),
    maxJobsPerWorker: lowLoad ? 50 : 500,
    limiter: {
      max: lowLoad ? 50 : 500,
      duration: 60000,
    },
  },
};

/**
 * Database connection pool configuration
 */
export const DatabasePoolConfig = {
  // PostgreSQL connection pool
  connectionLimit: Number.parseInt(process.env.DB_POOL_SIZE || '50', 10),
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  maxUses: 7500,
  allowExitOnIdle: false,
};

/**
 * Redis connection pool configuration
 */
export const RedisPoolConfig = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  maxLoadingRetryTime: 10000,
  connectTimeout: 10000,
  // Cluster mode for high availability
  clusterRetryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

/**
 * WebSocket scalability configuration
 */
export const WebSocketConfig = {
  // Max connections per server instance
  maxConnectionsPerInstance: Number.parseInt(
    process.env.WS_MAX_CONNECTIONS || '10000',
    10,
  ),
  // Ping interval to keep connections alive
  pingInterval: 25000,
  pingTimeout: 5000,
  // Enable compression for large payloads
  perMessageDeflate: {
    threshold: 1024, // Compress messages larger than 1KB
  },
  // Transports priority
  transports: ['websocket', 'polling'],
  // Upgrade timeout
  upgradeTimeout: 10000,
};

/**
 * Cache TTL configuration (in seconds)
 */
export const CacheTTLConfig = {
  // User session data
  userSession: 3600, // 1 hour
  // Project metadata (frequently accessed)
  projectMetadata: 300, // 5 minutes
  // Block data (very frequently accessed in collaboration)
  blockData: 60, // 1 minute
  // Slide data
  slideData: 120, // 2 minutes
  // Theme data (rarely changes)
  themeData: 86400, // 24 hours
  // User profile
  userProfile: 1800, // 30 minutes
  // AI generation results (temporary)
  aiGeneration: 600, // 10 minutes
  // Rate limit counters
  rateLimit: 60, // 1 minute
  // Collaboration sessions
  collaborationSession: 1800, // 30 minutes
};
