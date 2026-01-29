import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;
  let testProjectId: string;

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
        email: 'projects-test@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'Projects Test User',
      });

    authToken = registerResponse.body.access_token;
    testUserId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Project',
          description: 'A test project for e2e testing',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Test Project');
      expect(response.body.description).toBe('A test project for e2e testing');

      testProjectId = response.body.id;
    });

    it('should reject project creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          title: 'Unauthorized Project',
        })
        .expect(401);
    });
  });

  describe('GET /api/projects', () => {
    it('should list user projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].title).toBe('Test Project');
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/projects?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should get a specific project', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testProjectId);
      expect(response.body.title).toBe('Test Project');
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/projects/:id', () => {
    it('should update a project', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test Project',
          description: 'Updated description',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Test Project');
      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('POST /api/projects/:id/duplicate', () => {
    it('should duplicate a project', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/projects/${testProjectId}/duplicate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.title).toContain('Copy');
      expect(response.body.id).not.toBe(testProjectId);

      // Clean up duplicated project
      await prisma.project.delete({ where: { id: response.body.id } }).catch(() => {});
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      // Create a project to delete
      const createResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Project to Delete' });

      const projectToDeleteId = createResponse.body.id;

      await request(app.getHttpServer())
        .delete(`/api/projects/${projectToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(app.getHttpServer())
        .get(`/api/projects/${projectToDeleteId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
