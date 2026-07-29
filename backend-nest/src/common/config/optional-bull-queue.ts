import { DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { shouldRegisterQueue } from './redis-load.config';

/**
 * Registers a BullMQ queue only when Redis load policy allows it.
 * Returns an empty array when skipped so modules can spread it into imports.
 */
export function optionalBullQueue(
  name: string,
  options?: Omit<Parameters<typeof BullModule.registerQueue>[0], 'name'>,
): DynamicModule[] {
  if (!shouldRegisterQueue(name)) {
    return [];
  }

  return [
    BullModule.registerQueue({
      name,
      ...options,
    }),
  ];
}
