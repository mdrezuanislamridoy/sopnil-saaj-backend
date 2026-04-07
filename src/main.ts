import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerSetting } from './config/swagger/swagger';
import { GlobalExceptionFilter } from './filters/exception.filter';
import { JwtAuthGuard } from './modules/auth/strategies/jwt.guard';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  SwaggerSetting(app);

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000, () => {
    console.log(`Server is running on http://localhost:${process.env.PORT ?? 3000}/docs`);
  });
}
bootstrap();
