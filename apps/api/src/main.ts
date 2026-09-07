import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';

async function bootstrap() {
  // rawBody: true preserves the raw request buffer (req.rawBody) needed to
  // verify Stripe webhook signatures, alongside the normal parsed JSON body.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);

  // Start server (this entrypoint is for persistent hosts - Railway/Render/a
  // VM/Docker. The Vercel serverless deployment uses api/index.js instead,
  // which shares configureApp() but never calls .listen()).
  const configService = app.get(ConfigService);
  const port = configService.get('PORT', 3000);
  await app.listen(port);
  console.log(`Zoorzio API running on: http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
