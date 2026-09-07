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

  app.enableCors({
    origin: configService.get('CORS_ORIGIN', 'http://localhost:3000'),
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
