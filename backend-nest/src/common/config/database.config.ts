/**
 * Database Configuration with Connection Pooling
 * Optimized for high-concurrency workloads
 *
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - DB_POOL_MIN: Minimum connections (default: 10)
 * - DB_POOL_MAX: Maximum connections (default: 100)
 * - DB_IDLE_TIMEOUT: Idle timeout in ms (default: 30000)
 * - DB_CONNECTION_TIMEOUT: Connection timeout in ms (default: 30000)
 */

export const DatabaseConfig = {
  // Connection pool size
  pool: {
    min: Number.parseInt(process.env.DB_POOL_MIN || '10', 10),
    max: Number.parseInt(process.env.DB_POOL_MAX || '100', 10),
  },

  // Timeouts
  connectionTimeoutMillis: Number.parseInt(
    process.env.DB_CONNECTION_TIMEOUT || '30000',
    10,
  ),
  idleTimeoutMillis: Number.parseInt(
    process.env.DB_IDLE_TIMEOUT || '30000',
    10,
  ),
  statementTimeout: Number.parseInt(
    process.env.DB_STATEMENT_TIMEOUT || '60000',
    10,
  ),

  // Performance settings
  log: ['error', 'warn'],
  maxRetriesAttempts: 3,
  retryDelay: 3000,

  // Query optimization
  queryRawOptions: {
    // Use prepared statements for better performance
    preparedStatements: true,
  },
};

/**
 * Prisma datasource configuration for schema.prisma
 *
 * Add these to your schema.prisma:
 *
 * datasource db {
 *   provider = "postgresql"
 *   url      = env("DATABASE_URL")
 *   shadowDatabaseUrl = env("SHADOW_DATABASE_URL") // For migrations
 *   relationMode = "prisma" // For better compatibility
 * }
 */

/**
 * Database indexes for optimal query performance
 * These should be added via Prisma migrations
 */
export const RecommendedIndexes = {
  projects: [
    'idx_projects_owner_created',
    'idx_projects_owner_updated',
    'idx_projects_subscription_tier',
  ],
  slides: ['idx_slides_project_order', 'idx_slides_project_created'],
  blocks: [
    'idx_blocks_project_slide',
    'idx_blocks_project_version',
    'idx_blocks_type',
  ],
  collaboration_sessions: [
    'idx_collab_project_active',
    'idx_collab_user_active',
    'idx_collab_socket_id',
  ],
  users: ['idx_users_email', 'idx_users_subscription', 'idx_users_created'],
};

/**
 * Query optimization tips
 */
export const QueryOptimizationTips = {
  // Use select to limit fields
  selectOnlyNeeded: true,

  // Use cursor-based pagination for large datasets
  useCursorPagination: true,

  // Batch operations where possible
  useBatchOperations: true,

  // Use transactions for multiple related operations
  useTransactions: true,

  // Cache frequently accessed read-only data
  cacheStaticData: true,
};
