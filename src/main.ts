import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SwaggerSetting } from './config/swagger/swagger';
import { GlobalExceptionFilter } from './filters/exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // cros setup
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Set file size limits for uploads
  app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PATCH') {
      req.on('data', () => {});
    }
    next();
  });

  SwaggerSetting(app);

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT ?? 3000}/docs`);
  });
}
bootstrap();
