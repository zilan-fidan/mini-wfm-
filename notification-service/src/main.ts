import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { NotificationEnv } from './config/env.validation';

async function bootstrap() {
  // Hibrit uygulama: iki microservice transport'u, HTTP yok.
  // app.listen() çağrılmadığı için hiçbir HTTP portu açılmaz.
  const app = await NestFactory.create(AppModule);
  const config = app.get<ConfigService<NotificationEnv, true>>(ConfigService);

  // 1) RabbitMQ: workforce-service'in olaylarını tüketir
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [config.get('RABBITMQ_URL', { infer: true })],
      queue: config.get('RABBITMQ_QUEUE', { infer: true }),
      // Kuyruk ve mesajlar broker yeniden başlasa da kaybolmaz; workforce-service ile aynı olmalı
      queueOptions: { durable: true },
      // Manuel ack: mesaj bildirim yazıldıktan sonra handler içinde ack'lenir
      noAck: false,
      prefetchCount: config.get('RABBITMQ_PREFETCH', { infer: true }),
    },
  });

  // 2) TCP: api'nin bildirim okuma istekleri
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: config.get('PORT', { infer: true }) },
  });

  app.enableShutdownHooks();
  await app.startAllMicroservices();
  await app.init();

  new Logger('Bootstrap').log(
    `notification-service hazır: RMQ kuyruğu "${config.get('RABBITMQ_QUEUE', { infer: true })}", ` +
      `TCP ${config.get('PORT', { infer: true })}`,
  );
}
void bootstrap();
