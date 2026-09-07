import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Memory (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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
    await app.init();

    // Register and login
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: `memory-e2e-${Date.now()}@example.com`,
        password: 'SecureP@ss123',
        name: 'Memory E2E Test User',
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD Operations', () => {
    let memoryId: string;

    it('should create a memory', () => {
      return request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test memory content',
          type: 'NOTE',
          source: 'NATIVE_APP',
          tags: ['test', 'e2e'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.content).toBe('Test memory content');
          memoryId = res.body.id;
        });
    });

    it('should get all memories', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('should get memory by id', () => {
      return request(app.getHttpServer())
        .get(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(memoryId);
        });
    });

    it('should update memory', () => {
      return request(app.getHttpServer())
        .put(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Updated memory content',
          tags: ['updated', 'test'],
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.content).toBe('Updated memory content');
        });
    });

    it('should delete memory', () => {
      return request(app.getHttpServer())
        .delete(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('Search', () => {
    beforeAll(async () => {
      // Create test memories
      await request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Meeting with John about the project',
          type: 'MESSAGE',
          source: 'WHATSAPP',
        });

      await request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Buy groceries tomorrow',
          type: 'TASK',
          source: 'NATIVE_APP',
        });
    });

    it('should search memories', () => {
      return request(app.getHttpServer())
        .get('/memory/search?q=meeting')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter by type', () => {
      return request(app.getHttpServer())
        .get('/memory?type=TASK')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });

    it('should filter by source', () => {
      return request(app.getHttpServer())
        .get('/memory?source=WHATSAPP')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
        });
    });
  });

  describe('Statistics', () => {
    it('should return memory statistics', () => {
      return request(app.getHttpServer())
        .get('/memory/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('byType');
          expect(res.body).toHaveProperty('bySource');
        });
    });

    it('should return recent memories', () => {
      return request(app.getHttpServer())
        .get('/memory/recent?limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return frequently accessed memories', () => {
      return request(app.getHttpServer())
        .get('/memory/frequent?limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Authorization', () => {
    it('should fail without token', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should fail to access other user memory', async () => {
      // Create memory with first user
      const createRes = await request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Private memory',
          type: 'NOTE',
        });
      const memoryId = createRes.body.id;

      // Register second user
      const user2Res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `user2-${Date.now()}@example.com`,
          password: 'SecureP@ss123',
        });
      const user2Token = user2Res.body.accessToken;

      // Try to access first user's memory
      return request(app.getHttpServer())
        .get(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(403);
    });
  });

  describe('Validation', () => {
    it('should fail with invalid memory type', () => {
      return request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test',
          type: 'INVALID_TYPE',
        })
        .expect(400);
    });

    it('should fail with empty content', () => {
      return request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: '',
          type: 'NOTE',
        })
        .expect(400);
    });
  });
});
