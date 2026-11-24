import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkforceEnv } from '../config/env.validation';
import { EVENT_PUBLISH_TIMEOUT_MS, NOTIFICATION_EVENTS_CLIENT } from './events.constants';
import { WorkOrderEventsPublisher } from './work-order-events.publisher';

@Module({
  imports: [
    // Bağlantı ilk emit'te kurulur: RabbitMQ kapalıyken servis yine açılır (B23)
    ClientsModule.registerAsync([
      {
        name: NOTIFICATION_EVENTS_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService<WorkforceEnv, true>) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get('RABBITMQ_URL', { infer: true })],
            queue: config.get('RABBITMQ_QUEUE', { infer: true }),
            // notification-service ile aynı olmalı; farklıysa assertQueue PRECONDITION_FAILED verir
            queueOptions: { durable: true },
            persistent: true,
          },
        }),
      },
    ]),
  ],
  providers: [
    WorkOrderEventsPublisher,
    {
      provide: EVENT_PUBLISH_TIMEOUT_MS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<WorkforceEnv, true>) =>
        config.get('RABBITMQ_PUBLISH_TIMEOUT_MS', { infer: true }),
    },
  ],
  exports: [WorkOrderEventsPublisher],
})
export class EventsModule {}
