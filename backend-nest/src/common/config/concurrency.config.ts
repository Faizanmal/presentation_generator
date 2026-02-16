/**
 * Concurrency Configuration for Queue Processing
 * Optimized for handling maximum concurrent users
 */

export const ConcurrencyConfig = {
  // AI Generation Queue
  aiGeneration: {
    concurrency: Number.parseInt(
      process.env.AI_GENERATION_CONCURRENCY || '10',
      10,
    ),
    maxJobsPerWorker: 100,
    limiter: {
      max: 50, // Max jobs processed
      duration: 60000, // Per 60 seconds
    },
  },

  // Thinking Agent Queue (Most resource-intensive)
  thinkingGeneration: {
    concurrency: Number.parseInt(
      process.env.THINKING_QUEUE_CONCURRENCY || '5',
      10,
    ),
    maxJobsPerWorker: 50,
    limiter: {
      max: 20,
      duration: 60000,
    },
  },

  // Image Generation Queue (External API limited)
  imageGeneration: {
    concurrency: Number.parseInt(
      process.env.IMAGE_GENERATION_CONCURRENCY || '3',
      10,
    ),
    maxJobsPerWorker: 30,
    limiter: {
      max: 10,
      duration: 60000,
    },
  },

  // Export Queue (CPU intensive)
  export: {
    concurrency: Number.parseInt(process.env.EXPORT_CONCURRENCY || '8', 10),
    maxJobsPerWorker: 100,
    limiter: {
      max: 40,
      duration: 60000,
    },
  },

  // Email Queue (External service)
  email: {
    concurrency: Number.parseInt(process.env.EMAIL_CONCURRENCY || '20', 10),
    maxJobsPerWorker: 200,
    limiter: {
      max: 100,
      duration: 60000,
    },
  },

  // Collaboration Update Queue (High throughput)
  collaboration: {
    concurrency: Number.parseInt(
      process.env.COLLABORATION_CONCURRENCY || '50',
      10,
    ),
    maxJobsPerWorker: 500,
    limiter: {
      max: 500,
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
