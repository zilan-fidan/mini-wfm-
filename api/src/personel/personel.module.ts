import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PersonelController } from './personel.controller';

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
  controllers: [PersonelController],
})
export class PersonelModule {}
