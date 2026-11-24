import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';

// NOTIFICATION_SERVICE istemcisi AppModule'de global olarak kaydedilir
@Module({
  controllers: [NotificationsController],
})
export class NotificationsModule {}
