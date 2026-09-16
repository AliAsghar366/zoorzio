import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';

/**
 * Shared app configuration (security middleware, CORS, validation, Swagger)
 * used by both the persistent-host entrypoint (main.ts) and the Vercel
 * serverless entrypoint (api/index.js) - kept in one place so the two never
 * drift apart.
 */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.use(helmet());

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
