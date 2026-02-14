import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    password?: string;
  };
}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');

    await app.init();

    prisma = app.get(PrismaService);

    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: '@test-e2e.com' } },
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({
          email: 'test-user@test-e2e.com',
          password: 'SecurePassword123!',
          name: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      const body = response.body as AuthResponse;
      expect(body.user.email).toBe('test-user@test-e2e.com');
      expect(body.user).not.toHaveProperty('password');

      authToken = body.access_token;
      testUserId = body.user.id;
    });

    it('should reject duplicate email', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({
          email: 'test-user@test-e2e.com',
          password: 'AnotherPassword123!',
          name: 'Another User',
        })
        .expect(409);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
          name: 'Test User',
        })
        .expect(400);
    });

    it('should reject weak password', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({
          email: 'weak-password@test-e2e.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({
          email: 'test-user@test-e2e.com',
          password: 'SecurePassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid password', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({
          email: 'test-user@test-e2e.com',
          password: 'WrongPassword123!',
        })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test-e2e.com',
          password: 'SomePassword123!',
        })
        .expect(401);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as AuthResponse['user'];
      expect(body.email).toBe('test-user@test-e2e.com');
      expect(body.name).toBe('Test User');
    });

    it('should reject request without token', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/auth/profile')
        .expect(401);
    });

    it('should reject invalid token', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
