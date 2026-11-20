export const AuthGuard = (type?: string | string[]) => {
  return class MockAuthGuard {
    canActivate() {
      return true;
    }
  };
};

export const PassportStrategy = (Strategy: any, name?: string) => {
  return class MockPassportStrategy {
    validate(...args: any[]) {
      return { id: 'mock-user-id', email: 'test@example.com' };
    }
  };
};

export class PassportModule {
  static register(...args: any[]) {
    return {
      module: PassportModule,
      providers: [],
      exports: [],
    };
  }
}
