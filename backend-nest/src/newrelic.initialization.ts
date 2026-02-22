/**
 * New Relic Initialization Module
 * Must be loaded at the very top of the application before any other modules.
 *
 * New Relic is an optional runtime dependency. We load it via `createRequire`
 * (a Node.js built-in) so that the ESLint `no-require-imports` rule is satisfied
 * while still performing a synchronous CJS load as New Relic requires.
 */
import { createRequire } from 'module';

// Minimal typed interface for the New Relic API surface we actually use.
interface NewRelicApi {
  setTransactionName(name: string): void;
  addCustomAttribute(
    key: string,
    value: string | number | boolean | undefined,
  ): void;
  startWebTransaction<T>(url: string, handler: () => Promise<T>): Promise<T>;
}

const cjsRequire = createRequire(import.meta.url);

function loadNewRelic(): NewRelicApi | null {
  try {
    return cjsRequire('newrelic') as NewRelicApi;
  } catch {
    return null;
  }
}

export function initializeNewRelic(): void {
  if (process.env.NEW_RELIC_ENABLED === 'true') {
    const nr = loadNewRelic();
    if (nr) {
      console.log('✓ New Relic monitoring initialized');
    } else {
      console.warn('⚠ New Relic initialization failed: package not available');
    }
  }
}

/**
 * Middleware for custom New Relic transactions
 */
export function createNewRelicMiddleware() {
  return (
    req: import('express').Request,
    _res: import('express').Response,
    next: import('express').NextFunction,
  ) => {
    if (process.env.NEW_RELIC_ENABLED === 'true') {
      const nr = loadNewRelic();
      if (nr) {
        const transactionName = `${req.method} ${req.path}`;

        nr.setTransactionName(transactionName);

        // Add custom attributes
        nr.addCustomAttribute(
          'user_id',
          (req.user as unknown as { id?: string })?.id,
        );
        nr.addCustomAttribute(
          'tenant_id',
          (req.user as unknown as { organizationId?: string })?.organizationId,
        );
        nr.addCustomAttribute('ip_address', req.ip);
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
    _target: object,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    if (process.env.NEW_RELIC_ENABLED !== 'true') {
      return descriptor;
    }

    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;

    descriptor.value = async function (...args: unknown[]) {
      const nr = loadNewRelic();
      if (nr) {
        return nr.startWebTransaction(segmentName, () => {
          return originalMethod.apply(this, args) as Promise<unknown>;
        });
      }
      // If New Relic is unavailable, still execute the original method
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
