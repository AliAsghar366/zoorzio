import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';

/**
 * Shared app configuration (security middleware, CORS, validation, Swagger)
 * used by both the persistent-host entrypoint (main.ts) and the Vercel
 * serverless entrypoint (api/index.js) - kept in one place so the two never
 * drift apart.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.use(helmet());

  // Express defaults to a 100kb JSON body, which silently broke every feature
  // that sends base64 payloads: POST /memory/voice carries a recorded voice
  // note, and a few seconds of audio is already well past that. The request
  // was rejected before it reached the auth guard, so it surfaced as an
  // opaque 500 from an "anonymous" caller rather than anything diagnosable.
  const BODY_LIMIT = configService.get<string>('MAX_REQUEST_BODY', '25mb');
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));

  // CORS_ORIGIN accepts a comma-separated list, so the API can serve the app
  // and the marketing site at once - and keep working when Next.js falls back
  // to another port because 3000 is already taken.
  const corsOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('Zoorzio API')
    .setDescription('The memory layer that actually remembers')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
