import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { WorkforceUsersController } from './workforce-users.controller';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'WORKFORCE_SERVICE',
        transport: Transport.TCP,
        options: { host: 'localhost', port: 4001 },
      },
    ]),
  ],
  controllers: [WorkforceUsersController],
})
export class WorkforceUsersModule {}
