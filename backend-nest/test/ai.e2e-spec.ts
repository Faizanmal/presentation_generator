import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AI Generation (e2e)', () => {
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

    // Create a test user and get auth token
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'ai-test@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'AI Test User',
      });

    authToken = registerResponse.body.access_token;
    testUserId = registerResponse.body.user.id;
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/ai/generate', () => {
    it('should generate presentation outline', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          topic: 'Introduction to Machine Learning',
          tone: 'professional',
          audience: 'developers',
          length: 5,
          type: 'presentation',
        })
        .expect(201);

      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('sections');
      expect(Array.isArray(response.body.sections)).toBe(true);
    }, 60000);

    it('should reject without topic', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tone: 'professional',
          audience: 'developers',
        })
        .expect(400);
    });

    it('should reject without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/generate')
        .send({
          topic: 'Test Topic',
        })
        .expect(401);
    });
  });

  describe('POST /api/ai/enhance', () => {
    it('should enhance text content', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          text: 'This is a simple sentence that needs improvement.',
          action: 'professional',
        })
        .expect(201);

      expect(response.body).toHaveProperty('enhancedText');
      expect(typeof response.body.enhancedText).toBe('string');
    }, 30000);

    it('should support different enhancement actions', async () => {
      const actions = ['shorten', 'expand', 'simplify', 'professional'];

      for (const action of actions) {
        const response = await request(app.getHttpServer())
          .post('/api/ai/enhance')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            text: 'Sample text for enhancement testing.',
            action,
          });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('enhancedText');
      }
    }, 120000);
  });

  describe('POST /api/ai/suggest-layout', () => {
    it('should suggest a layout for content', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/ai/suggest-layout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content:
            'Introduction to our new product with key features and benefits',
          slideType: 'content',
        })
        .expect(201);

      expect(response.body).toHaveProperty('layout');
      expect(response.body).toHaveProperty('confidence');
    }, 30000);
  });

  describe('GET /api/ai/usage', () => {
    it('should return AI usage statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/ai/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('used');
      expect(response.body).toHaveProperty('limit');
      expect(response.body).toHaveProperty('remaining');
    });
  });
});
