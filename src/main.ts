import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Refuses cross-origin POST/PATCH/DELETE, which protects the session cookie.
  app.enableCsrfProtection();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
