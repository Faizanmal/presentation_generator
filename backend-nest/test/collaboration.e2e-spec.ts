import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Collaboration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let testUserId: string;
  let collaboratorToken: string;
  let collaboratorUserId: string;
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

    // Create test owner
    const ownerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'collab-owner@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'Collab Owner',
      });

    authToken = ownerResponse.body.access_token;
    testUserId = ownerResponse.body.user.id;

    // Create test collaborator
    const collabResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'collaborator@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'Test Collaborator',
      });

    collaboratorToken = collabResponse.body.access_token;
    collaboratorUserId = collabResponse.body.user.id;

    // Create a test project
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Collaboration Test Project',
        description: 'A project for testing collaboration features',
      });

    testProjectId = projectResponse.body.id;
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (testProjectId) {
      await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {});
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {});
    }
    if (collaboratorUserId) {
      await prisma.user.delete({ where: { id: collaboratorUserId } }).catch(() => {});
    }
    await app.close();
  });

  describe('Collaborators', () => {
    let collaboratorId: string;

    describe('POST /api/collaboration/:projectId/collaborators', () => {
      it('should add a collaborator', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/collaborators`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: 'collaborator@test-e2e.com',
            role: 'EDITOR',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.role).toBe('EDITOR');
        collaboratorId = response.body.id;
      });

      it('should reject duplicate collaborator', async () => {
        await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/collaborators`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: 'collaborator@test-e2e.com',
            role: 'VIEWER',
          })
          .expect(409);
      });

      it('should reject invalid email', async () => {
        await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/collaborators`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            email: 'nonexistent@test-e2e.com',
            role: 'VIEWER',
          })
          .expect(404);
      });
    });

    describe('GET /api/collaboration/:projectId/collaborators', () => {
      it('should list collaborators', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/collaboration/${testProjectId}/collaborators`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });
    });

    describe('PATCH /api/collaboration/:projectId/collaborators/:id', () => {
      it('should update collaborator role', async () => {
        const response = await request(app.getHttpServer())
          .patch(`/api/collaboration/${testProjectId}/collaborators/${collaboratorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            role: 'VIEWER',
          })
          .expect(200);

        expect(response.body.role).toBe('VIEWER');
      });
    });

    describe('DELETE /api/collaboration/:projectId/collaborators/:id', () => {
      it('should remove collaborator', async () => {
        await request(app.getHttpServer())
          .delete(`/api/collaboration/${testProjectId}/collaborators/${collaboratorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });
    });
  });

  describe('Comments', () => {
    let commentId: string;

    describe('POST /api/collaboration/:projectId/comments', () => {
      it('should create a comment', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: 'This is a test comment',
          })
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.content).toBe('This is a test comment');
        commentId = response.body.id;
      });
    });

    describe('GET /api/collaboration/:projectId/comments', () => {
      it('should list comments', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/collaboration/${testProjectId}/comments`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });
    });

    describe('POST /api/collaboration/:projectId/comments/:id/resolve', () => {
      it('should resolve a comment', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/comments/${commentId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.resolved).toBe(true);
      });
    });

    describe('DELETE /api/collaboration/:projectId/comments/:id', () => {
      it('should delete a comment', async () => {
        await request(app.getHttpServer())
          .delete(`/api/collaboration/${testProjectId}/comments/${commentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });
    });
  });

  describe('Versions', () => {
    let versionNumber: number;

    describe('POST /api/collaboration/:projectId/versions', () => {
      it('should create a version', async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/collaboration/${testProjectId}/versions`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            snapshot: { slides: [] },
            message: 'Initial version',
          })
          .expect(201);

        expect(response.body).toHaveProperty('version');
        versionNumber = response.body.version;
      });
    });

    describe('GET /api/collaboration/:projectId/versions', () => {
      it('should list versions', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/collaboration/${testProjectId}/versions`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
      });
    });

    describe('GET /api/collaboration/:projectId/versions/:version', () => {
      it('should get a specific version', async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/collaboration/${testProjectId}/versions/${versionNumber}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.version).toBe(versionNumber);
      });
    });
  });
});
