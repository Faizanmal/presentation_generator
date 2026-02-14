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
  };
}

interface ProjectResponse {
  id: string;
  title: string;
  slides?: any[];
}

describe('Export (e2e)', () => {
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

    // Create a test user and project
    const registerResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/register')
      .send({
        email: 'export-test@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'Export Test User',
      });

    const body = registerResponse.body as AuthResponse;
    authToken = body.access_token;
    testUserId = body.user.id;

    // Create a test project with slides
    const projectResponse = await request(app.getHttpServer() as Server)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Export Test Project',
        description: 'Project for testing exports',
      });

    const projectBody = projectResponse.body as ProjectResponse;
    testProjectId = projectBody.id;

    // Add some slides
    await request(app.getHttpServer() as Server)
      .post(`/api/projects/${testProjectId}/slides`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Slide 1',
        order: 0,
      });

    await request(app.getHttpServer() as Server)
      .post(`/api/projects/${testProjectId}/slides`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Slide 2',
        order: 1,
      });
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await prisma.project
        .delete({ where: { id: testProjectId } })
        .catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/export/:projectId/json', () => {
    it('should export project as JSON', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/api/export/${testProjectId}/json`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const body = response.body as ProjectResponse;
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('slides');
      expect(Array.isArray(body.slides)).toBe(true);
    });
  });

  describe('POST /api/export/:projectId/html', () => {
    it('should export project as HTML', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/api/export/${testProjectId}/html`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('<!DOCTYPE html>');
      expect(response.text).toContain('Export Test Project');
    });
  });

  describe('POST /api/export/:projectId/pdf', () => {
    it('should export project as PDF', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/api/export/${testProjectId}/pdf`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toBeDefined();
    }, 30000);
  });

  describe('POST /api/export/:projectId/pptx', () => {
    it('should export project as PowerPoint', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post(`/api/export/${testProjectId}/pptx`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      );
      expect(response.body).toBeDefined();
    }, 30000);
  });

  describe('Error handling', () => {
    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/export/non-existent-id/json')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer() as Server)
        .post(`/api/export/${testProjectId}/json`)
        .expect(401);
    });
  });
});
