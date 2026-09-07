import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Calendar (e2e)', () => {
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
        email: `calendar-e2e-${Date.now()}@example.com`,
        password: 'SecureP@ss123',
        name: 'Calendar E2E Test User',
      });
    accessToken = res.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Calendar Events', () => {
    it('should get calendar events', () => {
      return request(app.getHttpServer())
        .get('/calendar/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get today events', () => {
      return request(app.getHttpServer())
        .get('/calendar/today')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get upcoming events', () => {
      return request(app.getHttpServer())
        .get('/calendar/upcoming?days=7')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get calendar health', () => {
      return request(app.getHttpServer())
        .get('/calendar/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Calendar Integration', () => {
    it('should connect Google Calendar', () => {
      return request(app.getHttpServer())
        .post('/calendar/google/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('calendarsCount');
        });
    });

    it('should connect Outlook Calendar', () => {
      return request(app.getHttpServer())
        .post('/calendar/outlook/connect')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          accessToken: 'test-access-token',
          refreshToken: 'test-refresh-token',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('calendarsCount');
        });
    });
  });

  describe('Authorization', () => {
    it('should fail without token', () => {
      return request(app.getHttpServer())
        .get('/calendar/events')
        .expect(401);
    });

    it('should fail with invalid token', () => {
      return request(app.getHttpServer())
        .get('/calendar/events')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Date Filtering', () => {
    it('should filter events by date range', () => {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      return request(app.getHttpServer())
        .get(`/calendar/events?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});
