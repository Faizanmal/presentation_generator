/**
 * New Relic Initialization Module
 * Must be required at the very top of the application before any other modules
 */

export function initializeNewRelic(): void {
  if (process.env.NEW_RELIC_ENABLED === 'true') {
    try {
      // `require` is used intentionally here because New Relic must be loaded
      // synchronously before the application starts. eslint rule waived for this line.
      require('newrelic');
      console.log('✓ New Relic monitoring initialized');
    } catch (error) {
      console.warn(
        '⚠ New Relic initialization failed:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}

/**
 * Middleware for custom New Relic transactions
 */
export function createNewRelicMiddleware() {
  return (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    if (process.env.NEW_RELIC_ENABLED === 'true') {
      try {
        const newrelic = require('newrelic');
        const transactionName = `${req.method} ${req.path}`;

        newrelic.setTransactionName(transactionName);

        // Add custom attributes
        newrelic.addCustomAttribute('user_id', (req.user as any)?.id);
        newrelic.addCustomAttribute(
          'tenant_id',
          (req.user as any)?.organizationId,
        );
        newrelic.addCustomAttribute('ip_address', req.ip);
      } catch (error) {
        // Fail silently
      }
    }
    next();
  };
}

/**
 * Decorator for tracking custom NestJS segments in New Relic
 */
export function TrackNewRelic(segmentName: string) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (process.env.NEW_RELIC_ENABLED !== 'true') {
      return descriptor;
    }

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        const newrelic = require('newrelic');
        // `newrelic.startWebTransaction` typing is not strict here — treat as unknown and forward.
        return await newrelic.startWebTransaction(segmentName, async () => {
          return await originalMethod.apply(this, args as any[]);
        });
      } catch (error) {
        // If New Relic fails, still execute the original method
        return await originalMethod.apply(this, args as any[]);
      }
    };

    return descriptor;
  };
}
