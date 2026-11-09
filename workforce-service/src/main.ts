import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AsyncMicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { CorrelationContextService } from './common/correlation/correlation-context.service';
import { createCorrelationHook } from './common/correlation/correlation.hook';
import { WorkforceEnv } from './config/env.validation';

async function bootstrap() {
  // TCP portu ayardan okunur; ayarlar geçersizse uygulama burada açılmadan durur
  const app = await NestFactory.createMicroservice<AsyncMicroserviceOptions>(AppModule, {
    inject: [ConfigService],
    useFactory: (config: ConfigService<WorkforceEnv, true>) => ({
      transport: Transport.TCP,
      options: { host: '0.0.0.0', port: config.get('PORT', { infer: true }) },
    }),
  });

  // new yerine app.get: interceptor'a inject edilen ile aynı singleton (aynı ALS) olmalı.
  // Hook listen'dan önce kaydedilir ki ilk mesajlar da bağlamla işlensin.
  const correlation = app.get(CorrelationContextService);
  app.registerPreRequestHook(createCorrelationHook(correlation));

  await app.listen();
}
bootstrap();
