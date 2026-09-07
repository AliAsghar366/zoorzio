import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'healthy');
          expect(res.body).toHaveProperty('service', 'anchor-api');
        });
    });

    it('/health/detailed (GET)', () => {
      return request(app.getHttpServer())
        .get('/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('checks');
          expect(res.body.checks).toHaveProperty('database');
        });
    });
  });

  describe('Auth', () => {
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      password: 'SecureP@ss123',
      name: 'Test User',
    };

    it('/auth/register (POST)', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.user.email).toBe(testUser.email);
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('/auth/login (POST)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('/auth/me (GET)', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testUser.email);
        });
    });

    it('/auth/refresh (POST)', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.accessToken;
          refreshToken = res.body.refreshToken;
        });
    });

    it('/auth/logout (POST)', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });
  });

  describe('Memory', () => {
    let memoryId: string;

    beforeAll(async () => {
      // Register and login to get token
      const email = `memory-test-${Date.now()}@example.com`;
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecureP@ss123',
          name: 'Memory Test User',
        });
      accessToken = registerRes.body.accessToken;
    });

    it('/memory (POST) - Create memory', () => {
      return request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'Test memory content',
          type: 'NOTE',
          source: 'NATIVE_APP',
          tags: ['test'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.content).toBe('Test memory content');
          memoryId = res.body.id;
        });
    });

    it('/memory (GET) - Get all memories', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    it('/memory/search (GET) - Search memories', () => {
      return request(app.getHttpServer())
        .get('/memory/search?q=test')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/memory/stats (GET) - Get memory stats', () => {
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

    it('/memory/:id (GET) - Get memory by id', () => {
      return request(app.getHttpServer())
        .get(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(memoryId);
        });
    });

    it('/memory/:id (PUT) - Update memory', () => {
      return request(app.getHttpServer())
        .put(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ content: 'Updated memory content' })
        .expect(200)
        .expect((res) => {
          expect(res.body.content).toBe('Updated memory content');
        });
    });

    it('/memory/:id (DELETE) - Delete memory', () => {
      return request(app.getHttpServer())
        .delete(`/memory/${memoryId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });
  });

  describe('Tasks', () => {
    let taskId: string;

    beforeAll(async () => {
      // Register and login to get token
      const email = `task-test-${Date.now()}@example.com`;
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecureP@ss123',
          name: 'Task Test User',
        });
      accessToken = registerRes.body.accessToken;
    });

    it('/tasks (POST) - Create task', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test task',
          description: 'Test task description',
          priority: 'MEDIUM',
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Test task');
          taskId = res.body.id;
        });
    });

    it('/tasks (GET) - Get all tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('/tasks/stats (GET) - Get task stats', () => {
      return request(app.getHttpServer())
        .get('/tasks/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('completed');
          expect(res.body).toHaveProperty('pending');
        });
    });

    it('/tasks/:id (PUT) - Update task', () => {
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('COMPLETED');
        });
    });

    it('/tasks/:id (DELETE) - Delete task', () => {
      return request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });
  });

  describe('Users', () => {
    beforeAll(async () => {
      // Register and login to get token
      const email = `user-test-${Date.now()}@example.com`;
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecureP@ss123',
          name: 'User Test User',
        });
      accessToken = registerRes.body.accessToken;
    });

    it('/users/me (GET) - Get user profile', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
        });
    });

    it('/users/me (PUT) - Update user profile', () => {
      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
        });
    });

    it('/users/me/stats (GET) - Get user stats', () => {
      return request(app.getHttpServer())
        .get('/users/me/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('memories');
          expect(res.body).toHaveProperty('tasks');
        });
    });

    it('/users/me/preferences (GET) - Get user preferences', () => {
      return request(app.getHttpServer())
        .get('/users/me/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('/users/me/preferences (PUT) - Update user preferences', () => {
      return request(app.getHttpServer())
        .put('/users/me/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ aiTone: 'friendly' })
        .expect(200);
    });
  });

  describe('Security', () => {
    it('Should return 401 for unauthorized requests', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .expect(401);
    });

    it('Should return 401 for invalid token', () => {
      return request(app.getHttpServer())
        .get('/memory')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Validation', () => {
    it('Should return 400 for invalid registration data', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'short',
        })
        .expect(400);
    });

    it('Should return 400 for invalid memory data', async () => {
      const email = `val-test-${Date.now()}@example.com`;
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          password: 'SecureP@ss123',
        });
      const token = registerRes.body.accessToken;

      return request(app.getHttpServer())
        .post('/memory')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 123, // should be string
        })
        .expect(400);
    });
  });
});
