/**
 * Free-tier Redis (Render Key Value) has ~50 connections and 25 MB.
 * Each BullMQ Queue opens 1 connection; each Worker typically opens 2+.
 * Enable REDIS_LOW_LOAD=true to keep usage under that ceiling.
 */

const ESSENTIAL_QUEUES = new Set([
  'email',
  'thinking-generation',
  'image-generation',
  'generation',
  'presentation-generation',
  'image-acquisition',
]);

export function isRedisLowLoad(): boolean {
  const flag = process.env.REDIS_LOW_LOAD;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  // Default on for production hosts that look like free managed Redis
  return process.env.NODE_ENV === 'production';
}

export function isEssentialQueue(name: string): boolean {
  return ESSENTIAL_QUEUES.has(name);
}

/** Skip non-essential Bull queues/workers under low-load mode. */
export function shouldRegisterQueue(name: string): boolean {
  return !isRedisLowLoad() || isEssentialQueue(name);
}

export function shouldRegisterProcessor(name: string): boolean {
  return shouldRegisterQueue(name);
}

/** BullMQ worker concurrency — 1 under low load to minimize blocking connections. */
export function redisAwareConcurrency(defaultValue: number): number {
  if (isRedisLowLoad()) return 1;
  return defaultValue;
}
