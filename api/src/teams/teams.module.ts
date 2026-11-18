import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';

// WORKFORCE_SERVICE istemcisi AppModule'de global olarak kaydedilir
@Module({
  controllers: [TeamsController],
})
export class TeamsModule {}
