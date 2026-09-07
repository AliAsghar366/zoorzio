import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Users (e2e)', () => {
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
        email: `users-e2e-${Date.now()}@example.com`,
        password: 'SecureP@ss123',
        name: 'Users E2E Test User',
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Profile', () => {
    it('should get user profile', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('name');
        });
    });

    it('should update user profile', () => {
      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          timezone: 'Asia/Karachi',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
          expect(res.body.timezone).toBe('Asia/Karachi');
        });
    });
  });

  describe('User Preferences', () => {
    it('should get user preferences', () => {
      return request(app.getHttpServer())
        .get('/users/me/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should update user preferences', () => {
      return request(app.getHttpServer())
        .put('/users/me/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          aiTone: 'friendly',
          notifications: {
            email: true,
            push: false,
            sms: true,
          },
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.aiTone).toBe('friendly');
        });
    });
  });

  describe('User Statistics', () => {
    it('should get user statistics', () => {
      return request(app.getHttpServer())
        .get('/users/me/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('memories');
          expect(res.body).toHaveProperty('tasks');
          expect(res.body).toHaveProperty('calendars');
          expect(res.body).toHaveProperty('channels');
        });
    });
  });

  describe('Account Management', () => {
    it('should delete user account', async () => {
      // Create a separate user for deletion test
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: `delete-test-${Date.now()}@example.com`,
          password: 'SecureP@ss123',
        });
      const deleteToken = res.body.accessToken;

      return request(app.getHttpServer())
        .delete('/users/me')
        .set('Authorization', `Bearer ${deleteToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });
  });

  describe('Authorization', () => {
    it('should fail without token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Validation', () => {
    it('should fail with invalid timezone', () => {
      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          timezone: 'Invalid/Timezone',
        })
        .expect(400);
    });

    it('should fail with invalid language', () => {
      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          language: 'xyz',
        })
        .expect(400);
    });
  });
});
