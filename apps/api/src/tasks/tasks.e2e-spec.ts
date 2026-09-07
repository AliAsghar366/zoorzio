import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Tasks (e2e)', () => {
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
        email: `tasks-e2e-${Date.now()}@example.com`,
        password: 'SecureP@ss123',
        name: 'Tasks E2E Test User',
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CRUD Operations', () => {
    let taskId: string;

    it('should create a task', () => {
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

    it('should get all tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get task by id', () => {
      return request(app.getHttpServer())
        .get(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
        });
    });

    it('should update task', () => {
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated task title',
          status: 'IN_PROGRESS',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe('Updated task title');
          expect(res.body.status).toBe('IN_PROGRESS');
        });
    });

    it('should complete task', () => {
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.completedAt).toBeDefined();
        });
    });

    it('should delete task', () => {
      return request(app.getHttpServer())
        .delete(`/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('Filtering', () => {
    beforeAll(async () => {
      // Create test tasks
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Pending task 1', status: 'PENDING' });

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Pending task 2', status: 'PENDING' });

      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Completed task', status: 'COMPLETED' });
    });

    it('should filter by status', () => {
      return request(app.getHttpServer())
        .get('/tasks?status=PENDING')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          res.body.forEach((task: any) => {
            expect(task.status).toBe('PENDING');
          });
        });
    });
  });

  describe('Statistics', () => {
    it('should return task statistics', () => {
      return request(app.getHttpServer())
        .get('/tasks/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('completed');
          expect(res.body).toHaveProperty('pending');
          expect(res.body).toHaveProperty('overdue');
          expect(res.body).toHaveProperty('completionRate');
        });
    });

    it('should return today tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should return overdue tasks', () => {
      return request(app.getHttpServer())
        .get('/tasks/overdue')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Task Suggestions', () => {
    it('should return task suggestions', () => {
      return request(app.getHttpServer())
        .get('/tasks/suggest')
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
        .get('/tasks')
        .expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/tasks')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Validation', () => {
    it('should fail with invalid priority', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          priority: 'INVALID',
        })
        .expect(400);
    });

    it('should fail with empty title', () => {
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '',
        })
        .expect(400);
    });
  });
});
