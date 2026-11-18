import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { CorrelationContextService } from './common/correlation/correlation-context.service';
import { createCorrelationDispatchHook } from './common/correlation/correlation-dispatch.hook';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ApiEnv } from './config/env.validation';
import { WORKFORCE_SERVICE } from './constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // workforce-service'e giden her mesaja correlation id tek yerden eklenir; controller'lar değişmez
  app
    .get<ClientProxy>(WORKFORCE_SERVICE)
    .setOnDispatchHook(createCorrelationDispatchHook(app.get(CorrelationContextService)));

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
  .setTitle('Mini WFM API')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Login işleminden aldığınız accessToken değerini girin.',
    },
    'access-token',
  )
  .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const configService = app.get<ConfigService<ApiEnv, true>>(ConfigService);
  await app.listen(configService.get('PORT', { infer: true }));
}
bootstrap();