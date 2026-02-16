import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BrandKit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;
  let testBrandKitId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user and get auth token
    const testUser = await prisma.user.create({
      data: {
        email: `brandkit-test-${Date.now()}@example.com`,
        name: 'Brand Kit Test User',
        password: 'hashed-password',
      },
    });
    testUserId = testUser.id;

    // Generate a test JWT token (in real tests, use proper auth flow)
    const authResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'test-password',
      });

    // If auth doesn't work in test, create a mock token
    authToken = authResponse.body.access_token || 'test-token';
  });

  afterAll(async () => {
    // Cleanup
    if (testBrandKitId) {
      await prisma.brandKit.deleteMany({ where: { userId: testUserId } });
    }
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    await app.close();
  });

  describe('POST /brand-kits', () => {
    it('should create a new brand kit', async () => {
      const brandKitData = {
        name: 'Test Brand',
        primaryColor: '#3b82f6',
        secondaryColor: '#64748b',
        headingFont: 'Inter',
        bodyFont: 'Open Sans',
      };

      const response = await request(app.getHttpServer())
        .post('/brand-kits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(brandKitData)
        .expect(201);

      expect(response.body).toBeDefined();
      expect(response.body.name).toBe('Test Brand');
      expect(response.body.primaryColor).toBe('#3b82f6');

      testBrandKitId = response.body.id;
    });

    it('should create a brand kit with full data', async () => {
      const fullBrandKitData = {
        name: 'Full Brand Kit',
        isDefault: false,
        primaryColor: '#1a1a1a',
        secondaryColor: '#666666',
        accentColor: '#ff6b6b',
        backgroundColor: '#ffffff',
        textColor: '#333333',
        colorPalette: ['#1a1a1a', '#666666', '#ff6b6b'],
        headingFont: 'Poppins',
        bodyFont: 'Inter',
        fontSizes: { base: '16px', lg: '20px' },
        logoUrl: 'https://example.com/logo.png',
        voiceDescription: 'Professional and friendly',
        toneKeywords: ['professional', 'modern'],
        doList: ['Use active voice'],
        dontList: ['Use jargon'],
      };

      const response = await request(app.getHttpServer())
        .post('/brand-kits')
        .set('Authorization', `Bearer ${authToken}`)
        .send(fullBrandKitData)
        .expect(201);

      expect(response.body.voiceDescription).toBe('Professional and friendly');
      expect(response.body.toneKeywords).toContain('professional');
    });

    it('should reject request without authentication', async () => {
      await request(app.getHttpServer())
        .post('/brand-kits')
        .send({ name: 'Unauthorized Brand' })
        .expect(401);
    });
  });

  describe('GET /brand-kits', () => {
    it('should return all brand kits for user', async () => {
      const response = await request(app.getHttpServer())
        .get('/brand-kits')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /brand-kits/:id', () => {
    it('should return a specific brand kit', async () => {
      const response = await request(app.getHttpServer())
        .get(`/brand-kits/${testBrandKitId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testBrandKitId);
      expect(response.body.name).toBe('Test Brand');
    });

    it('should return 404 for non-existent brand kit', async () => {
      await request(app.getHttpServer())
        .get('/brand-kits/nonexistent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /brand-kits/:id/theme', () => {
    it('should return brand kit as theme object', async () => {
      const response = await request(app.getHttpServer())
        .get(`/brand-kits/${testBrandKitId}/theme`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('primaryColor');
      expect(response.body).toHaveProperty('headingFont');
    });
  });

  describe('PUT /brand-kits/:id', () => {
    it('should update a brand kit', async () => {
      const response = await request(app.getHttpServer())
        .put(`/brand-kits/${testBrandKitId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated Brand Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Brand Name');
    });
  });

  describe('PUT /brand-kits/:id/default', () => {
    it('should set brand kit as default', async () => {
      const response = await request(app.getHttpServer())
        .put(`/brand-kits/${testBrandKitId}/default`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isDefault).toBe(true);
    });
  });

  describe('GET /brand-kits/default', () => {
    it('should return the default brand kit', async () => {
      const response = await request(app.getHttpServer())
        .get('/brand-kits/default')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isDefault).toBe(true);
    });
  });

  describe('POST /brand-kits/:id/duplicate', () => {
    it('should duplicate a brand kit', async () => {
      const response = await request(app.getHttpServer())
        .post(`/brand-kits/${testBrandKitId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Duplicated Brand' })
        .expect(201);

      expect(response.body.name).toBe('Duplicated Brand');
      expect(response.body.id).not.toBe(testBrandKitId);
    });
  });

  describe('DELETE /brand-kits/:id', () => {
    it('should delete a brand kit', async () => {
      // First create a brand kit to delete
      const createResponse = await request(app.getHttpServer())
        .post('/brand-kits')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'To Delete' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/brand-kits/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify it's deleted
      await request(app.getHttpServer())
        .get(`/brand-kits/${createResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
