export class JwtService {
  sign(payload: string | Buffer | object, options?: any): string {
    return 'mock-jwt-token';
  }

  signAsync(payload: string | Buffer | object, options?: any): Promise<string> {
    return Promise.resolve('mock-jwt-token');
  }

  verify<T extends object = any>(token: string, options?: any): T {
    return { sub: 'mock-user-id', email: 'test@example.com' } as unknown as T;
  }

  verifyAsync<T extends object = any>(token: string, options?: any): Promise<T> {
    return Promise.resolve({ sub: 'mock-user-id', email: 'test@example.com' } as unknown as T);
  }

  decode(token: string, options?: any): any {
    return { sub: 'mock-user-id', email: 'test@example.com' };
  }
}

export class JwtModule {
  static register(...args: any[]) {
    return {
      module: JwtModule,
      providers: [JwtService],
      exports: [JwtService],
    };
  }

  static registerAsync(...args: any[]) {
    return {
      module: JwtModule,
      providers: [JwtService],
      exports: [JwtService],
    };
  }
}
