import { Module } from '@nestjs/common';
import { WorkforceUsersController } from './workforce-users.controller';

// WORKFORCE_SERVICE istemcisi AppModule'de global olarak kaydedilir
@Module({
  controllers: [WorkforceUsersController],
})
export class WorkforceUsersModule {}
