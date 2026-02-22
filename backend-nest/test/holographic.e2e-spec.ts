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

interface ProjectItem {
  id: string;
  title: string;
}

describe('Holographic (e2e)', () => {
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

    // create user
    const registerResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/register')
      .send({
        email: 'holographic-test@test-e2e.com',
        password: 'SecurePassword123!',
        name: 'Holographic Test',
      });

    const body = registerResponse.body as AuthResponse;
    authToken = body.access_token;
    testUserId = body.user.id;

    // create a project to reference
    const projectResp = await request(app.getHttpServer() as Server)
      .post('/api/projects')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Holo Project' })
      .expect(201);
    testProjectId = (projectResp.body as ProjectItem).id;
  });

  afterAll(async () => {
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

  describe('POST /api/holographic/preview', () => {
    it('accepts valid payload and returns preview object', async () => {
      const resp = await request(app.getHttpServer() as Server)
        .post('/api/holographic/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ projectId: testProjectId })
        .expect(201);

      expect(resp.body).toHaveProperty('id');
      expect(resp.body.projectId).toBe(testProjectId);
    });

    it('rejects unknown properties', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/holographic/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectId: testProjectId,
          unexpected: 'value',
        })
        .expect(400);
    });
  });
});
