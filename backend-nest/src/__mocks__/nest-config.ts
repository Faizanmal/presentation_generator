export class ConfigService {
  private values: Record<string, any> = {
    JWT_SECRET: 'test-jwt-secret-key-12345',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
    PORT: 4000,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:3000',
    STRIPE_SECRET_KEY: 'sk_test_mock',
    REDIS_URL: 'redis://localhost:6379',
  };

  constructor(custom?: Record<string, any>) {
    if (custom) {
      Object.assign(this.values, custom);
    }
  }

  get<T = any>(key: string, defaultValue?: T): T {
    return (this.values[key] ?? process.env[key] ?? defaultValue) as T;
  }

  getOrThrow<T = any>(key: string): T {
    const val = this.get<T>(key);
    if (val === undefined || val === null) {
      return (defaultValueForKey(key) ?? (key as unknown)) as T;
    }
    return val;
  }
}

function defaultValueForKey(key: string): any {
  if (key.includes('PORT')) return 4000;
  if (key.includes('SECRET') || key.includes('KEY')) return 'test-mock-secret';
  if (key.includes('URL')) return 'http://localhost:3000';
  return 'test-value';
}

export class ConfigModule {
  static forRoot() {
    return {
      module: ConfigModule,
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}

export const registerAs = (token: string, fn: () => any) => fn;
